// Touch controls on a phone-sized screen: tap to select, tap a destination to preview, tap again to move; drag pans;
// pinch zooms; holding a finger down shows a hex's details. node tools/test-touch.js (starts its own server on port 3041)
const { spawn } = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');
const { launch, sleep } = require('./cdp');
const PORT = 3041, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'touch-'));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_DEV: '1', SECTOR_NO_UPDATE: '1', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') }, stdio: 'ignore' });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  await sleep(1500);
  const b = await launch({ browser: process.env.SECTOR_BROWSER || '/opt/pw-browsers/chromium', url: 'http://localhost:' + PORT, width: 844, height: 390, port: 9441, mobile: true });
  const js = (c, w = 600) => b.evalJS(c + '; true').then(() => sleep(w)), ev = c => b.evalJS(c);
  const touch = async (type, pts) => b.cmd('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const tap = async (x, y) => { await touch('touchStart', [[x, y]]); await sleep(60); await touch('touchEnd', []); await sleep(500); };
  await sleep(2000);
  ok(await ev(`document.body.classList.contains('touch')`), 'a phone is recognised as a touch device');
  await js(`document.querySelector('#createBtn').click()`, 1200); await js(`document.querySelector('#addBot').click()`, 400);
  await js(`SECTOR_DEBUG.send({t:'settings',settings:{spawns:'random', speed:'super'}})`, 300);
  await js(`document.querySelector('#startBtn').click()`, 4000);
  for (let i = 0; i < 60; i++) {
    const st = JSON.parse(await ev(`JSON.stringify((()=>{const S=SECTOR_DEBUG.state(); if(!S) return {}; return {ph:S.phase, mine:S.turn&&S.players[S.turn.idx]&&S.players[S.turn.idx].id===SECTOR_DEBUG.you(), stage:S.turn&&S.turn.stage, draft:S.phase==='draft'&&!S.draft.picked[SECTOR_DEBUG.you()], step:S.draft&&S.draft.step&&S.draft.step[SECTOR_DEBUG.you()]}})())`));
    if (st.draft) await js(`SECTOR_DEBUG.send({t:'act', action:{a:'draftPick', idx:0}, seq: 9e6 + ${st.step || 0}})`, 400);
    else if (st.ph === 'play' && st.mine && st.stage === 'act') break; else await sleep(400);
  }
  await sleep(1500);
  // the HQ stack and an empty neighbour it can walk to
  const pos = JSON.parse(await ev(`JSON.stringify((()=>{ const S=SECTOR_DEBUG.state(), you=SECTOR_DEBUG.you(), E=window.SectorEngine; const me=S.players.find(p=>p.id===you);
    const u=Object.values(S.units).find(u=>u.owner===you&&u.hex===me.hq); const reach=E.reachable(S,you,[u.id],me.hq); const k=Object.keys(reach).find(x=>reach[x].kind==='move'||reach[x].kind==='capture');
    const [ax,ay]=Render.screenOf(me.hq), [bx,by]=Render.screenOf(k); return {hq:me.hq, k, ax, ay, bx, by, unit:u.id}; })())`));
  await tap(pos.ax, pos.ay);
  ok(await ev(`!document.querySelector('#touchBar').hidden`), 'selecting a stack brings up the CANCEL bar');
  await tap(pos.bx, pos.by);
  ok(await ev(`SECTOR_DEBUG.state().units['${pos.unit}'].hex === '${pos.hq}'`), 'the first tap on a destination only previews the move');
  ok(await ev(`!document.querySelector('#tooltip').hidden`), 'and shows the hex details');
  await tap(pos.bx, pos.by); await sleep(1500);
  ok(await ev(`SECTOR_DEBUG.state().units['${pos.unit}'] && SECTOR_DEBUG.state().units['${pos.unit}'].hex === '${pos.k}'`), 'the second tap sends the stack');
  // drag pans
  const c0 = JSON.parse(await ev(`JSON.stringify({x:Render.cam.x,y:Render.cam.y,z:Render.cam.z})`));
  await touch('touchStart', [[420, 200]]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[420 + i * 20, 200 + i * 8]]); await sleep(30); } await touch('touchEnd', []); await sleep(300);
  const c1 = JSON.parse(await ev(`JSON.stringify({x:Render.cam.x,y:Render.cam.y,z:Render.cam.z})`));
  ok(Math.abs(c1.x - c0.x) > 20 && Math.abs(c1.z - c0.z) < 1e-6, 'dragging one finger pans the map');
  // pinch zooms
  await touch('touchStart', [[380, 200], [460, 200]]); for (let i = 1; i <= 6; i++) { await touch('touchMove', [[380 - i * 15, 200], [460 + i * 15, 200]]); await sleep(30); } await touch('touchEnd', []); await sleep(300);
  const c2 = JSON.parse(await ev(`JSON.stringify({z:Render.cam.z})`));
  ok(c2.z > c1.z * 1.3, 'spreading two fingers zooms in (' + c1.z.toFixed(2) + ' → ' + c2.z.toFixed(2) + ')');
  // holding a finger shows the details without acting
  await js(`Render.focus('${pos.k}')`, 900);   // the map has moved since: bring the stack back into view and find it again
  const hq2 = JSON.parse(await ev(`JSON.stringify(Render.screenOf('${pos.k}'))`));
  await touch('touchStart', [[hq2[0], hq2[1]]]); await sleep(700);
  ok(await ev(`!document.querySelector('#tooltip').hidden`), 'holding a finger on a hex shows its details');
  await touch('touchEnd', []); await sleep(300);
  b.close(); srv.kill();
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
