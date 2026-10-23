// Engine checks for v0.7 content: node tools/test-v07.js
const E = require('../shared/engine'); const { draftStep } = require('../shared/bot');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function game(mapType = 'continent', n = 2) {
  const roster = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'volt', bot: true }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', timer: 0, maxRounds: 50, mapType, spawns: 'random' }, roster);
  while (s.phase === 'draft' || s.phase === 'spawn') for (const p of s.players) { const a = draftStep(s, p.id); if (a) E.applyAction(s, p.id, a); }
  // skip round-1 choose stage if any
  return s;
}
const me = s => E.current(s), give = (s, id) => { const c = { uid: s.nextId++, id }; me(s).tactics.push(c); return c; };
const play = (s, a) => E.applyAction(s, me(s).id, a);
{ // Goliath crawls one hex through rough ground
  const s = game(); const p = me(s); const hq = p.hq;
  const n = E.neighbors(hq).find(k => s.map.tiles[k] && E.isLandTile(s.map.tiles[k]) && s.map.tiles[k].t !== 'mountain');
  s.map.tiles[n].t = 'hills'; s.map.tiles[n].river = false;   // a river would need a bridge for vehicles
  const u = { id: 'g1', type: 'goliath', owner: p.id, hex: hq, moved: false, fresh: false }; s.units.g1 = u;
  for (const id in s.units) if (id !== 'g1' && s.units[id].hex === hq) delete s.units[id];
  const r = E.reachable(s, p.id, ['g1'], hq); ok(r[n] && r[n].kind !== 'pass', 'goliath can step onto highlands');
}
{ // 1-move units can always crawl onto snow, even in a blizzard
  const s = game(); const p = me(s); const hq = p.hq; s.weather = { id: 'blizzard', round: 3 };
  for (const id in s.units) if (s.units[id].hex === hq) delete s.units[id];
  const ns = E.neighbors(hq).filter(k => s.map.tiles[k] && E.isLandTile(s.map.tiles[k]) && s.map.tiles[k].t !== 'mountain');
  ns.forEach(k => { s.map.tiles[k].t = 'tundra'; s.map.tiles[k].river = false; });
  for (const type of ['goliath', 'titan', 'grunt']) {
    s.units.t1 = { id: 't1', type, owner: p.id, hex: hq, moved: false, fresh: false };
    const r = E.reachable(s, p.id, ['t1'], hq); ok(ns.every(k => r[k] && r[k].kind !== 'pass'), type + ' can step onto snow in a blizzard');
  }
  delete s.units.t1;
}
{ // ocean map: ports at start, ark launches from coastal HQ
  const s = game('ocean', 3);
  ok(s.players.every(p => Object.values(s.map.tiles).some(t => (t.structs || []).some(x => x.type === 'port' && x.owner === p.id))), 'every commander starts with a Port on ocean maps');
  ok(s.players.every(p => p.arsenal.includes('ark')), 'island starts get an Ark');
}
{ // ark from a coastal HQ without a port
  const s = game('continent'); const p = me(s);
  for (const t of Object.values(s.map.tiles)) t.structs = (t.structs || []).filter(x => x.type !== 'port');
  const coastal = E.isCoastal(s, p.hq); const hexes = E.deployHexes(s, p.id, 'ark');
  ok(!coastal || hexes.length > 0, 'ark can launch next to a coastal HQ (coastal=' + coastal + ')');
}
{ // FOB needs supply
  const s = game(); const p = me(s);
  const far = Object.keys(s.map.tiles).find(k => E.isLandTile(s.map.tiles[k]) && !s.map.tiles[k].owner && E.dist(k, p.hq) > 6);
  s.map.tiles[far].owner = p.id; s.map.tiles[far].structs = [{ type: 'fob', owner: p.id, lvl: 1 }]; s.map.tiles[far].struct = s.map.tiles[far].structs[0];
  ok(E.spawnPoints(s, p.id).includes(far), 'a cut-off FOB is still a deploy point');
  ok(!E.supplySet(s, p.id).has(far), 'cut-off FOB is not a supply source');
}
{ // carrier: deploy air onto it, sail, fly off
  const s = game('ocean'); const p = me(s); p.cash = 99;
  // a free sea hex beside our land with open water to sail into
  const free = k => s.map.tiles[k] && E.isWater(s.map.tiles[k]) && !Object.values(s.units).some(u => u.hex === k);
  const w = Object.keys(s.map.tiles).find(k => free(k) && !s.map.tiles[k].owner && E.neighbors(k).some(n => s.map.tiles[n] && s.map.tiles[n].owner === p.id) && E.neighbors(k).filter(free).length >= 2);
  s.units.c1 = { id: 'c1', type: 'carrier', owner: p.id, hex: w, moved: false, fresh: false };
  p.arsenal.push('hornet');
  ok(E.deployHexes(s, p.id, 'hornet').includes(w), 'aircraft can deploy onto a carrier');
  const r = play(s, { a: 'deploy', unit: 'hornet', hex: w }); ok(r.ok, 'deploy hornet on carrier ' + (r.err || ''));
  const air = Object.values(s.units).find(u => u.type === 'hornet'); air.fresh = false;
  const reach = E.reachable(s, p.id, ['c1', air.id], w); const to = Object.keys(reach).find(k => reach[k].kind === 'move' || reach[k].kind === 'capture');
  const r2 = play(s, { a: 'move', from: w, units: ['c1', air.id], to }); ok(r2.ok && s.units[air.id].hex === to, 'hornet rides the carrier');
  const r3 = E.reachable(s, p.id, [air.id], to); ok(Object.values(r3).some(x => x.kind === 'move' || x.kind === 'capture' || x.kind === 'attack'), 'hornet can fly off the carrier');
}
{ // tactics
  const s = game('continent', 3); const p = me(s); p.cash = 99;
  const o = s.players.find(q => q.id !== p.id);
  o.tactics = [{ uid: 9001, id: 'rally' }]; o.arsenal = ['grunt', E.FACTIONS[o.faction].starter];
  // give us a foothold next to the enemy so ranged tactics can reach
  for (const k of E.area(o.hq, 3)) { const t = s.map.tiles[k]; if (t && E.isLandTile(t) && E.dist(k, o.hq) === 3 && !t.owner) t.owner = p.id; }
  for (const k of E.area(o.hq, 2)) { const t = s.map.tiles[k]; if (t && E.isLandTile(t) && !t.owner) t.owner = o.id; }
  // the client only sees a rival's hand size: Spy Ring must still find targets in that view
  { const v = E.view(s, p.id); ok(E.tacticTargets(v, p.id, 'spy').some(k => v.map.tiles[k].owner === o.id), 'spy ring has targets in the client view'); }
  const spy = give(s, 'spy'); const tk = E.tacticTargets(s, p.id, 'spy').find(k => s.map.tiles[k].owner === o.id);
  const r = play(s, { a: 'tactic', uid: spy.uid, target: tk }); ok(r.ok && p.tactics.some(c => c.uid === 9001), 'spy ring steals a card ' + (r.err || '') + ' target=' + tk);
  const m = Object.keys(s.map.tiles).find(k => s.map.tiles[k].t === 'mountain');
  if (m) { s.map.tiles[E.neighbors(m).find(k => s.map.tiles[k]) || m].owner = p.id; const q = give(s, 'quarry'); const r2 = play(s, { a: 'tactic', uid: q.uid, target: m }); ok(r2.ok && s.map.tiles[m].t === 'hills', 'quarry blast flattens a mountain ' + (r2.err || '')); }
  const ae = give(s, 'aegis'); ok(play(s, { a: 'tactic', uid: ae.uid }).ok && p.shield, 'aegis raises the shield');
  const ts = give(s, 'tsar'); const tt = E.tacticTargets(s, p.id, 'tsar').find(k => s.map.tiles[k].owner === o.id);
  const r3 = play(s, { a: 'tactic', uid: ts.uid, target: tt }); ok(r3.ok && r3.events[0].area.length >= 7, 'tsar bomba hits ' + (r3.events[0] && r3.events[0].area.length) + ' hexes ' + (r3.err || '') + ' target=' + tt);
  const rg = give(s, 'regime'); const rt = E.tacticTargets(s, p.id, 'regime').find(k => s.map.tiles[k].owner === o.id) || E.tacticTargets(s, p.id, 'regime')[0];
  const r4 = rt && play(s, { a: 'tactic', uid: rg.uid, target: rt }); ok(r4 && r4.ok && r4.events[0].hexes.length >= 1, 'regime change flips hexes ' + (r4 && r4.err) + ' target=' + rt + ' ' + JSON.stringify(r4 && r4.events[0]));
}
{ // spy ring never steals starting cards, but can take an earned unit
  const s = game('continent', 2); const p = me(s), o = s.players.find(q => q.id !== p.id); p.cash = 99;
  for (const k of E.area(o.hq, 3)) { const t = s.map.tiles[k]; if (t && E.isLandTile(t) && !t.owner) t.owner = p.id; }
  o.tactics = []; o.arsenal = ['grunt', E.FACTIONS[o.faction].starter, 'ark'];
  ok(!E.tacticTargets(s, p.id, 'spy').some(k => s.map.tiles[k].owner === o.id), 'nothing to steal from starting cards only');
  o.arsenal.push('goliath'); o.levels.goliath = 2;
  const c = give(s, 'spy'); const tk = E.tacticTargets(s, p.id, 'spy').find(k => s.map.tiles[k].owner === o.id);
  const r = play(s, { a: 'tactic', uid: c.uid, target: tk });
  ok(r.ok && p.arsenal.includes('goliath') && !o.arsenal.includes('goliath') && o.arsenal.includes('grunt'), 'spy ring steals an earned unit, starters stay');
}
{ // aircraft only take the hex they land on
  const s = game('continent', 2); const p = me(s); const hq = p.hq;
  for (const id in s.units) if (s.units[id].hex === hq) delete s.units[id];
  s.units.h1 = { id: 'h1', type: 'hornet', owner: p.id, hex: hq, moved: false, fresh: false };
  const reach = E.reachable(s, p.id, ['h1'], hq); const far = Object.keys(reach).filter(k => reach[k].kind === 'move' && !s.map.tiles[k].owner && reach[k].c >= 3 && E.isLandTile(s.map.tiles[k]))[0];
  // only the hexes it flew over matter: landing can legitimately close an encirclement pocket somewhere nearby
  const over = E.pathTo(reach, far).slice(1, -1).filter(k => s.map.tiles[k].owner !== p.id);
  const r = play(s, { a: 'move', from: hq, units: ['h1'], to: far });
  const took = over.filter(k => s.map.tiles[k].owner === p.id).length;
  ok(r.ok && s.map.tiles[far].owner === p.id && took === 0, 'hornet flying 3+ hexes takes only its landing hex (took ' + took + ' on the way)');
}
{ // shield blocks enemy tactics
  const s = game('continent', 2); const p = me(s), o = s.players.find(q => q.id !== p.id); o.shield = true; p.cash = 99;
  ok(!E.tacticTargets(s, p.id, 'embargo').some(k => s.map.tiles[k].owner === o.id), 'aegis blocks enemy tactics');
}
{ // sea mines: build on your own sea, block enemy ships, defend like a bunker
  const s = game('ocean'); const p = me(s), o = s.players.find(q => q.id !== p.id); p.cash = 99;
  const sup = E.supplySet(s, p.id);
  const freeSea = k => s.map.tiles[k] && E.isWater(s.map.tiles[k]) && !Object.values(s.units).some(u => u.hex === k);
  const w = Object.keys(s.map.tiles).find(k => E.isWater(s.map.tiles[k]) && sup.has(k) && !(s.map.tiles[k].structs || []).length && freeSea(k) && E.neighbors(k).some(freeSea))   // (the enemy ship needs open sea beside it)
    || (() => { const k = Object.keys(s.map.tiles).find(k => freeSea(k) && E.neighbors(k).some(n => sup.has(n)) && E.neighbors(k).some(freeSea)); s.map.tiles[k].owner = p.id; return k; })();
  const land = [...sup].find(k => E.isLandTile(s.map.tiles[k]) && !(s.map.tiles[k].structs || []).length);
  ok(E.buildError(s, p.id, 'mine', land) !== null, 'mines cannot go on land');
  const r = play(s, { a: 'build', struct: 'mine', hex: w }); ok(r.ok, 'build a sea mine ' + (r.err || ''));
  const n = E.neighbors(w).find(k => s.map.tiles[k] && E.isWater(s.map.tiles[k]) && !Object.values(s.units).some(u => u.hex === k));
  s.units.e1 = { id: 'e1', type: 'marlin', owner: o.id, hex: n, moved: false, fresh: false };
  const reach = E.reachable(s, o.id, ['e1'], n); ok(reach[w] && reach[w].kind === 'attack', 'enemy ships must attack a mined hex');
  const calc = E.combatCalc(s, o.id, [s.units.e1], n, w, false); ok(calc.def.bonuses.some(b => b.label.startsWith('Minefield')), 'minefield adds garrison chips');
}
{ // reroll scales with income
  const s = game(); s.turn.income = 20; s.turn.rerolls = 0; const a = E.rerollCost(s); s.turn.rerolls = 1; ok(a === 5 && E.rerollCost(s) === 10, 'reroll cost ' + a + ' then ' + E.rerollCost(s));
}
{ // traitor
  const s = game('continent', 3); const [a, b] = s.players;
  s.allies = [{ a: a.id, b: b.id, since: 1, ending: s.players[s.turn.idx].id === a.id ? a.id : b.id }];
  const breaker = E.player(s, s.allies[0].ending);
  E.applyAction(s, E.current(s).id, { a: 'end' });
  let guard = 0; while (E.current(s).id !== breaker.id && guard++ < 10) { if (s.turn.stage === 'choose') E.applyAction(s, E.current(s).id, { a: 'choose', pick: 'income' }); E.applyAction(s, E.current(s).id, { a: 'end' }); }
  ok(breaker.traitor > 0 && !(s.allies || []).length, 'breaking a pact brands a traitor (' + breaker.traitor + ')');
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
