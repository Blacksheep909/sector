// The server console dashboard (what Sector.exe shows) through a whole war: node tools/test-console.js
// Starts its own server on port 3014 with the dashboard forced on, and fails on any error it logs. A dashboard error once
// looped forever (logging an error redraws the dashboard) and starved every game on the server.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const PORT = 3014, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sector-console-'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let out = '';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_TUI: '1', SECTOR_PLAIN: '', SECTOR_NO_OPEN: '1', SECTOR_NO_UPDATE: '1', SECTOR_FAST: '1', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') } });
srv.stdout.on('data', d => { out += d; }); srv.stderr.on('data', d => { out += d; });
const until = async (f, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; await sleep(40); } return false; };
function client(n) {
  const ws = new WebSocket('ws://localhost:' + PORT), c = { msgs: [] };
  ws.onmessage = e => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.t === 'lobby') c.lobby = m.lobby; if (m.t === 'state') c.state = m.state; };
  c.send = o => ws.send(JSON.stringify(o)); c.close = () => ws.close();
  c.open = new Promise(r => { ws.onopen = () => { c.send({ t: 'auth', name: 'Con' + n, profile: { id: ('c' + n).padEnd(32, '0'), secret: 'console-test-secret-' + n } }); r(); }; });
  return c;
}
(async () => {
  try {
    await sleep(1200);
    ok(/SECTOR SERVER/.test(out), 'the dashboard draws');
    const a = client(1), b = client(2); await a.open; await b.open;
    a.send({ t: 'quick' }); await until(() => a.lobby); b.send({ t: 'quick' }); await until(() => b.lobby && b.lobby.players.length === 2);
    await sleep(400);
    const before = out.length;
    a.send({ t: 'start' });
    ok(await until(() => a.state && a.state.phase), 'a war deploys with the dashboard on');
    await sleep(1500);
    ok(out.length - before < 200000, 'the dashboard isn’t stuck redrawing (' + Math.round((out.length - before) / 1024) + ' KB in 1.5s)');
    b.close(); await sleep(800);
    a.send({ t: 'leave' }); await sleep(800);
    const c = client(3); await c.open; c.send({ t: 'create' }); await until(() => c.lobby); c.send({ t: 'addBot' }); await sleep(300); c.send({ t: 'start' }); await until(() => c.state && c.state.phase); await sleep(800);
    ok(!/\[crash\]|\[console\]|ReferenceError|TypeError/.test(out), 'no errors while players join, play, drop and leave' + ((out.match(/.*(\[crash\]|\[console\]|Error).*/) || [''])[0] ? ': ' + out.match(/.*(\[crash\]|\[console\]|Error).*/)[0].replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim().slice(0, 200) : ''));
  } catch (e) { console.error(e); fails++; }
  srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
