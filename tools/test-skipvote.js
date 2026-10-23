// Human-vs-human fights only skip once both players have asked: node tools/test-skipvote.js (own server on port 3031)
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const PORT = 3031;
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_SAVES: fs.mkdtempSync(path.join(os.tmpdir(), 'sv-')), SECTOR_PROFILES: path.join(os.tmpdir(), 'sv-' + Date.now() + '.json') }, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
function client(name) {
  const ws = new WebSocket('ws://localhost:' + PORT), c = { ws, lobby: null, state: null, you: null, msgs: [] };
  ws.onmessage = e => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.t === 'lobby') c.lobby = m.lobby; if (m.t === 'state') c.state = m.state; if (m.t === 'welcome') c.you = m.you; };
  c.send = o => ws.send(JSON.stringify(o));
  c.open = new Promise(r => { ws.onopen = () => { c.send({ t: 'hello', name }); r(); }; });
  return c;
}
const until = async (f, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; await sleep(50); } return false; };
(async () => {
  await sleep(1000);
  const a = client('Alice'), b = client('Bob'); await a.open; await b.open;
  await until(() => a.you && b.you && a.lobby && a.lobby.players.length === 2);
  a.send({ t: 'settings', settings: { spawns: 'random' } }); b.send({ t: 'ready', on: true }); await sleep(300);
  a.send({ t: 'start' });
  ok(await until(() => a.state && a.state.phase, 10000), 'the game starts with two humans');
  const fight = { t: 'skipFx', att: a.you, def: b.you, to: '0,0' };
  a.msgs.length = 0; b.msgs.length = 0;
  a.send(fight); await sleep(400);
  ok(b.msgs.some(m => m.t === 'skipVote' && m.pids.includes(a.you)) && a.msgs.some(m => m.t === 'skipVote'), 'one skip shows both players who asked');
  ok(!a.msgs.some(m => m.t === 'skipFx') && !b.msgs.some(m => m.t === 'skipFx'), "one player alone can't skip a fight against a human");
  b.send(fight); await sleep(400);
  ok(a.msgs.some(m => m.t === 'skipFx') && b.msgs.some(m => m.t === 'skipFx'), 'once both ask, it skips for everyone');
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
