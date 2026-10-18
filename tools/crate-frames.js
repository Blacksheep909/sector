// Captures the Supply Drop opening frame by frame. Needs: PORT=3025 SECTOR_DEV=1 SECTOR_FAST=1 node server.js
const path = require('path');
const { launch, sleep } = require('./cdp');
const OUT = process.env.SHOTS || require('os').tmpdir();
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3025', port: 9355 });
  const { evalJS, waitFor, shot } = b;
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(800);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(300);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  for (let i = 0; i < 60; i++) { if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break; await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`); await sleep(700); }
  await waitFor(`SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you() && SECTOR_DEBUG.state().turn.stage==='act'`, 30000);
  await sleep(1500);
  await evalJS(`(()=>{const c=[...document.querySelectorAll('#hand .card')].find(c=>c.dataset.id&&c.dataset.id.startsWith('drop_')); c.click(); return true})()`);
  const t0 = Date.now(); const marks = (process.env.FRAMES || '800,1800,2600,3200,3700,4200,4700,5300,6500').split(',').map(Number);
  for (const m of marks) {
    const wait = m - (Date.now() - t0); if (wait > 0) await sleep(wait);
    if (m === +(process.env.CLICK_AT || 3300)) await evalJS(`(()=>{const c=document.querySelector('#crate .crate3d, #crate .chest'); if(c) c.click(); return 1})()`);
    await shot(path.join(OUT, 'crate-' + m + '.png'));
  }
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
