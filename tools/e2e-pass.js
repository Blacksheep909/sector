// End-to-end check of pass & play: two humans on one device + a bot, through the draft and first turns.
// Needs a fresh server on 3011:  PORT=3011 SECTOR_NO_OPEN=1 node server.js
const { launch, sleep } = require('./cdp');
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3011', port: 9334 });
  const { evalJS, waitFor } = b;
  // wait for each lobby step to land before the next click (fixed sleeps raced the server)
  const rows = n => `document.querySelectorAll('#playerList .prow').length >= ${n}`;
  await waitFor(`!!document.querySelector('#joinBtn')`, 15000);
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`);
  await waitFor(`!document.querySelector('#lobbyBox').hidden && ${rows(1)}`, 15000);
  await evalJS(`document.querySelector('#addLocal').click(); true`); await waitFor(rows(2), 15000);
  await evalJS(`document.querySelector('#addBot').click(); true`); await waitFor(rows(3), 15000);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  const seen = [];
  for (let step = 0; step < 16; step++) {
    // either a pass cover or a draft offer will be waiting
    await waitFor(`!document.querySelector('#passCover').hidden || !!document.querySelector('#draft .reveal-all') || (SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play')`, 20000);
    if (await evalJS(`!document.querySelector('#passCover').hidden`)) { seen.push('cover:' + await evalJS(`document.querySelector('.pass-name').textContent`)); await evalJS(`document.querySelector('#passGo').click(); true`); await sleep(600); continue; }
    if (await evalJS(`SECTOR_DEBUG.state().phase==='play'`)) break;
    const who = await evalJS(`SECTOR_DEBUG.you()`);
    await evalJS(`document.querySelector('#draft .reveal-all').click(); true`);
    await waitFor(`document.querySelectorAll('#draft .flip.open').length===3`, 15000); await sleep(300);
    await evalJS(`document.querySelector('#draft .flip.open').click(); true`);
    seen.push('draft-pick:' + who); await sleep(1500);
  }
  const s = await evalJS(`JSON.stringify({phase:SECTOR_DEBUG.state().phase, decks:SECTOR_DEBUG.state().players.map(p=>p.name+':'+p.arsenal.length)})`);
  console.log(seen.join('  →  '));
  console.log(s);
  // round 1 has no resupply: the first human turn starts straight in the action stage
  await waitFor(`!document.querySelector('#passCover').hidden || !document.querySelector('#supply').hidden`, 30000);
  if (await evalJS(`!document.querySelector('#passCover').hidden`)) { console.log('turn cover for', await evalJS(`document.querySelector('.pass-name').textContent`)); await evalJS(`document.querySelector('#passGo').click(); true`); }
  await sleep(1500);
  console.log('round 1 skips resupply:', await evalJS(`document.querySelector('#supply').hidden && SECTOR_DEBUG.state().turn.stage==='act'`));
  console.log('after collect:', await evalJS(`JSON.stringify({stage:SECTOR_DEBUG.state().turn.stage, seat:SECTOR_DEBUG.you(), errors:[...document.querySelectorAll('.toast.err')].map(t=>t.textContent)})`));
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
