/* SECTOR — missions: the board of puzzle scenarios, Sergeant Hale (the guide), the mission bar and the result screen.
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

  // ── Sergeant Hale ──
  const HALE = `<svg viewBox="0 0 64 64" class="hale-face"><defs><linearGradient id="hh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7a45"/><stop offset="1" stop-color="#3f4a28"/></linearGradient></defs>
    <circle cx="32" cy="32" r="31" fill="#1b2630"/><path d="M14 64c2-12 9-17 18-17s16 5 18 17z" fill="#4a5a32"/><path d="M27 47l5 6 5-6" fill="#c9b27a"/>
    <ellipse cx="32" cy="34" rx="12" ry="14" fill="#e3b98f"/><ellipse cx="20" cy="35" rx="2.5" ry="4" fill="#d6a97e"/><ellipse cx="44" cy="35" rx="2.5" ry="4" fill="#d6a97e"/>
    <path d="M17 29c0-12 7-18 15-18s15 6 15 18c-4-2-9-3-15-3s-11 1-15 3z" fill="url(#hh)" stroke="#2a321b" stroke-width="1.2"/><path d="M15 29.5c6-2.6 12-3.4 17-3.4s11 .8 17 3.4" fill="none" stroke="#2a321b" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M24 33.5l5 .6M35 34.1l5-.6" stroke="#3a2a1a" stroke-width="1.6" stroke-linecap="round"/><circle cx="27" cy="36" r="1.4" fill="#2a1a10"/><circle cx="37" cy="36" r="1.4" fill="#2a1a10"/>
    <path d="M24 42.5c3-2.2 5.5-2.4 8-1 2.5-1.4 5-1.2 8 1-2.6.4-5.2.2-8-.6-2.8.8-5.4 1-8 .6z" fill="#6b4a2a"/><path d="M29 45.5c1.8.8 4.2.8 6 0" stroke="#9a5a4a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M38 28.5l4 1.5" stroke="#2a321b" stroke-width="1"/><circle cx="32" cy="21" r="2" fill="#ffc53d"/></svg>`;
  let guide = null;   // { steps, i, wait } while a mission's script is running
  function say(html, opts = {}) {
    let b = $('#hale'); if (!b) { b = el('div', '', ''); b.id = 'hale'; document.body.appendChild(b); }
    b.className = opts.wide ? 'wide' : '';
    b.innerHTML = `${HALE}<div class="hale-bubble"><div class="hale-name">SGT. HALE</div><div class="hale-text">${html}</div><div class="hale-act"></div></div>`;
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
    const done = cleared(), p = el('div', 'panel ms-panel');
    p.innerHTML = `<div class="ix-head"><h2>MISSIONS</h2><div class="sub">${done.size} / ${SC.SCENARIOS.length} cleared · puzzles that teach a technique each, from basic training to impossible</div><button class="btn" id="msClose">✕</button></div>`;
    const grid = el('div', 'ms-grid');
    for (const sc of SC.SCENARIOS.slice().sort((a, b) => a.n - b.n)) {
      const open = unlocked(sc, done), ok = done.has(sc.id);
      const t = el('div', 'ms-card' + (open ? '' : ' locked') + (ok ? ' done' : ''));
      t.style.setProperty('--tc', TIER[sc.tier] || '#9fb3c8');
      t.innerHTML = `<div class="ms-n">${sc.n}</div><div class="ms-tier">${sc.tier.toUpperCase()}</div><h3>${esc(sc.name)}</h3><div class="ms-tech">${esc(sc.technique)}</div><div class="ms-brief">${esc(sc.brief)}</div>
        <div class="ms-foot"><span>⏱ ${sc.turns} turn${sc.turns > 1 ? 's' : ''}</span><span>${ok ? '✔ CLEARED' : `<i class="vm"></i>${sc.reward}`}</span></div>${open ? '' : '<div class="ms-lock">🔒 Clear mission ' + (sc.n - 1) + ' first</div>'}`;
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
  return { board, onState, result, say, hush };
})();
