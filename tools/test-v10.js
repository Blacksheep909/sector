// Engine checks for v0.10 (balance pass, rivers, helicopters, fog spawns, teams): node tools/test-v10.js
const E = require('../shared/engine');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function board(opts = {}) {
  const roster = [{ id: 'A', name: 'A', color: E.COLORS[0], faction: 'iron' }, { id: 'B', name: 'B', color: E.COLORS[1], faction: 'iron' }];
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', seed: opts.seed || 'riv1', mapType: 'continent' }, roster);
  s.phase = 'play'; s.turn.stage = 'act'; s.turn.idx = s.players.findIndex(p => p.id === 'A'); s.units = {}; s.weather = null;
  return s;
}
const put = (s, id, type, hex, owner = 'A') => { s.units[id] = { id, owner, type, hex, moved: false, fresh: false }; return id; };
// a river hex with dry land straight across it
function crossing(s) {
  const T = s.map.tiles;
  for (const k in T) { if (!T[k].river) continue; const nb = E.neighbors(k).filter(n => T[n] && E.isLandTile(T[n]) && !T[n].river && T[n].t !== 'mountain'); for (const a of nb) for (const b of nb) if (E.dist(a, b) === 2) { for (const x of [a, k, b]) { T[x].t = 'plains'; T[x].owner = null; T[x].structs = []; T[x].struct = null; delete T[x].poi; } return [a, k, b]; } }
}
{ // rivers: nobody stands in one; infantry ford straight across, vehicles need a bridge
  const s = board(), T = s.map.tiles, [a, k, b] = crossing(s); T[a].owner = 'A';
  put(s, 'g', 'grunt', a); put(s, 'm', 'mauler', a);
  const rg = E.reachable(s, 'A', ['g'], a), rm = E.reachable(s, 'A', ['m'], a);
  ok(rg[k] && rg[k].kind === 'pass', 'infantry cannot stop in a river');
  ok(rg[b] && ['move', 'capture'].includes(rg[b].kind), 'infantry ford across to the far bank');
  ok(!rm[k] && !rm[b], 'tanks cannot cross an unbridged river');
  const r = E.applyAction(s, 'A', { a: 'move', from: a, units: ['g'], to: b });
  ok(r.ok && s.units.g.hex === b && T[k].owner === 'A', 'the ford claims the river hex on the way');
}
{ // the bridge bug: a river hex next to your supplied land can be bridged without claiming it first
  const s = board(), T = s.map.tiles, [a, k] = crossing(s), p = E.player(s, 'A');
  p.hq = a; T[a].owner = 'A'; T[a].structs = [{ type: 'hq', owner: 'A', lvl: 1 }]; T[a].struct = T[a].structs[0];
  ok(T[k].owner === null && E.buildError(s, 'A', 'bridge', k) === null, 'an unclaimed river hex beside your land can be bridged');
  p.cash = 50; const r = E.applyAction(s, 'A', { a: 'build', struct: 'bridge', hex: k });
  ok(r.ok && T[k].bridge && T[k].owner === 'A', 'building the bridge claims it');
  put(s, 'm', 'mauler', a); ok(!!E.reachable(s, 'A', ['m'], a)[k], 'tanks drive onto the bridge');
}
{ // helicopters: troops aboard stay aboard over water, and can't be left hanging there
  const s = board(), T = s.map.tiles;
  const sea = Object.keys(T).find(x => E.isWater(T[x]) && E.neighbors(x).some(n => T[n] && E.isLandTile(T[n]) && T[n].t !== 'mountain' && !T[n].river));
  const shore = E.neighbors(sea).find(n => T[n] && E.isLandTile(T[n]) && T[n].t !== 'mountain' && !T[n].river); T[shore].owner = 'A';
  const ids = [put(s, 'h', 'stormcrow', shore), ...[0, 1, 2, 3].map(i => put(s, 'g' + i, 'grunt', shore))];
  const r = E.applyAction(s, 'A', { a: 'move', from: shore, units: ids, to: sea });
  ok(r.ok && ids.every(id => s.units[id] && s.units[id].hex === sea), 'a Stormcrow hovers over the sea with its troops aboard');
  ids.forEach(id => { s.units[id].moved = false; });
  ok(!E.applyAction(s, 'A', { a: 'move', from: sea, units: ['h'], to: shore }).ok, 'it cannot fly off and leave them over the water');
  ok(E.applyAction(s, 'A', { a: 'move', from: sea, units: ids, to: shore }).ok, 'they all fly back together');
  ok(!E.stackFits(Array(5).fill('stormcrow').concat(Array(6).fill('grunt')), []) && E.stackFits(['stormcrow', 'stormcrow'].concat(Array(8).fill('grunt')), []), 'a hex holds 10 units at most, carriers or not');
}
{ // combat: ground fire against helicopters, the +2 training base, Hellfire
  const s = board(), T = s.map.tiles, [a, , b] = crossing(s); T[b].owner = 'B';
  const land = Object.keys(T).find(k => E.isLandTile(T[k]) && !T[k].river && T[k].t === 'plains' && E.neighbors(k).some(n => T[n] && E.isLandTile(T[n]) && !T[n].river && T[n].t !== 'mountain'));
  const st = E.neighbors(land).find(n => T[n] && E.isLandTile(T[n]) && !T[n].river && T[n].t !== 'mountain'); T[land].owner = 'B'; T[land].t = 'plains';
  put(s, 'h', 'banshee', land, 'B'); const g = [0, 1, 2].map(i => put(s, 'g' + i, 'grunt', st));
  const c = E.combatCalc(s, 'A', g.map(id => s.units[id]), st, land);
  ok(c.att.bonuses.some(x => x.label === 'Ground Fire' && x.chips === 3), 'every infantry unit adds a chip against a helicopter');
  ok(c.att.mult >= E.ROLL_BASE && c.def.mult >= E.ROLL_BASE, 'both sides roll d6 + 2');
  ok(E.UNITS.banshee.def <= 3 && E.UNITS.stormcrow.def <= 3, 'helicopters are thin-skinned on defence');
}
{ // Conscription brings five Grunts; flat payouts scale with income
  const s = board(), T = s.map.tiles, p = E.player(s, 'A'), k = Object.keys(T).find(k => E.isLandTile(T[k]) && T[k].t === 'plains' && !T[k].river);
  p.hq = k; T[k].owner = 'A'; T[k].structs = [{ type: 'hq', owner: 'A', lvl: 1 }]; T[k].struct = T[k].structs[0];
  p.tactics.push({ uid: 501, id: 'conscript' }); p.cash = 5;
  const r = E.applyAction(s, 'A', { a: 'tactic', uid: 501, target: k });
  ok(r.ok && Object.values(s.units).filter(u => u.hex === k && u.type === 'grunt').length === 5, 'Conscription deploys 5 Grunts');
  p.arsenal = ['grunt']; p.levels = { grunt: 3 }; const before = p.cash;
  for (const t in T) if (E.isLandTile(T[t]) && T[t].t !== 'mountain') T[t].owner = 'A';   // a late-game empire
  const ev = []; E.applyAction; const inc = E.computeIncome(s, 'A').total;
  s.turn.stage = 'choose'; s.turn.offer = ['grunt']; s.turn.income = 0;
  E.applyAction(s, 'A', { a: 'choose', pick: 'card', idx: 0 });
  ok(p.cash - before >= Math.round(4 * inc / 10) && inc > 40, 'a maxed card pays out in proportion to income ($' + (p.cash - before) + ' at $' + inc + '/turn)');
}
{ // fog of war: picking HQs, rivals' choices stay hidden
  const roster = [0, 1, 2].map(i => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron' }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', spawns: 'pick', fog: 'on' }, roster);
  const first = s.spawn.order[0]; E.applyAction(s, first, { a: 'spawnPick', hex: E.spawnChoices(s)[0] });
  const v = E.view(s, s.spawn.order[1]);
  ok(v.players.every(p => p.id === s.spawn.order[1] || !p.hq) && !Object.values(v.map.tiles).some(t => t.owner), 'nobody sees where the others set up');
  ok(E.spawnChoices(v).length === E.spawnChoices(s).length, 'but the hexes you may still pick are exact');
}
{ // teams play in team colours
  const roster = [1, 2, 1, 2].map((t, i) => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron', team: t }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', teams: 'on' }, roster);
  const col = id => s.players.find(p => p.id === id).color;
  ok(E.TEAM_COLORS[1].includes(col('p0')) && E.TEAM_COLORS[1].includes(col('p2')) && col('p0') !== col('p2'), 'team A plays in two shades of red');
  ok(E.TEAM_COLORS[2].includes(col('p1')) && E.TEAM_COLORS[2].includes(col('p3')), 'team B plays in blue');
}
{ // fog of war: a fallen commander's remembered land shows as neutral
  const roster = [0, 1, 2].map(i => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron' }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', fog: 'on' }, roster);
  s.phase = 'play'; s.weather = null; const T = s.map.tiles, dead = E.player(s, 'p1'),   /* (turn order is shuffled) */ mem = { explored: new Set(), seen: {} };   // (Clear weather would widen vision)
  const k = Object.keys(T).find(x => T[x].owner === dead.id);
  mem.explored.add(k); mem.seen[k] = { owner: dead.id, structs: [{ type: 'hq', owner: dead.id, lvl: 1 }] };
  for (const id in s.units) delete s.units[id];
  for (const x in T) if (T[x].owner === 'p0' && E.dist(x, k) <= 3) T[x].owner = null;   // keep it out of sight
  ok(E.view(s, 'p0', mem).map.tiles[k].owner === dead.id, 'a living rival\'s remembered land shows in their colour');
  dead.alive = false;
  const v = E.view(s, 'p0', mem).map.tiles[k];
  ok(v.owner === null && !v.structs.length, 'once they fall, it shows as neutral');
}
{ // alliances can't snowball: a bloc holds at most half the commanders left (2 at least)
  const roster = [0, 1, 2, 3, 4].map(i => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron' }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium' }, roster);
  s.phase = 'play';
  const pact = (a, b) => { const r = E.applyAction(s, a, { a: 'allyOffer', to: b }); if (!r.ok) return r.err; E.applyAction(s, b, { a: 'allyReply', accept: true }); return E.isAlly(s, a, b) ? 'ok' : 'declined'; };
  ok(pact('p0', 'p1') === 'ok', 'two commanders can ally');
  ok(pact('p1', 'p2') !== 'ok' && pact('p2', 'p0') !== 'ok', 'a third can\'t join their bloc (5 left: at most 2)');
  ok(pact('p2', 'p3') === 'ok', 'the others can still pair up');
  s.players.find(p => p.id === 'p4').alive = false; s.players.find(p => p.id === 'p3').alive = false;
  ok(E.blocCap(s) === 2, 'the cap is never below 2');
}
{ // ships sail under a sea bridge, but can't stop beneath it, and enemy troops on it block the way
  const s = board(), T = s.map.tiles;
  const k = Object.keys(T).find(x => E.isWater(T[x]) && !T[x].river && E.neighbors(x).filter(n => T[n] && E.isWater(T[n])).length >= 2);
  const w1 = E.neighbors(k).find(n => T[n] && E.isWater(T[n]) && !T[n].river);
  T[k].bridge = true; T[k].owner = 'A';
  put(s, 'sh', 'barracuda', w1);
  const r = E.reachable(s, 'A', ['sh'], w1);
  ok(r[k] && r[k].kind === 'pass', 'a ship can pass under a bridge');
  ok(Object.keys(r).some(n => r[n].prev === k && r[n].kind !== 'pass'), 'and come out the other side');
  put(s, 'g', 'grunt', k, 'B');
  const r2 = E.reachable(s, 'A', ['sh'], w1);
  ok(!r2[k] || r2[k].kind === 'attack', 'enemy troops on the bridge block the channel');
}
{ // arks: troops who used their move to embark still sail with the ark, whether you pick the ark or the whole stack
  for (const pick of [['ark'], ['ark', 'g1', 'g2']]) {
    const s = board({ seed: 'ark1' }), T = s.map.tiles;
    const w = Object.keys(T).find(k => E.isWater(T[k]) && !T[k].river && E.neighbors(k).some(n => T[n] && T[n].t === 'plains' && !T[n].river) && E.neighbors(k).filter(n => T[n] && E.isWater(T[n])).length >= 3);
    const l = E.neighbors(w).find(n => T[n] && T[n].t === 'plains' && !T[n].river); T[l].owner = 'A';
    put(s, 'ark', 'ark', w); put(s, 'g1', 'grunt', l); put(s, 'g2', 'grunt', l);
    ok(E.applyAction(s, 'A', { a: 'move', units: ['g1', 'g2'], from: l, to: w }).ok, 'grunts board the ark');
    const r = E.reachable(s, 'A', pick, w), to = Object.keys(r).find(k => r[k].c >= 2 && E.isWater(T[k]) && r[k].kind !== 'pass');
    const res = E.applyAction(s, 'A', { a: 'move', units: pick, from: w, to });
    ok(res.ok && s.units.g1.hex === to && s.units.g2.hex === to, 'the ark sails with its troops (' + pick.join('+') + ')' + (res.ok ? '' : ': ' + res.err));
  }
}
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
