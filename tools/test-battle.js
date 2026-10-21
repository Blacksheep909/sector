// Battle cards: both sides throw cards into a fight before the dice roll. node tools/test-battle.js
const E = require('../shared/engine');
const { battlePick } = require('../shared/bot');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function board() {
  const roster = [{ id: 'A', name: 'A', color: E.COLORS[0], faction: 'iron' }, { id: 'B', name: 'B', color: E.COLORS[1], faction: 'iron' }];
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', seed: 'bat1', mapType: 'continent' }, roster);
  s.phase = 'play'; s.turn.stage = 'act'; s.turn.idx = s.players.findIndex(p => p.id === 'A'); s.units = {}; s.weather = null;
  for (const p of s.players) { p.tactics = []; p.cash = 20; p.faction = 'ash'; }
  // two plains hexes side by side: A's at a, B's at b
  const T = s.map.tiles, a = Object.keys(T).find(k => T[k].t === 'plains' && !T[k].river && !T[k].poi && E.neighbors(k).some(n => T[n] && T[n].t === 'plains' && !T[n].river && !T[n].poi));
  const b = E.neighbors(a).find(n => T[n] && T[n].t === 'plains' && !T[n].river && !T[n].poi);
  for (const [k, o] of [[a, 'A'], [b, 'B']]) { T[k].owner = o; T[k].structs = []; T[k].struct = null; }
  return { s, a, b };
}
const put = (s, id, type, hex, owner) => { s.units[id] = { id, owner, type, hex, moved: false, fresh: false }; return id; };
const give = (s, pid, id, uid) => { E.player(s, pid).tactics.push({ uid, id }); return uid; };
const move = (a, b, ids) => ({ a: 'move', from: a, units: ids, to: b });

{ // the window: odds move as each side throws cards in, and the fight uses them
  const { s, a, b } = board();
  const att = ['g1', 'g2'].map(id => put(s, id, 'grunt', a, 'A')); ['h1', 'h2'].forEach(id => put(s, id, 'grunt', b, 'B'));
  const bt = E.openBattle(s, 'A', move(a, b, att));
  ok(bt && bt.hex === b && bt.def === 'B' && bt.units.length === 2, 'an attack order opens a battle');
  const p0 = E.battleOdds(s).winProb;
  give(s, 'A', 'rally', 1); give(s, 'B', 'holdfast', 2); give(s, 'B', 'ambush', 3); give(s, 'A', 'holdfast', 4); give(s, 'B', 'rally', 5);
  ok(E.battleHand(s, 'A').map(c => c.id).join() === 'rally', 'attackers only see attack (or any-side) cards');
  ok(E.battleHand(s, 'B').map(c => c.id).sort().join() === 'ambush,holdfast', 'defenders only see defence cards');
  ok(!E.battleCard(s, 'A', 4).ok && !E.battleCard(s, 'B', 5).ok, 'the wrong side can\'t play a card');
  let r = E.battleCard(s, 'A', 1); const p1 = E.battleOdds(s).winProb;
  ok(r.ok && E.player(s, 'A').cash === 19 && p1 > p0, 'Rally raises the attack odds (' + p0.toFixed(2) + ' → ' + p1.toFixed(2) + ')');
  r = E.battleCard(s, 'B', 2); E.battleCard(s, 'B', 3); const p2 = E.battleOdds(s).winProb;
  ok(r.ok && p2 < p1 && s.battle.cards.def.length === 2, 'the defender stacks two cards back (' + p2.toFixed(2) + ')');
  const c = E.battleOdds(s);
  ok(c.def.bonuses.some(x => x.label === 'Hold Fast' && x.mult === 2) && c.def.bonuses.some(x => x.label === 'Ambush' && x.chips === 4), 'Hold Fast +2 Mult, Ambush +2 Chips a defender');
  const res = E.applyAction(s, 'A', move(a, b, att), () => 0.5);
  const fight = res.events.find(e => e.e === 'combat');
  ok(res.ok && fight && fight.def.bonuses.some(x => x.label === 'Hold Fast') && fight.att.bonuses.some(x => x.label === 'Rally'), 'the fight counts every thrown card');
  ok(!s.battle && fight.cards.def.length === 2, 'the battle closes once the dice roll');
}
{ // stacking limit, refunds, and readying on your own turn
  const { s, a, b } = board();
  put(s, 'g1', 'grunt', a, 'A'); put(s, 'h1', 'grunt', b, 'B');
  [11, 12, 13, 14].forEach(u => give(s, 'B', 'holdfast', u));
  E.openBattle(s, 'A', move(a, b, ['g1']));
  [11, 12, 13].forEach(u => E.battleCard(s, 'B', u));
  ok(!E.battleCard(s, 'B', 14).ok && !E.battleHand(s, 'B').length, 'up to ' + E.BATTLE_MAX + ' cards a side');
  const cash = E.player(s, 'B').cash; E.closeBattle(s, true);
  ok(E.player(s, 'B').cash === cash + 3 && E.player(s, 'B').tactics.length === 4, 'an order that never fires hands the cards back');
  give(s, 'A', 'rally', 21); give(s, 'B', 'holdfast', 22);
  let r = E.applyAction(s, 'A', { a: 'tactic', uid: 21 });
  ok(r.ok && E.player(s, 'A').ready.join() === 'rally', 'an attack card can be readied on your turn');
  const c = E.combatCalc(s, 'A', [s.units.g1], a, b, false);
  ok(c.att.bonuses.some(x => x.label === 'Rally'), 'a readied card joins your next attack');
  s.turn.idx = s.players.findIndex(p => p.id === 'B');
  r = E.applyAction(s, 'B', { a: 'tactic', uid: 22 });
  ok(!r.ok, 'a defence card waits for an attack');
}
{ // Steady Nerves: your die never rolls below 3; Reserves add chips per unit
  const { s, a, b } = board();
  put(s, 'g1', 'grunt', a, 'A'); put(s, 'h1', 'grunt', b, 'B');
  give(s, 'A', 'steady', 31); give(s, 'B', 'reserves', 32);
  E.openBattle(s, 'A', move(a, b, ['g1']));
  const p0 = E.battleOdds(s).winProb; E.battleCard(s, 'A', 31); const p1 = E.battleOdds(s).winProb;
  E.battleCard(s, 'B', 32); const c = E.battleOdds(s);
  ok(p1 > p0, 'Steady Nerves lifts the odds (' + p0.toFixed(2) + ' → ' + p1.toFixed(2) + ')');
  ok(c.def.bonuses.some(x => x.label === 'Reserves' && x.chips === 2), 'Reserves: +2 Chips for each unit on your side');
}
{ // bots: throw a card in when it swings a fight that matters, keep it when it doesn't
  const { s, a, b } = board();
  E.player(s, 'B').diff = 'hard';
  ['g1', 'g2', 'g3'].forEach(id => put(s, id, 'grunt', a, 'A')); ['h1', 'h2', 'h3'].forEach(id => put(s, id, 'grunt', b, 'B'));
  give(s, 'B', 'holdfast', 41);
  E.openBattle(s, 'A', move(a, b, ['g1', 'g2', 'g3']));
  console.log('     (close fight: attack ' + Math.round(E.battleOdds(s).winProb * 100) + '%)');
  { const b0 = E.battleOdds(s).winProb; s.battle.cards.def.push('holdfast'); console.log('     (with Hold Fast: ' + Math.round(E.battleOdds(s).winProb * 100) + '%, was ' + Math.round(b0 * 100) + '%)'); s.battle.cards.def.pop(); }
  { let n = 0; for (let i = 0; i < 40; i++) if (battlePick(s, 'B') === 41) n++; ok(n >= 36, 'a hard bot defends a close fight with Hold Fast (' + n + '/40)'); }
  E.closeBattle(s);
  for (const id of ['g2', 'g3']) delete s.units[id];
  ['h4', 'h5', 'h6', 'h7'].forEach(id => put(s, id, 'grunt', b, 'B'));
  E.openBattle(s, 'A', move(a, b, ['g1']));
  { let n = 0; for (let i = 0; i < 40; i++) if (battlePick(s, 'B') !== null) n++; ok(n === 0, 'no card wasted on a fight it can\'t lose'); }
}
{ // battle cards turn up in resupply and in caches
  const seen = new Set(); let x = 7; const rng = () => (x = (x * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 3000; i++) seen.add(E.cacheCard(rng));
  ok(['holdfast', 'bayonets', 'barrage', 'reserves', 'steady'].every(id => seen.has(id)), 'caches can hold the new battle cards');
  ok(!E.REACTIONS && !E.reactTactic, 'the old reaction window is gone');
}
console.log(fails ? fails + ' FAILED' : 'all battle-card checks passed');
process.exit(fails ? 1 : 0);
