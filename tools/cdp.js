// Headless Edge/Chrome over the DevTools protocol (no deps). Shared by screenshots.js and e2e tests.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function launch({ browser, url, width = 1600, height = 900, port = 9333 }) {
  const prof = path.join(require('os').tmpdir(), 'sector-cdp-' + Date.now());
  const proc = spawn(browser || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, `--window-size=${width},${height}`, '--hide-scrollbars', ...(process.platform === 'win32' ? [] : ['--no-sandbox']), 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); target = list.find(t => t.type === 'page'); } catch (e) {} }
  if (!target) throw new Error('browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = {};
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result && r.result.result && r.result.result.value; };
  const shot = async (file) => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); console.log('saved', path.basename(file)); };
  const waitFor = async (expr, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evalJS(expr)) return true; await sleep(150); } return false; };
  // never leave a headless browser behind, even if the test crashes (it would keep rejoining the next test's lobby).
  // Edge hands off to child processes, so kill everything using this run's private profile folder
  const killAll = () => { try {
    if (process.platform === 'win32') require('child_process').spawnSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(prof)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' });
    else proc.kill();
  } catch (e) {} };
  process.on('exit', killAll);
  process.on('unhandledRejection', e => { console.error(e); process.exit(1); });
  await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.enable');
  await cmd('Page.navigate', { url });
  await sleep(2500);
  return { cmd, evalJS, shot, waitFor, close: () => { try { ws.close(); } catch (e) {} killAll(); } };
}
module.exports = { launch, sleep };
