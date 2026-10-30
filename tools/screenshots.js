// Captures README screenshots with headless Edge/Chrome over the DevTools protocol (no deps).
// Start a fresh server first:  PORT=3010 SECTOR_DEV=1 SECTOR_FAST=1 SECTOR_NO_OPEN=1 node server.js
// Then:                  node tools/screenshots.js [browserPath]
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BROWSER = (process.argv[2] && !process.argv[2].startsWith('--') && process.argv[2]) || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:3010';
const OUT = path.join(__dirname, '..', 'docs', 'img');
const W = 1600, H = 900;
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const prof = path.join(require('os').tmpdir(), 'sector-shots-' + Date.now());
  const proc = spawn(BROWSER, ['--headless=new', '--no-sandbox', '--remote-debugging-port=9333', '--user-data-dir=' + prof, `--window-size=${W},${H}`, '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { const list = await (await fetch('http://127.0.0.1:9333/json')).json(); target = list.find(t => t.type === 'page'); } catch (e) {}
  }
  if (!target) throw new Error('browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = {};
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result && r.result.result.value; };
  const shot = async (name) => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); console.log('saved', name); };
  const waitFor = async (expr, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evalJS(expr)) return true; await sleep(150); } return false; };

  await cmd('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.enable');
  await cmd('Page.navigate', { url: URL });
  await sleep(2500);
  await shot('title');
  await evalJS(`document.querySelector('#nameIn').value='Commander'; document.querySelector('#joinBtn').click(); true`);
  await sleep(800);
  await evalJS(`(async()=>{ for (const d of ['hard','medium','impossible']) { SECTOR_DEBUG.send({t:'addBot',diff:d}); await new Promise(r=>setTimeout(r,200)); } SECTOR_DEBUG.send({t:'settings',settings:{mapType:'archipelago',mapSize:'medium'}}); return true })()`);
  await sleep(900);
  // never publish real network addresses: swap in documentation examples
  await evalJS(`document.querySelector('#lanBox').innerHTML='Friends on your network join at:<br><b>http://192.168.1.20:3000</b>'; true`);
  await shot('lobby');
  await evalJS(`document.querySelector('#startBtn').click(); true`);
  console.log('draft dealt:', await waitFor(`!document.querySelector('#draft').hidden && document.querySelectorAll('#draft .flip.dealt').length===3`, 90000));
  await sleep(1500);
  await evalJS(`document.querySelector('#draft .flip').click(); true`); await sleep(1200);
  await shot('draft');
  // finish the draft
  for (let r = 0; r < 3; r++) {
    await waitFor(`!!document.querySelector('#draft .reveal-all') || SECTOR_DEBUG.state().phase!=='draft'`, 8000);
    await evalJS(`(()=>{const b=document.querySelector('#draft .reveal-all'); if(b) b.click(); return true})()`);
    await waitFor(`document.querySelectorAll('#draft .flip.open').length===3 || SECTOR_DEBUG.state().phase!=='draft'`, 9000);
    await evalJS(`(()=>{const f=document.querySelector('#draft .flip.open'); if(f) f.click(); return true})()`);
    await sleep(1500);
  }
  // round 1 has no resupply: let the bot AI play our first turn, then take the seat back
  await evalJS(`SECTOR_DEBUG.send({t:'autoplay',on:true}); true`);
  console.log('waiting for round 2');
  await waitFor(`SECTOR_DEBUG.state().turn.round>=2 && SECTOR_DEBUG.state().players[SECTOR_DEBUG.state().turn.idx].id!==SECTOR_DEBUG.you()`, 120000);
  await evalJS(`SECTOR_DEBUG.send({t:'autoplay',on:false}); true`);
  // our resupply menu now waits for us
  console.log('waiting for resupply');
  if (await waitFor(`!document.querySelector('#supply').hidden && document.querySelectorAll('#supply .flip.dealt').length===3`, 120000)) {
    await sleep(600); await shot('resupply-backs');
    await waitFor(`document.querySelectorAll('#supply .flip.open').length===3`, 20000); await sleep(1500);
    await shot('resupply');
    await evalJS(`document.querySelector('#supply .btn.green').click(); true`); await sleep(1500);
  }
  // autoplay so the map fills in; grab a combat on the way
  await evalJS(`SECTOR_DEBUG.send({t:'autoplay',on:true}); true`);
  let gotCombat = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 120000 && !gotCombat) {
    if (await evalJS(`!document.querySelector('#combat').hidden && !!document.querySelector('#combat .cb-result')`)) { await shot('combat'); gotCombat = true; }
    await sleep(250);
  }
  // let the war develop, then frame the whole board
  // (bots finish wars quickly now: stop while all four are still in it, so the board is a war and not a victory screen)
  console.log('developing');
  await waitFor(`SECTOR_DEBUG.state().turn.round>=10 || SECTOR_DEBUG.state().players.filter(p=>p.alive).length<4`, 25000);
  await evalJS(`SECTOR_DEBUG.send({t:'autoplay',on:false}); true`);
  // freeze the event stream so live bot turns don't photobomb the board shots
  await evalJS(`window.SECTOR_PAUSE = true; true`);
  await sleep(9000);
  await evalJS(`for (const s of ['#combat','#crate','#supply','#victory']) document.querySelector(s).hidden = true; document.querySelector('#banner').innerHTML=''; document.querySelector('#toasts').innerHTML=''; true`);
  await waitFor(`document.querySelector('#combat').hidden && document.querySelector('#crate').hidden && document.querySelector('#supply').hidden`, 30000);
  await evalJS(`Render.fitMap(); true`); await sleep(1200);
  await shot('board');
  await evalJS(`(()=>{const S=SECTOR_DEBUG.state(); const me=S.players.find(p=>p.id===SECTOR_DEBUG.you()); Render.focus(me.alive?me.hq:S.players.find(p=>p.alive).hq, 1.5); return true})()`); await sleep(1500);
  await shot('closeup');
  await evalJS(`Cards.showIndex(); true`); await sleep(1500);
  await shot('index');
  await evalJS(`document.querySelector('#index').hidden = true; true`);
  // a staged legendary reveal for the README
  await evalJS(`Cards.demoReveal(['mauler','bastion','seraph']); document.querySelector('#supply h2').textContent='SUPPLY DROP'; true`); await sleep(1700);
  await evalJS(`document.querySelectorAll('#supply .flip')[2].click(); true`); await sleep(2250);
  await shot('legendary');
  ws.close();
  // close the browser (taskkill on Windows, a kill signal elsewhere) and exit, so the script never hangs once it's done
  if (process.platform === 'win32') require('child_process').spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); else { try { proc.kill('SIGKILL'); } catch (e) {} }
  console.log('done'); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
