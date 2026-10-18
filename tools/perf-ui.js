// Frame-time and CPU profile of the screens players call laggy. Needs: PORT=3043 SECTOR_DEV=1 SECTOR_FAST=1 node server.js
const { launch, sleep } = require('./cdp');
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3043', port: 9379, width: 1600, height: 900 });
  const { evalJS, cmd } = b;
  if (process.env.THROTTLE) await cmd('Emulation.setCPUThrottlingRate', { rate: +process.env.THROTTLE });
  const frames = async ms => evalJS(`new Promise(res => { const t=[]; let last=performance.now(); const end=last+${ms}; const f=now=>{ t.push(now-last); last=now; if(now<end) requestAnimationFrame(f); else { t.sort((a,b)=>a-b); res({fps:+(1000/(t.reduce((a,b)=>a+b,0)/t.length)).toFixed(1), p95:+t[Math.floor(t.length*.95)].toFixed(1), worst:+t[t.length-1].toFixed(1)}); } }; requestAnimationFrame(f); })`);
  const profile = async (label, ms) => {
    await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 200 }); await cmd('Profiler.start');
    const fr = await frames(ms);
    const r = await cmd('Profiler.stop'); const p = r.result.profile;
    const self = {}; const byId = {}; for (const n of p.nodes) byId[n.id] = n;
    const dt = {}; for (let i = 0; i < p.samples.length; i++) dt[p.samples[i]] = (dt[p.samples[i]] || 0) + (p.timeDeltas[i] || 0);
    let total = 0; for (const id in dt) { const n = byId[id], cf = n.callFrame; const k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1); self[k] = (self[k] || 0) + dt[id]; total += dt[id]; }
    const top = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => (v / 1000).toFixed(0).padStart(5) + 'ms ' + k);
    console.log('\n== ' + label, JSON.stringify(fr), 'sampled', (total / 1000).toFixed(0) + 'ms'); console.log(top.join('\n'));
  };
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(700);
  for (let i = 0; i < 5; i++) { await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(120); }
  await evalJS(`SECTOR_DEBUG.send({t:'settings',settings:{mapSize:'large'}}); true`); await sleep(300);
  await profile('lobby', 2000);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  for (let i = 0; i < 40 && !(await evalJS(`document.querySelectorAll('#draft .flip.dealt').length>=3`)); i++) await sleep(250);
  await sleep(1500);
  await profile('draft (cards face down)', 3000);
  await evalJS(`document.querySelector('#draft .reveal-all')?.click(); true`); await sleep(2500);
  await profile('draft (cards revealed)', 3000);
  await evalJS(`(()=>{ const c=document.querySelector('#draft .flip.open'); if(c) c.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); })(); true`);
  await profile('draft (hovering a card)', 2000);
  for (let i = 0; i < 80; i++) { if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break; await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`); await sleep(600); }
  for (let i = 0; i < 120; i++) { if (await evalJS(`SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you() && SECTOR_DEBUG.state().turn.stage==='act'`)) break; await sleep(500); }
  await sleep(1500);
  await profile('board idle (my turn)', 3000);
  await evalJS(`Render.pan && Render.pan(300, 0); true`);
  await profile('board panning', 2000);
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
