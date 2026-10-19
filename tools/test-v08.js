// Engine checks for v0.8 content: node tools/test-v08.js
const E = require('../shared/engine'); const { draftStep, botStep } = require('../shared/bot');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function game(opts = {}, n = 2) {
  const roster = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron', bot: true }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', timer: 0, maxRounds: 50, mapType: 'continent', spawns: 'random', ...opts }, roster);
  while (s.phase === 'draft' || s.phase === 'spawn') for (const p of s.players) { const a = draftStep(s, p.id); if (a) E.applyAction(s, p.id, a); }
  E.applyAction(s, E.current(s).id, { a: 'choose', pick: 'income' });
  return s;
}
const me = s => E.current(s);
const clearHex = (s, k) => { for (const id in s.units) if (s.units[id].hex === k) delete s.units[id]; };
const land = (s, from, d) => Object.keys(s.map.tiles).find(k => E.dist(k, from) === d && E.isLandTile(s.map.tiles[k]) && s.map.tiles[k].t !== 'mountain' && !s.map.tiles[k].owner && !s.map.tiles[k].poi);

{ // every aircraft (gunships too) only takes the hex it lands on
  const s = game(); const p = me(s); clearHex(s, p.hq);
  for (const type of ['hornet', 'valkyrie', 'seraph']) {
    const c = JSON.parse(JSON.stringify(s));
    c.units.a1 = { id: 'a1', type, owner: p.id, hex: p.hq, moved: false, fresh: false };
    const r = E.reachable(c, p.id, ['a1'], p.hq);
    const to = Object.keys(r).find(k => r[k].kind !== 'pass' && r[k].kind !== 'attack' && E.pathTo(r, k).length >= 4 && E.pathTo(r, k).slice(1, -1).some(x => !c.map.tiles[x].owner && E.isLandTile(c.map.tiles[x])));
    if (!to) { ok(true, type + ': no long flight on this map (skipped)'); continue; }
    const res = E.applyAction(c, p.id, { a: 'move', from: p.hq, units: ['a1'], to });
    const mv = res.events.find(e => e.e === 'move');
    ok(res.ok && mv.captures.every(k => k === to), type + ' seizes only its landing hex');
  }
}
{ // the Sentinel SAM only engages aircraft, and kills only aircraft
  const s = game(); const p = me(s); const o = s.players.find(q => q.id !== p.id);
  const k = land(s, p.hq, 2); clearHex(s, p.hq); clearHex(s, k);
  s.units.sm = { id: 'sm', type: 'sentinel', owner: p.id, hex: p.hq, moved: false, fresh: false };
  s.units.g = { id: 'g', type: 'grunt', owner: o.id, hex: k, moved: false, fresh: false };
  ok(!E.rangedTargets(s, p.id, ['sm'], p.hq).includes(k), 'SAM ignores ground-only stacks');
  s.units.h = { id: 'h', type: 'hornet', owner: o.id, hex: k, moved: false, fresh: false };
  ok(E.rangedTargets(s, p.id, ['sm'], p.hq).includes(k), 'SAM targets a stack with aircraft');
  const r = E.applyAction(s, p.id, { a: 'fire', from: p.hq, units: ['sm'], to: k }, () => 0.99);
  ok(r.ok && s.units.g, 'SAM never kills the ground troops');
}
{ // anti-air units add their AA chips against aircraft
  const s = game(); const p = me(s); const o = s.players.find(q => q.id !== p.id); const k = land(s, p.hq, 1) || land(s, p.hq, 2);
  s.units.x = { id: 'x', type: 'skyguard', owner: o.id, hex: k, moved: false, fresh: false };
  const c = E.combatCalc(s, p.id, [{ id: 'y', type: 'hornet', owner: p.id, hex: p.hq }], p.hq, k, false);
  ok(c.def.bonuses.some(b => b.label === 'Anti-Air' && b.chips === 6), 'Skyguard adds +6 Anti-Air chips');
}
{ // warehouses are linear and building income tapers
  const s = game(); const p = me(s);
  const own = Object.keys(s.map.tiles).filter(k => s.map.tiles[k].owner === p.id && k !== p.hq).slice(0, 3);
  own.forEach(k => { s.map.tiles[k].structs = [{ type: 'warehouse', owner: p.id, lvl: 3 }, { type: 'refinery', owner: p.id, lvl: 3 }]; s.map.tiles[k].struct = s.map.tiles[k].structs[0]; });
  const inc = E.computeIncome(s, p.id);
  ok(inc.ware > 0 && inc.taper < 0, 'warehouse income counted, building taper applied (ware ' + inc.ware + ', taper ' + inc.taper + ')');
  ok(inc.ware + inc.ref + inc.taper <= 8 + Math.ceil((24 - 8) / 2) + Math.ceil((inc.ware + inc.ref - 24) / 4) + 1, 'buildings pay at most 8 + half to 24 + a quarter beyond');
}
{ // pacts last 5 rounds, renew together, and lapse without a traitor penalty
  const s = game({}, 3); const a = me(s).id, b = s.players.find(q => q.id !== a).id;
  E.applyAction(s, a, { a: 'allyOffer', to: b }); E.applyAction(s, b, { a: 'allyReply', accept: true });
  const x = s.allies[0];
  ok(x.until === x.since + 5, 'a new alliance runs 5 rounds');
  ok(!E.applyAction(s, a, { a: 'allyRenew', with: b }).ok, 'cannot renew early');
  x.until = s.turn.round + 1;
  ok(E.applyAction(s, a, { a: 'allyRenew', with: b }).ok, 'can renew in the last rounds');
  ok(s.allies[0].until === s.turn.round + 1, 'one-sided renewal does not extend yet');
  x.until = s.turn.round; x.renew = {};
  for (let i = 0; i < 6 && E.isAlly(s, a, b); i++) { const id = E.current(s).id; if (s.turn.stage === 'choose') E.applyAction(s, id, { a: 'choose', pick: 'income' }); E.applyAction(s, id, { a: 'end' }); }
  ok(!E.isAlly(s, a, b) && !E.player(s, a).traitor && !E.player(s, b).traitor, 'an unrenewed pact lapses peacefully');
}
{ // fog of war: a planned route through hidden enemies turns into an ambush instead of failing
  let tried = 0, good = 0;
  for (let g = 0; g < 12 && tried < 4; g++) {
    const s = game({ fog: 'on' }); const p = me(s); clearHex(s, p.hq);
    s.units.sk = { id: 'sk', type: 'skitter', owner: p.id, hex: p.hq, moved: false, fresh: false };
    const v = E.view(s, p.id), r = E.reachable(v, p.id, ['sk'], p.hq);
    const to = Object.keys(r).find(k => ['move', 'capture'].includes(r[k].kind) && r[k].c >= 3 && v.map.tiles[k].fog);
    if (!to) continue; const path = E.pathTo(r, to); const mid = path[path.length - 2];
    const o = s.players.find(q => q.id !== p.id); s.units.e = { id: 'e', type: 'grunt', owner: o.id, hex: mid, moved: false, fresh: false };
    const plain = E.applyAction(JSON.parse(JSON.stringify(s)), p.id, { a: 'move', from: p.hq, units: ['sk'], to });
    if (plain.ok) continue; tried++;
    const res = E.applyAction(s, p.id, { a: 'move', from: p.hq, units: ['sk'], to, path });
    if (res.ok && res.events.some(e => e.e === 'fogstop')) good++;
  }
  ok(good === tried, 'fogged moves stop short or ambush (' + good + '/' + tried + ')');
}
{ // new airstrike cards
  for (const id of ['gunrun', 'precision', 'buster']) {
    const s = game(); const p = me(s); const o = s.players.find(q => q.id !== p.id); p.cash = 99;
    const k = land(s, p.hq, 3); s.map.tiles[k].owner = o.id; s.map.tiles[k].structs = [{ type: 'bunker', owner: o.id, lvl: 3 }]; s.map.tiles[k].struct = s.map.tiles[k].structs[0];
    s.units.m = { id: 'm', type: 'mauler', owner: o.id, hex: k, moved: false, fresh: false };
    p.tactics.push({ uid: 777, id });
    const r = E.applyAction(s, p.id, { a: 'tactic', uid: 777, target: k }, () => 0.9);
    ok(r.ok, id + ' plays' + (r.err ? ': ' + r.err : ''));
    if (id === 'precision') ok(!s.units.m, 'precision strike always kills the strongest unit');
    if (id === 'buster') ok(E.structsOf(s.map.tiles[k])[0].lvl === 1, 'bunker buster knocks 2 levels off a bunker');
  }
}
{ // rivers stay off HQs; maps have rivers with tributaries and some lakes, never near an HQ
  let rivers = 0, lakes = 0, lakeNearHq = 0;
  for (let i = 0; i < 6; i++) {
    const s = game({}, 4); const T = s.map.tiles;
    ok(s.players.every(p => !T[p.hq].river), 'no HQ stands in a river');
    rivers += Object.values(T).filter(t => t.river).length;
    for (const k in T) if (T[k].lake) { lakes++; if (s.players.some(p => E.dist(p.hq, k) <= 4)) lakeNearHq++; }
  }
  ok(rivers / 6 >= 12, 'medium maps average 12+ river hexes (' + (rivers / 6).toFixed(1) + ')');
  ok(lakes > 0 && !lakeNearHq, 'lakes appear, and never within 4 of an HQ');
}
{ // Quarry Blast brings down two mountains when there's a range
  let tried = 0, two = 0;
  for (let g = 0; g < 10 && tried < 3; g++) {
    const s = game(); const p = me(s);
    // make a 2-mountain ridge 2 hexes from the HQ
    const a1 = Object.keys(s.map.tiles).find(k => E.dist(k, p.hq) === 2 && E.isLandTile(s.map.tiles[k]));
    const a2 = a1 && E.neighbors(a1).find(n => s.map.tiles[n] && E.isLandTile(s.map.tiles[n]) && E.dist(n, p.hq) === 3);
    if (!a1 || !a2) continue; s.map.tiles[a1].t = 'mountain'; s.map.tiles[a2].t = 'mountain';
    const ts = E.tacticTargets(s, p.id, 'quarry').filter(k => k === a1);
    if (!ts.length) continue; tried++;
    p.tactics.push({ uid: 555, id: 'quarry' }); p.cash = 99;
    const r = E.applyAction(s, p.id, { a: 'tactic', uid: 555, target: ts[0] });
    const ev = r.events.find(e => e.e === 'tactic');
    if (r.ok && s.map.tiles[ts[0]].t === 'hills' && ev.also && s.map.tiles[ev.also].t === 'hills') two++;
  }
  ok(tried > 0 && two === tried, 'quarry blast flattens two mountains (' + two + '/' + tried + ')');
}
{ // bots finish a short game without failed actions blocking them
  const s = game({ mapSize: 'small', maxRounds: 8 }, 3); let n = 0;
  while (s.phase === 'play' && n < 20000) { const p = me(s), mem = {}; let c = 0; while (s.phase === 'play' && me(s).id === p.id) { let a = botStep(s, p.id, mem); if (++c > 90) a = { a: 'end' }; E.applyAction(s, p.id, a); n++; } }
  ok(s.phase === 'over', 'bots play a game to the end');
}
{ // economic warfare: strikes, shelling and strategic bombing wreck buildings; bombed land pays nothing for 2 turns
  const setup = () => {
    const s = game(); const p = me(s); const o = s.players.find(q => q.id !== p.id); p.cash = 99;
    const k = land(s, p.hq, 3); const t = s.map.tiles[k]; t.owner = o.id; t.structs = [{ type: 'warehouse', owner: o.id, lvl: 2 }, { type: 'refinery', owner: o.id, lvl: 1 }]; t.struct = t.structs[0];
    for (const n of E.neighbors(k)) if (s.map.tiles[n] && E.isLandTile(s.map.tiles[n]) && !s.map.tiles[n].owner) s.map.tiles[n].owner = o.id;
    return { s, p, o, k, t };
  };
  { const { s, p, k, t } = setup(); p.tactics.push({ uid: 901, id: 'gunrun' });
    ok(E.tacticTargets(s, p.id, 'gunrun').includes(k), 'gun run can target undefended buildings');
    const r = E.applyAction(s, p.id, { a: 'tactic', uid: 901, target: k }); ok(r.ok && E.structsOf(t).find(x => x.type === 'warehouse').lvl === 1, 'gun run knocks a level off the warehouse'); }
  { const { s, p, k, t } = setup(); p.tactics.push({ uid: 902, id: 'precision' });
    const r = E.applyAction(s, p.id, { a: 'tactic', uid: 902, target: k }); ok(r.ok && !E.structsOf(t).some(x => x.type === 'warehouse'), 'precision strike destroys a building outright'); }
  { const { s, p, o } = setup();
    // bomb supplied land right next to the rival's HQ (give the bomber a foothold in range)
    const k = E.neighbors(o.hq).find(n => s.map.tiles[n] && s.map.tiles[n].owner === o.id && E.isLandTile(s.map.tiles[n])), t = s.map.tiles[k];
    t.structs = [{ type: 'warehouse', owner: o.id, lvl: 2 }]; t.struct = t.structs[0];
    const foot = Object.keys(s.map.tiles).find(x => E.dist(x, k) === 4 && E.isLandTile(s.map.tiles[x]) && !s.map.tiles[x].owner); s.map.tiles[foot].owner = p.id;
    const before = E.computeIncome(s, o.id).total; p.tactics.push({ uid: 903, id: 'strategic' });
    const r = E.applyAction(s, p.id, { a: 'tactic', uid: 903, target: k }); const after = E.computeIncome(s, o.id);
    ok(r.ok && t.ruin === 2 && after.ruined >= 1 && after.total < before, 'strategic bombing bombs land out and cuts income (' + before + ' -> ' + after.total + ')');
    for (let i = 0; i < 8 && t.ruin; i++) { const id = E.current(s).id; if (s.turn.stage === 'choose') E.applyAction(s, id, { a: 'choose', pick: 'income' }); E.applyAction(s, id, { a: 'end' }); }
    ok(!t.ruin, 'bombed-out land recovers after 2 of its owner turns'); }
  { const { s, p, k, t } = setup(); const from = Object.keys(s.map.tiles).find(x => s.map.tiles[x].owner === p.id && E.dist(x, k) === 2) || p.hq;
    for (const id in s.units) if (s.units[id].hex === from) delete s.units[id];
    s.units.art = { id: 'art', type: 'thumper', owner: p.id, hex: from, moved: false, fresh: false };
    const tg = E.rangedTargets(s, p.id, ['art'], from); ok(tg.includes(k) || E.dist(from, k) > 2, 'artillery can target undefended buildings in range');
    if (tg.includes(k)) { const r = E.applyAction(s, p.id, { a: 'fire', from, units: ['art'], to: k }); ok(r.ok && r.events.some(e => e.e === 'shell') && E.structsOf(t).find(x => x.type === 'warehouse').lvl === 1, 'a shell knocks a level off'); } }
}
{ // air defence shoots down air strikes (not nukes); the Trident's missile can only be stopped by Sentinels
  const s = game(); const p = me(s); const o = s.players.find(q => q.id !== p.id); p.cash = 99;
  const k = land(s, p.hq, 3); s.map.tiles[k].owner = o.id;
  s.units.m = { id: 'm', type: 'mauler', owner: o.id, hex: k, moved: false, fresh: false };
  ok(E.interceptChance(s, p.id, k, 'airstrike') === 0, 'no air defence, no interception');
  s.units.sg = { id: 'sg', type: 'skyguard', owner: o.id, hex: k, moved: false, fresh: false };
  ok(Math.abs(E.interceptChance(s, p.id, k, 'airstrike') - 0.5) < 1e-9, 'a Skyguard gives a 50% shoot-down chance');
  ok(E.tacticTargets(s, p.id, 'airstrike').includes(k), 'defended hexes can still be targeted');
  p.tactics.push({ uid: 801, id: 'airstrike' });
  const r = E.applyAction(s, p.id, { a: 'tactic', uid: 801, target: k }, () => 0.1);
  ok(r.ok && r.events.some(e => e.intercepted) && s.units.m && !p.tactics.some(c => c.uid === 801), 'an intercepted strike does nothing and the card is spent');
  ok(E.interceptChance(s, p.id, k, 'precision') < E.interceptChance(s, p.id, k, 'airstrike'), 'precision strikes are harder to catch');
  s.map.tiles[k].structs = [{ type: 'flak', owner: o.id, lvl: 3 }]; s.map.tiles[k].struct = s.map.tiles[k].structs[0];
  const nk = Object.keys(s.map.tiles).filter(x => E.dist(x, k) <= 1);
  ok(E.tacticTargets(s, p.id, 'nuke').some(x => nk.includes(x)) || !E.tacticTargets(s, p.id, 'nuke').length, 'flak does not block nukes');
  // Trident
  const sea = Object.keys(s.map.tiles).find(x => E.isWater(s.map.tiles[x]) && E.dist(x, k) <= 8 && !Object.values(s.units).some(u => u.hex === x));
  if (sea) {
    s.units.tr = { id: 'tr', type: 'trident', owner: p.id, hex: sea, moved: false, fresh: false };
    ok(E.rangedTargets(s, p.id, ['tr'], sea).includes(k), 'the Trident can reach a target 8 hexes away');
    s.units.sn = { id: 'sn', type: 'sentinel', owner: o.id, hex: k, moved: false, fresh: false };
    const r2 = E.applyAction(s, p.id, { a: 'fire', from: sea, units: ['tr'], to: k }, () => 0.1);
    ok(r2.ok && r2.events.some(e => e.e === 'intercept'), 'a Sentinel can intercept the missile');
  }
}
{ // bridges: no neighbours, airstrikes drop them, and the wreckage costs extra to rebuild
  let checked = false;
  for (let g = 0; g < 25 && !checked; g++) {
    const s = game({ mapType: 'archipelago' }); const p = me(s); p.cash = 99;
    const spots = E.buildHexes(s, p.id, 'bridge'); if (!spots.length) continue;
    const k = spots[0]; const base = E.buildCost(s, p, 'bridge', k);
    const r = E.applyAction(s, p.id, { a: 'build', struct: 'bridge', hex: k }); if (!r.ok) continue;
    checked = true;
    ok(E.neighbors(k).every(n => E.buildError(s, p.id, 'bridge', n) !== null), 'no bridge can go next to another bridge');
    const o = s.players.find(q => q.id !== p.id); const b = E.structsOf(s.map.tiles[k]).find(x => x.type === 'bridge'); b.owner = o.id; s.map.tiles[k].owner = o.id;
    s.turn.idx = s.players.indexOf(o); s.turn.idx = s.players.findIndex(q => q.id === p.id);
    const near = Object.keys(s.map.tiles).find(x => E.dist(x, k) === 2 && E.isLandTile(s.map.tiles[x])); if (near) s.map.tiles[near].owner = p.id;
    p.tactics.push({ uid: 700, id: 'precision' });
    ok(E.tacticTargets(s, p.id, 'precision').includes(k), 'air strikes can target an enemy bridge');
    const r2 = E.applyAction(s, p.id, { a: 'tactic', uid: 700, target: k });
    ok(r2.ok && !s.map.tiles[k].bridge && s.map.tiles[k].wreck, 'a bombed bridge falls and leaves wreckage');
    s.map.tiles[near || k].owner = p.id;
    ok(E.buildCost(s, p, 'bridge', k) === E.structCost(p, 'bridge', 1) + 8, 'rebuilding over the wreckage costs $8 more');
  }
  ok(checked, 'found a bridge spot to test');
}
{ // new and reworked units
  ok(E.UNITS.grunt.cost === 1, 'Grunts cost $1');
  ok(E.UNITS.wraith.mv === 5 && !E.UNITS.wraith.ability, 'the Outrider is a fast wheeled vehicle, not a hovercraft');
  ok(E.UNITS.jackal.rarity === 'uncommon' && E.UNITS.coyote.rarity === 'uncommon', 'two uncommon light vehicles');
  const s = game({ fog: 'on' }); const p = me(s); const k = p.hq;
  s.units.cy = { id: 'cy', type: 'coyote', owner: p.id, hex: k, moved: false, fresh: false };
  const far = Object.keys(s.map.tiles).find(x => E.dist(x, k) === 4);
  ok(E.visionOf(s, p.id).has(far), 'the Coyote sees 4 hexes out');
}
{ // Hailstorm salvo hits the stacks around its target
  const s = game(); const p = me(s); const o = s.players.find(q => q.id !== p.id);
  const k = land(s, p.hq, 4); const ring = E.neighbors(k).filter(n => s.map.tiles[n] && E.isLandTile(s.map.tiles[n]) && n !== p.hq).slice(0, 2);
  s.map.tiles[k].owner = o.id;
  s.units.t1 = { id: 't1', type: 'grunt', owner: o.id, hex: k, moved: false, fresh: false };
  ring.forEach((n, i) => { s.units['r' + i] = { id: 'r' + i, type: 'grunt', owner: o.id, hex: n, moved: false, fresh: false }; });
  const from = Object.keys(s.map.tiles).find(x => s.map.tiles[x].owner === p.id && E.dist(x, k) <= 4 && E.dist(x, k) >= 2) || p.hq;
  for (const id in s.units) if (s.units[id].hex === from) delete s.units[id];
  s.units.hs = { id: 'hs', type: 'hailstorm', owner: p.id, hex: from, moved: false, fresh: false };
  const r = E.applyAction(s, p.id, { a: 'fire', from, units: ['hs'], to: k }, () => 0.99);
  const ce = r.events.find(e => e.e === 'combat');
  ok(r.ok && ce && ce.attWin && ce.splash.length === ring.length, 'a winning salvo also hits ' + ring.length + ' neighbouring stacks');
}
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
