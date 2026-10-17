/* SECTOR — client */
(() => {
  const E = SectorEngine;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const sleep = ms => new Promise(r => setTimeout(r, ms * speed()));
  let fastForward = false;
  const speed = () => document.hidden ? 0.02 : fastForward ? 0.12 : 1;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ───────────── app state ─────────────
  let ws = null, you = null, token = null, lobby = null, S = null, spectator = false;
  let msgQ = [], processing = false, animating = false;
  const pending = new Map(); let seq = 1;
  let sel = null;            // { hex, units:Set }
  let mode = null;           // {type:'deploy', unit} | {type:'tactic', uid, id, from}
  let plan = []; let planState = null; let planAuto = true; let executing = false;
  let hoverK = null;
  let lastTurnKey = '';
  try { token = localStorage.getItem('sector.token'); } catch (e) {}

  Render.init($('#map'));

  // ───────────── networking ─────────────
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => { if (token || joinedOnce) send({ t: 'hello', token, name: $('#nameIn').value || savedName() }); };
    ws.onmessage = ev => onMsg(JSON.parse(ev.data));
    ws.onclose = () => { toast('Connection lost — reconnecting…', 'err'); setTimeout(connect, 1500); };
  }
  let joinedOnce = false;
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  function savedName() { try { return localStorage.getItem('sector.name') || ''; } catch (e) { return ''; } }

  function onMsg(m) {
    switch (m.t) {
      case 'welcome':
        you = m.you; spectator = !!m.spectator;
        if (m.token) { token = m.token; try { localStorage.setItem('sector.token', token); } catch (e) {} }
        joinedOnce = true;
        break;
      case 'lobby': lobby = m.lobby; if (!S) renderLobby(); break;
      case 'state': msgQ.push(m); pump(); break;
      case 'err':
        if (m.seq && pending.has(m.seq)) { pending.get(m.seq)(false); pending.delete(m.seq); }
        toast(m.msg, 'err'); SFX.error(); break;
      case 'chat': addLog(`<b style="--c:${m.color}">${esc(m.from)}:</b> ${esc(m.text)}`, 'chat'); SFX.click(); break;
      case 'kicked': token = null; try { localStorage.removeItem('sector.token'); } catch (e) {} you = null; toast('You were removed from the lobby', 'err'); showJoin(); break;
    }
  }

  async function pump() {
    if (processing) return; processing = true;
    while (msgQ.length) {
      const m = msgQ.shift();
      if (!m.state) { S = null; Render.setState(null); showMenu(); continue; }
      if (!S || S.seed !== m.state.seed) { enterGame(m.state); }
      else {
        animating = true; fastForward = msgQ.length > 3;
        try { await playEvents(m.events || [], m.by); } catch (e) { console.error(e); }
        animating = false; fastForward = false;
        applyState(m.state);
      }
      if (m.seq && m.by === you && pending.has(m.seq)) { pending.get(m.seq)(true); pending.delete(m.seq); }
    }
    processing = false;
  }

  function act(action) {
    return new Promise(res => {
      const s = seq++; pending.set(s, res);
      send({ t: 'act', action, seq: s });
      setTimeout(() => { if (pending.has(s)) { pending.delete(s); res(false); } }, 15000);
    });
  }

  // ───────────── menu / lobby ─────────────
  function showMenu() { $('#menu').hidden = false; $('#hud').hidden = true; $('#victory').hidden = true; $('#supply').hidden = true; if (lobby) renderLobby(); }
  function showJoin() { $('#joinBox').hidden = false; $('#lobbyBox').hidden = true; }
  $('#nameIn').value = savedName();
  $('#joinBtn').onclick = () => {
    const name = $('#nameIn').value.trim() || 'Commander';
    try { localStorage.setItem('sector.name', name); } catch (e) {}
    joinedOnce = true; SFX.select();
    send({ t: 'hello', token, name });
  };
  $('#nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinBtn').click(); });

  function renderLobby() {
    if (!lobby) return;
    const me = lobby.players.find(p => p.id === you);
    if (!me) { showJoin(); if (lobby.inGame) $('#joinBox .hint').textContent = 'A war is in progress — you can watch once it loads, or wait for the next game.'; return; }
    $('#joinBox').hidden = true; $('#lobbyBox').hidden = false;
    const host = lobby.hostId === you;
    $('#pCount').textContent = lobby.players.length + '/6';
    const pl = $('#playerList'); pl.innerHTML = '';
    for (const p of lobby.players) {
      const r = el('div', 'prow' + (p.connected ? '' : ' off'));
      const f = E.FACTIONS[p.faction];
      r.innerHTML = `<div class="sw" style="background:${p.color}"></div><div class="nm">${esc(p.name)}<div class="fx">${f ? f.name : ''}</div></div>` +
        (p.id === lobby.hostId ? '<span class="tag host">HOST</span>' : '') + (p.bot ? '<span class="tag">BOT</span>' : '') + (p.id === you ? '<span class="tag">YOU</span>' : '');
      if (p.bot) {
        const dsel = el('select', 'diffsel ' + (p.diff || 'medium'));
        dsel.innerHTML = Object.keys(E.DIFFICULTY).map(d => `<option value="${d}"${p.diff === d ? ' selected' : ''}>${E.DIFFICULTY[d].name}</option>`).join('');
        dsel.disabled = !host; dsel.onchange = () => send({ t: 'botCfg', id: p.id, diff: dsel.value });
        r.insertBefore(dsel, r.querySelector('.tag'));
      }
      if (host && p.id !== you) { const x = el('button', 'x', '✕'); x.onclick = () => send({ t: 'kick', id: p.id }); r.appendChild(x); }
      pl.appendChild(r);
    }
    $('#addBot').hidden = !host;
    $('#lanBox').innerHTML = lobby.lan.length ? 'Friends on your network join at:<br>' + lobby.lan.map(u => `<b>${u}</b>`).join('<br>') : 'No network address found — local play only.';
    const fl = $('#factionList'); fl.innerHTML = '';
    for (const id in E.FACTIONS) {
      const f = E.FACTIONS[id], d = el('div', 'fac' + (me.faction === id ? ' on' : ''));
      d.innerHTML = `<img src="${Art.iconURL('glyph', f.glyph, me.faction === id ? me.color : '#8fa1b3')}"><div><div class="fn">${f.name}</div><div class="fp"><b>${f.perk}:</b> ${f.desc}<br>Starts with <b>${E.UNITS[f.starter].name}</b></div></div>`;
      d.onclick = () => { SFX.select(); send({ t: 'me', faction: id }); };
      fl.appendChild(d);
    }
    const cl = $('#colorList'); cl.innerHTML = '';
    for (const c of E.COLORS) {
      const taken = lobby.players.some(p => p.color === c && p.id !== you);
      const d = el('div', 'c' + (me.color === c ? ' on' : '') + (taken ? ' taken' : '')); d.style.background = c;
      if (!taken) d.onclick = () => { SFX.click(); send({ t: 'me', color: c }); };
      cl.appendChild(d);
    }
    const st = lobby.settings;
    for (const [id, k] of [['#setMode', 'mode'], ['#setType', 'mapType'], ['#setSize', 'mapSize'], ['#setTimer', 'timer'], ['#setRounds', 'maxRounds'], ['#setSeed', 'seed']]) {
      const e = $(id); if (document.activeElement !== e) e.value = st[k] ?? ''; e.disabled = !host;
    }
    $('#startBtn').hidden = !host; $('#waitHost').hidden = host;
  }
  for (const [id, k] of [['#setMode', 'mode'], ['#setType', 'mapType'], ['#setSize', 'mapSize'], ['#setTimer', 'timer'], ['#setRounds', 'maxRounds'], ['#setSeed', 'seed']])
    $(id).addEventListener('change', e => send({ t: 'settings', settings: { [k]: e.target.value } }));
  $('#addBot').onclick = () => { SFX.click(); send({ t: 'addBot' }); };
  $('#startBtn').onclick = () => { SFX.select(); send({ t: 'start' }); };

  // ───────────── game entry / state ─────────────
  function enterGame(state) {
    S = state; plan = []; sel = null; mode = null; lastTurnKey = '';
    $('#menu').hidden = true; $('#hud').hidden = false; $('#victory').hidden = true;
    Render.setState(state);
    Render.fitMap();
    const me = myP();
    if (me) setTimeout(() => Render.focus(me.hq, Math.max(Render.cam.z, 1.05)), 300);
    $('#log').innerHTML = ''; for (const l of state.log.slice(-6)) addLog(esc(l));
    applyState(state, true);
  }

  const myP = () => S && S.players.find(p => p.id === you);
  const curP = () => S && S.players[S.turn.idx];
  const isMyTurn = () => !!S && S.phase === 'play' && curP() && curP().id === you;
  const planning = () => !!S && S.phase === 'play' && !isMyTurn() && myP() && myP().alive;
  const canCommand = () => (isMyTurn() && S.turn.stage === 'act' && !animating && !executing) || planning();
  const dispState = () => planning() && planState ? planState : S;
  const pName = id => { const p = S.players.find(x => x.id === id); return p ? p.name : '?'; };
  const pColor = id => { const p = S.players.find(x => x.id === id); return p ? p.color : '#aaa'; };

  function applyState(state, initial) {
    const prevCash = myP() ? myP().cash : null;
    S = state;
    const log = state.log || [];
    if (!initial) { const i = log.lastIndexOf(applyState.lastLog); for (const l of log.slice(i >= 0 ? i + 1 : -3)) addLog(esc(l)); }
    applyState.lastLog = log[log.length - 1];
    recomputePlan();
    // validate selection
    if (sel && !dispState().map.tiles[sel.hex]) sel = null;
    if (sel) { const ids = [...sel.units].filter(id => dispState().units[id] && dispState().units[id].hex === sel.hex); sel.units = new Set(ids); }
    refreshAll();
    const me = myP();
    if (me && prevCash !== null && me.cash !== prevCash) countCash(prevCash, me.cash);
    // turn transitions
    const tk = S.turn.round + ':' + S.turn.idx;
    if (tk !== lastTurnKey && S.phase === 'play') {
      lastTurnKey = tk;
      if (isMyTurn()) onMyTurn();
    }
    if (isMyTurn() && S.turn.stage === 'choose' && !executing && !(plan.length && planAuto)) showSupply(); else hideSupply();
    if (S.phase === 'over') showVictory();
  }

  async function onMyTurn() {
    if (plan.length && planAuto && S.turn.stage === 'choose') {
      executing = true;
      await act({ a: 'choose', pick: 'income' });
      await runPlan();
    }
  }
  async function runPlan() {
    executing = true;
    toast('▶ Executing blueprint (' + plan.length + ' orders)');
    const items = plan.slice(); plan = [];
    for (const it of items) {
      const ok = await act(it.a);
      if (!ok) toast('Blueprint order skipped: ' + describe(it.a), 'err');
    }
    executing = false; recomputePlan(); refreshAll();
  }

  // ───────────── planning (blueprint) ─────────────
  function recomputePlan() {
    if (!planning()) { planState = null; return; }
    let sim = E.simulateTurnStart(S, you, planAuto);
    for (const it of plan) {
      const trial = JSON.parse(JSON.stringify(sim));
      const r = E.applyAction(trial, you, it.a, () => 0.5);
      it.ok = r.ok; it.err = r.err;
      if (r.ok) sim = trial;
    }
    planState = sim;
  }
  function describe(a) {
    if (a.a === 'deploy') return 'Deploy ' + E.UNITS[a.unit].name;
    if (a.a === 'build') return 'Build ' + E.STRUCTS[a.struct].name;
    if (a.a === 'move') { const t = S && S.map.tiles[a.to]; return 'Move ' + a.units.length + ' unit' + (a.units.length > 1 ? 's' : '') + ' → ' + (t ? E.TERRAIN[t.t].name : 'hex'); }
    return a.a;
  }
  function renderPlan() {
    const box = $('#planBox');
    box.hidden = !planning();
    if (box.hidden) return;
    const list = $('#planList'); list.innerHTML = '';
    if (!plan.length) list.innerHTML = '<div class="pempty">Nothing queued. Click units, cards and hexes like normal — orders are saved here.</div>';
    plan.forEach((it, i) => {
      const d = el('div', 'pitem' + (it.ok === false ? ' bad' : ''), `<span>${i + 1}. ${esc(describe(it.a))}${it.ok === false ? ' — ' + esc(it.err) : ''}</span>`);
      const x = el('button', '', '✕'); x.onclick = () => { plan.splice(i, 1); recomputePlan(); refreshAll(); SFX.click(); };
      d.appendChild(x); list.appendChild(d);
    });
  }
  $('#planAuto').onchange = e => { planAuto = e.target.checked; recomputePlan(); refreshAll(); };
  $('#planClear').onclick = () => { plan = []; recomputePlan(); refreshAll(); SFX.click(); };

  // central action entry
  async function doAction(a) {
    if (planning()) {
      if (a.a === 'fire' || a.a === 'tactic' || a.a === 'end') { toast('Attacks & tactics go live on your turn — the blueprint queues moves, deploys and builds.', 'err'); SFX.error(); return false; }
      if (a.a === 'move') { const r = E.reachable(planState, you, a.units, a.from)[a.to]; if (r && r.kind === 'attack') { toast('Attacks resolve live on your turn — queue the approach instead.', 'err'); SFX.error(); return false; } }
      const trial = JSON.parse(JSON.stringify(planState));
      const r = E.applyAction(trial, you, a, () => 0.5);
      if (!r.ok) { toast(r.err, 'err'); SFX.error(); return false; }
      plan.push({ a }); SFX.select();
      recomputePlan(); refreshAll();
      return true;
    }
    if (!isMyTurn()) return false;
    SFX.click();
    return act(a);
  }

  // ───────────── selection & overlays ─────────────
  function selectHex(k) {
    const ds = dispState();
    if (!k) { sel = null; refreshAll(); return; }
    const units = Object.values(ds.units).filter(u => u.hex === k && u.owner === you && E.canAct(ds, u));
    sel = { hex: k, units: new Set(units.map(u => u.id)) };
    SFX.select();
    refreshAll();
  }
  function updateOverlays() {
    const ov = Render.ov, ds = dispState();
    ov.me = you; ov.myTurn = isMyTurn() || planning();
    ov.reach = null; ov.probs = null; ov.fire = null; ov.spawn = null; ov.targets = null; ov.path = null;
    ov.selected = sel ? sel.hex : null;
    ov.unsupplied = null;
    if (!ds || ds.phase !== 'play') { ov.planArrows = []; ov.planGhost = null; return; }
    const me = ds.players.find(p => p.id === you);
    if (me && me.alive) { const sup = E.supplySet(ds, you); const un = new Set(); for (const k in ds.map.tiles) if (ds.map.tiles[k].owner === you && !sup.has(k)) un.add(k); ov.unsupplied = un; }
    if (mode && mode.type === 'deploy') ov.spawn = new Set(E.deployHexes(ds, you, mode.unit));
    else if (mode && mode.type === 'build') ov.spawn = new Set(E.buildHexes(ds, you, mode.struct));
    else if (mode && mode.type === 'tactic') ov.targets = new Set(E.tacticTargets(ds, you, mode.id, mode.from));
    else if (sel && sel.units.size && canCommand()) {
      const ids = [...sel.units];
      const idx = E.buildIndex(ds);
      ov.reach = E.reachable(ds, you, ids, sel.hex, idx);
      const units = ids.map(id => ds.units[id]);
      ov.probs = {};
      for (const k in ov.reach) if (ov.reach[k].kind === 'attack') {
        const path = E.pathTo(ov.reach, k);
        ov.probs[k] = E.combatCalc(ds, you, units, path[path.length - 2], k, false, idx).winProb;
      }
      const fire = E.rangedTargets(ds, you, ids, sel.hex, idx);
      if (fire.length) { ov.fire = new Set(fire); for (const k of fire) ov.probs[k] = E.combatCalc(ds, you, units, sel.hex, k, true, idx).winProb; }
    }
    // blueprint arrows & ghosts
    ov.planArrows = []; ov.planGhost = null;
    if (planning()) {
      const col = pColor(you);
      for (const it of plan) if (it.a.a === 'move' && it.ok) {
        const r = E.reachable(S, you, it.a.units, it.a.from);
        ov.planArrows.push({ path: r[it.a.to] ? E.pathTo(r, it.a.to) : [it.a.from, it.a.to], color: col });
      }
    }
    if (hoverK) hoverPath(hoverK);
  }
  function hoverPath(k) {
    const ov = Render.ov; ov.path = null;
    if (!ov.reach || !ov.reach[k]) return;
    const r = ov.reach[k]; if (r.kind === 'start' || r.kind === 'pass') return;
    ov.path = E.pathTo(ov.reach, k); ov.pathColor = r.kind === 'attack' ? '#ff4f5e' : pColor(you);
  }

  // ───────────── input ─────────────
  const cvs = $('#map');
  let down = null;
  cvs.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, b: e.button, moved: false }; cvs.setPointerCapture(e.pointerId); });
  cvs.addEventListener('pointermove', e => {
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (down.moved || Math.hypot(dx, dy) > 6) { down.moved = true; Render.pan(e.movementX, e.movementY); cvs.style.cursor = 'grabbing'; hideTip(); return; }
    }
    const k = Render.hexAt(e.clientX, e.clientY);
    if (k !== hoverK) { hoverK = k; Render.ov.hover = k; hoverPath(k); }
    showHexTip(k, e.clientX, e.clientY);
  });
  cvs.addEventListener('pointerup', e => {
    cvs.style.cursor = 'default';
    if (down && !down.moved) {
      if (down.b === 2) cancel();
      else if (down.b === 0) onHexClick(Render.hexAt(e.clientX, e.clientY));
    }
    down = null;
  });
  cvs.addEventListener('pointerleave', () => { hideTip(); });
  cvs.addEventListener('contextmenu', e => e.preventDefault());
  cvs.addEventListener('wheel', e => { e.preventDefault(); Render.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  const keys = new Set();
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') { if (e.key === 'Escape') e.target.blur(); return; }
    keys.add(e.key.toLowerCase());
    if (e.key === 'Escape') cancel();
    if (e.key === 'Enter' && S) $('#chatIn').focus();
    if (e.key.toLowerCase() === 'f' && myP()) Render.focus(myP().hq);
    if (e.key === ' ' && S && isMyTurn()) { e.preventDefault(); $('#endBtn').click(); }
    if (S && S.phase === 'play') {
      const kk = e.key.toLowerCase(), items = hotbarItems();
      const ui = UNIT_KEYS.indexOf(kk); if (ui >= 0 && items.units[ui]) { armSlot('unit', items.units[ui]); keys.delete(kk); }
      const bi = BUILD_KEYS.indexOf(kk); if (bi >= 0 && items.builds[bi]) { armSlot('build', items.builds[bi]); keys.delete(kk); }
    }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  (function panLoop() {
    requestAnimationFrame(panLoop);
    const v = 12; let dx = 0, dy = 0;
    if (keys.has('a') || keys.has('arrowleft')) dx += v; if (keys.has('d') || keys.has('arrowright')) dx -= v;
    if (keys.has('w') || keys.has('arrowup')) dy += v; if (keys.has('s') || keys.has('arrowdown')) dy -= v;
    if (dx || dy) Render.pan(dx, dy);
  })();

  function cancel() { if (mode) { mode = null; } else sel = null; refreshAll(); hideTip(); }

  async function onHexClick(k) {
    if (!S || S.phase !== 'play') return;
    const ds = dispState();
    if (mode && mode.type === 'deploy') {
      if (!k || !Render.ov.spawn || !Render.ov.spawn.has(k)) { if (!k) cancel(); else { toast(E.isSea(mode.unit) ? 'Launch ships into the sea next to your Port' : 'Deploy at a highlighted HQ / FOB', 'err'); SFX.error(); } return; }
      if (!canCommand()) return;
      await doAction({ a: 'deploy', unit: mode.unit, hex: k });
      const me = dispState().players.find(p => p.id === you);
      if (mode && me && me.cash < E.unitCost(me, mode.unit)) mode = null;
      refreshAll(); return;
    }
    if (mode && mode.type === 'build') {
      if (!k || !Render.ov.spawn || !Render.ov.spawn.has(k)) { if (!k) cancel(); else { toast('Build on a highlighted hex', 'err'); SFX.error(); } return; }
      if (!canCommand()) return;
      const st = mode.struct;
      await doAction({ a: 'build', struct: st, hex: k });
      const me = dispState().players.find(p => p.id === you);
      if (mode && me && (me.cash < E.structCost(me, st) || !E.buildHexes(dispState(), you, st).length)) mode = null;
      refreshAll(); return;
    }
    if (mode && mode.type === 'tactic') {
      if (!k) return cancel();
      const def = E.TACTICS[mode.id];
      if (def.target === 'heli' && !mode.from) {
        if (!Render.ov.targets.has(k)) { toast('Pick one of your stacks', 'err'); return; }
        mode.from = k; refreshAll(); SFX.select(); return;
      }
      if (!Render.ov.targets.has(k)) { toast('Not a valid target', 'err'); SFX.error(); return; }
      const a = { a: 'tactic', uid: mode.uid, target: k }; if (mode.from) a.from = mode.from;
      burnCard(mode.el); mode = null; refreshAll();
      await doAction(a); return;
    }
    if (sel && sel.units.size && canCommand() && k && k !== sel.hex) {
      const ov = Render.ov;
      if (ov.fire && ov.fire.has(k)) { const a = { a: 'fire', from: sel.hex, units: [...sel.units], to: k }; sel = null; refreshAll(); await doAction(a); return; }
      const r = ov.reach && ov.reach[k];
      if (r && r.kind !== 'start' && r.kind !== 'pass') {
        const a = { a: 'move', from: sel.hex, units: [...sel.units], to: k };
        sel = null; refreshAll();
        await doAction(a); return;
      }
    }
    if (!k || (sel && sel.hex === k)) { sel = null; refreshAll(); return; }
    selectHex(k);
  }

  // ───────────── HUD rendering ─────────────
  function refreshAll() {
    if (!S) return;
    Render.setState(dispState());
    updateOverlays();
    renderTop(); renderCash(); renderPlan(); renderHexPanel(); renderHand(); renderEnd(); renderModeHint(); renderOffer();
  }

  function renderTop() {
    const box = $('#players'); box.innerHTML = '';
    const counts = {}; for (const k in S.map.tiles) { const o = S.map.tiles[k].owner; if (o) counts[o] = (counts[o] || 0) + 1; }
    for (const p of S.players) {
      const f = E.FACTIONS[p.faction];
      const c = el('div', 'pchip' + (curP().id === p.id && S.phase === 'play' ? ' cur' : '') + (p.alive ? '' : ' dead') + (p.id === you ? ' me' : ''));
      c.style.setProperty('--pc', p.color);
      const extra = S.map.beacon ? ` · ◆${p.koth}/3` : '';
      c.innerHTML = `<div class="av"><img src="${Art.iconURL('glyph', f ? f.glyph : 'shield', '#0b0f13', 48)}"></div><div><div class="pn">${esc(p.name)}</div><div class="ps"><span>⬢ <b>${counts[p.id] || 0}</b></span><span>$<b>${p.cash}</b></span><span>🂠 <b>${p.tacticCount ?? p.tactics.length}</b></span>${extra}</div></div>`;
      c.title = f ? f.name + ' — ' + f.perk + ': ' + f.desc : '';
      c.onclick = () => Render.focus(p.hq);
      if (isMyTurn() && S.turn.stage === 'act' && p.id !== you && p.alive && !S.trade) {
        const tb = el('button', 'tradebtn', 'TRADE'); tb.onclick = e => { e.stopPropagation(); SFX.select(); openTrade(p.id); }; c.appendChild(tb);
      }
      box.appendChild(c);
    }
    const modeTxt = S.settings.mode === 'conquest' ? `Conquest · first to <b style="display:inline;font-size:12px;color:var(--gold)">${E.conquestTarget(S)}</b> hexes` : S.settings.mode === 'koth' ? 'Beacon · hold the centre for 3 turns' : 'Domination · capture every HQ';
    $('#roundBox').innerHTML = `<b>ROUND ${S.turn.round}${S.settings.maxRounds ? '/' + S.settings.maxRounds : ''}</b>${modeTxt}`;
  }

  let shownCash = null;
  function renderCash() {
    const me = myP(); const box = $('#cashBox');
    box.hidden = !me;
    if (!me) return;
    const ds = dispState(); const dm = ds.players.find(p => p.id === you);
    if (shownCash === null) { shownCash = me.cash; $('#cash').textContent = me.cash; }
    if (planning()) $('#cash').textContent = dm.cash;
    else if (!countCash.running) $('#cash').textContent = me.cash;
    const inc = E.computeIncome(S, you);
    $('#incomeLine').innerHTML = `Income <b>+$${inc.total}</b> /turn` + (planning() ? ' · <span style="color:var(--blue)">blueprint view</span>' : '');
    $('#incomeLine').title = `Base $${inc.base} + $${inc.fromHex} from ${inc.hexes} hexes (1 per 3) + $${inc.fromRes} resources + $${inc.ref} refineries`;
    $('#hexLine').innerHTML = `⬢ ${inc.hexes + inc.cut} hexes` + (inc.cut ? ` · <span style="color:#ff9aa3">${inc.cut} cut off</span>` : '');
  }
  function countCash(from, to) {
    const e = $('#cash'); countCash.running = true;
    const steps = Math.min(20, Math.abs(to - from)); let i = 0;
    e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump');
    const tick = () => {
      i++; const v = Math.round(from + (to - from) * (i / steps));
      e.textContent = v; if (to > from && i % 2) SFX.chip(i / 2 | 0);
      if (i < steps) setTimeout(tick, 28); else { countCash.running = false; e.textContent = myP() ? (planning() ? dispState().players.find(p => p.id === you).cash : myP().cash) : to; }
    };
    if (steps) tick(); else countCash.running = false;
  }

  function renderHexPanel() {
    const box = $('#hexPanel');
    const k = sel ? sel.hex : null;
    if (!k) { box.hidden = true; return; }
    const ds = dispState(), t = ds.map.tiles[k];
    if (!t) { box.hidden = true; return; }
    box.hidden = false;
    const owner = t.owner ? ds.players.find(p => p.id === t.owner) : null;
    const tags = [];
    if (t.res) tags.push('<span class="hp-tag res">◆ Resource +$2</span>');
    if (E.TERRAIN[t.t].defMult) tags.push(`<span class="hp-tag">+${E.TERRAIN[t.t].defMult} Mult defence</span>`);
    if (E.TERRAIN[t.t].moveCost) tags.push('<span class="hp-tag">Costs 2 move</span>');
    if (t.contam) tags.push(`<span class="hp-tag cut">☢ Fallout ${t.contam} rounds</span>`);
    if (t.smoke) tags.push('<span class="hp-tag">Smoke</span>');
    if (ds.map.beacon === k) tags.push('<span class="hp-tag" style="color:var(--gold)">◆ BEACON</span>');
    if (t.owner === you && !E.supplySet(ds, you).has(k)) tags.push('<span class="hp-tag cut">Cut off — no income</span>');
    let h = `<div class="hp-title">${t.contam ? 'Fallout Zone' : E.TERRAIN[t.t].name}</div><div class="hp-own">${owner ? `<span style="color:${owner.color}">■ ${esc(owner.name)}</span>` : '<span class="sub">Unclaimed</span>'}</div><div class="hp-tags">${tags.join('')}</div>`;
    if (t.struct) { const sd = E.STRUCTS[t.struct.type]; h += `<div class="urow" style="cursor:default"><img src="${Art.iconURL('struct', t.struct.type)}"><div class="un">${sd.name}<div class="st">${sd.desc}</div></div></div>`; }
    const units = Object.values(ds.units).filter(u => u.hex === k);
    if (units.length) {
      const mine = units[0].owner === you;
      h += `<div class="hp-sec">${mine ? 'Your units' + (canCommand() ? ' — click to toggle' : '') : 'Enemy units'}</div>`;
      for (const u of units) {
        const d = E.UNITS[u.type], ready = E.canAct(ds, u);
        const status = u.stun ? 'FROZEN' : u.fresh && !ready ? 'just deployed' : u.moved ? 'done' : ready ? 'ready' : '';
        h += `<div class="urow${sel.units.has(u.id) ? ' sel' : ''}${mine && !ready ? ' done' : ''}" data-u="${u.id}"><img src="${Art.iconURL('unit', u.type, mine ? '#fff' : pColor(u.owner))}"><div class="un">${d.name}<div class="us"><span class="a">ATK ${d.atk}</span><span class="d">DEF ${d.def}</span><span>MV ${E.moveAllow(ds, u)}${d.range ? ' · RNG ' + d.range : ''}</span></div></div><div class="st">${status}</div></div>`;
      }
    }
    if (t.owner === you && !t.struct && canCommand()) h += '<div class="hp-sec">Build here with the hotbar · keys Z–M</div>';
    box.innerHTML = h;
    box.querySelectorAll('.urow[data-u]').forEach(r => r.onclick = () => {
      const id = +r.dataset.u, u = ds.units[id];
      if (!u || u.owner !== you || !E.canAct(ds, u) || !canCommand()) return;
      sel.units.has(id) ? sel.units.delete(id) : sel.units.add(id);
      SFX.click(); refreshAll();
    });
  }

  function cardEl(id, opts = {}) {
    const d = E.cardDef(id);
    const c = el('div', `card r-${d.rarity} k-${d.kind}${opts.mini ? ' mini' : ''}`);
    c.style.setProperty('--dl', (-Math.random() * 4).toFixed(2) + 's');
    const cost = opts.cost ?? d.cost;
    let stats = '';
    if (d.kind === 'unit') stats = `<div class="c-stats"><span class="a">⚔${d.atk}</span><span class="d">⛨${d.def}</span><span class="m">➜${d.mv}</span></div>`;
    c.innerHTML = `<div class="ci"><div class="c-cost">$${cost}</div><div class="badge">${E.RARITY[d.rarity].name.toUpperCase()}</div><div class="c-art" style="background-image:url(${Art.cardArt(id)})"></div><div class="c-name">${d.name}</div><div class="c-type">${d.kind === 'unit' ? 'Unit · ' + ({ inf: 'Infantry', veh: 'Vehicle', air: 'Air', art: 'Artillery', sea: 'Naval' })[d.cls] : 'Tactic · single use'}</div>${stats}<div class="c-desc">${d.desc}</div><div class="c-shine"></div></div>`;
    const ci = c.firstChild;
    c.addEventListener('mousemove', e => { const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; ci.style.setProperty('--ry', (x * 22).toFixed(1) + 'deg'); ci.style.setProperty('--rx', (-y * 22).toFixed(1) + 'deg'); c.style.setProperty('--ry', (x * 22).toFixed(1) + 'deg'); });
    c.addEventListener('mouseleave', () => { ci.style.setProperty('--rx', '0deg'); ci.style.setProperty('--ry', '0deg'); });
    c.addEventListener('mouseenter', () => SFX.hover());
    return c;
  }

  // ───────────── hotbar (units 1-0, buildings Z-M) + tactic hand ─────────────
  const UNIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const BUILD_KEYS = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];
  const BUILDS = ['fob', 'bunker', 'refinery', 'flak', 'port', 'market', 'depot'];
  let hotbarSig = '';
  function hotbarItems() {
    const ds = dispState(); const me = ds && ds.players.find(p => p.id === you);
    if (!me || !me.alive) return { units: [], builds: [] };
    return { me, ds, units: me.arsenal.slice(0, 10), builds: BUILDS };
  }
  function slotEl(kind, id, key, cost, me, count) {
    const d = kind === 'unit' ? E.UNITS[id] : E.STRUCTS[id];
    const s = el('div', 'slot k-' + kind + (kind === 'unit' ? ' r-' + d.rarity : ''));
    s.dataset.kind = kind; s.dataset.id = id;
    s.innerHTML = `<span class="sk">${key.toUpperCase()}</span><img src="${Art.iconURL(kind === 'unit' ? 'unit' : 'struct', id, '#fff', 72)}"><span class="sc">$${cost}</span>` + (count ? `<span class="sn">${count}</span>` : '');
    if (me.cash < cost) s.classList.add('poor');
    if (mode && ((mode.type === 'deploy' && kind === 'unit' && mode.unit === id) || (mode.type === 'build' && kind === 'build' && mode.struct === id))) s.classList.add('on');
    s.onclick = () => armSlot(kind, id);
    s.onmouseenter = () => { SFX.hover(); showSlotTip(s, kind, id); };
    s.onmouseleave = hideSlotTip;
    return s;
  }
  function renderHand() {
    const { me, ds, units, builds } = hotbarItems();
    const hu = $('#hbUnits'), hb = $('#hbBuild'), hand = $('#hand');
    if (!me) { hu.innerHTML = hb.innerHTML = hand.innerHTML = ''; return; }
    const counts = {}; for (const u of Object.values(ds.units)) if (u.owner === you) counts[u.type] = (counts[u.type] || 0) + 1;
    const sig = JSON.stringify([units, me.cash, mode, counts, me.tactics.map(c => c.uid), canCommand()]);
    if (sig === hotbarSig) return; hotbarSig = sig;
    const prevIds = new Set([...hu.children].map(c => c.dataset.id));
    hu.innerHTML = ''; hb.innerHTML = '';
    units.forEach((id, i) => { const s = slotEl('unit', id, UNIT_KEYS[i], E.unitCost(me, id), me, counts[id]); if (prevIds.size && !prevIds.has(id)) s.classList.add('new'); hu.appendChild(s); });
    builds.forEach((id, i) => hb.appendChild(slotEl('build', id, BUILD_KEYS[i], E.structCost(me, id), me)));
    // tactic hand
    const prevHand = new Set([...hand.children].map(c => c.dataset.uid));
    hand.innerHTML = '';
    const n = me.tactics.length;
    me.tactics.forEach((card, i) => {
      const d = E.TACTICS[card.id];
      const c = cardEl(card.id); c.dataset.uid = card.uid;
      c.style.setProperty('--fan', ((i - (n - 1) / 2) * 5) + 'deg');
      c.style.setProperty('--lift', (Math.abs(i - (n - 1) / 2) * 6) + 'px');
      if (me.cash < d.cost) c.classList.add('poor');
      if (prevHand.size && !prevHand.has(String(card.uid))) c.classList.add('new');
      if (mode && mode.type === 'tactic' && mode.uid === card.uid) c.classList.add('active');
      c.onclick = () => playTactic(card, c);
      hand.appendChild(c);
    });
  }
  function showSlotTip(slot, kind, id) {
    const tip = $('#slotTip'); tip.innerHTML = '';
    if (kind === 'unit') tip.appendChild(cardEl(id));
    else { const d = E.STRUCTS[id]; tip.innerHTML = `<div class="btip"><img src="${Art.iconURL('struct', id, '#fff', 96)}"><b>${d.name}</b><span>${d.desc}</span></div>`; }
    const r = slot.getBoundingClientRect();
    tip.style.left = (r.left + r.width / 2) + 'px'; tip.style.top = (r.top - 12) + 'px';
    tip.hidden = false;
  }
  function hideSlotTip() { $('#slotTip').hidden = true; }

  function armSlot(kind, id) {
    const ds = dispState(); const me = ds.players.find(p => p.id === you);
    if (!me || !canCommand()) { toast(isMyTurn() ? 'Collect your supply drop first' : 'Wait for your turn', 'err'); SFX.error(); return; }
    if (kind === 'unit') {
      const cost = E.unitCost(me, id);
      if (mode && mode.type === 'deploy' && mode.unit === id) { mode = null; refreshAll(); return; }
      if (me.cash < cost) { toast('Need $' + cost, 'err'); SFX.error(); shakeSlot(kind, id); return; }
      const spots = E.deployHexes(ds, you, id);
      if (!spots.length) { toast(E.isSea(id) ? 'Build a Port on the coast to launch ships' : 'All deploy points are full', 'err'); SFX.error(); shakeSlot(kind, id); return; }
      mode = { type: 'deploy', unit: id };
    } else {
      const cost = E.structCost(me, id);
      if (mode && mode.type === 'build' && mode.struct === id) { mode = null; refreshAll(); return; }
      if (me.cash < cost) { toast('Need $' + cost, 'err'); SFX.error(); shakeSlot(kind, id); return; }
      if (!E.buildHexes(ds, you, id).length) { toast(id === 'port' ? 'No free coastal hex in supply' : 'Nowhere to build that', 'err'); SFX.error(); shakeSlot(kind, id); return; }
      mode = { type: 'build', struct: id };
    }
    sel = null; SFX.select(); refreshAll();
  }
  function shakeSlot(kind, id) { const s = document.querySelector(`.slot[data-kind="${kind}"][data-id="${id}"]`); if (s) { s.classList.remove('nope'); void s.offsetWidth; s.classList.add('nope'); } }

  async function playTactic(card, elc) {
    const ds = dispState(); const me = ds.players.find(p => p.id === you); const d = E.TACTICS[card.id];
    if (planning()) { toast('Tactics are played live on your turn', 'err'); SFX.error(); return; }
    if (!canCommand()) return;
    if (me.cash < d.cost) { toast('Need $' + d.cost, 'err'); SFX.error(); return; }
    if (mode && mode.uid === card.uid) { mode = null; refreshAll(); return; }
    if (d.target === 'none') { mode = null; burnCard(elc); await doAction({ a: 'tactic', uid: card.uid }); return; }
    if (!E.tacticTargets(ds, you, card.id).length) { toast('No valid targets right now', 'err'); SFX.error(); return; }
    mode = { type: 'tactic', uid: card.uid, id: card.id, from: null, el: elc }; sel = null; SFX.select(); refreshAll();
  }
  // a played card flies to the centre and burns away
  function burnCard(src) {
    if (!src) return;
    const r = src.getBoundingClientRect();
    const f = src.cloneNode(true); f.className = src.className + ' flying burn';
    Object.assign(f.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    $('#flyLayer').appendChild(f);
    requestAnimationFrame(() => { f.style.transform = `translate(${innerWidth / 2 - r.left - r.width / 2}px, ${innerHeight * 0.4 - r.top - r.height / 2}px) scale(1.5) rotate(-6deg)`; });
    SFX.card(); setTimeout(() => SFX.whoosh(), 250);
    setTimeout(() => f.remove(), 1100);
  }
  // fly a DOM element from one rect to another (supply pick → hotbar/hand)
  function flyTo(src, target, onLand) {
    const r = src.getBoundingClientRect(), t = target.getBoundingClientRect();
    const f = src.cloneNode(true); f.classList.add('flying');
    Object.assign(f.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    $('#flyLayer').appendChild(f);
    const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height / 2 - (r.top + r.height / 2);
    const sc = Math.max(0.2, t.width / r.width);
    f.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', offset: 0 },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.1 - 120}px) scale(1.15) rotate(-8deg)`, offset: 0.35 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(10deg)`, offset: 1 },
    ], { duration: 650 * speed(), easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).onfinish = () => { f.remove(); if (onLand) onLand(); };
  }
  function pulseTarget(target) { target.classList.remove('land'); void target.offsetWidth; target.classList.add('land'); }

  let timerInt = null;
  function renderEnd() {
    const b = $('#endBtn');
    const mine = isMyTurn();
    b.hidden = !mine || S.phase !== 'play';
    b.disabled = animating || executing;
    clearInterval(timerInt);
    const draw = () => {
      let tm = '';
      if (S.turn.deadline) { const s = Math.max(0, Math.ceil((S.turn.deadline - Date.now()) / 1000)); tm = `<span class="tmr">${s}s left</span>`; }
      b.innerHTML = 'END TURN' + tm;
    };
    draw(); if (S.turn.deadline && mine) timerInt = setInterval(draw, 500);
    // pulse when nothing left to do
    const ds = S; const anyReady = Object.values(ds.units).some(u => u.owner === you && E.canAct(ds, u));
    b.classList.toggle('pulse', mine && !anyReady);
  }
  $('#endBtn').onclick = async () => { if (!isMyTurn() || animating) return; mode = null; sel = null; SFX.click(); await act({ a: 'end' }); };

  function renderModeHint() {
    const h = $('#modeHint'); let txt = '';
    if (mode && mode.type === 'deploy') txt = `Deploy ${E.UNITS[mode.unit].name} — click a glowing ${E.isSea(mode.unit) ? 'sea hex by your Port' : 'HQ / FOB'} · right-click to stop`;
    else if (mode && mode.type === 'build') txt = `Build ${E.STRUCTS[mode.struct].name} — click a glowing hex · right-click to stop`;
    else if (mode && mode.type === 'tactic') { const d = E.TACTICS[mode.id]; txt = d.target === 'heli' && !mode.from ? 'Heli Drop — pick the stack to fly' : `${d.name} — pick a target · right-click to cancel`; }
    else if (planning() && sel && sel.units.size) txt = 'Blueprint — click a hex to queue this move';
    else if (!isMyTurn() && S.phase === 'play' && curP()) txt = '';
    h.hidden = !txt; h.textContent = txt;
  }

  // ───────────── tooltip ─────────────
  function showHexTip(k, x, y) {
    const tip = $('#tooltip');
    if (!k || !S) return hideTip();
    const ov = Render.ov, ds = dispState();
    let html = '';
    if (ov.reach && ov.reach[k] && (ov.reach[k].kind === 'attack') && sel) {
      const path = E.pathTo(ov.reach, k);
      const c = E.combatCalc(ds, you, [...sel.units].map(id => ds.units[id]), path[path.length - 2], k, false);
      html = combatTip('ATTACK', c);
    } else if (ov.fire && ov.fire.has(k) && sel) {
      const c = E.combatCalc(ds, you, [...sel.units].map(id => ds.units[id]), sel.hex, k, true);
      html = combatTip('BOMBARD', c) + '<div class="sub">Win: destroy 1 unit (2 on double score). Lose: nothing happens.</div>';
    } else if (ov.reach && ov.reach[k] && ov.reach[k].kind === 'capture') html = '<b>SEIZE</b> — empty enemy hex';
    else {
      const t = ds.map.tiles[k];
      const units = Object.values(ds.units).filter(u => u.hex === k);
      if (!units.length && !t.struct) return hideTip();
      html = `<b>${t.owner ? esc(pName(t.owner)) : 'Unclaimed'}</b>` + (t.struct ? ' · ' + E.STRUCTS[t.struct.type].name : '');
      if (units.length) html += '<br>' + units.map(u => E.UNITS[u.type].name).join(', ');
    }
    tip.innerHTML = html; tip.hidden = false;
    tip.style.left = Math.min(innerWidth - 270, x + 16) + 'px'; tip.style.top = (y + 16) + 'px';
  }
  function combatTip(title, c) {
    const col = c.winProb >= 0.66 ? 'var(--green)' : c.winProb >= 0.4 ? 'var(--gold)' : 'var(--red)';
    const bon = b => b.map(x => `${x.label} ${x.chips ? '+' + x.chips + 'c' : '+' + x.mult + 'x'}`).join(', ');
    return `<b>${title}</b> <span class="odds" style="color:${col}">${Math.round(c.winProb * 100)}%</span><br>` +
      `You: <span style="color:var(--chips)">${c.att.chips}</span> × (d6<span style="color:var(--mult)">${c.att.mult ? '+' + c.att.mult : ''}</span>)` + (c.att.bonuses.length ? `<div class="sub">${bon(c.att.bonuses)}</div>` : '') +
      `Them: <span style="color:var(--chips)">${c.def.chips}</span> × (d6<span style="color:var(--mult)">${c.def.mult ? '+' + c.def.mult : ''}</span>)` + (c.def.bonuses.length ? `<div class="sub">${bon(c.def.bonuses)}</div>` : '');
  }
  function hideTip() { $('#tooltip').hidden = true; }

  // ───────────── supply drop: face-down deal, flip reveal, pick flies to your bar ─────────────
  let supplyKey = '';
  const RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  function showSupply() {
    const box = $('#supply');
    const key = S.turn.round + ':' + S.turn.idx + ':' + S.turn.rerolls;
    if (!box.hidden && supplyKey === key) return;
    supplyKey = key;
    const me = myP(); const inc = S.turn.income, half = Math.floor(inc / 2);
    box.innerHTML = `<div class="sd-rays"></div><h2>SUPPLY DROP</h2><div class="sub">Round ${S.turn.round} — take a card <b>and $${half}</b>, or skip the cards and collect the full <b>$${inc}</b>.</div>`;
    const offer = el('div', 'offer');
    const cards = [];
    let locked = true;
    S.turn.offer.forEach((id, i) => {
      const d = E.cardDef(id);
      const wrap = el('div', 'flip r-' + d.rarity);
      wrap.style.setProperty('--dl', (i * 0.1) + 's');
      const back = el('div', 'cback', '<div class="cb-logo">S</div>');
      const front = cardEl(id); front.classList.add('cfront');
      front.appendChild(el('div', 'take', 'TAKE + $' + half));
      wrap.append(back, front);
      wrap.onclick = async () => {
        if (locked || wrap.dataset.busy) return;
        if (!wrap.classList.contains('open')) return;
        locked = true; wrap.dataset.busy = 1;
        cards.forEach(c => { if (c !== wrap) c.classList.add('discard'); });
        d.rarity === 'legendary' ? SFX.legendary() : d.rarity === 'rare' ? SFX.rare() : SFX.select();
        // fly to the matching slot (or the hand for tactics)
        const target = d.kind === 'unit' ? ($('#hbUnits').lastElementChild || $('#hbUnits')) : ($('#hand').lastElementChild || $('#hand'));
        box.classList.add('leaving');
        flyTo(front, target, () => { pulseTarget(target); SFX.coin(2); });
        wrap.style.visibility = 'hidden';
        const ok = await act({ a: 'choose', pick: 'card', idx: i });
        if (ok && plan.length) runPlan();
      };
      cards.push(wrap); offer.appendChild(wrap);
    });
    box.appendChild(offer);
    const row = el('div', 'supply-row');
    const col = el('button', 'btn big green', 'COLLECT $' + inc);
    col.onclick = async () => { if (col.disabled) return; col.disabled = true; SFX.coin(5); burstCash(col); box.classList.add('leaving'); const ok = await act({ a: 'choose', pick: 'income' }); if (ok && plan.length) runPlan(); };
    const rr = el('button', 'btn big gold', 'REROLL $' + (2 + S.turn.rerolls));
    rr.disabled = me.cash < 2 + S.turn.rerolls;
    rr.onclick = () => { if (locked) return; SFX.card(); cards.forEach(c => c.classList.add('discard')); setTimeout(() => act({ a: 'reroll' }), 250 * speed()); };
    const look = el('button', 'btn big', 'PEEK MAP');
    look.onmousedown = () => { box.style.opacity = 0.06; }; look.onmouseup = look.onmouseleave = () => { box.style.opacity = 1; };
    row.append(col, rr, look); box.appendChild(row);
    box.classList.remove('leaving');
    box.hidden = false;
    // flip them one by one; rarer cards get a bigger reveal
    (async () => {
      await sleep(450);
      for (let i = 0; i < cards.length; i++) {
        const d = E.cardDef(S.turn.offer[i] || 'grunt'); const c = cards[i]; const rank = RANK[d.rarity];
        if (rank >= 2) { c.classList.add('charge'); SFX.zap(); await sleep(rank === 3 ? 900 : 450); }
        c.classList.add('open'); SFX.card();
        if (rank >= 1) revealFx(c, d.rarity);
        await sleep(rank === 3 ? 700 : 230);
      }
      locked = false;
    })();
  }
  function revealFx(c, rarity) {
    const r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const col = E.RARITY[rarity].color;
    const n = { uncommon: 14, rare: 28, legendary: 70 }[rarity];
    for (let i = 0; i < n; i++) {
      const p = el('div', 'spark'); p.style.background = i % 3 ? col : '#fff';
      const a = Math.random() * Math.PI * 2, dist = 80 + Math.random() * (rarity === 'legendary' ? 320 : 160);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      $('#flyLayer').appendChild(p);
      p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist - 4}px, ${Math.sin(a) * dist - 4}px) scale(0)`, opacity: 0 }], { duration: 600 + Math.random() * 600, easing: 'cubic-bezier(.1,.8,.3,1)' }).onfinish = () => p.remove();
    }
    const ring = el('div', 'ringfx'); ring.style.left = x + 'px'; ring.style.top = y + 'px'; ring.style.borderColor = col; $('#flyLayer').appendChild(ring);
    setTimeout(() => ring.remove(), 800);
    if (rarity === 'rare') { SFX.rare(); Render.shake(4); }
    if (rarity === 'legendary') {
      SFX.legendary(); Render.shake(14); Render.flash(0.35, '#ffb52e');
      const b = el('div', 'legend-banner', 'LEGENDARY'); $('#flyLayer').appendChild(b); setTimeout(() => b.remove(), 1800);
      $('#supply').classList.add('legend');
    }
  }
  function burstCash(btn) {
    const r = btn.getBoundingClientRect(), t = $('#cash').getBoundingClientRect();
    for (let i = 0; i < 12; i++) {
      const c = el('div', 'coinfx', '$'); c.style.left = (r.left + r.width / 2) + 'px'; c.style.top = (r.top + r.height / 2) + 'px';
      $('#flyLayer').appendChild(c);
      const mx = (Math.random() - 0.5) * 300, my = -100 - Math.random() * 150;
      c.animate([{ transform: 'translate(-50%,-50%) scale(.6)' }, { transform: `translate(${mx}px, ${my}px) scale(1.2)`, offset: 0.4 }, { transform: `translate(${t.left - r.left - r.width / 2}px, ${t.top - r.top - r.height / 2}px) scale(.5)` }], { duration: 700 + i * 40, easing: 'cubic-bezier(.4,0,.6,1)' }).onfinish = () => { c.remove(); SFX.chip(i); };
    }
  }
  function hideSupply() { $('#supply').hidden = true; $('#supply').classList.remove('legend'); supplyKey = ''; }

  // ───────────── combat sequence (chips × mult) ─────────────
  function dieFace(d, n) {
    const on = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[n];
    d.innerHTML = ''; for (let i = 0; i < 9; i++) d.appendChild(el('i', on.includes(i) ? 'on' : ''));
  }
  async function showCombat(ev) {
    try { await combatSeq(ev); } catch (e) { console.error(e); }
    $('#combat').hidden = true; $('#combat').onclick = null;
  }
  function combatSeq(ev) {
    return new Promise(async (resolve, reject) => { try {
      const box = $('#combat'); box.innerHTML = ''; box.hidden = false;
      fastForward = false;
      box.onclick = () => { fastForward = true; };
      const wrap = el('div', 'cb');
      const side = (role, data, name, color) => {
        const s = el('div', 'cb-side'); s.style.setProperty('--pc', color);
        s.innerHTML = `<div class="cb-role">${role}</div><div class="cb-name">${esc(name)}</div><div class="cb-units"></div><div class="cb-bon"></div><div class="cb-calc"><div class="cb-box chips">0</div><div class="cb-x">×</div><div class="cb-box mult">0</div></div><div class="cb-die"></div><div class="cb-score">0</div>`;
        dieFace(s.querySelector('.cb-die'), 1);
        return s;
      };
      const A = side(ev.ranged ? 'BOMBARDMENT' : 'ATTACKER', ev.att, pName(ev.att.pid), pColor(ev.att.pid));
      const D = side('DEFENDER', ev.def, ev.def.pid ? pName(ev.def.pid) : 'Garrison', ev.def.pid ? pColor(ev.def.pid) : '#aaa');
      const vs = el('div', 'cb-vs', 'VS');
      wrap.append(A, vs, D);
      wrap.appendChild(el('div', 'cb-odds', `pre-battle odds ${Math.round(ev.winProb * 100)}% · click to skip`));
      box.appendChild(wrap);
      SFX.whoosh();
      await sleep(250);
      const sides = [[A, ev.att], [D, ev.def]];
      // units → chips
      const unitChips = (data, isAtt) => data.units.map(t => isAtt ? E.UNITS[t].atk : E.UNITS[t].def);
      const counters = [0, 0];
      const maxUnits = Math.max(ev.att.units.length, ev.def.units.length);
      let note = 0;
      for (let i = 0; i < maxUnits; i++) {
        sides.forEach(([s, d], si) => {
          const t = d.units[i]; if (!t) return;
          const img = el('img'); img.src = Art.iconURL('unit', t, '#fff', 64); s.querySelector('.cb-units').appendChild(img);
          counters[si] += unitChips(d, si === 0)[i];
          const box = s.querySelector('.chips'); box.textContent = counters[si]; box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit');
        });
        SFX.chip(note++);
        await sleep(170);
      }
      // bonuses
      const mults = [0, 0];
      const maxB = Math.max(ev.att.bonuses.length, ev.def.bonuses.length);
      for (let i = 0; i < maxB; i++) {
        sides.forEach(([s, d], si) => {
          const b = d.bonuses[i]; if (!b) return;
          const row = el('div', 'cb-b', `<span>${b.label}</span><span class="v ${b.chips ? 'c' : 'm'}">+${b.chips || b.mult} ${b.chips ? 'Chips' : 'Mult'}</span>`);
          s.querySelector('.cb-bon').appendChild(row);
          if (b.chips) { counters[si] += b.chips; const bx = s.querySelector('.chips'); bx.textContent = counters[si]; bx.classList.remove('hit'); void bx.offsetWidth; bx.classList.add('hit'); }
          else { mults[si] += b.mult; const bx = s.querySelector('.mult'); bx.textContent = '+' + mults[si]; bx.classList.remove('hit'); void bx.offsetWidth; bx.classList.add('hit'); }
        });
        SFX.mult(i);
        await sleep(260);
      }
      sides.forEach(([s, d]) => { s.querySelector('.chips').textContent = d.chips; });
      // dice: thrown into the tray (drag & fling yours, the other is thrown for you)
      const dice = sides.map(([s]) => s.querySelector('.cb-die'));
      dice.forEach(d => d.classList.add('hidden-die'));
      const tray = el('canvas', 'cb-tray');
      wrap.appendChild(tray);
      const mineA = ev.att.pid === you, mineD = ev.def.pid === you;
      await throwDice(tray, [
        { final: ev.att.roll, raw: ev.att.raw, color: pColor(ev.att.pid), human: mineA, side: -1 },
        { final: ev.def.roll, raw: ev.def.raw, color: ev.def.pid ? pColor(ev.def.pid) : '#aaa', human: mineD, side: 1 },
      ]);
      sides.forEach(([s, d], si) => {
        dice[si].classList.remove('hidden-die'); dieFace(dice[si], d.roll);
        if (d.raw !== d.roll) { dice[si].classList.add('loaded'); s.querySelector('.cb-bon').appendChild(el('div', 'cb-b', '<span>Loaded Dice</span><span class="v m">1 → 3</span>')); }
        const mb = s.querySelector('.mult'); mb.textContent = d.roll + d.mult; mb.classList.remove('hit'); void mb.offsetWidth; mb.classList.add('hit');
      });
      SFX.mult(6); Render.shake(5);
      await sleep(420);
      // score count-up
      const targets = [ev.att.score, ev.def.score];
      const scoreEls = sides.map(([s]) => s.querySelector('.cb-score'));
      const steps = 16;
      for (let i = 1; i <= steps; i++) {
        scoreEls.forEach((e, si) => { e.textContent = Math.round(targets[si] * i / steps); });
        if (i % 2) SFX.chip(5 + i / 2);
        await sleep(32);
      }
      const attWin = ev.attWin;
      (attWin ? A : D).classList.add('win'); (attWin ? D : A).classList.add('lose');
      let txt;
      if (ev.ranged) txt = attWin ? (ev.killed.length > 1 ? 'DOUBLE HIT!' : 'DIRECT HIT!') : 'MISSED!';
      else txt = attWin ? 'BREAKTHROUGH!' : 'REPELLED!';
      const res = el('div', 'cb-result', txt + (ev.pyrrhic.length ? '<small>pyrrhic — winner lost a unit</small>' : ''));
      wrap.appendChild(res);
      SFX.victoryHit(); Render.shake(12);
      if ((attWin && ev.att.pid === you) || (!attWin && ev.def.pid === you)) SFX.win();
      await sleep(1000);
      resolve();
    } catch (e) { reject(e); } });
  }

  // ───────────── dice tray physics ─────────────
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  function throwDice(cv, specs) {
    return new Promise(resolve => {
      const W = 640, H = 200, DPR = Math.min(2, devicePixelRatio || 1);
      cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
      const SZ = 46;
      const dice = specs.map(sp => ({ ...sp, x: sp.side < 0 ? 70 : W - 70, y: H / 2, vx: 0, vy: 0, a: 0, va: 0, face: 1 + Math.floor(Math.random() * 6), thrown: false, settled: false, travel: 0, pop: 0, held: false, hist: [] }));
      const parts = [];
      let done = false, t0 = performance.now(), last = t0, waitStart = t0;
      const anyHuman = dice.some(d => d.human);
      const fling = (d, vx, vy) => { d.thrown = true; d.vx = vx; d.vy = vy; d.va = (Math.random() - 0.5) * 30 + vx * 0.012; SFX.dice(); };
      const autoFling = d => fling(d, -d.side * (650 + Math.random() * 350), (Math.random() - 0.5) * 500);
      // bots / remote players throw after a beat
      dice.forEach(d => { if (!d.human) setTimeout(() => !d.thrown && autoFling(d), (anyHuman ? 500 : 250) + Math.random() * 250); });
      // pointer handling for the local player's die
      const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
      cv.onpointerdown = e => {
        e.stopPropagation();
        const [x, y] = pos(e);
        const d = dice.find(d => d.human && !d.thrown && Math.hypot(d.x - x, d.y - y) < SZ);
        if (d) { d.held = true; d.hist = [[x, y, performance.now()]]; cv.setPointerCapture(e.pointerId); SFX.click(); }
      };
      cv.onpointermove = e => {
        const d = dice.find(d => d.held); if (!d) return;
        const [x, y] = pos(e);
        d.x = Math.max(SZ / 2, Math.min(W - SZ / 2, x)); d.y = Math.max(SZ / 2, Math.min(H - SZ / 2, y));
        d.a += 0.08; d.hist.push([x, y, performance.now()]); if (d.hist.length > 6) d.hist.shift();
        if (Math.random() < 0.3) d.face = 1 + Math.floor(Math.random() * 6);
      };
      cv.onpointerup = e => {
        const d = dice.find(d => d.held); if (!d) return;
        d.held = false;
        const h = d.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b[2] - a[2]) / 1000;
        let vx = (b[0] - a[0]) / dt, vy = (b[1] - a[1]) / dt;
        const sp = Math.hypot(vx, vy);
        if (sp < 250) { vx = -d.side * 700; vy = (Math.random() - 0.5) * 300; } // a tap still throws
        const k = Math.min(1, 1900 / Math.max(1, Math.hypot(vx, vy)));
        fling(d, vx * k, vy * k);
      };
      cv.onclick = e => e.stopPropagation();
      const settle = d => {
        d.settled = true; d.face = d.final; d.vx = d.vy = d.va = 0;
        d.snapFrom = d.a; d.snapTo = Math.round(d.a / (Math.PI / 2)) * (Math.PI / 2); d.snapT = 0; d.pop = 1;
        SFX.diceLand(); SFX.chip(6 + d.final); Render.shake(3 + d.final);
        for (let i = 0; i < 16 + d.final * 3; i++) { const an = Math.random() * Math.PI * 2, s = 60 + Math.random() * 200; parts.push({ x: d.x, y: d.y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, life: 0, max: 0.5 + Math.random() * 0.4, col: i % 2 ? d.color : '#fff' }); }
      };
      const step = () => {
        if (done) return;
        const now = performance.now(); let dt = Math.min(0.033, (now - last) / 1000); last = now;
        if (fastForward) { dice.forEach(d => { if (!d.thrown) autoFling(d); if (!d.settled) settle(d); }); }
        // waiting human: auto throw after 5s
        dice.forEach(d => { if (d.human && !d.thrown && !d.held && now - waitStart > 5000) autoFling(d); });
        const sub = 4; dt /= sub;
        for (let s = 0; s < sub; s++) for (const d of dice) {
          if (!d.thrown || d.settled) continue;
          d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt;
          const fr = Math.pow(0.35, dt); d.vx *= fr; d.vy *= fr; d.va *= Math.pow(0.4, dt);
          d.travel += Math.hypot(d.vx, d.vy) * dt;
          if (d.travel > 26) { d.travel = 0; d.face = 1 + Math.floor(Math.random() * 6); }
          let hit = 0;
          if (d.x < SZ / 2) { d.x = SZ / 2; d.vx = Math.abs(d.vx) * 0.7; hit = Math.abs(d.vx); }
          if (d.x > W - SZ / 2) { d.x = W - SZ / 2; d.vx = -Math.abs(d.vx) * 0.7; hit = Math.abs(d.vx); }
          if (d.y < SZ / 2) { d.y = SZ / 2; d.vy = Math.abs(d.vy) * 0.7; hit = Math.abs(d.vy); }
          if (d.y > H - SZ / 2) { d.y = H - SZ / 2; d.vy = -Math.abs(d.vy) * 0.7; hit = Math.abs(d.vy); }
          if (hit > 80) { d.va += (Math.random() - 0.5) * 20; SFX.step(); if (hit > 300) Render.shake(2); for (let i = 0; i < 5; i++) parts.push({ x: d.x, y: d.y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0, max: 0.3, col: 'rgba(255,255,255,.7)' }); }
          if (Math.hypot(d.vx, d.vy) < 28 && Math.abs(d.va) < 2.5) settle(d);
        }
        // dice knock into each other
        const [p, q] = dice;
        if (p.thrown && q.thrown && !(p.settled && q.settled)) {
          const dx = q.x - p.x, dy = q.y - p.y, dd = Math.hypot(dx, dy);
          if (dd < SZ && dd > 0) {
            const nx = dx / dd, ny = dy / dd, push = (SZ - dd) / 2;
            p.x -= nx * push; p.y -= ny * push; q.x += nx * push; q.y += ny * push;
            const rel = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
            if (rel > 0) { for (const [d, sg] of [[p, -1], [q, 1]]) { if (d.settled) continue; d.vx += sg * rel * nx * 0.9; d.vy += sg * rel * ny * 0.9; d.va += (Math.random() - 0.5) * 25; } SFX.diceLand(); Render.shake(4); }
          }
        }
        // draw
        c.clearRect(0, 0, W, H);
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#13392f'); g.addColorStop(1, '#0b241d');
        c.fillStyle = g; c.beginPath(); c.roundRect ? c.roundRect(0, 0, W, H, 16) : c.rect(0, 0, W, H); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.05)'; for (let x = 20; x < W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
        if (dice.some(d => d.human && !d.thrown)) {
          const pulse = 0.55 + 0.45 * Math.sin(now / 160);
          c.font = '22px "Black Ops One", sans-serif'; c.textAlign = 'center'; c.fillStyle = `rgba(255,214,90,${pulse})`;
          c.fillText('DRAG & FLING YOUR DIE!', W / 2, H / 2 + 8);
          const left = Math.max(0, Math.ceil((5000 - (now - waitStart)) / 1000)); c.font = '13px "Chakra Petch", sans-serif'; c.fillStyle = 'rgba(255,255,255,.4)'; c.fillText('auto-throw in ' + left + 's', W / 2, H / 2 + 30);
        }
        for (let i = parts.length - 1; i >= 0; i--) { const pt = parts[i]; pt.life += dt * sub; if (pt.life > pt.max) { parts.splice(i, 1); continue; } pt.x += pt.vx * dt * sub; pt.y += pt.vy * dt * sub; pt.vx *= 0.95; pt.vy *= 0.95; c.globalAlpha = 1 - pt.life / pt.max; c.fillStyle = pt.col; c.fillRect(pt.x - 2, pt.y - 2, 4, 4); c.globalAlpha = 1; }
        for (const d of dice) {
          if (d.settled && d.snapT < 1) { d.snapT = Math.min(1, d.snapT + dt * sub * 6); d.a = d.snapFrom + (d.snapTo - d.snapFrom) * d.snapT; }
          if (d.pop > 0) d.pop = Math.max(0, d.pop - dt * sub * 2.2);
          const sc = 1 + d.pop * 0.45 + (d.held ? 0.15 : 0);
          c.save(); c.translate(d.x + 4, d.y + 6); c.rotate(d.a); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-SZ / 2 * sc, -SZ / 2 * sc, SZ * sc, SZ * sc); c.restore();
          c.save(); c.translate(d.x, d.y); c.rotate(d.a); c.scale(sc, sc);
          if (d.settled) { c.shadowColor = d.raw !== d.final ? '#c27dff' : d.color; c.shadowBlur = 18 + d.pop * 30; }
          c.fillStyle = '#f4f1e8'; c.beginPath(); c.roundRect ? c.roundRect(-SZ / 2, -SZ / 2, SZ, SZ, 9) : c.rect(-SZ / 2, -SZ / 2, SZ, SZ); c.fill();
          c.shadowBlur = 0; c.lineWidth = 3; c.strokeStyle = d.color; c.stroke();
          c.fillStyle = '#0b0f13';
          for (const [px, py] of PIPS[d.face]) { c.beginPath(); c.arc(px * SZ * 0.26, py * SZ * 0.26, SZ * 0.085, 0, Math.PI * 2); c.fill(); }
          c.restore();
        }
        if (dice.every(d => d.settled && d.snapT >= 1)) { done = true; setTimeout(resolve, 260 * speed()); return; }
        setTimeout(step, 16);
      };
      step();
    });
  }

  // ───────────── trading ─────────────
  function openTrade(pid) {
    const me = myP(), them = S.players.find(p => p.id === pid);
    if (!me || !them) return;
    const box = $('#trade');
    const st = { give: 0, get: 0, cards: new Set() };
    const draw = () => {
      box.innerHTML = `<div class="panel trade-card"><h3>TRADE WITH <span style="color:${them.color}">${esc(them.name.toUpperCase())}</span></h3>
        <div class="tr-cols"><div class="tr-col"><div class="tr-h">YOU GIVE</div>
          <div class="stepper" data-k="give"><button data-d="-5">−5</button><button data-d="-1">−</button><b>$${st.give}</b><button data-d="1">+</button><button data-d="5">+5</button></div>
          <div class="tr-cards">${me.tactics.map(c => `<div class="tr-card${st.cards.has(c.uid) ? ' on' : ''}" data-uid="${c.uid}"><img src="${Art.iconURL('tactic', c.id, '#fff', 48)}"><span>${E.TACTICS[c.id].name}</span></div>`).join('') || '<div class="sub">No tactic cards to offer</div>'}</div>
        </div><div class="tr-arrow">⇄</div><div class="tr-col"><div class="tr-h">YOU GET</div>
          <div class="stepper" data-k="get"><button data-d="-5">−5</button><button data-d="-1">−</button><b>$${st.get}</b><button data-d="1">+</button><button data-d="5">+5</button></div>
          <div class="sub">They have $${them.cash}. Their hand stays secret.</div>
        </div></div>
        <div class="row" style="justify-content:center"><button class="btn big green" id="trSend">SEND OFFER</button><button class="btn big" id="trClose">CANCEL</button></div></div>`;
      box.querySelectorAll('.stepper button').forEach(b => b.onclick = () => {
        const k = b.parentElement.dataset.k, max = k === 'give' ? me.cash : them.cash;
        st[k] = Math.max(0, Math.min(max, st[k] + +b.dataset.d)); SFX.chip(st[k] % 8); draw();
      });
      box.querySelectorAll('.tr-card').forEach(c => c.onclick = () => { const u = +c.dataset.uid; st.cards.has(u) ? st.cards.delete(u) : st.cards.add(u); SFX.card(); draw(); });
      $('#trClose').onclick = () => { box.hidden = true; SFX.click(); };
      $('#trSend').onclick = async () => {
        if (!st.give && !st.get && !st.cards.size) { toast('Put something on the table', 'err'); return; }
        box.hidden = true; SFX.select();
        await act({ a: 'trade', to: pid, give: { cash: st.give, cards: [...st.cards] }, get: { cash: st.get } });
      };
    };
    draw(); box.hidden = false;
  }
  function renderOffer() {
    const pop = $('#offerPop'); const t = S && S.trade;
    if (!t || t.hidden || S.phase !== 'play') { pop.hidden = true; pop.dataset.id = ''; return; }
    if (pop.dataset.id === String(t.id) && !pop.hidden) return;
    pop.dataset.id = t.id;
    const from = S.players.find(p => p.id === t.from), to = S.players.find(p => p.id === t.to);
    const gives = [t.give.cash ? `<b class="gold">$${t.give.cash}</b>` : '', ...(t.cardIds || []).map(id => `<span class="tcard r-${E.TACTICS[id].rarity}"><img src="${Art.iconURL('tactic', id, '#fff', 32)}">${E.TACTICS[id].name}</span>`)].filter(Boolean).join(' + ') || 'nothing';
    const gets = t.get.cash ? `<b class="gold">$${t.get.cash}</b>` : 'nothing';
    if (t.to === you) {
      pop.innerHTML = `<div class="op-h">INCOMING DEAL</div><div><b style="color:${from.color}">${esc(from.name)}</b> offers ${gives}</div><div class="sub">in exchange for ${gets}</div><div class="row"><button class="btn green" id="opYes">ACCEPT</button><button class="btn red" id="opNo">DECLINE</button></div>`;
      $('#opYes').onclick = () => { SFX.coin(4); pop.hidden = true; act({ a: 'tradeReply', accept: true }); };
      $('#opNo').onclick = () => { SFX.click(); pop.hidden = true; act({ a: 'tradeReply', accept: false }); };
      SFX.alarm();
    } else {
      pop.innerHTML = `<div class="op-h">OFFER SENT</div><div>Waiting for <b style="color:${to.color}">${esc(to.name)}</b>…</div><div class="sub">You give ${gives} · you get ${gets}</div><div class="row"><button class="btn tiny" id="opCancel">WITHDRAW</button></div>`;
      $('#opCancel').onclick = () => act({ a: 'tradeCancel' });
    }
    pop.hidden = false;
  }

  // ───────────── event animations ─────────────
  function tween(ms, fn) {
    return new Promise(res => {
      const t0 = performance.now(), dur = Math.max(1, ms * speed());
      const step = () => { const p = Math.min(1, (performance.now() - t0) / dur); fn(p); if (p < 1) setTimeout(step, 15); else res(); };
      step();
    });
  }
  const ease = p => 1 - Math.pow(1 - p, 3);
  function banner(text, sub, color) {
    const b = $('#banner'); b.innerHTML = '';
    const d = el('div', 'bn', esc(text) + (sub ? `<small>${esc(sub)}</small>` : '')); d.style.setProperty('--bc', color || '#000');
    b.appendChild(d);
  }
  function killUnits(ids, big) {
    for (const id of ids) {
      const u = S.units[id]; if (!u) continue;
      Render.burst(u.hex, ['#ffb03a', '#ff5a2a', '#fff2a8', '#555'], 26, { speed: 1.4, size: 4 });
      Render.smoke(u.hex, 6, 'rgba(60,60,60,');
      Render.ring(u.hex, '#ffb03a', 60, 0.5);
      delete S.units[id];
    }
    if (ids.length) { SFX.boom(big ? 1.5 : 1); Render.shake(big ? 16 : 8); }
  }
  function flipTile(k, pid, i) {
    const t = S.map.tiles[k]; if (!t) return;
    t.owner = pid; if (t.struct && t.struct.type !== 'hq') t.struct.owner = pid;
    Render.recolor(); Render.pop(k);
    Render.burst(k, [pColor(pid), '#fff'], 10, { size: 2.5, up: 120, square: true });
    SFX.capture(i);
  }

  // glide the camera to action happening off-screen
  function follow(k) {
    if (!k || document.hidden) return;
    const [x, y] = Render.screenOf(k);
    if (x < innerWidth * 0.18 || x > innerWidth * 0.82 || y < innerHeight * 0.2 || y > innerHeight * 0.72) Render.focus(k);
  }
  async function playEvents(events, by) {
    Render.setState(S);
    const watch = by !== you;
    for (const ev of events) {
      switch (ev.e) {
        case 'turn': {
          const p = S.players.find(x => x.id === ev.pid);
          if (ev.pid === you) { SFX.yourTurn(); banner('YOUR TURN', 'Round ' + ev.round, pColor(you)); Render.focus(p.hq); }
          else { SFX.turn(); banner(p.name.toUpperCase(), 'Round ' + ev.round, p.color); }
          await sleep(ev.pid === you ? 900 : 500);
          break;
        }
        case 'income': Render.float(ev.hq, '+$' + ev.amount, '#ffc53d', 26); if (ev.pid === you) SFX.coin(Math.min(8, ev.amount / 2 | 0)); await sleep(250); break;
        case 'card': {
          const d = ev.id ? E.cardDef(ev.id) : null;
          if (ev.pid !== you) {
            if (ev.rarity === 'legendary') { toast(`★ ${pName(ev.pid)} drafted LEGENDARY ${d ? d.name : ''}!`, 'leg'); SFX.legendary(); Render.flash(0.25, '#ffb52e'); }
            else toast(`${pName(ev.pid)} drafted ${d && ev.kind === 'unit' ? d.name : 'a ' + E.RARITY[ev.rarity].name + ' card'}`);
          } else if (d) toast(`Added ${d.name} to your ${d.kind === 'unit' ? 'arsenal' : 'hand'}`);
          await sleep(200); break;
        }
        case 'deploy': {
          if (watch) follow(ev.hex);
          const u = { ...ev.unit };
          const [x, y] = Render.topOf(ev.hex);
          Render.extraUnits.push(u);
          Render.unitPos[u.id] = { x, y: y - 120 };
          await tween(260, p => { Render.unitPos[u.id] = { x, y: y - 120 * (1 - p * p) }; });
          delete Render.unitPos[u.id]; Render.extraUnits.splice(Render.extraUnits.indexOf(u), 1);
          S.units[u.id] = u;
          SFX.deploy(); Render.shake(3); Render.burst(ev.hex, ['#c9b78f', '#8f8068'], 14, { up: 30, g: 120, size: 3 }); Render.ring(ev.hex, pColor(ev.pid), 40, 0.4, 3);
          await sleep(120); break;
        }
        case 'build': {
          S.map.tiles[ev.hex].struct = { type: ev.struct, owner: ev.pid };
          Render.pop(ev.hex); SFX.build(); Render.burst(ev.hex, [pColor(ev.pid), '#fff', '#ffc53d'], 22, { square: true, up: 140 }); Render.float(ev.hex, E.STRUCTS[ev.struct].name.toUpperCase(), '#fff', 16);
          await sleep(350); break;
        }
        case 'move': if (watch) { follow(ev.path[ev.path.length - 1]); await sleep(150); } await animMove(ev); break;
        case 'combat': {
          follow(ev.to);
          if (ev.ranged) {
            SFX.shot(); Render.beam(ev.from, ev.to, '#ffcf5a', 0.45 * speed(), 70); await sleep(450);
            Render.burst(ev.to, ['#ffcf5a', '#fff'], 14, { speed: 1.2 }); SFX.boom(0.6);
          }
          await showCombat(ev);
          killUnits(ev.killed.concat(ev.pyrrhic), ev.killed.length > 2);
          await sleep(350); break;
        }
        case 'advance': {
          const path = [ev.from, ev.to];
          await animMove({ pid: ev.pid, units: ev.units, path, captures: [] }, true);
          flipTile(ev.to, ev.pid, 6); Render.ring(ev.to, pColor(ev.pid), 70, 0.6, 5);
          await sleep(200); break;
        }
        case 'eliminate': {
          const p = S.players.find(x => x.id === ev.pid);
          SFX.alarm(); Render.flash(0.5, '#ff2030'); Render.shake(22);
          banner(p.name.toUpperCase() + ' HAS FALLEN', ev.by ? 'conquered by ' + pName(ev.by) : '', '#b52b38');
          killUnits(ev.units.filter(id => S.units[id]), true);
          const hexes = ev.hexes.slice().sort((a, b) => E.dist(a, ev.hq) - E.dist(b, ev.hq));
          for (let i = 0; i < hexes.length; i++) { if (ev.by) flipTile(hexes[i], ev.by, i % 12); else { S.map.tiles[hexes[i]].owner = null; Render.recolor(); } await sleep(26); }
          await sleep(700);
          if (ev.pid === you) { SFX.lose(); toast('Your HQ fell. You can keep watching.', 'err'); }
          break;
        }
        case 'tactic': if (ev.target) { follow(ev.target); await sleep(200); } await animTactic(ev); break;
        case 'annex': {
          // encirclement: ring pulse, then the pocket flips hex by hex
          const mid = ev.hexes[Math.floor(ev.hexes.length / 2)];
          if (ev.pid !== you) follow(mid);
          Render.ring(mid, pColor(ev.pid), 140, 0.8, 6); SFX.rare();
          for (let i = 0; i < ev.hexes.length; i++) { flipTile(ev.hexes[i], ev.pid, i); await sleep(60); }
          Render.float(mid, 'ENCIRCLED +' + ev.hexes.length, pColor(ev.pid), 22);
          await sleep(300); break;
        }
        case 'drown': for (const id of ev.units) { const u = S.units[id]; if (u) { Render.burst(u.hex, ['#9fe8ff', '#ffffff', '#2a6688'], 22, { up: 160 }); Render.ring(u.hex, '#9fe8ff', 50, 0.6); delete S.units[id]; } } SFX.whoosh(); toast('🌊 ' + ev.units.length + ' unit(s) lost at sea'); break;
        case 'trade': {
          const f = pName(ev.from), t2 = ev.to ? pName(ev.to) : '';
          if (ev.status === 'accepted') { toast('🤝 ' + f + ' ⇄ ' + t2 + ': deal done!'); SFX.coin(6); }
          else if (ev.status === 'declined') { toast('✋ ' + t2 + ' declined ' + f + "'s offer"); if (ev.from === you) SFX.error(); }
          else if (ev.status === 'offered' && ev.to !== you && ev.from !== you) toast('🤝 ' + f + ' is negotiating with ' + t2);
          break;
        }
        case 'win': break;
        case 'reroll': SFX.card(); break;
      }
    }
  }

  async function animMove(ev, quick) {
    const ids = ev.units.filter(id => S.units[id]);
    const caps = new Set(ev.captures);
    let ci = 0;
    for (let i = 1; i < ev.path.length; i++) {
      const [ax, ay] = Render.topOf(ev.path[i - 1]), [bx, by] = Render.topOf(ev.path[i]);
      await tween(quick ? 160 : 130, p => {
        const e = ease(p);
        for (const id of ids) Render.unitPos[id] = { x: ax + (bx - ax) * e, y: ay + (by - ay) * e - Math.sin(p * Math.PI) * 8 };
      });
      SFX.step();
      if (caps.has(ev.path[i])) flipTile(ev.path[i], ev.pid, ci++);
    }
    const last = ev.path[ev.path.length - 1];
    for (const id of ids) { delete Render.unitPos[id]; if (S.units[id]) { S.units[id].hex = last; S.units[id].moved = true; } }
    if (ci >= 3) Render.float(last, ci + ' HEXES!', '#ffc53d', 20);
  }

  async function animTactic(ev) {
    const d = E.TACTICS[ev.id];
    const who = pName(ev.pid);
    toast(`${who} played ${d.name}`, d.rarity === 'legendary' ? 'leg' : '');
    const me = S.players.find(p => p.id === ev.pid);
    switch (ev.id) {
      case 'cache': case 'bonds': Render.float(me.hq, '+$' + ev.amount, '#ffc53d', 28); SFX.coin(6); break;
      case 'blitz': banner('BLITZ!', who + ' — all units +1 move', pColor(ev.pid)); SFX.zap(); Render.flash(0.2, pColor(ev.pid)); await sleep(600); break;
      case 'smoke': Render.smoke(ev.target, 22); SFX.whoosh(); break;
      case 'march': Render.ring(ev.target, pColor(ev.pid), 60, 0.6, 4); Render.float(ev.target, 'FORCED MARCH', '#fff', 16); SFX.select(); break;
      case 'conscript': for (const u of ev.units) { S.units[u.id] = u; } Render.ring(ev.target, pColor(ev.pid), 50, 0.5); SFX.deploy(); Render.shake(4); break;
      case 'airstrike': {
        SFX.whoosh(); await sleep(350);
        for (let i = 0; i < 3; i++) { const [x, y] = Render.topOf(ev.target); Render.burst([x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 20], ['#ffb03a', '#ff5a2a', '#fff2a8'], 18, { speed: 1.3 }); SFX.boom(0.7); Render.shake(9); await sleep(170); }
        Render.float(ev.target, ev.kills.length + ' DESTROYED', '#ff4f5e', 20);
        killUnits(ev.kills); await sleep(300); break;
      }
      case 'heli': {
        SFX.whoosh();
        const [ax, ay] = Render.topOf(ev.from), [bx, by] = Render.topOf(ev.target);
        const ids = ev.units.filter(id => S.units[id]);
        await tween(900, p => { const e = ease(p); for (const id of ids) Render.unitPos[id] = { x: ax + (bx - ax) * e, y: ay + (by - ay) * e - Math.sin(p * Math.PI) * 90, s: 1 + Math.sin(p * Math.PI) * 0.4 }; });
        for (const id of ids) { delete Render.unitPos[id]; S.units[id].hex = ev.target; }
        if (ev.captured) flipTile(ev.target, ev.pid, 4);
        SFX.deploy(); Render.burst(ev.target, ['#c9b78f'], 16, { up: 20 }); break;
      }
      case 'sabotage': Render.burst(ev.target, ['#ffb03a', '#ff5a2a', '#666'], 30, { speed: 1.5 }); SFX.boom(1); Render.shake(10); S.map.tiles[ev.target].struct = null; await sleep(300); break;
      case 'emp': for (let i = 0; i < 3; i++) { Render.ring(ev.target, '#7ff3ff', 110, 0.7, 5); await sleep(120); } SFX.zap(); Render.flash(0.15, '#7ff3ff'); break;
      case 'nuke': {
        banner('☢ NUCLEAR LAUNCH DETECTED', who, '#8a9a2c'); SFX.alarm(); await sleep(1300);
        Render.flash(1.2, '#ffffff'); SFX.boom(3); Render.shake(40);
        for (let i = 0; i < 4; i++) Render.ring(ev.target, ['#fff', '#ffdd55', '#ff7a2a', '#d9ff3b'][i], 160 + i * 40, 1 + i * 0.3, 8);
        Render.burst(ev.target, ['#fff', '#ffdd55', '#ff7a2a', '#ff3a1a', '#444'], 120, { speed: 3, size: 5, life: 1.4 });
        Render.smoke(ev.target, 40, 'rgba(120,110,90,');
        for (const id of ev.units) delete S.units[id];
        for (const k of ev.area) { const t = S.map.tiles[k]; if (t && E.isLandTile(t)) { t.owner = null; t.struct = null; t.contam = 4; } }
        Render.recolor(); await sleep(1100); break;
      }
      case 'mutiny': for (const id of ev.units) if (S.units[id]) S.units[id].owner = ev.pid; flipTile(ev.target, ev.pid, 5); Render.ring(ev.target, pColor(ev.pid), 70, 0.7, 5); SFX.rare(); break;
    }
    await sleep(250);
  }

  // ───────────── victory ─────────────
  function showVictory() {
    const v = $('#victory'); if (!v.hidden) return;
    const w = S.winner; const wp = S.players.find(p => p.id === w.pid);
    const mine = w.pid === you;
    mine ? SFX.win() : SFX.lose();
    const counts = {}; for (const k in S.map.tiles) { const o = S.map.tiles[k].owner; if (o) counts[o] = (counts[o] || 0) + 1; }
    const rows = S.players.slice().sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).map(p => `<tr><td style="color:${p.color}">■ ${esc(p.name)}</td><td>${E.FACTIONS[p.faction] ? E.FACTIONS[p.faction].name : ''}</td><td>${counts[p.id] || 0}</td><td>${p.stats.captured}</td><td>${p.stats.kills}</td><td>${p.stats.lost}</td></tr>`).join('');
    v.innerHTML = `<div class="vic panel" style="padding:30px 40px"><h1 style="color:${wp.color};text-shadow:0 6px 0 #000">${mine ? 'VICTORY' : myP() ? 'DEFEAT' : 'GAME OVER'}</h1><div class="why"><b style="color:${wp.color}">${esc(wp.name)}</b> ${esc(w.reason)}</div>
      <table class="stats"><tr><th>COMMANDER</th><th>FACTION</th><th>HEXES</th><th>CAPTURED</th><th>KILLS</th><th>LOST</th></tr>${rows}</table>
      <div class="row" style="justify-content:center"><button class="btn big" id="vicLook">VIEW BOARD</button>${lobby && lobby.hostId === you ? '<button class="btn big red" id="vicLobby">BACK TO LOBBY</button>' : '<span class="sub">Waiting for host…</span>'}</div></div>`;
    v.hidden = false;
    for (let i = 0; i < 6; i++) setTimeout(() => { const k = Object.keys(S.map.tiles).filter(k => S.map.tiles[k].owner === w.pid); const r = k[Math.floor(Math.random() * k.length)]; if (r) { Render.burst(r, [wp.color, '#fff', '#ffc53d'], 30, { speed: 1.6, up: 200, square: true }); } }, i * 300);
    $('#vicLook').onclick = () => { v.hidden = true; setTimeout(() => { if (S && S.phase === 'over') { v.hidden = false; } }, 8000); };
    const bl = $('#vicLobby'); if (bl) bl.onclick = () => send({ t: 'toLobby' });
  }

  // ───────────── misc UI ─────────────
  function toast(msg, cls = '') {
    const t = el('div', 'toast ' + cls, esc(msg)); $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 2700);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  }
  function addLog(html, cls = '') {
    const l = el('div', 'lg ' + cls, html); $('#log').appendChild(l);
    while ($('#log').children.length > 14) $('#log').firstChild.remove();
  }
  $('#chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) send({ t: 'chat', text: v }); e.target.value = ''; e.target.blur(); } });
  $('#muteBtn').onclick = () => { const m = SFX.toggle(); $('#muteBtn').textContent = m ? '✕' : '♪'; };
  $('#muteBtn').textContent = SFX.muted ? '✕' : '♪';

  function showRules() {
    const r = $('#rules');
    r.innerHTML = `<div class="panel rules-card"><h2>HOW TO PLAY SECTOR</h2>
    <p>Grab land, build an economy, crush your rivals. <b>Every hex you hold pays you</b>, so sitting still is losing.</p>
    <div class="grid2"><div>
    <h4>YOUR TURN</h4>
    <b>1. Supply Drop</b> — take one of 3 cards <i>plus half your income</i>, or skip them for the full income. Reroll the offer for cash.<br>
    <b>2. Act</b> — deploy (hotbar <kbd>1</kbd>–<kbd>0</kbd>), build (<kbd>Z</kbd>–<kbd>M</kbd>), move, attack, play tactics, trade — any order.<br>
    <b>3. End turn.</b>
    <h4>INCOME</h4>
    $3 base + $1 per 3 hexes + $2 per resource node ◆ + refineries & markets. Hexes <b>cut off</b> from your HQ / FOB / Port network (hatched) pay nothing — protect your supply lines.
    <h4>ENCIRCLEMENT</h4>
    Completely surround a pocket of land (≤10 hexes, no enemy troops or bases inside) and it's <b>annexed</b> automatically.
    <h4>MOVING</h4>
    Units move once per turn and <b>seize every unclaimed hex they pass through</b>. Highlands cost 2 move. Mountains and water block (drones fly, hover tanks glide). Max 5 units per hex. Freshly deployed units wait a turn.
    <h4>NAVY</h4>
    Build a <b>Port</b> on the coast to launch ships next to it (Ports are supply sources too). Land units board an <b>Ark</b> by moving onto it (3 per Ark), sail, then step off onto any coast. Sink an Ark and its cargo drowns.
    <h4>BLUEPRINT</h4>
    While others play, plan your turn: queue moves, deploys and builds. They execute the instant your turn starts. Attacks and tactics are live-only.
    </div><div>
    <h4>COMBAT — CHIPS × MULT</h4>
    Attacker: total <span style="color:var(--chips)">ATK chips</span> × (<span style="color:var(--mult)">d6 + mult bonuses</span>).<br>Defender: total <span style="color:var(--chips)">DEF chips</span> × (<span style="color:var(--mult)">d6 + terrain/structure mult</span>). Ties go to the defender.<br>
    The loser's stack is wiped out. A close fight (loser ≥ 60%) costs the winner its weakest unit.<br>
    <b>Bonuses:</b> Flanking (+1 mult per other friendly stack touching the target), Combined Arms (3+ unit types), Forest +1, Highlands +2, Bunker +2, FOB +1, HQ +2 & garrison.
    <b>You throw your own die</b> — drag & fling it in the tray.
    <h4>ARTILLERY & GUNSHIPS</h4> Ranged units fire instead of moving. Win = destroy 1 unit (2 if you double their score). Lose = nothing. Can't shoot through mountains.
    <h4>CARDS</h4> <b>Units</b> are permanent unlocks — deploy as many as you can afford. <b>Tactics</b> are single-use. <b style="color:var(--gold)">Legendaries are unique</b>: only one exists until it's spent or its owner falls.
    <h4>TRADING</h4> On your turn click <b>TRADE</b> under a rival's name: offer cash/cards for cash. They accept or decline.
    <h4>CONTROLS</h4> <kbd>1</kbd>–<kbd>0</kbd> deploy · <kbd>Z</kbd>–<kbd>M</kbd> build · <kbd>Click</kbd> select / order · <kbd>Right-click</kbd> cancel · <kbd>Drag</kbd> / <kbd>WASD</kbd> pan · <kbd>Wheel</kbd> zoom · <kbd>F</kbd> find HQ · <kbd>Space</kbd> end turn · <kbd>Enter</kbd> chat
    </div></div>
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn big red" id="rulesClose">GOT IT</button></div></div>`;
    r.hidden = false; $('#rulesClose').onclick = () => { r.hidden = true; SFX.click(); };
  }
  $('#rulesBtn').onclick = showRules; $('#rulesBtn2').onclick = showRules;

  window.SECTOR_DEBUG = { send, state: () => S, you: () => you, plan: () => plan, click: onHexClick };
  connect();
})();
