// Records the Supply Drop crate opening and the start-of-turn resupply, frame by frame (CDP screencast).
// Needs a server: PORT=3013 SECTOR_FAST=1 SECTOR_NO_OPEN=1 node server.js;  node tools/record-fx.js <browser> <outDir> [crate|supply]
const { launch, sleep } = require('./cdp');
const fs = require('fs'), path = require('path');
(async () => {
  const [browser, out, which = 'crate'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await launch({ browser, url: process.env.SECTOR_URL || 'http://localhost:3013', port: 9390, width: 1280, height: 800 });
  const { evalJS, waitFor, cmd } = b;
  await waitFor(`!!document.querySelector('#joinBtn')`);
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(700);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(300);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  for (let i = 0; i < 80; i++) { if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break; await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`); await sleep(600); }
  const mine = `(SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you())`;
  // frames arrive as the page paints; ack each one so the next comes
  let n = 0, recording = false; const t0 = Date.now(); const times = [];
  const ws = b; // reuse cmd channel: poll frames via Page.captureScreenshot is too slow, so use the screencast
  const frames = [];
  const grab = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); frames.push({ t: Date.now(), data: r.result.data }); }
  };
  if (which === 'crate') {
    await waitFor(`${mine} && SECTOR_DEBUG.state().turn.stage==='act'`, 40000); await sleep(1200);
    const uid = await evalJS(`(SECTOR_DEBUG.state().players.find(p=>p.id===SECTOR_DEBUG.you()).tactics.find(c=>c.id.startsWith('drop_'))||{}).uid`);
    evalJS(`SECTOR_DEBUG.act({a:'tactic',uid:${uid}}); true`);
    await grab(+process.env.MS || 9000);
  } else {
    // end my turn, wait for the bot, then record my next resupply
    await waitFor(`${mine} && SECTOR_DEBUG.state().turn.stage==='act'`, 40000); await sleep(800);
    await evalJS(`SECTOR_DEBUG.send({t:'act',action:{a:'end'},seq:991,as:SECTOR_DEBUG.you()}); true`);
    await waitFor(`!${mine}`, 20000);
    await waitFor(`${mine}`, 60000);
    await grab(+process.env.MS || 4500);
    // take the first card with the 1 key, and keep recording through the close
    await evalJS(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true})); true`);
    await grab(2200);
  }
  frames.forEach((f, i) => fs.writeFileSync(path.join(out, String(i).padStart(4, '0') + '.jpg'), Buffer.from(f.data, 'base64')));
  const dts = frames.slice(1).map((f, i) => f.t - frames[i].t);
  console.log(frames.length, 'frames, avg gap', Math.round(dts.reduce((a, b) => a + b, 0) / dts.length) + 'ms');
  b.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
