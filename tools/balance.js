// Faction balance check: N five-player bot games, one of each faction, same difficulty.
// node tools/balance.js [games]
const E = require('../shared/engine'); const { botStep, draftStep } = require('../shared/bot');
const games = +(process.argv[2] || 20);
const facs = Object.keys(E.FACTIONS);
const wins = {}, land = {}, kills = {}; facs.forEach(f => { wins[f] = 0; land[f] = 0; kills[f] = 0; });
const unitPicks = {};
let rounds = 0;
for (let g = 0; g < games; g++) {
  const order = facs.slice().sort(() => Math.random() - 0.5);
  const roster = order.map((f, i) => ({ id: 'p' + i, name: f, color: E.COLORS[i], faction: f, bot: true, diff: 'medium' }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', maxRounds: 45 }, roster);
  while (s.phase === 'draft') for (const p of s.players) { const a = draftStep(s, p.id); if (a) E.applyAction(s, p.id, a); }
  let n = 0;
  while (s.phase === 'play' && n < 80000) { const p = E.current(s), mem = {}; let c = 0; while (s.phase === 'play' && E.current(s).id === p.id) { let a = botStep(s, p.id, mem); if (++c > 90) a = { a: 'end' }; if (a.a === 'deploy') unitPicks[a.unit] = (unitPicks[a.unit] || 0) + 1; E.applyAction(s, p.id, a); n++; } }
  const w = s.players.find(p => p.id === s.winner.pid);
  wins[w.faction]++; rounds += s.turn.round;
  for (const p of s.players) { land[p.faction] += E.ownedLand(s, p.id).length; kills[p.faction] += p.stats.kills; }
}
console.log('games', games, 'avg rounds', (rounds / games).toFixed(1));
for (const f of facs) console.log(f.padEnd(8), 'wins', String(wins[f]).padStart(3), `(${Math.round(wins[f] / games * 100)}%)`, ' avg kills', (kills[f] / games).toFixed(1));
console.log('deploys:', Object.entries(unitPicks).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '));
