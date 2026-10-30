// Card layout audit: renders every card in every place cards are shown (hand, deploy bar, draft, supply drop, store packs,
// zoom, index, black market, locker) in every version, and checks nothing runs off the card: the description and stats
// must end inside the card, and names must fit across it. node tools/card-audit.js  (starts its own server on 3017)
// SHOTS=dir also saves a picture of each place, for a look by eye.
const { spawn } = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');
const { launch, sleep } = require('./cdp');
const PORT = 3017, U = 'http://localhost:' + PORT;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sector-cards-'));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_NO_UPDATE: '1', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') }, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
// where cards go: the wrapping markup (cards go in the innermost element) and options for Cards.make
const PLACES = [
  ['plain', '<div>', {}],
  ['hand', '<div id="dock"><div id="bottom"><div id="hand">', {}],
  ['deploy bar', '<div id="hbUnits">', {}],
  ['draft', '<div class="offer">', {}],
  ['supply drop', '<div id="supply"><div class="cr-cards"><div class="flip open">', { front: true }],
  ['store pack', '<div id="crate"><div class="cr-cards"><div class="flip open">', { front: true }],
  ['reveal', '<div class="offer"><div class="flip open">', { front: true }],
  ['zoom', '<div id="cardZoom" style="position:static">', { zoomed: true }],
  ['index', '<div class="ix-grid">', {}],
  ['market', '<div class="mk-slot">', {}],
  ['upgrade', '<div class="offer">', { level: 2, upFrom: 1 }],
];
(async () => {
  await sleep(900);
  const b = await launch({ browser: process.env.SECTOR_BROWSER || '/opt/pw-browsers/chromium', url: U, width: 1600, height: 900, port: 9391 });
  const { evalJS } = b; await sleep(1800);
  const variants = process.env.STD ? [0] : [0, 'worn', 'foil', 'gilded', 'blackout', 'celestial'];
  let problems = 0;
  for (const [name, wrap, o] of PLACES) for (const v of variants) {
    const r = JSON.parse(await evalJS(`(async ()=>{ const E = SectorEngine;
      document.querySelectorAll('#__ca').forEach(e => e.remove());
      const host = document.createElement('div'); host.id = '__ca'; host.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;background:#0b1118;display:flex;flex-wrap:wrap;gap:14px;padding:14px;align-content:flex-start';
      document.body.appendChild(host);
      const ids = [...Object.keys(E.UNITS), ...Object.keys(E.TACTICS)];
      const o = ${JSON.stringify(o)}, v = ${JSON.stringify(v)};
      const cards = [];
      for (const id of ids) {
        if (v && !E.UNITS[id]) continue;   // card versions are for units only
        const w = document.createElement('div'); w.innerHTML = ${JSON.stringify(wrap)}; let inner = w; while (inner.firstElementChild) inner = inner.firstElementChild;
        const c = Cards.make(id, { variant: v, level: o.level, upFrom: o.upFrom, full: o.zoomed });
        if (o.front) { c.classList.add('cfront'); inner.classList.add('r-' + E.cardDef(id).rarity); }
        if (o.zoomed) c.classList.add('zoomed');
        c.style.animation = 'none'; inner.appendChild(c); host.appendChild(w.firstElementChild); cards.push([id, c]);
      }
      await document.fonts.ready; await new Promise(r => setTimeout(r, 900));
      const out = [];
      for (const [id, c] of cards) {
        const ci = c.querySelector('.ci'), R = ci.getBoundingClientRect(), cs = getComputedStyle(ci), pad = parseFloat(cs.paddingBottom) || 0;
        if (R.height < 10) continue;
        const sc = R.height / ci.offsetHeight || 1;
        for (const sel of ['.c-desc', '.c-stats', '.c-type', '.c-up']) {
          const e = ci.querySelector(sel); if (!e || getComputedStyle(e).display === 'none') continue;
          const r = e.getBoundingClientRect(); if (!r.height) continue;
          // a line of text that ends below the card's edge (less a sliver) is cut off
          if (r.bottom > R.bottom - 1) out.push(id + ' ' + sel + ' runs ' + Math.round((r.bottom - R.bottom) / sc) + 'px off the bottom');
          else if (sel === '.c-desc' && e.scrollHeight > e.clientHeight + 2) out.push(id + ' description cut off (' + e.scrollHeight + ' > ' + e.clientHeight + 'px, at ' + getComputedStyle(e).fontSize + ')');
        }
        const t = ci.querySelector('.c-type'); if (t && getComputedStyle(t).display !== 'none' && t.scrollWidth > t.clientWidth + 1) out.push(id + ' type line too wide (' + t.scrollWidth + ' > ' + t.clientWidth + ')');
        const n = ci.querySelector('.c-name'); if (n && n.scrollWidth > n.clientWidth + 2) out.push(id + ' name too wide (' + n.scrollWidth + ' > ' + n.clientWidth + ')');
      }
      return JSON.stringify({ n: cards.length, out });
    })()`));
    const bad = r.out.length; problems += bad;
    console.log((bad ? 'PROBLEM ' : 'ok      ') + name + ' · ' + (v || 'standard') + ' · ' + r.n + ' cards' + (bad ? '\n          ' + r.out.join('\n          ') : ''));
    if (process.env.SHOTS && (v === 0 || v === 'celestial')) await b.shot(path.join(process.env.SHOTS, 'cards-' + name.replace(/ /g, '-') + '-' + (v || 'std') + '.png'));
  }
  console.log(problems ? problems + ' problems' : 'no problems');
  b.close(); srv.kill(); process.exit(problems ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
