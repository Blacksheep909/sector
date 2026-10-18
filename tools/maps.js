// Preview every map archetype as ASCII: node tools/maps.js [players]
const E = require('../shared/engine');
const nP = +(process.argv[2] || 4);
for (const arch of ['continent', 'twin', 'archipelago', 'inland', 'crescent', 'pangaea', 'ocean']) {
  const m = E.generateMap({ seed: (Math.random() * 1e9) >>> 0, nPlayers: nP, size: 'medium', archetype: arch });
  const ks = Object.keys(m.tiles).map(E.parse);
  const rs = ks.map(k => k[1]), cs = ks.map(k => k[0] + Math.floor(k[1] / 2));
  console.log('==', arch, '| land', m.landCount, '| tiles', ks.length);
  const ch = { water: '~', plains: '.', forest: 'f', hills: 'h', mountain: 'M' };
  for (let r = Math.min(...rs); r <= Math.max(...rs); r++) {
    let line = (r & 1) ? ' ' : '';
    for (let c = Math.min(...cs); c <= Math.max(...cs); c++) {
      const q = c - Math.floor(r / 2), k = q + ',' + r, t = m.tiles[k];
      line += (t ? (m.spawns.includes(k) ? 'H' : t.res ? '$' : (t.t === 'water' && t.deep ? '~' : t.t === 'water' ? '-' : ch[t.t])) : ' ') + ' ';
    }
    console.log(line);
  }
}
