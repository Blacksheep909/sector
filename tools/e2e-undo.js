// Undo check: on your turn, move a stack, then press Ctrl+Z and confirm it comes back (and the hex it took is given back).
// Needs a fresh server:  PORT=3013 SECTOR_FAST=1 SECTOR_NO_OPEN=1 node server.js   (pass a browser path as the first argument)
const { launch, sleep } = require('./cdp');
(async () => {
  const b = await launch({ browser: process.argv[2], url: process.env.SECTOR_URL || 'http://localhost:3013', port: 9343 });
  const { evalJS, waitFor } = b;
  await waitFor(`!!document.querySelector('#joinBtn')`, 15000);
  await evalJS(`document.querySelector('#nameIn').value='Alice'; document.querySelector('#joinBtn').click(); true`);
  await waitFor(`!document.querySelector('#lobbyBox').hidden`, 15000);
  if (process.env.FOG) await evalJS(`SECTOR_DEBUG.send({t:'settings',settings:{fog:'on'}}); true`);
  await evalJS(`document.querySelector('#addBot').click(); true`); await sleep(500);
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  for (let i = 0; i < 80; i++) {
    if (await evalJS(`!!SECTOR_DEBUG.state() && SECTOR_DEBUG.state().phase==='play'`)) break;
    await evalJS(`(()=>{ const d=document.querySelector('#draft'); if(!d||d.hidden) return; d.querySelector('.reveal-all')?.click(); const o=d.querySelectorAll('.flip.open'); if(o.length===3) o[0].click(); })(); true`);
    await sleep(700);
  }
  const mine = `(SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id===SECTOR_DEBUG.you() && SECTOR_DEBUG.state().turn.stage==='act')`;
  await waitFor(mine, 40000); await sleep(1500);
  const before = JSON.parse(await evalJS(`JSON.stringify((()=>{ const S=SECTOR_DEBUG.state(), E=SectorEngine, me=SECTOR_DEBUG.you();
    const u=Object.values(S.units).find(u=>u.owner===me&&E.canAct(S,u)); const r=E.reachable(S,me,[u.id],u.hex);
    const to=Object.keys(r).filter(k=>r[k].kind==='move'&&S.map.tiles[k].owner!==me)[0] || Object.keys(r).find(k=>r[k].kind==='move');
    return { id:u.id, from:u.hex, to, owner:S.map.tiles[to].owner, owned:Object.values(S.map.tiles).filter(t=>t.owner===me).length }; })())`));
  console.log('moving', before);
  await evalJS(`SECTOR_DEBUG.act({a:'move',from:'${before.from}',units:[${before.id}],to:'${before.to}'}); true`);
  await waitFor(`SECTOR_DEBUG.state().units[${before.id}].hex==='${before.to}'`, 8000); await sleep(1200);
  console.log('undo button shown:', await evalJS(`!document.querySelector('#undoBtn').hidden`));
  await evalJS(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'z',code:'KeyZ',ctrlKey:true,bubbles:true})); true`);
  const back = await waitFor(`SECTOR_DEBUG.state().units[${before.id}].hex==='${before.from}'`, 8000);
  const owned = await evalJS(`Object.values(SECTOR_DEBUG.state().map.tiles).filter(t=>t.owner===SECTOR_DEBUG.you()).length`);
  console.log(back && owned === before.owned ? 'PASS undo: unit back and captured hex returned' : 'FAIL undo (unit back: ' + back + ', hexes ' + owned + ' vs ' + before.owned + ')', 'toasts:', await evalJS(`[...document.querySelectorAll('.toast')].map(t=>t.textContent).join(' | ')`));
  b.close(); process.exit(back ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
