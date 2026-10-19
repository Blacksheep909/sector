// Engine checks for v0.9 (between-turn play): node tools/test-v09.js
const E = require('../shared/engine'); const { draftStep, botStep } = require('../shared/bot');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function game(opts = {}, n = 3) {
  const roster = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, color: E.COLORS[i], faction: 'iron', bot: i > 0 }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', timer: 0, maxRounds: 50, mapType: 'continent', spawns: 'random', ...opts }, roster);
  while (s.phase === 'draft' || s.phase === 'spawn') for (const p of s.players) { const a = draftStep(s, p.id); if (a) E.applyAction(s, p.id, a); }
  return s;
}
const me = s => E.current(s);
const endTurn = s => { const id = me(s).id; if (s.turn.stage === 'choose') E.applyAction(s, id, { a: 'choose', pick: 'income' }); E.applyAction(s, id, { a: 'end' }); };
const idle = (s, pid) => s.players.find(p => p.id !== pid && p.id !== me(s).id) || s.players.find(p => p.id !== me(s).id);

{ // off-turn diplomacy
  const s = game(); E.applyAction(s, me(s).id, { a: 'choose', pick: 'income' });
  const a = idle(s), b = s.players.find(p => p.id !== a.id && p.id !== me(s).id) || me(s);
  ok(me(s).id !== a.id, 'proposer is not the current player');
  const r = E.applyAction(s, a.id, { a: 'allyOffer', to: b.id });
  ok(r.ok, 'alliances can be proposed when it is not your turn' + (r.err ? ': ' + r.err : ''));
  const t = E.applyAction(s, a.id, { a: 'tradeCancel' });
  ok(t.ok, 'trade actions work off-turn');
}
{ // snap decisions arrive while others play, and pay out
  const s = game(); let waiting = null;
  for (let i = 0; i < 40 && !waiting; i++) { endTurn(s); waiting = s.players.find(p => p.id !== me(s).id && p.snap); }   // they're random: keep playing until one turns up
  ok(!!waiting, 'someone waiting has a snap decision');
  if (waiting) {
    const cash = waiting.cash, opts = waiting.snap.opts;
    const r = E.applyAction(s, waiting.id, { a: 'snap', pick: opts.indexOf('convoy') >= 0 ? opts.indexOf('convoy') : 0 });
    ok(r.ok && !waiting.snap, 'a snap decision can be answered off-turn');
    if (opts.includes('convoy')) ok(waiting.cash === cash + 3, 'convoy pays $3');
  }
}
{ // resupply prep: the next offer is dealt when your turn ends, and a pre-pick applies at your next turn start
  const s = game(); const p0 = me(s); E.applyAction(s, p0.id, { a: 'choose', pick: 'income' }); E.applyAction(s, p0.id, { a: 'end' });
  ok(p0.nextOffer && p0.nextOffer.length === 3, 'next resupply is dealt as your turn ends');
  const r = E.applyAction(s, p0.id, { a: 'prepick', pick: 'income' });
  ok(r.ok, 'you can pick it while others play');
  const cash = p0.cash;
  while (me(s).id !== p0.id) endTurn(s);
  ok(s.turn.stage === 'act' && p0.cash > cash, 'the pre-pick is applied at turn start (straight to acting)');
  const v = E.view(s, 'p1'); ok(!v.players.find(p => p.id === p0.id).nextOffer, 'rivals cannot see your next resupply');
}
{ // intel ops reveal fog
  const s = game({ fog: 'on' }); const p = me(s); E.applyAction(s, p.id, { a: 'choose', pick: 'income' }); p.cash = 20;
  const far = Object.keys(s.map.tiles).find(k => !E.visionOf(s, p.id).has(k) && E.dist(k, p.hq) > 8);
  const r = E.applyAction(s, p.id, { a: 'intel', target: far });
  ok(r.ok && E.visionOf(s, p.id).has(far) && p.cash === 18, 'intel op reveals a far hex for $2');
  E.applyAction(s, p.id, { a: 'intel', target: far }); ok(!E.applyAction(s, p.id, { a: 'intel', target: far }).ok, 'two intel ops per round');
}
{ // dig in: +1 defence until the stack moves
  const s = game(); const p = me(s); E.applyAction(s, p.id, { a: 'choose', pick: 'income' });
  const ids = Object.values(s.units).filter(u => u.owner === p.id && u.hex === p.hq).map(u => u.id);
  const r = E.applyAction(s, p.id, { a: 'digin', from: p.hq, units: ids });
  ok(r.ok && ids.every(id => s.units[id].dug && s.units[id].moved), 'a stack digs in');
  const o = s.players.find(q => q.id !== p.id);
  const c = E.combatCalc(s, o.id, [{ id: 'x', type: 'grunt', owner: o.id, hex: 'zz' }], 'zz', p.hq, false);
  ok(c.def.bonuses.some(b => b.label === 'Dug In'), 'dug-in defenders get +1 Mult');
}
{ // reactions: an Ambush played when attacked boosts the defenders
  const s = game(); const p = me(s); E.applyAction(s, p.id, { a: 'choose', pick: 'income' });
  const o = s.players.find(q => q.id !== p.id); o.cash = 10; o.tactics.push({ uid: 4242, id: 'ambush' });
  const k = E.neighbors(o.hq).find(n => s.map.tiles[n] && s.map.tiles[n].owner === o.id && E.isLandTile(s.map.tiles[n]));
  s.units.d1 = { id: 'd1', type: 'grunt', owner: o.id, hex: k, moved: false, fresh: false };
  const r = E.reactTactic(s, o.id, 4242, k);
  ok(r.ok && s.map.tiles[k].ambush === o.id && !o.tactics.some(c => c.uid === 4242), 'a reaction card plays off-turn');
  const c = E.combatCalc(s, p.id, [{ id: 'x', type: 'grunt', owner: p.id, hex: 'zz' }], 'zz', k, false);
  ok(c.def.bonuses.some(b => b.label === 'Ambush'), 'ambush adds defence chips');
  ok(!E.reactTactic(s, o.id, 999, k).ok, 'only cards in hand');
}
{ // allies can march through each other's land (without taking it); troops left there when the pact ends are lost
  const s = game({}, 3); const p = me(s), o = s.players.find(q => q.id !== p.id);
  E.applyAction(s, p.id, { a: 'choose', pick: 'income' });
  E.applyAction(s, p.id, { a: 'allyOffer', to: o.id }); E.applyAction(s, o.id, { a: 'allyReply', accept: true });
  // hand the ally a strip of land right next to our HQ
  const k = E.neighbors(p.hq).find(n => s.map.tiles[n] && E.isLandTile(s.map.tiles[n]) && s.map.tiles[n].t !== 'mountain');
  s.map.tiles[k].owner = o.id; for (const id in s.units) if (s.units[id].hex === k) delete s.units[id];
  for (const id in s.units) if (s.units[id].hex === p.hq) delete s.units[id];
  s.units.g = { id: 'g', type: 'grunt', owner: p.id, hex: p.hq, moved: false, fresh: false };
  const r = E.reachable(s, p.id, ['g'], p.hq);
  ok(r[k] && r[k].kind === 'move', 'allied land is a normal move');
  const mv = E.applyAction(s, p.id, { a: 'move', from: p.hq, units: ['g'], to: k });
  ok(mv.ok && s.units.g.hex === k && s.map.tiles[k].owner === o.id, 'moving onto allied land does not capture it');
  s.units.a1 = { id: 'a1', type: 'grunt', owner: o.id, hex: k, moved: false, fresh: false };
  const r2 = E.reachable(s, p.id, ['g'], k); ok(!Object.values(r2).some(x => x.kind === 'attack' && s.units.a1 && x === r2[k]), 'allied troops are never attacked');
  delete s.units.a1;
  E.applyAction(s, p.id, { a: 'allyBreak', with: o.id });
  for (let i = 0; i < 4 && s.units.g; i++) { const id = me(s).id; if (s.turn.stage === 'choose') E.applyAction(s, id, { a: 'choose', pick: 'income' }); E.applyAction(s, id, { a: 'end' }); }
  ok(!s.units.g, 'troops left in old allied land are lost when the pact ends');
}
{ // troop donations: only to allies, and the stack changes hands
  const s = game({}, 3); const p = me(s), o = s.players.find(q => q.id !== p.id), x = s.players.find(q => q.id !== p.id && q.id !== o.id);
  E.applyAction(s, p.id, { a: 'choose', pick: 'income' });
  const ids = Object.values(s.units).filter(u => u.owner === p.id && u.hex === p.hq).map(u => u.id);
  ok(!E.applyAction(s, p.id, { a: 'donate', from: p.hq, units: ids, to: x.id }).ok, 'cannot give troops to a non-ally');
  E.applyAction(s, p.id, { a: 'allyOffer', to: o.id }); E.applyAction(s, o.id, { a: 'allyReply', accept: true });
  const r = E.applyAction(s, p.id, { a: 'donate', from: p.hq, units: ids, to: o.id });
  ok(r.ok && ids.every(id => s.units[id].owner === o.id && s.units[id].moved), 'an ally receives the stack');
}
{ // rivers stop vehicles (unless bridged), not infantry; aircraft may stop over water
  const s = game(); const p = me(s); E.applyAction(s, p.id, { a: 'choose', pick: 'income' }); p.cash = 99;
  const k = E.neighbors(p.hq).find(n => s.map.tiles[n] && s.map.tiles[n].owner === p.id && E.isLandTile(s.map.tiles[n]) && s.map.tiles[n].t !== 'mountain');
  s.map.tiles[k].river = true; for (const id in s.units) if (s.units[id].hex === p.hq || s.units[id].hex === k) delete s.units[id];
  s.units.tk = { id: 'tk', type: 'mauler', owner: p.id, hex: p.hq, moved: false, fresh: false };
  s.units.gr = { id: 'gr', type: 'grunt', owner: p.id, hex: p.hq, moved: false, fresh: false };
  ok(!E.reachable(s, p.id, ['tk'], p.hq)[k], 'a tank cannot drive into a river');
  ok(!!E.reachable(s, p.id, ['gr'], p.hq)[k], 'infantry can ford a river');
  { const r = E.reachable(s, p.id, ['gr'], p.hq); ok(!Object.keys(r).some(x => r[x].prev === k), 'fording ends the move: nothing is reachable through the river this turn'); }
  ok(E.buildHexes(s, p.id, 'bridge').includes(k), 'you can bridge a river on your land');
  E.applyAction(s, p.id, { a: 'build', struct: 'bridge', hex: k });
  ok(!!E.reachable(s, p.id, ['tk'], p.hq)[k], 'a bridged river lets vehicles across');
  const sea = Object.keys(s.map.tiles).find(x => E.isWater(s.map.tiles[x]) && E.dist(x, p.hq) <= 3 && !Object.values(s.units).some(u => u.hex === x));
  if (sea) { s.units.hn = { id: 'hn', type: 'hornet', owner: p.id, hex: p.hq, moved: false, fresh: false };
    const r = E.reachable(s, p.id, ['hn'], p.hq); ok(r[sea] && r[sea].kind === 'move', 'aircraft can end a move over water');
    if (r[sea]) { E.applyAction(s, p.id, { a: 'move', from: p.hq, units: ['hn'], to: sea }); ok(!!s.units.hn, 'and they do not drown there'); } }
}
{ // Spy Ring can be aimed at a commander directly
  const s = game(); const p = me(s); E.applyAction(s, p.id, { a: 'choose', pick: 'income' }); p.cash = 20;
  const o = s.players.find(q => q.id !== p.id); o.tactics.push({ uid: 3131, id: 'smoke' });
  p.tactics.push({ uid: 3132, id: 'spy' });
  const r = E.applyAction(s, p.id, { a: 'tactic', uid: 3132, targetPid: o.id });
  ok(r.ok && p.tactics.some(c => c.id === 'smoke' || c.uid === 3131) || (r.ok && r.events.length), 'spy ring works when aimed at a commander' + (r.err ? ': ' + r.err : ''));
}
{ // overwatch: a watching stack can fire on an enemy that stops next to it
  const s = game(); const p = me(s); E.applyAction(s, p.id, { a: 'choose', pick: 'income' });
  const o = s.players.find(q => q.id !== p.id);
  const ids = Object.values(s.units).filter(u => u.owner === p.id && u.hex === p.hq).map(u => u.id);
  const r = E.applyAction(s, p.id, { a: 'overwatch', from: p.hq, units: ids });
  ok(r.ok && ids.every(id => s.units[id].ow), 'a stack goes on overwatch');
  const k = E.neighbors(p.hq).find(n => s.map.tiles[n] && E.isLandTile(s.map.tiles[n]) && s.map.tiles[n].t !== 'mountain');
  for (const id in s.units) if (s.units[id].hex === k) delete s.units[id];
  s.units.en = { id: 'en', type: 'grunt', owner: o.id, hex: k, moved: true, fresh: false };
  const tr = E.overwatchTriggers(s, o.id, k);
  ok(tr.length === 1 && tr[0].owner === p.id, 'an enemy stopping next to it triggers overwatch');
  const f = E.overwatchFire(s, p.id, tr[0].from, k, () => 0.99);
  ok(f.ok && f.events.some(e => e.e === 'combat' && e.overwatch) && ids.every(id => !s.units[id] || !s.units[id].ow), 'overwatch fires once, then it is spent');
}
{ // supply drops land on open ground and go to the first unit there
  const s = game(); let tries = 0;
  while (!(s.drops && s.drops.length) && tries++ < 60) endTurn(s);
  ok(s.drops && s.drops.length > 0, 'a supply drop lands within a few rounds');
  if (s.drops && s.drops.length) {
    const d = s.drops[0]; const p = me(s); if (s.turn.stage === 'choose') E.applyAction(s, p.id, { a: 'choose', pick: 'income' });
    const from = E.neighbors(d.hex).find(n => s.map.tiles[n] && E.isLandTile(s.map.tiles[n]) && s.map.tiles[n].t !== 'mountain' && !Object.values(s.units).some(u => u.hex === n));
    if (from) {
      s.units.dr = { id: 'dr', type: 'grunt', owner: p.id, hex: from, moved: false, fresh: false };   // infantry: drops can land on rivers
      const cash = p.cash, cards = p.tactics.length;
      const r = E.applyAction(s, p.id, { a: 'move', from, units: ['dr'], to: d.hex });
      ok(r.ok && !s.drops.some(x => x.hex === d.hex) && (p.cash > cash || p.tactics.length > cards), 'the first unit there claims the drop');
    }
  }
}
{ // undefended enemy land: troops sweep through at full speed, capturing as they go, and stop on contact
  const s = game({ fog: 'off' }); if (s.turn.stage === 'choose') E.applyAction(s, me(s).id, { a: 'choose', pick: 'income' }); const p = me(s), foe = s.players.find(x => x.id !== p.id);
  for (const id in s.units) delete s.units[id];
  const T = s.map.tiles, clear = k => T[k] && E.isLandTile(T[k]) && !T[k].river && !T[k].poi && !E.structsOf(T[k]).length && !E.TERRAIN[T[k].t].moveCost && T[k].t !== 'mountain';
  let line = null;
  for (const a in T) { if (!clear(a)) continue; for (const b of E.neighbors(a)) { if (!clear(b)) continue; const [qa, ra] = E.parse(a), [qb, rb] = E.parse(b); const c = (2 * qb - qa) + ',' + (2 * rb - ra), d = (3 * qb - 2 * qa) + ',' + (3 * rb - 2 * ra); if (clear(c) && clear(d)) { line = [a, b, c, d]; break; } } if (line) break; }
  ok(!!line, 'found a straight run of open land');
  if (line) {
    const [a, b, c, d] = line; T[a].owner = p.id; for (const k of [b, c, d]) T[k].owner = foe.id;
    s.units.sk = { id: 'sk', type: 'skitter', owner: p.id, hex: a, moved: false, fresh: false };
    const reach = E.reachable(s, p.id, ['sk'], a);
    ok(reach[d] && reach[d].c === 3, 'a buggy drives 3 hexes deep into undefended enemy land');
    s.units.en = { id: 'en', type: 'grunt', owner: foe.id, hex: E.neighbors(c).find(k => ![b, c, d].includes(k) && T[k] && E.isLandTile(T[k]) && E.dist(k, b) > 1) || d, moved: false, fresh: false };
    const r2 = E.reachable(s, p.id, ['sk'], a);
    ok(r2[c] && r2[c].kind === 'capture' && !(r2[d] && r2[d].prev === c), 'it stops on contact with enemy troops');
    delete s.units.en;
    const r = E.applyAction(s, p.id, { a: 'move', from: a, units: ['sk'], to: d });
    ok(r.ok && [b, c, d].every(k => T[k].owner === p.id), 'every hex on the way is captured' + (r.err ? ': ' + r.err : ''));
  }
}
{ // a pocket walled in only by mountains belongs to nobody; it flips only to whoever holds ground around it
  const s = game({ fog: 'off' }); if (s.turn.stage === 'choose') E.applyAction(s, me(s).id, { a: 'choose', pick: 'income' });
  const p = me(s), foe = s.players.find(x => x.id !== p.id), T = s.map.tiles;
  const far = k => s.players.every(q => !q.hq || E.dist(q.hq, k) > 4) && !Object.values(s.units).some(u => E.dist(u.hex, k) <= 2);
  const k = Object.keys(T).find(k => E.isLandTile(T[k]) && T[k].t !== 'mountain' && far(k) && E.neighbors(k).every(n => T[n]));
  ok(!!k, 'found an open hex to wall in');
  if (k) {
    Object.assign(T[k], { owner: foe.id, structs: [], struct: null, river: false }); delete T[k].poi;
    for (const n of E.neighbors(k)) Object.assign(T[n], { t: 'mountain', owner: null, structs: [], struct: null, river: false });
    const step = () => { const st = Object.values(s.units).find(u => u.owner === p.id && E.canAct(s, u)); if (!st) return false; const r = E.reachable(s, p.id, [st.id], st.hex); const to = Object.keys(r).find(x => r[x].kind === 'move' || r[x].kind === 'capture'); return !!to && E.applyAction(s, p.id, { a: 'move', from: st.hex, units: [st.id], to }).ok; };
    ok(step() && T[k].owner === foe.id, 'a hex ringed by mountains is not annexed by someone who does not touch it');
    const gap = E.neighbors(k)[0]; Object.assign(T[gap], { t: 'plains', owner: p.id });
    ok(step() && T[k].owner === p.id, 'holding the only way in does encircle it');
  }
}
{ // bots play with all of this switched on, to the end
  const s = game({ mapSize: 'small', maxRounds: 10 }, 3); s.players.forEach(p => { p.bot = true; });
  let n = 0;
  while (s.phase === 'play' && n < 30000) { const p = me(s), mem = {}; let c = 0; while (s.phase === 'play' && me(s).id === p.id) { let a = botStep(s, p.id, mem); if (++c > 90) a = { a: 'end' }; E.applyAction(s, p.id, a); n++; } }
  ok(s.phase === 'over', 'bots finish a game');
}
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
