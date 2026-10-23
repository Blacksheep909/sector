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
  // General Hale: a peaked officer's cap with gold braid, grey moustache, stars on the shoulder boards, medal ribbons
  const HALE = `<svg viewBox="7 8 86 86" class="hale-face"><defs><radialGradient id="hgBg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#3a4f63"/><stop offset="1" stop-color="#0e151c"/></radialGradient><linearGradient id="hgCap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a8c52"/><stop offset="1" stop-color="#4c5b31"/></linearGradient><linearGradient id="hgBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4625"/><stop offset="1" stop-color="#252d17"/></linearGradient><linearGradient id="hgCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#607241"/><stop offset="1" stop-color="#3a4626"/></linearGradient><linearGradient id="hgSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eec59e"/><stop offset="1" stop-color="#d6a47c"/></linearGradient><linearGradient id="hgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".5" stop-color="#e0b040"/><stop offset="1" stop-color="#9c7020"/></linearGradient><linearGradient id="hgVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4048"/><stop offset=".35" stop-color="#14181d"/><stop offset="1" stop-color="#05070a"/></linearGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#hgBg)"/><path d="M4 104C6 87 21 79.5 50 78.5C79 79.5 94 87 96 104Z" fill="url(#hgCoat)"/><path d="M42 78.5L50 91L58 78.5Z" fill="#dccfa6"/><path d="M48 80.5H52L53.6 97L50 101L46.4 97Z" fill="#2b2318"/><path d="M47.2 78.8H52.8L52.2 81.6H47.8Z" fill="#3b3022"/><path d="M38.5 78L50 93.5L44 104H29L27.5 85Z" fill="#56683b" stroke="#2c361c" stroke-width=".9"/><path d="M61.5 78L50 93.5L56 104H71L72.5 85Z" fill="#56683b" stroke="#2c361c" stroke-width=".9"/><path d="M13 88.5L30 80.6L33.6 85.2L16.6 93.2Z" fill="url(#hgGold)" stroke="#6b4c12" stroke-width=".7"/><path d="M87 88.5L70 80.6L66.4 85.2L83.4 93.2Z" fill="url(#hgGold)" stroke="#6b4c12" stroke-width=".7"/><g fill="#fbf7ea"><path d="M19.6 86.9l.8 1.6 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z"/><path d="M25.6 84.1l.8 1.6 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z"/><path d="M80.4 86.9l.8 1.6 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z"/><path d="M74.4 84.1l.8 1.6 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z"/></g><g stroke="#111" stroke-width=".35"><rect x="58.5" y="88.6" width="4.4" height="2.4" fill="#b3202a"/><rect x="62.9" y="88.6" width="4.4" height="2.4" fill="#2b5fb3"/><rect x="67.3" y="88.6" width="4.4" height="2.4" fill="#e0b13a"/><rect x="59.2" y="91" width="4.4" height="2.4" fill="#2f8a4a"/><rect x="63.6" y="91" width="4.4" height="2.4" fill="#7a3fb3"/><rect x="68" y="91" width="4.4" height="2.4" fill="#cfcfcf"/></g><path d="M43 64V80Q50 83 57 80V64Z" fill="#d09d75"/><path d="M43 72.5Q50 76 57 72.5" fill="none" stroke="#b4835f" stroke-width=".9"/><path d="M35.5 48C32 47 30.5 50 31 54S33.5 60.5 36 59.5Z" fill="#d8a57d"/><path d="M64.5 48C68 47 69.5 50 69 54S66.5 60.5 64 59.5Z" fill="#d8a57d"/><path d="M34.6 50.5Q32.6 53.5 34.4 57" fill="none" stroke="#b98762" stroke-width=".8"/><path d="M65.4 50.5Q67.4 53.5 65.6 57" fill="none" stroke="#b98762" stroke-width=".8"/><path d="M35 40H65V58C65 66 59 73.5 50 73.5S35 66 35 58Z" fill="url(#hgSkin)"/><path d="M35.6 60C37 67 42 72 50 73" fill="none" stroke="#c08b65" stroke-width="1" opacity=".6"/><path d="M64.4 60C63 67 58 72 50 73" fill="none" stroke="#c08b65" stroke-width="1" opacity=".6"/><path d="M35 42H38.6V53.5L35.8 55.5Z" fill="#a8a9a2"/><path d="M65 42H61.4V53.5L64.2 55.5Z" fill="#a8a9a2"/><path d="M35 46.5C42 49.6 58 49.6 65 46.5V50C58 52.6 42 52.6 35 50Z" fill="#6a4630" opacity=".22"/><path d="M39.2 51.8L46.2 52.9" stroke="#909089" stroke-width="2.2" stroke-linecap="round"/><path d="M60.8 51.8L53.8 52.9" stroke="#909089" stroke-width="2.2" stroke-linecap="round"/><path d="M39.8 55.4Q42.8 53.6 45.8 55.4Q42.8 56.8 39.8 55.4Z" fill="#fbf6ee"/><path d="M54.2 55.4Q57.2 53.6 60.2 55.4Q57.2 56.8 54.2 55.4Z" fill="#fbf6ee"/><circle cx="42.9" cy="55.2" r="1.25" fill="#2a3a46"/><circle cx="57.1" cy="55.2" r="1.25" fill="#2a3a46"/><path d="M39.6 55.2Q42.8 53.3 46 55" fill="none" stroke="#4a3426" stroke-width=".9"/><path d="M60.4 55.2Q57.2 53.3 54 55" fill="none" stroke="#4a3426" stroke-width=".9"/><path d="M50 54.5C49.4 57 48.2 59.6 47.4 61.2C48.6 62.6 51.4 62.6 52.6 61.2C51.8 59.6 50.6 57 50 54.5Z" fill="#c99470"/><path d="M47.6 61.3Q50 62.9 52.4 61.3" fill="none" stroke="#a8724f" stroke-width=".8"/><path d="M44.6 60.5Q43.4 63.6 44 66.2M55.4 60.5Q56.6 63.6 56 66.2" fill="none" stroke="#c08b65" stroke-width=".7"/><path d="M41.5 66.6C43.6 63.6 47.6 63.2 50 64.6C52.4 63.2 56.4 63.6 58.5 66.6C55.8 67.6 53 67.2 50 66.4C47 67.2 44.2 67.6 41.5 66.6Z" fill="#a9aaa3" stroke="#83847e" stroke-width=".5"/><path d="M46.6 69.4Q50 70.2 53.4 69.4" fill="none" stroke="#8d5343" stroke-width="1" stroke-linecap="round"/><path d="M21.5 31C22 19.5 36 13.5 50 13.5S78 19.5 78.5 31C78.5 34.2 74.5 36 69 36H31C25.5 36 21.5 34.2 21.5 31Z" fill="url(#hgCap)" stroke="#2c361c" stroke-width=".9"/><path d="M27 24.5Q50 15 73 24.5" fill="none" stroke="#91a267" stroke-width="1.2" opacity=".55"/><path d="M31 35.4H69L67.6 43.4H32.4Z" fill="url(#hgBand)"/><path d="M32.6 41.6H67.4" stroke="url(#hgGold)" stroke-width="1.5"/><circle cx="33.4" cy="41.6" r=".9" fill="#ffe7a0"/><circle cx="66.6" cy="41.6" r=".9" fill="#ffe7a0"/><g transform="translate(50 27.5)"><path d="M-10 0Q-6 -3.4 -2.4 -.6Q-6 1.2 -10 0ZM10 0Q6 -3.4 2.4 -.6Q6 1.2 10 0Z" fill="url(#hgGold)"/><path d="M0 -6L1.8 -1.9L6.2 -1.6L2.8 1.2L3.9 5.5L0 3.3L-3.9 5.5L-2.8 1.2L-6.2 -1.6L-1.8 -1.9Z" fill="url(#hgGold)" stroke="#6b4c12" stroke-width=".5"/></g><path d="M30.5 42.6C38 41.6 62 41.6 69.5 42.6L72 46.8C62 50 38 50 28 46.8Z" fill="url(#hgVisor)"/><path d="M31.5 45.4C39 47.6 61 47.6 68.5 45.4" fill="none" stroke="url(#hgGold)" stroke-width="1.9" stroke-dasharray="2.6 1.2" stroke-linecap="round"/><path d="M31.8 43.4C40 42.6 60 42.6 68.2 43.4" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".7"/></svg>`;
  let guide = null;   // { steps, i, wait } while a mission's script is running
  function say(html, opts = {}) {
    let b = $('#hale'); if (!b) { b = el('div', '', ''); b.id = 'hale'; document.body.appendChild(b); }
    b.className = opts.wide ? 'wide' : '';
    b.innerHTML = `${HALE}<div class="hale-bubble"><div class="hale-name">GEN. HALE</div><div class="hale-text">${html}</div><div class="hale-act"></div></div>`;
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
    D().send({ t: 'scenario', id });
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
    v.innerHTML = `<div class="panel mr ${m.won ? 'won' : 'lost'}"><div class="mr-face">${HALE}</div><h1>${m.won ? 'MISSION COMPLETE' : 'MISSION FAILED'}</h1>
      <div class="mr-name">${sc.n}. ${esc(sc.name)} · ${esc(sc.tier)}</div>
      <div class="mr-why">${m.won ? (m.first ? `First clear: <b><i class="vm"></i>${m.valor}</b> Valor` : 'Cleared again. Nice and tidy.') : esc(m.failed || 'The enemy held.')}</div>
      <div class="mr-quote">${m.won ? (nx ? 'Outstanding, soldier. Next up: <b>' + esc(nx.name) + '</b>, ' + esc(nx.technique.toLowerCase()) + '.' : 'You\'ve done the impossible. I\'ve nothing left to teach you.') : 'Shake it off. Use a hint if you\'re stuck: the solution is in there somewhere.'}</div>
      <div class="row">${m.won && nx ? '<button class="btn big green" id="mrNext">NEXT MISSION ▶</button>' : ''}<button class="btn big ${m.won ? '' : 'gold'}" id="mrRetry">RETRY</button><button class="btn big" id="mrBoard">MISSIONS</button></div></div>`;
    if (typeof SFX !== 'undefined') m.won ? SFX.win() : SFX.lose();
    const go = id => { v.hidden = true; D().send({ t: 'toLobby' }); if (id) setTimeout(() => D().send({ t: 'scenario', id }), 400); };
    const n = $('#mrNext'); if (n) n.onclick = () => go(nx.id);
    $('#mrRetry').onclick = () => go(m.id);
    $('#mrBoard').onclick = () => { go(null); setTimeout(board, 600); };
  }
  return { board, onState, result, say, hush, holdEnd };
})();
