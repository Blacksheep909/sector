// Measures renderer cost per frame (JS time) on a big mid-game board. Needs: PORT=3040 SECTOR_DEV=1 SECTOR_FAST=1 node server.js
const { launch, sleep } = require('./cdp');
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3040', port: 9373, width: 1600, height: 900 });
  const { evalJS } = b;
  await evalJS(`document.querySelector('#nameIn').value='Watcher'; document.querySelector('#joinBtn').click(); true`); await sleep(700);
  for (let i = 0; i < 7; i++) { await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(120); }
  await evalJS(`SECTOR_DEBUG.send({t:'settings',settings:{mapSize:'huge',mapType:'continent',fog:'${process.env.FOG || 'off'}'}}); true`); await sleep(300);
  await evalJS(`[...document.querySelectorAll('.specbtn')].find(b=>b.closest('.prow').textContent.includes('YOU')).click(); true`); await sleep(300);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  await sleep(+(process.env.WAIT || 70000));
  await evalJS(`window.SECTOR_PAUSE=true; Render.fitMap(); true`); await sleep(3000);
  const r = await evalJS(`JSON.stringify({units:Object.keys(SECTOR_DEBUG.state().units).length, tiles:Object.keys(SECTOR_DEBUG.state().map.tiles).length, round:SECTOR_DEBUG.state().turn.round, perf:Object.fromEntries(Object.entries(Render.perf).map(([k,v])=>[k,+v.toFixed(2)]))})`);
  console.log('zoomed out:', r);
  await evalJS(`Render.focus(Object.keys(SECTOR_DEBUG.state().map.tiles)[400], 1.6); true`); await sleep(3000);
  console.log('zoomed in: ', await evalJS(`JSON.stringify(Object.fromEntries(Object.entries(Render.perf).map(([k,v])=>[k,+v.toFixed(2)])))`));
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
