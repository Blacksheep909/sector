// Bots use combined arms: with tanks and troops both next to a weak enemy hex, they bring both in. node tools/test-bot-arms.js
const E = require('../shared/engine'); const { botStep } = require('../shared/bot');
let wins = 0, tries = 0;
for (let seed = 0; seed < 30; seed++) {
  const roster = [{ id: 'A', name: 'A', color: E.COLORS[0], faction: 'iron', bot: true, diff: 'hard' }, { id: 'B', name: 'B', color: E.COLORS[1], faction: 'iron' }];
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', seed: 'ca' + seed, mapType: 'continent' }, roster);
  s.phase = 'play'; s.turn.stage = 'act'; s.turn.idx = 0; s.units = {}; s.weather = null; s.players[0].diff = 'hard';
  for (const p of s.players) { p.tactics = []; p.cash = 0; }
  const T = s.map.tiles, plain = k => T[k] && T[k].t === 'plains' && !T[k].river && !T[k].poi;
  const b = Object.keys(T).find(k => plain(k) && E.neighbors(k).filter(plain).length >= 3); if (!b) continue;
  const [a1, a2] = E.neighbors(b).filter(plain);
  for (const k in T) { if (T[k].owner) { T[k].owner = null; T[k].structs = []; T[k].struct = null; } }
  for (const [k, o] of [[a1, 'A'], [a2, 'A'], [b, 'B']]) { T[k].owner = o; T[k].structs = []; T[k].struct = null; }
  const put = (id, type, hex, owner) => { s.units[id] = { id, owner, type, hex, moved: false, fresh: false }; };
  put('t1', 'mauler', a1, 'A'); put('t2', 'mauler', a1, 'A'); put('g1', 'grunt', a2, 'A'); put('g2', 'grunt', a2, 'A'); put('d1', 'grunt', b, 'B');
  const mem = {}; tries++;
  for (let i = 0; i < 20; i++) { const a = botStep(s, 'A', mem); if (!a || a.a === 'end') break;
    if ((a.a === 'move' || a.a === 'assault') && a.to === b) { if (a.a === 'assault' && a.groups.length === 2) wins++; break; }
    const r = E.applyAction(s, 'A', a); if (!r.ok) break; }
}
console.log((wins >= tries * 0.9 ? 'ok   ' : 'FAIL ') + 'combined-arms blows: ' + wins + ' / ' + tries);
if (wins < tries * 0.9) process.exit(1); else console.log('all passed');
