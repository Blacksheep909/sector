// Visual pass for v0.6 features. Needs: PORT=3037 SECTOR_DEV=1 SECTOR_FAST=1 node server.js
const path = require('path');
const { launch, sleep } = require('./cdp');
const OUT = process.env.SHOTS || require('os').tmpdir();
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3037', port: 9371 });
  const { evalJS, waitFor, shot } = b;
  const snap = n => shot(path.join(OUT, 'v06-' + n + '.png'));
  await evalJS(`window.__errs=[]; addEventListener('error',e=>__errs.push(e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno)); true`);
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(800);
  for (let i = 0; i < 3; i++) { await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(150); }
  await evalJS(`SECTOR_DEBUG.send({t:'settings',settings:{fog:'on',events:'on',timer:'90',mapType:'random'}}); true`); await sleep(400);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  await sleep(1500); await snap('1-reel-spin');
  await sleep(2200); await snap('2-reel-land');
  for (let i = 0; i < 60; i++) { if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break; await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`); await sleep(600); }
  await waitFor(`SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you() && SECTOR_DEBUG.state().turn.stage==='act'`, 40000); await sleep(1500);
  await evalJS(`Render.fitMap(); true`); await sleep(800); await snap('3-fog-board');
  // undo: move a stack one hex
  console.log('move:', await evalJS(`(()=>{ const S=SECTOR_DEBUG.state(), me=SECTOR_DEBUG.you(), E=SectorEngine; const u=Object.values(S.units).find(u=>u.owner===me&&E.canAct(S,u)); if(!u) return 'no unit'; const re=E.reachable(S,me,[u.id],u.hex); const to=Object.keys(re).find(k=>re[k].kind==='move'||re[k].kind==='capture'); SECTOR_DEBUG.act({a:'move',units:[u.id],from:u.hex,to}); return to })()`));
  await sleep(1800); console.log('undo button visible:', await evalJS(`!document.querySelector('#undoBtn').hidden`));
  // alliance with the first bot
  await evalJS(`(()=>{ const S=SECTOR_DEBUG.state(); const o=S.players.find(p=>p.id!==SECTOR_DEBUG.you()); SECTOR_DEBUG.act({a:'allyOffer',to:o.id}); return 1 })()`); await sleep(3500);
  console.log('allies:', await evalJS(`JSON.stringify(SECTOR_DEBUG.state().allies||[])`));
  // weather: show a storm on the client
  await evalJS(`window.SECTOR_PAUSE=true; SECTOR_DEBUG.state().weather={id:'storm',round:3}; SECTOR_DEBUG.refresh(); true`); await sleep(900);
  await snap('4-hud-storm-ally-undo-clock');
  await evalJS(`SECTOR_DEBUG.state().weather={id:'blizzard',round:3}; SECTOR_DEBUG.refresh(); true`); await sleep(700); await snap('5-blizzard');
  // canyon and highlands close up
  await evalJS(`SECTOR_DEBUG.state().weather=null; SECTOR_DEBUG.refresh(); (()=>{ const S=SECTOR_DEBUG.state(); const k=Object.keys(S.map.tiles).find(k=>S.map.tiles[k].t==='canyon' && !S.map.tiles[k].fog) || Object.keys(S.map.tiles).find(k=>S.map.tiles[k].t==='canyon') || Object.keys(S.map.tiles).find(k=>S.map.tiles[k].t==='hills'); Render.focus(k, 2.3); })(); true`); await sleep(1200); await snap('6-terrain-close');
  // victory with a synthetic history
  await evalJS(`(()=>{ const S=SECTOR_DEBUG.state(); const ids=S.players.map(p=>p.id); S.history=[]; for(let r=1;r<=24;r++){ const c={}; ids.forEach((id,i)=>{ c[id]=Math.max(0, Math.round(8 + 10*Math.sin(r/4+i*1.7) + (i===0? r*0.9 : i===2 ? (r<12? r*1.2 : 26-r) : 3))); }); S.history.push({r,c}); } S.phase='over'; S.winner={pid:ids[0], reason:'is the last commander standing'}; SECTOR_DEBUG.victoryFx(); })(); true`); await sleep(1200); await snap('7-victory');
  console.log('page errors:', await evalJS(`JSON.stringify(__errs.slice(0,5))`));
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
