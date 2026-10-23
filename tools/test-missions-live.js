// Play every mission's intended solution against a live server, with real (random) dice, many times each, and report
// how often it's won. The engine test (test-scenarios.js) fixes the dice at average rolls; this is what players get.
// node tools/test-missions-live.js [runs=12] [missionId]   (starts its own server on port 3018)
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const SC = require('../shared/scenarios');
const PORT = 3018, RUNS = +(process.argv[2] || 12), ONLY = process.argv[3];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sector-mlive-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let out = '';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_NO_UPDATE: '1', SECTOR_FAST: '1', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') } });
srv.stdout.on('data', d => { out += d; }); srv.stderr.on('data', d => { out += d; });
// one player: a websocket, the latest state, and helpers that act like the client does
function player(n) {
  const ws = new WebSocket('ws://localhost:' + PORT), c = { ws, state: null, you: null, msgs: [], seq: 1, battle: null, result: null };
  ws.onmessage = e => {
    const m = JSON.parse(e.data); c.msgs.push(m); if (c.msgs.length > 400) c.msgs.splice(0, 200);
    if (m.t === 'state') c.state = m.state; if (m.t === 'welcome') c.you = m.you;
    if (m.t === 'battle') c.battle = m; if (m.t === 'battleDone') c.battle = null;
    if (m.t === 'scenarioResult') c.result = m;
  };
  c.send = o => ws.send(JSON.stringify(o));
  c.open = new Promise(r => { ws.onopen = () => { c.send({ t: 'auth', name: 'Tester', profile: { id: ('a' + n).padEnd(32, '0'), secret: 'mission-tester-secret-' + n } }); r(); }; });
  return c;
}
const until = async (f, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; await sleep(25); } return false; };
function driver(c) {
  const S = () => c.state, me = () => c.you, L = l => S().scenario.labels[l] || l;
  const unitsAt = l => Object.values(S().units).filter(u => u.hex === L(l) && u.owner === me());
  let cardsFor = [];   // battle cards to throw into the next fight
  async function act(a) {
    const seq = c.seq++, before = c.msgs.length; c.send({ t: 'act', action: a, seq });
    // the reply: our state (seq), an error, or a battle window to deal with first
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      if (c.battle && cardsFor) {
        const hand = (S().players.find(p => p.id === me()) || {}).tactics || [];
        for (const id of cardsFor) { const card = hand.find(x => x.id === id); if (card) { c.send({ t: 'battleCard', uid: card.uid }); await sleep(60); } }
        cardsFor = null; c.send({ t: 'battleReady' });
      }
      const got = c.msgs.slice(before).find(m => (m.t === 'state' && m.seq === seq) || (m.t === 'err' && m.seq === seq));
      if (got) { cardsFor = []; return got.t === 'state' ? { ok: true } : { ok: false, err: got.msg }; }
      if (S() && S().phase === 'over') return { ok: true };
      await sleep(25);
    }
    return { ok: false, err: 'no reply' };
  }
  const g = {
    move: (from, to, types) => act({ a: 'move', from: L(from), units: unitsAt(from).filter(u => !types || types.includes(u.type)).map(u => u.id), to: L(to) }),
    assault: (to, ...groups) => act({ a: 'assault', to: L(to), groups: groups.map(([from, types]) => ({ from: L(from), units: unitsAt(from).filter(u => !types || types.includes(u.type)).map(u => u.id) })) }),
    fire: (from, to, types) => act({ a: 'fire', from: L(from), units: unitsAt(from).filter(u => !types || types.includes(u.type)).map(u => u.id), to: L(to) }),
    deploy: (unit, hex) => act({ a: 'deploy', unit, hex: L(hex) }),
    build: (struct, hex) => act({ a: 'build', struct, hex: L(hex) }),
    cards: ids => { cardsFor = ids; },   // played in the battle window of the next attack, as a player would
    async end() {
      if (S().phase === 'over') return;
      const r = S().turn.round; await act({ a: 'end' });
      await until(() => S().phase === 'over' || (S().players[S().turn.idx].id === me() && S().turn.round > r), 30000);
      // resupply comes first each turn: take the income
      if (S().phase === 'play' && S().turn.stage === 'choose') await act({ a: 'choose', pick: 'income' });
      if (S().phase === 'play' && S().turn.stage === 'crate') await act({ a: 'scrap' });
    },
    won: () => S() && S().phase === 'over' && S().winner && S().winner.pid === me() && !S().winner.failed,
  };
  return g;
}
// the same solutions as test-scenarios.js, through the live server
const SOL = {
  basic: async g => { await g.move('g', 'w1'); await g.end(); await g.deploy('grunt', 'hq'); await g.move('w1', 'w2'); await g.end(); await g.assault('obj', ['w2']); },
  pincer: async g => { await g.assault('obj', ['a'], ['b']); },
  river: async g => { await g.build('bridge', 'x'); await g.move('m', 'y'); await g.move('g', 'z'); await g.end(); await g.assault('obj', ['y'], ['z']); },
  airborne: async g => { await g.move('s', 'lz'); await g.end(); await g.assault('obj', ['lz']); },
  leapfrog: async g => { await g.move('w1', 'd1', ['grunt']); await g.move('w1', 'd2', ['jackal']); await g.move('w3', 'obj'); },
  guns: async g => { await g.fire('bas', 't1'); await g.fire('thu', 't3'); await g.end(); await g.fire('bas', 't2'); await g.fire('thu', 't4'); },
  cards: async g => { g.cards(['bayonets']); await g.assault('ox', ['x']); g.cards(['rally']); await g.assault('oy', ['y']); },
  beach: async g => { await g.move('ark', 's2'); await g.move('navy', 's1'); await g.end(); await g.move('s2', 'beach', ['grunt']); await g.end(); await g.assault('obj', ['beach']); },
  blitz: async g => { await g.fire('art', 'guard'); await g.move('tank', 'stage'); await g.move('heli', 'lz'); await g.end(); g.cards(['rally', 'barrage']); await g.assault('bhq', ['lz'], ['stage']); },
  hold: null,   // a live defence against a real bot: measured by test-scenarios.js
};
(async () => {
  await sleep(1200);
  const c = player(1); await c.open;
  let fails = 0;
  for (const sc of SC.SCENARIOS.slice().sort((a, b) => a.n - b.n)) {
    if (ONLY && sc.id !== ONLY) continue;
    if (!SOL[sc.id]) { console.log('skip ' + sc.n + '. ' + sc.name + ' (live enemy: see test-scenarios.js)'); continue; }
    let wins = 0, stuck = 0, rewardBad = false; const why = {};
    for (let i = 0; i < RUNS; i++) {
      c.state = null; c.result = null; c.battle = null;
      c.send({ t: 'leave' }); await sleep(150);
      c.send({ t: 'scenario', id: sc.id });
      if (!await until(() => c.state && c.state.scenario && c.state.scenario.id === sc.id && c.state.phase === 'play')) { stuck++; why['never started'] = (why['never started'] || 0) + 1; continue; }
      c.send({ t: 'speed', v: 'super' });
      const g = driver(c);
      try { await SOL[sc.id](g); } catch (e) { why['error: ' + e.message] = (why['error: ' + e.message] || 0) + 1; }
      await until(() => c.state.phase === 'over', 8000);
      if (g.won()) {
        wins++;
        // Valor is only for the first clear: the first win pays the mission's reward, every later one nothing
        await until(() => c.result, 4000);
        const first = wins === 1, r = c.result || {};
        if (first ? !(r.first && r.valor === sc.reward) : (r.first || r.valor)) { why['reward wrong: ' + JSON.stringify({ first: r.first, valor: r.valor })] = (why['reward wrong'] || 0) + 1; rewardBad = true; }
      }
      else { const k = c.state.phase !== 'over' ? 'still playing (round ' + c.state.turn.round + ')' : (c.state.winner && (c.state.winner.failed || c.state.winner.reason)) || 'lost'; why[k] = (why[k] || 0) + 1; if (c.state.phase !== 'over') stuck++; }
    }
    const rate = Math.round(wins / RUNS * 100);
    const bad = rate < 50 || stuck > 0 || rewardBad;
    if (bad) fails++;
    console.log((bad ? 'FAIL ' : 'ok   ') + sc.n + '. ' + sc.name + ' (' + sc.tier + '): won ' + wins + '/' + RUNS + ' (' + rate + '%)' + (Object.keys(why).length ? ' · ' + Object.entries(why).map(([k, v]) => k + ' ×' + v).join(', ') : ''));
  }
  const errs = out.split('\n').filter(l => /TypeError|ReferenceError|Error:|\[crash\]/.test(l));
  if (errs.length) { fails++; console.log('server errors:\n' + errs.slice(0, 10).join('\n')); }
  srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
