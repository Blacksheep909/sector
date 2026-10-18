// A spectator joins a running bot game and takes over a bot. Needs: PORT=3042 SECTOR_DEV=1 SECTOR_FAST=1 node server.js
const { launch, sleep } = require('./cdp');
const URL = process.env.SECTOR_URL || 'http://localhost:3042';
(async () => {
  const a = await launch({ url: URL, port: 9375 });
  await a.evalJS(`document.querySelector('#nameIn').value='Host'; document.querySelector('#joinBtn').click(); true`); await sleep(700);
  for (let i = 0; i < 2; i++) { await a.evalJS(`document.querySelector('#addBot').click(); true`); await sleep(150); }
  // the host watches instead of playing, so the game is all bots
  await a.evalJS(`[...document.querySelectorAll('.specbtn')][0].click(); true`); await sleep(300);
  await a.evalJS(`document.querySelector('#startBtn').click(); true`); await sleep(4000);
  const b = await launch({ url: URL, port: 9376 });
  await b.evalJS(`window.__errs=[]; addEventListener('error',e=>__errs.push(e.message)); localStorage.setItem('sector.name','Taker'); document.querySelector('#nameIn').value='Taker'; document.querySelector('#joinBtn').click(); true`); await sleep(2500);
  console.log('B is watching:', await b.evalJS(`!!SECTOR_DEBUG.state() && !SECTOR_DEBUG.you()`));
  console.log('take-over buttons:', await b.evalJS(`[...document.querySelectorAll('.tradebtn')].filter(x=>x.textContent==='TAKE OVER').length`));
  await b.evalJS(`[...document.querySelectorAll('.tradebtn')].find(x=>x.textContent==='TAKE OVER').click(); true`); await sleep(2500);
  console.log('B seat:', await b.evalJS(`JSON.stringify({you:SECTOR_DEBUG.you(), name:(SECTOR_DEBUG.state().players.find(p=>p.id===SECTOR_DEBUG.you())||{}).name, bot:(SECTOR_DEBUG.state().players.find(p=>p.id===SECTOR_DEBUG.you())||{}).bot})`));
  console.log('host sees:', await a.evalJS(`JSON.stringify(SECTOR_DEBUG.state().players.map(p=>p.name+(p.bot?'(bot)':'')))`));
  console.log('B errors:', await b.evalJS(`JSON.stringify(__errs)`));
  await b.shot(require('path').join(process.env.SHOTS || require('os').tmpdir(), 'takeover.png'));
  a.close(); b.close();
})().catch(e => { console.error(e); process.exit(1); });
