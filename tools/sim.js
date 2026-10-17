const E = require('../shared/engine'); const { botStep } = require('../shared/bot');
const mode = process.argv[2] || 'domination', N = +(process.argv[3] || 4), games = +(process.argv[4] || 5);
const facs = Object.keys(E.FACTIONS);
let tot = 0;
for (let g = 0; g < games; g++) {
  const roster = Array.from({ length: N }, (_, i) => ({ id: 'p' + i, name: 'Bot' + i, color: E.COLORS[i], faction: facs[(i + g) % facs.length], bot: true }));
  const { state: s } = E.createGame({ mode, mapSize: 'medium', timer: 0, maxRounds: 60, conquestPct: 40 }, roster);
  if (g === 0) { // ascii map
    const R = s.map.radius; const ch = { water: '~', plains: '.', forest: 'f', hills: 'h', mountain: 'M' };
    for (let r = -R; r <= R; r++) { let line = ' '.repeat(Math.abs(r)); for (let q = -R; q <= R; q++) { const t = s.map.tiles[q + ',' + r]; if (!t) continue; line += (t.struct ? 'H' : t.res ? '$' : ch[t.t]) + ' '; } console.log(line); }
  }
  let actions = 0, fails = 0, combats = 0;
  while (s.phase === 'play' && actions < 40000) {
    const p = E.current(s); const mem = {}; let n = 0;
    while (s.phase === 'play' && E.current(s).id === p.id) {
      let a = botStep(s, p.id, mem); if (++n > 80) a = { a: 'end' };
      const r = E.applyAction(s, p.id, a); actions++;
      if (!r.ok) { fails++; if (a.a === 'end') throw new Error('end failed ' + r.err); }
      else combats += r.events.filter(e => e.e === 'combat').length;
    }
  }
  const counts = s.players.map(p => p.name + '(' + p.faction + '):' + E.ownedTiles(s, p.id).length + (p.alive ? '' : '☠')).join(' ');
  console.log(`game ${g}: round ${s.turn.round} winner=${s.winner && s.winner.pid} ${s.winner && s.winner.reason} actions=${actions} fails=${fails} combats=${combats} | ${counts}`);
  tot += s.turn.round;
}
console.log('avg rounds', tot / games);
