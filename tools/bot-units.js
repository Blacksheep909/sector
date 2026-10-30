// Bot unit audit: does each kind of unit get used for what it's for? Plays seeded bot games and measures, per unit type:
//   artillery: shots per turn alive, how often it ends a turn next to the enemy (it shouldn't), how often it's in melee
//   anti-air: how much of the army its cover protects, shots and passive volleys
//   transports (helicopters, APCs, Arks): how often they move with troops aboard
//   carriers: aircraft deployed onto them
//   tactic cards: drawn vs played (cards left to rot in hand)
// node tools/bot-units.js [games=8] [diff=hard]
const E = require('../shared/engine'); const { botStep, draftStep } = require('../shared/bot');
const games = +(process.argv[2] || 8), diff = process.argv[3] || 'hard', facs = Object.keys(E.FACTIONS);
const T = {}, at = t => T[t] = T[t] || { turns: 0, shots: 0, adjEnemy: 0, inRange: 0, meleeAtt: 0, meleeDef: 0, moves: 0, loadedMoves: 0, deployed: 0, onCarrier: 0, aaShots: 0, aaPassive: 0, kills: 0, lost: 0 };
const cards = { drawn: {}, played: {}, seen: new Set() }; let coverSum = 0, coverN = 0, carrierDeploys = 0;
const aaR = u => E.aaReach(u);
for (let g = 0; g < games; g++) {
  const roster = Array.from({ length: 4 }, (_, i) => ({ id: 'p' + i, name: 'Bot' + i, color: E.COLORS[i], faction: facs[(i + g) % facs.length], bot: true, diff }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', timer: 0, maxRounds: 40, seed: 'unit' + g }, roster);
  while (s.phase === 'draft') for (const p of s.players) { const a = draftStep(s, p.id); if (a) E.applyAction(s, p.id, a); }
  let actions = 0;
  while (s.phase === 'play' && actions < 80000) {
    const p = E.current(s); const mem = {}; let n = 0; const held = new Set(p.tactics.map(c => c.uid));
    for (const c of p.tactics) if (!cards.seen || !cards.seen.has(c.uid)) { (cards.seen = cards.seen || new Set()).add(c.uid); cards.drawn[c.id] = (cards.drawn[c.id] || 0) + 1; }
    while (s.phase === 'play' && E.current(s).id === p.id) {
      let a = botStep(s, p.id, mem); if (++n > 90) a = { a: 'end' };
      const before = a.a === 'move' ? (a.units || []).map(id => s.units[id]).filter(Boolean).map(u => ({ type: u.type, from: u.hex })) : null;
      const playing = a.a === 'tactic' && p.tactics.find(x => x.uid === a.uid);
      const r = E.applyAction(s, p.id, a); actions++; if (!r.ok) continue;
      if (playing) cards.played[playing.id] = (cards.played[playing.id] || 0) + 1;
      for (const c of p.tactics) if (!cards.seen.has(c.uid)) { cards.seen.add(c.uid); cards.drawn[c.id] = (cards.drawn[c.id] || 0) + 1; }
      if (a.a === 'move' && before) {
        const types = before.map(b => b.type), lift = types.some(t => E.UNITS[t].lift || E.UNITS[t].ability === 'transport');
        for (const t of new Set(types)) { at(t).moves++; if ((E.UNITS[t].lift || E.UNITS[t].ability === 'transport') && types.some(x => !E.UNITS[x].lift && E.UNITS[x].ability !== 'transport' && E.UNITS[x].cls !== 'air' && !E.isSea(x))) at(t).loadedMoves++; }
      }
      for (const e of r.events) {
        if (e.e === 'deploy') { const t = e.unit && e.unit.type; if (t) { at(t).deployed++; const hereCarrier = Object.values(s.units).some(x => x.hex === e.hex && x.type === 'carrier'); if (hereCarrier && E.UNITS[t].cls === 'air') { carrierDeploys++; at(t).onCarrier++; } } }
        if (e.e === 'combat') {
          for (const t of new Set(e.att.units || [])) { if (e.ranged) { if (e.aaPassive) at(t).aaPassive++; else if (E.UNITS[t].aa) at(t).aaShots++; else at(t).shots++; } else at(t).meleeAtt++; }
          if (!e.ranged) for (const t of new Set(e.def.units || [])) at(t).meleeDef++;
        }
      }
    }
    // end of this commander's turn: where its units stand
    const idx = E.buildIndex(s), mine = Object.values(s.units).filter(u => u.owner === p.id), foes = Object.values(s.units).filter(u => u.owner !== p.id && !E.isAlly(s, p.id, u.owner));
    for (const u of mine) {
      const d = E.UNITS[u.type], st = at(u.type); st.turns++;
      const near = Math.min(99, ...foes.filter(f => !E.isSea(f.type) || E.isSea(u.type)).map(f => E.dist(f.hex, u.hex)));
      if (near <= 1) st.adjEnemy++;
      if (d.range && near <= d.range && near >= 2) st.inRange++;
    }
    // anti-air cover: share of our non-AA land stacks inside our own AA's passive reach
    const aa = mine.filter(u => aaR(u)); const stacks = [...new Set(mine.filter(u => !aaR(u) && !E.isSea(u.type)).map(u => u.hex))];
    if (aa.length && stacks.length) { coverSum += stacks.filter(k => aa.some(a => E.dist(a.hex, k) <= aaR(a))).length / stacks.length; coverN++; }
  }
}
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
const rows = Object.entries(T).filter(([, v]) => v.turns > 20).sort((a, b) => b[1].turns - a[1].turns);
console.log('unit        unit-turns  shots/turn  next-to-enemy  enemy-in-range  melee att/def  moves loaded   deployed');
for (const [t, v] of rows) { const d = E.UNITS[t];
  console.log(t.padEnd(12), String(v.turns).padStart(9), (d.range && !d.aa ? (v.shots / v.turns).toFixed(2) : d.aa ? 'aa ' + v.aaShots + '+' + v.aaPassive + 'p' : '').padStart(11), pct(v.adjEnemy, v.turns).padStart(14), (d.range ? pct(v.inRange, v.turns) : '').padStart(15), (v.meleeAtt + '/' + v.meleeDef).padStart(14), (d.lift || d.ability === 'transport' ? pct(v.loadedMoves, v.moves) + ' of ' + v.moves : '').padStart(14), String(v.deployed).padStart(10)); }
console.log('anti-air cover of our own stacks (avg, turns with AA):', pct(coverSum, coverN), '· aircraft deployed onto carriers:', carrierDeploys);
const cs = Object.keys(cards.drawn).map(k => [k, cards.drawn[k], cards.played[k] || 0]).sort((a, b) => b[1] - a[1]);
console.log('tactic cards (played of drawn):', cs.map(([k, d, p]) => `${k} ${p}/${d}`).join(', '));
