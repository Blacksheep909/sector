/* SECTOR — missions: the board of puzzle scenarios, General Hale (the guide), the mission bar and the result screen.
   The server builds and referees each mission (shared/scenarios.js); this file only presents them. */
const Missions = (() => {
  const SC = SectorScenarios, $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const D = () => window.SECTOR_DEBUG;
  const TIER = { Tutorial: '#59f08a', Easy: '#3fd07a', Medium: '#3fa0ff', Hard: '#c25cff', 'Very Hard': '#ff7a3a', Expert: '#ff4f5e', Impossible: '#ffb52e' };

  // progress: kept on your profile when you have one, and in this browser either way
  const local = () => { try { return JSON.parse(localStorage.getItem('sector.missions') || '[]'); } catch (e) { return []; } };
  const cleared = () => new Set([...local(), ...((typeof Locker !== 'undefined' && Locker.profile && Locker.profile.scenarios) || [])]);
  const markCleared = id => { try { const l = local(); if (!l.includes(id)) { l.push(id); localStorage.setItem('sector.missions', JSON.stringify(l)); } } catch (e) {} };
  const unlocked = (sc, done) => sc.n === 1 || SC.SCENARIOS.some(o => o.n === sc.n - 1 && done.has(o.id));

  // ── General Hale ──
  // General Hale: a peaked officer's cap with gold braid, grey moustache, general's stars on his collar, medal ribbons
  const HALE = `<svg viewBox="10 13 80 80" class="hale-face"><defs><radialGradient id="hgBg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#3a4f63"/><stop offset="1" stop-color="#0e151c"/></radialGradient><linearGradient id="hgCap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a8c52"/><stop offset="1" stop-color="#4c5b31"/></linearGradient><linearGradient id="hgBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4625"/><stop offset="1" stop-color="#252d17"/></linearGradient><linearGradient id="hgCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#607241"/><stop offset="1" stop-color="#3a4626"/></linearGradient><linearGradient id="hgSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eec59e"/><stop offset="1" stop-color="#d6a47c"/></linearGradient><linearGradient id="hgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".5" stop-color="#e0b040"/><stop offset="1" stop-color="#9c7020"/></linearGradient><linearGradient id="hgVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4048"/><stop offset=".35" stop-color="#14181d"/><stop offset="1" stop-color="#05070a"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#hgBg)"/><path d="M4 104C6 87 21 79.5 50 78.5C79 79.5 94 87 96 104Z" fill="url(#hgCoat)"/><path d="M42 78.5L50 91L58 78.5Z" fill="#dccfa6"/><path d="M48 80.5H52L53.6 97L50 101L46.4 97Z" fill="#2b2318"/><path d="M47.2 78.8H52.8L52.2 81.6H47.8Z" fill="#3b3022"/><path d="M38.5 78L50 93.5L44 104H29L27.5 85Z" fill="#56683b" stroke="#2c361c" stroke-width=".9"/><path d="M61.5 78L50 93.5L56 104H71L72.5 85Z" fill="#56683b" stroke="#2c361c" stroke-width=".9"/><g stroke="#111" stroke-width=".3"><rect x="55.2" y="85.6" width="3" height="1.6" fill="#b3202a"/><rect x="55.2" y="87.2" width="3" height="1.6" fill="#2f8a4a"/><rect x="58.2" y="85.6" width="3" height="1.6" fill="#2b5fb3"/><rect x="58.2" y="87.2" width="3" height="1.6" fill="#7a3fb3"/><rect x="61.2" y="85.6" width="3" height="1.6" fill="#e0b13a"/><rect x="61.2" y="87.2" width="3" height="1.6" fill="#cfcfcf"/></g><g fill="#eef0f2" stroke="#7d828a" stroke-width=".25"><path d="M37.20 80.30 L37.52 81.16 L38.44 81.20 L37.72 81.77 L37.96 82.65 L37.20 82.15 L36.44 82.65 L36.68 81.77 L35.96 81.20 L36.88 81.16Z"/><path d="M33.90 82.40 L34.22 83.26 L35.14 83.30 L34.42 83.87 L34.66 84.75 L33.90 84.25 L33.14 84.75 L33.38 83.87 L32.66 83.30 L33.58 83.26Z"/><path d="M62.80 80.30 L63.12 81.16 L64.04 81.20 L63.32 81.77 L63.56 82.65 L62.80 82.15 L62.04 82.65 L62.28 81.77 L61.56 81.20 L62.48 81.16Z"/><path d="M66.10 82.40 L66.42 83.26 L67.34 83.30 L66.62 83.87 L66.86 84.75 L66.10 84.25 L65.34 84.75 L65.58 83.87 L64.86 83.30 L65.78 83.26Z"/></g><path d="M43 64V80Q50 83 57 80V64Z" fill="#d09d75"/><path d="M43 72.5Q50 76 57 72.5" fill="none" stroke="#b4835f" stroke-width=".9"/><path d="M35.5 48C32 47 30.5 50 31 54S33.5 60.5 36 59.5Z" fill="#d8a57d"/><path d="M64.5 48C68 47 69.5 50 69 54S66.5 60.5 64 59.5Z" fill="#d8a57d"/><path d="M34.6 50.5Q32.6 53.5 34.4 57" fill="none" stroke="#b98762" stroke-width=".8"/><path d="M65.4 50.5Q67.4 53.5 65.6 57" fill="none" stroke="#b98762" stroke-width=".8"/><path d="M35 40H65V58C65 66 59 73.5 50 73.5S35 66 35 58Z" fill="url(#hgSkin)"/><path d="M35.6 60C37 67 42 72 50 73" fill="none" stroke="#c08b65" stroke-width="1" opacity=".6"/><path d="M64.4 60C63 67 58 72 50 73" fill="none" stroke="#c08b65" stroke-width="1" opacity=".6"/><path d="M35 43.5C36.4 43.5 37.6 44 37.8 45.2C37.6 48.5 36.9 51.5 35.6 54C35.2 50.5 35 47 35 43.5Z" fill="#9fa099"/><path d="M65 43.5C63.6 43.5 62.4 44 62.2 45.2C62.4 48.5 63.1 51.5 64.4 54C64.8 50.5 65 47 65 43.5Z" fill="#9fa099"/><path d="M35.6 46.5C36.2 48.5 36.2 50.5 35.8 52.5M64.4 46.5C63.8 48.5 63.8 50.5 64.2 52.5" fill="none" stroke="#bdbeb7" stroke-width=".5"/><path d="M35 46.5C42 49.6 58 49.6 65 46.5V50C58 52.6 42 52.6 35 50Z" fill="#6a4630" opacity=".22"/><path d="M39.2 51.8L46.2 52.9" stroke="#909089" stroke-width="2.2" stroke-linecap="round"/><path d="M60.8 51.8L53.8 52.9" stroke="#909089" stroke-width="2.2" stroke-linecap="round"/><path d="M39.8 55.4Q42.8 53.6 45.8 55.4Q42.8 56.8 39.8 55.4Z" fill="#fbf6ee"/><path d="M54.2 55.4Q57.2 53.6 60.2 55.4Q57.2 56.8 54.2 55.4Z" fill="#fbf6ee"/><circle cx="42.9" cy="55.2" r="1.25" fill="#2a3a46"/><circle cx="57.1" cy="55.2" r="1.25" fill="#2a3a46"/><path d="M39.6 55.2Q42.8 53.3 46 55" fill="none" stroke="#4a3426" stroke-width=".9"/><path d="M60.4 55.2Q57.2 53.3 54 55" fill="none" stroke="#4a3426" stroke-width=".9"/><path d="M50 54.5C49.4 57 48.2 59.6 47.4 61.2C48.6 62.6 51.4 62.6 52.6 61.2C51.8 59.6 50.6 57 50 54.5Z" fill="#c99470"/><path d="M47.6 61.3Q50 62.9 52.4 61.3" fill="none" stroke="#a8724f" stroke-width=".8"/><path d="M44.6 60.5Q43.4 63.6 44 66.2M55.4 60.5Q56.6 63.6 56 66.2" fill="none" stroke="#c08b65" stroke-width=".7"/><path d="M41.5 66.6C43.6 63.6 47.6 63.2 50 64.6C52.4 63.2 56.4 63.6 58.5 66.6C55.8 67.6 53 67.2 50 66.4C47 67.2 44.2 67.6 41.5 66.6Z" fill="#a9aaa3" stroke="#83847e" stroke-width=".5"/><path d="M46.6 69.4Q50 70.2 53.4 69.4" fill="none" stroke="#8d5343" stroke-width="1" stroke-linecap="round"/><path d="M27.5 33C28 24.5 38.5 20 50 20S72 24.5 72.5 33C72.5 35.4 70 37 66.5 37H33.5C30 37 27.5 35.4 27.5 33Z" fill="url(#hgCap)" stroke="#2c361c" stroke-width=".9"/><path d="M31.5 27.5Q50 20.5 68.5 27.5" fill="none" stroke="#91a267" stroke-width="1.2" opacity=".55"/><path d="M33 36.4H67L66 43.4H34Z" fill="url(#hgBand)"/><path d="M34.4 41.7H65.6" stroke="url(#hgGold)" stroke-width="1.5"/><circle cx="35.2" cy="41.7" r=".8" fill="#ffe7a0"/><circle cx="64.8" cy="41.7" r=".8" fill="#ffe7a0"/><g transform="translate(50 30.2) scale(.72)"><path d="M-10 0Q-6 -3.4 -2.4 -.6Q-6 1.2 -10 0ZM10 0Q6 -3.4 2.4 -.6Q6 1.2 10 0Z" fill="url(#hgGold)"/><path d="M0 -6L1.8 -1.9L6.2 -1.6L2.8 1.2L3.9 5.5L0 3.3L-3.9 5.5L-2.8 1.2L-6.2 -1.6L-1.8 -1.9Z" fill="url(#hgGold)" stroke="#6b4c12" stroke-width=".5"/></g><path d="M32 42.6C39 41.6 61 41.6 68 42.6L70.4 46.6C61 49.8 39 49.8 29.6 46.6Z" fill="url(#hgVisor)"/><path d="M33 45.3C40 47.4 60 47.4 67 45.3" fill="none" stroke="url(#hgGold)" stroke-width="1.9" stroke-dasharray="2.6 1.2" stroke-linecap="round"/><path d="M33.2 43.4C40 42.6 60 42.6 66.8 43.4" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".7"/></svg>`;
  // every copy of the portrait gets gradient names of its own. Copies sharing names (the speech bubble and the result
  // card) made one draw with the other's gradients, and when that copy was hidden the face and cap came out black
  let haleN = 0;
  const hale = () => { const k = ++haleN; return HALE.replace(/\bhg([A-Z][A-Za-z]*)/g, 'hg$1' + k); };
  let guide = null;   // { steps, i, wait } while a mission's script is running
  function say(html, opts = {}) {
    let b = $('#hale'); if (!b) { b = el('div', '', ''); b.id = 'hale'; document.body.appendChild(b); }
    b.className = opts.wide ? 'wide' : '';
    b.innerHTML = `${hale()}<div class="hale-bubble"><div class="hale-name">GEN. HALE</div><div class="hale-text">${html}</div><div class="hale-act"></div></div>`;
    const act = b.querySelector('.hale-act');
    if (opts.next) { const n = el('button', 'btn tiny gold', opts.nextLabel || 'NEXT ▶'); n.onclick = () => { if (typeof SFX !== 'undefined') SFX.click(); opts.next(); }; act.appendChild(n); }
    if (opts.close) { const x = el('button', 'btn tiny', 'GOT IT'); x.onclick = () => { b.remove(); }; act.appendChild(x); }
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    if (typeof SFX !== 'undefined') SFX.select();
  }
  const hush = () => { const b = $('#hale'); if (b) b.remove(); };

  // ── the mission board (from the lobby) ──
  function board() {
    let m = $('#missionsModal'); if (!m) { m = el('div', 'modal-bg'); m.id = 'missionsModal'; document.body.appendChild(m); }
    m.hidden = false; m.innerHTML = '';
    // unlocks follow anything you've cleared; the Valor badge follows what this commander has been paid for (once each)
    const done = cleared(), paid = new Set((typeof Locker !== 'undefined' && Locker.profile && Locker.profile.scenarios) || []), p = el('div', 'panel ms-panel');
    p.innerHTML = `<div class="ix-head"><h2>MISSIONS</h2><div class="sub">${done.size} / ${SC.SCENARIOS.length} cleared · puzzles that teach a technique each, from basic training to impossible</div><button class="btn" id="msClose">✕</button></div>`;
    const grid = el('div', 'ms-grid');
    for (const sc of SC.SCENARIOS.slice().sort((a, b) => a.n - b.n)) {
      const open = unlocked(sc, done), ok = done.has(sc.id);
      const t = el('div', 'ms-card' + (open ? '' : ' locked') + (ok ? ' done' : ''));
      t.style.setProperty('--tc', TIER[sc.tier] || '#9fb3c8');
      t.innerHTML = `<div class="ms-n">${sc.n}</div><div class="ms-tier">${sc.tier.toUpperCase()}</div><h3>${esc(sc.name)}</h3><div class="ms-tech">${esc(sc.technique)}</div><div class="ms-brief">${esc(sc.brief)}</div>
        <div class="ms-foot"><span>⏱ ${sc.turns} turn${sc.turns > 1 ? 's' : ''}</span><span>${paid.has(sc.id) ? '✔ CLEARED' : `<i class="vm"></i>${sc.reward}${ok ? ' · first clear' : ''}`}</span></div>${open ? '' : '<div class="ms-lock">🔒 Clear mission ' + (sc.n - 1) + ' first</div>'}`;
      if (open) t.onclick = () => { if (typeof SFX !== 'undefined') SFX.select(); start(sc.id); };
      grid.appendChild(t);
    }
    p.appendChild(grid); m.appendChild(p);
    $('#msClose').onclick = () => { m.hidden = true; };
    m.onclick = e => { if (e.target === m) m.hidden = true; };
  }
  function start(id) {
    const m = $('#missionsModal'); if (m) m.hidden = true;
    clouds(() => D().send({ t: 'scenario', id }), ready(id));
  }
  // a mission is on screen: its board is built and you're playing it
  const ready = id => () => { const st = D().state(); return !!(st && st.scenario && st.scenario.id === id && st.phase === 'play'); };
  // one bank of dark war-smoke, cartoon style: lumps with a dark outline, a shadowed base and a lit top, filling the
  // canvas and ending in a lumpy edge on the right (the right-hand bank is the same drawing, mirrored)
  function paintClouds(cv, seed) {
    const W = Math.ceil(innerWidth * 0.62), H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
    let s = seed * 9301 + 49297; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const R = Math.max(70, Math.min(W * 1.6, H) * 0.17), puffs = [];
    for (let y = -R * 0.5; y < H + R; y += R * 1.05) for (let x = -R * 0.3; x < W - R * 1.4; x += R * 1.25) puffs.push([x + rnd() * R * 0.7, y + rnd() * R * 0.6, R * (0.9 + rnd() * 0.5)]);
    for (let y = -R * 0.4; y < H + R * 0.5; y += R * 0.72) { const r = R * (0.55 + rnd() * 0.6); puffs.push([W - 4 - r - R * rnd() * 0.75, y + rnd() * R * 0.3, r]); }   // the lumpy leading edge (inside the canvas, so never cut straight)
    for (const p of puffs) p[0] = Math.min(p[0], W - 4 - p[2]);   // every lump inside the canvas: a lump past its edge would be sliced off straight
    puffs.sort((a, b) => a[1] - b[1]);   // painted top to bottom: each lump sits in front of the ones above it
    const disc = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    g.fillStyle = '#1b2129'; g.fillRect(0, 0, W - R * 1.7, H);   // no gaps behind the lumps
    for (const [x, y, r] of puffs) {
      g.fillStyle = '#0d1116'; disc(x, y, r + 2.5);   // a thin dark rim where one lump meets the next
      // soft volume: light from the top left, the underside falling away into shadow
      const sh = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.05, x - r * 0.05, y - r * 0.05, r * 1.05);
      sh.addColorStop(0, '#3c4652'); sh.addColorStop(0.35, '#2b333d'); sh.addColorStop(0.75, '#1e242c'); sh.addColorStop(1, '#161b21');
      g.fillStyle = sh; disc(x, y, r);
    }
  }
  // clouds roll in from both sides, the next screen loads behind them, then they part (instead of a jump and a stutter)
  function clouds(work, isReady) {
    let c = $('#clouds');
    if (!c) { c = el('div', 'clouds', ''); c.id = 'clouds'; for (const side of ['l', 'r']) c.appendChild(el('canvas', 'cl-side ' + side)); document.body.appendChild(c); }
    for (const cv of c.querySelectorAll('canvas')) paintClouds(cv, cv.classList.contains('r') ? 7 : 3);
    c.classList.remove('out'); void c.offsetWidth; c.classList.add('in');
    if (typeof SFX !== 'undefined' && SFX.whoosh) SFX.whoosh();
    setTimeout(() => {
      work();
      const t0 = Date.now(), check = () => (isReady() || Date.now() - t0 > 6000)
        ? setTimeout(() => { c.classList.add('out'); c.classList.remove('in'); if (typeof SFX !== 'undefined' && SFX.whoosh) SFX.whoosh(); setTimeout(() => c.classList.remove('out'), 800); }, 350)
        : setTimeout(check, 100);
      check();
    }, 560);
  }

  // ── during a mission ──
  let cur = null, hintN = 0;   // the mission being played (its id), so a fresh one resets the guide and hints
  function goalText(st) {
    const g = st.scenario.goal || {};
    if (g.type === 'destroy') return 'Destroy every enemy unit';
    if (g.type === 'survive') return 'Hold the gold flags until your turn ' + st.scenario.turns + ' ends';
    return g.hexes && g.hexes.length > 1 ? 'Take every gold flag' : 'Take the gold flag';
  }
  function bar(st) {
    const sc = SC.get(st.scenario.id); if (!sc) return;
    // the mission bar lives in the HUD's centre stack, under the turn banner, so nothing overlaps it
    let b = $('#missionBar'); if (!b) { b = el('div', '', ''); b.id = 'missionBar'; ($('#centerStack') || document.body).appendChild(b); }
    const turn = Math.min(st.scenario.turns, st.scenario.heroTurns + 1);
    b.innerHTML = `<span class="mb-tag" style="--tc:${TIER[sc.tier] || '#9fb3c8'}">MISSION ${sc.n}</span><b>${esc(sc.name)}</b><span class="mb-goal">🎯 ${goalText(st)}</span><span class="mb-turn">TURN ${turn} / ${st.scenario.turns}</span>
      <button class="btn tiny" id="mbBrief">BRIEFING</button><button class="btn tiny gold" id="mbHint">HINT</button><button class="btn tiny" id="mbQuit">ABANDON</button>`;
    const showHint = () => { const h = sc.hints || []; if (!h.length) return; const i = Math.min(hintN, h.length - 1); hintN++; say(fmt(h[i]), { close: true, next: hintN < h.length ? showHint : null, nextLabel: 'ANOTHER HINT' }); };
    b.querySelector('#mbHint').onclick = showHint;
    b.querySelector('#mbBrief').onclick = () => say(fmt(sc.intro || sc.brief), { close: true, wide: true });
    b.querySelector('#mbQuit').onclick = () => { if (confirm('Abandon this mission?')) { hush(); D().send({ t: 'toLobby' }); } };
  }
  // called with every new state (and the events that led to it)
  function onState(st, events) {
    if (!st || !st.scenario) { if (cur) { cur = null; guide = null; hush(); const b = $('#missionBar'); if (b) b.remove(); if (typeof Render !== 'undefined') Render.ov.objectives = null; } return; }
    const sc = SC.get(st.scenario.id), me = D().you();
    Render.ov.objectives = new Set(st.scenario.targets || []);
    if (st.phase === 'over') { const b = $('#missionBar'); if (b) b.remove(); return; }
    bar(st);
    if (cur !== st.scenario.id) {
      cur = st.scenario.id; guide = null; hintN = 0;
      // the tutorial runs a script; every other mission opens with Hale's briefing
      if (sc.guide) { guide = { steps: sc.guide, i: -1 }; next(st); }
      else setTimeout(() => say(fmt(sc.intro || sc.brief), { close: true, wide: true }), 600);
      return;
    }
    if (!guide || !guide.step) return;
    const w = guide.step.wait, mine = e => e.pid === me;
    const hit = (events || []).some(e => mine(e) && ((w === 'move' && (e.e === 'move' || e.e === 'advance')) || (w === 'deploy' && e.e === 'deploy') || (w === 'turn' && e.e === 'turn')));
    if (hit) next(st);
  }
  function next(st) {
    guide.i++; const step = guide.step = guide.steps[guide.i]; if (!step) { hush(); return; }
    st = st || D().state();
    if (step.focus && st && st.scenario.labels[step.focus]) { const k = st.scenario.labels[step.focus]; Render.focus(k); Render.ring(k, '#ffc53d', 80, 1, 5); }
    say(fmt(step.text), { next: step.wait === 'click' ? () => next() : null, wide: true });
    if (step.wait === 'select') { const poll = setInterval(() => { if (!guide || guide.step !== step) return clearInterval(poll); if (Render.ov.selected) { clearInterval(poll); next(); } }, 250); }
  }

  // the tutorial waits for each step: ending the turn before doing it would skip the lesson and burn one of the
  // mission's few turns, so End Turn is held back (and Hale repeats what he's after) until he asks for it
  function holdEnd() {
    if (!guide || !guide.step) return false;
    const step = guide.step; if (step.wait === 'turn' || step.wait === 'win') return false;
    say(fmt('**Not yet, recruit.** ' + step.text), { next: step.wait === 'click' ? () => next() : null, wide: true });
    return true;
  }

  // ── the result ──
  function result(m) {
    hush();
    if (m.won) markCleared(m.id);
    if (m.profile && typeof Locker !== 'undefined') Locker.set(m.profile);
    const sc = SC.get(m.id), nx = SC.SCENARIOS.find(o => o.n === sc.n + 1);
    let v = $('#missionResult'); if (!v) { v = el('div', 'modal-bg'); v.id = 'missionResult'; document.body.appendChild(v); }
    v.hidden = false;
    v.innerHTML = `<div class="panel mr ${m.won ? 'won' : 'lost'}"><div class="mr-face">${hale()}</div><h1>${m.won ? 'MISSION COMPLETE' : 'MISSION FAILED'}</h1>
      <div class="mr-name">${sc.n}. ${esc(sc.name)} · ${esc(sc.tier)}</div>
      <div class="mr-why">${m.won ? (m.first ? `First clear: <b><i class="vm"></i>${m.valor}</b> Valor` : 'Cleared again. Nice and tidy.') : esc(m.failed || 'The enemy held.')}</div>
      <div class="mr-quote">${m.won ? (nx ? 'Outstanding, soldier. Next up: <b>' + esc(nx.name) + '</b>, ' + esc(nx.technique.toLowerCase()) + '.' : 'You\'ve done the impossible. I\'ve nothing left to teach you.') : 'Shake it off. Use a hint if you\'re stuck: the solution is in there somewhere.'}</div>
      <div class="row">${m.won && nx ? '<button class="btn big green" id="mrNext">NEXT MISSION ▶</button>' : ''}${m.won && !nx ? '<button class="btn big green" id="mrHome">🏆 MAIN MENU</button>' : ''}<button class="btn big ${m.won ? '' : 'gold'}" id="mrRetry">RETRY</button><button class="btn big" id="mrBoard">MISSIONS</button></div><button class="btn" id="mrMap">🗺 LOOK AT MAP</button></div>`;
    if (typeof SFX !== 'undefined') m.won ? SFX.win() : SFX.lose();
    const back = $('#mrBack'); if (back) back.remove();
    const go = id => { v.hidden = true; const b2 = $('#mrBack'); if (b2) b2.remove(); if (id) clouds(() => { D().send({ t: 'toLobby' }); setTimeout(() => D().send({ t: 'scenario', id }), 300); }, ready(id)); else D().send({ t: 'toLobby' }); };
    // look over the finished board, then bring the result back
    $('#mrMap').onclick = () => {
      v.hidden = true; if (typeof SFX !== 'undefined') SFX.click();
      const b2 = el('button', 'btn big gold', '◂ BACK TO RESULTS'); b2.id = 'mrBack';
      b2.onclick = () => { b2.remove(); v.hidden = false; if (typeof SFX !== 'undefined') SFX.click(); };
      document.body.appendChild(b2);
    };
    const n = $('#mrNext'); if (n) n.onclick = () => go(nx.id);
    // the last mission: nothing comes next, so back to the front page (not a replay, not the room's lobby)
    const h = $('#mrHome'); if (h) h.onclick = () => { v.hidden = true; const b2 = $('#mrBack'); if (b2) b2.remove(); D().send({ t: 'leave' }); };
    $('#mrRetry').onclick = () => go(m.id);
    $('#mrBoard').onclick = () => { go(null); setTimeout(board, 600); };
  }
  return { board, onState, result, say, hush, holdEnd };
})();
