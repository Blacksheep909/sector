// A captured HQ becomes the conqueror's FOB: node tools/test-hq-capture.js
const E = require('../shared/engine');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const roster = ['a', 'b', 'c'].map((id, i) => ({ id, name: id.toUpperCase(), color: E.COLORS[i], faction: 'iron', bot: id !== 'a', diff: 'medium' }));
const { state: s } = E.createGame({ mode: 'domination', mapSize: 'small', mapType: 'pangaea', spawns: 'random', fog: 'off', events: 'off' }, roster);
s.phase = 'play'; delete s.draft; s.turn = { idx: s.players.findIndex(p => p.id === 'a'), round: 5, stage: 'act', offer: [], rerolls: 0, crate: null, income: 0, deadline: 0 };
const hq = E.player(s, 'b').hq;
for (const id in s.units) if (s.units[id].hex === hq) delete s.units[id];
const nb = E.neighbors(hq).find(k => s.map.tiles[k] && E.isLandTile(s.map.tiles[k]));
s.map.tiles[nb].owner = 'a';
for (let i = 0; i < 10; i++) { const id = s.nextId++; s.units[id] = { id, owner: 'a', type: 'mauler', hex: nb, moved: false, fresh: false, stun: 0, mvBonus: 0 }; }
const r = E.applyAction(s, 'a', { a: 'move', from: nb, units: Object.values(s.units).filter(u => u.hex === nb).map(u => u.id), to: hq }, () => 0.5);
ok(r.ok, 'an army storms the enemy HQ');
for (let i = 0; i < 8 && E.player(s, 'b').alive; i++) { const c = E.current(s).id; E.applyAction(s, c, s.turn.stage === 'choose' ? { a: 'choose', pick: 'income' } : { a: 'end' }, () => 0.5); }
const t = s.map.tiles[hq];
ok(!E.player(s, 'b').alive, 'holding it through the siege knocks that commander out');
ok(t.owner === 'a' && (t.structs || []).some(x => x.type === 'fob' && x.owner === 'a') && !(t.structs || []).some(x => x.type === 'hq'), 'their HQ becomes your FOB (' + JSON.stringify((t.structs || []).map(x => x.type + ':' + x.owner)) + ')');
for (const id in s.units) if (s.units[id].hex === hq) delete s.units[id];   // (a full stack has no room for more)
ok(E.deployHexes(s, 'a', 'grunt').includes(hq), 'and you can deploy there');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
