// Contact sheet of unit icons and card art, drawn in the real client page.
// Needs a running server:  node tools/icon-sheet.js <browser> <out.png> [ids,...]   (SECTOR_URL, default http://localhost:3013)
const { launch, sleep } = require('./cdp');
(async () => {
  const [browser, out, list] = process.argv.slice(2);
  const ids = (list || 'wren,ravager,stormcrow,banshee,valkyrie,seraph,phantom,warden,hornet,mauler,hellcat,goliath,leviathan,titan,scorpion,bulwark,wraith,skyguard,jackal,skitter,coyote,hailstorm,sentinel,basilisk').split(',');
  const b = await launch({ browser, url: process.env.SECTOR_URL || 'http://localhost:3013', port: 9360, width: 1560, height: Math.ceil(ids.length / 6) * 300 });
  await b.evalJS(`(async () => {
    const ids = ${JSON.stringify(ids)}, cols = 6, W = 260, H = 300, cv = document.createElement('canvas'); cv.width = cols * W; cv.height = Math.ceil(ids.length / cols) * H;
    Object.assign(cv.style, { position: 'fixed', left: 0, top: 0, zIndex: 99999, background: '#141c24' }); document.body.appendChild(cv);
    const c = cv.getContext('2d'); c.fillStyle = '#141c24'; c.fillRect(0, 0, cv.width, cv.height); c.font = '600 18px sans-serif'; c.textAlign = 'center';
    for (let i = 0; i < ids.length; i++) { const id = ids[i], x = (i % cols) * W, y = Math.floor(i / cols) * H;
      const img = new Image(); await new Promise(r => { img.onload = r; img.onerror = r; img.src = Art.cardArt(id); }); c.drawImage(img, x + 8, y + 10, 160, 220);
      Art.drawIcon(c, 'unit', id, x + 215, y + 60, 38, '#e9edf2'); Art.drawIcon(c, 'unit', id, x + 215, y + 160, 20, '#ff4f5e');
      c.fillStyle = '#fff'; c.fillText(id, x + W / 2, y + 280); }
    return true; })()`);
  await sleep(500); await b.shot(out); b.close(); process.exit(0);
})();
