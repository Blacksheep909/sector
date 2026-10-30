// Bot lab: how bots actually play, on fixed seeds so a change can be compared before/after.
//   node tools/bot-lab.js [games=12] [diff=hard] [players=4]
// Reports: wars won outright vs run to the round limit, when commanders get knocked out, Arks bought and troops landed
// from the sea, and where economic buildings go (hexes from the nearest enemy land when built) and how many are lost.
const E = require('../shared/engine'); const { botStep, draftStep } = require('../shared/bot');
const games = +(process.argv[2] || 12), diff = process.argv[3] || 'hard', N = +(process.argv[4] || 4);
const facs = Object.keys(E.FACTIONS), out = { conquest: 0, timeout: 0, rounds: 0, knockouts: [], arks: 0, landings: 0, econBuilt: 0, econDist: 0, econFront: 0, econLost: 0, hqAttacks: 0, fobDist: 0, fobs: 0 };
const ECON = ['warehouse', 'refinery', 'depot'];
for (let g = 0; g < games; g++) {
  const roster = Array.from({ length: N }, (_, i) => ({ id: 'p' + i, name: 'Bot' + i, color: E.COLORS[i], faction: facs[(i + g) % facs.length], bot: true, diff: diff.includes(':') ? diff.split(':')[i % 2] : diff }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', timer: 0, maxRounds: 50, seed: 'lab' + g }, roster);
  while (s.phase === 'draft') for (const p of s.players) { const a = draftStep(s, p.id); if (a) E.applyAction(s, p.id, a); }
  const dist = (k, pid) => { let m = 99; for (const q in s.map.tiles) { const t = s.map.tiles[q]; if (t.owner && t.owner !== pid && !E.isAlly(s, pid, t.owner) && E.isLandTile(t)) m = Math.min(m, E.dist(k, q)); } return m; };
  let actions = 0; const alive = new Set(s.players.map(p => p.id));
  while (s.phase === 'play' && actions < 80000) {
    const p = E.current(s); const mem = {}; let n = 0;
    while (s.phase === 'play' && E.current(s).id === p.id) {
      let a = botStep(s, p.id, mem); if (++n > 90) a = { a: 'end' };
      const before = a.a === 'build' && ECON.concat('fob').includes(a.struct) && !E.structsOf(s.map.tiles[a.hex]).some(x => x.type === a.struct) ? dist(a.hex, p.id) : null;
      const r = E.applyAction(s, p.id, a); actions++; if (!r.ok) continue;
      if (before !== null) { if (a.struct === 'fob') { out.fobs++; out.fobDist += before; } else { out.econBuilt++; out.econDist += before; if (before <= 2) out.econFront++; } }
      if (a.a === 'deploy' && a.unit === 'ark') out.arks++;
      for (const e of r.events) {
        if (e.e === 'move' && e.pid === p.id) { const from = s.map.tiles[(e.path || [])[0]]; const to = s.map.tiles[(e.path || []).slice(-1)[0]]; if (from && to && E.isWater(from) && E.isLandTile(to) && e.units.some(id => s.units[id] && !E.isSea(s.units[id].type))) out.landings++; }
        if (e.e === 'combat' && e.def && e.def.pid && s.map.tiles[e.to] && E.structsOf(s.map.tiles[e.to]).some(x => x.type === 'hq')) out.hqAttacks++;
      }
    }
    for (const q of s.players) if (alive.has(q.id) && !q.alive) { alive.delete(q.id); out.knockouts.push(s.turn.round); }
  }
  // economic buildings still standing at the end vs built (a rough measure of how many were lost)
  if (s.winner && /standing|captured|conquer/i.test(s.winner.reason)) out.conquest++; else out.timeout++;
  out.rounds += s.turn.round;
  process.stderr.write(`game ${g}: round ${s.turn.round}, ${s.winner ? s.winner.reason : 'unfinished'}, ${s.players.filter(p => p.alive).length} left\n`);
}
const ko = out.knockouts.sort((a, b) => a - b);
console.log(JSON.stringify({ diff, games, wonOutright: out.conquest, ranToLimit: out.timeout, avgRounds: +(out.rounds / games).toFixed(1), knockouts: ko.length, medianKnockoutRound: ko[Math.floor(ko.length / 2)] || null,
  hqAttacks: out.hqAttacks, arksBought: out.arks, seaLandings: out.landings, econBuilt: out.econBuilt, econAvgHexesFromEnemy: +(out.econDist / Math.max(1, out.econBuilt)).toFixed(2), econOnFront: out.econFront, fobAvgHexesFromEnemy: +(out.fobDist / Math.max(1, out.fobs)).toFixed(2) }));
