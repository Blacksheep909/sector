// Checks v0.3 UI: pass & play covers, build bar, Supply Drop crate reveal centring, structure upgrades.
// Needs a fresh dev server:  PORT=3010 SECTOR_DEV=1 SECTOR_FAST=1 SECTOR_NO_OPEN=1 node server.js
const path = require('path');
const { launch, sleep } = require('./cdp');
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'sector-v3');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3010', port: 9339 });
  const { evalJS, waitFor, shot } = b;
  const log = [];
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(800);
  await evalJS(`document.querySelector('#addLocal').click(); true`); await sleep(300);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(500);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  // draft: count covers and duplicate reveal bars
  let covers = 0, dupBars = 0;
  for (let step = 0; step < 20; step++) {
    await waitFor(`!document.querySelector('#passCover').hidden || !!document.querySelector('#draft .reveal-all') || (SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play')`, 20000);
    if (await evalJS(`document.querySelectorAll('#draft .reveal-bar').length > 1`)) dupBars++;
    if (await evalJS(`!document.querySelector('#passCover').hidden`)) { covers++; await evalJS(`document.querySelector('#passGo').click(); true`); await sleep(500); continue; }
    if (await evalJS(`SECTOR_DEBUG.state().phase==='play'`)) break;
    await evalJS(`document.querySelector('#draft .reveal-all').click(); true`);
    await waitFor(`document.querySelectorAll('#draft .flip.open').length===3`, 20000); await sleep(300);
    await evalJS(`document.querySelector('#draft .flip.open').click(); true`); await sleep(1200);
  }
  log.push('draft covers: ' + covers + ', duplicate reveal bars seen: ' + dupBars);
  // first human turn
  await waitFor(`!document.querySelector('#passCover').hidden || (SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you())`, 30000);
  if (await evalJS(`!document.querySelector('#passCover').hidden`)) { covers++; log.push('turn cover for ' + await evalJS(`document.querySelector('.pass-name').textContent`)); await evalJS(`document.querySelector('#passGo').click(); true`); await sleep(800); }
  await sleep(1500);
  await shot(path.join(OUT, 'hud.png'));
  // build bar size + brightness
  log.push('build tiles: ' + await evalJS(`JSON.stringify([...document.querySelectorAll('#hbBuild .slot')].slice(0,3).map(s=>{const r=s.getBoundingClientRect(); return Math.round(r.width)+'x'+Math.round(r.height)+' '+getComputedStyle(s).opacity}))`));
  // upgrade: fortify HQ if affordable
  const me = await evalJS(`JSON.stringify((()=>{const S=SECTOR_DEBUG.state(); const p=S.players.find(p=>p.id===SECTOR_DEBUG.you()); return {cash:p.cash, cost:SectorEngine.buildCost(S,p,'hq',p.hq)}})())`);
  log.push('hq fortify ' + me);
  // play the starting Supply Drop and watch the crate
  const played = await evalJS(`(()=>{const c=[...document.querySelectorAll('#hand .card')].find(c=>c.dataset.id&&c.dataset.id.startsWith('drop_')); if(!c) return false; c.click(); return true})()`);
  log.push('supply drop played: ' + played);
  if (played && await waitFor(`!!document.querySelector('#crate .reveal-all')`, 20000)) {
    await sleep(500); await shot(path.join(OUT, 'crate-backs.png'));
    // flip each card and measure how close to centre it gets mid-flight
    const n = await evalJS(`document.querySelectorAll('#crate .flip').length`);
    for (let i = 0; i < n; i++) {
      await evalJS(`document.querySelectorAll('#crate .flip')[${i}].dispatchEvent(new MouseEvent('click',{bubbles:true})); true`);
      let best = 1e9;
      for (let t = 0; t < 20; t++) { await sleep(90); const d = await evalJS(`(()=>{const r=document.querySelectorAll('#crate .flip')[${i}].getBoundingClientRect(); return Math.round(Math.abs(r.left+r.width/2-innerWidth/2))})()`); best = Math.min(best, d); }
      const rar = await evalJS(`document.querySelectorAll('#crate .flip')[${i}].className.match(/r-(\\w+)/)[1]`);
      log.push(`card ${i} (${rar}) closest to centre: ${best}px`);
      await sleep(2600);
    }
    await shot(path.join(OUT, 'crate-open.png'));
    await evalJS(`document.querySelector('#crate .flip.open').click(); true`); await sleep(1500);
  }
  console.log(log.join('\n'));
  console.log('shots in', OUT);
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
