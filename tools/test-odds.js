// The odds the client shows (combatCalc on the player's fogged view) must match the server's (the real state) for every
// attack and shot on offer, sampled through bot games with fog on: node tools/test-odds.js
const E = require('../shared/engine'); const { botStep, draftStep } = require('../shared/bot');
const facs = Object.keys(E.FACTIONS), diffs = {}, samples = { melee: 0, fire: 0 }; let shown = 0;
const note = (kind, d, ex) => { const k = kind + ': ' + d; if (!diffs[k]) diffs[k] = { n: 0, ex }; diffs[k].n++; };
for (let g = 0; g < 3; g++) {
  const roster = Array.from({ length: 4 }, (_, i) => ({ id: 'p' + i, name: 'B' + i, color: E.COLORS[i], faction: facs[(i + g) % facs.length], bot: true }));
  const { state: s } = E.createGame({ mode: 'domination', mapSize: 'medium', fog: 'on', maxRounds: 30, theme: 'random' }, roster);
  while (s.phase === 'draft') for (const p of s.players) { const a = draftStep(s, p.id); if (a) E.applyAction(s, p.id, a); }
  let actions = 0;
  while (s.phase === 'play' && actions < 20000) {
    const p = E.current(s), mem = {}; let n = 0;
    while (s.phase === 'play' && E.current(s).id === p.id) {
      if (s.turn.stage === 'act' && Math.random() < 0.15) {
        const ds = E.view(s, p.id), idx = E.buildIndex(ds), ridx = E.buildIndex(s);
        const stacks = {}; for (const u of Object.values(ds.units)) if (u.owner === p.id && E.canAct(ds, u)) (stacks[u.hex] = stacks[u.hex] || []).push(u.id);
        for (const hex in stacks) {
          const ids = stacks[hex], r = E.reachable(ds, p.id, ids, hex, idx);
          for (const k in r) if (r[k].kind === 'attack') {
            const st = r[k].from || hex;
            const a = E.combatCalc(ds, p.id, ids.map(id => ds.units[id]), [hex], k, false, idx), b = E.combatCalc(s, p.id, ids.map(id => s.units[id]), [hex], k, false, ridx);
            samples.melee++; if (Math.abs(a.winProb - b.winProb) > 0.005) { const da = a.def.bonuses.map(x => x.label + (x.chips || '') + '/' + (x.mult || '')).join(','), db = b.def.bonuses.map(x => x.label + (x.chips || '') + '/' + (x.mult || '')).join(','); const aa = a.att.bonuses.map(x => x.label + (x.chips || '') + '/' + (x.mult || '')).join(','), ab = b.att.bonuses.map(x => x.label + (x.chips || '') + '/' + (x.mult || '')).join(',');
              note('melee', (a.att.chips !== b.att.chips ? 'attChips ' : '') + (a.def.chips !== b.def.chips ? 'defChips ' : '') + (aa !== ab ? 'attBon ' : '') + (da !== db ? 'defBon' : ''), { view: [a.att.chips, a.def.chips, aa, da, a.defenders.length], real: [b.att.chips, b.def.chips, ab, db, b.defenders.length], fog: ds.map.tiles[k].fog }); }
          }
          const guns = ids.filter(id => E.UNITS[ds.units[id].type].range);
          if (guns.length) for (const k of E.rangedTargets(ds, p.id, guns, hex, idx)) {
            const a = E.combatCalc(ds, p.id, guns.map(id => ds.units[id]), hex, k, true, idx), b = E.combatCalc(s, p.id, guns.map(id => s.units[id]), hex, k, true, ridx);
            const realTargets = E.rangedTargets(s, p.id, guns, hex, ridx);
            samples.fire++; if (!realTargets.includes(k)) note('fire', 'target not valid on server', { fog: ds.map.tiles[k].fog });
            else if (Math.abs(a.winProb - b.winProb) > 0.005) note('fire', (a.def.chips !== b.def.chips ? 'defChips ' : '') + (a.att.chips !== b.att.chips ? 'attChips' : ''), { view: [a.att.chips, a.def.chips, a.defenders.length], real: [b.att.chips, b.def.chips, b.defenders.length], fog: ds.map.tiles[k].fog });
          }
        }
      }
      let a = botStep(s, p.id, mem); if (++n > 90) a = { a: 'end' };
      E.applyAction(s, p.id, a); actions++;
    }
  }
}
for (const [k, v] of Object.entries(diffs).sort((a, b) => b[1].n - a[1].n)) console.log('FAIL', v.n, k, JSON.stringify(v.ex).slice(0, 400));
const bad = Object.keys(diffs).length;
console.log(bad ? bad + ' kinds of mismatch FAILED' : `ok   odds match in ${samples.melee} attacks and ${samples.fire} shots\nall passed`);
process.exit(bad ? 1 : 0);
