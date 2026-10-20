// Records a card reveal (Cards.demoReveal) frame by frame: node tools/record-reveal.js <outDir> [ids]   (SECTOR_BROWSER, SECTOR_URL)
const { launch, sleep } = require('./cdp');
const fs = require('fs'), path = require('path');
(async () => {
  const [out, ids = 'grunt,seraph,skitter'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3013', port: 9395, width: 1280, height: 800 });
  await b.waitFor(`typeof Cards !== 'undefined'`); await sleep(500);
  await b.evalJS(`(()=>{ const sl = Cards.demoReveal(${JSON.stringify(ids.split(','))}); setTimeout(() => sl.find(s => s.d.rarity === 'legendary' || s.d.rarity === 'mythic')?.flip.click(), 1400); })(); true`);
  const frames = [], end = Date.now() + (+process.env.MS || 5500);
  while (Date.now() < end) { const r = await b.cmd('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); frames.push(r.result.data); }
  frames.forEach((f, i) => fs.writeFileSync(path.join(out, String(i).padStart(4, '0') + '.jpg'), Buffer.from(f, 'base64')));
  console.log(frames.length, 'frames'); b.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
