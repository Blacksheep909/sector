// Save / resume round trip against a live server: node tools/test-save.js (starts its own server on port 3013)
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const PORT = 3013, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sector-saves-'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_DEV: '1', SECTOR_SAVES: dir }, stdio: 'ignore' });
function client(name) {
  const ws = new WebSocket('ws://localhost:' + PORT), c = { ws, lobby: null, state: null, you: null, msgs: [] };
  ws.onmessage = e => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.t === 'lobby') c.lobby = m.lobby; if (m.t === 'state') c.state = m.state; if (m.t === 'welcome') c.you = m.you; };
  c.send = o => ws.send(JSON.stringify(o));
  c.open = new Promise(r => { ws.onopen = () => { c.send({ t: 'hello', name }); r(); }; });
  return c;
}
const until = async (f, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; await sleep(50); } return false; };
(async () => {
  try {
    await sleep(1200);
    const a = client('Alice'); await a.open; await until(() => a.you && a.lobby);
    a.send({ t: 'addBot' }); a.send({ t: 'settings', settings: { speed: 'normal', spawns: 'random' } }); await until(() => a.lobby.players.length === 2);
    a.send({ t: 'autoplay', on: true }); a.send({ t: 'start' });
    ok(await until(() => a.state && a.state.phase === 'play', 20000), 'game reaches play');
    a.send({ t: 'autoplay', on: false }); a.send({ t: 'pause' });
    const before = a.state; await sleep(300);
    a.msgs.length = 0; a.send({ t: 'saveGame' });
    ok(await until(() => a.msgs.some(m => m.t === 'saved')), 'host can save the game');
    ok(fs.readdirSync(dir).filter(f => f.endsWith('.json')).length === 1, 'a save file is written');
    const round = a.state.turn.round, units = Object.keys(a.state.units).length, seed = a.state.seed;
    a.send({ t: 'toLobby' });
    ok(await until(() => !a.state && a.lobby && !a.lobby.inGame && (a.lobby.saves || []).length === 1), 'the save is listed in the lobby');
    // a new person with the same name comes back on another connection
    a.ws.close(); await sleep(300);
    const b = client('alice'); await b.open; await until(() => b.you && b.lobby && b.lobby.hostId === b.you);
    ok(b.lobby.hostId === b.you && b.lobby.saves.length === 1, 'the new host sees the saved war');
    b.send({ t: 'loadSave', id: b.lobby.saves[0].id });
    ok(await until(() => b.state && b.state.seed === seed && b.state.phase === 'play'), 'the war resumes');
    ok(b.state && b.state.turn.round === round && Object.keys(b.state.units).length === units, 'same round and armies');
    const me = b.state && b.state.players.find(p => p.id === b.you);
    ok(!!me && !me.bot && me.name === before.players.find(p => !p.bot).name, 'the returning player gets their own seat back');
    ok(b.lobby.players.some(p => p.bot), 'the bot seat is still a bot');
  } catch (e) { console.error(e); fails++; }
  srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
