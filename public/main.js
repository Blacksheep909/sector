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
  let undoCount = 0;
  let enterArm = 0, lastAnimEnd = 0, localDeadline = 0, lastTick = 0, clockPaused = false, pausedLeft = 0;
  const plans = {}; // pass & play: every local seat keeps its own blueprint
  let qid = -1;      // placeholder ids for units deployed inside a blueprint
  const remap = (a, m) => a.a === 'move' ? { ...a, units: a.units.map(id => m[id] || id) } : a;
  let hoverK = null;
  let lastTurnKey = '';
  try { token = localStorage.getItem('sector.token'); } catch (e) {}

  Render.init($('#map'));

  // ───────────── networking ─────────────
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => { if (token || joinedOnce) send({ t: 'hello', token, name: $('#nameIn').value || savedName() }); };
    ws.onmessage = ev => onMsg(JSON.parse(ev.data));
    ws.onclose = () => { if (closedFor) return; toast('Connection lost — reconnecting…', 'err'); setTimeout(connect, 1500); };
  }
  let joinedOnce = false, leftGame = false;
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  function savedName() { try { return localStorage.getItem('sector.name') || ''; } catch (e) { return ''; } }

  function onMsg(m) {
    switch (m.t) {
      case 'welcome':
        you = m.you; realId = m.you; spectator = !!m.spectator;
        if (m.token) { token = m.token; try { localStorage.setItem('sector.token', token); } catch (e) {} }
        joinedOnce = true;
        break;
      case 'lobby': lobby = m.lobby; if (!S) renderLobby(); break;
      case 'state': if (leftGame) break; msgQ.push(m); pump(); break;
      case 'err':
        if (m.seq && pending.has(m.seq)) { pending.get(m.seq)(false); pending.delete(m.seq); }
        toast(m.msg, 'err'); SFX.error(); break;
      case 'serverClosed': serverClosed(m); break;
      case 'chat': addLog(`<b style="--c:${m.color}">${esc(m.from)}:</b> ${esc(m.text)}`, 'chat'); SFX.click(); break;
      case 'left': leftGame = true; token = null; try { localStorage.removeItem('sector.token'); } catch (e) {} you = null; realId = null; joinedOnce = false; backToMenu(); toast('You left the game'); break;
      case 'kicked': token = null; try { localStorage.removeItem('sector.token'); } catch (e) {} you = null; toast('You were removed from the lobby', 'err'); showJoin(); break;
    }
  }

  async function pump() {
    if (processing) return; processing = true;
    while (msgQ.length) {
      if (window.SECTOR_PAUSE) break; // dev/screenshot hook: freeze incoming events
      const m = msgQ.shift();
      if (!m.state) { S = null; you = realId || you; Render.setState(null); showMenu(); continue; }
      if (m.seat && m.seat !== you) seatChange(m.seat, m.state);
      // pass & play: hide the hand while no local player is acting, so the next person can't peek
      document.body.classList.toggle('pp-idle', !!(m.state && localSeats().length && !needsAction(m.state, you)));
      undoCount = m.undo || 0;
      localDeadline = m.timeLeft ? Date.now() + m.timeLeft : 0; clockPaused = !!m.paused; pausedLeft = m.timeLeft || 0;
      if (!S || S.seed !== m.state.seed) { enterGame(m.state); }
      else {
        animating = true; fastForward = msgQ.length > 3;
        try { await playEvents(m.events || [], m.by); } catch (e) { console.error(e); }
        animating = false; fastForward = false; lastAnimEnd = Date.now();
        if (m.paused && m.by && (m.by === you || m.mine)) send({ t: 'clockResume' });   // my fight finished playing: restart the turn clock
        applyState(m.state);
      }
      if (m.seq && (m.mine || m.by === you) && pending.has(m.seq)) { pending.get(m.seq)(true); pending.delete(m.seq); }
    }
    processing = false;
  }

  function act(action) {
    return new Promise(res => {
      const s = seq++; pending.set(s, res);
      send({ t: 'act', action, seq: s, as: you });
      setTimeout(() => { if (pending.has(s)) { pending.delete(s); res(false); } }, 15000);
    });
  }

  // ───────────── menu / lobby ─────────────
  // menu music: plays on the title/lobby screens only (browsers need a first click before audio can start)
  const menuMusic = () => { if (!$('#menu').hidden && !SFX.muted) SFX.music.start(); else SFX.music.stop(); };
  addEventListener('pointerdown', () => setTimeout(menuMusic, 50), { passive: true });
  addEventListener('keydown', () => setTimeout(menuMusic, 50));
  function showMenu() { setTimeout(menuMusic, 50); $('#menu').hidden = false; $('#hud').hidden = true; $('#victory').hidden = true; $('#supply').hidden = true; if (lobby) renderLobby(); }
  function showJoin() { $('#joinBox').hidden = !$('#joinNet').hidden; $('#lobbyBox').hidden = true; $('#lobbyBox').dataset.show = ''; }
  $('#nameIn').value = savedName();
  $('#joinBtn').onclick = () => {
    const name = $('#nameIn').value.trim() || 'Commander';
    try { localStorage.setItem('sector.name', name); } catch (e) {}
    joinedOnce = true; leftGame = false; SFX.select();
    send({ t: 'hello', token, name });
  };
  $('#nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinBtn').click(); });

  function renderLobby() {
    if (!lobby) return;
    const me = lobby.players.find(p => p.id === (realId || you));
    if (!me) { showJoin(); if (lobby.inGame) $('#joinBox .hint').textContent = 'A war is in progress — you can watch once it loads, or wait for the next game.'; return; }
    $('#joinBox').hidden = true; $('#lobbyBox').hidden = !$('#joinNet').hidden; $('#lobbyBox').dataset.show = '1';
    const host = lobby.hostId === you;
    { const sp = lobby.players.filter(p => p.spectator).length; $('#pCount').textContent = (lobby.players.length - sp) + '/8' + (sp ? ' · ' + sp + ' watching' : ''); }
    const pl = $('#playerList'); pl.innerHTML = '';
    for (const p of lobby.players) {
      const r = el('div', 'prow' + (p.connected ? '' : ' off'));
      const f = E.FACTIONS[p.faction];
      r.innerHTML = `<div class="sw" style="background:${p.color}"></div><div class="nm">${esc(p.name)}<div class="fx">${f ? f.name : ''}</div></div>` +
        (p.id === lobby.hostId ? '<span class="tag host">HOST</span>' : '') + (p.bot ? '<span class="tag">BOT</span>' : '') + (p.id === you ? '<span class="tag">YOU</span>' : '');
      if (p.spectator) { r.classList.add('spec'); const fx = r.querySelector('.fx'); if (fx) fx.textContent = '👁 Spectating'; }
      if (p.bot) {
        const dsel = el('select', 'diffsel ' + (p.diff || 'medium'));
        dsel.innerHTML = Object.keys(E.DIFFICULTY).map(d => `<option value="${d}"${p.diff === d ? ' selected' : ''}>${E.DIFFICULTY[d].name}</option>`).join('') + `<option value="random"${p.diff === 'random' ? ' selected' : ''}>🎲 Random</option>`;
        dsel.disabled = !host; dsel.onchange = () => send({ t: 'botCfg', id: p.id, diff: dsel.value });
        r.insertBefore(dsel, r.querySelector('.tag'));
      }
      if (p.local) {
        r.querySelector('.nm').innerHTML = `<input class="seat-name" value="${esc(p.name)}" maxlength="16"><div class="fx">${f ? f.name : ''} · this device</div>`;
        const inp = r.querySelector('.seat-name'); inp.onchange = () => send({ t: 'seatCfg', id: p.id, name: inp.value });
        if (p.controller === realId) {
          const fs = el('select', 'diffsel'); fs.innerHTML = Object.keys(E.FACTIONS).map(k => `<option value="${k}"${p.faction === k ? ' selected' : ''}>${E.FACTIONS[k].name}</option>`).join('');
          fs.onchange = () => send({ t: 'seatCfg', id: p.id, faction: fs.value }); r.insertBefore(fs, r.querySelector('.tag'));
        } else inp.disabled = true;
        r.insertBefore(el('span', 'tag', 'LOCAL'), r.querySelector('.tag'));
      }
      if (!p.bot && (p.id === realId || host || (p.local && p.controller === realId))) {
        const sb = el('button', 'specbtn' + (p.spectator ? ' on' : ''), p.spectator ? '▶' : '👁');
        sb.title = p.spectator ? 'Join the game as a commander' : 'Sit this game out and spectate';
        sb.onclick = () => { SFX.click(); send({ t: 'spectate', id: p.id, on: !p.spectator }); };
        r.appendChild(sb);
      }
      if ((host && p.id !== you) || (p.local && p.controller === realId)) { const x = el('button', 'x', '✕'); x.onclick = () => send({ t: 'kick', id: p.id }); r.appendChild(x); }
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
    for (const [id, k] of [['#setMode', 'mode'], ['#setType', 'mapType'], ['#setSize', 'mapSize'], ['#setSpawns', 'spawns'], ['#setFog', 'fog'], ['#setEvents', 'events'], ['#setTimer', 'timer'], ['#setRounds', 'maxRounds'], ['#setSeed', 'seed']]) {
      const e = $(id); if (document.activeElement !== e) e.value = st[k] ?? ''; e.disabled = !host;
    }
    $('#startBtn').hidden = !host; $('#waitHost').hidden = host;
  }
  for (const [id, k] of [['#setMode', 'mode'], ['#setType', 'mapType'], ['#setSize', 'mapSize'], ['#setSpawns', 'spawns'], ['#setFog', 'fog'], ['#setEvents', 'events'], ['#setTimer', 'timer'], ['#setRounds', 'maxRounds'], ['#setSeed', 'seed']])
    $(id).addEventListener('change', e => send({ t: 'settings', settings: { [k]: e.target.value } }));
  $('#addBot').onclick = () => { SFX.click(); send({ t: 'addBot' }); };
  $('#addLocal').onclick = () => { SFX.click(); send({ t: 'addLocal' }); };
  $('#startBtn').onclick = () => { SFX.select(); send({ t: 'start' }); };

  // ───────────── pass & play ─────────────
  let realId = null, passTo = null, unlocked = null;
  const localSeats = () => lobby ? lobby.players.filter(p => p.local && p.controller === realId).map(p => p.id) : [];
  const passReady = () => !passTo;
  // does this seat have something to do in this state?
  function needsAction(st, seat) {
    if (!st) return false;
    if (st.phase === 'spawn') return !!st.spawn && st.spawn.order[st.spawn.i] === seat;
    if (st.phase === 'draft') return !!st.draft && !st.draft.picked[seat];
    if (st.phase !== 'play') return false;
    const cur = st.players[st.turn.idx];
    return (cur && cur.id === seat) || (!!st.trade && st.trade.to === seat);
  }
  function seatChange(seat, st) {
    const prev = you; you = seat;
    if (prev) plans[prev] = plan; plan = plans[seat] || []; sel = null; mode = null;
    if (!localSeats().length || !prev) return;
    if (unlocked === null) unlocked = prev;
    // only cover the screen when a *different* local player now has to act
    if (!needsAction(st, seat) || seat === unlocked) return;
    passTo = seat; sel = null; mode = null;
    const p = (S && S.players.find(x => x.id === seat)) || (lobby && lobby.players.find(x => x.id === seat));
    const cover = $('#passCover');
    cover.innerHTML = `<div class="pass-card" style="--pc:${p ? p.color : '#fff'}"><div class="pass-sub">PASS THE DEVICE TO</div><div class="pass-name">${p ? esc(p.name) : 'next player'}</div><button class="btn big" id="passGo">I'M ${p ? esc(p.name.toUpperCase()) : 'READY'} — GO</button><div class="sub">Everyone else: look away from the screen.</div></div>`;
    cover.hidden = false; SFX.turn();
    $('#passGo').onclick = () => { cover.hidden = true; passTo = null; unlocked = seat; SFX.yourTurn(); if (S) applyState(S, true); };
  }

  // ───────────── game entry / state ─────────────
  function enterGame(state) {
    S = state; plan = []; for (const k in plans) delete plans[k]; sel = null; mode = null; lastTurnKey = '';
    SFX.music.stop();
    if (state.settings && state.settings.mapType === 'random' && (state.phase === 'draft' || state.phase === 'spawn')) showMapReel(state);
    $('#menu').hidden = true; $('#hud').hidden = false; $('#victory').hidden = true;
    Render.setState(state);
    Render.fitMap();
    const me = myP();
    if (me && me.hq) setTimeout(() => Render.focus(me.hq, Math.max(Render.cam.z, 1.05)), 300);
    $('#log').innerHTML = ''; for (const l of state.log.slice(-6)) addLog(esc(l));
    applyState(state, true);
  }

  const myP = () => S && S.players.find(p => p.id === you);
  const curP = () => S && S.players[S.turn.idx];
  const isMyTurn = () => !!S && S.phase === 'play' && curP() && curP().id === you;
  const planning = () => !!S && S.phase === 'play' && !isMyTurn() && myP() && myP().alive;
  const draftPhase = () => !!S && S.phase === 'draft';
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
    renderSpawnPick();
    if (S.phase === 'draft') Cards.showDraft(S, you, (idx, replace) => act({ a: 'draftPick', idx, replace })); else Cards.hideDraft();
    const me2 = myP();
    if (isMyTurn() && S.turn.stage === 'choose' && me2 && !executing && !(plan.length && planAuto) && passReady())
      Cards.openSupply({ me: me2, offer: S.turn.offer, income: S.turn.income, round: S.turn.round, rerollCost: 2 + S.turn.rerolls, key: S.turn.round + ':' + S.turn.idx + ':' + S.turn.rerolls,
        onPick: pickFromSupply, onIncome: async () => { const ok = await act({ a: 'choose', pick: 'income' }); if (ok && plan.length) runPlan(); return ok; }, onReroll: () => act({ a: 'reroll' }) });
    else Cards.closeSupply();
    if (isMyTurn() && S.turn.stage === 'crate' && S.turn.crate && !S.turn.crate.hidden && me2 && passReady())
      Cards.openCrate({ crate: S.turn.crate, me: me2, serial: S.turn.round + ':' + S.turn.idx + ':' + me2.stats.crates, onPick: pickFromCrate, onScrap: scrapCrate });
    else Cards.closeCrate();
    if (S.phase === 'over') showVictory();
  }

  // pick-your-HQ phase: highlight the legal hexes and wait for a click
  const mySpawnPick = () => !!S && S.phase === 'spawn' && S.spawn && S.spawn.order[S.spawn.i] === you && passReady();
  function renderSpawnPick() {
    let b = $('#spawnBar');
    if (!S || S.phase !== 'spawn' || !S.spawn) { if (b) b.remove(); return; }
    if (!b) { b = el('div', '', ''); b.id = 'spawnBar'; document.body.appendChild(b); }
    const cur = S.spawn.order[S.spawn.i], left = S.spawn.order.length - S.spawn.i;
    b.style.setProperty('--pc', pColor(cur));
    b.innerHTML = mySpawnPick()
      ? `<b>CHOOSE YOUR HQ</b><span>Click a glowing hex. HQs must be ${S.spawn.minDist}+ hexes apart. Look for resources ◆ and room to grow.</span>`
      : `<b>${esc(pName(cur)).toUpperCase()} IS CHOOSING</b><span>${left} HQ${left > 1 ? 's' : ''} left to place</span>`;
  }
  async function onMyTurn() {
    if (!plan.length || executing) return;
    if (S.turn.stage === 'choose' && planAuto) {
      executing = true; Cards.closeSupply();
      const ok = await act({ a: 'choose', pick: 'income' });
      executing = false;
      if (ok) await runPlan(); else refreshAll();
    } else if (S.turn.stage === 'act') await runPlan();
  }
  async function runPlan() {
    if (executing || !plan.length || !isMyTurn()) return;
    executing = true; sel = null; mode = null;
    const seat = you, items = plan.slice(); plan = [];
    toast('▶ Executing blueprint (' + items.length + ' order' + (items.length > 1 ? 's' : '') + ')');
    const idMap = {}; let done = 0;
    for (const it of items) {
      if (you !== seat || !isMyTurn() || S.turn.stage !== 'act') break;
      const a = remap(it.a, idMap);
      if (a.a === 'move' && a.units.some(id => !S.units[id] || S.units[id].hex !== a.from)) { toast('Blueprint order skipped: ' + describe(a) + ' (units not there)', 'err'); continue; }
      const before = new Set(Object.keys(S.units));
      const ok = await act(a);
      if (!ok) { toast('Blueprint order skipped: ' + describe(a), 'err'); continue; }
      done++;
      if (a.a === 'deploy' && it.qid) { const nu = Object.values(S.units).find(u => !before.has(String(u.id)) && u.owner === seat && u.type === a.unit); if (nu) idMap[it.qid] = nu.id; }
    }
    executing = false;
    if (done) toast('✔ Blueprint done: ' + done + '/' + items.length + ' orders', 'good');
    recomputePlan(); refreshAll();
  }

  // ───────────── planning (blueprint) ─────────────
  function recomputePlan() {
    if (!planning()) { planState = null; return; }
    let sim = E.simulateTurnStart(S, you, planAuto);
    const idMap = {};
    for (const it of plan) {
      const a = remap(it.a, idMap);
      if (a.a === 'move') { const r = E.reachable(sim, you, a.units, a.from); it.path = r[a.to] ? E.pathTo(r, a.to) : null; }
      const trial = JSON.parse(JSON.stringify(sim));
      const before = trial.nextId;
      const r = E.applyAction(trial, you, a, () => 0.5);
      it.ok = r.ok; it.err = r.err;
      if (r.ok) { if (a.a === 'deploy' && it.qid) { const nu = Object.values(trial.units).find(u => u.id >= before && u.owner === you && u.type === a.unit); if (nu) idMap[it.qid] = nu.id; } sim = trial; }
    }
    // show blueprint-deployed units under their placeholder ids so they can be selected and queued
    for (const q in idMap) { const u = sim.units[idMap[q]]; if (u) { delete sim.units[idMap[q]]; u.id = +q; sim.units[q] = u; } }
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
      if (a.a === 'fire' || a.a === 'tactic' || a.a === 'end' || a.a === 'assault') { toast('Attacks & tactics go live on your turn — the blueprint queues moves, deploys and builds.', 'err'); SFX.error(); return false; }
      if (a.a === 'move') { const r = E.reachable(planState, you, a.units, a.from)[a.to]; if (r && r.kind === 'attack') { toast('Attacks resolve live on your turn — queue the approach instead.', 'err'); SFX.error(); return false; } }
      const trial = JSON.parse(JSON.stringify(planState));
      const r = E.applyAction(trial, you, a, () => 0.5);
      if (!r.ok) { toast(r.err, 'err'); SFX.error(); return false; }
      if (plan.length >= 30) { toast('Blueprint is full (30 orders)', 'err'); SFX.error(); return false; }
      const it = { a };
      if (a.a === 'deploy') it.qid = qid--;
      plan.push(it); SFX.select();
      recomputePlan(); refreshAll();
      return true;
    }
    if (!isMyTurn()) return false;
    SFX.click();
    return act(a);
  }

  // ───────────── selection & overlays ─────────────
  function selectHex(k, add) {
    const ds = dispState();
    if (!k) { sel = null; refreshAll(); return; }
    const units = Object.values(ds.units).filter(u => u.hex === k && u.owner === you && E.canAct(ds, u));
    if (add && sel && sel.units.size && units.length && k !== sel.hex) {
      sel.extra = sel.extra || [];
      const i = sel.extra.findIndex(g => g.hex === k);
      if (i >= 0) sel.extra.splice(i, 1); else sel.extra.push({ hex: k, units: new Set(units.map(u => u.id)) });
      SFX.select(); toast(sel.extra.length ? `${sel.extra.length + 1} stacks selected — click a red target for a pincer assault` : 'Back to one stack'); refreshAll(); return;
    }
    sel = { hex: k, units: new Set(units.map(u => u.id)), extra: [] };
    SFX.select();
    refreshAll();
  }
  // every selected group that can attack hex k, with its staging hex
  function assaultGroups(ds, k, idx) {
    if (!sel) return [];
    const out = [];
    for (const g of [{ hex: sel.hex, units: sel.units }, ...(sel.extra || [])]) {
      const ids = [...g.units].filter(id => ds.units[id]);
      if (!ids.length) continue;
      const r = E.reachable(ds, you, ids, g.hex, idx);
      if (r[k] && r[k].kind === 'attack') out.push({ from: g.hex, units: ids, stage: E.pathTo(r, k).slice(-2)[0] });
    }
    return out;
  }
  function updateOverlays() {
    const ov = Render.ov, ds = dispState();
    ov.me = you; ov.myTurn = isMyTurn() || planning();
    ov.reach = null; ov.probs = null; ov.fire = null; ov.spawn = null; ov.targets = null; ov.path = null;
    ov.selected = sel ? sel.hex : null;
    ov.selectedExtra = sel && sel.extra ? sel.extra.map(g => g.hex) : [];
    ov.unsupplied = null;
    if (ds && ds.phase === 'spawn' && mySpawnPick()) ov.spawn = new Set(E.spawnChoices(ds));
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
      // extra selected stacks add their attack targets (pincers)
      for (const g of sel.extra || []) {
        const r2 = E.reachable(ds, you, [...g.units], g.hex, idx);
        for (const k in r2) if (r2[k].kind === 'attack' && (!ov.reach[k] || ov.reach[k].kind !== 'attack')) ov.reach[k] = { ...r2[k], extra: true };
      }
      for (const k in ov.reach) if (ov.reach[k].kind === 'attack') {
        const gs = assaultGroups(ds, k, idx);
        if (gs.length) ov.probs[k] = E.combatCalc(ds, you, gs.flatMap(g => g.units.map(id => ds.units[id])), gs.map(g => g.stage), k, false, idx).winProb;
      }
      const fire = E.rangedTargets(ds, you, ids, sel.hex, idx);
      if (fire.length) { ov.fire = new Set(fire); for (const k of fire) ov.probs[k] = E.combatCalc(ds, you, units, sel.hex, k, true, idx).winProb; }
    }
    // blueprint arrows & ghosts
    ov.planArrows = []; ov.planGhost = null;
    if (planning()) {
      const col = pColor(you);
      for (const it of plan) if (it.a.a === 'move' && it.ok) ov.planArrows.push({ path: it.path || [it.a.from, it.a.to], color: col });
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
  let down = null, shiftDown = false;
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
      else if (down.b === 0) { shiftDown = e.shiftKey; onHexClick(Render.hexAt(e.clientX, e.clientY)); }
    }
    down = null;
  });
  cvs.addEventListener('pointerleave', () => { hideTip(); });
  cvs.addEventListener('contextmenu', e => e.preventDefault());
  cvs.addEventListener('wheel', e => { e.preventDefault(); Render.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  const keys = new Set();
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') { if (e.key === 'Escape') e.target.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); return; }
    keys.add(e.key.toLowerCase());
    if (e.key === 'Escape') {
      if (!$('#hostPanel').hidden) closeHost();
      else if (!$('#escMenu').hidden) closeEsc();
      else if (!$('#index').hidden) $('#index').hidden = true;
      else if (!$('#rules').hidden) $('#rules').hidden = true;
      else if (mode || sel) cancel();
      else if (S) openEsc();
    }
    if (e.key === 'Enter' && S) {
      // Enter ends your turn (when nothing is open); otherwise it opens chat. T always opens chat.
      const overlay = ['#supply', '#crate', '#draft', '#combat', '#escMenu', '#trade', '#modal', '#index', '#rules', '#passCover', '#hostPanel', '#victory', '#allyPop', '#offerPop'].some(id => $(id) && !$(id).hidden);
      const eb = $('#endBtn');
      // safe: never during or just after a fight/animation, and it takes two presses
      const busy = animating || executing || Date.now() - lastAnimEnd < 1500;
      if (isMyTurn() && !overlay && !busy && !eb.hidden && !eb.disabled && !e.repeat) {
        if (Date.now() - enterArm < 2000) { enterArm = 0; eb.click(); }
        else { enterArm = Date.now(); toast('Press Enter again to end your turn'); SFX.click(); eb.classList.remove('arm'); void eb.offsetWidth; eb.classList.add('arm'); }
      } else if (!overlay && !isMyTurn()) $('#chatIn').focus();
      e.preventDefault();
    }
    if (e.key.toLowerCase() === 't' && S) { $('#chatIn').focus(); e.preventDefault(); }
    if (e.key.toLowerCase() === 'f' && myP()) Render.focus(myP().hq);
    if (e.key === ' ') e.preventDefault(); // space is for flipping cards / throwing dice only — never ends the turn
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
  // ───────────── esc menu ─────────────
  function openEsc() {
    if (!S) return;
    const m = $('#escMenu'); m.hidden = false; SFX.select();
    const host = lobby && lobby.hostId === realId;
    $('#escEnd').hidden = !host;
    $('#escInfo').textContent = (S.phase === 'over' ? 'Game over' : 'Round ' + S.turn.round) + ' · ' + (lobby ? lobby.players.length : S.players.length) + ' commanders' + (host ? ' · you are the host' : '');
    $('#escSound').textContent = 'SOUND: ' + (SFX.muted ? 'OFF' : 'ON');
    $('#escLeave').textContent = spectator || !myP() ? 'BACK TO MENU' : 'LEAVE GAME';
  }
  function closeEsc() { $('#escMenu').hidden = true; }
  // tear down every in-game overlay and return to the title screen
  function backToMenu() {
    S = null; Render.setState(null); msgQ = []; plan = []; sel = null; mode = null; passTo = null; unlocked = null; lastTurnKey = '';
    for (const k in plans) delete plans[k];
    Cards.hideDraft(); Cards.closeSupply(); Cards.closeCrate();
    for (const id of ['#escMenu', '#trade', '#modal', '#offerPop', '#victory', '#passCover', '#index', '#rules']) { const e = $(id); if (e) e.hidden = true; }
    for (const id of ['#siegeWarn', '#spawnBar']) { const e = $(id); if (e) e.remove(); }
    const z = $('#cardZoom'); if (z) z.hidden = true;
    document.body.classList.remove('pp-idle');
    showMenu(); showJoin();
  }

  // ───────────── host panel: only answers on the computer running the server ─────────────
  let hostInfo = null, hostTimer = null, closedFor = null, stopArm = 0;
  const hostFetch = (p, post) => fetch(p, post ? { method: 'POST', headers: { 'X-Sector-Host': '1' } } : { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  async function pollHost() {
    hostInfo = await hostFetch('/host');
    $('#hostBtn').hidden = !hostInfo; $('#escServer').hidden = !hostInfo;
    $('#hostDot').hidden = !(hostInfo && hostInfo.update.available);
    if (!$('#hostPanel').hidden) renderHost();
  }
  const fmtUp = ms => { const m = Math.floor(ms / 60000); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; };
  function renderHost() {
    const h = hostInfo, card = $('#hostCard');
    if (!h) { card.innerHTML = '<h2>SERVER</h2><div class="sub">Not reachable.</div><button class="btn big" id="hpClose">CLOSE</button>'; $('#hpClose').onclick = closeHost; return; }
    const u = h.update;
    let up;
    if (u.state === 'downloading') up = `<div class="hp-upd busy">Downloading v${esc(u.latest)}… <b>${u.pct}%</b><div class="bar"><i style="width:${u.pct}%"></i></div></div>`;
    else if (u.state === 'restarting') up = `<div class="hp-upd busy">Restarting into v${esc(u.latest)}…</div>`;
    else if (u.available) up = `<div class="hp-upd new"><b>v${esc(u.latest)} is out!</b> You have v${esc(h.version)}.${u.err ? `<div class="err">${esc(u.err)}</div>` : ''}
      ${u.canApply ? '<button class="btn green" id="hpUpdate">UPDATE &amp; RESTART</button>' : `<a class="btn green" href="${esc(u.page)}" target="_blank">DOWNLOAD</a>`}</div>`;
    else up = `<div class="hp-upd">${u.latest ? 'Up to date (latest is v' + esc(u.latest) + ')' : u.checked ? "Couldn't reach GitHub to check for updates" : 'Checking for updates…'} <button class="btn ghost" id="hpCheck">CHECK</button></div>`;
    card.innerHTML = `<h2>SERVER <span class="ver">v${esc(h.version)}</span></h2>
      <div class="sub">Running for ${fmtUp(h.uptime)} · ${h.inGame ? (h.phase === 'play' ? 'war in progress, round ' + h.round : h.phase === 'over' ? 'game over' : 'starting up') : 'in the lobby'}</div>
      <h3>INVITE FRIENDS ON YOUR WI-FI</h3>
      ${h.lan.length ? h.lan.map(a => `<div class="hp-addr"><code>${esc(a)}</code><button class="btn" data-copy="${esc(a)}">COPY</button></div>`).join('') : '<div class="sub">No network found — connect to Wi-Fi to play with others.</div>'}
      <div class="hint">They open that address in a browser, or use JOIN A GAME → Scan network.</div>
      <h3>CONNECTED (${h.clients.length})${h.bots ? ' · ' + h.bots + ' bot' + (h.bots > 1 ? 's' : '') : ''}</h3>
      <div class="hp-list">${h.clients.map(c => `<div class="hp-row"><span>${esc(c.name)}${c.seats > 1 ? ` <small>+${c.seats - 1} local</small>` : ''}</span><span class="tags">${c.host ? '<i class="gold">HOST</i>' : ''}${c.here ? '<i>THIS PC</i>' : `<i>${esc(c.addr)}</i>`}</span></div>`).join('') || '<div class="sub">Nobody yet.</div>'}</div>
      <h3>UPDATES</h3>${up}
      <div class="row hp-btns"><button class="btn big" id="hpClose">CLOSE</button><button class="btn big red" id="hpStop">${stopArm > Date.now() ? 'CLICK AGAIN TO STOP' : 'STOP SERVER'}</button></div>
      <div class="hint">You can also manage it from the SECTOR server window (press Q there to stop).</div>`;
    card.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'COPIED'; SFX.coin(1); setTimeout(() => b.textContent = 'COPY', 1200); });
    $('#hpClose').onclick = closeHost;
    $('#hpStop').onclick = async () => {
      if (stopArm < Date.now()) { stopArm = Date.now() + 3000; SFX.error(); renderHost(); setTimeout(() => !$('#hostPanel').hidden && renderHost(), 3100); return; }
      await hostFetch('/host/stop', true);
    };
    if ($('#hpUpdate')) $('#hpUpdate').onclick = async () => { SFX.select(); await hostFetch('/host/update', true); pollHost(); };
    if ($('#hpCheck')) $('#hpCheck').onclick = async () => { SFX.click(); await hostFetch('/host/check', true); setTimeout(pollHost, 1500); };
  }
  function openHost() { $('#hostPanel').hidden = false; SFX.select(); renderHost(); clearInterval(hostTimer); hostTimer = setInterval(pollHost, 1500); pollHost(); }
  function closeHost() { $('#hostPanel').hidden = true; clearInterval(hostTimer); hostTimer = setInterval(pollHost, 20000); SFX.click(); }
  $('#hostBtn').onclick = openHost;
  $('#escServer').onclick = () => { closeEsc(); openHost(); };
  $('#hostPanel').addEventListener('click', e => { if (e.target.id === 'hostPanel') closeHost(); });
  pollHost(); hostTimer = setInterval(pollHost, 20000);
  // the server is going away: say why, and after an update wait for the new version and reload
  function serverClosed(m) {
    closedFor = m;
    $('#hostPanel').hidden = true;
    const c = $('#closedCover'); c.hidden = false;
    $('#closedCard').innerHTML = m.restart
      ? `<h2>UPDATING</h2><div class="sub">${esc(m.reason)}</div><div class="spinner"></div><div class="hint">The game reloads by itself when the new version is up.</div>`
      : `<h2>SERVER STOPPED</h2><div class="sub">${esc(m.reason)}</div><div class="hint">You can close this window.</div>`;
    if (m.restart) {
      const t0 = Date.now();
      const tick = async () => { const i = await fetch('/info', { cache: 'no-store' }).then(r => r.json()).catch(() => null); if (i && Date.now() - t0 > 2500) location.reload(); else if (Date.now() - t0 < 120000) setTimeout(tick, 1000); else $('#closedCard .hint').textContent = 'The update is taking a while — start Sector.exe again.'; };
      setTimeout(tick, 2000);
    }
  }
  $('#menuBtn').onclick = openEsc;
  $('#escResume').onclick = () => { SFX.click(); closeEsc(); };
  $('#escRules').onclick = () => { closeEsc(); showRules(); };
  $('#escIndex').onclick = () => { closeEsc(); Cards.showIndex(); };
  $('#escSound').onclick = () => { const m = SFX.toggle(); setTimeout(menuMusic, 50); $('#escSound').textContent = 'SOUND: ' + (m ? 'OFF' : 'ON'); $('#muteBtn').textContent = m ? '✕' : '♪'; };
  $('#escLeave').onclick = () => {
    if ($('#escLeave').dataset.armed !== '1' && myP() && S.phase === 'play') { $('#escLeave').dataset.armed = '1'; $('#escLeave').textContent = 'CLICK AGAIN TO LEAVE'; setTimeout(() => { $('#escLeave').dataset.armed = ''; if (!$('#escMenu').hidden) openEsc(); }, 2500); return; }
    $('#escLeave').dataset.armed = '';
    SFX.click(); send({ t: 'leave' });
    if (!myP()) backToMenu();
  };
  $('#escEnd').onclick = () => {
    if ($('#escEnd').dataset.armed !== '1') { $('#escEnd').dataset.armed = '1'; $('#escEnd').textContent = 'CLICK AGAIN — ENDS IT FOR ALL'; setTimeout(() => { $('#escEnd').dataset.armed = ''; $('#escEnd').textContent = 'END GAME FOR EVERYONE'; }, 2500); return; }
    $('#escEnd').dataset.armed = ''; closeEsc(); send({ t: 'toLobby' });
  };

  // ───────────── host / join panel ─────────────
  const RECENT_KEY = 'sector.recent';
  const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; } };
  function remember(url) { try { const r = recent().filter(u => u !== url); r.unshift(url); localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 6))); } catch (e) {} }
  function goTo(url) { if (!/^https?:\/\//.test(url)) url = 'http://' + url; if (!/:\d+/.test(url.replace(/^https?:\/\//, ''))) url = url.replace(/\/?$/, ':3000'); remember(url.replace(/\/$/, '')); location.href = url; }
  function renderRecent() {
    const r = recent().filter(u => u !== location.origin);
    $('#recentList').innerHTML = r.length ? '<div class="hint">Recent</div>' + r.map(u => `<div class="srv"><div><b>${esc(u.replace(/^https?:\/\//, ''))}</b></div><button class="btn tiny" data-u="${esc(u)}">JOIN</button></div>`).join('') : '';
    $('#recentList').querySelectorAll('[data-u]').forEach(b => b.onclick = () => goTo(b.dataset.u));
  }
  document.querySelectorAll('#netTabs [data-tab]').forEach(b => b.onclick = () => {
    SFX.click();
    document.querySelectorAll('#netTabs [data-tab]').forEach(x => x.classList.toggle('on', x === b));
    const join = b.dataset.tab === 'join';
    $('#joinNet').hidden = !join; $('#joinBox').hidden = join || !!(lobby && lobby.players.some(p => p.id === realId)); $('#lobbyBox').hidden = join || $('#lobbyBox').dataset.show !== '1';
    if (join) renderRecent();
  });
  $('#joinGo').onclick = () => { const v = $('#joinAddr').value.trim(); if (v) goTo(v); };
  $('#joinAddr').addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinGo').click(); });
  $('#scanBtn').onclick = async () => {
    const btn = $('#scanBtn'), list = $('#scanList');
    btn.disabled = true; btn.textContent = 'SCANNING…'; list.innerHTML = '<div class="hint">Looking for games…</div>';
    let lan = [];
    try { lan = (await (await fetch('/info')).json()).lan || []; } catch (e) {}
    const subnets = [...new Set(lan.filter(a => /^(10|172|192)\./.test(a)).map(a => a.split(':')[0].replace(/^https?:\/\//, '').split('.').slice(0, 3).join('.')))];
    const ports = [...new Set([3000, 3001, +location.port || 80])];
    const found = [];
    const probe = async (ip, port) => {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 1200);
      try { const r = await fetch(`http://${ip}:${port}/info`, { signal: ctl.signal }); const j = await r.json(); if (j.game === 'sector' && !found.some(f => f.id && f.id === j.id)) { found.push({ url: `http://${ip}:${port}`, ...j }); show(); } } catch (e) {} finally { clearTimeout(tm); }
    };
    const show = () => {
      list.innerHTML = found.map(s => `<div class="srv${s.url === location.origin ? ' me' : ''}"><div><b>${s.host ? esc(s.host) + "'s game" : 'Open lobby'}</b> <span class="sub">· ${s.humans} player${s.humans === 1 ? '' : 's'} · ${s.inGame ? 'in progress (round ' + s.round + ')' : 'in lobby'}</span><div class="sub">${esc(s.url.replace('http://', ''))}${s.url === location.origin ? ' · this server' : ''}</div></div><button class="btn tiny ${s.inGame ? '' : 'green'}" data-u="${s.url}">${s.inGame ? 'WATCH' : 'JOIN'}</button></div>`).join('') || '<div class="hint">Looking for games…</div>';
      list.querySelectorAll('[data-u]').forEach(b => b.onclick = () => goTo(b.dataset.u));
    };
    // known addresses first (instant), then sweep each subnet with a throttled pool so dead IPs don't starve live ones
    const known = lan.filter(a => /^(10|172|192)\./.test(a));
    await Promise.all(known.flatMap(ip => ports.map(port => probe(ip, port))));
    const jobs = [];
    for (const sn of subnets) for (let i = 1; i < 255; i++) for (const port of ports) { const ip = sn + '.' + i; if (!known.includes(ip)) jobs.push([ip, port]); }
    let next = 0, done = 0;
    await Promise.all(Array.from({ length: 32 }, async () => { while (next < jobs.length) { const [ip, port] = jobs[next++]; await probe(ip, port); done++; if (done % 40 === 0) btn.textContent = 'SCANNING… ' + Math.round(done / jobs.length * 100) + '%'; } }));
    btn.disabled = false; btn.textContent = 'SCAN AGAIN';
    if (!found.length) list.innerHTML = '<div class="hint">No games found. Make sure the host has SECTOR running and you are on the same Wi-Fi — or type their address below.</div>';
  };

  async function onHexClick(k) {
    if (S && S.phase === 'spawn') {
      if (!k || !mySpawnPick()) return;
      if (!E.spawnChoices(S).includes(k)) { toast('Pick a glowing hex', 'err'); SFX.error(); return; }
      SFX.select(); await act({ a: 'spawnPick', hex: k }); return;
    }
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
      if (mode && me && (!E.buildHexes(dispState(), you, st).some(k2 => me.cash >= E.buildCost(dispState(), me, st, k2)))) mode = null;
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
      if (r && r.kind === 'attack' && sel.extra && sel.extra.length) {
        const gs = assaultGroups(ds, k, E.buildIndex(ds));
        if (gs.length > 1) { const a = { a: 'assault', to: k, groups: gs.map(g => ({ from: g.from, units: g.units })) }; sel = null; refreshAll(); await doAction(a); return; }
        if (gs.length === 1) { const a = { a: 'move', from: gs[0].from, units: gs[0].units, to: k }; sel = null; refreshAll(); await doAction(a); return; }
      }
      if (r && r.kind !== 'start' && r.kind !== 'pass' && !r.extra) {
        const a = { a: 'move', from: sel.hex, units: [...sel.units], to: k };
        sel = null; refreshAll();
        await doAction(a); return;
      }
    }
    if (!k || (sel && sel.hex === k && !shiftDown)) { sel = null; refreshAll(); return; }
    selectHex(k, shiftDown);
  }

  // ───────────── HUD rendering ─────────────
  function refreshAll() {
    if (!S) return;
    Render.setState(dispState());
    updateOverlays();
    renderTop(); renderCash(); renderSiege(); renderUndo(); renderWeather(); renderAlly(); renderPlan(); renderHexPanel(); renderHand(); renderEnd(); renderModeHint(); renderOffer();
  }

  function renderTop() {
    const box = $('#players'); box.innerHTML = '';
    const counts = {}; for (const k in S.map.tiles) { const o = S.map.tiles[k].owner; if (o) counts[o] = (counts[o] || 0) + 1; }
    for (const p of S.players) {
      const f = E.FACTIONS[p.faction];
      const c = el('div', 'pchip' + (curP().id === p.id && S.phase === 'play' ? ' cur' : '') + (p.alive ? '' : ' dead') + (p.id === you ? ' me' : ''));
      c.style.setProperty('--pc', p.color);
      const extra = S.map.beacon ? ` · ◆${p.koth}/3` : '';
      if (!p.alive) c.style.setProperty('--pc', '#5b6670');
      c.innerHTML = `<div class="av"><img src="${Art.iconURL('glyph', f ? f.glyph : 'shield', '#0b0f13', 48)}"></div><div><div class="pn">${esc(p.name)}${p.alive ? '' : ' <span class="out">☠ OUT</span>'}</div><div class="ps"><span>⬢ <b>${counts[p.id] || 0}</b></span><span>$<b>${p.cash}</b></span><span>🂠 <b>${p.tacticCount ?? p.tactics.length}</b></span>${extra}</div></div>`;
      c.title = f ? f.name + ' — ' + f.perk + ': ' + f.desc : '';
      c.onclick = () => Render.focus(p.hq);
      const allied = E.isAlly(S, you, p.id), pact = allied && (S.allies || []).find(x => (x.a === p.id || x.b === p.id) && (x.a === you || x.b === you));
      if (allied) { c.classList.add('allied'); c.appendChild(el('span', 'allybadge' + (pact && pact.ending ? ' ending' : ''), pact && pact.ending ? '💔' : '🤝')); }
      if (isMyTurn() && S.turn.stage === 'act' && p.id !== you && p.alive) {
        const box = el('div', 'chipbtns');
        if (!S.trade) { const tb = el('button', 'tradebtn', 'TRADE'); tb.onclick = e => { e.stopPropagation(); SFX.select(); openTrade(p.id); }; box.appendChild(tb); }
        if (!allied && !S.allyOffer && myP() && myP().alive) { const ab = el('button', 'tradebtn ally', 'ALLY'); ab.title = 'Propose an alliance'; ab.onclick = e => { e.stopPropagation(); SFX.select(); act({ a: 'allyOffer', to: p.id }); }; box.appendChild(ab); }
        if (allied && pact && !pact.ending) {
          const bb = el('button', 'tradebtn betray', 'BREAK'); bb.title = 'Break the alliance (takes effect at the start of your next turn)';
          bb.onclick = e => { e.stopPropagation(); if (bb.dataset.armed !== '1') { bb.dataset.armed = '1'; bb.textContent = 'SURE?'; setTimeout(() => { bb.dataset.armed = ''; bb.textContent = 'BREAK'; }, 2500); return; } SFX.alarm(); act({ a: 'allyBreak', with: p.id }); };
          box.appendChild(bb);
        }
        if (box.children.length) c.appendChild(box);
      }
      box.appendChild(c);
    }
    const modeTxt = S.settings.mode === 'conquest' ? `Conquest · first to <b style="display:inline;font-size:12px;color:var(--gold)">${E.conquestTarget(S)}</b> hexes` : S.settings.mode === 'koth' ? 'Beacon · hold the centre for 3 turns' : 'Domination · capture every HQ';
    $('#roundBox').innerHTML = `<b>ROUND ${S.turn.round}${S.settings.maxRounds ? '/' + S.settings.maxRounds : ''}</b>${modeTxt}`;
  }

  let shownCash = null;
  function renderSiege() {
    let w = document.querySelector('#siegeWarn');
    const me = myP();
    const h = me && S.map.tiles[me.hq] && E.structsOf(S.map.tiles[me.hq]).find(x => x.type === 'hq' && x.owner === you && x.siege);
    if (!h) { if (w) w.remove(); return; }
    if (!w) { w = el('div', '', ''); w.id = 'siegeWarn'; document.body.appendChild(w); w.onclick = () => Render.focus(me.hq); }
    w.innerHTML = `🔥 YOUR HQ IS UNDER SIEGE by <b>${esc(pName(h.siege.by))}</b> — deploy troops next to it (they can attack right away) and retake it this turn, or you're eliminated <span>(click to look)</span>`;
  }
  function renderUndo() {
    const b = $('#undoBtn'); if (!b) return;
    b.hidden = !(isMyTurn() && S.turn.stage === 'act' && undoCount > 0 && !executing);
    b.innerHTML = '↶ UNDO' + (undoCount > 1 ? ` <small>${undoCount}</small>` : '');
  }
  function doUndo() { if (!isMyTurn() || !undoCount || animating || executing) return; SFX.click(); sel = null; mode = null; send({ t: 'undo', seq: seq++ }); }
  $('#undoBtn').onclick = doUndo;
  // world events: a chip under the round counter and a weather layer over the map
  function renderWeather() {
    const w = S && S.weather && E.WEATHER[S.weather.id];
    const L = $('#wxLayer'); L.className = w ? 'wx-' + S.weather.id : '';
    let chip = $('#wxChip');
    if (!w || S.phase !== 'play') { if (chip) chip.remove(); return; }
    if (!chip) { chip = el('div', '', ''); chip.id = 'wxChip'; $('#leftCol').insertBefore(chip, $('#leftCol').firstChild.nextSibling); }
    chip.innerHTML = `<b>${w.icon} ${w.name.toUpperCase()}</b><span>${w.desc}</span>`;
  }
  // alliances: incoming offers and pending ones
  function renderAlly() {
    const pop = $('#allyPop'), o = S && S.allyOffer;
    if (!o || S.phase !== 'play' || (o.to !== you && o.from !== you)) { pop.hidden = true; pop.dataset.k = ''; return; }
    const k = o.from + '>' + o.to; if (pop.dataset.k === k && !pop.hidden) return; pop.dataset.k = k;
    const from = S.players.find(p => p.id === o.from), to = S.players.find(p => p.id === o.to);
    if (o.to === you) {
      pop.innerHTML = `<div class="op-h">🤝 ALLIANCE OFFER</div><div><b style="color:${from.color}">${esc(from.name)}</b> proposes an alliance.</div><div class="sub">You can't attack each other, you share vision in fog of war, and if only allies are left standing you win together. Either side can break it later (it ends at the start of their next turn).</div><div class="row"><button class="btn green" id="alYes">ACCEPT</button><button class="btn red" id="alNo">DECLINE</button></div>`;
      $('#alYes').onclick = () => { SFX.select(); pop.hidden = true; act({ a: 'allyReply', accept: true }); };
      $('#alNo').onclick = () => { SFX.click(); pop.hidden = true; act({ a: 'allyReply', accept: false }); };
      SFX.alarm();
    } else pop.innerHTML = `<div class="op-h">🤝 OFFER SENT</div><div>Waiting for <b style="color:${to.color}">${esc(to.name)}</b> to answer…</div>`;
    pop.hidden = false;
  }
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
    $('#incomeLine').title = `Base $${inc.base} + $${inc.fromHex} land (${inc.hexes} hexes, 1 per 3) + $${inc.fromSea} sea (${inc.sea} hexes, 1 per 4) + $${inc.fromRes} resources/rigs + $${inc.fish || 0} fishing + $${inc.lanes || 0} shipping lanes + $${inc.ref} refineries + $${inc.trade} markets + $${inc.poi || 0} villages/relics`;
    $('#hexLine').innerHTML = `⬢ ${inc.hexes} land · ≈ ${inc.sea} sea` + (inc.cut ? ` · <span style="color:#ff9aa3">${inc.cut} cut off</span>` : '');

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
    if (t.res) tags.push(`<span class="hp-tag res">◆ ${E.isWater(t) ? 'Oil rig' : 'Resource'} +$2</span>`);
    if (t.fish) tags.push('<span class="hp-tag res">🐟 Fishing grounds +$1</span>');
    if (E.structsOf(t).some(x => x.type === 'port')) tags.push('<span class="hp-tag">⚓ Shipping lanes: +$1 per 4 of your connected sea hexes (max $5)</span>');
    if (E.TERRAIN[t.t].defMult) tags.push(`<span class="hp-tag">+${E.TERRAIN[t.t].defMult} Mult defence</span>`);
    if (E.TERRAIN[t.t].moveCost) tags.push('<span class="hp-tag">Costs 2 move</span>');
    if (E.TERRAIN[t.t].bog) tags.push('<span class="hp-tag">Attackers −1 Mult</span>');
    if (t.fog) tags.push('<span class="hp-tag">🌫 Fog of war: you can\'t see units here</span>');
    if (t.poi && E.POI[t.poi] && !(t.poi === 'fort' && t.owner)) tags.push(`<span class="hp-tag" style="color:var(--gold)">${E.POI[t.poi].name}</span>`);
    if (t.contam) tags.push(`<span class="hp-tag cut">☢ Fallout ${t.contam} rounds</span>`);
    if (t.smoke) tags.push('<span class="hp-tag">Smoke</span>');
    if (ds.map.beacon === k) tags.push('<span class="hp-tag" style="color:var(--gold)">◆ BEACON</span>');
    if (t.owner === you && !E.supplySet(ds, you).has(k)) tags.push('<span class="hp-tag cut">Cut off — no income</span>');
    let h = `<div class="hp-title">${t.contam ? 'Fallout Zone' : E.TERRAIN[t.t].name}</div><div class="hp-own">${owner ? `<span style="color:${owner.color}">■ ${esc(owner.name)}</span>` : '<span class="sub">Unclaimed</span>'}</div><div class="hp-tags">${tags.join('')}</div>`;
    if (t.poi && E.POI[t.poi] && !(t.poi === 'fort' && t.owner)) h += `<div class="urow" style="cursor:default"><img src="${Art.iconURL('poi', t.poi)}"><div class="un">${E.POI[t.poi].name}${t.gar && !t.owner ? ` <span class="hp-tag cut">garrison ${t.gar} chips${t.poi === 'village' ? ' · +' + (t.gar >= 7 ? 2 : 1) + ' mult' : ''}</span>` : ''}<div class="st">${E.POI[t.poi].desc}</div></div></div>`;
    for (const st of E.structsOf(t)) {
      const sd = E.STRUCTS[st.type], L = st.lvl || 1;
      const flags = (st.siege ? ' <span class="hp-tag cut">UNDER SIEGE</span>' : '') + (st.lock ? ' <span class="hp-tag">online next turn</span>' : '');
      h += `<div class="urow" style="cursor:default"><img src="${Art.iconURL('struct', st.type)}"><div class="un">${sd.name} <span class="gold">${'★'.repeat(L)}</span>${flags}<div class="st">${sd.desc}${E.UPGRADABLE.includes(st.type) && L < E.MAX_SLVL && t.owner === you && st.owner === you ? '<br><b class="gold">Upgrade: $' + E.buildCost(ds, ds.players.find(p => p.id === you), st.type, k) + '</b> (build it again here)' : ''}</div></div></div>`;
    }
    if (t.owner === you && !t.bridge && E.structsOf(t).length < E.MAX_STRUCTS && canCommand()) h += `<div class="hp-sec">${E.MAX_STRUCTS - E.structsOf(t).length} building slot${E.MAX_STRUCTS - E.structsOf(t).length === 1 ? '' : 's'} free on this hex</div>`;
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

  function cardEl(id, opts = {}) { return Cards.make(id, opts); }

  // ───────────── bars: unit deck (cards, keys 1-0), build bar (Z-M), tactic hand ─────────────
  const UNIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const BUILD_KEYS = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.'];
  let hotbarSig = '';
  function hotbarItems() {
    const ds = dispState(); const me = ds && ds.players.find(p => p.id === you);
    if (!me || !me.alive) return { units: [], builds: [] };
    return { me, ds, units: me.arsenal.slice(0, 10), builds: E.BUILD_ORDER };
  }
  function buildSlot(id, key, me) {
    const ds = dispState();
    const spots = E.buildHexes(ds, you, id);
    const ups = spots.filter(k => E.structsOf(ds.map.tiles[k]).some(x => x.type === id));
    const cost = id === 'hq' ? E.buildCost(ds, me, 'hq', me.hq) : E.structCost(me, id);
    const name = id === 'hq' ? 'Fortify' : E.STRUCTS[id].name;
    const s = el('div', 'slot k-build');
    s.dataset.kind = 'build'; s.dataset.id = id;
    s.innerHTML = `<span class="sk">${key.toUpperCase()}</span><img src="${Art.iconURL('struct', id, '#1b1712', 72)}"><span class="bname">${name}</span><span class="sc">$${cost}</span>` + (ups.length && id !== 'hq' ? `<span class="up" title="${ups.length} can be upgraded">▲${ups.length}</span>` : '');
    if (me.cash < cost) s.classList.add('poor');
    if (!spots.length) s.classList.add('nowhere');
    if (mode && mode.type === 'build' && mode.struct === id) s.classList.add('on');
    s.onclick = () => armSlot('build', id);
    s.onmouseenter = () => { SFX.hover(); showSlotTip(s, 'build', id); };
    s.onmouseleave = hideSlotTip;
    return s;
  }
  function renderHand() {
    const { me, ds, units, builds } = hotbarItems();
    const hu = $('#hbUnits'), hb = $('#hbBuild'), hand = $('#hand');
    $('#deckBar').hidden = $('#buildBar').hidden = !me;
    if (!me) { hu.innerHTML = hb.innerHTML = hand.innerHTML = ''; return; }
    const counts = {}; for (const u of Object.values(ds.units)) if (u.owner === you) counts[u.type] = (counts[u.type] || 0) + 1;
    const sig = JSON.stringify([units, me.levels, me.cash, mode && { ...mode, el: null }, counts, me.tactics.map(c => c.uid), canCommand()]);
    if (sig === hotbarSig) return; hotbarSig = sig;
    const prevIds = new Set([...hu.children].map(c => c.dataset.id));
    hu.innerHTML = ''; hb.innerHTML = '';
    $('#deckBar .bar-label').textContent = `DECK ${units.length}/${E.DECK_MAX} · KEYS 1–0`;
    units.forEach((id, i) => {
      const cost = E.unitCost(me, id);
      const c = cardEl(id, { mini: true, cost, level: me.levels[id] || 0, key: UNIT_KEYS[i], count: counts[id] });
      c.dataset.kind = 'unit';
      if (me.cash < cost) c.classList.add('poor');
      if (mode && mode.type === 'deploy' && mode.unit === id) c.classList.add('active');
      if (prevIds.size && !prevIds.has(id)) c.classList.add('new');
      c.style.setProperty('--fan', ((i - (units.length - 1) / 2) * 1.6) + 'deg');
      c.onclick = () => armSlot('unit', id);
      hu.appendChild(c);
    });
    builds.forEach((id, i) => hb.appendChild(buildSlot(id, BUILD_KEYS[i], me)));
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
    const d = E.STRUCTS[id], me = myP();
    const up = E.UPGRADABLE.includes(id) ? `<span class="tip-up">Build on one you already own to upgrade it: ★★ $${me ? E.structCost(me, id, 2) : '?'} · ★★★ $${me ? E.structCost(me, id, 3) : '?'}</span>` : '';
    tip.innerHTML = `<div class="btip"><img src="${Art.iconURL('struct', id, '#fff', 96)}"><b>${id === 'hq' ? 'Fortify HQ' : d.name} <span class="gold">$${me ? (id === 'hq' ? E.buildCost(S, me, 'hq', me.hq) : E.structCost(me, id)) : d.cost}</span></b><span>${d.desc}</span>${up}</div>`;
    const r = slot.getBoundingClientRect();
    tip.style.left = (r.left + r.width / 2) + 'px'; tip.style.top = (r.top - 12) + 'px';
    tip.hidden = false; slotTipFor = slot;
  }
  function hideSlotTip() { $('#slotTip').hidden = true; slotTipFor = null; }
  let slotTipFor = null;
  // any menu opening clears hover-only UI (card zoom, build tips, hex tooltip) so nothing floats on top of it
  function clearHoverUI() { Cards.zoomHide(); hideSlotTip(); const t = $('#tooltip'); if (t) t.hidden = true; }
  { const watched = ['#supply', '#crate', '#draft', '#combat', '#trade', '#offerPop', '#index', '#rules', '#modal', '#escMenu', '#hostPanel', '#victory', '#passCover', '#closedCover'];
    const mo = new MutationObserver(muts => { if (muts.some(m => !m.target.hidden)) clearHoverUI(); });
    for (const id of watched) { const e = $(id); if (e) mo.observe(e, { attributes: true, attributeFilter: ['hidden'] }); }
    setInterval(() => { if (slotTipFor && (!document.contains(slotTipFor) || !slotTipFor.matches(':hover'))) hideSlotTip(); }, 200); }

  function armSlot(kind, id) {
    const ds = dispState(); const me = ds.players.find(p => p.id === you);
    if (!me || !canCommand()) { toast(isMyTurn() ? 'Open your supply crate first' : 'Wait for your turn', 'err'); SFX.error(); return; }
    if (kind === 'unit') {
      const cost = E.unitCost(me, id);
      if (mode && mode.type === 'deploy' && mode.unit === id) { mode = null; refreshAll(); return; }
      if (me.cash < cost) { toast('Need $' + cost, 'err'); SFX.error(); shakeSlot(kind, id); return; }
      if (!E.deployHexes(ds, you, id).length) { toast(E.isSea(id) ? 'Build a Port on the coast to launch ships' : 'All deploy points are full', 'err'); SFX.error(); shakeSlot(kind, id); return; }
      mode = { type: 'deploy', unit: id };
    } else {
      const cost = id === 'hq' ? E.buildCost(ds, me, 'hq', me.hq) : E.structCost(me, id);
      if (mode && mode.type === 'build' && mode.struct === id) { mode = null; refreshAll(); return; }
      if (!E.buildHexes(ds, you, id).some(k => me.cash >= E.buildCost(ds, me, id, k)) && E.buildHexes(ds, you, id).length) { toast('Need $' + cost, 'err'); SFX.error(); shakeSlot(kind, id); return; }
      if (!E.buildHexes(ds, you, id).length) { toast(id === 'hq' ? 'Your HQ is fully fortified' : id === 'port' ? 'No free coastal hex in supply' : id === 'bridge' ? 'No 1-hex sea gap next to your supplied land' : 'Nowhere to build that', 'err'); SFX.error(); shakeSlot(kind, id); return; }
      mode = { type: 'build', struct: id };
    }
    sel = null; SFX.select(); refreshAll();
  }
  function shakeSlot(kind, id) { const s = document.querySelector(`[data-kind="${kind}"][data-id="${id}"]`); if (s) { s.classList.remove('nope'); void s.offsetWidth; s.classList.add('nope'); } }

  // crate decisions
  async function pickFromCrate(idx, replace, frontEl) {
    const d = E.cardDef(S.turn.crate.cards[idx]);
    const target = d.kind === 'unit' ? ($('#hbUnits').querySelector(`[data-id="${d.id}"]`) || $('#hbUnits').lastElementChild || $('#deckBar')) : ($('#hand').lastElementChild || $('#hand'));
    if (frontEl) flyTo(frontEl, target, () => { pulseTarget(target); SFX.coin(2); });
    const ok = await act({ a: 'pick', idx, replace });
    if (ok && plan.length) runPlan();
    return ok;
  }
  async function pickFromSupply(idx, replace, frontEl) {
    const d = E.cardDef(S.turn.offer[idx]);
    const target = d.kind === 'unit' ? ($('#hbUnits').querySelector(`[data-id="${d.id}"]`) || $('#hbUnits').lastElementChild || $('#deckBar')) : ($('#hand').lastElementChild || $('#hand'));
    if (frontEl) flyTo(frontEl, target, () => { pulseTarget(target); SFX.coin(2); });
    const ok = await act({ a: 'choose', pick: 'card', idx, replace });
    if (ok && plan.length) runPlan();
    return ok;
  }
  async function scrapCrate() {
    const ok = await act({ a: 'scrap' });
    if (ok && plan.length) runPlan();
    return ok;
  }

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
    // turn clock: a draining bar in the current player's colour, red and ticking for the last 10 seconds
    let clock = $('#turnClock');
    if (!clock) { clock = el('div', '', '<div class="tc-bar"><i></i></div><span></span>'); clock.id = 'turnClock'; $('#hud').appendChild(clock); }
    const total = (S.settings.timer || 0) * 1000;
    const draw = () => {
      if (clockPaused) localDeadline = Date.now() + pausedLeft;   // frozen while a fight or crate plays out
      const left = localDeadline ? Math.max(0, localDeadline - Date.now()) : 0, s = Math.ceil(left / 1000);
      b.innerHTML = 'END TURN' + (localDeadline && mine ? `<span class="tmr">${s}s left</span>` : '');
      clock.hidden = !(localDeadline && S.phase === 'play');
      if (clock.hidden) return;
      const cp = curP();
      clock.style.setProperty('--pc', cp ? cp.color : '#fff');
      clock.querySelector('i').style.width = Math.min(100, left / Math.max(1, total) * 100) + '%';
      clock.querySelector('span').textContent = `${clockPaused ? '⏸' : '⏱'} ${cp ? (cp.id === you ? 'YOUR TURN' : cp.name.toUpperCase()) : ''} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}${clockPaused ? ' · PAUSED' : ''}`;
      clock.classList.toggle('paused', clockPaused);
      clock.classList.toggle('low', s <= 10);
      if (s <= 10 && s > 0 && mine && s !== lastTick) { lastTick = s; SFX.chip(12 - s); }
    };
    draw(); if (localDeadline) timerInt = setInterval(draw, 250);
    // pulse when nothing left to do
    const ds = S; const anyReady = Object.values(ds.units).some(u => u.owner === you && E.canAct(ds, u));
    b.classList.toggle('pulse', mine && !anyReady);
  }
  $('#endBtn').onclick = async () => { if (!isMyTurn() || animating) return; mode = null; sel = null; SFX.click(); await act({ a: 'end' }); };

  function renderModeHint() {
    const h = $('#modeHint'); let txt = '';
    if (mode && mode.type === 'deploy') txt = `Deploy ${E.UNITS[mode.unit].name} — click a glowing ${E.isSea(mode.unit) ? 'sea hex by your Port' : 'HQ / FOB'} · right-click to stop`;
    else if (mode && mode.type === 'build') txt = mode.struct === 'hq' ? 'Fortify HQ — click your HQ' : `Build or upgrade ${E.STRUCTS[mode.struct].name} — click a glowing hex · right-click to stop`;
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
      const gs = assaultGroups(ds, k, E.buildIndex(ds));
      if (gs.length) {
        const c = E.combatCalc(ds, you, gs.flatMap(g => g.units.map(id => ds.units[id])), gs.map(g => g.stage), k, false);
        html = combatTip(gs.length > 1 ? gs.length + '-WAY PINCER' : 'ATTACK', c) + intel(ds, k);
      }
    } else if (ov.fire && ov.fire.has(k) && sel) {
      const c = E.combatCalc(ds, you, [...sel.units].map(id => ds.units[id]), sel.hex, k, true);
      html = combatTip('BOMBARD', c) + '<div class="sub">Win: destroy 1 unit (2 on double score). Lose: nothing happens.</div>';
    } else if (ov.reach && ov.reach[k] && ov.reach[k].kind === 'capture') html = '<b>SEIZE</b> — empty ' + (E.isWater(ds.map.tiles[k]) ? 'sea lane' : 'enemy hex');
    else if (ov.reach && ov.reach[k] && ov.reach[k].kind === 'board') html = '<b>BOARD</b> — climb aboard the transport';
    else {
      const t = ds.map.tiles[k];
      const units = Object.values(ds.units).filter(u => u.hex === k);
      if (!units.length && !t.struct && !t.res && !t.owner) return hideTip();
      html = `<b style="color:${t.owner ? pColor(t.owner) : '#fff'}">${t.owner ? esc(pName(t.owner)) : 'Unclaimed'}</b> · ${t.bridge ? 'Bridge' : t.contam ? 'Fallout' : E.TERRAIN[t.t].name}` + (t.res ? ` · <span style="color:#9ffcf2">${E.isWater(t) ? 'Oil rig' : 'Resource'} +$2</span>` : '') + (t.fish ? ' · <span style="color:#9ffcf2">Fishing grounds +$1</span>' : '') + (t.poi && E.POI[t.poi] && !(t.poi === 'fort' && t.owner) ? ` · <span style="color:var(--gold)">${E.POI[t.poi].name}</span>` : '');
      if (!t.bridge) for (const st of E.structsOf(t)) html += `<div class="tip-struct"><img src="${Art.iconURL('struct', st.type, '#fff', 40)}">${E.STRUCTS[st.type].name} <span class="gold">${'★'.repeat(st.lvl || 1)}</span>${st.siege ? ' <b style="color:#ff6a4a">UNDER SIEGE</b>' : ''}</div>`;
      html += intel(ds, k);
    }
    tip.innerHTML = html; tip.hidden = false;
    const w = tip.offsetWidth || 280;
    tip.style.left = Math.min(innerWidth - w - 10, x + 16) + 'px'; tip.style.top = Math.min(innerHeight - tip.offsetHeight - 10, y + 16) + 'px';
  }
  // hover intel: the actual unit cards sitting on a hex
  function intel(ds, k) {
    const units = Object.values(ds.units).filter(u => u.hex === k);
    if (!units.length) return '';
    const by = {};
    for (const u of units) { const key = u.type; (by[key] || (by[key] = [])).push(u); }
    const owner = ds.players.find(p => p.id === units[0].owner);
    let h = `<div class="intel">`;
    for (const type in by) {
      const d = E.UNITS[type], lv = owner && owner.levels ? owner.levels[type] || 0 : 0, n = by[type].length;
      const flags = by[type].some(u => u.stun) ? ' <span class="frz">FROZEN</span>' : '';
      h += `<div class="ic r-${d.rarity}"><img src="${Art.cardArt(type)}"><div><b>${n > 1 ? n + '× ' : ''}${d.name}</b>${lv ? ' <span class="gold">' + '★'.repeat(lv) + '</span>' : ''}${flags}<div class="ic-s"><span class="a">⚔ ${d.atk + (d.atk ? lv : 0)}</span><span class="d">⛨ ${d.def + lv}</span><span>➜ ${d.mv}</span>${d.range ? '<span>◎ ' + d.range + '</span>' : ''}</div><div class="ic-r" style="color:${E.RARITY[d.rarity].color}">${E.RARITY[d.rarity].name} ${E.CLASS_NAME[d.cls]}</div></div></div>`;
    }
    return h + '</div>';
  }
  function combatTip(title, c) {
    const col = c.winProb >= 0.66 ? 'var(--green)' : c.winProb >= 0.4 ? 'var(--gold)' : 'var(--red)';
    const bon = b => b.filter(x => !x.note).map(x => `${x.label} ${x.chips ? '+' + x.chips + 'c' : (x.mult > 0 ? '+' : '') + x.mult + 'x'}`).join(', ');
    return `<b>${title}</b> <span class="odds" style="color:${col}">${Math.round(c.winProb * 100)}%</span><br>` +
      `You: <span style="color:var(--chips)">${c.att.chips}</span> × (d6<span style="color:var(--mult)">${c.att.mult ? '+' + c.att.mult : ''}</span>)` + (c.att.bonuses.length ? `<div class="sub">${bon(c.att.bonuses)}</div>` : '') +
      `Them: <span style="color:var(--chips)">${c.def.chips}</span> × (d6<span style="color:var(--mult)">${c.def.mult ? '+' + c.def.mult : ''}</span>)` + (c.def.bonuses.length ? `<div class="sub">${bon(c.def.bonuses)}</div>` : '');
  }
  function hideTip() { $('#tooltip').hidden = true; }

  // ───────────── combat sequence (chips × mult) ─────────────
  function dieFace(d, n) {
    const on = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[n];
    d.innerHTML = ''; for (let i = 0; i < 9; i++) d.appendChild(el('i', on.includes(i) ? 'on' : ''));
  }
  // a fight with a 100% win chance skips the dice: the defenders are crushed on the spot
  async function obliterate(ev) {
    const all = ev.killed.length >= ev.def.units.length;
    const word = ev.ranged && !all ? 'DIRECT HIT!' : 'OBLITERATED!';
    const [x, y] = Render.screenOf(ev.to);
    const ff = fastForward ? 0.4 : 1;
    // wind-up: attacker stacks lunge in
    if (!ev.ranged) for (const st of ev.stages || [ev.from]) Render.beam(st, ev.to, pColor(ev.att.pid), 0.25, 40);
    SFX.whoosh(); await sleep(180 * ff);
    // impact
    Render.flash(0.35, '#ffffff'); Render.shake(20);
    Render.ring(ev.to, '#ffffff', 90, 0.45, 8); Render.ring(ev.to, '#ff4f5e', 140, 0.7, 7); Render.ring(ev.to, '#ffc53d', 190, 0.95, 5);
    Render.burst(ev.to, ['#ffffff', '#ffc53d', '#ff4f5e', '#ff7a2a', '#3a3a3a'], 70, { speed: 2.4, size: 4.5, up: 160 });
    Render.smoke(ev.to, 16, 'rgba(90,80,70,');
    SFX.boom(1.5); SFX.victoryHit();
    const t = el('div', 'oblit', `<b>${word}</b><small>${ev.killed.length} unit${ev.killed.length === 1 ? '' : 's'} wiped out · no contest</small>`);
    t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.setProperty('--pc', pColor(ev.att.pid));
    $('#flyLayer').appendChild(t);
    if (ev.att.pid === you) SFX.win();
    setTimeout(() => t.remove(), 1900);
    await sleep(1100 * ff);
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
          // each unit is dealt in as its card, fanned when the stack is big
          const cu = s.querySelector('.cb-units'), card = Cards.make(t, { mini: true }); card.classList.add('cb-card');
          card.style.setProperty('--n', d.units.length); card.style.setProperty('--i', i); cu.appendChild(card);
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
        if (d.raw !== d.roll) { dice[si].classList.add('loaded'); s.querySelector('.cb-bon').appendChild(el('div', 'cb-b', '<span>Loaded Dice</span><span class="v m">${d.raw} → 3</span>')); }
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
      wrap.classList.add('resolved'); wrap.appendChild(res);
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
      // SPACE flings your die
      const onKey = e => { if (e.key !== ' ') return; e.preventDefault(); e.stopPropagation(); const d = dice.find(d => d.human && !d.thrown); if (d) fling(d, -d.side * (900 + Math.random() * 500), (Math.random() - 0.5) * 700); };
      addEventListener('keydown', onKey, true);
      const cleanupKey = () => removeEventListener('keydown', onKey, true);
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
          c.fillText('DRAG & FLING — OR PRESS SPACE!', W / 2, H / 2 + 8);
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
        if (dice.every(d => d.settled && d.snapT >= 1)) { done = true; cleanupKey(); setTimeout(resolve, 260 * speed()); return; }
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
    Render.recolor();
    if (E.isWater(t)) { SFX.capture(i); return; }   // sea fades to its new colour (see Render.recolor), no pop
    Render.pop(k);
    Render.burst(k, [pColor(pid), '#fff'], 10, { size: 2.5, up: 120, square: true });
    SFX.capture(i);
  }

  // glide the camera to action happening off-screen
  let evBy = null;
  function follow(k) {
    return;   // the camera never chases actions; you stay in control of it (F jumps home)
    const [x, y] = Render.screenOf(k);
    if (x < innerWidth * 0.18 || x > innerWidth * 0.82 || y < innerHeight * 0.2 || y > innerHeight * 0.72) Render.focus(k);
  }
  async function playEvents(events, by) {
    Render.setState(S); evBy = by;
    const watch = by !== you;
    for (const ev of events) {
      switch (ev.e) {
        case 'turn': {
          const p = S.players.find(x => x.id === ev.pid);
          if (ev.pid === you) {
            SFX.yourTurn(); banner('YOUR TURN', 'Round ' + ev.round, pColor(you));
            const [hx, hy] = Render.screenOf(p.hq);
            if (hx < 0 || hx > innerWidth || hy < 0 || hy > innerHeight) Render.focus(p.hq);
          }
          else { SFX.turn(); banner(p.name.toUpperCase(), 'Round ' + ev.round, p.color); }
          await sleep(ev.pid === you ? 900 : 500);
          break;
        }
        case 'income': Render.float(ev.hq, '+$' + ev.amount, '#ffc53d', 26); if (ev.pid === you) SFX.coin(Math.min(8, ev.amount / 2 | 0)); await sleep(250); break;
        case 'crate': {
          if (ev.pid !== you) {
            const n = pName(ev.pid), tn = E.CRATES[ev.tier].name;
            if (ev.tier === 'mythic') { toast(`🟪 ${n} spun a MYTHIC CRATE!`, 'leg'); SFX.legendary(); }
            else if (ev.tier === 'gilded') { toast(`🟨 ${n} opened a ${tn}`); SFX.rare(); }
            else toast(`${n} called in a Supply Drop`);
          }
          break;
        }
        case 'scrap': if (ev.pid === you) Render.float(ev.hq, '+$' + ev.amount, '#ffc53d', 22); break;
        case 'draft': if (ev.round > 1 && ev.pid === you) SFX.card(); break;
        case 'draftDone': banner('THE WAR BEGINS', 'Draft complete', '#b52b38'); SFX.yourTurn(); await sleep(900); break;
        case 'card': {
          const d = ev.id ? E.cardDef(ev.id) : null;
          if (ev.pid === you && d && ev.level) { toast(`★ ${d.name} upgraded to level ${ev.level}!`, 'leg'); break; }
          if (ev.pid === you && d && ev.refund) { toast(`${d.name} is maxed — +$${ev.refund}`); break; }
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
          if (ev.claimed) flipTile(ev.hex, ev.pid, 3);
          if (ev.muster) { Render.ring(ev.hex, '#ff4a2a', 60, 0.5, 5); Render.float(ev.hex, 'MUSTER! READY TO FIGHT', '#ffb03a', 15); if (ev.pid === you) SFX.rare(); }
          SFX.deploy(); Render.shake(3); Render.burst(ev.hex, ['#c9b78f', '#8f8068'], 14, { up: 30, g: 120, size: 3 }); Render.ring(ev.hex, pColor(ev.pid), 40, 0.4, 3);
          await sleep(120); break;
        }
        case 'build': {
          { const tt = S.map.tiles[ev.hex]; tt.structs = E.structsOf(tt).slice(); const ex = tt.structs.find(x => x.type === ev.struct);
            if (ex) ex.lvl = ev.lvl || ex.lvl; else tt.structs.push({ type: ev.struct, owner: ev.pid, lvl: ev.lvl || 1, lock: ev.lock || 0 });
            if (!tt.struct || ev.struct === 'hq' || ev.struct === 'fob') tt.struct = tt.structs.find(x => x.type === ev.struct); }
          if (ev.lvl > 1) { Render.ring(ev.hex, '#ffc53d', 70, 0.6, 5); Render.float(ev.hex, '★'.repeat(ev.lvl) + ' UPGRADED', '#ffc53d', 18); }
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
          if (ev.crush) await obliterate(ev); else await showCombat(ev);
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
        case 'undo': if (ev.pid === you) toast('↶ Undone'); break;
        case 'razed': {
          Render.burst(ev.hex, ['#ffb03a', '#ff5a2a', '#8a8a8a', '#3a3a3a'], 40, { speed: 1.8, size: 4, up: 160 });
          Render.ring(ev.hex, '#ff6a2a', 70, 0.5, 5); Render.smoke(ev.hex, 14, 'rgba(90,85,80,');
          Render.float(ev.hex, 'BUNKER DESTROYED', '#ff8a5a', 17); SFX.boom(1); Render.shake(10);
          await sleep(500); break;
        }
        case 'weather': {
          const w = E.WEATHER[ev.id]; if (!w) break;
          banner(w.icon + ' ' + w.name.toUpperCase(), w.desc, '#2a4f6b'); SFX.whoosh(); await sleep(1000); break;
        }
        case 'ally': {
          const a = pName(ev.from), b = pName(ev.to), meIn = ev.from === you || ev.to === you;
          if (ev.status === 'formed') { banner('🤝 ALLIANCE FORMED', a + ' & ' + b, '#2f6b4a'); SFX.rare(); await sleep(900); }
          else if (ev.status === 'declined' && meIn) toast(`${b} declined the alliance`);
          else if (ev.status === 'offer' && !meIn) toast(`🤝 ${a} offered ${b} an alliance`);
          else if (ev.status === 'breaking') { if (ev.to === you) { banner('🗡 BETRAYAL INCOMING', a + ' is breaking your alliance next turn', '#7a1f2b'); SFX.alarm(); } else toast(`🗡 ${a} is breaking the alliance with ${b}`); }
          else if (ev.status === 'broken') { toast(`💔 ${a} broke the alliance with ${b}`, 'err'); }
          break;
        }
        case 'spawnPicked': {
          Render.recolor && Render.recolor();
          Render.ring(ev.hex, pColor(ev.pid), 90, 0.8, 6); Render.burst(ev.hex, [pColor(ev.pid), '#fff'], 30, { up: 140, square: true });
          SFX.deploy(); Render.shake(6); follow(ev.hex); await sleep(500); break;
        }
        case 'spawnTurn': if (ev.pid === you) { toast('Your pick — choose an HQ hex'); SFX.yourTurn(); } break;
        case 'loot': {
          Render.ring(ev.hex, '#ffcf4a', 60, 0.6, 4);
          Render.burst(ev.hex, ['#ffcf4a', '#fff3a8', '#d9b77a'], 22, { up: 120, square: true });
          if (ev.poi === 'ruins') { Render.float(ev.hex, '+$' + ev.amount + ' LOOT', '#ffc53d', 22); if (ev.pid === you) SFX.coin(6); }
          else { Render.float(ev.hex, 'SUPPLY CACHE!', '#ffcf4a', 20); if (ev.pid === you) { SFX.rare(); toast('📦 Found a cache: ' + E.TACTICS[ev.card].name, 'leg'); } }
          if (S.map.tiles[ev.hex]) delete S.map.tiles[ev.hex].poi;
          await sleep(350); break;
        }
        case 'embargoHit': if (ev.pid === you) banner('EMBARGO', 'Your income is halved this turn', '#b52b38'); else toast(`⛔ ${pName(ev.pid)} is under embargo`); break;
        case 'annex': {
          // encirclement: ring pulse, then the pocket flips hex by hex
          const mid = ev.hexes[Math.floor(ev.hexes.length / 2)];
          if (ev.pid !== you) follow(mid);
          Render.ring(mid, pColor(ev.pid), 140, 0.8, 6); SFX.rare();
          for (let i = 0; i < ev.hexes.length; i++) { flipTile(ev.hexes[i], ev.pid, i); await sleep(60); }
          Render.float(mid, 'ENCIRCLED +' + ev.hexes.length, pColor(ev.pid), 22);
          await sleep(300); break;
        }
        case 'siege': {
          follow(ev.hex);
          Render.ring(ev.hex, '#ff4a2a', 120, 0.9, 7); Render.shake(14); SFX.alarm();
          if (ev.victim === you) banner('YOUR HQ IS UNDER SIEGE', 'Muster troops around it and retake it on your turn', '#b52b38');
          else toast(`🔥 ${pName(ev.pid)} is besieging ${pName(ev.victim)}'s HQ!`, 'leg');
          await sleep(900); break;
        }
        case 'siegeBroken': toast(`🛡 ${pName(ev.pid)}'s HQ siege collapsed`); SFX.rare(); break;
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
        case 'tactic': break;
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
      case 'carpet': {
        // a three-jet formation lays bombs along the strip
        SFX.whoosh();
        Render.flyover(ev.area.filter(k2 => S.map.tiles[k2]), { count: 3, color: pColor(ev.pid), dur: 2.1, onBomb: () => { SFX.boom(0.5); Render.shake(6); } });
        await sleep(2000);
        Render.float(ev.target, ev.kills.length + ' DESTROYED', '#ff4f5e', 20); killUnits(ev.kills); await sleep(300); break;
      }
      case 'jackpot': SFX.coin(8); Render.flash(0.2, '#ffc53d'); break;
      case 'airstrike': {
        // a jet in the striker's colour makes a bombing run over the target
        SFX.whoosh();
        { const [x, y] = Render.topOf(ev.target); const k1 = ev.target, sp = n => { const [q, r] = E.parse(k1); return E.key(q + n, r); };
          Render.flyover([k1, sp(-1), sp(1)].filter(k2 => S.map.tiles[k2]).slice(0, 1).concat([k1, k1]), { color: pColor(ev.pid), dur: 1.6, onBomb: () => { SFX.boom(0.7); Render.shake(9); } }); }
        await sleep(1500);
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
      case 'rally': banner('RALLY!', who + ' — next attack +2 Mult', pColor(ev.pid)); SFX.rare(); await sleep(500); break;
      case 'bounty': Render.float(me.hq, 'BOUNTY: $2 PER KILL', '#ffc53d', 18); SFX.coin(3); break;
      case 'fortify': Render.ring(ev.target, pColor(ev.pid), 60, 0.6, 5); Render.float(ev.target, 'FORTIFIED ' + '★'.repeat(ev.lvl || 1), '#ffc53d', 18); SFX.deploy(); Render.shake(4); break;
      case 'embargo': Render.ring(ev.target, '#ff4f5e', 90, 0.8, 5); Render.float(ev.target, 'EMBARGO', '#ff4f5e', 20); SFX.alarm(); break;
      case 'orbital': {
        SFX.zap(); await sleep(250);
        const [x, y] = Render.topOf(ev.target);
        for (let i = 0; i < 4; i++) { Render.ring(ev.target, ['#bff6ff', '#7ff3ff', '#fff', '#36c9ff'][i], 50 + i * 30, 0.5 + i * 0.15, 6); await sleep(80); }
        Render.flash(0.5, '#bff6ff'); SFX.boom(1.6); Render.shake(22);
        Render.burst([x, y], ['#fff', '#bff6ff', '#36c9ff', '#ffb03a'], 70, { speed: 2.4, size: 4 });
        Render.float(ev.target, ev.kills.length + ' VAPORISED', '#7ff3ff', 22); killUnits(ev.kills); await sleep(500); break;
      }
      case 'mutiny': for (const id of ev.units) if (S.units[id]) S.units[id].owner = ev.pid; flipTile(ev.target, ev.pid, 5); Render.ring(ev.target, pColor(ev.pid), 70, 0.7, 5); SFX.rare(); break;
    }
    await sleep(250);
  }

  // ───────────── victory ─────────────
  function showVictory() {
    const v = $('#victory'); if (!v.hidden) return;
    const w = S.winner; const wp = S.players.find(p => p.id === w.pid);
    const winners = w.pids || [w.pid];
    const mine = winners.includes(you);
    mine ? SFX.win() : SFX.lose();
    const counts = {}; for (const k in S.map.tiles) { const o = S.map.tiles[k].owner; if (o) counts[o] = (counts[o] || 0) + 1; }
    const rows = S.players.slice().sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).map(p => `<tr><td style="color:${p.color}">■ ${esc(p.name)}</td><td>${E.FACTIONS[p.faction] ? E.FACTIONS[p.faction].name : ''}</td><td>${counts[p.id] || 0}</td><td>${p.stats.captured}</td><td>${p.stats.kills}</td><td>${p.stats.lost}</td></tr>`).join('');
    v.innerHTML = `<div class="vic panel" style="padding:30px 40px"><h1 style="color:${wp.color};text-shadow:0 6px 0 #000">${mine ? 'VICTORY' : myP() ? 'DEFEAT' : 'GAME OVER'}</h1><div class="why"><b style="color:${wp.color}">${esc(wp.name)}</b> ${esc(w.reason)}</div>
      ${winners.length > 1 ? `<div class="why">🤝 ${winners.map(id => `<b style="color:${pColor(id)}">${esc(pName(id))}</b>`).join(' & ')}</div>` : ''}
      <div class="power"><h3>BALANCE OF POWER</h3><canvas id="powerChart" width="1240" height="400"></canvas><div id="powerNotes"></div></div>
      <table class="stats"><tr><th>COMMANDER</th><th>FACTION</th><th>HEXES</th><th>CAPTURED</th><th>KILLS</th><th>LOST</th></tr>${rows}</table>
      <div class="row" style="justify-content:center"><button class="btn big" id="vicLook">VIEW BOARD</button>${lobby && lobby.hostId === realId ? '<button class="btn big red" id="vicLobby">BACK TO LOBBY</button>' : ''}<button class="btn big gold" id="vicMenu">MAIN MENU</button></div></div>`;
    v.hidden = false;
    try { drawPower($('#powerChart'), S.history || [], S.players); } catch (e) { console.error(e); }
    for (let i = 0; i < 6; i++) setTimeout(() => { if (!S) return; const k = Object.keys(S.map.tiles).filter(k => S.map.tiles[k].owner === w.pid); const r = k[Math.floor(Math.random() * k.length)]; if (r) { Render.burst(r, [wp.color, '#fff', '#ffc53d'], 30, { speed: 1.6, up: 200, square: true }); } }, i * 300);
    $('#vicLook').onclick = () => { v.hidden = true; setTimeout(() => { if (S && S.phase === 'over') { v.hidden = false; } }, 8000); };
    const bl = $('#vicLobby'); if (bl) bl.onclick = () => send({ t: 'toLobby' });
    $('#vicMenu').onclick = () => { SFX.click(); send({ t: 'leave' }); setTimeout(() => { if (S) backToMenu(); }, 1500); };
  }

  // ── random map type: a slot reel of battlefield thumbnails that lands on the real map ──
  const ARCH_NAME = { continent: 'Continent', pangaea: 'Supercontinent', twin: 'Twin Continents', archipelago: 'Archipelago', inland: 'Inland Sea', crescent: 'Crescent Isles' };
  const thumbCache = {};
  function mapThumb(tiles, w = 150, h = 96) {
    const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; const c = cv.getContext('2d'); c.scale(2, 2);
    const pts = Object.keys(tiles).map(k => { const [q, r] = E.parse(k); return [q + r / 2, r * 0.866, tiles[k]]; });
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = Math.min((w - 10) / (x1 - x0 + 1), (h - 10) / (y1 - y0 + 1)), ox = (w - (x1 - x0) * sc) / 2, oy = (h - (y1 - y0) * sc) / 2;
    c.fillStyle = '#0d2233'; c.fillRect(0, 0, w, h);
    const col = { water: '#16405a', mountain: '#6d6a75', hills: '#7a7a52', forest: '#3f6a3f', jungle: '#2f6a3a', desert: '#b69a5e', tundra: '#a9b6bd', swamp: '#4d6048', canyon: '#b0582e', plains: '#6a8a4c' };
    for (const [x, y, t] of pts) { if (t.t === 'water' && t.deep) continue; c.fillStyle = col[t.t] || '#6a8a4c'; c.beginPath(); c.arc(ox + (x - x0) * sc, oy + (y - y0) * sc, sc * 0.62, 0, Math.PI * 2); c.fill(); }
    return cv.toDataURL();
  }
  function archThumb(a, n) { const k = a + n; if (!thumbCache[k]) thumbCache[k] = mapThumb(E.generateMap({ seed: 9100 + Object.keys(ARCH_NAME).indexOf(a), nPlayers: n, size: 'small', archetype: a }).tiles); return thumbCache[k]; }
  async function showMapReel(state) {
    const arch = state.map.arch, n = state.players.length, archs = Object.keys(ARCH_NAME);
    const box = el('div', '', ''); box.id = 'mapReel'; document.body.appendChild(box);
    box.innerHTML = `<h2>ROLLING THE BATTLEFIELD</h2><div class="mr-window"><div class="mr-strip"></div><div class="mr-mark"></div></div><div class="mr-name">&nbsp;</div>`;
    const strip = box.querySelector('.mr-strip'), cells = [], land = 22;
    for (let i = 0; i < 28; i++) {
      const a = i === land ? arch : archs[(i * 5 + Math.floor(Math.random() * 6)) % archs.length];
      const cell = el('div', 'mr-cell', `<img src="${i === land ? mapThumb(state.map.tiles) : archThumb(a, n)}" alt=""><span>${ARCH_NAME[a].toUpperCase()}</span>`);
      strip.appendChild(cell); cells.push(cell);
    }
    await sleep(60);
    const cw = 176, win = box.querySelector('.mr-window').clientWidth, off = land * cw - (win / 2 - cw / 2);
    const t0 = performance.now(), dur = 2600; let last = -1;
    await new Promise(res => { const stepF = () => { const p = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - p, 4); strip.style.transform = `translateX(${-off * e}px)`; const idx = Math.floor((off * e + win / 2) / cw); if (idx !== last) { last = idx; SFX.chip(idx % 10); } if (p < 1) requestAnimationFrame(stepF); else res(); }; stepF(); });
    cells[land].classList.add('won'); SFX.victoryHit(); Render.shake(6);
    box.querySelector('.mr-name').innerHTML = `<b>${ARCH_NAME[arch].toUpperCase()}</b>`;
    await sleep(1500);
    box.classList.add('out'); setTimeout(() => box.remove(), 500);
  }

  // stacked share of the land per round, with the moments the lead changed hands
  function drawPower(cv, hist, players) {
    if (!cv || hist.length < 2) { if (cv) cv.parentNode.hidden = true; return; }
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, padL = 50, padR = 20, padT = 20, padB = 46;
    const iw = W - padL - padR, ih = H - padT - padB, n = hist.length;
    const X = i => padL + iw * i / (n - 1);
    const tot = h => Math.max(1, players.reduce((a, p) => a + (h.c[p.id] || 0), 0));
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#0b1117'; c.fillRect(padL, padT, iw, ih);
    // stacked bands, bottom to top in player order
    const acc = hist.map(() => 0);
    for (const p of players) {
      const low = acc.slice(), high = hist.map((h, i) => acc[i] + (h.c[p.id] || 0) / tot(h));
      c.beginPath();
      hist.forEach((h, i) => { const y = padT + ih * (1 - high[i]); i ? c.lineTo(X(i), y) : c.moveTo(X(i), y); });
      for (let i = n - 1; i >= 0; i--) c.lineTo(X(i), padT + ih * (1 - low[i]));
      c.closePath(); c.fillStyle = p.color; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
      c.strokeStyle = '#0b1117'; c.lineWidth = 2; c.stroke();
      high.forEach((v, i) => { acc[i] = v; });
    }
    // grid + axis
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.font = '600 18px "Chakra Petch", sans-serif'; c.fillStyle = '#7f8c98'; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const f of [0, 0.25, 0.5, 0.75, 1]) { const y = padT + ih * (1 - f); c.beginPath(); c.moveTo(padL, y); c.lineTo(padL + iw, y); c.stroke(); c.fillText(Math.round(f * 100) + '%', padL - 8, y); }
    c.textAlign = 'center'; c.textBaseline = 'top';
    const step = Math.max(1, Math.ceil(n / 12));
    for (let i = 0; i < n; i += step) c.fillText('R' + hist[i].r, X(i), padT + ih + 8);
    // lead changes
    const notes = []; let lead = null;
    hist.forEach((h, i) => {
      const top = players.slice().sort((a, b) => (h.c[b.id] || 0) - (h.c[a.id] || 0))[0];
      if (!top || !(h.c[top.id] > 0)) return;
      if (lead && top.id !== lead) {
        c.strokeStyle = '#fff'; c.setLineDash([6, 6]); c.lineWidth = 2; c.beginPath(); c.moveTo(X(i), padT); c.lineTo(X(i), padT + ih); c.stroke(); c.setLineDash([]);
        c.fillStyle = top.color; c.beginPath(); c.arc(X(i), padT + 12, 9, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 3; c.stroke();
        notes.push(`<span><i style="background:${top.color}"></i>Round ${h.r}: <b style="color:${top.color}">${esc(top.name)}</b> takes the lead</span>`);
      }
      lead = top.id;
    });
    const n0 = $('#powerNotes'); if (n0) n0.innerHTML = notes.length ? notes.slice(-6).join('') : '<span>One commander led from start to finish.</span>';
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
  $('#muteBtn').onclick = () => { const m = SFX.toggle(); setTimeout(menuMusic, 50); $('#muteBtn').textContent = m ? '✕' : '♪'; };
  $('#muteBtn').textContent = SFX.muted ? '✕' : '♪';

  function showRules() {
    const r = $('#rules');
    r.innerHTML = `<div class="panel rules-card"><h2>HOW TO PLAY SECTOR</h2>
    <p>Grab land, build an economy, crush your rivals. <b>Every hex you hold pays you</b>, so sitting still is losing.</p>
    <div class="grid2"><div>
    <h4>YOUR TURN</h4>
    <b>1. Resupply</b> — flip 3 cards: take one <i>plus half your income</i>, or skip them for the full income. Reroll for cash.<br>
    <b>2. Act</b> — deploy (hotbar <kbd>1</kbd>–<kbd>0</kbd>), build (<kbd>Z</kbd>–<kbd>M</kbd>), move, attack, play tactics, trade — any order.<br>
    <b>3. End turn.</b>
    <h4>INCOME</h4>
    $3 base + $1 per 3 hexes + $2 per resource node ◆ + refineries & markets. Hexes <b>cut off</b> from your HQ / FOB / Port network (hatched) pay nothing — protect your supply lines.
    <h4>ENCIRCLEMENT</h4>
    Completely surround a pocket of land (≤10 hexes, no enemy troops or bases inside) and it's <b>annexed</b> automatically.
    <h4>MOVING</h4>
    Units move once per turn and <b>seize every unclaimed hex they pass through</b>. Highlands, jungle, tundra and swamp cost 2 move. Ruins, caches, villages, forts and relics are worth grabbing. Mountains and water block (drones fly, hover tanks glide). Max 5 units per hex (10 if they are all Grunts). Freshly deployed units wait a turn.
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
    <h4>CARDS</h4> <b>Units</b> form your deck (max 10): deploy as many as you can afford. Pull a unit you already own and it levels up (★ +1 ATK/DEF, max ★★★). Deck full? Replace a card. <b>Tactics</b> are single-use. <b style="color:var(--gold)">Legendaries are unique</b>: only one exists until it's spent or its owner falls.
    <h4>TRADING</h4> On your turn click <b>TRADE</b> under a rival's name: offer cash/cards for cash. They accept or decline.
    <h4>CONTROLS</h4> <kbd>1</kbd>–<kbd>0</kbd> deploy · <kbd>Z</kbd>–<kbd>M</kbd> build · <kbd>Click</kbd> select / order · <kbd>Right-click</kbd> cancel · <kbd>Drag</kbd> / <kbd>WASD</kbd> pan · <kbd>Wheel</kbd> zoom · <kbd>F</kbd> find HQ · <kbd>Enter</kbd> chat
    </div></div>
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn big red" id="rulesClose">GOT IT</button></div></div>`;
    r.hidden = false; $('#rulesClose').onclick = () => { r.hidden = true; SFX.click(); };
  }
  $('#rulesBtn').onclick = showRules; $('#rulesBtn2').onclick = showRules;
  for (const b of ['#indexBtn', '#indexBtn2', '#indexBtn3']) $(b).onclick = () => { SFX.select(); Cards.showIndex(); };

  window.SECTOR_DEBUG = { resume: () => pump(), refresh: () => refreshAll(), victoryFx: () => showVictory(), crushFx: ev => obliterate(ev), combatFx: ev => showCombat(ev), send, state: () => S, you: () => you, plan: () => plan, planState: () => planState, act: doAction, click: onHexClick };
  connect();
})();
