// Real mouse clicks on the map (Chrome's own input pipeline, not element.click()): every hex on screen must select when
// clicked, including with a few pixels of hand wobble, and no see-through HUD box may swallow clicks meant for the map.
// node tools/test-clicks.js
const { spawn } = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');
const { launch, sleep } = require('./cdp');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clk-'));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: 3088, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_DEV: '1', SECTOR_NO_UPDATE: '1', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') }, stdio: 'ignore' });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  await sleep(1500);
  const b = await launch({ browser: '/opt/pw-browsers/chromium', url: 'http://localhost:3088', width: 1280, height: 760, port: 9488 });
  await sleep(2500);
  await b.evalJS(`document.querySelector('#createBtn').click(); true`); await sleep(1000);
  await b.evalJS(`SECTOR_DEBUG.send({t:'addBot'}); SECTOR_DEBUG.send({t:'settings', settings:{spawns:'random', mapSize:'small', fog:'off'}}); true`); await sleep(600);
  await b.evalJS(`SECTOR_DEBUG.send({t:'start'}); true`); await sleep(1500);
  for (let i = 0; i < 30; i++) { const st = JSON.parse(await b.evalJS(`JSON.stringify((()=>{const S=SECTOR_DEBUG.state(); return {ph:S.phase, mine:S.phase==='draft'&&!S.draft.picked[SECTOR_DEBUG.you()]}})())`)); if (st.ph === 'play') break; if (st.mine) await b.evalJS(`SECTOR_DEBUG.send({t:'act', action:{a:'draftPick', idx:0}, seq: 9e6+${i}}); true`); await sleep(600); }
  await sleep(3000);
  // 1. see-through boxes over the map: a point under a HUD element that paints nothing there (no background, border, image or text)
  const holes = JSON.parse(await b.evalJS(`JSON.stringify((()=>{
    const out = {}; const paints = e => { const cs = getComputedStyle(e); const bg = cs.backgroundColor, a = bg.startsWith('rgba') ? +bg.split(',')[3].replace(')', '') : bg === 'transparent' ? 0 : 1; return a > 0.05 || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 && cs.borderTopColor !== 'rgba(0, 0, 0, 0)' || ['IMG','CANVAS','BUTTON','INPUT','svg'].includes(e.tagName) || [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); };
    // inside a painted panel is fine (you can see the panel); a hole is only a box with no painted ancestor short of the HUD
    const inPanel = e => { for (let x = e.parentElement; x && !['hud','dock','bottom','topbar','leftCol','rightCol','centerStack'].includes(x.id); x = x.parentElement) if (paints(x) && !['hand','players'].includes(x.id)) return true; return false; };
    for (let y = 8; y < innerHeight; y += 16) for (let x = 8; x < innerWidth; x += 16) { const e = document.elementFromPoint(x, y); if (!e || e.id === 'map' || paints(e) || inPanel(e)) continue; const key = e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]; out[key] = (out[key] || 0) + 1; }
    return out; })())`));
  const holePts = Object.values(holes).reduce((a, n) => a + n, 0);
  ok(holePts <= 12, 'no see-through HUD box covers the map (' + holePts + ' grid points' + (holePts ? ': ' + JSON.stringify(holes) : '') + ')');
  // 2. click every hex the map shows, with and without a little wobble between press and release
  const mouse = (type, x, y, buttons, button = 'left') => b.cmd('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: 1 });
  const hexes = JSON.parse(await b.evalJS(`JSON.stringify(Object.keys(SECTOR_DEBUG.state().map.tiles).map(k => [k, ...Render.screenOf(k)]).filter(([k,x,y]) => x > 20 && y > 20 && x < innerWidth-20 && y < innerHeight-20 && document.elementFromPoint(x,y) && document.elementFromPoint(x,y).id === 'map'))`));
  let right = 0, wrong = [], skipped = 0;
  for (const [i, [k, x, y]] of hexes.entries()) {
    const w = i % 3 === 0 ? 0 : i % 3 === 1 ? 3 : 5;   // hand wobble in px
    // what's under the pointer right now (the hand fans out as the mouse passes, so check at the moment of the click)
    await mouse('mouseMoved', x, y, 0); await sleep(30);
    if (!(await b.evalJS(`(()=>{ const e = document.elementFromPoint(${x}, ${y}); return !!e && e.id === 'map' && !document.querySelector('#crate:not([hidden]), #draft:not([hidden]), #supply:not([hidden])'); })()`))) { skipped++; continue; }
    await mouse('mouseMoved', x, y, 0); await mouse('mousePressed', x, y, 1); await mouse('mouseMoved', x + w, y + w * 0.6, 1); await mouse('mouseReleased', x + w, y + w * 0.6, 0); await sleep(40);
    const got = await b.evalJS(`Render.ov.selected`);
    if (got === k) right++; else wrong.push([k, got, w]);
    await mouse('mousePressed', x, y, 2, 'right'); await mouse('mouseReleased', x, y, 0, 'right'); await sleep(25);
  }
  ok(right > 90 && right === hexes.length - skipped, `every hex selects on a real click: ${right}/${hexes.length - skipped}` + (wrong.length ? ' missed ' + JSON.stringify(wrong.slice(0, 6)) : ''));
  console.log(fails ? fails + ' FAILED' : 'all passed');
  b.close(); srv.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
