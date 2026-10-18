// Measures how long the HUD takes to refresh and how fast repeated deploy clicks land. Needs: PORT=3041 SECTOR_DEV=1 SECTOR_FAST=1 node server.js
const { launch, sleep } = require('./cdp');
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3041', port: 9374, width: 1600, height: 900 });
  const { evalJS, waitFor } = b;
  await evalJS(`window.__errs=[]; addEventListener('error',e=>__errs.push(e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno)); true`);
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(700);
  for (let i = 0; i < 5; i++) { await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(120); }
  await evalJS(`SECTOR_DEBUG.send({t:'settings',settings:{mapSize:'huge',mapType:'continent'}}); true`); await sleep(300);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  for (let i = 0; i < 80; i++) { if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break; await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`); await sleep(600); }
  await waitFor(`SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you() && SECTOR_DEBUG.state().turn.stage==='act'`, 60000); await sleep(2500);
  const t = await evalJS(`(()=>{ const n=20, t0=performance.now(); for(let i=0;i<n;i++) SECTOR_DEBUG.refresh(); return ((performance.now()-t0)/n).toFixed(1) })()`);
  console.log('refreshAll ms:', t);
  console.log('breakdown:', await evalJS(`JSON.stringify(window.__refreshPerf||{})`));
  // spam three deploy clicks as fast as possible
  const r = await evalJS(`(async()=>{ const S=SECTOR_DEBUG.state(), me=S.players.find(p=>p.id===SECTOR_DEBUG.you()); const E=SectorEngine; const u=me.arsenal.find(x=>!E.isSea(x)); const n0=Object.values(S.units).filter(x=>x.owner===me.id).length; const ki=E.DECK_MAX?me.arsenal.indexOf(u):0; document.dispatchEvent(new KeyboardEvent('keydown',{key:String((ki+1)%10),bubbles:true})); await new Promise(r=>setTimeout(r,50)); const hexes=E.deployHexes(S,me.id,u); const t0=performance.now(); for(let i=0;i<3;i++){ SECTOR_DEBUG.click(hexes[0]); await new Promise(r=>setTimeout(r,60)); } while(Object.values(SECTOR_DEBUG.state().units).filter(x=>x.owner===me.id).length < n0+Math.min(3, Math.floor(me.cash/E.unitCost(me,u))) && performance.now()-t0<6000) await new Promise(r=>setTimeout(r,20)); return JSON.stringify({unit:u, cash:me.cash, ms:Math.round(performance.now()-t0), added:Object.values(SECTOR_DEBUG.state().units).filter(x=>x.owner===me.id).length-n0}) })()`);
  console.log('spam deploy:', r);
  console.log('after spam:', await evalJS('JSON.stringify(window.__refreshPerf)')); console.log('render perf:', await evalJS('JSON.stringify(Object.fromEntries(Object.entries(Render.perf).map(([k,v])=>[k,+v.toFixed(2)])))'));
  console.log('page errors:', await evalJS(`JSON.stringify(__errs.slice(0,5))`));
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
