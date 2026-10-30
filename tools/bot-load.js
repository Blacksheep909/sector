// Server load check: how long bot turns take (the server computes them between player turns).
//   node tools/bot-load.js [players=10] [fog=on] [size=medium] [rounds=30]
const E = require('../shared/engine'); const { botStep, draftStep } = require('../shared/bot');
const N = +(process.argv[2] || 10), fog = process.argv[3] || 'on', size = process.argv[4] || 'medium', R = +(process.argv[5] || 30), facs = Object.keys(E.FACTIONS);
const roster = Array.from({ length: N }, (_, i) => ({ id: 'p' + i, name: 'B' + i, color: E.COLORS[i], faction: facs[i % 5], bot: true, diff: 'hard' }));
const { state: s } = E.createGame({ mode: 'domination', mapSize: size, timer: 0, maxRounds: R, fog, seed: 'load' }, roster);
while (s.phase === 'draft') for (const p of s.players) { const a = draftStep(s, p.id); if (a) E.applyAction(s, p.id, a); }
const turns = [], decide = []; let actions = 0;
while (s.phase === 'play' && actions < 200000) {
  const p = E.current(s), mem = {}; let n = 0; const t0 = process.hrtime.bigint();
  while (s.phase === 'play' && E.current(s).id === p.id) {
    const d0 = process.hrtime.bigint(); let a = botStep(s, p.id, mem); decide.push(Number(process.hrtime.bigint() - d0) / 1e6);
    if (++n > 90) a = { a: 'end' }; E.applyAction(s, p.id, a); actions++;
  }
  turns.push({ ms: Number(process.hrtime.bigint() - t0) / 1e6, round: s.turn.round });
}
const q = (arr, f) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(a.length * f)] || 0; };
const tm = turns.map(t => t.ms), late = turns.filter(t => t.round >= R * 0.6).map(t => t.ms);
console.log(JSON.stringify({ players: N, fog, size, rounds: s.turn.round, botTurns: turns.length, turnMs: { median: Math.round(q(tm, 0.5)), p95: Math.round(q(tm, 0.95)), max: Math.round(Math.max(...tm)), lateMedian: Math.round(q(late, 0.5)) }, decisionMs: { median: +q(decide, 0.5).toFixed(1), p95: +q(decide, 0.95).toFixed(1) }, fullRoundSec: +(q(tm, 0.5) * N / 1000).toFixed(2) }));
