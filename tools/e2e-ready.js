// Ready-up: the host can't start until every guest is ready. Needs: PORT=3044 SECTOR_DEV=1 SECTOR_FAST=1 node server.js
const path = require('path');
const { launch, sleep } = require('./cdp');
const URL = process.env.SECTOR_URL || 'http://localhost:3044';
(async () => {
  const a = await launch({ url: URL, port: 9381 });
  await a.evalJS(`window.__toasts=[]; new MutationObserver(()=>document.querySelectorAll('.toast').forEach(t=>{ if(!__toasts.includes(t.textContent)) __toasts.push(t.textContent); })).observe(document.body,{subtree:true,childList:true}); document.querySelector('#nameIn').value='Host'; document.querySelector('#joinBtn').click(); true`); await sleep(700);
  const b = await launch({ url: URL, port: 9382 });
  await b.evalJS(`document.querySelector('#nameIn').value='Guest'; document.querySelector('#joinBtn').click(); true`); await sleep(1000);
  console.log('host button:', await a.evalJS(`document.querySelector('#startBtn').textContent`));
  console.log('guest sees ready button:', await b.evalJS(`!document.querySelector('#readyBtn').hidden && document.querySelector('#readyBtn').textContent`));
  await a.evalJS(`document.querySelector('#startBtn').click(); true`); await sleep(800);
  console.log('start blocked:', await a.evalJS(`!SECTOR_DEBUG.state()`), '| toast:', await a.evalJS(`__toasts.filter(t=>t.includes('ready')).join(' / ')`));
  await b.evalJS(`document.querySelector('#readyBtn').click(); true`); await sleep(700);
  console.log('after ready, host button:', await a.evalJS(`document.querySelector('#startBtn').textContent`));
  await a.evalJS(`SECTOR_DEBUG.send({t:'settings',settings:{mapSize:'small'}}); true`); await sleep(700);
  console.log('settings change un-readies guest:', await a.evalJS(`document.querySelector('#startBtn').textContent`));
  await b.shot(path.join(process.env.SHOTS || require('os').tmpdir(), 'ready-guest.png'));
  await b.evalJS(`document.querySelector('#readyBtn').click(); true`); await sleep(700);
  await a.evalJS(`document.querySelector('#startBtn').click(); true`); await sleep(2500);
  console.log('game started:', await a.evalJS(`!!SECTOR_DEBUG.state()`), await b.evalJS(`!!SECTOR_DEBUG.state()`));
  a.close(); b.close();
})().catch(e => { console.error(e); process.exit(1); });
