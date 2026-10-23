// Stress the rooms server with random menu and game actions from several clients at once, and report any crash.
// node tools/fuzz-rooms.js [seconds] [clients]   (starts its own server on port 3015; exits 1 if the server dies or errors)
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const PORT = 3015, SECS = +(process.argv[2] || 60), N = +(process.argv[3] || 6);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sector-fuzz-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let out = '';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_NO_UPDATE: '1', SECTOR_FAST: '1', SECTOR_PUBLIC_WAIT: '2500', SECTOR_AWAY_MS: '1500', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') } });
srv.stdout.on('data', d => { out += d; }); srv.stderr.on('data', d => { out += d; });
let died = null; srv.on('exit', code => { died = code; });
const SC = require('../shared/scenarios');
const rnd = a => a[Math.floor(Math.random() * a.length)];
function client(i) {
  const c = { i, ws: null, lobby: null, state: null, you: null, party: null, code: null, open: false };
  const connect = () => new Promise(res => {
    c.ws = new WebSocket('ws://localhost:' + PORT); c.open = false;
    c.ws.onopen = () => { c.open = true; c.send({ t: 'auth', name: 'F' + i, profile: { id: ('f' + i).padEnd(32, String(i % 10)), secret: 'fuzzsecret' + i + 'xxxxxxxx' } }); res(); };
    c.ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'lobby') { c.lobby = m.lobby; c.code = m.lobby.code; } if (m.t === 'state') c.state = m.state; if (m.t === 'welcome') c.you = m.you; if (m.t === 'left' || m.t === 'kicked' || m.t === 'noRoom') { c.lobby = null; c.state = null; } if (m.t === 'party') c.party = m.party; };
    c.ws.onclose = () => { c.open = false; }; c.ws.onerror = () => {};
  });
  c.send = o => { try { if (c.open) c.ws.send(JSON.stringify(o)); } catch (e) {} };
  c.connect = connect;
  return c;
}
const ops = [
  [3, c => c.send({ t: 'quick' })],
  [3, c => c.send({ t: 'create' })],
  [2, (c, all) => { const o = rnd(all).code; if (o) c.send({ t: 'join', code: o }); }],
  [3, c => c.send({ t: 'leave' })],
  [2, c => c.send({ t: 'addBot' })],
  [2, c => c.send({ t: 'settings', settings: { spawns: rnd(['random', 'pick']), mapSize: 'small', speed: 'super' } })],
  [3, c => c.send({ t: 'start' })],
  [2, c => c.send({ t: 'scenario', id: rnd(SC.SCENARIOS).id })],
  [2, c => c.send({ t: 'toLobby' })],
  [5, c => c.send({ t: 'act', action: { a: 'end' }, seq: 1 })],
  [2, c => c.send({ t: 'act', action: { a: 'choose', pick: 'income' }, seq: 2 })],
  [2, c => { const s = c.state; if (s && s.spawn) c.send({ t: 'act', action: { a: 'spawnPick', auto: true }, seq: 3 }); }],
  [2, c => { const s = c.state; if (s && s.draft) c.send({ t: 'act', action: { a: 'draftPick', idx: 0 }, seq: 4 }); }],
  [3, c => { const s = c.state; if (!s || !s.units) return; const us = Object.values(s.units).filter(u => u.owner === c.you); if (!us.length) return; const u = rnd(us), ks = Object.keys(s.map.tiles); c.send({ t: 'act', action: { a: 'move', from: u.hex, units: [u.id], to: rnd(ks) }, seq: 5 }); }],
  [1, c => c.send({ t: 'battleReady' })],
  [1, c => c.send({ t: 'ow', fire: Math.random() < 0.5 })],
  [1, c => c.send({ t: 'undo' })],
  [1, c => c.send({ t: 'pause', on: Math.random() < 0.5 })],
  [1, c => c.send({ t: 'speed', v: rnd(['normal', 'fast', 'super', 'max']) })],
  [2, c => c.send({ t: 'partyCreate' })],
  [2, (c, all) => { const p = rnd(all).party; if (p) c.send({ t: 'partyJoin', code: p.code }); }],
  [1, c => c.send({ t: 'partyLeave' })],
  [1, c => c.send({ t: 'chat', text: 'hi F1 F2' })],
  [1, c => c.send({ t: 'me', faction: rnd(['iron', 'volt', 'null']), color: rnd(['#ff4f5e', '#36c9ff']) })],
  [1, c => c.send({ t: 'kick', id: 'p' + (1 + Math.floor(Math.random() * 6)) })],
  [1, c => c.send({ t: 'leaderboard', period: 'all' })],
  [1, c => c.send({ t: 'takeover', id: 'p' + (1 + Math.floor(Math.random() * 6)), name: 'T' })],
  [1, c => c.send({ t: 'saveGame' })],
  [1, c => { try { c.ws.close(); } catch (e) {} }],   // drop the connection; it comes back next tick
];
const bag = ops.flatMap(([w, f]) => Array(w).fill(f));
(async () => {
  await sleep(1200);
  const cs = Array.from({ length: N }, (_, i) => client(i));
  await Promise.all(cs.map(c => c.connect()));
  let n = 0; const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000 && died === null) {
    for (const c of cs) {
      if (!c.open) { if (Math.random() < 0.5) await c.connect().catch(() => {}); continue; }
      rnd(bag)(c, cs); n++;
    }
    await sleep(40 + Math.random() * 120);
  }
  await sleep(1500);
  // still alive and answering?
  let alive = false; try { alive = (await (await fetch('http://localhost:' + PORT + '/info')).json()).game === 'sector'; } catch (e) {}
  const errs = out.split('\n').filter(l => /Error|TypeError|ReferenceError|\[crash\]|    at /.test(l));
  console.log(n + ' actions from ' + N + ' clients over ' + SECS + 's · server ' + (died !== null ? 'DIED (exit ' + died + ')' : alive ? 'alive' : 'NOT ANSWERING'));
  if (errs.length) console.log(errs.slice(0, 30).join('\n'));
  try { srv.kill(); } catch (e) {}
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  process.exit(died !== null || !alive || errs.length ? 1 : 0);
})();
