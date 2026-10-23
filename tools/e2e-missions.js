// Missions end to end: the board, the tutorial with Sergeant Hale, and the result screen. node tools/e2e-missions.js
const { spawn } = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');
const { launch, sleep } = require('./cdp');
const PORT = 3033, OUT = process.env.SHOTS || os.tmpdir();
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_SAVES: fs.mkdtempSync(path.join(os.tmpdir(), 'ms-')), SECTOR_PROFILES: path.join(os.tmpdir(), 'ms-' + Date.now() + '.json') }, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  await sleep(900);
  const b = await launch({ browser: process.env.SECTOR_BROWSER || '/opt/pw-browsers/chromium', url: 'http://localhost:' + PORT + '/', width: 1400, height: 860, port: 9351 });
  await sleep(1200);
  await b.evalJS(`document.querySelector('#nameIn').value = 'Recruit'; document.querySelector('#missionsBtn3').click()`);
  ok(await b.waitFor(`!!document.querySelector('#missionsModal:not([hidden]) .ms-card')`, 10000), 'the mission board opens from the front page');
  ok(await b.evalJS(`document.querySelectorAll('.ms-card').length`) === 10 && await b.evalJS(`document.querySelectorAll('.ms-card.locked').length`) === 9, 'ten missions, all but the tutorial locked');
  await sleep(600); await b.shot(path.join(OUT, 'missions-board.png'));
  await b.evalJS(`document.querySelector('.ms-card').click()`);
  ok(await b.waitFor(`!!document.querySelector('#hale') && !!document.querySelector('#missionBar')`, 10000), 'the tutorial starts with Sergeant Hale and the mission bar');
  await sleep(800); await b.shot(path.join(OUT, 'missions-hale.png'));
  const text = () => b.evalJS(`(document.querySelector('#hale .hale-text') || {}).textContent || ''`);
  for (let i = 0; i < 3; i++) { await b.evalJS(`document.querySelector('#hale .btn').click()`); await sleep(300); }
  ok((await text()).includes('Click your Grunts'), 'NEXT steps through the briefing to the first task');
  const L = await b.evalJS(`JSON.stringify(SECTOR_DEBUG.state().scenario.labels)`).then(JSON.parse);
  await b.evalJS(`SECTOR_DEBUG.click(${JSON.stringify(L.g)})`);
  ok(await b.waitFor(`(document.querySelector('#hale .hale-text') || {}).textContent.includes('Click a hex')`, 4000), 'selecting the Grunts moves the script on');
  await b.evalJS(`SECTOR_DEBUG.click(${JSON.stringify(L.w1)})`);
  ok(await b.waitFor(`(document.querySelector('#hale .hale-text') || {}).textContent.includes('END TURN')`, 6000), 'moving them moves it on again');
  await b.shot(path.join(OUT, 'missions-move.png'));
  await b.evalJS(`SECTOR_DEBUG.act({ a: 'end' })`);
  const lesson = await b.waitFor(`(document.querySelector('#hale .hale-text') || {}).textContent.includes('Grunts card')`, 10000);
  if (!lesson) console.log('     debug:', await b.evalJS(`JSON.stringify({ hale: (document.querySelector('#hale .hale-text') || {}).textContent, turn: SECTOR_DEBUG.state().turn, cur: SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id, you: SECTOR_DEBUG.you(), phase: SECTOR_DEBUG.state().phase })`));
  ok(lesson, 'a new turn brings the deploy lesson');
  await b.evalJS(`SECTOR_DEBUG.act({ a: 'deploy', unit: 'grunt', hex: ${JSON.stringify(L.hq)} })`); await sleep(1500);
  const S = () => b.evalJS(`JSON.stringify(SECTOR_DEBUG.state())`).then(JSON.parse);
  let st = await S(); const ids = Object.values(st.units).filter(u => u.hex === L.w1 && u.owner === st.scenario.hero).map(u => u.id);
  await b.evalJS(`SECTOR_DEBUG.act({ a: 'move', from: ${JSON.stringify(L.w1)}, units: ${JSON.stringify(ids)}, to: ${JSON.stringify(L.w2)} })`); await sleep(1500);
  await b.evalJS(`SECTOR_DEBUG.act({ a: 'end' })`); await sleep(3500);
  st = await S(); const ids2 = Object.values(st.units).filter(u => u.hex === L.w2 && u.owner === st.scenario.hero).map(u => u.id);
  await b.evalJS(`SECTOR_DEBUG.act({ a: 'assault', to: ${JSON.stringify(L.obj)}, groups: [{ from: ${JSON.stringify(L.w2)}, units: ${JSON.stringify(ids2)} }] })`);
  for (let i = 0; i < 20 && !(await b.evalJS(`!!document.querySelector('#missionResult:not([hidden])')`)); i++) { await b.evalJS(`document.querySelector('#combat') && document.querySelector('#combat').click(); dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }))`); await sleep(600); }
  ok(await b.waitFor(`!!document.querySelector('#missionResult:not([hidden]) .mr.won')`, 15000), 'winning shows MISSION COMPLETE');
  ok((await b.evalJS(`document.querySelector('#missionResult').textContent`)).includes('First clear'), 'the first clear pays Valor');
  await b.shot(path.join(OUT, 'missions-result.png'));
  await b.evalJS(`document.querySelector('#mrBoard').click()`);
  ok(await b.waitFor(`document.querySelectorAll('#missionsModal:not([hidden]) .ms-card.locked').length === 8`, 8000), 'the next mission unlocks');
  b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
