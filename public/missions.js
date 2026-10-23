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
  const HALE = `<svg viewBox="10 9 80 80" class="hale-face"><defs><radialGradient id="hgBg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#34475a"/><stop offset="1" stop-color="#0f161d"/></radialGradient><linearGradient id="hgCap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e7f4a"/><stop offset="1" stop-color="#46542d"/></linearGradient><linearGradient id="hgCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d6e3e"/><stop offset="1" stop-color="#3a4626"/></linearGradient><linearGradient id="hgSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecc29a"/><stop offset="1" stop-color="#d29f78"/></linearGradient><linearGradient id="hgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset=".55" stop-color="#d9a93a"/><stop offset="1" stop-color="#9a6f1c"/></linearGradient><linearGradient id="hgVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f35"/><stop offset="1" stop-color="#07090b"/></linearGradient><clipPath id="hgClip"><rect x="0" y="0" width="100" height="100"/></clipPath></defs><rect x="0" y="0" width="100" height="100" fill="url(#hgBg)"/><g clip-path="url(#hgClip)"><path d="M4 104C6 84 20 75 50 74C80 75 94 84 96 104Z" fill="url(#hgCoat)"/><path d="M9 86L30 76.5L34 82L13 92Z" fill="url(#hgGold)" stroke="#6b4c12" stroke-width=".8"/><path d="M91 86L70 76.5L66 82L87 92Z" fill="url(#hgGold)" stroke="#6b4c12" stroke-width=".8"/><g fill="#f4f1e6"><path d="M17 85.2l.8 1.6 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z"/><path d="M23.5 82.3l.8 1.6 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z"/><path d="M82.5 85.2l.8 1.6 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z"/><path d="M76 82.3l.8 1.6 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2z"/></g><path d="M40 74L50 93L60 74Z" fill="#d8cda4"/><path d="M47.6 79H52.4L54 96L50 100L46 96Z" fill="#2c2418"/><path d="M47 76.5h6l-.6 3h-4.8z" fill="#3a3020"/><path d="M36 73.5L50 94L43 104H30L27 81Z" fill="#53633a" stroke="#2c361c" stroke-width="1"/><path d="M64 73.5L50 94L57 104H70L73 81Z" fill="#53633a" stroke="#2c361c" stroke-width="1"/><g stroke="#111" stroke-width=".4"><rect x="58" y="88" width="5" height="2.6" fill="#b3202a"/><rect x="63" y="88" width="5" height="2.6" fill="#2b5fb3"/><rect x="68" y="88" width="5" height="2.6" fill="#e0b13a"/><rect x="58.8" y="90.6" width="5" height="2.6" fill="#2f8a4a"/><rect x="63.8" y="90.6" width="5" height="2.6" fill="#7a3fb3"/><rect x="68.8" y="90.6" width="5" height="2.6" fill="#c9c9c9"/></g><circle cx="37" cy="92" r="1.6" fill="url(#hgGold)"/><path d="M41 60V75Q50 79 59 75V60Z" fill="#cf9c74"/><path d="M41 70Q50 74 59 70" fill="none" stroke="#b5835f" stroke-width="1"/><ellipse cx="33.5" cy="53" rx="3.4" ry="5.6" fill="#d9a67e"/><ellipse cx="66.5" cy="53" rx="3.4" ry="5.6" fill="#d9a67e"/><path d="M34 46C34 34 40 30 50 30S66 34 66 46V58C66 66 59 72 50 72S34 66 34 58Z" fill="url(#hgSkin)"/><path d="M36 60C38 67 43 70.5 50 71" fill="none" stroke="#c08a64" stroke-width="1.2" opacity=".7"/><path d="M34.2 44V56L36.6 55V44Z" fill="#a9aaa3"/><path d="M65.8 44V56L63.4 55V44Z" fill="#a9aaa3"/><path d="M37.5 46.5L46.5 49" stroke="#8d8d85" stroke-width="3" stroke-linecap="round"/><path d="M62.5 46.5L53.5 49" stroke="#8d8d85" stroke-width="3" stroke-linecap="round"/><path d="M39.8 51.6Q42.6 50 45.4 51.6" fill="none" stroke="#3b2a1e" stroke-width="1.1"/><path d="M54.6 51.6Q57.4 50 60.2 51.6" fill="none" stroke="#3b2a1e" stroke-width="1.1"/><ellipse cx="42.7" cy="52.6" rx="1.7" ry="1.5" fill="#1f2a33"/><ellipse cx="57.3" cy="52.6" rx="1.7" ry="1.5" fill="#1f2a33"/><path d="M37 53.5l-2 1M37 55.5l-2 .4M63 53.5l2 1M63 55.5l2 .4" stroke="#b9876a" stroke-width=".7"/><path d="M50 52L47.6 61Q50 62.6 52.4 61" fill="none" stroke="#b07a58" stroke-width="1.2" stroke-linejoin="round"/><path d="M40.5 64.5Q44 60.5 50 62.5Q56 60.5 59.5 64.5Q56 66.8 50 65.2Q44 66.8 40.5 64.5Z" fill="#a7a8a1" stroke="#7f807a" stroke-width=".6"/><path d="M45.5 68.3Q50 69.2 54.5 68.3" fill="none" stroke="#8f5444" stroke-width="1.2" stroke-linecap="round"/><path d="M47 71.2Q50 72 53 71.2" fill="none" stroke="#c08a64" stroke-width=".8"/><path d="M24 38C22 23 37 15.5 50 15.5S78 23 76 38Z" fill="url(#hgCap)" stroke="#2c361c" stroke-width="1"/><path d="M30 22Q50 13 70 22" fill="none" stroke="#86965e" stroke-width="1.4" opacity=".7"/><path d="M27 34.5H73V41.5H27Z" fill="#2f3a1f"/><path d="M28.5 41H71.5" stroke="url(#hgGold)" stroke-width="1.8"/><g transform="translate(50 30)"><path d="M-9 -1.5Q-5 -4 -2 -1.5Q-5 0 -9 -1.5ZM9 -1.5Q5 -4 2 -1.5Q5 0 9 -1.5Z" fill="url(#hgGold)"/><path d="M0 -6.5L1.9 -2.1L6.6 -1.7L3 1.3L4.1 5.9L0 3.5L-4.1 5.9L-3 1.3L-6.6 -1.7L-1.9 -2.1Z" fill="url(#hgGold)" stroke="#6b4c12" stroke-width=".6"/></g><path d="M25 41.5Q50 47 75 41.5L77 45Q50 53.5 23 45Z" fill="url(#hgVisor)"/><path d="M28 44.6Q50 50 72 44.6" fill="none" stroke="url(#hgGold)" stroke-width="2.2" stroke-dasharray="3.2 1.4" stroke-linecap="round"/><path d="M30 43.3Q50 47.8 70 43.3" fill="none" stroke="rgba(255,255,255,.18)" stroke-width=".8"/></g></svg>`;
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
