// Chaos monkey: plays a real war in Chrome with real input, much of it abusive (random clicks, right-clicks, drags, zooms,
// hotkeys, resizes, spam, actions mid-animation), mixed with sensible play so the war moves on. After every few actions it
// checks invariants and records any finding with the last actions and a screenshot. It reports; it doesn't pass or fail.
// node tools/chaos.js [steps=400] [seed] [outdir]
const { spawn } = require('child_process'), path = require('path'), os = require('os'), fs = require('fs');
const { launch, sleep } = require('./cdp');
const STEPS = +(process.argv[2] || 400), SEED = +(process.argv[3] || Date.now() % 100000), OUT = process.argv[4] || path.join(os.tmpdir(), 'chaos-' + SEED);
fs.mkdirSync(OUT, { recursive: true });
let rs = SEED; const rnd = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; }, pick = a => a[Math.floor(rnd() * a.length)];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chs-'));
const PORT = 3100 + (SEED % 50), CPORT = 9500 + (SEED % 50);
let srvLog = '';
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, SECTOR_NO_OPEN: '1', SECTOR_PLAIN: '1', SECTOR_DEV: '1', SECTOR_NO_UPDATE: '1', SECTOR_SAVES: dir, SECTOR_PROFILES: path.join(dir, 'p.json') } });
srv.stdout.on('data', d => srvLog += d); srv.stderr.on('data', d => srvLog += d);
const findings = new Map(), recent = [];
let W = 1280, H = 760, shots = 0, b;
async function note(kind, detail) {
  const key = kind + ': ' + String(detail).replace(/\d+/g, '#').slice(0, 140);
  if (findings.has(key)) { findings.get(key).n++; return; }
  const f = { n: 1, detail: String(detail).slice(0, 400), after: recent.slice(-8), shot: null };
  findings.set(key, f);
  try { f.shot = path.join(OUT, String(++shots).padStart(3, '0') + '-' + kind.replace(/\W+/g, '-') + '.png'); await b.shot(f.shot); } catch (e) {}
  console.log('!! ' + key + '\n   after: ' + f.after.join(' | '));
}
(async () => {
  await sleep(1500);
  b = await launch({ browser: '/opt/pw-browsers/chromium', url: 'http://localhost:' + PORT, width: W, height: H, port: CPORT });
  const js = c => b.evalJS(c), J = async c => JSON.parse(await b.evalJS(`JSON.stringify(${c})`));
  const hooks = `window._errs = window._errs || []; if (!window._hooked) { window._hooked = true; addEventListener('error', e => _errs.push(e.message + ' @' + (e.filename||'').split('/').pop() + ':' + e.lineno)); addEventListener('unhandledrejection', e => _errs.push('rej ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
    window._toasts = []; new MutationObserver(ms => { for (const m of ms) for (const x of m.addedNodes) if (x.classList && x.classList.contains('toast')) _toasts.push((x.classList.contains('err') ? 'ERR ' : '') + x.textContent.trim().slice(0, 80)); }).observe(document.body, { childList: true, subtree: true }); } true`;
  await sleep(2500); await js(hooks);
  const mouse = async (type, x, y, o = {}) => b.cmd('Input.dispatchMouseEvent', { type, x, y, button: o.button || 'left', buttons: o.buttons ?? 0, clickCount: 1, deltaX: o.dx || 0, deltaY: o.dy || 0 });
  const click = async (x, y, button = 'left') => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, { button, buttons: button === 'left' ? 1 : 2 }); await sleep(30 + rnd() * 60); await mouse('mouseReleased', x, y, { button }); };
  const key = async k => { const mods = k.startsWith('ctrl+') ? 2 : 0, kk = k.replace('ctrl+', ''); const code = kk.length === 1 ? (/\d/.test(kk) ? 'Digit' + kk : /[a-z]/.test(kk) ? 'Key' + kk.toUpperCase() : '') : kk;
    await b.cmd('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: kk, code, modifiers: mods, windowsVirtualKeyCode: kk.length === 1 ? kk.toUpperCase().charCodeAt(0) : { Escape: 27, Enter: 13, Tab: 9, ' ': 32 }[kk] || 0 });
    if (kk.length === 1 && !mods) await b.cmd('Input.dispatchKeyEvent', { type: 'char', text: kk, key: kk });
    await b.cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: kk, code, modifiers: mods }); };
  const elCenter = async sel => J(`(()=>{ const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.offsetParent!==null && !x.hidden && x.getBoundingClientRect().width>0); if(!e) return null; const r=e.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; })()`);
  const clickEl = async sel => { const c = await elCenter(sel); if (c) await click(c[0], c[1]); return !!c; };
  const state = () => J(`(()=>{ const S=window.SECTOR_DEBUG&&SECTOR_DEBUG.state(); if(!S) return {none:true}; const you=SECTOR_DEBUG.you(); const cur=S.players[S.turn.idx]; return {phase:S.phase, round:S.turn.round, mine: cur && cur.id===you, stage:S.turn.stage, v:S.v}; })()`);
  // ── get into a war against two bots ──
  await clickEl('#createBtn'); await sleep(1200);
  // the war's settings come from the seed, so different seeds shake different parts of the game
  const settings = { spawns: pick(['random', 'pick']), mapSize: pick(['small', 'small', 'medium']), speed: pick(['fast', 'super', 'normal']), fog: pick(['on', 'off']), mode: pick(['domination', 'conquest', 'koth']), teams: pick(['off', 'off', 'on']), timer: pick(['0', '0', '45']), events: pick(['on', 'off']) };
  console.log('settings', JSON.stringify(settings));
  await js(`SECTOR_DEBUG.send({t:'addBot'}); SECTOR_DEBUG.send({t:'addBot'}); SECTOR_DEBUG.send({t:'addBot'}); SECTOR_DEBUG.send({t:'settings', settings:${JSON.stringify(settings)}}); true`); await sleep(800);
  await clickEl('#startBtn'); await sleep(2500);
  // ── the monkey ──
  const KEYS = ['1', '2', '3', '4', '5', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Escape', 'Escape', 'Enter', ' ', 'Tab', 'e', 'g', 'o', 'i', 'f', 'ctrl+z', 'w', 'a', 's', 'd', 'h', 'p', 'q'];
  let lastProgress = Date.now(), lastSig = '', lastRound = 0, syncChecks = 0;
  for (let step = 0; step < STEPS; step++) {
    const st = await state().catch(() => ({ none: true }));
    const r = rnd(); let act;
    if (r < 0.22) { const x = 10 + rnd() * (W - 20), y = 10 + rnd() * (H - 20); act = `click ${x | 0},${y | 0}`; await click(x, y); }
    else if (r < 0.28) { const x = 10 + rnd() * (W - 20), y = 10 + rnd() * (H - 20); act = `rclick ${x | 0},${y | 0}`; await click(x, y, 'right'); }
    else if (r < 0.40) { const k = pick(KEYS); act = 'key ' + k; await key(k); }
    else if (r < 0.44) { const x = rnd() * W, y = rnd() * H; act = 'wheel'; await mouse('mouseWheel', x, y, { dy: (rnd() - 0.5) * 900 }); }
    else if (r < 0.47) { const x = rnd() * W, y = rnd() * H, x2 = x + (rnd() - 0.5) * 500, y2 = y + (rnd() - 0.5) * 400; act = 'drag'; await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, { buttons: 1 }); for (let i = 1; i <= 5; i++) await mouse('mouseMoved', x + (x2 - x) * i / 5, y + (y2 - y) * i / 5, { buttons: 1 }); await mouse('mouseReleased', x2, y2); }
    else if (r < 0.49) { [W, H] = pick([[1280, 760], [1440, 900], [1024, 640], [1920, 1080], [900, 600], [1366, 768]]); act = `resize ${W}x${H}`; await b.cmd('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }); await sleep(300); }
    else if (r < 0.53) { act = 'spam END TURN'; const c = await elCenter('#endBtn'); if (c) for (let i = 0; i < 4; i++) { await click(c[0], c[1]); await sleep(40); } }
    else if (r < 0.57) { act = 'click a hand card'; const c = await elCenter(pick(['#hand .card', '#hbUnits .card', '#hbBuild .slot'])); if (c) await click(c[0] + (rnd() - 0.5) * 30, c[1] + (rnd() - 0.5) * 30); }
    else if (r < 0.62) { act = 'click a lit/own hex'; const k = await J(`(()=>{ const ov=Render.ov; const pool=[...(ov.spawn||[]), ...(ov.targets||[]), ...Object.keys(ov.reach||{}), ...Object.values((window.SECTOR_DEBUG&&SECTOR_DEBUG.state()||{units:{}}).units).filter(u=>u.owner===SECTOR_DEBUG.you()).map(u=>u.hex)]; return pool.length ? pool[Math.floor(Math.random()*pool.length)] : null; })()`); if (k) { const [x, y] = await J(`Render.screenOf(${JSON.stringify(k)})`); await click(x, y); } }
    else if (r < 0.66) { act = 'double-click a UI button'; const c = await elCenter(pick(['#supply button', '#crate .flip', '#draft .flip', '#crate .btn', '.reveal-all', '#market .btn', '#escMenu button', '.chipbtns button', '#combat'])); if (c) { await click(c[0], c[1]); await click(c[0], c[1]); } }
    else if (r < 0.70) { act = 'open/close panels fast'; for (const s of ['#menuBtn', '#indexBtn', '#rulesBtn', '#marketBtn']) { const c = await elCenter(s); if (c) await click(c[0], c[1]); } await key('Escape'); await key('Escape'); }
    else if (r < 0.72) { act = 'type in chat'; await key('t'); await sleep(100); for (const ch of 'gg <b>x</b>') await key(ch); await key('Enter'); }
    else {
      // sensible play keeps the war moving: collect, reveal, pick, end turn when stuck
      act = 'play';
      const spawn = st.phase === 'spawn' ? await J(`(()=>{ try { const S=SECTOR_DEBUG.state(); if (S.spawn.order[S.spawn.i] !== SECTOR_DEBUG.you()) return null; const c=SectorEngine.spawnChoices(S); return c.length ? Render.screenOf(c[Math.floor(Math.random()*c.length)]) : null; } catch(e) { return null; } })()`) : null;
      if (spawn) { await click(spawn[0], spawn[1]); act += ' spawn-pick'; }
      else if (await clickEl('#draft .flip:not(.open)')) act += ' draft-reveal';
      else if (await clickEl('#draft .flip.open')) act += ' draft-pick';
      else if (await clickEl('#crate .pack')) act += ' tear';
      else if (await clickEl('#crate .flip:not(.open)')) act += ' crate-reveal';
      else if (await clickEl('#crate .flip.open')) act += ' crate-pick';
      else if (st.mine && st.stage === 'choose' && await clickEl('#supply .btn.green')) act += ' collect';
      else if (await clickEl('#battlePop #bpReady, #owPop #owFire')) act += ' battle';
      else if (st.mine && st.stage === 'act' && rnd() < 0.5 && await clickEl('#endBtn')) act += ' end';
    }
    recent.push(step + ':' + act); if (recent.length > 20) recent.shift();
    await sleep(80 + rnd() * 200);
    // ── invariants ──
    if (step % 3 === 0) {
      const h = await J(`(()=>{ const vis = s => { const e=document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display!=='none' && getComputedStyle(e).visibility!=='hidden'; };
        const over = ['#escMenu','#index','#rules','#market','#trade','#crate','#draft','#supply','#combat','#victory','#lockerModal','#missionsModal','#teamPanel','#hostPanel','#allyPop','#offerPop'].filter(vis);
        const off = ['#endBtn','#hand','#hbUnits','#hbBuild','#players','#cashBox'].filter(s => { const e=document.querySelector(s); if(!e||e.hidden||!e.offsetParent) return false; const r=e.getBoundingClientRect(); return r.width>0 && (r.right < 4 || r.bottom < 4 || r.left > innerWidth - 4 || r.top > innerHeight - 4); });
        const clipped = ['#endBtn'].filter(s => { const e=document.querySelector(s); if(!e||e.hidden||!e.offsetParent) return false; const r=e.getBoundingClientRect(); return r.bottom > innerHeight + 2 || r.right > innerWidth + 2; });
        return { errs: (window._errs||[]).splice(0), toasts: (window._toasts||[]).splice(0).filter(t=>t.startsWith('ERR')), over, off, clipped, hud: vis('#hud'), menu: vis('#menu') }; })()`).catch(e => ({ errs: ['eval failed: ' + e.message] }));
      for (const e of h.errs || []) await note('js error', e);
      for (const t of h.toasts || []) if (!/Not enough|Need \$|Not your turn|valid target|Pick a|first|Can't|cannot|can't|Wait|already|too close|Too close|out of range|No |Invalid|Nothing|Only|must|blocked|full|spent|Already|stole your|played live|highlighted|Deploy at|Launch ships|costs \$|you have \$|Blueprint|takes two|Not a valid|Pick one|isn't|Cut off|Fallout|Hex is|on your own|Mines go|That goes|Ports must|Build on|Bridge|river|Nowhere|Lost |lost /.test(t)) await note('unexpected error toast', t);
      { const under = (h.over || []).filter(x => !['#escMenu', '#index', '#rules', '#hostPanel'].includes(x)); if (under.length > 1 && !(under.length === 2 && under.includes('#supply') && (under.includes('#market') || under.includes('#trade'))) && !(under.includes('#trade') && under.length === 2 && (under.includes('#allyPop') || under.includes('#offerPop')))) await note('screens on top of each other', under.join(' + ')); }   // the pause menu and help screens sit over anything
      for (const s of h.off || []) await note('off screen', s + ' at ' + W + 'x' + H);
      for (const s of h.clipped || []) await note('cut off by the window edge', s + ' at ' + W + 'x' + H);
      if (h.hud && h.menu) await note('menu and game both showing', '');
      // stalls: the game should move (a new round, or the board changing) at least every 45 seconds
      const sig = JSON.stringify([st.round, st.v, st.phase]);
      if (sig !== lastSig) { lastSig = sig; lastProgress = Date.now(); }
      // only while someone else should be moving (on your own turn the game waits for you)
      if (Date.now() - lastProgress > 45000 && st.phase === 'play' && !st.mine) { await note('stall', JSON.stringify(st) + ' nothing changed for 45s'); lastProgress = Date.now(); }
    }
    // a desync check every few rounds: what the client shows vs a fresh copy from the server (reload = reconnect)
    if (st.phase === 'play' && st.round >= lastRound + 3 && syncChecks < 4) {
      lastRound = st.round;
      for (let i = 0; i < 40 && (await J(`!!(SECTOR_DEBUG.busy && SECTOR_DEBUG.busy().animating)`)); i++) await sleep(150);
      await sleep(400);
      const snap = `(()=>{ const S=SECTOR_DEBUG.state(); return { v:S.v, units: Object.values(S.units).map(u=>u.id+'@'+u.hex+':'+u.owner).sort(), own: Object.keys(S.map.tiles).filter(k=>S.map.tiles[k].owner).map(k=>k+'='+S.map.tiles[k].owner).sort(), cash: S.players.map(p=>p.id+':'+p.cash), st: Object.keys(S.map.tiles).flatMap(k=>(S.map.tiles[k].structs||[]).map(x=>k+':'+x.type+x.lvl+(x.lock?'L':''))).sort() }; })()`;
      const before = await J(snap);
      await b.cmd('Page.reload'); await sleep(4000); await js(hooks);
      for (let i = 0; i < 30 && !(await J(`!!(window.SECTOR_DEBUG && SECTOR_DEBUG.state())`)); i++) await sleep(300);
      await sleep(1500);
      const after = await J(snap).catch(() => null);
      syncChecks++;
      if (!after) await note('reconnect', 'no game after reloading the page');
      else if (after.v === before.v) {
        for (const f of ['units', 'own', 'cash', 'st']) { const a = new Set(before[f]), bb = new Set(after[f]); const miss = [...a].filter(x => !bb.has(x)), extra = [...bb].filter(x => !a.has(x)); if (miss.length || extra.length) await note('desync ' + f, 'client had ' + JSON.stringify(miss.slice(0, 4)) + ' server has ' + JSON.stringify(extra.slice(0, 4))); }
      }
      recent.push('reload (sync check v' + before.v + (after ? ' -> v' + after.v : '') + ')');
    }
    if (st.phase === 'over') { recent.push('game over'); break; }
  }
  const serverErr = srvLog.split('\n').filter(l => /error|TypeError|ReferenceError|exception|at .*\.js:\d+/i.test(l)).slice(0, 15);
  for (const l of serverErr) await note('server log', l);
  console.log(`\n${findings.size} finding${findings.size === 1 ? '' : 's'} (seed ${SEED}, screenshots in ${OUT})`);
  for (const [k, f] of findings) console.log(` - ${k}  ×${f.n}\n     ${f.detail}\n     after: ${f.after.slice(-4).join(' | ')}`);
  b.close(); srv.kill(); process.exit(0);
})().catch(e => { console.error(e); try { b.close(); } catch (x) {} srv.kill(); process.exit(1); });
