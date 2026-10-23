// UI audit: visits every screen and modal it can reach and checks each visible button can actually be clicked
// (nothing covering its centre), and that nothing throws. node tools/ui-audit.js  (starts its own server on 3016)
// Needs Chromium: set SECTOR_BROWSER, or it uses /opt/pw-browsers/chromium.
const { spawn } = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');
const { launch, sleep } = require('./cdp');
const PORT = 3016, U = 'http://localhost:' + PORT, W = +(process.env.W || 1454), H = +(process.env.H || 711);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sector-audit-'));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_DEV: '1', SECTOR_NO_UPDATE: '1', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') }, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch (e) {} });
let problems = 0;
(async () => {
  await sleep(900);
  const b = await launch({ browser: process.env.SECTOR_BROWSER || '/opt/pw-browsers/chromium', url: U, width: W, height: H, port: 9390 });
  const { evalJS } = b; await sleep(1800);
  await evalJS(`window.__err=[]; window.onerror=(m,s,l,c)=>{__err.push(m+' @'+(s||'').split('/').pop()+':'+l)}; window.addEventListener('unhandledrejection',e=>__err.push('rej '+e.reason)); true`);
  // every visible, enabled button: is its centre (and a point a little in) really the button?
  const audit = async label => {
    const r = JSON.parse(await evalJS(`JSON.stringify((()=>{
      const out = [], seen = new Set();
      const vis = e => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
      // an open modal is the only thing you can use: check the buttons in the top one (it's meant to cover the rest)
      const layers = [...document.querySelectorAll('.modal-bg, #index, #rules, #modal, #escMenu, #draft, #supply, #crate, #trade, #victory, #passCover, #crateOpen, #combat')].filter(m => !m.hidden && vis(m) && !m.closest('[hidden]'));
      const top = layers.sort((a, b2) => (+getComputedStyle(b2).zIndex || 0) - (+getComputedStyle(a).zIndex || 0))[0];
      for (const e of (top || document).querySelectorAll('button, .btn, .chip, [data-tab], .fac, .ms-card:not(.locked), .lk-tile .btn, .pt-m, .lb-r')) {
        if (seen.has(e) || e.disabled || !vis(e) || e.closest('[hidden]')) continue; seen.add(e);
        const r = e.getBoundingClientRect(); let bad = null;
        for (const [fx, fy] of [[.5, .5], [.25, .5], [.75, .5]]) {
          const x = r.left + r.width * fx, y = r.top + r.height * fy; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
          const t = document.elementFromPoint(x, y);
          if (t && t !== e && !e.contains(t) && !t.contains(e)) { bad = t; break; }
        }
        if (bad) { const nm = n => (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\\s+/).slice(0,2).join('.') : '') || n.tagName; const top = bad.closest('[id]'); out.push((e.id ? '#' + e.id : (e.textContent || '').trim().slice(0, 24)) + ' ← covered by ' + nm(bad) + (top && top !== bad ? ' (in #' + top.id + ')' : '')); }
      }
      return { n: seen.size, layer: top ? '#' + (top.id || top.className) : 'page', screen: !document.querySelector('#hud').hidden ? 'game' : 'menu', covered: out, err: __err.splice(0) };
    })())`));
    const bad = r.covered.length + r.err.length; problems += bad;
    console.log((bad ? 'PROBLEM ' : 'ok      ') + label + ' · ' + r.n + ' buttons on ' + r.screen + ' / ' + r.layer + (r.covered.length ? '\n          covered: ' + r.covered.join('\n                   ') : '') + (r.err.length ? '\n          errors: ' + r.err.join(' | ') : ''));
    if (bad) await b.shot(path.join(process.env.AUDIT_OUT || os.tmpdir(), 'audit-' + label.replace(/[^a-z0-9]+/gi, '-') + '.png'));
  };
  const js = (code, wait = 600) => evalJS(code + '; true').then(() => sleep(wait));
  const click = (sel, wait = 700) => js(`(()=>{ const e=document.querySelector(${JSON.stringify(sel)}); if (e) e.click(); })()`, wait);
  const esc = () => js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`, 400);
  const closeModals = () => js(`document.querySelectorAll('.modal-bg:not([hidden]) [data-x], .modal-bg:not([hidden]) #lkClose, .modal-bg:not([hidden]) #msClose, #lanClose').forEach(b=>b.offsetParent && b.click())`, 500);

  await js(`SECTOR_DEBUG.send({t:'devCoins'})`, 500);
  await audit('front page');
  for (const t of ['locker', 'store', 'orders']) { await js(`Locker.show('${t}')`); await audit(t); if (t === 'store') for (const i of [1, 2, 3]) { await js(`document.querySelectorAll('.st-tabs button')[${i}].click()`); await audit('store tab ' + (i + 1)); } if (t === 'locker') for (const i of [1, 2, 3, 4]) { await js(`document.querySelectorAll('#lockerModal .ix-tabs button')[${i}] && document.querySelectorAll('#lockerModal .ix-tabs button')[${i}].click()`); await audit('locker tab ' + (i + 1)); } await click('#lkClose'); }
  await click('#setBtn'); await audit('settings'); await closeModals();
  await click('.cc-chip', 900); await audit('own profile'); await closeModals();
  await click('#nwAll'); await audit('patch notes'); await closeModals();
  await click('#lanFind', 900); await audit('LAN games'); await click('#lanClose');
  await click('#missionsBtn3'); await audit('missions board'); await click('#msClose');
  await click('#indexBtn3', 900); await audit('card index'); await esc();
  await click('#rulesBtn3', 900); await audit('how to play'); await esc();
  await click('#ptNew'); await audit('front page with a party');
  // a private room
  await click('#createBtn', 1200); await audit('private lobby');
  await click('#addBot', 500); await audit('private lobby with a bot');
  await js(`SECTOR_DEBUG.send({t:'settings',settings:{spawns:'random', speed:'super'}})`, 400);
  await click('#startBtn', 6000);
  await audit('opening draft');
  // make the three draft picks (straight through the game's own action), then look at the real HUD
  for (let i = 0; i < 40; i++) { const ph = await evalJS(`(SECTOR_DEBUG.state()||{}).phase`); if (ph === 'play') break; await js(`(()=>{ const S=SECTOR_DEBUG.state(); if (S && S.phase==='draft' && !S.draft.picked[SECTOR_DEBUG.you()]) SECTOR_DEBUG.send({t:'act', action:{a:'draftPick', idx:0}, seq: 9e6 + S.draft.step[SECTOR_DEBUG.you()]}); })()`, 700); }
  await sleep(2500); console.log('   state:', await evalJS(`JSON.stringify((()=>{ const S=SECTOR_DEBUG.state(); return S && { phase: S.phase, picked: S.draft && S.draft.picked, step: S.draft && S.draft.step, rounds: S.draft && S.draft.rounds, you: SECTOR_DEBUG.you(), offers: S.draft && S.draft.offers, toasts: [...document.querySelectorAll('.toast')].map(t=>t.textContent), draftHidden: document.querySelector('#draft').hidden, txt: (document.querySelector('#draft').textContent||'').slice(0,120) }; })())`));
  await audit('in a war (HUD)');
  await js(`(()=>{ const S=SECTOR_DEBUG.state(), me=SECTOR_DEBUG.you(), u=Object.values(S.units).find(u=>u.owner===me); if (u) SECTOR_DEBUG.click(u.hex); })()`, 800);
  await audit('in a war, a unit selected');
  await esc(); await audit('Esc menu'); await esc();
  await js(`(()=>{ const l=[...document.querySelectorAll('#escMenu button')].find(x=>/LEAVE/i.test(x.textContent)); })()`);
  await esc(); await js(`(()=>{ const l=[...document.querySelectorAll('#escMenu button')].find(x=>/LEAVE/i.test(x.textContent)); l && l.click(); l && l.click(); })()`, 1800);
  await audit('front page after leaving a war');
  // leave straight after DEPLOY (the map reel used to stay on top of everything)
  await click('#createBtn', 1100); await click('#addBot', 400); await click('#startBtn', 150); await click('#rbLeave', 2500);
  await audit('front page after leaving right after deploy');
  // a mission
  await click('#missionsBtn3'); await js(`document.querySelector('.ms-card:not(.locked)').click()`, 3000);
  await audit('mission (tutorial)');
  await click('#endBtn', 4000); await audit('mission after End Turn');
  await esc(); await js(`(()=>{ const l=[...document.querySelectorAll('#escMenu button')].find(x=>/LEAVE/i.test(x.textContent)); l && l.click(); l && l.click(); })()`, 1800);
  await audit('front page after leaving a mission');
  // public war lobby
  await click('#playBtn', 1200); await audit('public lobby'); await click('#rbLeave', 900);
  console.log(problems ? problems + ' problem(s)' : 'no problems');
  b.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  process.exit(problems ? 1 : 0);
})();
