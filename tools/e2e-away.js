// Dropped players: a bot covers their seat, they get it back on return; the host can kick mid-game.
// Needs: PORT=3048 SECTOR_DEV=1 SECTOR_FAST=1 SECTOR_AWAY_MS=2500 node server.js
const { launch, sleep } = require('./cdp');
const URL = process.env.SECTOR_URL || 'http://localhost:3048';
(async () => {
  const a = await launch({ url: URL, port: 9391 });
  await a.evalJS(`document.querySelector('#nameIn').value='Host'; document.querySelector('#joinBtn').click(); true`); await sleep(700);
  const b = await launch({ url: URL, port: 9392 });
  await b.evalJS(`document.querySelector('#nameIn').value='Guest'; document.querySelector('#joinBtn').click(); true`); await sleep(900);
  await b.evalJS(`document.querySelector('#readyBtn').click(); true`); await sleep(500);
  await a.evalJS(`document.querySelector('#addBot').click(); true`); await sleep(300);
  await a.evalJS(`document.querySelector('#startBtn').click(); true`); await sleep(3000);
  const seat = await a.evalJS(`(SECTOR_DEBUG.state().players.find(p=>p.name==='Guest')||{}).id`);
  console.log('guest seat:', seat);
  // the guest drops out (browser closed), keeping their reconnect token
  const tok = await b.evalJS(`localStorage.getItem('sector.token')`); b.close(); await sleep(4500);
  console.log('while away:', await a.evalJS(`JSON.stringify((({bot,away})=>({bot,away}))(SECTOR_DEBUG.state().players.find(p=>p.id==='${seat}')))`), '| chip:', await a.evalJS(`[...document.querySelectorAll('.pchip')].some(c=>c.textContent.includes('AWAY'))`));
  // ...and comes back (same token)
  const b2 = await launch({ url: URL, port: 9393 });
  await b2.evalJS(`localStorage.setItem('sector.token', ${JSON.stringify('TOK')}); location.reload(); true`.replace('TOK', tok)); await sleep(2500);
  await b2.evalJS(`document.querySelector('#nameIn').value='Guest'; !document.querySelector('#home').hidden && document.querySelector('#joinBtn').click(); true`); await sleep(2500);
  console.log('after return:', await a.evalJS(`JSON.stringify((({bot,away})=>({bot,away}))(SECTOR_DEBUG.state().players.find(p=>p.id==='${seat}')))`), '| guest seat back:', await b2.evalJS(`SECTOR_DEBUG.you()`) === seat);
  // the host kicks the guest mid-game
  console.log('kick button shown:', await a.evalJS(`!!document.querySelector('.pchip .kickbtn')`));
  await a.evalJS(`SECTOR_DEBUG.send({t:'kick', id:'${seat}'}); true`); await sleep(1500);
  console.log('after kick:', await a.evalJS(`JSON.stringify((({bot,name})=>({bot,name}))(SECTOR_DEBUG.state().players.find(p=>p.id==='${seat}')))`), '| guest back at menu:', await b2.evalJS(`!document.querySelector('#menu').hidden`));
  a.close(); b2.close();
})().catch(e => { console.error(e); process.exit(1); });
