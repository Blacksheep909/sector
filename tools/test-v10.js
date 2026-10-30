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
  ok(col('p0') === E.TEAM_COLORS[1][0] && col('p2') === col('p0'), 'team A plays in one red');
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
{ // big cards say where they came from when they're played
  const s = board(), T = s.map.tiles, p = E.player(s, 'A');
  const k = Object.keys(T).find(x => E.isLandTile(T[x]) && T[x].t !== 'mountain' && !T[x].river && !T[x].owner), n = E.neighbors(k).find(x => T[x] && E.isLandTile(T[x]) && !T[x].river);
  T[n].owner = 'A'; put(s, 'e', 'grunt', k, 'B');
  s.turn.stage = 'choose'; s.turn.offer = ['orbital', 'orbital', 'orbital']; s.turn.income = 10;
  ok(E.applyAction(s, 'A', { a: 'choose', pick: 'card', idx: 0 }).ok, 'took an Orbital Strike from the resupply');
  const c = p.tactics.find(x => x.id === 'orbital'); ok(c && /resupply/.test(c.src), 'the card remembers it came from a resupply pick');
  p.cash = 50; const r = E.applyAction(s, 'A', { a: 'tactic', uid: c.uid, target: k });
  ok(r.ok && s.log.some(l => /Orbital Strike came from a resupply pick \(round \d+\)/.test(l)), 'playing it logs where it came from');
}
{ // a helicopter that lands on an oil rig claims it; a jet flying over doesn't
  const s = board({ seed: 'rig1' }), T = s.map.tiles;
  const land = Object.keys(T).find(k => T[k].t === 'plains' && !T[k].river && E.neighbors(k).some(n => T[n] && E.isWater(T[n]) && !T[n].river));
  const rig = E.neighbors(land).find(n => T[n] && E.isWater(T[n]) && !T[n].river);
  T[land].owner = 'A'; T[rig].res = true; T[rig].owner = 'B';
  put(s, 'h', 'wren', land);
  const r = E.reachable(s, 'A', ['h'], land);
  ok(r[rig] && r[rig].kind === 'capture', 'the rig shows as a capture for a helicopter');
  ok(E.applyAction(s, 'A', { a: 'move', units: ['h'], from: land, to: rig }).ok && T[rig].owner === 'A', 'landing on it claims the rig');
  const s2 = board({ seed: 'rig1' }), T2 = s2.map.tiles; T2[land].owner = 'A'; T2[rig].res = true; T2[rig].owner = 'B';
  put(s2, 'j', 'seraph', land);
  E.applyAction(s2, 'A', { a: 'move', units: ['j'], from: land, to: rig });
  ok(T2[rig].owner === 'B', 'a gunship plane does not');
}
{ // team games: deploy at a teammate's FOB, launch from their Port, see their hand, pass cash and cards
  const roster = [0, 1, 2, 3].map(i => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron', team: 1 + (i % 2) }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', teams: 'on' }, roster);
  s.phase = 'play'; s.turn.stage = 'act'; s.weather = null;
  const a = E.player(s, 'p0'), mate = E.player(s, 'p2'), foe = E.player(s, 'p1'); s.turn.idx = s.players.indexOf(a);
  ok(E.teammate(s, 'p0', 'p2') && !E.teammate(s, 'p0', 'p1'), 'p0 and p2 are teammates');
  const T = s.map.tiles, fk = E.neighbors(mate.hq).find(k => T[k] && E.isLandTile(T[k]) && T[k].t !== 'mountain' && !T[k].river);
  T[fk].owner = 'p2'; T[fk].structs = [{ type: 'fob', owner: 'p2', lvl: 1 }]; T[fk].struct = T[fk].structs[0];
  for (const id in s.units) if (s.units[id].hex === fk) delete s.units[id];
  ok(E.deployHexes(s, 'p0', 'grunt').includes(fk), "a teammate's FOB is a deploy point");
  a.cash = 20; const r = E.applyAction(s, 'p0', { a: 'deploy', unit: 'grunt', hex: fk });
  ok(r.ok && Object.values(s.units).some(u => u.hex === fk && u.owner === 'p0'), 'deploying there works');
  ok(!E.deployHexes(s, 'p1', 'grunt').includes(fk), 'the enemy cannot use it');
  const fk2 = E.neighbors(fk).find(k => T[k] && E.isLandTile(T[k]) && !T[k].river && T[k].t !== 'mountain' && k !== mate.hq);
  if (fk2) { T[fk2].owner = 'p2'; T[fk2].structs = [{ type: 'fob', owner: 'p2', lvl: 1 }]; T[fk2].struct = T[fk2].structs[0]; for (const id in s.units) if (s.units[id].hex === fk2) delete s.units[id];
    s.units.zz = { id: 'zz', owner: 'p2', type: 'grunt', hex: fk2, moved: false, fresh: false };
    ok(!E.deployHexes(s, 'p0', 'grunt').includes(fk2), "not while the teammate's own troops stand on it"); }
  mate.tactics = [{ uid: 9001, id: 'rally' }]; foe.tactics = [{ uid: 9002, id: 'nuke' }];
  const v = E.view(s, 'p0');
  ok(v.players.find(p => p.id === 'p2').tactics.length === 1 && v.players.find(p => p.id === 'p1').tactics.length === 0, "you see your teammate's hand, not the enemy's");
  a.cash = 20; const g = E.applyAction(s, 'p0', { a: 'gift', to: 'p2', amount: 7 });
  ok(g.ok && a.cash === 13 && mate.cash >= 7, 'cash passes to a teammate straight away');
  a.tactics = [{ uid: 9003, id: 'smoke' }];
  ok(E.applyAction(s, 'p0', { a: 'gift', to: 'p2', uid: 9003 }).ok && mate.tactics.some(c => c.uid === 9003) && !a.tactics.length, 'so does a card');
  ok(!E.applyAction(s, 'p0', { a: 'gift', to: 'p1', amount: 1 }).ok, 'no gifts to the enemy');
  ok(!E.applyAction(s, 'p0', { a: 'gift', to: 'p2', amount: 999 }).ok, 'no more than you have');
}
{ // fog of war: bots don't bomb what they can't see
  const { botStep } = require('../shared/bot');
  const s = board({ seed: 'fogbomb' }), T = s.map.tiles, A = E.player(s, 'A'); s.settings.fog = 'on'; s.weather = null;
  for (const k in T) T[k].owner = null;
  const home = Object.keys(T).find(k => E.area(k, 4).every(x => T[x]));
  for (const x of E.area(home, 4)) Object.assign(T[x], { t: 'plains', river: false, bridge: false, structs: [], struct: null, res: false });
  for (const id in s.units) delete s.units[id];
  T[home].owner = 'A';
  const far = E.area(home, 3).find(k => E.dist(k, home) === 3);
  for (let i = 0; i < 5; i++) put(s, 'e' + i, 'mauler', far, 'B');
  A.cash = 50; A.tactics = [{ uid: 7001, id: 'airstrike' }]; A.diff = 'hard';
  ok(!E.visionOf(s, 'A').has(far), 'the enemy stack is out of sight');
  ok(E.tacticTargets(s, 'A', 'airstrike').includes(far), '...though in Airstrike range');
  let tries = 0, struck = false;
  for (let i = 0; i < 30; i++) { const a = botStep(s, 'A', { n: 0 }); tries++; if (a && a.a === 'tactic' && a.target === far) struck = true; }
  ok(!struck, 'the bot never bombs it blind');
  put(s, 'scout', 'grunt', E.area(far, 1).find(k => E.dist(k, far) === 1 && E.dist(k, home) === 2), 'A');
  ok(E.visionOf(s, 'A').has(far), 'a scout brings it into sight');
  struck = false; for (let i = 0; i < 30 && !struck; i++) { const a = botStep(s, 'A', { n: 0 }); if (a && a.a === 'tactic' && a.target === far) struck = true; }
  ok(struck, 'and then the bot strikes it');
}
{ // airbases go out toward the front: none within 3 hexes of your HQ
  const roster = [0, 1].map(i => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron' }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium' }, roster);
  s.phase = 'play'; const p = E.player(s, 'p0'); p.cash = 99;
  const near = E.buildHexes(s, 'p0', 'airbase').filter(k => E.dist(k, p.hq) <= 3);
  ok(!near.length, 'no airbase spot within 3 of the HQ');
  const T = s.map.tiles, k = E.neighbors(p.hq).find(n => T[n] && E.isLandTile(T[n]) && T[n].owner === 'p0');
  ok(/more than 3 hexes/.test(E.buildError(s, 'p0', 'airbase', k) || ''), 'and it says why');
}
{ // nothing but a bridge goes in a river
  const roster = [0, 1].map(i => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron' }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium' }, roster);
  s.phase = 'play'; const p = E.player(s, 'p0'); p.cash = 999; const T = s.map.tiles;
  const k = E.neighbors(p.hq).find(n => T[n] && E.isLandTile(T[n]) && T[n].owner === 'p0' && !(T[n].structs || []).length);
  T[k].river = true; T[k].flow = null;
  ok(/river/.test(E.buildError(s, 'p0', 'refinery', k) || '') && /river/.test(E.buildError(s, 'p0', 'bunker', k) || ''), 'no buildings on a river hex you own');
  ok(!E.buildError(s, 'p0', 'bridge', k), 'but a bridge is fine');
  ok(!['refinery', 'warehouse', 'bunker', 'fob', 'airbase', 'port'].some(b => E.buildHexes(s, 'p0', b).includes(k)), 'and it never shows as a build spot');
}
{ // map themes: each one shapes the land, and Random rolls one from the seed
  const share = (theme, ts) => { let n = 0, land = 0; for (let i = 0; i < 6; i++) { const m = E.generateMap({ seed: 500 + i * 31, nPlayers: 3, size: 'medium', theme }); for (const k in m.tiles) { const t = m.tiles[k]; if (!E.isLandTile(t)) continue; land++; if (ts.includes(t.t)) n++; } } return n / land; };
  ok(share('desert', ['desert', 'canyon']) > 0.4 && share('mixed', ['desert', 'canyon']) < 0.15, 'desert maps are mostly sand and canyons');
  ok(share('arctic', ['jungle', 'desert']) < 0.03 && share('arctic', ['tundra']) > 0.25, 'arctic maps are cold');
  ok(share('woodland', ['forest']) > 0.3 && share('grasslands', ['plains']) > 0.6 && share('jungle', ['jungle']) > 0.35, 'woodland, grasslands and jungle look the part');
  const roster = [0, 1, 2].map(i => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron' }));
  const a = E.createGame({ mode: 'domination', mapSize: 'small', theme: 'random', seed: 'same' }, roster).state, b = E.createGame({ mode: 'domination', mapSize: 'small', theme: 'random', seed: 'same' }, roster).state;
  ok(E.THEMES[a.map.theme] && a.map.theme === b.map.theme, 'a Random theme comes from the seed (' + a.map.theme + ')');
  const seen = new Set(); for (let i = 0; i < 40; i++) seen.add(E.createGame({ mode: 'domination', mapSize: 'small', theme: 'random', seed: 'r' + i }, roster).state.map.theme);
  ok(seen.size >= 6, 'and rolls plenty of different ones (' + seen.size + ')');
  ok(E.createGame({ mode: 'domination', mapSize: 'small', theme: 'jungle' }, roster).state.map.theme === 'jungle', 'a chosen theme sticks');
}
{ // Strategic Bombing hits troops as well as the economy
  let killed = 0, runs = 0;
  for (let i = 0; i < 20; i++) {
    const s = board({ seed: 'sb' + i }), T = s.map.tiles, p = E.player(s, 'A');
    const k = Object.keys(T).find(x => E.isLandTile(T[x]) && T[x].t !== 'mountain' && !T[x].river && !T[x].owner && E.dist(x, p.hq) <= 5 && E.dist(x, p.hq) >= 3);
    if (!k) continue;
    for (const n of E.area(k, 1)) if (T[n] && E.isLandTile(T[n])) T[n].owner = 'B';
    for (let j = 0; j < 4; j++) put(s, 'e' + j, 'grunt', k, 'B');
    p.tactics.push({ uid: 900, id: 'strategic' }); p.cash = 50;
    const r = E.applyAction(s, 'A', { a: 'tactic', uid: 900, target: k });
    if (!r.ok) continue; runs++;
    const ev = r.events.find(e => e.kills); killed += [0, 1, 2, 3].filter(j => !s.units['e' + j]).length;
    if (ev && ev.kills.length && T[k].ruin !== 2) killed = -999;
  }
  ok(runs >= 10 && killed / (runs * 4) > 0.15 && killed / (runs * 4) < 0.45, 'Strategic Bombing kills about 30% of the troops under it (' + killed + ' of ' + runs * 4 + ' in ' + runs + ' runs)');
}
{ // at most 3 airbases each
  const roster = [0, 1].map(i => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron' }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'large' }, roster);
  s.phase = 'play'; const p = E.player(s, 'p0'); p.cash = 999; const T = s.map.tiles;
  const far = Object.keys(T).filter(k => E.isLandTile(T[k]) && T[k].t !== 'mountain' && !T[k].river && !T[k].poi && !(T[k].structs || []).length && E.dist(k, p.hq) > 4).slice(0, 4);
  for (const k of far) T[k].owner = 'p0';
  const canBuild = k => !E.buildError(s, 'p0', 'airbase', k, new Set(far));
  ok(canBuild(far[0]), 'an airbase can go up away from the HQ');
  for (const k of far.slice(0, 3)) { T[k].structs = [{ type: 'airbase', owner: 'p0', lvl: 1 }]; T[k].struct = T[k].structs[0]; }
  ok(/3 airbases/.test(E.buildError(s, 'p0', 'airbase', far[3], new Set(far)) || ''), 'but no more than 3: ' + E.buildError(s, 'p0', 'airbase', far[3], new Set(far)));
}
{ // a state restored from JSON (undo, a save) keeps each hex's main building tied to its building list
  const roster = [0, 1].map(i => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron' }));
  let { state: s } = E.createGame({ mode: 'domination', mapSize: 'small' }, roster);
  s.phase = 'play'; const T = s.map.tiles, p = E.player(s, 'p0');
  const k = Object.keys(T).find(x => T[x].owner === 'p0' && E.dist(x, p.hq) === 1 && !(T[x].structs || []).length);
  T[k].structs = [{ type: 'fob', owner: 'p0', lvl: 1, lock: 1 }]; T[k].struct = T[k].structs[0];
  s = E.relink(JSON.parse(JSON.stringify(s)));   // what undo does
  ok(s.map.tiles[k].struct === s.map.tiles[k].structs[0], 'after a JSON restore the main building is the same object as the one in the list');
  s.turn.idx = s.players.findIndex(q => q.id === 'p0'); E.startTurn(s, [], Math.random);   // the owner's next turn brings the FOB online
  ok(!s.map.tiles[k].struct.lock && !s.map.tiles[k].structs[0].lock, 'and a FOB under construction finishes, as drawn too');
}
{ // a bot whose ally is on the way out (a break announced, or a pact running out unrenewed) gets its troops out of that land in
  // time (they'd be lost), and guards its HQ against that ally's army the way it would against an enemy's
  const { botStep } = require('../shared/bot');
  const game = (seed, ending) => {
    const roster = ['A', 'B', 'C'].map((id, i) => ({ id, name: id, color: E.COLORS[i], faction: 'iron', bot: true }));   // C keeps the war going (two allies alone would have won)
    const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', spawns: 'random', seed }, roster);
    s.phase = 'play'; s.turn.stage = 'act'; s.turn.idx = s.players.findIndex(p => p.id === 'A'); s.units = {}; s.weather = null; s.players.forEach(q => { q.tactics = []; q.cash = 0; });
    s.allies = [{ a: 'A', b: 'B', since: 1, until: s.turn.round + (ending === 'expiry' ? 1 : 4), renew: {}, ...(ending === 'break' ? { ending: 'B' } : {}) }];
    return s;
  };
  const play = s => { const mem = {}; for (let i = 0; i < 120; i++) { const a = botStep(s, 'A', mem); if (!a || a.a === 'end') break; E.applyAction(s, 'A', a); } };
  for (const why of ['break', 'expiry']) {
    let left = 0, total = 0;
    for (let g = 0; g < 20; g++) {
      const s = game('ev' + g, why), T = s.map.tiles, A = E.player(s, 'A');
      const strip = Object.keys(T).filter(k => E.isLandTile(T[k]) && T[k].t !== 'mountain' && !T[k].river && [2, 3].includes(E.dist(k, A.hq))).slice(0, 5);
      strip.forEach((k, i) => { T[k].owner = 'B'; put(s, 'a' + i, 'grunt', k, 'A'); put(s, 'm' + i, 'mauler', k, 'A'); });
      for (const n of E.area(A.hq, 1)) if (T[n] && E.isLandTile(T[n]) && !strip.includes(n)) T[n].owner = 'A';
      play(s);
      for (const u of Object.values(s.units)) if (u.owner === 'A' && T[u.hex].owner === 'B') { const r = E.reachable(s, 'A', [u.id], u.hex); if (Object.keys(r).some(k => ['move', 'capture'].includes(r[k].kind) && T[k].owner !== 'B')) left++; }
      total += strip.length * 2;
    }
    ok(left <= total * 0.02, `bots get their troops out of an ally's land before a ${why === 'break' ? 'break' : 'pact running out'} (${left} of ${total} left behind with a way out)`);
  }
  const guard = ending => { let tot = 0, n = 0;
    for (let g = 0; g < 20; g++) {
      const s = game('gd' + g, ending), T = s.map.tiles, A = E.player(s, 'A');
      const land = E.area(A.hq, 3).filter(k => T[k] && E.isLandTile(T[k]) && T[k].t !== 'mountain' && !T[k].river);
      const camp = land.find(k => E.dist(k, A.hq) === 2), away = camp ? land.filter(k => E.dist(k, A.hq) === 3 && E.dist(k, camp) >= 4) : [];
      if (!camp || away.length < 2) continue; n++;
      for (const k of land) T[k].owner = 'A'; T[camp].owner = 'B';
      for (let i = 0; i < 4; i++) put(s, 'b' + i, 'mauler', camp, 'B');
      put(s, 'x1', 'bulwark', away[0]); put(s, 'x2', 'bulwark', away[0]); put(s, 'y1', 'bulwark', away[1]); put(s, 'y2', 'bulwark', away[1]);
      play(s);
      for (const u of Object.values(s.units)) if (u.owner === 'A' && E.dist(u.hex, A.hq) <= 1) tot += E.unitDef(s, u);
    }
    return tot / Math.max(1, n); };
  const calm = guard(null), wary = guard('break');
  ok(wary >= calm + 2, `bots guard their HQ against a breaking ally's army (defence ${wary.toFixed(1)} vs ${calm.toFixed(1)} with a steady ally)`);
}
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
