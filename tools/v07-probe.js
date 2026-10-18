// Visual pass for v0.7 features. Needs: PORT=3042 SECTOR_DEV=1 SECTOR_FAST=1 node server.js ; FINAL=<finished game json>
const path = require('path'), fs = require('fs');
const { launch, sleep } = require('./cdp');
const OUT = process.env.SHOTS || require('os').tmpdir();
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3042', port: 9377, width: 1600, height: 900 });
  const { evalJS, waitFor, shot } = b;
  const snap = n => shot(path.join(OUT, 'v07-' + n + '.png'));
  await evalJS(`window.__errs=[]; addEventListener('error',e=>__errs.push(e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno)); true`);
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(800);
  for (let i = 0; i < 3; i++) { await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(150); }
  await evalJS(`SECTOR_DEBUG.send({t:'settings',settings:{mapType:'ocean',teams:'on'}}); true`); await sleep(500);
  await snap('0-lobby-teams');
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  for (let i = 0; i < 80; i++) { if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break; await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`); await sleep(600); }
  await waitFor(`SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you() && SECTOR_DEBUG.state().turn.stage==='act'`, 60000); await sleep(2000);
  await evalJS(`window.SECTOR_PAUSE=true; Render.fitMap(); true`); await sleep(1200); await snap('1-ocean-board');
  // oil rig owned by us + a NEXT TURN tag next to the HQ
  await evalJS(`(()=>{ const S=SECTOR_DEBUG.state(), me=SECTOR_DEBUG.you(); const hq=S.players.find(p=>p.id===me).hq; const E=SectorEngine;
    const rigs=Object.keys(S.map.tiles).filter(k=>S.map.tiles[k].t==='water'&&S.map.tiles[k].res).sort((a,b)=>E.dist(a,hq)-E.dist(b,hq));
    S.map.tiles[rigs[0]].owner=me; if (rigs[1]) S.map.tiles[rigs[1]].owner=S.players.find(p=>p.id!==me).id;
    const n=E.neighbors(hq).find(k=>S.map.tiles[k]&&E.isLandTile(S.map.tiles[k])&&!(S.map.tiles[k].structs||[]).length);
    if(n){ S.map.tiles[n].owner=me; S.map.tiles[n].structs=[{type:'fob',owner:me,lvl:1,lock:1}]; S.map.tiles[n].struct=S.map.tiles[n].structs[0]; }
    window.__rig=rigs[0]; SECTOR_DEBUG.refresh(); Render.focus(rigs[0], 2.2); })(); true`); await sleep(1500); await snap('2-rig-owned');
  await evalJS(`Render.focus(SECTOR_DEBUG.state().players.find(p=>p.id===SECTOR_DEBUG.you()).hq, 1.9); true`); await sleep(1300); await snap('3-next-turn-tag');
  await evalJS(`Render.fitMap(); Render.ov.troops=true; Render.invalidate(); true`); await sleep(1000); await snap('4-alt-troops');
  await evalJS(`Render.ov.troops=false; Render.invalidate(); true`);
  // the new cards in hand and deck
  await evalJS(`(()=>{ const S=SECTOR_DEBUG.state(), me=S.players.find(p=>p.id===SECTOR_DEBUG.you()); me.tactics=[{uid:9101,id:'tsar'},{uid:9102,id:'regime'},{uid:9103,id:'aegis'},{uid:9104,id:'spy'},{uid:9105,id:'quarry'}]; if(!me.arsenal.includes('carrier')) me.arsenal.push('carrier'); me.cash=40; SECTOR_DEBUG.refresh(); })(); true`); await sleep(1200); await snap('5-hand-mythics');
  await evalJS(`(()=>{ const c=[...document.querySelectorAll('#hand .card')].find(x=>x.classList.contains('r-mythic')); if(c) c.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); })(); true`); await sleep(900); await snap('6-mythic-hover');
  // orbital lance mid-strike
  await evalJS(`(()=>{ const S=SECTOR_DEBUG.state(); const k=Object.keys(S.units)[0]; const h=S.units[k].hex; Render.focus(h,1.6); setTimeout(()=>Render.lance(h,'#7ff3ff',1.4),900); })(); true`); await sleep(1500); await snap('7-lance');
  // war report from a finished game
  if (process.env.FINAL) {
    const fin = JSON.parse(fs.readFileSync(process.env.FINAL, 'utf8'));
    const pick = { seed: fin.seed, map: fin.map, players: fin.players, history: fin.history, heat: fin.heat, flips: fin.flips, bigBattle: fin.bigBattle, winner: fin.winner, units: fin.units, phase: 'over' };
    await evalJS(`(()=>{ const S=SECTOR_DEBUG.state(); Object.assign(S, ${JSON.stringify(pick)}); Render.setState(null); Render.setState(S); SECTOR_DEBUG.victoryFx(); })(); true`); await sleep(1800); await snap('8-victory');
    for (const t of ['heat', 'flips', 'inc', 'army', 'awards']) { await evalJS(`document.querySelector('[data-wr="${t}"]').click(); document.querySelector('#victory .vic').scrollTop=0; true`); await sleep(700); await snap('9-report-' + t); }
  }
  console.log('page errors:', await evalJS(`JSON.stringify(__errs.slice(0,8))`));
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
