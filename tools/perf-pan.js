// Pan/zoom frame times on a large board: avg FPS, 1% low and worst frame while the camera moves every frame.
// Needs a server: PORT=3013 SECTOR_FAST=1 SECTOR_NO_OPEN=1 node server.js;  node tools/perf-pan.js <browser>
const { launch, sleep } = require('./cdp');
(async () => {
  const b = await launch({ browser: process.argv[2], url: process.env.SECTOR_URL || 'http://localhost:3013', port: 9381, width: 1600, height: 900 });
  const { evalJS, waitFor } = b;
  await waitFor(`!!document.querySelector('#joinBtn')`);
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(700);
  for (let i = 0; i < 5; i++) { await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(150); }
  await evalJS(`SECTOR_DEBUG.send({t:'settings',settings:{mapSize:'large'}}); true`); await sleep(300);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  for (let i = 0; i < 80; i++) { if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break; await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`); await sleep(600); }
  await sleep(2000); await evalJS(`window.SECTOR_PAUSE=true; Render.focus(SECTOR_DEBUG.state().players[0].hq, 1); true`); await sleep(5000); await evalJS('Render.perf.slow.splice(0)');
  const run = (label, step) => evalJS(`new Promise(res => { const t=[]; let last=performance.now(), i=0; const end=last+4000;
    const f=now=>{ t.push(now-last); last=now; i++; ${step}; if(now<end) requestAnimationFrame(f); else { t.sort((a,b)=>a-b); const avg=t.reduce((a,b)=>a+b,0)/t.length;
      res('${label}'.padEnd(10)+' avg '+(1000/avg).toFixed(0)+' fps · 1% low '+(1000/t[Math.floor(t.length*.99)]).toFixed(0)+' fps · worst frame '+t[t.length-1].toFixed(0)+'ms'); } }; requestAnimationFrame(f); })`);
  console.log(await run('idle', '')); if (process.env.SLOW) console.log(JSON.stringify(await evalJS('Render.perf.slow.splice(0)')));
  console.log(await run('panning', `Render.pan(Math.sin(i/20)*14, Math.cos(i/27)*9)`)); if (process.env.SLOW) console.log(JSON.stringify(await evalJS('Render.perf.slow.splice(0)')));
  console.log(await run('zooming', `Render.zoomAt(800, 450, i % 80 < 40 ? 1.012 : 1/1.012)`));
  b.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
