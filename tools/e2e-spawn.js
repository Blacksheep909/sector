// Pick-your-HQ check. Needs: PORT=3013 SECTOR_DEV=1 SECTOR_FAST=1 SECTOR_NO_OPEN=1 node server.js
const path = require('path');
const { launch, sleep } = require('./cdp');
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'sector-spawn');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3013', port: 9343 });
  const { evalJS, waitFor, shot } = b;
  await evalJS(`window.__errs=[]; addEventListener('error',e=>__errs.push(e.message+' @'+e.filename+':'+e.lineno)); true`);
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(800);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(300);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(300);
  await evalJS(`SECTOR_DEBUG.send({t:'settings',settings:{spawns:'pick',mapSize:'large'}}); true`); await sleep(400);
  console.log('lobby select shows:', await evalJS(`document.querySelector('#setSpawns').value`));
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  console.log('spawn phase:', await waitFor(`SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='spawn'`, 10000));
  console.log('my pick:', await waitFor(`SECTOR_DEBUG.state().phase==='spawn' && SECTOR_DEBUG.state().spawn.order[SECTOR_DEBUG.state().spawn.i]===SECTOR_DEBUG.you()`, 20000));
  await sleep(600);
  console.log('bar:', await evalJS(`document.querySelector('#spawnBar') && document.querySelector('#spawnBar').textContent`));
  await shot(path.join(OUT, 'spawn-pick.png'));
  const pick = await evalJS(`(()=>{const c=SectorEngine.spawnChoices(SECTOR_DEBUG.state()); const k=c[Math.floor(c.length/2)]; SECTOR_DEBUG.click(k); return k})()`);
  console.log('picked', pick);
  console.log('draft reached:', await waitFor(`SECTOR_DEBUG.state().phase!=='spawn'`, 20000));
  const me = JSON.parse(await evalJS(`JSON.stringify(SECTOR_DEBUG.state().players.map(p=>[p.name,p.hq]))`));
  console.log('hqs', JSON.stringify(me), 'my hq is pick:', me.find(x => x[0] === 'Alice')[1] === pick);
  for (let i = 0; i < 80; i++) {
    if (await evalJS(`SECTOR_DEBUG.state().phase==='play'`)) break;
    await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`);
    await sleep(700);
  }
  await sleep(1500);
  await evalJS(`Render.fitMap(); true`); await sleep(800);
  await shot(path.join(OUT, 'board-large.png'));
  await evalJS(`(()=>{const S=SECTOR_DEBUG.state(); const k=Object.keys(S.map.tiles).find(k=>S.map.tiles[k].poi); Render.focus(k, 1.6); return k})()`); await sleep(1200);
  await shot(path.join(OUT, 'poi-close.png'));
  console.log('page errors:', await evalJS(`JSON.stringify(__errs.slice(0,5))`));
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
