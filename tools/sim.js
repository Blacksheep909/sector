// Headless bot-vs-bot games: node tools/sim.js [mode] [players] [games] [mapType]
const E = require('../shared/engine'); const { botStep, draftStep, allyReply, tradeReply } = require('../shared/bot'); const { chatter } = require('../shared/chatter');
const mode = process.argv[2] || 'domination', N = +(process.argv[3] || 4), games = +(process.argv[4] || 5), mapType = process.argv[5];
const facs = Object.keys(E.FACTIONS);
const tally = { rounds: 0, fails: 0, crates: 0, drops: 0, assaults: 0, bridges: 0, seaHexes: 0, annex: 0, upgrades: 0 };
const errs = {}, personaWins = {}, personaGames = {}, talk = {};
const quiet = !process.env.SIM_TALK;
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
      if (r.ok) {
        // bots answer pact offers like they do on the server, and talk about what happened
        const evs = r.events.slice();
        if (s.allyOffer) { const rep = allyReply(s, s.allyOffer.to); const r2 = rep && E.applyAction(s, s.allyOffer.to, rep); if (r2 && r2.ok) evs.push(...r2.events); }
        for (const l of chatter(s, evs)) { talk[l.pid] = (talk[l.pid] || 0) + 1; if (!quiet) console.log('   [r' + s.turn.round + '] ' + E.player(s, l.pid).name + ' (' + E.player(s, l.pid).persona + '): ' + l.text); }
      }
      if (!r.ok) { tally.fails++; errs[a.a + ': ' + r.err] = (errs[a.a + ': ' + r.err] || 0) + 1; if (a.a === 'end') throw new Error('end failed ' + r.err); continue; }
      if (a.a === 'tactic' && r.events.some(e => e.e === 'crate')) tally.drops++;
      if (a.a === 'assault') tally.assaults++;
      if (a.a === 'build' && a.struct === 'bridge') tally.bridges++;
      for (const e of r.events) { if (e.e === 'crate') tally.crates++; if (e.e === 'annex') tally.annex++; if (e.e === 'card' && e.level) tally.upgrades++; }
    }
  }
  tally.seaHexes += Object.values(s.map.tiles).filter(t => t.owner && E.isWater(t)).length;
  tally.rounds += s.turn.round;
  for (const p of s.players) personaGames[p.persona] = (personaGames[p.persona] || 0) + 1;
  if (s.winner && s.winner.pid) { const w = s.players.find(p => p.id === s.winner.pid); if (w) personaWins[w.persona] = (personaWins[w.persona] || 0) + 1; }
  console.log(`game ${g} (${s.map.arch}): round ${s.turn.round} — ${s.winner && s.players.find(p => p.id === s.winner.pid) ? s.players.find(p => p.id === s.winner.pid).name + ' the ' + s.players.find(p => p.id === s.winner.pid).persona + ' ' + s.winner.reason : 'unfinished'}`);
}
console.log({ ...tally, avgRounds: tally.rounds / games, chatLines: Object.values(talk).reduce((a, b) => a + b, 0) });
console.log('persona wins:', Object.keys(personaGames).map(k => k + ' ' + (personaWins[k] || 0) + '/' + personaGames[k]).join(', '));
if (Object.keys(errs).length) console.log('failed actions:', errs);
