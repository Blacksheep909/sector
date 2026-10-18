// Spectator check: the host sits out, two bots play, the host watches without errors.
// Needs: PORT=3014 SECTOR_DEV=1 SECTOR_FAST=1 node server.js
const path = require('path');
const { launch, sleep } = require('./cdp');
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3014', port: 9353 });
  const { evalJS, waitFor, shot } = b;
  await evalJS(`window.__errs=[]; addEventListener('error',e=>__errs.push(e.message+' @'+e.filename+':'+e.lineno)); addEventListener('unhandledrejection',e=>__errs.push('rej '+(e.reason&&e.reason.stack||e.reason))); true`);
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(800);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(300);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(300);
  await evalJS(`[...document.querySelectorAll('.specbtn')].find(b=>b.closest('.prow').textContent.includes('YOU')).click(); true`); await sleep(500);
  console.log('lobby row:', await evalJS(`[...document.querySelectorAll('.prow')].find(r=>r.textContent.includes('YOU')).textContent.trim()`), '| count:', await evalJS(`document.querySelector('#pCount').textContent`));
  if (process.env.SHOTS) await shot(path.join(process.env.SHOTS, 'spectate-lobby.png'));
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  console.log('game started:', await waitFor(`!!SECTOR_DEBUG.state()`, 10000));
  console.log('players in game:', await evalJS(`JSON.stringify(SECTOR_DEBUG.state().players.map(p=>p.name))`));
  console.log('reached play:', await waitFor(`SECTOR_DEBUG.state().phase==='play'`, 30000));
  await sleep(8000);
  console.log('round now:', await evalJS(`SECTOR_DEBUG.state().turn.round`), '| draft shown:', await evalJS(`!document.querySelector('#draft').hidden`), '| supply shown:', await evalJS(`!document.querySelector('#supply').hidden`));
  if (process.env.SHOTS) await shot(path.join(process.env.SHOTS, 'spectate-game.png'));
  console.log('page errors:', await evalJS(`JSON.stringify(__errs.slice(0,5))`));
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
