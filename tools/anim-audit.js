// Lists running CSS animations per screen and flags the ones that repaint every frame. Needs: PORT=3043 SECTOR_DEV=1 SECTOR_FAST=1 node server.js
const { launch, sleep } = require('./cdp');
const AUDIT = `(()=>{ const cheap=new Set(['transform','opacity','offset','composite','easing','computedOffset']); const out={}; for (const a of document.getAnimations()) { const el=a.effect && a.effect.target; if(!el||a.playState!=='running') continue; const props=[...new Set((a.effect.getKeyframes()||[]).flatMap(k=>Object.keys(k)).filter(p=>!cheap.has(p)))]; const r=el.getBoundingClientRect(); const id=(a.animationName||'js')+' on '+(el.id?'#'+el.id:el.className&&el.className.baseVal===undefined?'.'+String(el.className).split(' ').slice(0,2).join('.'):el.tagName)+(props.length?' ['+props.join(',')+']':' [cheap]'); out[id]=out[id]||{n:0,px:0}; out[id].n++; out[id].px+=Math.round(r.width*r.height/1000); } return Object.entries(out).sort((a,b)=>b[1].px-a[1].px).map(([k,v])=>v.n+'x '+k+' ~'+v.px+'k px'); })()`;
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3043', port: 9380, width: 1600, height: 900 });
  const { evalJS } = b;
  const show = async label => { console.log('\n== ' + label); console.log((await evalJS(AUDIT)).join('\n') || '(none)'); console.log('fullscreen layers:', await evalJS(`[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(), s=getComputedStyle(e); return r.width>=innerWidth*.9&&r.height>=innerHeight*.9&&s.display!=='none'&&s.visibility!=='hidden'&&!e.hidden&&(s.filter!=='none'||s.backdropFilter!=='none'||s.mixBlendMode!=='normal'||s.boxShadow!=='none'||s.backgroundImage!=='none')}).map(e=>(e.id||e.className)+' f:'+getComputedStyle(e).filter+' bf:'+getComputedStyle(e).backdropFilter+' mb:'+getComputedStyle(e).mixBlendMode).join(' | ')`)); };
  await show('title');
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(700);
  for (let i = 0; i < 3; i++) { await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(120); }
  await show('lobby');
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  for (let i = 0; i < 40 && !(await evalJS(`document.querySelectorAll('#draft .flip.dealt').length>=3`)); i++) await sleep(250);
  await sleep(1200); await show('draft face down');
  await evalJS(`document.querySelector('#draft .reveal-all')?.click(); true`); await sleep(2500); await show('draft revealed');
  for (let i = 0; i < 80; i++) { if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break; await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`); await sleep(600); }
  for (let i = 0; i < 120; i++) { if (await evalJS(`SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you()`)) break; await sleep(500); }
  await sleep(1500); await show('resupply / my turn');
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
