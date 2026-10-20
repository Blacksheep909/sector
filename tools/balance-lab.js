// Balance lab: hard numbers on what's strong.
//   node tools/balance-lab.js duel [budget]        exact equal-budget fights between every land/air stack (no dice luck: all 36 rolls)
//   node tools/balance-lab.js games [n]            bot games: $ of enemy kit each unit type destroys per $ spent on it
//   node tools/balance-lab.js ab [n] [unit,...]    A/B: one bot leans on a unit (deploys it whenever it can); its win rate vs the 25% baseline
//   node tools/balance-lab.js skill [n]            does a better bot beat worse ones? (skill curve check)
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const E = require('../shared/engine');
const { botStep, draftStep } = require('../shared/bot');

// ───────── exact duels ─────────
// a bare 2-player board: the defender stands on plains, the attacker steps in from the hex next to it
function duelBoard() {
  const roster = [{ id: 'A', name: 'A', color: E.COLORS[0], faction: 'none' }, { id: 'D', name: 'D', color: E.COLORS[1], faction: 'none' }];
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'small', seed: 'lab' }, roster);
  s.phase = 'play'; s.units = {}; s.weather = null;
  for (const k in s.map.tiles) { const t = s.map.tiles[k]; t.owner = null; t.structs = []; t.struct = null; delete t.river; delete t.poi; t.res = false; }
  // two neighbouring plains hexes far from the edge
  const land = Object.keys(s.map.tiles).filter(k => E.isLandTile(s.map.tiles[k]) && s.map.tiles[k].t !== 'mountain');
  const target = land.find(k => E.neighbors(k).every(n => s.map.tiles[n] && E.isLandTile(s.map.tiles[n])));
  const stage = E.neighbors(target)[0];
  for (const k of E.area(target, 2)) if (s.map.tiles[k]) s.map.tiles[k].t = 'plains';
  s.map.tiles[target].owner = 'D'; s.map.tiles[stage].owner = 'A';
  return { s, target, stage };
}
// what $budget buys of one type, packed into one hex (carriers fill their seats with Grunts)
function buy(type, budget) {
  const out = [];
  const d = E.UNITS[type];
  let left = budget;
  while (left >= d.cost && E.stackFits(out, [type])) { out.push(type); left -= d.cost; }
  if (type !== 'grunt' && d.lift) while (left >= 1 && E.stackFits(out, ['grunt'])) { out.push('grunt'); left -= 1; }
  return out;
}
// outcome over all 36 rolls: P(attack wins), and the expected $ each side loses
function duel(s, target, stage, attT, defT) {
  s.units = {};
  const att = attT.map(t => E.player(s, 'A') && { id: 'a' + Math.random(), owner: 'A', type: t, hex: stage });
  const def = defT.map(t => ({ id: 'd' + Math.random(), owner: 'D', type: t, hex: target }));
  for (const u of att.concat(def)) s.units[u.id] = u;
  const c = E.combatCalc(s, 'A', att, stage, target, false);
  const cost = list => list.reduce((a, u) => a + E.UNITS[u.type].cost, 0);
  const cheapest = list => list.slice().sort((a, b) => E.UNITS[a.type].cost - E.UNITS[b.type].cost)[0];
  const tough = list => list.some(u => ['juggernaut', 'titan', 'medic'].includes(E.UNITS[u.type].ability));
  let win = 0, aLoss = 0, dLoss = 0;
  for (let a = 1; a <= 6; a++) for (let d = 1; d <= 6; d++) {
    const as = c.att.chips * Math.max(1, a + c.att.mult), ds = c.def.chips * Math.max(1, d + c.def.mult);
    if (c.winProb >= 1 || as > ds) { win++; dLoss += cost(def); if (c.winProb < 1 && ds >= 0.6 * as && att.length > 1 && !tough(att)) aLoss += E.UNITS[cheapest(att).type].cost; }
    else { aLoss += cost(att); if (as >= 0.6 * ds && def.length > 1 && !tough(def)) dLoss += E.UNITS[cheapest(def).type].cost; }
  }
  return { p: win / 36, aLoss: aLoss / 36, dLoss: dLoss / 36, att: c.att, def: c.def };
}
function duelReport(budget) {
  const { s, target, stage } = duelBoard();
  const types = Object.keys(E.UNITS).filter(t => !E.isSea(t) && E.UNITS[t].cls !== 'art' && E.UNITS[t].atk > 0);
  const rows = [];
  for (const A of types) {
    let atkP = 0, holdP = 0, atkTrade = 0, defTrade = 0, n = 0;
    const aStack = buy(A, budget);
    for (const D of types) {
      const dStack = buy(D, budget);
      if (!aStack.length || !dStack.length) continue;
      const x = duel(s, target, stage, aStack, dStack), y = duel(s, target, stage, dStack, aStack);
      atkP += x.p; holdP += 1 - y.p;
      atkTrade += x.dLoss - x.aLoss; defTrade += y.aLoss - y.dLoss;
      n++;
    }
    const spent = aStack.reduce((a, t) => a + E.UNITS[t].cost, 0);
    rows.push({ unit: A, stack: summarise(aStack), spent, atkWin: atkP / n, holdWin: holdP / n, atkTrade: atkTrade / n, defTrade: defTrade / n });
  }
  rows.sort((a, b) => (b.atkWin + b.holdWin) - (a.atkWin + a.holdWin));
  console.log(`Equal-budget duels ($${budget} each, one hex each, open plains, no buildings, every pairing both ways)`);
  console.log('unit        stack bought                 $    attack-win  hold-win   $ swing attacking  $ swing defending');
  for (const r of rows) console.log(r.unit.padEnd(11), r.stack.padEnd(28), String(r.spent).padStart(3), pct(r.atkWin).padStart(10), pct(r.holdWin).padStart(10), r.atkTrade.toFixed(1).padStart(18), r.defTrade.toFixed(1).padStart(18));
  return rows;
}
const summarise = list => { const c = {}; for (const t of list) c[t] = (c[t] || 0) + 1; return Object.entries(c).map(([t, n]) => n + '×' + t).join(' + '); };
const pct = x => (x * 100).toFixed(0) + '%';

// ───────── bot games ─────────
function playGame(cfg) {
  if (cfg.noBonus) for (const d in E.DIFFICULTY) E.DIFFICULTY[d].income = 1;   // skill test: same economy, only the decisions differ
  const facs = Object.keys(E.FACTIONS);
  const N = cfg.players || 4;
  const roster = Array.from({ length: N }, (_, i) => ({ id: 'p' + i, name: 'Bot' + i, color: E.COLORS[i], faction: facs[Math.floor(Math.random() * facs.length)], bot: true, diff: (cfg.diffs && cfg.diffs[i]) || 'medium' }));
  const { state: s } = E.createGame({ mode: cfg.mode || 'domination', mapSize: 'medium', timer: 0, maxRounds: cfg.maxRounds || 45, events: 'on' }, roster);
  while (s.phase === 'spawn') for (const p of s.players) { const a = { a: 'spawnPick', auto: true }; E.applyAction(s, p.id, a); }
  while (s.phase === 'draft') for (const p of s.players) { const a = draftStep(s, p.id); if (a) E.applyAction(s, p.id, a); }
  const focus = cfg.focus;   // A/B: p0 leans on this unit
  if (focus) { const p0 = s.players[0]; if (!p0.arsenal.includes(focus)) p0.arsenal.push(focus); }
  const stats = {};   // per unit type: spent, killedValue (credited), lostValue
  const st = t => stats[t] = stats[t] || { spent: 0, deployed: 0, kv: 0, lost: 0 };
  let actions = 0;
  while (s.phase === 'play' && actions < 70000) {
    const p = E.current(s), mem = {}; let n = 0;
    while (s.phase === 'play' && E.current(s).id === p.id) {
      let a = botStep(s, p.id, mem); if (++n > 110) a = { a: 'end' };
      if (focus && p.id === 'p0' && a.a === 'deploy' && a.unit !== focus && E.unitCost(p, focus) <= p.cash) {
        const hx = E.deployHexes(s, p.id, focus); if (hx.length) a = { a: 'deploy', unit: focus, hex: hx.includes(a.hex) ? a.hex : hx[0] };
      }
      const before = {}; for (const id in s.units) before[id] = { type: s.units[id].type, owner: s.units[id].owner };
      const r = E.applyAction(s, p.id, a); actions++;
      if (!r.ok) { if (a.a === 'end') break; continue; }
      if (a.a === 'deploy') { const x = st(a.unit); x.deployed++; x.spent += E.unitCost(p, a.unit); }
      for (const e of r.events) {
        if (e.e !== 'combat') continue;
        const dead = (e.killed || []).concat(e.pyrrhic || []).map(id => before[id]).filter(Boolean);
        for (const side of ['att', 'def']) {
          const pidSide = e[side].pid, mine = e[side].units || [];
          const enemyDead = dead.filter(u => u.owner !== pidSide).reduce((v, u) => v + E.UNITS[u.type].cost, 0);
          const w = mine.reduce((v, t) => v + (side === 'att' ? E.UNITS[t].atk : E.UNITS[t].def) || 0, 0) || 1;
          for (const t of mine) st(t).kv += enemyDead * ((side === 'att' ? E.UNITS[t].atk : E.UNITS[t].def) || 0) / w;
        }
        for (const u of dead) st(u.type).lost += E.UNITS[u.type].cost;
      }
    }
  }
  const winner = s.winner ? s.winner.pid : null;
  return { winner, rounds: s.turn.round, stats, decks: s.players.map(p => ({ id: p.id, arsenal: p.arsenal.slice(), alive: p.alive, land: E.ownedLand(s, p.id).length })) };
}
function runParallel(jobs, cb) {
  return new Promise(res => {
    const out = []; let next = 0, done = 0;
    const W = Math.min(os.cpus().length, jobs.length);
    for (let w = 0; w < W; w++) {
      const wk = new Worker(__filename, { workerData: { worker: true } });
      const feed = () => { if (next >= jobs.length) { wk.terminate(); return; } const i = next++; wk.postMessage({ i, cfg: jobs[i] }); };
      wk.on('message', m => { out[m.i] = m.r; done++; if (cb) cb(done, jobs.length); if (done === jobs.length) res(out); feed(); });
      wk.on('error', e => { console.error(e); });
      feed();
    }
  });
}
if (!isMainThread && workerData && workerData.worker) {
  parentPort.on('message', m => parentPort.postMessage({ i: m.i, r: playGame(m.cfg) }));
} else if (require.main === module) (async () => {
  const [mode = 'duel', a1, a2] = process.argv.slice(2);
  const tick = (d, n) => process.stderr.write(`\r${d}/${n} games`);
  if (mode === 'duel') { duelReport(+a1 || 30); if (!a1) { console.log(); duelReport(15); } return; }
  if (mode === 'games') {
    const n = +a1 || 40, res = await runParallel(Array.from({ length: n }, () => ({})), tick); console.error();
    const agg = {};
    for (const g of res) for (const [t, x] of Object.entries(g.stats)) { const a = agg[t] = agg[t] || { spent: 0, deployed: 0, kv: 0, lost: 0 }; for (const k in x) a[k] += x[k]; }
    // deck → win correlation
    const held = {}, wins = {};
    for (const g of res) for (const d of g.decks) for (const t of new Set(d.arsenal)) { held[t] = (held[t] || 0) + 1; if (d.id === g.winner) wins[t] = (wins[t] || 0) + 1; }
    console.log(`${n} four-bot games, avg ${(res.reduce((a, g) => a + g.rounds, 0) / n).toFixed(1)} rounds`);
    console.log('unit        deployed   $ spent   enemy $ destroyed per $ spent   own $ lost per $   deck win rate (25% = average)');
    for (const [t, a] of Object.entries(agg).sort((x, y) => y[1].kv / Math.max(1, y[1].spent) - x[1].kv / Math.max(1, x[1].spent))) {
      if (a.spent < 20) continue;
      console.log(t.padEnd(11), String(a.deployed).padStart(8), String(a.spent).padStart(9), (a.kv / a.spent).toFixed(2).padStart(20), (a.lost / a.spent).toFixed(2).padStart(22), held[t] ? (pct((wins[t] || 0) / held[t]) + ` of ${held[t]}`).padStart(20) : '');
    }
    return;
  }
  if (mode === 'ab') {
    const n = +a1 || 24, units = (a2 || 'grunt,banshee,stormcrow,ravager,wren,valkyrie,seraph,mauler,hellcat,wraith,bulwark,lancer').split(',');
    const jobs = []; for (const u of units) for (let i = 0; i < n; i++) jobs.push({ focus: u });
    for (let i = 0; i < n; i++) jobs.push({ focus: null });
    const res = await runParallel(jobs, tick); console.error();
    const by = {}; jobs.forEach((j, i) => { const k = j.focus || '(control)'; const b = by[k] = by[k] || { n: 0, w: 0, land: 0, alive: 0 }; b.n++; if (res[i].winner === 'p0') b.w++; const d = res[i].decks[0]; b.land += d.land; if (d.alive) b.alive++; });
    console.log(`A/B: one of 4 medium bots deploys the named unit whenever it can afford it (${n} games each)`);
    console.log('focus unit   win rate   survived   avg land at end');
    for (const [k, b] of Object.entries(by).sort((x, y) => y[1].w / y[1].n - x[1].w / x[1].n)) console.log(k.padEnd(12), pct(b.w / b.n).padStart(8), pct(b.alive / b.n).padStart(10), (b.land / b.n).toFixed(0).padStart(12));
    return;
  }
  if (mode === 'skill') {
    const n = +a1 || 30, jobs = Array.from({ length: n }, () => ({ diffs: ['hard', 'medium', 'medium', 'medium'], noBonus: true }));
    const res = await runParallel(jobs, tick); console.error();
    console.log(`one hard bot vs three medium bots (${n} games): hard wins ${pct(res.filter(r => r.winner === 'p0').length / n)} (25% = no skill edge)`);
  }
})();
module.exports = { duel, duelBoard, buy, playGame };
