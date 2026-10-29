// Renders the SECTOR emblem in headless Edge and writes assets/icon.ico (exe + window icon) and public/icon.png.
// Run when the logo changes: node tools/make-icon.js   (the outputs are committed, so CI doesn't need a browser)
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('./cdp');
const root = path.join(__dirname, '..');

const page = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap" rel="stylesheet"></head><body>
<script>
function hex(c, cx, cy, r) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 90); c.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } c.closePath(); }
function emblem(px) {
  const cv = document.createElement('canvas'); cv.width = cv.height = px; const c = cv.getContext('2d');
  const s = px / 256, cx = px / 2, cy = px / 2;
  // drop shadow + red rim + dark face
  hex(c, cx, cy + 6 * s, 124 * s); c.fillStyle = '#000'; c.fill();
  hex(c, cx, cy, 124 * s); c.fillStyle = '#b52b38'; c.fill();
  hex(c, cx, cy - 3 * s, 118 * s); c.fillStyle = '#ff4f5e'; c.fill();
  hex(c, cx, cy, 100 * s); const g = c.createLinearGradient(0, cy - 100 * s, 0, cy + 100 * s); g.addColorStop(0, '#22303c'); g.addColorStop(1, '#0d141a'); c.fillStyle = g; c.fill();
  if (px >= 48) { c.lineWidth = 5 * s; c.strokeStyle = '#ffc53d'; hex(c, cx, cy, 88 * s); c.stroke(); }
  if (px >= 64) { c.globalAlpha = 0.12; c.fillStyle = '#fff'; for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const hx = cx + (x + (y & 1) * 0.5) * 30 * s, hy = cy + y * 26 * s; if (Math.hypot(hx - cx, hy - cy) < 70 * s) { hex(c, hx, hy, 12 * s); c.fill(); } } c.globalAlpha = 1; }
  // the S
  c.font = (px <= 24 ? 'bold ' : '') + Math.round(150 * s) + 'px "Black Ops One", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#000'; c.fillText('S', cx, cy + 12 * s);
  c.fillStyle = '#b52b38'; c.fillText('S', cx, cy + 7 * s);
  c.fillStyle = '#f6f3e8'; c.fillText('S', cx, cy + 1 * s);
  return cv.toDataURL('image/png').split(',')[1];
}
window.renderAll = async sizes => { await document.fonts.load('150px "Black Ops One"'); return sizes.map(emblem); };
// app icons (phones, home screens): the emblem on a full square of the game's dark blue. pad = how much of the square it fills
// (a maskable icon keeps it inside the middle 80%, since Android may crop it to a circle or a squircle)
window.appIcon = async (px, fill) => {
  await document.fonts.load('150px "Black Ops One"');
  const cv = document.createElement('canvas'); cv.width = cv.height = px; const c = cv.getContext('2d');
  const g = c.createRadialGradient(px / 2, px * 0.42, px * 0.05, px / 2, px / 2, px * 0.75); g.addColorStop(0, '#1d2b38'); g.addColorStop(1, '#070b0f');
  c.fillStyle = g; c.fillRect(0, 0, px, px);
  const e = new Image(); e.src = 'data:image/png;base64,' + emblem(512); await e.decode();
  const w = px * fill; c.drawImage(e, (px - w) / 2, (px - w) / 2, w, w);
  return cv.toDataURL('image/png').split(',')[1];
};
</script></body></html>`;

(async () => {
  const b = await launch({ browser: process.env.SECTOR_BROWSER, url: 'data:text/html;base64,' + Buffer.from(page).toString('base64'), port: 9350 });
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = (await b.evalJS(`renderAll(${JSON.stringify(sizes)})`)).map(x => Buffer.from(x, 'base64'));
  const app = {};
  for (const [name, px, fill] of [['app-192.png', 192, 0.84], ['app-512.png', 512, 0.84], ['app-maskable-512.png', 512, 0.62], ['apple-touch-icon.png', 180, 0.8]])
    app[name] = Buffer.from(await b.evalJS(`appIcon(${px}, ${fill})`), 'base64');
  b.close();
  for (const name in app) fs.writeFileSync(path.join(root, 'public', name), app[name]);
  // ICO: header + directory + PNG payloads (PNG entries are fine on Windows Vista and later)
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  const dir = Buffer.alloc(16 * sizes.length); let off = 6 + dir.length;
  sizes.forEach((sz, i) => {
    const e = i * 16; dir[e] = sz >= 256 ? 0 : sz; dir[e + 1] = sz >= 256 ? 0 : sz; dir[e + 2] = 0; dir[e + 3] = 0;
    dir.writeUInt16LE(1, e + 4); dir.writeUInt16LE(32, e + 6); dir.writeUInt32LE(pngs[i].length, e + 8); dir.writeUInt32LE(off, e + 12); off += pngs[i].length;
  });
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'icon.ico'), Buffer.concat([head, dir, ...pngs]));
  fs.writeFileSync(path.join(root, 'public', 'icon.png'), pngs[sizes.indexOf(128)]);
  fs.writeFileSync(path.join(root, 'assets', 'icon-256.png'), pngs[sizes.indexOf(256)]);
  console.log('wrote assets/icon.ico, assets/icon-256.png, public/icon.png and the app icons (public/app-*.png, apple-touch-icon.png)');
})().catch(e => { console.error(e); process.exit(1); });
