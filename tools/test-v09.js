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
{ // bots play with all of this switched on, to the end
  const s = game({ mapSize: 'small', maxRounds: 10 }, 3); s.players.forEach(p => { p.bot = true; });
  let n = 0;
  while (s.phase === 'play' && n < 30000) { const p = me(s), mem = {}; let c = 0; while (s.phase === 'play' && me(s).id === p.id) { let a = botStep(s, p.id, mem); if (++c > 90) a = { a: 'end' }; E.applyAction(s, p.id, a); n++; } }
  ok(s.phase === 'over', 'bots finish a game');
}
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
