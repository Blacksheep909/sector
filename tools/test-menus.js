// Walks the front page, rooms, missions and singleplayer like a player and flags anything odd: errors, error toasts,
// panels Esc can't close, screens left on top of each other, and a solo save that won't give your seat back.
// node tools/test-menus.js [screenshot dir]
// walks the menus like a player, reporting anything odd after each step
const { spawn } = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');
const { launch, sleep } = require('./cdp');
const OUT = process.argv[2] || null; if (OUT) fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-'));
let srvLog = '';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: 3085, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_NO_UPDATE: '1', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') } });
srv.stdout.on('data', d => srvLog += d); srv.stderr.on('data', d => srvLog += d);
const issues = []; let n = 0;
(async () => {
  await sleep(1500);
  const b = await launch({ browser: '/opt/pw-browsers/chromium', url: 'http://localhost:3085', width: 1280, height: 760, port: 9485 });
  await sleep(2500);
  await b.evalJS(`window._errs=[]; window._toasts=[]; addEventListener('error', e => _errs.push(e.message + ' @' + (e.filename||'').split('/').pop() + ':' + e.lineno)); addEventListener('unhandledrejection', e => _errs.push('rej ' + (e.reason && e.reason.message || e.reason)));
    new MutationObserver(ms => { for (const m of ms) for (const x of m.addedNodes) if (x.classList && x.classList.contains('toast')) _toasts.push((x.classList.contains('err') ? 'ERR ' : '') + x.textContent.trim().slice(0, 90)); }).observe(document.body, { childList: true, subtree: true }); true`);
  const js = (c, w = 600) => b.evalJS(c + '; true').then(() => sleep(w));
  const click = (sel, w = 700) => js(`(()=>{ const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.offsetParent!==null); if(!e) { window._errs.push('MISSING ${sel.replace(/'/g, '')}'); return; } e.scrollIntoView({block:'nearest'}); const r=e.getBoundingClientRect(), top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); if (top && top!==e && !e.contains(top)) { window._errs.push('COVERED ${sel.replace(/'/g, '')} by ' + (top.id||top.className||top.tagName)); return; } e.click(); })()`, w);
  const key = (k, w = 500) => js(`(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true}))`, w);
  const snap = () => b.evalJS(`JSON.stringify((()=>{
    const vis = e => e && !e.hidden && e.offsetParent !== null || (e && !e.hidden && getComputedStyle(e).position==='fixed' && getComputedStyle(e).display!=='none' && getComputedStyle(e).visibility!=='hidden');
    const ids = ['#home','#lobbyBox','#hud','#escMenu','#missionsModal','#lockerModal','#teamPanel','#joinNet','#index','#rules','#modal','#hostPanel','#victory','#draft','#supply','#crate','#market','#trade','#combat','#missionResult','#partyPanel','#profileModal','#setModal'];
    const open = ids.filter(i => vis(document.querySelector(i)));
    const modals = [...document.querySelectorAll('.modal-bg')].filter(e => !e.hidden && getComputedStyle(e).display!=='none').map(e => '#' + (e.id || e.className));
    const errs = window._errs.splice(0), toasts = window._toasts.splice(0);
    return { open, modals: [...new Set(modals)], errs, toasts, S: !!(window.SECTOR_DEBUG && SECTOR_DEBUG.state()), body: document.body.className };
  })())`).then(JSON.parse);
  async function step(name, fn, expect) {
    await fn(); const s = await snap(); n++;
    const bad = [];
    if (s.errs.length) bad.push('errors: ' + s.errs.join(' | '));
    for (const t of s.toasts) if (t.startsWith('ERR')) bad.push('error toast: ' + t);
    if (expect) { const e = expect(s); if (e) bad.push(e); }
    console.log(String(n).padStart(2), name.padEnd(42), 'open=' + s.open.join(',') + (s.modals.length ? ' modals=' + s.modals.join(',') : '') + (s.toasts.length ? ' toasts=' + JSON.stringify(s.toasts) : ''));
    for (const x of bad) { issues.push(name + ': ' + x); console.log('   !!', x); }
    if (OUT) await b.shot(`${OUT}/${String(n).padStart(2, '0')}-${name.replace(/\W+/g, '-')}.png`);
    return s;
  }
  const only = (...want) => s => { const extra = s.open.filter(x => !want.includes(x)).concat(s.modals.filter(x => !want.includes(x))); return extra.length ? 'unexpected on screen: ' + extra.join(',') : null; };
  await step('front page', () => sleep(10), only('#home'));
  await step('open missions', () => click('#missionsBtn3'), s => s.open.includes('#missionsModal') ? null : 'missions did not open');
  await step('Esc closes missions', () => key('Escape'), only('#home'));
  await step('open locker', () => click('#mmRight [data-o=locker]'), s => s.open.includes('#lockerModal') ? null : 'locker did not open');
  await step('Esc closes locker', () => key('Escape'), only('#home'));
  await step('open store', () => click('#mmRight [data-o=store]'), null);
  await step('Esc closes store', () => key('Escape'), only('#home'));
  await step('open orders', () => click('#mmRight [data-o=orders]'), null);
  await step('Esc closes orders', () => key('Escape'), only('#home'));
  await step('open settings', () => click('#setBtn'), null);
  await step('Esc closes settings', () => key('Escape'), only('#home'));
  await step('type in name box (c, m, t, space)', async () => { await js(`const i=document.querySelector('#nameIn'); i.focus(); i.value='';`, 100); for (const k of ['c', 'm', 't', ' ', 'Escape']) await b.evalJS(`(()=>{const i=document.querySelector('#nameIn'); i.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true}));})(); true`); await sleep(400); }, only('#home'));
  await step('bad room code', async () => { await js(`document.querySelector('#codeIn').value='ZZZZ'`, 50); await click('#codeGo', 300); for (let i = 0; i < 60 && !(await b.evalJS(`window._toasts.some(t => /No room ZZZZ/.test(t))`)); i++) await sleep(500); await b.evalJS(`window._toasts = window._toasts.filter(t => !/No room ZZZZ/.test(t)); true`); }, only('#home'));
  await step('start a party', () => click('#ptNew, .party-btn, [id^=pt] button', 1200), null);
  await step('leave the party', () => click('#ptLeave', 1000), null);
  await step('create private room', () => click('#createBtn', 1500), only('#lobbyBox'));
  await step('add bot + change settings', async () => { await click('#addBot', 500); await js(`const s=document.querySelector('#setTheme'); s.value='arctic'; s.dispatchEvent(new Event('change'))`, 600); }, only('#lobbyBox'));
  await step('Esc in lobby', () => key('Escape'), only('#lobbyBox'));
  await step('open locker from lobby', () => click('#mmRight [data-o=locker]'), null);
  await step('Esc closes it', () => key('Escape'), only('#lobbyBox'));
  await step('leave room', () => click('#rbLeave', 1500), only('#home'));
  await step('settings kept on return? create again', () => click('#createBtn', 1500), only('#lobbyBox'));
  await step('leave room again', () => click('#rbLeave', 1500), only('#home'));
  await step('mission: basic training', async () => { await click('#missionsBtn3', 800); await click('#missionsModal .ms-card, #missionsModal [data-id]', 2500); }, null);
  await step('mission esc menu', () => key('Escape', 700), null);
  const btns = await b.evalJS(`JSON.stringify([...document.querySelectorAll('#escMenu button')].filter(x=>!x.hidden).map(x=>x.textContent.trim()))`); console.log('   esc buttons:', btns);
  await step('quit mission (2 clicks)', async () => { await click('#escLeave', 300); await click('#escLeave', 2000); }, only('#home'));
  await step('missions after quitting', () => click('#missionsBtn3'), null);
  await step('Esc', () => key('Escape'), only('#home'));
  await step('singleplayer', () => click('#soloBtn', 1500), only('#lobbyBox'));
  await step('deploy', async () => { await click('#startBtn', 2500); for (let i = 0; i < 40; i++) { const st = await b.evalJS(`JSON.stringify((()=>{const S=SECTOR_DEBUG.state(); return S ? {ph:S.phase, mine: S.phase==='draft' && !S.draft.picked[SECTOR_DEBUG.you()], step: S.draft && S.draft.step && S.draft.step[SECTOR_DEBUG.you()]} : {}})())`).then(JSON.parse); if (st.ph === 'play') break; if (st.mine) await js(`SECTOR_DEBUG.send({t:'act', action:{a:'draftPick', idx:0}, seq: 9e6 + ${i}})`, 600); else await sleep(400); } await sleep(2000); }, s => s.open.includes('#hud') ? null : 'the war did not start');
  await step('solo esc menu', () => key('Escape', 700), null);
  console.log('   esc buttons:', await b.evalJS(`JSON.stringify([...document.querySelectorAll('#escMenu button')].filter(x=>!x.hidden).map(x=>x.textContent.trim()))`), await b.evalJS(`document.querySelector('#escHint').textContent`));
  await step('leave solo war', async () => { await click('#escLeave', 300); await click('#escLeave', 2500); }, only('#home'));
  await step('singleplayer again: save listed?', () => click('#soloBtn', 1500), s => null);
  console.log('   saves:', await b.evalJS(`(document.querySelector('#saveBox')||{}).hidden + ' ' + ((document.querySelector('.solo-continue')||document.querySelector('#saveList')||{}).textContent||'').slice(0,120)`));
  await step('load the save', () => click('.solo-continue [data-load], #saveList [data-load]', 3000), null);
  const seat = await b.evalJS(`JSON.stringify((()=>{const S=SECTOR_DEBUG.state(), me=S&&S.players.find(p=>p.id===SECTOR_DEBUG.you()); return me ? {name:me.name, bot:!!me.bot} : 'no seat'})())`).then(JSON.parse);
  console.log('   after load, my seat:', JSON.stringify(seat)); if (!seat.name || seat.bot || / \(bot\)/.test(seat.name)) issues.push('loading a solo save did not give the seat back: ' + JSON.stringify(seat));
  await step('leave again', async () => { await key('Escape', 600); await click('#escLeave', 300); await click('#escLeave', 2500); }, only('#home'));
  await step('PLAY (public war)', () => click('#playBtn', 2500), null);
  await step('leave public lobby', () => click('#rbLeave', 1500), only('#home'));
  console.log(issues.length ? '\n' + issues.length + ' FAILED' : '\nall passed'); issues.forEach(i => console.log(' FAIL', i));
  console.log('\nSERVER LOG (errors):'); console.log(srvLog.split('\n').filter(l => /err|warn|exception|TypeError/i.test(l)).slice(0, 20).join('\n'));
  b.close(); srv.kill(); process.exit(issues.length ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
