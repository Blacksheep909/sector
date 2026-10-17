// Headless bot-vs-bot games: node tools/sim.js [mode] [players] [games] [mapType]
const E = require('../shared/engine'); const { botStep, draftStep } = require('../shared/bot');
const mode = process.argv[2] || 'domination', N = +(process.argv[3] || 4), games = +(process.argv[4] || 5), mapType = process.argv[5];
const facs = Object.keys(E.FACTIONS);
const tally = { rounds: 0, fails: 0, crates: 0, drops: 0, assaults: 0, bridges: 0, seaHexes: 0, annex: 0, upgrades: 0 };
const errs = {};
for (let g = 0; g < games; g++) {
  const roster = Array.from({ length: N }, (_, i) => ({ id: 'p' + i, name: 'Bot' + i, color: E.COLORS[i], faction: facs[(i + g) % facs.length], bot: true }));
  const { state: s } = E.createGame({ mode, mapSize: 'medium', timer: 0, maxRounds: 50, mapType }, roster);
  while (s.phase === 'draft') for (const p of s.players) { const a = draftStep(s, p.id); if (a) { const r = E.applyAction(s, p.id, a); if (!r.ok) throw new Error('draft ' + r.err); } }
  let actions = 0;
  while (s.phase === 'play' && actions < 60000) {
    const p = E.current(s); const mem = {}; let n = 0;
    while (s.phase === 'play' && E.current(s).id === p.id) {
      let a = botStep(s, p.id, mem); if (++n > 90) a = { a: 'end' };
      const r = E.applyAction(s, p.id, a); actions++;
      if (!r.ok) { tally.fails++; errs[a.a + ': ' + r.err] = (errs[a.a + ': ' + r.err] || 0) + 1; if (a.a === 'end') throw new Error('end failed ' + r.err); continue; }
      if (a.a === 'tactic' && r.events.some(e => e.e === 'crate')) tally.drops++;
      if (a.a === 'assault') tally.assaults++;
      if (a.a === 'build' && a.struct === 'bridge') tally.bridges++;
      for (const e of r.events) { if (e.e === 'crate') tally.crates++; if (e.e === 'annex') tally.annex++; if (e.e === 'card' && e.level) tally.upgrades++; }
    }
  }
  tally.seaHexes += Object.values(s.map.tiles).filter(t => t.owner && E.isWater(t)).length;
  tally.rounds += s.turn.round;
  console.log(`game ${g} (${s.map.arch}): round ${s.turn.round} — ${s.winner ? s.players.find(p => p.id === s.winner.pid).name + ' ' + s.winner.reason : 'unfinished'}`);
}
console.log({ ...tally, avgRounds: tally.rounds / games });
if (Object.keys(errs).length) console.log('failed actions:', errs);
