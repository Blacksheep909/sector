// Blueprint check: queue a deploy and moves while the bots play, then confirm they run on your turn.
// Needs a fresh dev server:  PORT=3012 SECTOR_DEV=1 SECTOR_FAST=1 SECTOR_NO_OPEN=1 node server.js
const { launch, sleep } = require('./cdp');
(async () => {
  const b = await launch({ url: process.env.SECTOR_URL || 'http://localhost:3012', port: 9341 });
  const { evalJS, waitFor } = b; console.log('launched');
  const log = [];
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`); await sleep(800);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(300);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(300);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  for (let i = 0; i < 80; i++) {
    if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break;
    await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`);
    await sleep(700);
  }
  console.log('draft done, phase', await evalJS(`SECTOR_DEBUG.state().phase`));
  const mine = `(SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you())`;
  for (let round = 0; round < 2; round++) {
    // get to a moment where someone else is playing, then freeze incoming events so we can plan
    if (await evalJS(mine)) { await sleep(1500); await evalJS(`SECTOR_DEBUG.send({t:'act',action:{a:'end'},seq:9999+${round},as:SECTOR_DEBUG.you()}); true`); }
    await waitFor(`!${mine}`, 20000);
    await evalJS(`window.SECTOR_PAUSE=true; true`); await sleep(400);
    const r = JSON.parse(await evalJS(`JSON.stringify((()=>{
      const E=SectorEngine, ps=SECTOR_DEBUG.planState(), me=SECTOR_DEBUG.you(), p=ps.players.find(x=>x.id===me), out={round:SECTOR_DEBUG.state().turn.round, cash:p.cash};
      // 1) deploy the cheapest affordable land unit
      const deck=p.arsenal.filter(id=>!E.isSea(id)&&E.unitCost(p,id)<=p.cash).sort((a,b)=>E.unitCost(p,a)-E.unitCost(p,b));
      if (deck.length){ const hx=E.deployHexes(ps,me,deck[0])[0]; out.deploy=[deck[0],hx]; SECTOR_DEBUG.act({a:'deploy',unit:deck[0],hex:hx}); }
      // 2) move every ready stack one step to a free hex
      const ps2=SECTOR_DEBUG.planState(); out.moves=[];
      const stacks={}; for (const u of Object.values(ps2.units)) if(u.owner===me&&E.canAct(ps2,u)) (stacks[u.hex]=stacks[u.hex]||[]).push(u.id);
      for (const h in stacks){ const st=SECTOR_DEBUG.planState(); const ids=stacks[h].filter(id=>st.units[id]&&st.units[id].hex===h); if(!ids.length) continue; const re=E.reachable(st,me,ids,h); const to=Object.keys(re).find(k=>re[k].kind==='move'&&k!==h); if(to){ SECTOR_DEBUG.act({a:'move',units:ids,from:h,to}); out.moves.push([ids,h,to]); } }
      out.plan=SECTOR_DEBUG.plan().map(it=>[it.a.a,it.ok,it.err||'']);
      return out; })())`));
    console.log('planned', JSON.stringify(r));
    log.push(`round ${r.round}: planned ${JSON.stringify(r.plan)}`);
    await evalJS(`window.SECTOR_PAUSE=false; SECTOR_DEBUG.resume(); true`);
    console.log('my turn:', await waitFor(mine, 40000));
    console.log('plan ran:', await waitFor(`SECTOR_DEBUG.plan().length===0`, 20000));
    await sleep(2500);
    const res = JSON.parse(await evalJS(`JSON.stringify((()=>{ const S=SECTOR_DEBUG.state(); return { stage:S.turn.stage, moves: ${JSON.stringify(r.moves)}.map(([ids,h,to])=>ids.map(id=>S.units[id]?S.units[id].hex===to:'gone')), deployed: ${JSON.stringify(r.deploy || null)} ? Object.values(S.units).some(u=>u.owner===SECTOR_DEBUG.you()&&u.type===${JSON.stringify((r.deploy || [])[0])}&&u.hex===${JSON.stringify((r.deploy || [])[1])}) : null }})())`));
    log.push(`round ${r.round}: executed ${JSON.stringify(res)}`);
    log.push('toasts: ' + await evalJS(`[...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent).join(' | ')`));
  }
  console.log(log.join('\n'));
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
