// Screenshots common menu/overlay combinations to catch stacking bugs. Needs: PORT=3028 SECTOR_DEV=1 SECTOR_FAST=1 node server.js
const path = require('path');
const { launch, sleep } = require('./cdp');
const OUT = process.env.SHOTS || require('os').tmpdir();
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3028', port: 9357 });
  const { evalJS, waitFor, shot } = b;
  const snap = async n => { await sleep(500); await shot(path.join(OUT, 'ov-' + n + '.png')); };
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(800);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(300);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  for (let i = 0; i < 60; i++) { if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break; await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`); await sleep(700); }
  await waitFor(`SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you() && SECTOR_DEBUG.state().turn.stage==='act'`, 30000); await sleep(1500);
  const hover = sel => evalJS(`(()=>{ const e=document.querySelector('${sel}'); if(!e) return false; const r=e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true,clientX:r.left+20,clientY:r.top+20})); e.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:r.left+20,clientY:r.top+20})); e.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.left+20,clientY:r.top+20})); return true })()`);
  // 1 hand card hover zoom, then Esc menu on top
  await hover('#hand .card'); await sleep(900); await snap('1-zoom');
  await evalJS(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); true`); await snap('2-esc-over-zoom');
  // 3 card index from esc
  await evalJS(`document.querySelector('#escIndex').click(); true`); await snap('3-index');
  await evalJS(`document.querySelector('#index').hidden=true; true`);
  // 4 deck slot hover tip
  await hover('#deckBar .card, #hbUnits .card'); await sleep(700); await snap('4-slottip');
  // 5 trade panel
  await evalJS(`(()=>{ const t=document.querySelector('.pchip .trade, .trade-btn, [data-trade]'); if(t){ t.click(); return 'clicked'} return 'none' })()`).then(r => console.log('trade button:', r)); await snap('5-trade');
  await evalJS(`document.querySelector('#trade').hidden=true; true`);
  // 6 supply drop crate while hovering a hand card
  await hover('#hand .card');
  await evalJS(`(()=>{const c=[...document.querySelectorAll('#hand .card')].find(c=>c.dataset.id&&c.dataset.id.startsWith('drop_')); if(c) c.click(); return !!c})()`); await sleep(1800); await snap('6-crate-while-hover');
  // 7 server panel from esc during the crate
  await evalJS(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); true`); await snap('7-esc-over-crate');
  console.log('visible overlays:', await evalJS(`JSON.stringify(['#supply','#crate','#draft','#combat','#trade','#offerPop','#index','#rules','#modal','#escMenu','#hostPanel','#victory','#passCover','#tooltip','#slotTip','#cardZoom'].filter(s=>{const e=document.querySelector(s); return e && !e.hidden && getComputedStyle(e).display!=='none'}))`));
  // camera: park it, let the bot play a full turn, check it stayed put
  await evalJS(`document.querySelector('#escMenu').hidden=true; document.querySelector('#crate').hidden=true; true`);
  await waitFor(`SECTOR_DEBUG.state().turn.stage==='act' && SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you()`, 30000);
  await evalJS(`document.querySelector('#endBtn').click(); true`);
  await waitFor(`SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id!==SECTOR_DEBUG.you()`, 10000);
  await evalJS(`(()=>{ const S=SECTOR_DEBUG.state(); const k=Object.keys(S.map.tiles)[5]; Render.focus(k, 1.3); return 1 })()`); await sleep(1200);
  const before = await evalJS(`JSON.stringify([Math.round(Render.cam.tx), Math.round(Render.cam.ty)])`);
  await waitFor(`SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you()`, 40000);
  const during = await evalJS(`JSON.stringify([Math.round(Render.cam.tx), Math.round(Render.cam.ty)])`);
  console.log('camera before bot turn', before, '| right after it', during);
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
