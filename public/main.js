/* SECTOR — client */
(() => {
  const E = SectorEngine;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const sleep = ms => new Promise(r => setTimeout(r, ms * speed()));
  let fastForward = false;
  // World War: other commanders' turns play at double speed so the huge map keeps moving
  const gameSpeed = () => { if (!S || !S.settings) return 'fast'; if (S.players.filter(p => p.alive).every(p => p.bot)) return S.settings.botSpeed || 'super'; return S.settings.speed || 'fast'; };
  const PACE = { normal: 1, fast: 0.7, super: 0.25, max: 0.06 };
  const speed = () => document.hidden ? 0.02 : fastForward ? 0.12 : evBy !== you ? Math.min(S && S.settings && S.settings.mode === 'worldwar' ? 0.5 : 1, PACE[gameSpeed()] || 1) : 1;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ───────────── app state ─────────────
  let ws = null, you = null, token = null, lobby = null, S = null, spectator = false;
  let msgQ = [], processing = false, animating = false;
  const pending = new Map(); let seq = 1;
  let sel = null;            // { hex, units:Set }
  let mode = null;           // {type:'deploy', unit} | {type:'tactic', uid, id, from}
  let plan = []; let planState = null; let planAuto = true; let executing = false;
  // march orders: standing multi-turn moves. Each turn the stack advances toward its objective by itself,
  // and halts on contact or on arrival (so a big army doesn't need every stack moved by hand)
  let marches = {}, marchKey = '';
  let undoCount = 0;
  let enterArm = 0, lastAnimEnd = 0, localDeadline = 0, lastTick = 0, clockPaused = false, pausedLeft = 0;
  const plans = {}; // pass & play: every local seat keeps its own blueprint
  let qid = -1;      // placeholder ids for units deployed inside a blueprint
  const remap = (a, m) => a.a === 'move' ? { ...a, units: a.units.map(id => m[id] || id) } : a;
  let hoverK = null;
  // a phone or tablet: fingers, not a mouse (see the touch layer by the map's input handlers)
  const isTouchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (isTouchDevice) document.body.classList.add('touch');
  // phones play in landscape: lock the screen there where the system lets a page do it (installed app, fullscreen)
  // phones: the first tap goes full screen (no browser bars) and locks landscape. Android only locks the orientation in full
  // screen; an installed app already is. iPhones can't do either from a web page, so there the "turn sideways" screen does the job
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  if (isTouchDevice) addEventListener('pointerdown', () => {
    const lock = () => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) {} };
    const de = document.documentElement;
    if (!standalone && de.requestFullscreen && !document.fullscreenElement) de.requestFullscreen({ navigationUI: 'hide' }).then(lock, lock); else lock();
  }, { once: true, passive: true });
  // the SECTOR phone app (it tags its user agent): a way back to its own start screen to pick another server
  const inApp = /SECTORApp/.test(navigator.userAgent);
  const toPicker = () => { location.href = (/iPhone|iPad|iPod/.test(navigator.userAgent) ? 'capacitor://localhost' : 'https://localhost') + '/?pick=1'; };
  if (inApp) {
    $('#escPick').hidden = false; $('#escPick').onclick = toPicker;
    const b = el('button', 'btn tiny', '⇄ SERVER'); b.title = 'Play on another server'; b.onclick = toPicker; $('#mmRight').prepend(b);
  }
  // installable app: the service worker (only on HTTPS or localhost; a LAN server over plain http just runs as a web page)
  if ('serviceWorker' in navigator && window.isSecureContext) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  let lastTurnKey = '';
  // your seat in a room survives a reload: the room's code and the seat's token
  let seat = null; try { seat = JSON.parse(localStorage.getItem('sector.seat') || 'null'); localStorage.removeItem('sector.token'); } catch (e) {}
  token = seat && seat.token;
  function keepSeat(room, tk) { seat = room && tk ? { room, token: tk } : null; try { seat ? localStorage.setItem('sector.seat', JSON.stringify(seat)) : localStorage.removeItem('sector.seat'); } catch (e) {} }
  // links: /?room=CODE joins a room, /?party=CODE joins a party (read once, then tidied out of the address bar)
  const qs = new URLSearchParams(location.search), urlRoom = (qs.get('room') || '').toUpperCase(), urlParty = (qs.get('party') || '').toUpperCase();
  // back from signing in with Google or Discord: a one-time code to collect, or what went wrong
  let loginCode = qs.get('login') || '', loginError = qs.get('loginError') || '';
  if (urlRoom || urlParty || loginCode || loginError) try { history.replaceState(null, '', location.pathname + (qs.get('watch') ? '?watch=1' : '')); } catch (e) {}
  let firstOpen = true, sessionStart = () => {};
  const typedName = () => $('#nameIn').value.trim() || savedName();
  const myName = () => typedName() || (Locker.profile && Locker.profile.name) || 'Commander';

  Render.init($('#map'));

  // ───────────── networking ─────────────
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    // ?watch=1 (the dev panel's SPECTATE link): watch the running game without joining it
    const watching = /[?&]watch=1/.test(location.search);
    ws.onopen = () => {
      if (loginCode) { send({ t: 'authClaim', code: loginCode }); loginCode = ''; return; }   // the rest follows authDone
      openSession();
    };
    function openSession() {
      // the front menu first (profile, online counts, party), then back into the room you were in, or the one a link points to
      send({ t: 'auth', name: typedName() || undefined, profile: Locker.identity(), ref: Locker.ref() });   // no callsign typed: keep the commander's own
      if (watching) send({ t: 'hello', watch: true, room: urlRoom || undefined });
      // an invite link to another room wins over the seat you had: you meant to go where the link points
      else if (seat && !(firstOpen && urlRoom && urlRoom !== seat.room)) send({ t: 'hello', room: seat.room, token: seat.token, name: myName() });
      else if (firstOpen && urlRoom) send({ t: 'join', code: urlRoom, name: myName() });
      if (firstOpen && urlParty) send({ t: 'partyJoin', code: urlParty, name: myName() });
      firstOpen = false;
      if (loginError) { toast(loginError, 'err'); loginError = ''; }
    }
    sessionStart = openSession;
    ws.onmessage = ev => onMsg(JSON.parse(ev.data));
    ws.onclose = () => { if (closedFor) return; toast('Connection lost — reconnecting…', 'err'); setTimeout(connect, 1500); };
  }
  let joinedOnce = false, leftGame = false;
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  function savedName() { try { return localStorage.getItem('sector.name') || ''; } catch (e) { return ''; } }

  function onMsg(m) {
    if (Home.onMsg(m)) return;
    switch (m.t) {
      case 'welcome':
        { const tookOver = S && !myP() && m.you; you = m.you; realId = m.you; spectator = !!m.spectator; if (tookOver) { toast('You have taken command!', 'leg'); SFX.legendary(); } }
        if (m.token) { token = m.token; if (lobby && lobby.code) keepSeat(lobby.code, token); }
        joinedOnce = true; leftGame = false;
        break;
      case 'lobby': lobby = m.lobby; if (token && lobby.code) keepSeat(lobby.code, token); if (!S) renderLobby(); break;
      case 'authGo': location.href = m.url; break;   // off to Google or Discord
      case 'authDone':
        if (!m.ok) toast(m.msg || 'Sign-in failed', 'err');
        else {
          if (m.identity) { Locker.setIdentity(m.identity); keepSeat(null); token = null; $('#nameIn').value = ''; try { localStorage.removeItem('sector.name'); } catch (e) {} }   // this login already had a commander: play that one, under its own name
          toast('✔ Signed in with ' + ({ google: 'Google', discord: 'Discord' }[m.provider] || m.provider) + (m.name ? ' as ' + m.name : '') + (m.switched ? ': welcome back' : ': your progress is saved to this login'), 'good'); SFX.legendary();
          if (m.referral) setTimeout(() => Locker.reward({ referral: m.referral }), 900);   // joined with a friend's link: the welcome bonus
        }
        sessionStart(); break;
      case 'noRoom': {   // the room is gone (it closed, or the server restarted): a war on screen is dead, so go home
        const was = !!S; keepSeat(null); token = null; lobby = null; you = null; realId = null;
        if (was) { leftGame = true; backToMenu(); toast('That war has ended: the server was restarted', 'err'); } else { showHome(); if (m.code && m.code !== 'MAIN') toast('Room ' + m.code + ' has closed', 'err'); }
        break; }
      case 'profile': Locker.set(m.profile); if (m.bought || m.faction) Locker.unlock({ item: m.bought, faction: m.faction }); if (!$('#nameIn').value.trim() && m.profile.name) $('#nameIn').value = m.profile.name; Home.render(); if (lobby && !S) renderLobby();
        if (m.faction && E.FACTIONS[m.faction]) { toast('✔ ' + E.FACTIONS[m.faction].name + ' unlocked: pick it in any lobby', 'good'); SFX.legendary(); }
        if (m.bought) { toast('✔ ' + SectorCosmetics.ITEMS[m.bought].name + ' is yours', 'good'); SFX.legendary(); } break;
      case 'reward': Locker.set(m.profile); setTimeout(() => Locker.reward(m.reward), 1600); break;
      case 'boxOpened': Locker.boxOpened(m); break;
      case 'state': if (leftGame) break; msgQ.push(m); pump(); break;
      case 'err':
        if (m.seq && pending.has(m.seq)) { pending.get(m.seq)(false); pending.delete(m.seq); }
        // a code this server doesn't have, on a LAN server: probably a friend's room on their own server
        if (m.noRoom && !$('#lanRow').hidden) { findRoomOnLan(m.noRoom); break; }   // the LAN row only shows on a LAN server
        toast(m.msg, 'err'); SFX.error(); break;
      case 'serverClosed': serverClosed(m); break;
      case 'saved': toast('💾 Game saved. Resume it any time from the lobby.'); SFX.select(); break;
      case 'skipFx': if (curFight && curFight.att === m.att && curFight.to === m.to) fastForward = true; break;
      case 'battle': showBattle(m); break;
      case 'scenarioResult': {
        // the mission is decided the moment the last fight is won: let that fight and the troops moving in play out
        // first (a short beat after the animations finish), so the result never covers the capture
        const t0 = Date.now(), wait = () => (processing || msgQ.length || animating) && Date.now() - t0 < 15000 ? setTimeout(wait, 150) : setTimeout(() => Missions.result(m), 900);
        wait(); break;
      }
      case 'owPrompt': showOwPrompt(m); break;
      case 'owDone': { const r = $('#owPop'); if (r) r.remove(); break; }
      case 'notes': { const sig = JSON.stringify(m.notes || []); if (sig === notesSig) break; notesSig = sig; Render.ov.notes = (m.notes || []).flatMap(n => n.shapes.map(sh => ({ ...sh, pid: n.pid, color: pColor(n.pid) }))); Render.invalidate(); break; }   // only redraw the board when the marks changed
      case 'battleDone': { const r = $('#battlePop'); if (r) { r.classList.add('bp-out'); setTimeout(() => r.remove(), 220); } if (battleOpen) lastBattle = { key: battleOpen.key, at: Date.now() }; battleOpen = null; break; }
      case 'skipVote': if (curFight && curFight.att === m.att && curFight.to === m.to) skipStatus(m.pids); break;
      case 'ping': showPing(m); break;
      case 'emote': showEmote(m); break;
      case 'chat': addLog(`${m.team ? '<span class="tmtag">TEAM</span> ' : ''}<b style="--c:${m.color}">${esc(m.from)}:</b> ${esc(m.text)}`, m.bot ? 'chat botline' : 'chat'); if (!m.bot || Home.opts.botchat) SFX.click(); if (m.bot) botBubble(m); break;
      case 'left': { const inGame = !!S; leftGame = true; token = null; keepSeat(null); you = null; realId = null; joinedOnce = false; lobby = null; backToMenu(); if (inGame) toast('You left the game'); break; }
      case 'kicked': token = null; keepSeat(null); lobby = null;
        if (S) { leftGame = true; you = null; realId = null; joinedOnce = false; backToMenu(); toast('The host removed you from the game', 'err'); }
        else { you = null; toast('You were removed from the room', 'err'); showHome(); }
        break;
    }
  }

  async function pump() {
    if (processing) return; processing = true;
    while (msgQ.length) {
      if (window.SECTOR_PAUSE) break; // dev/screenshot hook: freeze incoming events
      const m = msgQ.shift();
      if (!m.state) { clearWarScreens(); S = null; you = realId || you; plan = []; sel = null; mode = null; Render.setState(null); showMenu(); continue; }   // the war ended: back to the lobby, with nothing of it left on screen
      if (m.seat && m.seat !== you) seatChange(m.seat, m.state);
      // pass & play: hide the hand while no local player is acting, so the next person can't peek
      document.body.classList.toggle('pp-idle', !!(m.state && localSeats().length && !needsAction(m.state, you)));
      undoCount = m.undo || 0;
      localDeadline = m.timeLeft ? Date.now() + m.timeLeft : 0; clockPaused = !!m.paused; pausedLeft = m.timeLeft || 0;
      if (!S || S.seed !== m.state.seed) { enterGame(m.state); }
      else {
        animating = true; fastForward = msgQ.length > 3;
        const mineBefore = S && S.units ? Object.values(S.units).filter(u => u.owner === you).map(u => ({ id: u.id, type: u.type, hex: u.hex })) : [];
        const gen = menuGen;
        try { await playEvents(m.events || [], m.by); } catch (e) { console.error(e); }
        animating = false; fastForward = false; lastAnimEnd = Date.now();
        if (gen !== menuGen || leftGame) continue;   // left the game mid-animation: don't paint the old board back under the menu
        reportLosses(mineBefore, m.state, m.events || []);
        if (m.paused && m.by && (m.by === you || m.mine)) send({ t: 'clockResume' });   // my fight finished playing: restart the turn clock
        applyState(m.state);
      }
      Missions.onState(S, m.events);   // missions: the mission bar, objectives and General Hale's script
      if (m.seq && (m.mine || m.by === you) && pending.has(m.seq)) { pending.get(m.seq)(true); pending.delete(m.seq); }
    }
    processing = false;
  }

  // tell the player plainly when they lose units, and why (so nothing just vanishes off-screen)
  function reportLosses(before, next, events) {
    if (!before.length || !next || !next.units) return;
    const lost = before.filter(u => !next.units[u.id]); if (!lost.length) return;
    const why = events.some(e => e.e === 'drown') ? 'lost at sea' : events.some(e => e.e === 'evicted') ? 'cut off when a pact ended' : events.some(e => e.e === 'crash') ? 'went down with their transport' : events.some(e => e.e === 'tactic') ? 'hit by an enemy strike' : events.some(e => e.e === 'combat' || e.e === 'fogstop') ? 'killed in battle' : events.some(e => e.e === 'eliminate') ? 'lost with your HQ' : 'destroyed';
    const names = {}; for (const u of lost) names[E.UNITS[u.type].name] = (names[E.UNITS[u.type].name] || 0) + 1;
    toast('💀 Lost ' + Object.entries(names).map(([n, c]) => (c > 1 ? c + '× ' : '') + n).join(', ') + ' — ' + why, 'err');
    const at = lost[0].hex; if (at && S && S.map.tiles[at]) Render.ring(at, '#ff4f5e', 50, 0.8, 4);
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
  const menuMusic = () => { if (!$('#menu').hidden && !SFX.muted && Home.opts.music) SFX.music.start(); else SFX.music.stop(); };
  window.SECTOR_MUSIC = () => setTimeout(menuMusic, 50);
  addEventListener('pointerdown', () => setTimeout(menuMusic, 50), { passive: true });
  addEventListener('keydown', () => setTimeout(menuMusic, 50));
  function showMenu() { setTimeout(menuMusic, 50); $('#menu').hidden = false; $('#hud').hidden = true; $('#victory').hidden = true; $('#supply').hidden = true; if (lobby) renderLobby(); }
  // your faction and colour follow you from room to room (the room may already have someone in that colour)
  const prefs = () => { try { return JSON.parse(localStorage.getItem('sector.pref') || '{}'); } catch (e) { return {}; } };
  const savePref = o => { try { localStorage.setItem('sector.pref', JSON.stringify({ ...prefs(), ...o })); } catch (e) {} };
  let prefsFor = '';
  function applyPrefs(me) {
    const key = lobby.code + ':' + me.id; if (prefsFor === key || lobby.inGame) return; prefsFor = key;
    const p = prefs(), want = {};
    if (p.faction && E.FACTIONS[p.faction] && me.faction !== p.faction) want.faction = p.faction;
    if (p.color && me.color !== p.color && !lobby.players.some(x => x.color === p.color && x.id !== me.id && !x.bot)) want.color = p.color;
    if (Object.keys(want).length) send({ t: 'me', ...want });
  }
  // the front page (not in a room) and the room lobby take turns on the menu screen
  // the front page's backdrop: a freshly generated war map drifting slowly behind the panels
  let backdrop = null;
  function startBackdrop() {
    if (S || backdrop) return;
    try {
      const facs = Object.keys(E.FACTIONS), roster = ['#ff4f5e', '#36c9ff', '#ffc53d', '#59f08a', '#b06cff'].map((color, i) => ({ id: 'd' + i, name: '', color, faction: facs[i % facs.length], bot: true }));
      const st = E.createGame({ mode: 'domination', mapSize: 'medium', spawns: 'random', fog: 'off', events: 'off', seed: 'menu' + Math.floor(Math.random() * 1e6) }, roster).state;
      // each commander already holds a patch around their HQ
      for (const p of st.players) if (p.hq) for (const k of E.area(p.hq, 3)) { const t = st.map.tiles[k]; if (t && E.isLandTile(t) && !t.owner) t.owner = p.id; }
      st.units = {};   // just the land: no troops, no labels
      backdrop = { st };
      Render.setState(st); Render.fitMap && Render.fitMap();
    } catch (e) { console.warn('menu backdrop', e); backdrop = null; }
  }
  // the backdrop belongs to the front page only: rooms and games get a clean board
  function stopBackdrop() { if (!backdrop) return; backdrop = null; if (!S) Render.setState(null); }
  function showHome() { startBackdrop(); document.body.classList.add('at-home'); $('#home').hidden = false; $('#lobbyBox').hidden = true; $('#roomBar').hidden = true; $('#lobbyBox').dataset.show = ''; document.body.classList.remove('in-room'); Home.shown(); }
  $('#nameIn').value = savedName();
  const keepName = () => { const n = myName(); try { localStorage.setItem('sector.name', n); } catch (e) {} return n; };
  $('#nameIn').addEventListener('change', () => { send({ t: 'partyRename', name: keepName() }); Home.render(); });
  $('#nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#playBtn').click(); });
  const go = msg => { joinedOnce = true; leftGame = false; SFX.select(); send({ ...msg, name: keepName(), profile: Locker.identity(), ref: Locker.ref() }); };
  $('#playBtn').onclick = () => go({ t: 'quick' });
  $('#createBtn').onclick = () => go({ t: 'create' });
  $('#soloBtn').onclick = () => go({ t: 'solo' });
  $('#codeGo').onclick = () => { const code = $('#codeIn').value.trim().toUpperCase(); if (code.length < 4) { toast('Enter a room or party code', 'err'); SFX.error(); return; } go({ t: 'join', code }); $('#codeIn').value = ''; };
  $('#codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#codeGo').click(); });
  $('#codeIn').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  // LAN servers: the classic lobby everyone on this address shares
  $('#joinBtn').onclick = () => go({ t: 'hello' });
  // in a room: its code (or the public countdown) and the way back out
  function renderRoomBar() {
    const rb = $('#roomBar'); rb.hidden = false;
    const pub = lobby.kind === 'public', main = lobby.code === 'MAIN', link = location.origin + '/?room=' + lobby.code;
    const key = [lobby.code, lobby.kind, lobby.inGame, lobby.solo].join(); if (rb.dataset.key === key) return; rb.dataset.key = key;
    // public: anyone pressing PLAY can land here until it deploys · private: only people with the code or link
    rb.innerHTML = `<div class="rb-kind${pub ? ' pub' : lobby.solo ? ' solo' : ''}">${pub ? 'PUBLIC WAR' : main ? 'LAN LOBBY' : lobby.solo ? 'SINGLEPLAYER' : 'PRIVATE ROOM'}</div>` + (main ? '<div class="rb-code"><span class="sub">Everyone who opens this server’s address lands here</span></div>'
      : `<div class="rb-code"><span>CODE</span><b>${esc(lobby.code)}</b><button class="btn tiny" id="rbCopy">${lobby.solo ? '🔗 INVITE A FRIEND' : '🔗 COPY INVITE LINK'}</button><span class="sub">${pub ? 'open: anyone who presses PLAY can join until it deploys' : lobby.solo ? 'you against bots · a friend can join any time and take over a bot' : 'invite only'}</span></div>`) + `<button class="btn" id="rbLeave">◂ LEAVE</button>`;
    const cp = $('#rbCopy'); if (cp) cp.onclick = () => { copyText(link).then(ok => ok && toast('Invite link copied')); SFX.click(); };
    $('#rbLeave').onclick = () => { SFX.click(); send({ t: 'leave' }); };
  }

  let dragPid = null;   // the lobby row being dragged to another team
  function renderLobby() {
    if (!lobby) return;
    if (dragPid) return;   // don't rebuild the list under a drag in progress
    const me = lobby.players.find(p => p.id === (realId || you));
    if (!me) { if (!spectator && !S) showHome(); return; }   // someone watching a war has no seat in its lobby, and stays on the war
    $('#home').hidden = true; $('#lobbyBox').hidden = false; $('#lobbyBox').dataset.show = '1'; document.body.classList.add('in-room'); document.body.classList.remove('at-home'); stopBackdrop();
    applyPrefs(me);
    renderRoomBar();
    const host = lobby.hostId === you, pub = lobby.kind === 'public';
    { const sp = lobby.players.filter(p => p.spectator).length; $('#pCount').textContent = (lobby.players.length - sp) + '/' + (lobby.cap || 8) + (sp ? ' · ' + sp + ' watching' : ''); }
    // public wars: hosted like any room, but no ready-up, no shared-screen players and no missions; bots fill the empty seats on DEPLOY
    $('#addBot').parentElement.hidden = !host && pub; $('#addLocal').hidden = pub; $('#lanBox').hidden = pub || lobby.code !== 'MAIN';   // missions live on the front page
    const pl = $('#playerList'); pl.innerHTML = '';
    const teamsOn = lobby.settings.teams === 'on';
    const canMove = p => host || p.id === realId || (p.local && p.controller === realId);
    // teams: the list becomes one column per team, and names are dragged between them
    const cols = {};
    if (teamsOn) {
      const used = Math.max(2, ...lobby.players.filter(p => !p.spectator).map(p => p.team || 1));
      const shown = Math.min(4, used + (lobby.players.filter(p => !p.spectator).length > used ? 1 : 0));
      const wrap = el('div', 'teamcols'); pl.appendChild(wrap);
      for (let tm = 1; tm <= shown; tm++) {
        const n = lobby.players.filter(p => !p.spectator && (p.team || 1) === tm).length;
        const col = el('div', 'teamcol t' + tm, `<div class="tc-h"><span class="tc-dot"></span>TEAM ${'ABCD'[tm - 1]} · ${E.TEAM_NAMES[tm].toUpperCase()}<small>${n || 'drop a name here'}</small></div>`);
        col.style.setProperty('--tc', E.TEAM_COLORS[tm][0]);
        col.ondragover = e => { if (dragPid) { e.preventDefault(); col.classList.add('over'); } };
        col.ondragleave = () => col.classList.remove('over');
        col.ondrop = e => { e.preventDefault(); col.classList.remove('over'); const id = dragPid; dragPid = null; if (id) { SFX.click(); send({ t: 'team', id, team: tm }); } };
        wrap.appendChild(col); cols[tm] = col;
      }
    }
    const nth = {};
    for (const p of lobby.players) {
      const r = el('div', 'prow' + (p.connected ? '' : ' off') + Locker.bannerClass(p.cos));
      const f = E.FACTIONS[p.faction];
      const tmc = teamsOn && !p.spectator ? E.teamColor(p.team || 1, nth[p.team || 1] = (nth[p.team || 1] ?? -1) + 1) : null;   // the colour they'll play in
      r.innerHTML = `<div class="sw" style="background:${tmc || p.color}"></div><div class="nm">${esc(p.name)}<div class="fx">${f ? f.name : ''}</div></div>` +
        (p.id === lobby.hostId ? '<span class="tag host">HOST</span>' : '') + (p.bot ? '<span class="tag">BOT</span>' : '') + (p.id === you ? '<span class="tag">YOU</span>' : '') +
        (!p.bot && !p.local && !p.spectator && p.id !== lobby.hostId && lobby.kind !== 'public' ? (p.ready ? '<span class="tag ready">✔ READY</span>' : '<span class="tag notready">NOT READY</span>') : '');
      if (p.spectator) { r.classList.add('spec'); const fx = r.querySelector('.fx'); if (fx) fx.textContent = '👁 Spectating'; }
      if (p.handle && !p.local) { const nm = r.querySelector('.nm'); nm.classList.add('linked'); nm.title = 'View profile'; nm.onclick = () => Home.profile(p.handle); }
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
      if (teamsOn && !p.spectator) {
        // drag the row to another team's column (or tap the chip to send it to the next team)
        const tm = p.team || 1, can = canMove(p), nTeams = Object.keys(cols).length;
        const tb = el('button', 'teamchip t' + tm, '⇄'); tb.disabled = !can;
        tb.title = can ? 'Move to the next team (or drag the name)' : '';
        tb.onclick = () => { SFX.click(); send({ t: 'team', id: p.id, team: tm % Math.max(2, nTeams) + 1 }); };
        r.insertBefore(tb, r.querySelector('.tag'));
        if (can) { r.draggable = true; r.classList.add('drag'); r.ondragstart = e => { dragPid = p.id; r.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; } catch (err) {} }; r.ondragend = () => { dragPid = null; r.classList.remove('dragging'); }; }
      }
      if ((host && p.id !== you) || (p.local && p.controller === realId)) { const x = el('button', 'x', '✕'); x.onclick = () => send({ t: 'kick', id: p.id }); r.appendChild(x); }
      (teamsOn && !p.spectator ? cols[p.team || 1] || pl : pl).appendChild(r);
    }
    $('#addBot').hidden = !host;
    $('#lanBox').innerHTML = lobby.lan.length ? 'Friends on your network join at:<br>' + lobby.lan.map(u => `<b>${u}</b>`).join('<br>') : 'No network address found: local play only.';
    const fl = $('#factionList'); fl.innerHTML = '';
    // only the factions you've unlocked; the rest wait in the Store
    const owned = Locker.profile && Locker.profile.factions ? Locker.profile.factions : Object.keys(E.FACTIONS);
    for (const id of Object.keys(E.FACTIONS).filter(k => owned.includes(k))) {
      const f = E.FACTIONS[id], d = el('div', 'fac' + (me.faction === id ? ' on' : ''));
      d.innerHTML = `<img src="${Art.iconURL('glyph', f.glyph, me.faction === id ? me.color : '#8fa1b3')}"><div><div class="fn">${f.name}</div><div class="fp"><b>${f.perk}:</b> ${f.desc}<br>Starts with <b>${E.UNITS[f.starter].name}</b></div></div>`;
      d.onclick = () => { SFX.select(); savePref({ faction: id }); send({ t: 'me', faction: id }); };
      fl.appendChild(d);
    }
    { const locked = Object.keys(E.FACTIONS).length - owned.length;
      if (locked > 0) { const u = el('div', 'fac-more', `<span>🔒 <b>${locked}</b> more faction${locked > 1 ? 's' : ''} to unlock</span><button class="btn tiny gold">STORE</button>`); u.querySelector('button').onclick = () => { SFX.select(); Locker.show('store', 'factions'); }; fl.appendChild(u); } }
    const cl = $('#colorList'); cl.innerHTML = ''; cl.classList.toggle('teamlock', teamsOn); cl.title = teamsOn ? 'Teams play in team colours' : '';
    for (const c of E.COLORS) {
      const taken = lobby.players.some(p => p.color === c && p.id !== you && !p.bot && !(p.local && p.controller === realId));
      const d = el('div', 'c' + (me.color === c ? ' on' : '') + (taken ? ' taken' : '')); d.style.background = c;
      if (!taken) d.onclick = () => { SFX.click(); savePref({ color: c }); send({ t: 'me', color: c }); };
      cl.appendChild(d);
    }
    const st = lobby.settings;
    for (const [id, k] of [['#setMode', 'mode'], ['#setType', 'mapType'], ['#setTheme', 'theme'], ['#setSize', 'mapSize'], ['#setSpawns', 'spawns'], ['#setFog', 'fog'], ['#setEvents', 'events'], ['#setTimer', 'timer'], ['#setRounds', 'maxRounds'], ['#setSeed', 'seed'], ['#setTeams', 'teams'], ['#setSpeed', 'speed'], ['#setBank', 'bank'], ['#setPersonas', 'personas']]) {
      const e = $(id); if (document.activeElement !== e) e.value = st[k] ?? ''; e.disabled = !host;
    }
    $('#startBtn').hidden = !host; $('#waitHost').hidden = host;
    renderSaves(host);
    // ready-up: guests toggle READY; the host's DEPLOY waits until every guest is ready
    const meRow = lobby.players.find(p => p.id === realId);
    const waiting = pub ? [] : lobby.players.filter(p => !p.bot && !p.local && !p.spectator && !p.ready && p.id !== lobby.hostId);
    const rb = $('#readyBtn');
    rb.hidden = host || !meRow || meRow.spectator || pub;
    if (meRow) { rb.textContent = meRow.ready ? '✔ READY — CLICK TO CANCEL' : 'READY UP'; rb.classList.toggle('green', !meRow.ready); rb.classList.toggle('on', !!meRow.ready); }
    $('#startBtn').classList.toggle('waiting', waiting.length > 0);
    $('#startBtn').textContent = waiting.length ? 'WAITING FOR ' + waiting.length + ' TO READY' : 'DEPLOY';
    $('#startBtn').title = waiting.length ? 'Not ready: ' + waiting.map(p => p.name).join(', ') : '';
    const hostName = (lobby.players.find(p => p.id === lobby.hostId) || {}).name || 'the host';
    $('#waitHost').textContent = pub ? 'Waiting for ' + hostName + ' to deploy · bots fill the empty seats' : meRow && meRow.ready ? 'Ready! Waiting for the host to start…' : 'Ready up so the host can start.';
    if (pub) $('#startBtn').title = 'Bots fill the empty seats';
  }
  // saved wars: the host can resume one; whoever's here with a matching name gets their seat back
  function renderSaves(host) {
    const box = $('#saveBox'), list = lobby.saves || [];
    box.hidden = !host || !list.length; if (box.hidden) return;
    $('#saveCount').textContent = list.length + '/' + (lobby.saveCap || 5) + (list.length >= (lobby.saveCap || 5) ? ' · a new war replaces the oldest' : '');
    const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
    const key = JSON.stringify(list.map(s => [s.id, s.savedAt]));
    if (box.dataset.key === key) return; box.dataset.key = key;
    $('#saveList').innerHTML = list.slice(0, 8).map(s => `<div class="save-row"><div class="sv-t"><b>${esc(s.title)}</b><div class="sub">${ago(s.savedAt)}${s.humans.length ? ' · players: ' + esc(s.humans.join(', ')) : ''}</div></div><button class="btn tiny green" data-load="${esc(s.id)}">RESUME</button><button class="btn tiny x" data-drop="${esc(s.id)}" title="Delete this save">✕</button></div>`).join('');
    $('#saveList').querySelectorAll('[data-load]').forEach(b => b.onclick = () => { SFX.select(); send({ t: 'loadSave', id: b.dataset.load }); });
    $('#saveList').querySelectorAll('[data-drop]').forEach(b => b.onclick = () => {
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'DELETE?'; setTimeout(() => { b.dataset.armed = ''; b.textContent = '✕'; }, 2500); return; }
      SFX.click(); send({ t: 'dropSave', id: b.dataset.drop });
    });
  }
  for (const [id, k] of [['#setMode', 'mode'], ['#setType', 'mapType'], ['#setTheme', 'theme'], ['#setSize', 'mapSize'], ['#setSpawns', 'spawns'], ['#setFog', 'fog'], ['#setEvents', 'events'], ['#setTimer', 'timer'], ['#setRounds', 'maxRounds'], ['#setSeed', 'seed'], ['#setTeams', 'teams'], ['#setSpeed', 'speed'], ['#setBank', 'bank'], ['#setPersonas', 'personas']])
    $(id).addEventListener('change', e => send({ t: 'settings', settings: { [k]: e.target.value } }));
  $('#addBot').onclick = () => { SFX.click(); send({ t: 'addBot' }); };
  $('#addLocal').onclick = () => { SFX.click(); send({ t: 'addLocal' }); };
  $('#startBtn').onclick = () => { SFX.select(); send({ t: 'start' }); };
  $('#readyBtn').onclick = () => { const me = lobby && lobby.players.find(p => p.id === realId); SFX.select(); send({ t: 'ready', on: !(me && me.ready) }); };

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
    stopBackdrop(); document.body.classList.remove('at-home'); $('#home').hidden = true; document.body.classList.remove('in-room');
    S = state; plan = []; for (const k in plans) delete plans[k]; sel = null; mode = null; lastTurnKey = ''; marches = {}; marchKey = '';
    SFX.music.stop();
    if (state.settings && (state.settings.mapType === 'random' || state.settings.theme === 'random') && (state.phase === 'draft' || state.phase === 'spawn')) showMapReel(state);
    $('#menu').hidden = true; $('#hud').hidden = false; $('#victory').hidden = true;
    Render.setState(state);
    const me = myP();
    if (state.scenario) {
      // a mission board is small: show all of it, in the space the HUD leaves free (under the banner and mission bar,
      // above the build bar and deck), so the objective is never off screen
      const fit = () => { const cs = $('#centerStack').getBoundingClientRect(); Render.fitMap({ l: 40, r: 40, t: Math.max(150, cs.bottom + 30), b: 200 }); };
      fit(); setTimeout(fit, 350);
    } else {
      Render.fitMap();
      if (me && me.hq) setTimeout(() => Render.focus(me.hq, Math.max(Render.cam.z, 1.05)), 300);
    }
    $('#log').innerHTML = ''; for (const l of state.log.filter(logWorthy).slice(-30)) addLog(esc(l));
    applyState(state, true);
  }

  const myP = () => S && S.players.find(p => p.id === you);
  const curP = () => S && S.players[S.turn.idx];
  const isMyTurn = () => !!S && S.phase === 'play' && curP() && curP().id === you;
  const planning = () => !!S && S.phase === 'play' && !isMyTurn() && myP() && myP().alive;
  const draftPhase = () => !!S && S.phase === 'draft';
  const canPlace = () => planning() || (isMyTurn() && S.turn.stage === 'act' && !executing);
  const canCommand = () => (isMyTurn() && S.turn.stage === 'act' && !animating && !executing) || planning();
  const BP_BLUE = '#8fdcff';   // blueprint orders
  const dispState = () => planning() && planState && !animating ? planState : S;
  const pName = id => { const p = S.players.find(x => x.id === id); return p ? p.name : '?'; };
  const pColor = id => { const p = S.players.find(x => x.id === id); return p ? p.color : '#aaa'; };

  // the log keeps headlines only: falls, sieges, pacts, nukes, wins, and fights that involve you
  const LOG_ALWAYS = ['☠', '🏆', '🔥', '🤝', '🗡', '☢', '⛔', '🚪', '🛰', '💔', '🃏', '🚀', 'Draft complete'];
  function logWorthy(l) {
    if (LOG_ALWAYS.some(p => l.startsWith(p)) || l.includes('★')) return true;   // ★: someone picked up an epic-or-better card
    const me = myP(); return !!me && l.includes(me.name) && /^(⚔|💥|⭕|🧨|🏴|⚡|💣|✈)/u.test(l);
  }
  function applyState(state, initial) {
    const prevCash = myP() ? myP().cash : null;
    S = state;
    const log = state.log || [];
    if (!initial) { const i = log.lastIndexOf(applyState.lastLog); for (const l of log.slice(i >= 0 ? i + 1 : -3)) if (logWorthy(l)) addLog(esc(l)); }
    applyState.lastLog = log[log.length - 1];
    chatMode(); if (!$('#teamPanel').hidden) renderTeam();
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
    if (isMyTurn() && S.turn.stage === 'act' && marchKey !== tk && !executing && !plan.length && Object.keys(marches).length) { marchKey = tk; setTimeout(runMarches, 400); }
    renderSpawnPick();
    if (S.phase === 'draft') Cards.showDraft(S, you, (idx, replace) => act({ a: 'draftPick', idx, replace })); else Cards.hideDraft();
    const me2 = myP();
    if (isMyTurn() && prepOpen) prepOpen = false;   // your turn started: the real resupply takes over
    if (isMyTurn() && S.turn.stage === 'choose' && me2 && !executing && !(plan.length && planAuto) && passReady())
      Cards.openSupply({ me: me2, offer: S.turn.offer, income: S.turn.income, round: S.turn.round, rerollCost: E.rerollCost(S), refund: E.payout(S, you, 4), key: S.turn.round + ':' + S.turn.idx + ':' + S.turn.rerolls,
        onPick: pickFromSupply, onIncome: async () => { const ok = await act({ a: 'choose', pick: 'income' }); if (ok && plan.length) runPlan(); return ok; }, onReroll: () => act({ a: 'reroll' }) });
    else if (!prepOpen || isMyTurn()) { prepOpen = false; Cards.closeSupply(); }
    if (isMyTurn() && S.turn.stage === 'crate' && S.turn.crate && !S.turn.crate.hidden && me2 && passReady())
      Cards.openCrate({ crate: S.turn.crate, me: me2, scrap: E.payout(S, you, E.SCRAP_VALUE), refund: E.payout(S, you, 4), serial: S.turn.round + ':' + S.turn.idx + ':' + me2.stats.crates, onPick: pickFromCrate, onScrap: scrapCrate });
    else Cards.closeCrate();
    if (S.phase === 'over') showVictory();
  }

  // pick-your-HQ phase: highlight the legal hexes and wait for a click
  const mySpawnPick = () => !!S && S.phase === 'spawn' && S.spawn && S.spawn.order[S.spawn.i] === you && passReady();
  function renderSpawnPick() {
    let b = $('#spawnBar');
    if (!S || S.phase !== 'spawn' || !S.spawn) { if (b) b.remove(); return; }
    if (!b) { b = el('div', '', ''); b.id = 'spawnBar'; $('#centerStack').appendChild(b); }
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

  function marchOrder(hex, units, to) {
    const ids = [...units]; if (!ids.length || hex === to) return;
    for (const k in marches) if (marches[k].units.some(id => ids.includes(id))) delete marches[k];
    marches[ids[0]] = { units: ids, to, at: hex };
    const t = S.map.tiles[to];
    toast(`⚑ March order: ${ids.length} unit${ids.length > 1 ? 's' : ''} → ${t ? E.TERRAIN[t.t].name : 'objective'} · advances every turn, halts on contact`, 'good'); SFX.select();
    sel = null; mode = null; refreshAll();
    if (isMyTurn() && S.turn.stage === 'act') runMarches();
  }
  async function runMarches() {
    if (executing || !isMyTurn() || S.turn.stage !== 'act' || animating) { if (isMyTurn()) setTimeout(() => { if (!executing && !animating) runMarches(); }, 800); return; }
    executing = true; let moved = 0;
    for (const key of Object.keys(marches)) {
      const o = marches[key]; if (!isMyTurn() || S.turn.stage !== 'act') break;
      const units = o.units.filter(id => S.units[id] && S.units[id].owner === you);
      if (!units.length) { delete marches[key]; continue; }
      const hex = S.units[units[0]].hex, ids = units.filter(id => S.units[id].hex === hex && E.canAct(S, S.units[id]));
      if (!ids.length) continue;
      if (hex === o.to) { delete marches[key]; toast('⚑ March complete: troops reached their objective', 'good'); continue; }
      const idx = E.buildIndex(S), r = E.reachable(S, you, ids, hex, idx);
      // contact: an enemy next to us or on the route ahead stops the march (you decide the fight)
      if (Object.keys(r).some(k => r[k].kind === 'attack' && E.dist(k, hex) <= 1)) { delete marches[key]; toast('⚑ March halted: enemy contact', 'err'); Render.ring(hex, '#ff4f5e', 50, 0.6, 4); continue; }
      let best = null, bd = E.dist(hex, o.to);
      for (const k in r) { if (r[k].kind !== 'move' && r[k].kind !== 'capture') continue; const d = E.dist(k, o.to); if (d < bd || (d === bd && best && r[k].c < r[best].c)) { bd = d; best = k; } }
      if (!best) { toast('⚑ March blocked — pick a new objective', 'err'); delete marches[key]; continue; }
      const a = { a: 'move', from: hex, units: ids, to: best }; if (S.fogOn) a.path = E.pathTo(r, best);
      const ok = await act(a);
      if (ok) { moved++; if (best === o.to) { delete marches[key]; toast('⚑ March complete: troops reached their objective', 'good'); } }
    }
    executing = false;
    if (moved) toast('⚑ ' + moved + ' march order' + (moved > 1 ? 's' : '') + ' advanced');
    refreshAll();
  }
  // ───────────── layout: regions are measured live so nothing overlaps ─────────────
  $('#rightCol').prepend($('#allyPop'), $('#offerPop'));
  function layoutHud() {
    const root = document.documentElement.style, tb = $('#topbar'), dock = $('#dock'), cs = $('#centerStack');
    if (!tb || !dock || $('#hud').hidden) return;
    // the dock shrinks as a whole when the window is too narrow for build bar, deck, hand and buttons
    dock.style.zoom = ''; fitHand();
    const need = dock.scrollWidth, have = dock.clientWidth;
    if (need > have + 2) { dock.style.zoom = Math.max(0.6, have / need).toFixed(3); fitHand(); }
    // measurements are in screen pixels; the HUD may be scaled down (--hz) on smaller screens, so convert back
    const z = parseFloat(getComputedStyle($('#hud')).getPropertyValue('--hz')) || 1;
    const t = tb.getBoundingClientRect(), d = dock.getBoundingClientRect();
    root.setProperty('--topH', Math.ceil(t.bottom / z) + 'px');
    root.setProperty('--dockH', Math.ceil((innerHeight - d.top) / z) + 'px');
    root.setProperty('--stackB', Math.ceil(cs.getBoundingClientRect().bottom) + 'px');
    // the chat button (compact screens) sits just under the cash panel, wherever the layout put it
    const ct = $('#chatToggle'), cb = $('#cashBox'); if (ct && cb) { const r = cb.getBoundingClientRect(); ct.style.top = Math.round(r.bottom + 8) + 'px'; ct.style.left = Math.round(r.left) + 'px'; }
  }
  // the hand overlaps its cards more as it fills up, so it always fits the space between the deck and the buttons
  function fitHand() {
    const h = $('#hand'); if (!h) return;
    const cards = [...h.children].filter(c => c.classList.contains('card')); if (!cards.length) return;
    h.style.setProperty('--sq', '-32px');
    const avail = h.clientWidth, total = cards.reduce((a, c) => a + c.offsetWidth, 0), n = cards.length;
    const fit = n > 1 ? (avail - total) / (n - 1) : 0;
    h.style.setProperty('--sq', Math.max(-(cards[0].offsetWidth - 34), Math.min(-32, fit)) + 'px');
  }
  // compact screens (phones): the build bar and the chat log fold away; their labels open them
  const compactMq = matchMedia('(max-height: 520px), (max-width: 520px)');
  const setCompact = () => { document.body.classList.toggle('compact', compactMq.matches); layoutHud(); };
  compactMq.addEventListener ? compactMq.addEventListener('change', setCompact) : compactMq.addListener(setCompact);
  document.body.classList.toggle('compact', compactMq.matches);
  if (isTouchDevice) $('#buildBar .bar-label').textContent = 'BUILD';
  $('#buildBar .bar-label').onclick = () => { if (!document.body.classList.contains('compact')) return; $('#buildBar').classList.toggle('open'); SFX.click(); layoutHud(); };
  { const ct = el('button', '', '💬'); ct.id = 'chatToggle'; ct.title = 'Chat and log'; document.body.appendChild(ct);
    ct.onclick = () => { const lb = $('#logBox'); lb.classList.toggle('open'); ct.classList.remove('unread'); SFX.click(); if (lb.classList.contains('open')) setTimeout(() => $('#chatIn').focus(), 50); }; }
  addEventListener('resize', () => layoutHud());
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => layoutHud()); for (const id of ['#topbar', '#dock', '#centerStack', '#hand', '#deckBar', '#buildBar']) ro.observe($(id)); }
  // ───────────── between turns: next resupply, intel ─────────────
  let prepOpen = false;
  function renderWait() {
    const box = $('#waitBox'); const me = myP();
    if (!S || S.phase !== 'play' || !me || !me.alive || isMyTurn()) { box.hidden = true; return; }
    const parts = [];
    const recent = alerts.filter(a => Date.now() - a.t < 90000);
    if (recent.length) parts.push(`<div class="wb-h">⚠ ALERTS</div>` + recent.map((a, i) => `<div class="wb-row wb-alert"><span>${esc(a.text)}</span>${a.hex ? `<button class="btn tiny" data-look="${i}">LOOK</button>` : ''}</div>`).join(''));
    if (me.nextOffer && me.nextOffer.length) parts.push(`<div class="wb-h">🎴 NEXT RESUPPLY</div><div class="wb-row"><button class="btn tiny" id="prepBtn">${me.prePick ? '✔ ' + (me.prePick.pick === 'income' ? 'Full income' : esc(E.cardDef(me.nextOffer[me.prePick.idx]).name)) + ' · change' : 'Pick it now'}</button></div>`);
    if (S.fogOn) { const ic = E.intelCost(S, you); parts.push(`<div class="wb-h">🛰 INTEL</div><div class="wb-row"><button class="btn tiny" id="intelBtn"${me.cash < ic ? ' disabled' : ''}>Scout through the fog · $${ic} (I)</button>${me.cash < ic ? `<span class="sub">you have $${me.cash} until your turn</span>` : ''}</div>`); }
    box.hidden = !parts.length; box.innerHTML = parts.join('');
    const pb = $('#prepBtn'); if (pb) pb.onclick = openPrep;
    box.querySelectorAll('[data-look]').forEach(b => b.onclick = () => { const a = recent[+b.dataset.look]; if (a && a.hex) { Render.focus(a.hex); Render.ring(a.hex, '#ffc53d', 60, 0.8, 4); } });
    const ib = $('#intelBtn'); if (ib) ib.onclick = () => { mode = { type: 'intel' }; refreshAll(); };
  }
  function openPrep() {
    const me = myP(); if (!me || !me.nextOffer) return;
    prepOpen = true;
    const done = ok => { const was = prepOpen; prepOpen = false; if (was && !isMyTurn()) Cards.closeSupply(); if (ok) toast('🎴 Saved for your next turn', 'good'); refreshAll(); return ok; };
    Cards.openSupply({ me, offer: me.nextOffer, income: E.computeIncome(S, you).total, round: S.turn.round + 1, rerollCost: 0, prep: true, key: 'prep:' + S.turn.round + ':' + me.nextOffer.join(','),
      onPick: async (idx, replace) => done(await act({ a: 'prepick', pick: 'card', idx, replace })), onIncome: async () => done(await act({ a: 'prepick', pick: 'income' })), onReroll: async () => false });
  }
  // the battle window: before the dice roll, both sides can throw battle cards in. Live odds, your playable cards, READY
  // the battle window IS the dice panel, before the roll: both armies, their bonuses, and the battle cards each side has
  // thrown in. Your battle cards rise up underneath; click one and it flies into your column (the other side sees it land)
  let battleOpen = null, notesSig = '';
  // the version of a card its owner has equipped (Foil, Gilded…), so everyone sees their skins in a fight
  const vOf = (pid, id) => { const p = S && S.players.find(q => q.id === pid); return (p && p.cos && p.cos.cards && p.cos.cards[id]) || null; };
  const isHumanSeat = pid => { const lp = lobby && lobby.players.find(p => p.id === pid); return !!(lp && !lp.bot && !lp.away && lp.connected !== false); };
  function showBattle(m) {
    let p = $('#battlePop');
    const key = m.att + '>' + m.hex;
    if (!battleOpen || battleOpen.key !== key || !p) {
      if (p) p.remove();
      p = el('div', '', ''); p.id = 'battlePop'; document.body.appendChild(p);
      battleOpen = { key, hex: m.hex, att: m.att, def: m.def, max: m.ms, shown: { att: 0, def: 0 }, hand: '' };
      const side = (role, pid, units) => `<div class="cb-side bp-side" style="--pc:${pid ? pColor(pid) : '#aaa'}" data-side="${role === 'DEFENDER' ? 'def' : 'att'}">
        <div class="cb-role">${role}</div><div class="cb-name">${esc(pid ? pName(pid) : 'Garrison')}</div>
        <div class="cb-units"></div><div class="bp-thrown"></div><div class="cb-bon"></div>
        <div class="cb-calc"><div class="cb-box chips">0</div><div class="cb-x">×</div><div class="cb-box mult">0</div></div><div class="bp-who"></div></div>`;
      p.innerHTML = `<div class="cb bp">${side('ATTACKER', m.att)}<div class="cb-vs">VS</div>${side('DEFENDER', m.def)}</div>
        <div class="bp-odds"><i></i><em></em><span></span></div>
        <div class="bp-hand"></div>
        <div class="bp-foot"><div class="rp-bar"><i></i></div><div class="bp-act"></div></div>`;
      for (const [sd, list] of [['att', m.attUnits || []], ['def', m.defUnits || []]]) {
        const cu = p.querySelector(`[data-side="${sd}"] .cb-units`);
        list.forEach((t, i) => { const card = Cards.make(t, { mini: true, variant: vOf(sd === 'att' ? m.att : m.def, t) }); card.classList.add('cb-card'); card.style.setProperty('--n', list.length); card.style.setProperty('--i', i); cu.appendChild(card); });
      }
      if (m.you) { Render.focus(m.hex); Render.ring(m.hex, m.you === m.def ? '#ff4f5e' : '#ffc53d', 70, 0.8, 5); if (m.you === m.def) SFX.alarm(); else SFX.whoosh(); }
    }
    const B = battleOpen; B.max = Math.max(B.max, m.ms); B.last = m;
    // each side: chips × mult, its non-card bonuses, and the cards thrown so far (new ones slam in)
    for (const [sd, pid, chips, mult, bon, cards] of [['att', m.att, m.attChips, m.attMult, m.attBonuses, m.cards.att], ['def', m.def, m.defChips, m.defMult, m.defBonuses, m.cards.def]]) {
      const S2 = p.querySelector(`[data-side="${sd}"]`);
      S2.querySelector('.chips').textContent = chips; S2.querySelector('.mult').textContent = 'd6+' + mult;
      S2.querySelector('.cb-bon').innerHTML = bon.filter(b => !b.note && !b.card).map(b => `<div class="cb-b"><span>${esc(b.label)}</span><span class="v ${b.chips ? 'c' : 'm'}">+${b.chips || b.mult} ${b.chips ? 'Chips' : 'Mult'}</span></div>`).join('');
      const th = S2.querySelector('.bp-thrown');
      for (let i = B.shown[sd]; i < cards.length; i++) {
        const c = Cards.make(cards[i], { mini: true, variant: vOf(pid, cards[i]) }); c.classList.add('bp-tc'); th.appendChild(c);
        if (pid !== you) { SFX.card(); Render.float(m.hex, '🃏 ' + E.TACTICS[cards[i]].name.toUpperCase(), pColor(pid), 15); }
        S2.classList.remove('bp-bump'); void S2.offsetWidth; S2.classList.add('bp-bump');
      }
      B.shown[sd] = cards.length;
      // who's still choosing
      const who = S2.querySelector('.bp-who');
      if (!pid) who.innerHTML = '';
      else if (!(m.humans || []).includes(pid)) who.innerHTML = isHumanSeat(pid) ? '<span class="ok">No cards to play</span>' : '<span class="ok">🤖 decided</span>';
      else who.innerHTML = (m.readyPids || []).includes(pid) ? '<span class="ok">✔ READY</span>' : '<span class="wait">choosing cards…</span>';
    }
    const pa = m.winProb == null ? 50 : Math.round(m.winProb * 100);
    const od = p.querySelector('.bp-odds'); od.querySelector('i').style.cssText = `width:${pa}%;background:${pColor(m.att)}`; od.querySelector('em').style.background = m.def ? pColor(m.def) : '#666';
    od.querySelector('span').textContent = m.you ? (m.you === m.def ? (100 - pa) + '% you hold' : pa + '% you break through') : pa + '% attack wins';
    p.querySelector('.rp-bar i').style.width = Math.max(0, m.ms / B.max * 100) + '%';
    // your battle cards, raised up: the ones you can throw in are lit, the rest show why not
    const me = myP(), playable = new Set((m.hand || []).map(c => c.uid));
    const mine = m.you && me ? me.tactics.filter(c => E.TACTICS[c.id].target === 'battle') : [];
    const hk = mine.map(c => c.uid + (playable.has(c.uid) ? '+' : '-')).join(',') + (m.ready ? 'r' : '');
    if (hk !== B.hand) {
      B.hand = hk;
      const hand = p.querySelector('.bp-hand'); hand.innerHTML = '';
      const side = m.you === m.def ? 'def' : 'att';
      mine.forEach((cd, i) => {
        const d = E.TACTICS[cd.id], ok = playable.has(cd.uid) && !m.ready, card = Cards.make(cd.id);
        card.classList.add('bp-hc'); card.style.setProperty('--i', i); card.style.setProperty('--n', mine.length);
        if (!ok) { card.classList.add('off'); card.title = m.ready ? 'You said you were ready' : d.battle !== 'any' && d.battle !== side ? (d.battle === 'def' ? 'Defence card' : 'Attack card') : me.cash < d.cost ? 'Need $' + d.cost : 'Up to ' + E.BATTLE_MAX + ' cards a fight'; }
        else card.onclick = () => {
          if (card.classList.contains('flying')) return;
          // the card flies from your hand into your column
          const from = card.getBoundingClientRect(), to = p.querySelector(`[data-side="${side}"] .bp-thrown`).getBoundingClientRect();
          const ghost = card.cloneNode(true); ghost.classList.add('bp-ghost'); Object.assign(ghost.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
          document.body.appendChild(ghost); card.classList.add('flying');
          requestAnimationFrame(() => { ghost.style.transform = `translate(${to.left + to.width / 2 - from.left - from.width / 2}px, ${to.top - from.top - from.height * 0.3}px) scale(.45) rotate(-8deg)`; ghost.style.opacity = '0.2'; });
          setTimeout(() => ghost.remove(), 420);
          SFX.card(); send({ t: 'battleCard', uid: cd.uid });
        };
        hand.appendChild(card);
      });
      if (m.you && !mine.length) hand.innerHTML = '<div class="sub">No battle cards in hand</div>';
    }
    const act = p.querySelector('.bp-act');
    const others = [m.att, m.def].filter(pid => pid && pid !== m.you && (m.humans || []).includes(pid) && !(m.readyPids || []).includes(pid));
    act.innerHTML = m.you && !m.ready ? `<button class="btn bp-go" id="bpReady">${m.you === m.def ? 'HOLD' : 'ROLL'} ▶ <small>Space</small></button>`
      : `<div class="sub">${others.length ? 'Waiting for ' + others.map(pName).map(esc).join(', ') + '…' : 'Rolling…'}</div>`;
    const rb = $('#bpReady'); if (rb) rb.onclick = () => { SFX.click(); send({ t: 'battleReady' }); rb.disabled = true; };
  }
  addEventListener('keydown', e => { if (battleOpen && (e.code === 'Space' || e.key === 'Enter') && $('#bpReady') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); $('#bpReady').click(); } });
  // overwatch: an enemy stopped next to your watching stack. FIRE or HOLD, with the odds
  function showOwPrompt(m) {
    let p = $('#owPop'); if (p) p.remove();
    p = el('div', '', ''); p.id = 'owPop'; document.body.appendChild(p);
    if (m.mine) {
      const units = m.units.map(id => S.units[id]).filter(Boolean);
      const calc = units.length ? E.combatCalc(S, you, units, m.from, m.target, true) : null;
      p.innerHTML = `<div class="rp-h">🎯 OVERWATCH</div><div class="sub">${esc(pName(S.units && Object.values(S.units).find(u => u.hex === m.target && u.owner !== you) ? Object.values(S.units).find(u => u.hex === m.target && u.owner !== you).owner : null) || 'An enemy')} stopped in your sights.${calc ? ` Hit chance <b>${Math.round(calc.winProb * 100)}%</b>` : ''}</div><div class="rp-cards"><button class="btn red" id="owFire">FIRE</button><button class="btn" id="owHold">HOLD</button></div><div class="rp-bar"><i></i></div>`;
      SFX.alarm(); Render.ring(m.target, '#ff4f5e', 70, 0.8, 5); Render.ring(m.from, pColor(you), 50, 0.6, 4);
      $('#owFire').onclick = () => { send({ t: 'ow', fire: true }); p.remove(); SFX.shot(); };
      $('#owHold').onclick = () => { send({ t: 'ow', fire: false }); p.remove(); };
    } else p.innerHTML = `<div class="rp-h">🎯 ${esc(pName(m.owner)).toUpperCase()} HAS OVERWATCH…</div><div class="rp-bar"><i></i></div>`;
    p.querySelector('.rp-bar i').style.animationDuration = (m.ms / 1000) + 's';
  }
  // alerts while you wait: attacks on you and radar contacts, each with a LOOK button
  const alerts = [];
  function pushAlert(text, hex) { alerts.unshift({ text, hex, t: Date.now() }); alerts.length = Math.min(alerts.length, 4); renderWait(); }
  // map pings and taunts
  let pingArm = null;
  $('#pingBar').querySelectorAll('[data-ping]').forEach(b => b.onclick = () => { pingArm = b.dataset.ping; toast('Click a hex to ping it'); SFX.click(); });
  $('#pingBar').querySelectorAll('[data-emote]').forEach(b => b.onclick = () => { send({ t: 'emote', emote: b.dataset.emote, as: you }); SFX.click(); });
  function showPing(m) {
    const icon = { attack: '⚔', help: '❗', look: '👁' }[m.kind] || '❗', col = pColor(m.pid);
    Render.ring(m.hex, col, 70, 0.9, 5); setTimeout(() => Render.ring(m.hex, col, 70, 0.9, 5), 300);
    Render.float(m.hex, icon + ' ' + pName(m.pid).toUpperCase(), col, 16); SFX.select();
    addLog(`<b style="--c:${col}">${esc(pName(m.pid))}</b> pinged ${icon}`, 'chat');
  }
  // a bot's line pops up as a speech bubble under its name
  // (kept in `saying` so it survives the chips being redrawn)
  const saying = {};
  function botBubble(m) {
    saying[m.pid] = { text: m.text, color: m.color, until: Date.now() + 4500 };
    const chip = [...document.querySelectorAll('#players .pchip')].find(c => c.dataset.pid === m.pid); if (chip) sayOn(chip, m.pid, true);
  }
  function sayOn(chip, pid, fresh) {
    const q = saying[pid]; chip.querySelectorAll('.bot-say').forEach(b => b.remove());
    if (!q || q.until < Date.now()) return;
    const b = el('div', 'bot-say' + (fresh ? '' : ' stay'), esc(q.text)); b.style.setProperty('--pc', q.color); chip.appendChild(b);
    setTimeout(() => b.classList.add('gone'), Math.max(0, q.until - Date.now() - 400)); setTimeout(() => b.remove(), q.until - Date.now() + 100);
  }
  function showEmote(m) {
    const p = S && S.players.find(x => x.id === m.pid); if (!p) return;
    if (p.hq) Render.float(p.hq, m.emote, '#ffffff', 34);
    const chip = [...document.querySelectorAll('#players .pchip')].find(c => c.dataset.pid === m.pid);
    if (chip) { const b = el('span', 'emote-pop', m.emote); chip.appendChild(b); setTimeout(() => b.remove(), 2200); }
  }
  // batch moves: send every selected stack toward one hex (each goes as far as it can)
  async function batchMove(k) {
    const ds = S, groups = [{ hex: sel.hex, units: [...sel.units] }, ...(sel.extra || []).map(g => ({ hex: g.hex, units: [...g.units] }))];
    sel = null; refreshAll(); let n = 0;
    for (const g of groups) {
      const ids = g.units.filter(id => S.units[id] && S.units[id].hex === g.hex && E.canAct(S, S.units[id])); if (!ids.length) continue;
      const r = E.reachable(S, you, ids, g.hex);
      let best = r[k] && ['move', 'capture'].includes(r[k].kind) ? k : null, bd = E.dist(g.hex, k);
      if (!best) for (const h in r) { if (!['move', 'capture'].includes(r[h].kind)) continue; const d = E.dist(h, k); if (d < bd || (d === bd && best && r[h].c < r[best].c)) { bd = d; best = h; } }
      if (!best) continue;
      const a = { a: 'move', from: g.hex, units: ids, to: best }; if (S.fogOn) a.path = E.pathTo(r, best);
      if (await act(a)) n++;
    }
    if (n) toast(`➜ ${n} stack${n > 1 ? 's' : ''} moved`);
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
    document.body.classList.toggle('planning', !box.hidden);
    if (box.hidden) return;
    const list = $('#planList'); list.innerHTML = '';
    if (!plan.length) list.innerHTML = '<div class="pempty">Nothing queued. Click units, cards and hexes like normal. Orders are saved here.</div>';
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
      if (a.a === 'fire' || a.a === 'tactic' || a.a === 'end' || a.a === 'assault') { toast('Attacks and tactics go live on your turn. The Blueprint queues moves, deploys and builds.', 'err'); SFX.error(); return false; }
      if (a.a === 'move') { const r = E.reachable(planState, you, a.units, a.from)[a.to]; if (r && r.kind === 'attack') { toast('Attacks resolve live on your turn. Queue the approach instead.', 'err'); SFX.error(); return false; } }
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
    ov.reach = null; ov.probs = null; ov.fire = null; ov.guns = null; ov.spawn = null; ov.targets = null; ov.path = null;
    ov.selected = sel ? sel.hex : null;
    ov.selectedExtra = sel && sel.extra ? sel.extra.map(g => g.hex) : [];
    ov.unsupplied = null;
    if (ds && ds.phase === 'spawn' && mySpawnPick()) ov.spawn = new Set(E.spawnChoices(ds));
    if (!ds || ds.phase !== 'play') { ov.planArrows = []; ov.planGhost = null; return; }
    const me = ds.players.find(p => p.id === you);
    if (me && me.alive) { const sup = E.supplySet(ds, you); const un = new Set(); for (const k in ds.map.tiles) if (ds.map.tiles[k].owner === you && !sup.has(k)) un.add(k); ov.unsupplied = un; }
    if (mode && mode.type === 'deploy') ov.spawn = new Set(E.deployHexes(ds, you, mode.unit));
    else if (mode && mode.type === 'build') ov.spawn = new Set(E.buildHexes(ds, you, mode.struct));
    else if (mode && mode.type === 'tactic') {
      ov.targets = new Set(E.tacticTargets(ds, you, mode.id, mode.from));
      // air strikes: on hexes under enemy air defence, show the chance the strike gets through
      if (E.AIR_STRIKES.includes(mode.id)) { ov.probs = {}; for (const k of ov.targets) { const ch = E.interceptChance(ds, you, k, mode.id); if (ch > 0) ov.probs[k] = 1 - ch; } }
    }
    else if (sel && sel.units.size && canCommand()) {
      const ids = [...sel.units];
      const idx = E.buildIndex(ds);
      ov.reach = E.reachable(ds, you, ids, sel.hex, idx);
      const units = ids.map(id => ds.units[id]);
      // troops riding a transport can wade ashore straight from the selection
      const cargo = units.filter(u => u && !E.isSea(u.type));
      if (cargo.length && cargo.length < units.length) {
        const rc = E.reachable(ds, you, cargo.map(u => u.id), sel.hex, idx);
        for (const k in rc) {
          if (rc[k].kind === 'start' || ov.reach[k]) continue;
          // waypoints stay unclickable so paths can still be traced back to the ship
          const ashore = ds.map.tiles[k].t !== 'water' || rc[k].kind === 'attack';
          ov.reach[k] = ashore && rc[k].kind !== 'pass' ? { ...rc[k], cargo: true } : { ...rc[k], kind: 'pass', cargo: true };
        }
      }
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
      // an empty hex the stack can walk onto is a move (capturing it, buildings and all), not a shelling target
      // the guns in the stack can fire on their own (Grunts guarding a Thumper don't stop it shelling across a river);
      // where the whole stack can attack, the attack wins the click
      const guns = ids.filter(id => ds.units[id] && E.UNITS[ds.units[id].type].range && E.canAct(ds, ds.units[id]));
      const fire = guns.length ? E.rangedTargets(ds, you, guns, sel.hex, idx).filter(k => !((idx[k] || []).length === 0 && ov.reach[k] && ['move', 'capture'].includes(ov.reach[k].kind)) && !(guns.length < ids.length && ov.reach[k] && ov.reach[k].kind === 'attack')) : [];
      // shelling an empty hex's buildings always hits (it knocks a level off), so it shows as a sure thing
      if (fire.length) { ov.fire = new Set(fire); ov.guns = guns; for (const k of fire) ov.probs[k] = (idx[k] || []).length ? E.combatCalc(ds, you, guns.map(id => ds.units[id]), sel.hex, k, true, idx).winProb : 1; }
    }
    // blueprint arrows & ghosts
    ov.planArrows = []; ov.planGhost = null; ov.planHexes = null; ov.planMoved = null; ov.planTiles = null; ov.planReady = null;
    ov.marches = Object.values(marches).map(o => { const u = S.units[o.units.find(id => S.units[id])]; return u ? { from: u.hex, to: o.to } : null; }).filter(Boolean);
    if (planning()) {
      // blueprint orders are drawn in light blue: planned routes, and every stack or drop the queue has placed
      ov.planHexes = new Set();
      for (const it of plan) if (it.ok) {
        if (it.a.a === 'move') { ov.planArrows.push({ path: it.path || [it.a.from, it.a.to], color: BP_BLUE }); ov.planHexes.add(it.a.to); }
        else if (it.a.a === 'deploy' || it.a.a === 'build') ov.planHexes.add(it.a.hex);
      }
      if (planState) blueprintGhosts(ov);
    }
    if (hoverK) hoverPath(hoverK);
  }
  // what the blueprint changes, drawn over the real board: your stacks where they'll stand, land you'll take, buildings you'll raise
  function blueprintGhosts(ov) {
    const mineNow = {}, mineThen = {};
    for (const id in S.units) { const u = S.units[id]; if (u.owner === you) mineNow[id] = u; }
    for (const id in planState.units) { const u = planState.units[id]; if (u.owner === you) mineThen[id] = u; }
    const changed = new Set();
    for (const id in mineThen) { const now = mineNow[id]; if (!now || now.hex !== mineThen[id].hex) changed.add(mineThen[id].hex); }
    for (const id in mineNow) { const then = mineThen[id]; if (!then || then.hex !== mineNow[id].hex) { if (then) changed.add(then.hex); } }
    // a hex whose stack changes shows the whole planned stack as a ghost, and hides what stands there now
    ov.planMoved = new Set(); ov.planGhost = [];
    for (const id in mineNow) { const then = mineThen[id]; if (!then || then.hex !== mineNow[id].hex || changed.has(mineNow[id].hex)) ov.planMoved.add(mineNow[id].id); }
    // which stacks will still have orders left when your turn starts (the blueprint's view, not last turn's)
    ov.planReady = new Set(Object.values(mineThen).filter(u => E.canAct(planState, u) && (E.moveAllow(planState, u) > 0 || E.UNITS[u.type].range)).map(u => u.id));
    for (const k of changed) { const units = Object.values(mineThen).filter(u => u.hex === k); if (units.length) ov.planGhost.push({ hex: k, units, owner: you }); }
    ov.planTiles = new Set();
    for (const k in planState.map.tiles) {
      const a = S.map.tiles[k], b = planState.map.tiles[k]; if (!a) continue;
      if (b.owner === you && a.owner !== you) ov.planTiles.add(k);
      const newS = E.structsOf(b).find(x => x.owner === you && !E.structsOf(a).some(y => y.type === x.type));
      if (newS) { const g = ov.planGhost.find(x => x.hex === k); if (g) g.struct = newS.type; else ov.planGhost.push({ hex: k, struct: newS.type, owner: you }); }
    }
  }
  function hoverPath(k) {
    const ov = Render.ov; ov.path = null;
    if (!ov.reach || !ov.reach[k]) return;
    const r = ov.reach[k]; if (r.kind === 'start' || r.kind === 'pass') return;
    ov.path = E.pathTo(ov.reach, k); ov.pathColor = r.kind === 'attack' ? '#ff4f5e' : planning() ? BP_BLUE : pColor(you);
  }

  // ───────────── input ─────────────
  const cvs = $('#map');
  let down = null, shiftDown = false, ctrlDown = false, marchArm = false;
  // war-room drawing: only while the Alt view is on
  let warDraw = null;
  cvs.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;   // fingers are handled by the touch layer below
    if (!Render.ov.troops || !S || S.phase !== 'play' || !myP()) return;
    e.stopImmediatePropagation();
    const k = Render.hexAt(e.clientX, e.clientY); if (!k) return;
    if (e.button === 2) { send({ t: 'draw', op: 'remove', hex: k, as: you }); SFX.click(); return; }
    if (e.button !== 0) return;
    warDraw = { a: k }; cvs.setPointerCapture(e.pointerId);
  }, true);
  cvs.addEventListener('pointermove', e => {
    if (!warDraw) return; e.stopImmediatePropagation();
    const k = Render.hexAt(e.clientX, e.clientY); Render.ov.notePreview = k && k !== warDraw.a ? { type: 'arrow', a: warDraw.a, b: k, color: pColor(you) } : null; Render.invalidate();
  }, true);
  cvs.addEventListener('pointerup', e => {
    if (!warDraw) return; e.stopImmediatePropagation();
    const k = Render.hexAt(e.clientX, e.clientY), a = warDraw.a; warDraw = null; Render.ov.notePreview = null;
    send({ t: 'draw', op: 'add', shape: k && k !== a ? { type: 'arrow', a, b: k } : { type: 'circle', a }, as: you }); SFX.select();
  }, true);
  let boxSel = null;
  cvs.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;   // fingers are handled by the touch layer below
    down = { x: e.clientX, y: e.clientY, b: e.button, moved: false }; cvs.setPointerCapture(e.pointerId);
    if (e.shiftKey && e.button === 0 && canCommand()) { boxSel = { x: e.clientX, y: e.clientY, el: el('div', '', '') }; boxSel.el.id = 'boxSel'; document.body.appendChild(boxSel.el); }
  });
  cvs.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;   // fingers are handled by the touch layer below
    if (!boxSel) return;
    const x0 = Math.min(boxSel.x, e.clientX), y0 = Math.min(boxSel.y, e.clientY), b = boxSel.el.style;
    b.left = x0 + 'px'; b.top = y0 + 'px'; b.width = Math.abs(e.clientX - boxSel.x) + 'px'; b.height = Math.abs(e.clientY - boxSel.y) + 'px';
    if (down) down.boxing = true;
  }, true);
  cvs.addEventListener('pointerup', e => {
    if (e.pointerType === 'touch') return;   // fingers are handled by the touch layer below
    if (!boxSel) return; const bs = boxSel; boxSel = null; bs.el.remove();
    if (!down || !down.boxing) return;
    const x0 = Math.min(bs.x, e.clientX), x1 = Math.max(bs.x, e.clientX), y0 = Math.min(bs.y, e.clientY), y1 = Math.max(bs.y, e.clientY);
    const ds = dispState(), hexes = [...new Set(Object.values(ds.units).filter(u => u.owner === you && E.canAct(ds, u)).map(u => u.hex))].filter(k => { const [x, y] = Render.screenOf(k); return x >= x0 && x <= x1 && y >= y0 && y <= y1; });
    down = null;
    if (!hexes.length) return;
    const grp = k => new Set(Object.values(ds.units).filter(u => u.hex === k && u.owner === you && E.canAct(ds, u)).map(u => u.id));
    sel = { hex: hexes[0], units: grp(hexes[0]), extra: hexes.slice(1).map(k => ({ hex: k, units: grp(k) })) };
    SFX.select(); toast(`${hexes.length} stack${hexes.length > 1 ? 's' : ''} selected — click a hex to send them all, or a red target to attack together`); refreshAll();
  }, true);
  cvs.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;   // fingers are handled by the touch layer below
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (down.moved || Math.hypot(dx, dy) > 6) { down.moved = true; Render.pan(e.movementX, e.movementY); cvs.style.cursor = 'grabbing'; hideTip(); return; }
    }
    const k = Render.hexAt(e.clientX, e.clientY);
    if (k !== hoverK) { hoverK = k; Render.ov.hover = k; hoverPath(k); }
    showHexTip(k, e.clientX, e.clientY);
  });
  cvs.addEventListener('pointerup', e => {
    if (e.pointerType === 'touch') return;   // fingers are handled by the touch layer below
    cvs.style.cursor = 'default';
    if (down && !down.moved) {
      if (down.b === 2) cancel();
      else if (down.b === 0) { shiftDown = e.shiftKey; ctrlDown = e.ctrlKey || e.metaKey; onHexClick(Render.hexAt(e.clientX, e.clientY)); }
    }
    down = null;
  });
  cvs.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') hideTip(); });   // a lifted finger 'leaves' too: keep its tooltip
  cvs.addEventListener('contextmenu', e => e.preventDefault());
  cvs.addEventListener('wheel', e => { e.preventDefault(); Render.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });

  // ───────────── touch: one finger pans, two pinch to zoom, a tap acts, holding a finger down shows a hex's details ─────────────
  // there is no hover on a touchscreen, so an order (a move, an attack, a shot, a tactic) takes two taps: the first shows
  // the route and the odds, the second on the same hex sends it. Cancel and multi-select get buttons of their own
  const fingers = new Map();
  var gest = null, touchPreview = null, multiArm = false;
  const spread = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  const ownActable = k => { const ds = dispState(); return !!ds && Object.values(ds.units).some(u => u.hex === k && u.owner === you && E.canAct(ds, u)); };
  // would tapping this hex send an order straight away?
  function wouldOrder(k) {
    if (!k || !S || S.phase !== 'play') return false;
    if (mode && mode.type === 'tactic') return !!(Render.ov.targets && Render.ov.targets.has(k) && !(E.TACTICS[mode.id].target === 'heli' && !mode.from));
    if (mode || !sel || !sel.units.size || k === sel.hex || !canCommand()) return false;
    if (multiArm && ownActable(k)) return false;
    const ov = Render.ov; if (ov.fire && ov.fire.has(k)) return true;
    const r = ov.reach && ov.reach[k];
    return !!(r && r.kind !== 'start' && r.kind !== 'pass') || !!(sel.extra && sel.extra.length && !ownActable(k));
  }
  function touchTap(k, x, y) {
    if (wouldOrder(k) && touchPreview !== k) {
      touchPreview = k; hoverK = k; Render.ov.hover = k; hoverPath(k); Render.invalidate();
      showHexTip(k, x, Math.max(10, y - 150)); Render.ring(k, '#ffc53d', 40, 0.4, 3); SFX.click();
      // say what the second tap will do, even where the hex itself has nothing to show
      const tip = $('#tooltip'); if (tip.hidden) { tip.innerHTML = '<b>' + (mode && mode.type === 'tactic' ? 'TARGET' : 'MOVE HERE') + '</b>'; tip.hidden = false; tip.style.left = Math.min(innerWidth - 200, x + 16) + 'px'; tip.style.top = Math.max(10, y - 80) + 'px'; }
      tip.insertAdjacentHTML('beforeend', '<div class="tip-confirm">Tap again to ' + (mode && mode.type === 'tactic' ? 'fire' : 'send') + '</div>');
      return;
    }
    touchPreview = null; hideTip();
    shiftDown = multiArm; ctrlDown = false;
    onHexClick(k).finally(() => { shiftDown = false; renderTouchBar(); });
  }
  cvs.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    if (e.isPrimary) { fingers.clear(); if (gest) clearTimeout(gest.hold); gest = null; }   // a new gesture: forget any finger whose lift we never heard about
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cvs.setPointerCapture(e.pointerId); } catch (err) {}
    if (fingers.size === 1) {
      const x = e.clientX, y = e.clientY;
      gest = { x0: x, y0: y, last: { x, y }, moved: false, held: false };
      gest.hold = setTimeout(() => { if (!gest || gest.moved || fingers.size !== 1) return; gest.held = true; const k = Render.hexAt(x, y); hoverK = k; Render.ov.hover = k; hoverPath(k); Render.invalidate(); showHexTip(k, x, Math.max(10, y - 160)); if (navigator.vibrate) navigator.vibrate(12); }, 420);
    } else if (gest) { clearTimeout(gest.hold); gest.moved = true; gest.pinch = spread(); }
  });
  cvs.addEventListener('pointermove', e => {
    if (e.pointerType !== 'touch' || !fingers.has(e.pointerId) || !gest) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size >= 2 && gest.pinch) {
      const now = spread(), p0 = gest.pinch;
      if (p0.d > 0 && now.d > 0) Render.zoomAt(now.x, now.y, now.d / p0.d);
      Render.pan(now.x - p0.x, now.y - p0.y); gest.pinch = now; hideTip(); return;
    }
    const dx = e.clientX - gest.last.x, dy = e.clientY - gest.last.y; gest.last = { x: e.clientX, y: e.clientY };
    if (!gest.moved && Math.hypot(e.clientX - gest.x0, e.clientY - gest.y0) > 9) { gest.moved = true; clearTimeout(gest.hold); if (!gest.held) hideTip(); }
    if (gest.moved && !gest.held) Render.pan(dx, dy);
  });
  const fingerUp = e => {
    if (e.pointerType !== 'touch' || !fingers.has(e.pointerId)) return;
    fingers.delete(e.pointerId);
    if (fingers.size === 1 && gest) { const [f] = fingers.values(); gest.last = { x: f.x, y: f.y }; gest.pinch = null; return; }   // one finger left: keep panning, never a tap
    if (fingers.size || !gest) return;
    const g = gest; gest = null; clearTimeout(g.hold);
    if (g.held) { setTimeout(hideTip, 1600); return; }
    if (!g.moved && e.type === 'pointerup') touchTap(Render.hexAt(e.clientX, e.clientY), e.clientX, e.clientY);
  };
  cvs.addEventListener('pointerup', fingerUp); cvs.addEventListener('pointercancel', fingerUp);
  // on-screen stand-ins for Esc / right-click (cancel) and Shift (add another stack to the selection)
  function renderTouchBar() {
    if (!isTouchDevice) return;
    let bar = $('#touchBar');
    if (!bar) {
      bar = el('div', '', '<button class="btn" id="tbCancel">✕ CANCEL</button><button class="btn" id="tbMulti">＋ ADD STACKS</button>'); bar.id = 'touchBar'; document.body.appendChild(bar);
      $('#tbCancel').onclick = () => { multiArm = false; touchPreview = null; cancel(); renderTouchBar(); SFX.click(); };
      $('#tbMulti').onclick = () => { multiArm = !multiArm; touchPreview = null; renderTouchBar(); SFX.click(); toast(multiArm ? 'Tap more of your stacks to add them, then a target to send them all' : 'Multi-select off'); };
    }
    const playing = !!(S && S.phase === 'play' && !$('#hud').hidden);
    if (!sel) multiArm = false;
    bar.hidden = !(playing && (sel || mode || touchPreview));
    $('#tbMulti').hidden = !(sel && sel.units.size && canCommand());
    $('#tbMulti').classList.toggle('on', multiArm);
  }
  // sign of life for the server's AFK check (throttled); while a bot covers your AFK seat, any input takes it back
  let aliveAt = 0;
  const imAfk = () => !!(lobby && S && lobby.players.some(p => (p.id === realId || (p.local && p.controller === realId)) && p.afk));
  function alive() { if (!S || !ws) return; const now = Date.now(); if (now - aliveAt < 8000 && !imAfk()) return; aliveAt = now; send({ t: 'alive' }); }
  for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, alive, { passive: true, capture: true });
  addEventListener('pointermove', () => { if (Date.now() - aliveAt > 20000) alive(); }, { passive: true });
  function renderAfk() {
    let b = $('#afkCover');
    if (!imAfk()) { if (b) b.remove(); return; }
    if (!b) { b = el('div', '', '<div class="panel"><h2>💤 YOU WERE AFK</h2><div class="sub">A bot played your last turns. Click anywhere or press any key to take back command.</div></div>'); b.id = 'afkCover'; document.body.appendChild(b); b.onclick = () => { aliveAt = 0; alive(); }; }
  }
  const keys = new Set();
  addEventListener('keydown', e => {
    const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.code === 'KeyZ' || e.key.toLowerCase() === 'z');
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') e.target.blur();
      // an empty chat box doesn't swallow Ctrl+Z
      if (isUndo && S && e.target.id === 'chatIn' && !e.target.value) { e.preventDefault(); e.target.blur(); doUndo(); }
      return;
    }
    if (isUndo) { e.preventDefault(); doUndo(); return; }
    // Tab / Shift+Tab: jump to the next stack that can still act
    if (e.key === 'Tab' && S && S.phase === 'play') { e.preventDefault(); cycleReady(e.shiftKey ? -1 : 1); return; }
    if (e.key.toLowerCase() === 'e' && !e.ctrlKey && S && S.phase === 'play' && isMyTurn()) { e.preventDefault(); cycleReady(1); return; }
    keys.add(e.key.toLowerCase());
    if (e.key === 'Escape') {
      if (!$('#hostPanel').hidden) closeHost();
      else if (!$('#escMenu').hidden) closeEsc();
      else if (!$('#market').hidden) $('#market').hidden = true;
      else if (!$('#index').hidden) $('#index').hidden = true;
      else if (!$('#rules').hidden) $('#rules').hidden = true;
      else if (mode || sel) cancel();
      else if (S) openEsc();
    }
    if (e.key === 'Enter' && S) {
      // Enter ends your turn (when nothing is open); otherwise it opens chat. T always opens chat.
      const overlay = ['#supply', '#crate', '#draft', '#combat', '#escMenu', '#trade', '#market', '#modal', '#index', '#rules', '#passCover', '#hostPanel', '#victory', '#allyPop', '#offerPop'].some(id => $(id) && !$(id).hidden);
      const eb = $('#endBtn');
      // safe: never during or just after a fight/animation, and it takes two presses
      const busy = animating || executing || Date.now() - lastAnimEnd < 1500;
      if (isMyTurn() && !overlay && !busy && !eb.hidden && !eb.disabled && !e.repeat) {
        enterArm = 0; eb.click();   // one press ends the turn
      } else if (!overlay && !isMyTurn()) $('#chatIn').focus();
      e.preventDefault();
    }
    if (e.key.toLowerCase() === 't' && S) { $('#chatIn').focus(); e.preventDefault(); }
    if (e.key.toLowerCase() === 'f' && myP()) Render.focus(myP().hq);
    // O: put the selected stack on overwatch
    if (e.key.toLowerCase() === 'r' && !e.ctrlKey && sel && (isMyTurn() || planning()) && rotateBridge(sel.hex)) { e.preventDefault(); return; }
    if (e.key.toLowerCase() === 'o' && !e.ctrlKey && sel && sel.units.size && isMyTurn()) { const a = { a: 'overwatch', from: sel.hex, units: [...sel.units] }; sel = null; refreshAll(); doAction(a); e.preventDefault(); return; }
    // I: intel op (fog of war) · G: dig the selected stack in
    if (e.key.toLowerCase() === 'i' && !e.ctrlKey && S && S.fogOn && myP() && myP().alive) { mode = { type: 'intel' }; refreshAll(); e.preventDefault(); return; }
    if (e.key.toLowerCase() === 'g' && !e.ctrlKey && sel && sel.units.size && (isMyTurn() || planning())) { const a = { a: 'digin', from: sel.hex, units: [...sel.units] }; sel = null; refreshAll(); doAction(a).then(ok => ok && toast('⛏ Dug in: +1 defence until they move')); e.preventDefault(); return; }
    // M: march order for the selected stack (then click the objective) · Delete: cancel its march
    if (e.key.toLowerCase() === 'm' && !e.ctrlKey && sel && sel.units.size) { marchArm = !marchArm; toast(marchArm ? '⚑ Click the objective for this march order' : 'March order cancelled'); e.preventDefault(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { let n = 0; for (const k in marches) if (marches[k].units.some(id => sel.units.has(id))) { delete marches[k]; n++; } if (n) { toast('⚑ March order cancelled'); refreshAll(); } }
    if (e.key === ' ') {
      // space flips cards / throws dice when those are up; otherwise it skips the animation playing (never ends the turn)
      e.preventDefault();
      if (!e.repeat && (animating || curFight) && $('#supply').hidden && $('#crate').hidden && $('#draft').hidden) skipAnim();
    }
    if (e.key === 'Alt' && !e.repeat) { e.preventDefault(); Render.ov.troops = !Render.ov.troops; Render.invalidate(); if (Render.ov.troops) toast('🗺 War room on (Alt to close): drag hex→hex for an arrow, click to circle, right-click to erase. Only allies see it.'); }
    if (S && S.phase === 'play') {
      const kk = e.key.toLowerCase(), items = hotbarItems();
      const ui = UNIT_KEYS.indexOf(kk); if (ui >= 0 && items.units[ui]) { armSlot('unit', items.units[ui]); keys.delete(kk); }
      const bi = BUILD_KEYS.indexOf(kk); if (bi >= 0 && items.builds[bi]) { armSlot('build', items.builds[bi]); keys.delete(kk); }
    }
  });
  addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); if (e.key === 'Alt') e.preventDefault(); });
  (function panLoop() {
    requestAnimationFrame(panLoop);
    const v = 12; let dx = 0, dy = 0;
    if (keys.has('a') || keys.has('arrowleft')) dx += v; if (keys.has('d') || keys.has('arrowright')) dx -= v;
    if (keys.has('w') || keys.has('arrowup')) dy += v; if (keys.has('s') || keys.has('arrowdown')) dy -= v;
    if (dx || dy) Render.pan(dx, dy);
  })();

  function cancel() { marchArm = false; if (mode) { mode = null; } else sel = null; refreshAll(); hideTip(); }
  // ───────────── esc menu ─────────────
  function openEsc() {
    if (!S) return;
    const m = $('#escMenu'); m.hidden = false; SFX.select();
    const host = lobby && lobby.hostId === realId;
    $('#escEnd').hidden = !host;
    $('#escSave').hidden = !host || S.phase !== 'play';
    $('#escRestart').hidden = !S.scenario || !host;
    $('#escInvite').hidden = !lobby || lobby.kind === 'public' || lobby.code === 'MAIN' || S.phase === 'over' || !!S.scenario;
    $('#escInfo').textContent = (S.phase === 'over' ? 'Game over' : 'Round ' + S.turn.round) + ' · ' + (lobby ? lobby.players.length : S.players.length) + ' commanders' + (host ? ' · you are the host' : '');
    $('#escSound').textContent = 'SOUND: ' + (SFX.muted ? 'OFF' : 'ON');
    $('#escAuto').textContent = 'AUTO-END TURN: ' + (autoEndOff ? 'OFF' : 'ON');
    $('#escLeave').textContent = spectator || !myP() ? 'BACK TO MENU' : 'LEAVE GAME';
  }
  function closeEsc() { $('#escMenu').hidden = true; }
  // tear down every in-game overlay and return to the title screen
  let menuGen = 0;
  // every step is fenced off: one failing cleanup must never strand you on a blank screen with no menu
  const safeStep = f => { try { f(); } catch (e) { console.warn('leaving the war', e); } };
  // everything a war put over the screen goes with it (draft, crates, resupply, fights, pop-ups), or it would sit on top of
  // the menu or lobby and swallow every click. Used when you leave, and when the war ends under you (the host ends it)
  function clearWarScreens() {
    const safe = safeStep;
    safe(() => { Render.ov.notes = []; Render.extraUnits.length = 0; });
    safe(() => Missions.onState(null));   // the mission bar and General Hale go with the mission
    document.body.classList.remove('reeling');
    for (const id of ['#battlePop', '#owPop', '#crateOpen', '#mapReel', '#afkCover', '#autoEnd', '#boxSel', '#mrBack']) { const e = $(id); if (e) e.remove(); }
    for (const id of ['#combat', '#allyPop', '#supply', '#crate', '#draft', '#tooltip', '#teamPanel']) { const e = $(id); if (e) e.hidden = true; }
    for (const id of ['#missionsModal', '#missionResult']) { const e = $(id); if (e) e.hidden = true; }
    battleOpen = null;
    safe(() => Cards.hideDraft()); safe(() => Cards.closeSupply()); safe(() => Cards.closeCrate());
    for (const id of ['#escMenu', '#trade', '#market', '#modal', '#offerPop', '#victory', '#passCover', '#index', '#rules']) { const e = $(id); if (e) e.hidden = true; }
    for (const id of ['#siegeWarn', '#spawnBar']) { const e = $(id); if (e) e.remove(); }
    const z = $('#cardZoom'); if (z) z.hidden = true;
    document.body.classList.remove('pp-idle');
  }
  function backToMenu() {
    const safe = safeStep;
    menuGen++; clearWarScreens();
    S = null; safe(() => Render.setState(null)); msgQ = []; plan = []; sel = null; mode = null; passTo = null; unlocked = null; lastTurnKey = '';
    for (const k in plans) delete plans[k];
    safe(showMenu); safe(showHome);
    // belt and braces: the front page must be up, whatever happened above
    $('#menu').hidden = false; $('#hud').hidden = true; if ($('#home').hidden && $('#lobbyBox').hidden) { $('#home').hidden = false; document.body.classList.add('at-home'); }
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
      ${h.lan.length ? h.lan.map(a => `<div class="hp-addr"><code>${esc(a)}</code><button class="btn" data-copy="${esc(a)}">COPY</button></div>`).join('') : '<div class="sub">No network found. Connect to Wi-Fi to play with others.</div>'}
      <div class="hint">They open that address in a browser, or use JOIN A GAME → Scan network.</div>
      <h3>CONNECTED (${h.clients.length})${h.bots ? ' · ' + h.bots + ' bot' + (h.bots > 1 ? 's' : '') : ''}</h3>
      <div class="hp-list">${h.clients.map(c => `<div class="hp-row"><span>${esc(c.name)}${c.seats > 1 ? ` <small>+${c.seats - 1} local</small>` : ''}</span><span class="tags">${c.host ? '<i class="gold">HOST</i>' : ''}${c.here ? '<i>THIS PC</i>' : `<i>${esc(c.addr)}</i>`}</span></div>`).join('') || '<div class="sub">Nobody yet.</div>'}</div>
      <h3>UPDATES</h3>${up}
      <div class="row hp-btns"><button class="btn big" id="hpClose">CLOSE</button><button class="btn big red" id="hpStop">${stopArm > Date.now() ? 'CLICK AGAIN TO STOP' : 'STOP SERVER'}</button></div>
      <div class="hint">You can also manage it from the SECTOR server window (press Q there to stop).</div>`;
    card.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { copyText(b.dataset.copy); b.textContent = 'COPIED'; SFX.coin(1); setTimeout(() => b.textContent = 'COPY', 1200); });
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
      const tick = async () => { const i = await fetch('/info', { cache: 'no-store' }).then(r => r.json()).catch(() => null); if (i && Date.now() - t0 > 2500) location.reload(); else if (Date.now() - t0 < 120000) setTimeout(tick, 1000); else $('#closedCard .hint').textContent = 'The update is taking a while. Start Sector.exe again.'; };
      setTimeout(tick, 2000);
    }
  }
  $('#menuBtn').onclick = openEsc;
  $('#escResume').onclick = () => { SFX.click(); closeEsc(); };
  $('#escRules').onclick = () => { closeEsc(); showRules(); };
  $('#escIndex').onclick = () => { closeEsc(); Cards.showIndex(); };
  $('#escSound').onclick = () => { const m = SFX.toggle(); setTimeout(menuMusic, 50); $('#escSound').textContent = 'SOUND: ' + (m ? 'OFF' : 'ON'); $('#muteBtn').textContent = m ? '✕' : '♪'; };
  $('#escSave').onclick = () => { SFX.click(); send({ t: 'saveGame' }); };
  $('#escRestart').onclick = () => { SFX.click(); closeEsc(); Missions.restart(); };
  $('#escInvite').onclick = () => { const link = location.origin + '/?room=' + lobby.code; copyText(link).then(ok => ok && toast('Invite link copied: a friend who opens it can take over a bot')); SFX.click(); };
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
  $('#joinGo').onclick = () => { const v = $('#joinAddr').value.trim(); if (v) goTo(v); };
  $('#joinAddr').addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinGo').click(); });
  // every SECTOR server on this network: known addresses first (instant), then a sweep of each subnet with a throttled
  // pool so dead IPs don't starve live ones. onFound(server) fires as each one answers; stop() ends the sweep early
  async function scanLan(onFound, onProgress) {
    let lan = [], stopped = false;
    try { lan = (await (await fetch('/info')).json()).lan || []; } catch (e) {}
    const subnets = [...new Set(lan.filter(a => /^(10|172|192)\./.test(a)).map(a => a.split(':')[0].replace(/^https?:\/\//, '').split('.').slice(0, 3).join('.')))];
    const ports = [...new Set([3000, 3001, +location.port || 80])], seen = new Set();
    const probe = async (ip, port) => {
      if (stopped) return;
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 1200);
      try { const r = await fetch(`http://${ip}:${port}/info`, { signal: ctl.signal }); const j = await r.json(); if (j.game === 'sector' && !seen.has(j.id)) { seen.add(j.id); if (onFound({ url: `http://${ip}:${port}`, ...j }) === false) stopped = true; } } catch (e) {} finally { clearTimeout(tm); }
    };
    const known = lan.map(a => a.replace(/^https?:\/\//, '').split(':')[0]).filter(a => /^(10|172|192)\./.test(a));
    await Promise.all(known.flatMap(ip => ports.map(port => probe(ip, port))));
    const jobs = [];
    for (const sn of subnets) for (let i = 1; i < 255; i++) for (const port of ports) { const ip = sn + '.' + i; if (!known.includes(ip)) jobs.push([ip, port]); }
    let next = 0, done = 0;
    await Promise.all(Array.from({ length: 32 }, async () => { while (next < jobs.length && !stopped) { const [ip, port] = jobs[next++]; await probe(ip, port); done++; if (onProgress && done % 40 === 0) onProgress(done / jobs.length); } }));
  }
  // a room code this server doesn't know: it may be a friend's room on their own server, so look for it on the network
  async function findRoomOnLan(code) {
    toast('Looking for room ' + code + ' on your network…');
    let hit = null;
    await scanLan(sv => { if (sv.url !== location.origin && (sv.lobbies || []).some(l => l.code === code)) { hit = sv; return false; } });
    if (hit) goTo(hit.url + '/?room=' + code);
    else { toast('No room ' + code + ' here or on your network. Check the code, or ask for their invite link.', 'err'); SFX.error(); }
  }
  $('#scanBtn').onclick = async () => {
    const btn = $('#scanBtn'), list = $('#scanList'), found = [];
    btn.disabled = true; btn.textContent = 'SCANNING…'; list.innerHTML = '<div class="hint">Looking for games…</div>';
    // one row per lobby with people in it (JOIN takes you straight into that room); a server with none gets one row
    const rows = sv => {
      const here = sv.url === location.origin, addr = esc(sv.url.replace('http://', '')) + (here ? ' · this server' : '');
      const lobbies = (sv.lobbies || []).length ? sv.lobbies : [{ code: null, host: sv.host, humans: sv.humans, inGame: sv.inGame }];
      return lobbies.map(l => `<div class="srv${here ? ' me' : ''}"><div><b>${l.main ? 'LAN lobby' : l.host ? esc(l.host) + "'s " + (l.inGame ? 'war' : 'lobby') : 'Open server'}</b> <span class="sub">· ${l.humans} player${l.humans === 1 ? '' : 's'} · ${l.inGame ? 'in progress' : 'in lobby'}${l.code && !l.main ? ' · code ' + esc(l.code) : ''}</span><div class="sub">${addr}</div></div><button class="btn tiny ${l.inGame ? '' : 'green'}" data-u="${esc(sv.url + (l.code ? '/?room=' + l.code : l.inGame ? '/?watch=1' : ''))}">${l.inGame ? 'WATCH' : 'JOIN'}</button></div>`).join('');
    };
    const show = () => { list.innerHTML = found.map(rows).join(''); list.querySelectorAll('[data-u]').forEach(b => b.onclick = () => goTo(b.dataset.u)); };
    await scanLan(sv => { found.push(sv); show(); }, f => { btn.textContent = 'SCANNING… ' + Math.round(f * 100) + '%'; });
    btn.disabled = false; btn.textContent = 'SCAN AGAIN';
    if (!found.length) list.innerHTML = '<div class="hint">No games found. Make sure the host has SECTOR running and you are on the same Wi-Fi, or type their address below.</div>';
  };

  async function onHexClick(k) {
    if (S && S.phase === 'spawn') {
      if (!k || !mySpawnPick()) return;
      if (!E.spawnChoices(S).includes(k)) { toast('Pick a glowing hex', 'err'); SFX.error(); return; }
      SFX.select(); await act({ a: 'spawnPick', hex: k }); return;
    }
    if (!S || S.phase !== 'play') return;
    const ds = dispState();
    if (pingArm && k) { send({ t: 'ping', hex: k, kind: pingArm, as: you }); pingArm = null; return; }
    if (mode && mode.type === 'intel') { mode = null; if (k) { SFX.select(); act({ a: 'intel', target: k }).then(ok => ok && toast('🛰 Scouting that area until the end of next round', 'good')); } refreshAll(); return; }
    if (mode && mode.type === 'deploy') {
      if (!k || !Render.ov.spawn || !Render.ov.spawn.has(k)) { if (!k) cancel(); else { toast(E.isSea(mode.unit) ? 'Launch ships into the sea next to your Port' : 'Deploy at a highlighted HQ / FOB', 'err'); SFX.error(); } return; }
      if (!canPlace()) return;
      // fire and forget: you can click again straight away, even while the last drop is still landing
      const unit = mode.unit;
      doAction({ a: 'deploy', unit, hex: k }).then(() => {
        const me = dispState().players.find(p => p.id === you);
        if (mode && mode.unit === unit && me && me.cash < E.unitCost(me, unit)) { mode = null; refreshAll(); }
      });
      return;
    }
    if (mode && mode.type === 'build') {
      if (!k || !Render.ov.spawn || !Render.ov.spawn.has(k)) { if (!k) cancel(); else { toast('Build on a highlighted hex', 'err'); SFX.error(); } return; }
      if (!canPlace()) return;
      const st = mode.struct;
      doAction({ a: 'build', struct: st, hex: k }).then(() => {
        const me = dispState().players.find(p => p.id === you);
        if (mode && mode.struct === st && me && (!E.buildHexes(dispState(), you, st).some(k2 => me.cash >= E.buildCost(dispState(), me, st, k2)))) { mode = null; refreshAll(); }
      });
      return;
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
    if (sel && sel.units.size && k && k !== sel.hex && (ctrlDown || marchArm) && (isMyTurn() || planning())) { marchArm = false; marchOrder(sel.hex, sel.units, k); return; }
    // Shift on a hex with your own troops that can act always adds them to the selection (combined arms), even when the
    // first stack could move there. Shift on an enemy hex still sends everything selected in
    const addStack = shiftDown && sel && sel.units.size && k && k !== sel.hex && Object.values(dispState().units).some(u => u.hex === k && u.owner === you && E.canAct(dispState(), u));
    if (addStack) { selectHex(k, true); return; }
    if (sel && sel.units.size && canCommand() && k && k !== sel.hex) {
      const ov = Render.ov;
      if (ov.fire && ov.fire.has(k)) { const a = { a: 'fire', from: sel.hex, units: ov.guns || [...sel.units], to: k }; sel = null; refreshAll(); await doAction(a); return; }
      const r = ov.reach && ov.reach[k];
      if (r && r.kind === 'attack' && sel.extra && sel.extra.length) {
        const gs = assaultGroups(ds, k, E.buildIndex(ds));
        if (gs.length > 1) { const a = { a: 'assault', to: k, groups: gs.map(g => ({ from: g.from, units: g.units })) }; sel = null; refreshAll(); await doAction(a); return; }
        if (gs.length === 1) { const a = { a: 'move', from: gs[0].from, units: gs[0].units, to: k }; sel = null; refreshAll(); await doAction(a); return; }
      }
      if (sel.extra && sel.extra.length && isMyTurn() && (!r || r.kind !== 'attack')) { await batchMove(k); return; }
      if (r && r.kind !== 'start' && r.kind !== 'pass' && !r.extra) {
        const ids = r.cargo ? [...sel.units].filter(id => ds.units[id] && !E.isSea(ds.units[id].type)) : [...sel.units];
        const a = { a: 'move', from: sel.hex, units: ids, to: k };
        if (ds.fogOn) a.path = E.pathTo(ov.reach, k);   // lets the server follow the route as far as the fog allows
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
    const P = window.__refreshPerf || (window.__refreshPerf = {}), tm = (n, f) => { const t0 = performance.now(); f(); const d = performance.now() - t0; P[n] = +((P[n] || 0) * 0.8 + d * 0.2).toFixed(2); if (d > (P[n + '^'] || 0)) P[n + '^'] = +d.toFixed(1); };
    tm('state', () => Render.setState(S));
    tm('overlays', updateOverlays);
    tm('top', renderTop); tm('cash', renderCash); renderSiege(); renderUndo(); renderMarket(); renderTouchBar(); renderWeather(); tm('ally', renderAlly); tm('plan', renderPlan); tm('hex', renderHexPanel); tm('hand', renderHand); renderEnd(); renderModeHint(); renderOffer(); renderTurnPill(); renderAfk(); renderSpeed(); renderWait(); checkAutoEnd(); layoutHud();
  }
  // game speed button: the host sets the pace; anyone may once only bots are left
  // speed strip: ⏸ and > >> >>> (and 🚀 when only bots are left). The host controls it; anyone may once only bots play
  function renderSpeed() {
    const box = $('#speedCtl'); if (!box || !S) return;
    const botsOnly = S.players.filter(p => p.alive).every(p => p.bot), host = lobby && lobby.hostId === realId;
    box.hidden = !(host || botsOnly) || S.phase !== 'play';
    const sp = gameSpeed();
    box.querySelectorAll('button').forEach(b => {
      const v = b.dataset.v;
      if (v === 'max') b.hidden = !botsOnly;
      if (v === 'pause') { b.textContent = S.paused ? '▶' : '⏸'; b.title = S.paused ? 'Resume' : 'Pause'; b.classList.toggle('on', !!S.paused); }
      else b.classList.toggle('on', !S.paused && v === sp);
    });
  }

  // how a bot feels about you
  function moodTag(p) {
    if (!p.bot || !p.alive || p.id === you || !myP()) return '';
    const m = E.moodOf(S, p.id, you);
    const [face, word] = m >= 40 ? ['😊', 'Friendly'] : m >= 10 ? ['🙂', 'Warm'] : m > -10 ? ['😐', 'Neutral'] : m > -40 ? ['😠', 'Wary'] : ['😡', 'Hostile'];
    return ` <span class="mood" title="${word} towards you (${m > 0 ? '+' : ''}${m}). Bots ally with commanders they like, against whoever is most dangerous.">${face}</span>`;
  }
  // ───────────── team games: your teammates' hands and cash, money and cards passed across ─────────────
  function openTeam() { $('#teamPanel').hidden = false; renderTeam(); }
  function renderTeam() {
    const box = $('#teamPanel'), me = myP(); if (!S || !me) { box.hidden = true; return; }
    const mates = S.players.filter(p => p.alive && E.teammate(S, you, p.id));
    const send$ = (to, n) => `<button class="btn tiny gold" data-to="${to}" data-n="${n}" ${me.cash < n ? 'disabled' : ''}>💸 $${n}</button>`;
    box.innerHTML = `<div class="panel team-card"><div class="ix-head"><h2>YOUR TEAM</h2><button class="icon-btn" id="tmClose">✕</button></div>
      <div class="tm-sub">Plan together: you can see each other's cards, deploy at each other's FOBs and launch ships from each other's Ports. Money and cards pass instantly.</div>
      ${mates.map(p => `<div class="tm-mate" style="--pc:${p.color}"><div class="tm-head"><b>${esc(p.name)}</b><span class="tm-cash">$${p.cash}</span>${send$(p.id, 2)}${send$(p.id, 5)}${send$(p.id, 10)}</div>
        <div class="tm-hand" data-pid="${p.id}"></div></div>`).join('') || '<div class="tm-sub">No teammates left standing.</div>'}
      ${mates.length && me.tactics.length ? `<div class="tm-mine"><h3>PASS A CARD</h3><div class="tm-hand mine"></div></div>` : ''}</div>`;
    box.querySelector('#tmClose').onclick = () => { box.hidden = true; SFX.click(); };
    box.onclick = e => { if (e.target === box) box.hidden = true; };
    for (const b of box.querySelectorAll('[data-n]')) b.onclick = () => { SFX.coin(2); act({ a: 'gift', to: b.dataset.to, amount: +b.dataset.n }); };
    for (const h of box.querySelectorAll('.tm-hand[data-pid]')) {
      const p = S.players.find(x => x.id === h.dataset.pid), cards = p.tactics || [];
      if (!cards.length) h.innerHTML = '<span class="tm-none">No tactic cards</span>';
      for (const c of cards) h.appendChild(Cards.make(c.id, { mini: true }));
    }
    const mine = box.querySelector('.tm-hand.mine');
    if (mine) for (const c of me.tactics) {
      const w = el('div', 'tm-give'); w.appendChild(Cards.make(c.id, { mini: true }));
      for (const p of mates) { const b = el('button', 'btn tiny', '→ ' + esc(p.name)); b.onclick = () => { SFX.select(); act({ a: 'gift', to: p.id, uid: c.uid }); }; w.appendChild(b); }
      mine.appendChild(w);
    }
  }
  function renderTop() {
    const box = $('#players'); box.innerHTML = '';
    // land is what scores (Conquest target, time-up winner), so that's the headline number; sea is in the tooltip
    const counts = {}, seas = {}; for (const k in S.map.tiles) { const t = S.map.tiles[k], o = t.owner; if (!o) continue; if (E.isLandTile(t)) counts[o] = (counts[o] || 0) + 1; else seas[o] = (seas[o] || 0) + 1; }
    for (const p of S.players) {
      const f = E.FACTIONS[p.faction];
      const c = el('div', 'pchip' + (curP().id === p.id && S.phase === 'play' ? ' cur' : '') + (p.alive ? '' : ' dead') + (p.id === you ? ' me' : '') + Locker.bannerClass(p.cos)); c.dataset.pid = p.id;
      c.style.setProperty('--pc', p.color);
      const extra = S.map.beacon ? ` · ◆${p.koth}/3` : '';
      if (!p.alive) c.style.setProperty('--pc', '#5b6670');
      c.innerHTML = `<div class="av"><img src="${Art.iconURL('glyph', f ? f.glyph : 'shield', '#0b0f13', 48)}"></div><div><div class="pn">${esc(p.name)}${p.alive ? '' : ' <span class="out">☠ OUT</span>'}${p.team ? ` <span class="teamchip t${p.team}">${'ABCD'[p.team - 1]}</span>` : ''}${p.traitor ? ' <span class="out" title="Broke an alliance: -40% income and no new pacts">🗡 TRAITOR</span>' : ''}${moodTag(p)}</div><div class="ps"><span title="${counts[p.id] || 0} land hexes (what counts to win) + ${seas[p.id] || 0} sea">⬢ <b>${counts[p.id] || 0}</b></span><span>$<b>${p.cash}</b></span><span>🂠 <b>${p.tacticCount ?? p.tactics.length}</b></span>${extra}</div></div>`;
      c.title = f ? f.name + ' — ' + f.perk + ': ' + f.desc : '';
      c.onclick = () => { if (p.hq) Render.focus(p.hq); };
      if (saying[p.id]) sayOn(c, p.id, false);
      const allied = E.isAlly(S, you, p.id), pact = allied && (S.allies || []).find(x => (x.a === p.id || x.b === p.id) && (x.a === you || x.b === you));
      if (allied) {
        const left = pact && pact.until ? pact.until - S.turn.round : 0;
        const badge = el('span', 'allybadge' + (pact && pact.ending ? ' ending' : left && left <= 2 ? ' expiring' : ''), pact && pact.ending ? '💔' : '🤝' + (left ? `<small>${left}</small>` : ''));
        badge.title = pact && pact.team ? 'Teammate' : pact && pact.ending ? 'Breaking up' : left ? `Alliance: ${left} round${left > 1 ? 's' : ''} left` + (left <= 2 ? '. Both of you press RENEW to extend it 5 rounds.' : '') : 'Allied';
        c.classList.add('allied'); c.appendChild(badge);
      }
      const lp = lobby && lobby.players.find(x => x.id === p.id);
      if (p.away) c.querySelector('.pn').insertAdjacentHTML('beforeend', ' <span class="out" title="Disconnected: a bot is covering until they return">📡 AWAY</span>');
      if (lobby && lobby.hostId === realId && p.id !== you && !p.bot && lp && !(lp.local && lp.controller === realId) && S.phase !== 'over') {
        const kb = el('button', 'kickbtn', '✕'); kb.title = 'Kick ' + p.name + ' (a bot takes over their empire)';
        kb.onclick = e => { e.stopPropagation(); if (kb.dataset.armed !== '1') { kb.dataset.armed = '1'; kb.textContent = 'KICK?'; setTimeout(() => { kb.dataset.armed = ''; kb.textContent = '✕'; }, 2500); return; } SFX.click(); send({ t: 'kick', id: p.id }); };
        c.appendChild(kb);
      }
      if (!myP() && p.bot && !p.away && p.alive && S.phase !== 'over') {
        const box = el('div', 'chipbtns'), tb = el('button', 'tradebtn ally', 'TAKE OVER');
        tb.title = 'Take command of this bot: its land, army and cards become yours';
        tb.onclick = e => { e.stopPropagation(); SFX.select(); send({ t: 'takeover', id: p.id, name: savedName() || 'Commander' }); };
        box.appendChild(tb); c.appendChild(box);
      }
      if (S.phase === 'play' && myP() && myP().alive && p.id !== you && p.alive) {   // diplomacy and trade any time, not just on your turn
        const box = el('div', 'chipbtns');
        if (mode && mode.type === 'tactic' && ['enemyHand', 'enemyHex'].includes(E.TACTICS[mode.id].target) && !allied) {
          const tb = el('button', 'tradebtn betray', '🎯 TARGET'); tb.title = E.TACTICS[mode.id].name + ' on ' + p.name;
          tb.onclick = e => { e.stopPropagation(); const a = { a: 'tactic', uid: mode.uid, targetPid: p.id }; burnCard(mode.el); mode = null; refreshAll(); doAction(a); };
          box.appendChild(tb);
        }
        if (E.teammate(S, you, p.id)) { const tb = el('button', 'tradebtn ally', '🃏 ' + (p.tactics || []).length + ' · TEAM'); tb.title = p.name + "'s hand and cash: send them money or pass them a card"; tb.onclick = e => { e.stopPropagation(); SFX.select(); openTeam(); }; box.appendChild(tb); }
        if (!S.trade) { const tb = el('button', 'tradebtn', 'TRADE'); tb.onclick = e => { e.stopPropagation(); SFX.select(); openTrade(p.id); }; box.appendChild(tb); }
        if (!allied && !S.allyOffer && myP() && myP().alive && S.settings.teams !== 'on') { const ab = el('button', 'tradebtn ally', 'ALLY'); ab.title = 'Propose an alliance'; ab.onclick = e => { e.stopPropagation(); SFX.select(); act({ a: 'allyOffer', to: p.id }); }; box.appendChild(ab); }
        if (allied && pact && !pact.ending && !pact.team && pact.until && pact.until - S.turn.round <= 2) {
          const mine = pact.renew && pact.renew[you], theirs = pact.renew && pact.renew[p.id];
          const rb = el('button', 'tradebtn ally', mine ? 'RENEWED ✔' : theirs ? 'RENEW ⚡' : 'RENEW');
          rb.title = mine ? 'Waiting for your ally to renew' : theirs ? 'Your ally wants to renew. Press to extend 5 rounds.' : 'Offer to extend the alliance 5 rounds (both sides must renew).';
          rb.disabled = !!mine; rb.onclick = e => { e.stopPropagation(); SFX.select(); act({ a: 'allyRenew', with: p.id }); };
          box.appendChild(rb);
        }
        if (allied && isMyTurn() && S.turn.stage === 'act' && sel && sel.units.size) {
          const gb = el('button', 'tradebtn ally', 'GIVE ⬢' + sel.units.size); gb.title = 'Give the selected stack to ' + p.name;
          gb.onclick = e => { e.stopPropagation(); const a = { a: 'donate', from: sel.hex, units: [...sel.units], to: p.id }; sel = null; refreshAll(); SFX.select(); act(a); };
          box.appendChild(gb);
        }
        if (allied && pact && !pact.ending && !pact.team) {
          const bb = el('button', 'tradebtn betray', 'BREAK'); bb.title = 'Break the alliance (takes effect at the start of your next turn)';
          bb.onclick = e => { e.stopPropagation(); if (bb.dataset.armed !== '1') { bb.dataset.armed = '1'; bb.textContent = 'SURE?'; setTimeout(() => { bb.dataset.armed = ''; bb.textContent = 'BREAK'; }, 2500); return; } SFX.alarm(); act({ a: 'allyBreak', with: p.id }); };
          box.appendChild(bb);
        }
        if (box.children.length) c.appendChild(box);
      }
      box.appendChild(c);
    }
    let modeTxt = S.settings.mode === 'conquest' ? `Conquest · first to <b style="display:inline;font-size:12px;color:var(--gold)">${E.conquestTarget(S)}</b> hexes` : S.settings.mode === 'koth' ? 'Beacon · hold the centre for 3 turns' : S.settings.mode === 'worldwar' ? `World War · first to <b style="display:inline;font-size:12px;color:var(--gold)">${E.conquestTarget(S)}</b> hexes` : 'Domination · capture every HQ';
    // team games: each team's land, side by side
    // (in the fog you only know your own team's)
    if (S.settings.teams === 'on') { const by = {}, mine = myP() && myP().team; for (const p of S.players) if (p.alive && p.team && (S.settings.fog !== 'on' || !mine || p.team === mine)) by[p.team] = (by[p.team] || 0) + E.ownedLand(S, p.id).length;
      modeTxt += ' · ' + Object.keys(by).sort().map(t => `<span class="teamchip t${t}">${'ABCD'[t - 1]}</span> ${by[t]}`).join(' '); }
    if (S.settings.mode === 'conquest' || S.settings.mode === 'worldwar') {
      // how close everyone is: your land, what's left to win, and the leader
      const need = E.conquestTarget(S), land = id => E.ownedLand(S, id).length;
      const lead = S.players.filter(p => p.alive).sort((a, b) => land(b.id) - land(a.id))[0];
      const mine = myP() ? land(you) : 0;
      modeTxt += `<div class="cq">${myP() ? `You <b>${mine}</b>/${need} · <b>${Math.max(0, need - mine)}</b> to go` : ''}${lead && lead.id !== you ? `<span> · leader ${esc(lead.name)} ${land(lead.id)}</span>` : ''}</div>`;
    }
    $('#roundBox').innerHTML = `<b>ROUND ${S.turn.round}${S.settings.maxRounds ? '/' + S.settings.maxRounds : ''}</b>${modeTxt}`;
  }

  let shownCash = null;
  function renderSiege() {
    let w = document.querySelector('#siegeWarn');
    const me = myP();
    const h = me && S.map.tiles[me.hq] && E.structsOf(S.map.tiles[me.hq]).find(x => x.type === 'hq' && x.owner === you && x.siege);
    if (!h) { if (w) w.remove(); return; }
    if (!w) { w = el('div', '', ''); w.id = 'siegeWarn'; $('#centerStack').appendChild(w); w.onclick = () => Render.focus(me.hq); }
    w.innerHTML = `🔥 YOUR HQ IS UNDER SIEGE by <b>${esc(pName(h.siege.by))}</b> — deploy troops next to it (they can attack right away) and retake it this turn, or you're eliminated <span>(click to look)</span>`;
  }
  // ───────────── the black market: opens once your income reaches $50 a turn; 5 tactic cards a turn, bought outright ─────────────
  const marketStock = () => { const me = myP(); return me && me.market && S.turn && me.market.round === S.turn.round ? me.market : null; };
  function renderMarket() {
    const b = $('#marketBtn'), box = $('#market'); if (!b) return;
    const m = marketStock(), on = !!(m && isMyTurn() && S.phase === 'play' && S.turn.stage === 'act');
    const left = m ? m.cards.filter(c => !c.sold).length : 0;
    b.hidden = !on;
    b.querySelector('b').textContent = left || ''; b.classList.toggle('stocked', left > 0);
    if (!on) { box.hidden = true; return; }
    if (!box.hidden) drawMarket();
  }
  function drawMarket() {
    const box = $('#market'), m = marketStock(), me = myP(); if (!m || !me) { box.hidden = true; return; }
    box.innerHTML = `<div class="panel mk-card"><h3>🕶 BLACK MARKET</h3>
      <div class="sub">Tactic cards for cash, no questions asked. New stock every turn; what you don't buy is gone. You have <b class="gold">$${me.cash}</b>.</div>
      <div class="mk-row"></div>
      <div class="row" style="justify-content:center"><button class="btn big" id="mkClose">CLOSE</button></div></div>`;
    const row = box.querySelector('.mk-row');
    m.cards.forEach((c, i) => {
      const slot = el('div', 'mk-slot' + (c.sold ? ' sold' : ''));
      slot.appendChild(Cards.make(c.id, { variant: 0 }));
      const btn = el('button', 'btn mk-buy', c.sold ? 'SOLD' : 'BUY $' + c.price);
      btn.disabled = c.sold || me.cash < c.price;
      btn.onclick = async () => { btn.disabled = true; SFX.coin(4); if (!(await act({ a: 'marketBuy', idx: i }))) btn.disabled = false; else drawMarket(); };
      slot.appendChild(btn); row.appendChild(slot);
    });
    $('#mkClose').onclick = () => { box.hidden = true; SFX.click(); };
  }
  $('#marketIcon').src = Art.iconURL('glyph', 'market', '#f3eaff', 96);   // drawn like the game's other icons
  $('#marketBtn').onclick = () => { if (!marketStock()) return; $('#market').hidden = false; drawMarket(); SFX.select(); };
  $('#market').onclick = e => { if (e.target.id === 'market') { $('#market').hidden = true; } };
  function renderUndo() {
    const b = $('#undoBtn'); if (!b) return;
    b.hidden = !(isMyTurn() && S.turn.stage === 'act' && undoCount > 0 && !executing);
    b.innerHTML = '↶ UNDO' + (undoCount > 1 ? ` <small>${undoCount}</small>` : '');
  }
  function doUndo() {
    // blueprint: Ctrl+Z takes back the last queued order
    if (planning()) { if (!plan.length) { toast('Blueprint is empty'); return; } plan.pop(); recomputePlan(); sel = null; refreshAll(); SFX.click(); toast('↶ Removed the last blueprint order'); return; }
    if (!isMyTurn() || executing) return;
    if (mode) { mode = null; refreshAll(); }
    // the server knows best what can be undone (it answers with a reason when nothing can); a click mid-animation still counts
    SFX.click(); sel = null; send({ t: 'undo', seq: seq++ });
  }
  // the next of your stacks that can still move or fire, in a stable order
  let cycleIdx = -1;
  function cycleReady(dir) {
    const ds = dispState(); if (!ds || (!isMyTurn() && !planning())) return;
    const hexes = [...new Set(Object.values(ds.units).filter(u => u.owner === you && E.canAct(ds, u) && (E.moveAllow(ds, u) > 0 || E.UNITS[u.type].range)).map(u => u.hex))].sort();
    if (!hexes.length) { toast('Every stack has acted. Nothing left to move.'); SFX.error(); return; }
    const cur = sel ? hexes.indexOf(sel.hex) : -1;
    cycleIdx = ((cur >= 0 ? cur : cycleIdx) + dir + hexes.length) % hexes.length;
    const k = hexes[cycleIdx]; mode = null; selectHex(k); Render.focus(k);
  }
  $('#undoBtn').onclick = doUndo;
  $('#escAuto').onclick = () => { autoEndOff = !autoEndOff; try { localStorage.setItem('sector.autoEnd', autoEndOff ? 'off' : 'on'); } catch (e) {} $('#escAuto').textContent = 'AUTO-END TURN: ' + (autoEndOff ? 'OFF' : 'ON'); SFX.click(); autoEndKey = ''; };
  $('#speedCtl').querySelectorAll('button').forEach(b => b.onclick = () => {
    if (!S) return; SFX.click();
    const v = b.dataset.v;
    if (v === 'pause') { send({ t: 'pause', on: !S.paused }); return; }
    if (S.paused) send({ t: 'pause', on: false });   // picking a speed also resumes
    send({ t: 'speed', v }); toast('Game speed: ' + { normal: 'Normal >', fast: 'Fast >>', super: 'Superspeed >>>', max: 'Max 🚀' }[v]);
  });
  // world events: a chip under the round counter and a weather layer over the map
  function renderWeather() {
    const w = S && S.weather && E.WEATHER[S.weather.id];
    const L = $('#wxLayer'); L.className = w ? 'wx-' + S.weather.id : '';
    let chip = $('#wxChip');
    if (!w || S.phase !== 'play') { if (chip) chip.remove(); return; }
    if (!chip) { chip = el('div', '', ''); chip.id = 'wxChip'; $('#leftCol').insertBefore(chip, $('#leftCol').firstChild.nextSibling); }
    if (chip.dataset.wx !== S.weather.id) { chip.classList.remove('fresh'); void chip.offsetWidth; chip.classList.add('fresh'); }
    chip.dataset.wx = S.weather.id;
    chip.innerHTML = `<small>World event · this round</small><b>${w.icon} ${w.name.toUpperCase()}</b><span>${w.desc}</span>`;
  }
  // alliances: incoming offers and pending ones
  function renderAlly() {
    const pop = $('#allyPop'), o = S && S.allyOffer;
    if (!o || S.phase !== 'play' || (o.to !== you && o.from !== you)) { pop.hidden = true; pop.dataset.k = ''; return; }
    const k = o.from + '>' + o.to; if (pop.dataset.k === k && !pop.hidden) return; pop.dataset.k = k;
    const from = S.players.find(p => p.id === o.from), to = S.players.find(p => p.id === o.to);
    if (o.to === you) {
      pop.innerHTML = `<div class="op-h">🤝 ALLIANCE OFFER</div><div><b style="color:${from.color}">${esc(from.name)}</b> proposes an alliance.</div><div class="sub">You can't attack each other, you share vision in fog of war, and if only allies are left standing you win together (in Conquest your land counts together). It lasts 5 rounds; renew it together to keep it going. Breaking it early makes you a traitor.</div><div class="row"><button class="btn green" id="alYes">ACCEPT</button><button class="btn red" id="alNo">DECLINE</button></div>`;
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
    $('#incomeLine').innerHTML = `Income <b>+$${inc.total}</b> /turn` + (inc.pact ? ` · <span style="color:#7fe0a0">🤝 +$${inc.pact}</span>` : '') + (inc.traitor ? ` · <span style="color:#ff9aa3">🗡 traitor ${inc.traitor}</span>` : '') + (planning() ? ' · <span style="color:var(--blue)">blueprint view</span>' : '');
    $('#incomeLine').title = `Base $${inc.base} + $${inc.fromHex} land (${inc.hexes} hexes, 1 per 3) + $${inc.fromSea} sea (${inc.sea} hexes, 1 per 4) + $${inc.fromRes} resources/rigs + $${inc.fish || 0} fishing + $${inc.lanes || 0} shipping lanes + $${inc.ref} refineries + $${inc.ware || 0} warehouses + $${inc.poi || 0} villages/relics + $${inc.fromRiver || 0} river valleys (${inc.river || 0} river hexes, 1 per 3)` + (inc.roots ? ` + $${inc.roots} Deep Roots (Verdant: $1 per building)` : '') + (inc.taper ? ` − $${-inc.taper} building taper (over $8)` : '') + (inc.pact ? ` + $${inc.pact} alliance dividend` : '') + (inc.cap ? ` − $${-inc.cap} war-chest cap (over $50)` : '') + (inc.traitor ? ` − $${-inc.traitor} traitor penalty (${me.traitor} turn${me.traitor > 1 ? 's' : ''} left)` : '');
    $('#hexLine').innerHTML = `⬢ ${inc.hexes} land · ≈ ${inc.sea} sea` + (inc.cut ? ` · <span style="color:#ff9aa3">${inc.cut} cut off</span>` : '') + (inc.ruined ? ` · <span style="color:#ffb03a">💣 ${inc.ruined} bombed out</span>` : '');

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
    if (E.structsOf(t).some(x => x.type === 'port')) tags.push('<span class="hp-tag">⚓ Shipping lanes: +$1 per 4 of your connected sea hexes (max $5)</span>');
    if (E.TERRAIN[t.t].defMult) tags.push(`<span class="hp-tag">+${E.TERRAIN[t.t].defMult} Mult defence</span>`);
    if (E.TERRAIN[t.t].moveCost) tags.push('<span class="hp-tag">Costs 2 move</span>');
    if (E.TERRAIN[t.t].bog) tags.push('<span class="hp-tag">Attackers −1 Mult</span>');
    if (t.fog === 1) tags.push('<span class="hp-tag">🌫 Out of sight: showing what you last saw</span>');
    if (t.poi && E.POI[t.poi] && !(t.poi === 'fort' && t.owner)) tags.push(`<span class="hp-tag" style="color:var(--gold)">${E.POI[t.poi].name}</span>`);
    if (t.contam) tags.push(`<span class="hp-tag cut">☢ Fallout ${t.contam} rounds</span>`);
    if (t.smoke) tags.push('<span class="hp-tag">Smoke</span>');
    if (ds.map.beacon === k) tags.push('<span class="hp-tag" style="color:var(--gold)">◆ BEACON</span>');
    if (t.owner === you && !E.supplySet(ds, you).has(k)) tags.push('<span class="hp-tag cut">Cut off: no income</span>');
    if (t.ruin) tags.push(`<span class="hp-tag cut">💣 Bombed out — no income for ${t.ruin} turn${t.ruin > 1 ? 's' : ''}</span>`);
    if (t.fog === 2) { box.innerHTML = '<div class="hp-title">Unexplored</div><div class="hp-own"><span class="sub">Send units or extend your borders to see what is here.</span></div>'; return; }
    let h = `<div class="hp-title">${t.contam ? 'Fallout Zone' : E.TERRAIN[t.t].name}</div><div class="hp-own">${owner ? `<span style="color:${owner.color}">■ ${esc(owner.name)}</span>` : '<span class="sub">Unclaimed</span>'}</div><div class="hp-tags">${tags.join('')}</div>`;
    if (t.poi && E.POI[t.poi] && !(t.poi === 'fort' && t.owner)) h += `<div class="urow" style="cursor:default"><img src="${Art.iconURL('poi', t.poi)}"><div class="un">${E.POI[t.poi].name}${t.gar && !t.owner ? ` <span class="hp-tag cut">garrison ${t.gar} chips${t.poi === 'village' ? ' · +' + (t.gar >= 7 ? 2 : 1) + ' mult' : ''}</span>` : ''}<div class="st">${E.POI[t.poi].desc}</div></div></div>`;
    for (const st of E.structsOf(t)) {
      const sd = E.STRUCTS[st.type], L = st.lvl || 1;
      const flags = (st.siege ? ' <span class="hp-tag cut">UNDER SIEGE</span>' : '') + (st.lock ? ' <span class="hp-tag">Online next turn</span>' : '');
      h += `<div class="urow" style="cursor:default"><img src="${Art.iconURL('struct', st.type)}"><div class="un">${sd.name} <span class="gold">${'★'.repeat(L)}</span>${flags}<div class="st">${sd.desc}${E.UPGRADABLE.includes(st.type) && L < E.MAX_SLVL && t.owner === you && st.owner === you ? '<br><b class="gold">Upgrade: $' + E.buildCost(ds, ds.players.find(p => p.id === you), st.type, k) + '</b> (build it again here)' : ''}</div></div></div>`;
    }
    if (t.bridge && t.owner === you && canCommand() && (isMyTurn() || planning())) h += `<button class="btn tiny blue hp-rot" id="hpRotate" title="Turn the bridge to face another way (free)">↻ ROTATE BRIDGE · R</button>`;
    if (t.owner === you && !t.bridge && E.structsOf(t).length < E.MAX_STRUCTS && canCommand()) h += `<div class="hp-sec">${E.MAX_STRUCTS - E.structsOf(t).length} building slot${E.MAX_STRUCTS - E.structsOf(t).length === 1 ? '' : 's'} free on this hex</div>`;
    const units = Object.values(ds.units).filter(u => u.hex === k);
    if (units.length) {
      const mine = units[0].owner === you;
      h += `<div class="hp-sec">${mine ? 'Your units' + (canCommand() ? ' — click to toggle' : '') : 'Enemy units'}</div>`;
      { const seats = units.reduce((a, u) => a + (E.UNITS[u.type].lift || 0), 0); if (seats) { const g = units.filter(u => u.type === 'grunt').length; h += `<div class="hp-tag" style="color:#9fdcff;margin:2px 0 4px">🚁 Seats for ${seats} Grunt${seats > 1 ? 's' : ''}${g ? ` · ${Math.min(g, seats)} aboard${g > seats ? ' (too many: they walk)' : ''}` : ''}</div>`; } }
      for (const u of units) {
        const d = E.UNITS[u.type], ready = E.canAct(ds, u);
        const status = u.stun ? 'FROZEN' : u.fresh && !ready ? 'just deployed' : u.moved ? 'done' : ready ? 'ready' : '';
        h += `<div class="urow${sel.units.has(u.id) ? ' sel' : ''}${mine && !ready ? ' done' : ''}" data-u="${u.id}"><img src="${Art.iconURL('unit', u.type, mine ? '#fff' : pColor(u.owner))}"><div class="un">${d.name}<div class="us"><span class="a">ATK ${d.atk}</span><span class="d">DEF ${d.def}</span><span>MV ${E.moveAllow(ds, u)}${d.range ? ' · RNG ' + d.range : ''}</span></div></div><div class="st">${status}</div></div>`;
      }
    }
    if (t.owner === you && !t.struct && canCommand()) h += '<div class="hp-sec">Build here with the hotbar · keys Z–M</div>';
    box.innerHTML = h;
    { const rb = $('#hpRotate'); if (rb) rb.onclick = () => rotateBridge(k); }
    box.querySelectorAll('.urow[data-u]').forEach(r => r.onclick = () => {
      const id = +r.dataset.u, u = ds.units[id];
      if (!u || u.owner !== you || !E.canAct(ds, u) || !canCommand()) return;
      sel.units.has(id) ? sel.units.delete(id) : sel.units.add(id);
      SFX.click(); refreshAll();
    });
  }

  function rotateBridge(k) { const t = k && dispState().map.tiles[k]; if (!t || !t.bridge || t.owner !== you) return false; SFX.click(); doAction({ a: 'rotateBridge', hex: k }); return true; }
  function cardEl(id, opts = {}) { return Cards.make(id, opts); }

  // ───────────── bars: unit deck (cards, keys 1-0), build bar (Z-M), tactic hand ─────────────
  const UNIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const BUILD_KEYS = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'];
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
    s.innerHTML = `<span class="sk">${key.toUpperCase()}</span><img src="${Art.iconURL('struct', id, '#1b1712', 72)}"><span class="bname${name.length > 8 ? ' long' : ''}">${name}</span><span class="sc">$${cost}</span>` + (ups.length && id !== 'hq' ? `<span class="up" title="${ups.length} can be upgraded">▲${ups.length}</span>` : '');
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
    $('#deckBar .bar-label').textContent = `DECK ${units.length}/${E.DECK_MAX}` + (isTouchDevice ? '' : ' · KEYS 1–0');   // no keyboard on a phone
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
    const hz = parseFloat(getComputedStyle($('#hud')).getPropertyValue('--hz')) || 1;   // it lives in the HUD, which is scaled by --hz
    tip.style.left = (r.left + r.width / 2) / hz + 'px'; tip.style.top = (r.top - 12) / hz + 'px';
    tip.hidden = false; slotTipFor = slot;
  }
  function hideSlotTip() { $('#slotTip').hidden = true; slotTipFor = null; }
  let slotTipFor = null;
  // any menu opening clears hover-only UI (card zoom, build tips, hex tooltip) so nothing floats on top of it
  function clearHoverUI() { Cards.zoomHide(); hideSlotTip(); const t = $('#tooltip'); if (t) t.hidden = true; }
  { const watched = ['#supply', '#crate', '#draft', '#combat', '#trade', '#market', '#offerPop', '#index', '#rules', '#modal', '#escMenu', '#hostPanel', '#victory', '#passCover', '#closedCover'];
    const covers = ['#supply', '#crate', '#draft', '#index', '#mapReel'];
    const mo = new MutationObserver(muts => {
      if (muts.some(m => !m.target.hidden)) clearHoverUI();
      document.body.classList.toggle('overlay-open', covers.some(id => { const e = $(id); return e && !e.hidden; }));
    });
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
    // a card lands on a card-sized slot: an empty bar (a hand with no cards yet) is far wider than a card, so aim for
    // its start and never grow on the way (scaling to the bar's width made the card balloon)
    const slot = t.width > r.width * 1.5 ? { left: t.left, top: t.top, width: Math.min(t.width, r.width * 0.6), height: t.height } : t;
    const dx = slot.left + slot.width / 2 - (r.left + r.width / 2), dy = slot.top + slot.height / 2 - (r.top + r.height / 2);
    const sc = Math.min(1, Math.max(0.2, Math.min(slot.width / r.width, slot.height / r.height)));
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
    if (!clock) { clock = el('div', '', '<div class="tc-bar"><i></i></div><span></span>'); clock.id = 'turnClock'; $('#centerStack').appendChild(clock); }
    const total = (S.settings.timer || 0) * 1000;
    const draw = () => {
      if (clockPaused) localDeadline = Date.now() + pausedLeft;   // frozen while a fight or crate plays out
      const left = localDeadline ? Math.max(0, localDeadline - Date.now()) : 0, s = Math.ceil(left / 1000);
      b.innerHTML = 'END TURN' + (localDeadline && mine ? `<span class="tmr">${s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : s + 's'} left</span>` : '');
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
  $('#endBtn').onclick = async () => { if (!isMyTurn() || animating) return; if (Missions.holdEnd()) { SFX.error(); return; } mode = null; sel = null; SFX.click(); await act({ a: 'end' }); };

  let titleBlink = null;
  function renderTurnPill() {
    let pill = $('#turnPill');
    if (!pill) { pill = el('div', '', ''); pill.id = 'turnPill'; $('#centerStack').insertBefore(pill, $('#centerStack').firstChild); pill.onclick = () => { const c = curP(); if (c && c.hq) Render.focus(c.hq); }; }
    const c = S && S.phase === 'play' && curP();
    const mine = isMyTurn();
    document.body.classList.toggle('my-turn', !!(c && mine));
    if (mine) document.body.style.setProperty('--myc', pColor(you));
    if (!c) { pill.hidden = true; document.title = 'SECTOR'; return; }
    pill.hidden = false;
    pill.style.setProperty('--pc', c.color);
    pill.className = mine ? 'mine' : '';
    const order = S.players.filter(p => p.alive), i = order.findIndex(p => p.id === c.id);
    const next = order[(i + 1) % order.length];
    const meNext = !mine && myP() && myP().alive && next && next.id === you;
    if (S.paused) { pill.className = ''; pill.innerHTML = `<b>⏸ PAUSED</b><span>${esc(c.name)}'s turn · press ▶ to resume</span>`; return; }
    if (mine) pill.innerHTML = `<b>▶ YOUR TURN</b><span>${S.turn.stage === 'choose' ? 'Pick your resupply' : 'Move, deploy, build, then END TURN'}</span>`;
    else pill.innerHTML = `<b>⏳ ${esc(c.name.toUpperCase())}'S TURN${c.bot ? ' 🤖' : ''}</b><span>${meNext ? '⚡ You\'re up next: plan with the Blueprint' : myP() && myP().alive ? 'Plan your next turn with the Blueprint' : 'Spectating'}</span>`;
    // tab title: blink while it's your turn and the tab is in the background
    clearInterval(titleBlink); document.title = mine ? '▶ YOUR TURN · SECTOR' : 'SECTOR';
    if (mine && document.hidden) { let on = false; titleBlink = setInterval(() => { document.title = (on = !on) ? '▶ YOUR TURN · SECTOR' : '⚔ SECTOR'; if (!document.hidden) { clearInterval(titleBlink); document.title = '▶ YOUR TURN · SECTOR'; } }, 900); }
  }
  // auto-finish: when nothing is left to do (no stack can act, nothing affordable to deploy or build, no tactic to play), end the turn after a short countdown
  let autoEndT = null, autoEndKey = '', autoEndOff = false;
  try { autoEndOff = localStorage.getItem('sector.autoEnd') === 'off'; } catch (e) {}
  function nothingLeft() {
    const ds = S, me = myP(); if (!me) return false;
    if (S.turn.stage !== 'act' || S.trade || S.allyOffer || plan.length) return false;
    if (Object.values(ds.units).some(u => u.owner === you && E.canAct(ds, u) && (E.moveAllow(ds, u) > 0 || E.UNITS[u.type].range))) return false;
    if (me.arsenal.some(t => E.unitCost(me, t) <= me.cash && E.deployHexes(ds, you, t).length)) return false;
    if (Object.keys(E.STRUCTS).some(st => E.buildHexes(ds, you, st).some(k => E.buildCost(ds, me, st, k) <= me.cash))) return false;
    if (me.tactics.some(c => { const d = E.TACTICS[c.id]; return d && d.cost <= me.cash && (d.target === 'none' || E.tacticTargets(ds, you, c.id).length); })) return false;
    return true;
  }
  function checkAutoEnd() {
    const key = S ? [S.turn.round, S.turn.idx, S.v, S.turn.stage, !!mode, animating, executing, plan.length].join(':') : '';
    if (autoEndKey === key) return; autoEndKey = key;
    clearTimeout(autoEndT); autoEndT = null; const old = $('#autoEnd'); if (old) old.remove();
    if (autoEndOff || !isMyTurn() || animating || executing || mode || !nothingLeft()) return;
    const box = el('div', '', 'Nothing left to do. Ending your turn in <b>3</b>… <button class="btn tiny">STAY</button>'); box.id = 'autoEnd'; $('#actions').insertBefore(box, $('#actions').firstChild);
    let n = 3;
    const tick = () => { n--; if (n <= 0) { box.remove(); autoEndT = null; if (isMyTurn() && !animating && !executing && nothingLeft()) $('#endBtn').click(); return; } box.querySelector('b').textContent = n; autoEndT = setTimeout(tick, 1000); };
    autoEndT = setTimeout(tick, 1000);
    box.querySelector('button').onclick = () => { clearTimeout(autoEndT); autoEndT = null; box.remove(); toast('Staying. Press END TURN when you\'re done.'); };
  }
  function renderModeHint() {
    const h = $('#modeHint'); let txt = '';
    if (mode && mode.type === 'deploy') txt = `Deploy ${E.UNITS[mode.unit].name} — click a glowing ${E.isSea(mode.unit) ? 'sea hex by your Port' : 'HQ / FOB'} · right-click to stop`;
    else if (mode && mode.type === 'build') txt = mode.struct === 'hq' ? 'Fortify HQ — click your HQ' : `Build or upgrade ${E.STRUCTS[mode.struct].name} — click a glowing hex · right-click to stop`;
    else if (mode && mode.type === 'tactic') { const d = E.TACTICS[mode.id]; txt = d.target === 'heli' && !mode.from ? 'Heli Drop — pick the stack to fly' : ['enemyHand', 'enemyHex'].includes(d.target) ? `${d.name} — press 🎯 TARGET on a rival's name (or click their land) · right-click to cancel` : `${d.name} — pick a target · right-click to cancel`; }
    else if (mode && mode.type === 'intel') txt = `Intel op — click any hex to scout 2 hexes around it ($${E.intelCost(S, you)}) · right-click to cancel`;
    else if (pingArm) txt = 'Click a hex to ping it';
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
      const gunU = (ov.guns || [...sel.units]).map(id => ds.units[id]).filter(Boolean);
      if (!Object.values(ds.units).some(u => u.hex === k)) html = `<b>SHELL</b> <span class="odds" style="color:var(--green)">100%</span><div class="sub">No troops there: the shells always hit, and the biggest building loses a level.</div>`;
      else html = combatTip('BOMBARD', E.combatCalc(ds, you, gunU, sel.hex, k, true)) + `<div class="sub">${fireNote(gunU)}</div>`;
    } else if (ov.reach && ov.reach[k] && ov.reach[k].kind === 'capture') html = '<b>SEIZE</b>: empty ' + (E.isWater(ds.map.tiles[k]) ? 'sea lane' : 'enemy hex');
    else if (ov.reach && ov.reach[k] && ov.reach[k].kind === 'board') html = '<b>BOARD</b>: climb aboard the transport';
    else if (mode && mode.type === 'build' && ov.spawn && ov.spawn.has(k)) {
      // build mode: show what this hex costs, upgrade or fresh build, and mirror it on the build-bar tile
      const me = ds.players.find(p => p.id === you), t = ds.map.tiles[k], ex = E.structsOf(t).find(x => x.type === mode.struct);
      const cost = E.buildCost(ds, me, mode.struct, k), name = mode.struct === 'hq' ? 'HQ' : E.STRUCTS[mode.struct].name, L = ex ? (ex.lvl || 1) : 0;
      html = ex ? `<b>UPGRADE ${name.toUpperCase()}</b> <span class="gold">${'★'.repeat(L)}</span> → <span class="gold">${'★'.repeat(L + 1)}</span><div class="tip-cost">$${cost}</div>`
                : `<b>BUILD ${name.toUpperCase()}</b><div class="tip-cost">$${cost}</div>`;
      if (me && me.cash < cost) html += `<div class="sub" style="color:#ff8a7a">Need $${cost - me.cash} more</div>`;
      const sc = document.querySelector(`.slot.k-build[data-id="${mode.struct}"] .sc`);
      if (sc) { if (sc.dataset.base === undefined) sc.dataset.base = sc.textContent; sc.textContent = '$' + cost; sc.classList.toggle('upg', !!ex); }
    }
    else {
      const t = ds.map.tiles[k];
      const units = Object.values(ds.units).filter(u => u.hex === k);
      if (!units.length && !t.struct && !t.res && !t.owner) return hideTip();
      if (t.fog === 2) html = '<b>Unexplored</b>'; else html = `<b style="color:${t.owner ? pColor(t.owner) : '#fff'}">${t.owner ? esc(pName(t.owner)) : 'Unclaimed'}</b> · ${t.bridge ? 'Bridge' : t.contam ? 'Fallout' : E.TERRAIN[t.t].name}` + (t.res ? ` · <span style="color:#9ffcf2">${E.isWater(t) ? 'Oil rig' : 'Resource'} +$2</span>` : '') + (t.fish ? ' · <span style="color:#9ffcf2">Fishing grounds +$1</span>' : '') + (t.poi && E.POI[t.poi] && !(t.poi === 'fort' && t.owner) ? ` · <span style="color:var(--gold)">${E.POI[t.poi].name}</span>` : '');
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
      `${c.def.pid ? `<b style="color:${pColor(c.def.pid)}">${esc(pName(c.def.pid))}</b>` : 'Them'}: <span style="color:var(--chips)">${c.def.chips}</span> × (d6<span style="color:var(--mult)">${c.def.mult ? '+' + c.def.mult : ''}</span>)` + (c.def.bonuses.length ? `<div class="sub">${bon(c.def.bonuses)}</div>` : '') +
      // say plainly who this hits, and that it means war with them
      (c.def.pid && c.def.pid !== you ? `<div class="sub" style="color:#ff9aa3">⚔ An attack on ${esc(pName(c.def.pid))}: you are not allied</div>` : '');
  }
  // what a ranged hit does, by the guns firing (it matches resolveFire in the engine)
  function fireNote(units) {
    const ab = units.map(u => (E.UNITS[u.type] || {}).ability);
    if (units.length && ab.every(a => ['aa', 'sam'].includes(a))) return 'Hit: brings down 1 aircraft. Miss: nothing happens.';
    const extra = ab.includes('ballistic') ? 1 : 0, n = k => k + extra;
    return `Hit: destroys ${n(1)} unit${n(1) > 1 ? 's' : ''}, ${n(2)} if your score is 1.6× theirs, ${n(3)} at 2.5×` + (ab.includes('salvo') ? ', and the rockets also hit 1 unit on each enemy stack next to it' : '') + '. Miss: nothing happens.';
  }
  function hideTip() { document.querySelectorAll('.slot.k-build .sc[data-base]').forEach(e => { e.textContent = e.dataset.base; delete e.dataset.base; e.classList.remove('upg'); }); $('#tooltip').hidden = true; }

  // ───────────── combat sequence (chips × mult) ─────────────
  function dieFace(d, n) {
    const on = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[n];
    d.innerHTML = ''; for (let i = 0; i < 9; i++) d.appendChild(el('i', on.includes(i) ? 'on' : ''));
  }
  // a fight with a 100% win chance skips the dice: the defenders are crushed on the spot
  // is a human commander (not a bot, not a bot covering for someone away) on either side of this fight?
  function humanIn(ev) {
    const human = pid => { const p = pid && S.players.find(x => x.id === pid); return !!p && !p.bot; };
    return human(ev.att.pid) || human(ev.def.pid);
  }
  // a fight between bots: a short flash on the map, the result in a float, no dice tray
  async function quickClash(ev) {
    const col = pColor(ev.att.pid), k = gameSpeed() === 'max' ? 0.3 : 1;
    if (!ev.ranged) for (const st of ev.stages || [ev.from]) if (st) Render.beam(st, ev.to, col, 0.25 * speed(), 30);
    await sleep(180 * k);
    Render.burst(ev.to, ['#ffcf5a', '#ff5a2a', '#fff'], ev.attWin ? 26 : 14, { speed: 1.4 }); SFX.boom(ev.attWin ? 0.7 : 0.45); Render.shake(ev.attWin ? 5 : 3);
    if (ev.ranged) Render.float(ev.to, ev.attWin ? (ev.killed.length ? 'HIT · ' + ev.killed.length + ' DESTROYED' : 'HIT') : 'MISS', ev.attWin ? '#ff4f5e' : '#cfd8df', ev.attWin ? 20 : 16);   // a shot reads like a strike
    else Render.float(ev.to, ev.attWin ? '⚔ ' + pName(ev.att.pid).toUpperCase() + ' WINS' : '🛡 HELD', ev.attWin ? col : (ev.def.pid ? pColor(ev.def.pid) : '#cfd8df'), 16);
    await sleep(320 * k);
  }
  async function obliterate(ev) {
    const all = ev.killed.length >= ev.def.units.length;
    const word = ev.ranged && !all ? 'DIRECT HIT!' : 'OBLITERATED!';
    const [x, y] = Render.screenOf(ev.to);
    // wind-up: attacker stacks lunge in (unless they already drove onto the hex)
    if (!ev.landed) { if (!ev.ranged) for (const st of ev.stages || [ev.from]) Render.beam(st, ev.to, pColor(ev.att.pid), 0.25 * speed(), 40); SFX.whoosh(); await sleep(180); }
    else for (const id of ev.killed.concat(ev.pyrrhic || [])) if (S.units[id] && S.units[id].owner !== ev.att.pid) delete S.units[id];   // the defenders vanish in the blast
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
    later(1.9, () => t.remove());
    await sleep(1100);
  }
  async function showCombat(ev) {
    try { await combatSeq(ev); } catch (e) { console.error(e); }
    $('#combat').hidden = true; $('#combat').onclick = null; curFight = null;
  }
  // skipping: a fight skipped by anyone in it (or by anyone at all, for bot-vs-bot fights) skips for everyone watching
  let curFight = null;
  function skipAnim() {
    if (!animating && !curFight) return;
    // human against human: both have to ask, and each sees that the other has
    if (curFight && curFight.def && isHumanSeat(curFight.att) && isHumanSeat(curFight.def) && (curFight.att === you || curFight.def === you)) {
      if (curFight.voted) return;
      curFight.voted = true; send({ t: 'skipFx', att: curFight.att, def: curFight.def, to: curFight.to }); skipStatus([you]);
      return;
    }
    fastForward = true;
    if (curFight) send({ t: 'skipFx', att: curFight.att, def: curFight.def, to: curFight.to });
  }
  function skipStatus(pids) {
    const box = $('#combat'); if (!box || box.hidden || !curFight) return;
    let st = box.querySelector('.cb-skip'); if (!st) { st = el('div', 'cb-skip', ''); box.appendChild(st); }
    st.innerHTML = [curFight.att, curFight.def].map(pid => `<span style="--pc:${pColor(pid)}" class="${pids.includes(pid) ? 'on' : ''}">${pids.includes(pid) ? '⏩' : '⏸'} ${esc(pName(pid))}${pids.includes(pid) ? ' skipped' : pid === you ? ' · Space to skip' : ' watching'}</span>`).join('');
  }
  let lastBattle = null;
  function combatSeq(ev) {
    return new Promise(async (resolve, reject) => { try {
      const box = $('#combat'); box.innerHTML = ''; box.hidden = false;
      fastForward = false;
      box.onclick = () => skipAnim();
      curFight = { att: ev.att.pid, def: ev.def.pid || null, to: ev.to };
      const wrap = el('div', 'cb');
      const cont = lastBattle && lastBattle.key === ev.att.pid + '>' + ev.to && Date.now() - lastBattle.at < 4000; if (cont) lastBattle = null;
      const nap = ms => sleep(cont ? Math.min(ms, 30) : ms);
      const side = (role, data, name, color) => {
        const s = el('div', 'cb-side'); s.style.setProperty('--pc', color);
        s.innerHTML = `<div class="cb-role">${role}</div><div class="cb-name">${esc(name)}</div><div class="cb-units"></div><div class="bp-thrown"></div><div class="cb-bon"></div><div class="cb-calc"><div class="cb-box chips">0</div><div class="cb-x">×</div><div class="cb-box mult">0</div></div><div class="cb-die"></div><div class="cb-score">0</div>`;
        dieFace(s.querySelector('.cb-die'), 1);
        return s;
      };
      const A = side(ev.ranged ? 'BOMBARDMENT' : 'ATTACKER', ev.att, pName(ev.att.pid), pColor(ev.att.pid));
      const D = side('DEFENDER', ev.def, ev.def.pid ? pName(ev.def.pid) : 'Garrison', ev.def.pid ? pColor(ev.def.pid) : '#aaa');
      const vs = el('div', 'cb-vs', 'VS');
      wrap.append(A, vs, D);
      wrap.appendChild(el('div', 'cb-odds', `Pre-battle odds ${Math.round(ev.winProb * 100)}% · Click to skip`));
      box.appendChild(wrap);
      if (!cont) SFX.whoosh();
      await nap(250);
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
          const cu = s.querySelector('.cb-units'), card = Cards.make(t, { mini: true, variant: vOf(si ? ev.def.pid : ev.att.pid, t) }); card.classList.add('cb-card');
          card.style.setProperty('--n', d.units.length); card.style.setProperty('--i', i); cu.appendChild(card);
          counters[si] += unitChips(d, si === 0)[i];
          const box = s.querySelector('.chips'); box.textContent = counters[si]; box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit');
        });
        SFX.chip(note++);
        await nap(170);
      }
      // the battle cards each side threw in
      if (ev.cards) sides.forEach(([s], si) => { for (const id of ev.cards[si ? 'def' : 'att'] || []) { const c = Cards.make(id, { mini: true, variant: vOf(si ? ev.def.pid : ev.att.pid, id) }); c.classList.add('bp-tc'); s.querySelector('.bp-thrown').appendChild(c); } });
      // bonuses
      const mults = [0, 0];
      const maxB = Math.max(ev.att.bonuses.length, ev.def.bonuses.length);
      for (let i = 0; i < maxB; i++) {
        sides.forEach(([s, d], si) => {
          const b = d.bonuses[i]; if (!b) return;
          const row = el('div', 'cb-b', b.chips || b.mult ? `<span>${b.label}</span><span class="v ${b.chips ? 'c' : 'm'}">${b.mult < 0 ? '' : '+'}${b.chips || b.mult} ${b.chips ? 'Chips' : 'Mult'}</span>` : `<span>${b.label}</span>`);
          s.querySelector('.cb-bon').appendChild(row);
          if (!b.chips && !b.mult) return;
          if (b.chips) { counters[si] += b.chips; const bx = s.querySelector('.chips'); bx.textContent = counters[si]; bx.classList.remove('hit'); void bx.offsetWidth; bx.classList.add('hit'); }
          else { mults[si] += b.mult; const bx = s.querySelector('.mult'); bx.textContent = '+' + mults[si]; bx.classList.remove('hit'); void bx.offsetWidth; bx.classList.add('hit'); }
        });
        SFX.mult(i);
        await nap(260);
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
        if (d.raw !== d.roll) { dice[si].classList.add('loaded'); s.querySelector('.cb-bon').appendChild(el('div', 'cb-b', `<span>🎲 Loaded Dice</span><span class="v m">${d.raw} → 3</span>`)); }
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
      const res = el('div', 'cb-result', txt + (ev.pyrrhic.length ? '<small>Pyrrhic: the winner lost a unit</small>' : ''));
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
      const onKey = e => { if (e.key !== ' ') return; const d = dice.find(d => d.human && !d.thrown); if (!d) return; e.preventDefault(); e.stopPropagation(); fling(d, -d.side * (900 + Math.random() * 500), (Math.random() - 0.5) * 700); };
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
          // heavier felt: dice slow quickly, and never tumble for more than ~1.4s
          d.rollT = (d.rollT || 0) + dt;
          const fr = Math.pow(d.rollT > 0.8 ? 0.06 : 0.16, dt); d.vx *= fr; d.vy *= fr; d.va *= Math.pow(0.18, dt);
          d.travel += Math.hypot(d.vx, d.vy) * dt;
          if (d.travel > 26) { d.travel = 0; d.face = 1 + Math.floor(Math.random() * 6); }
          let hit = 0;
          if (d.x < SZ / 2) { d.x = SZ / 2; d.vx = Math.abs(d.vx) * 0.7; hit = Math.abs(d.vx); }
          if (d.x > W - SZ / 2) { d.x = W - SZ / 2; d.vx = -Math.abs(d.vx) * 0.7; hit = Math.abs(d.vx); }
          if (d.y < SZ / 2) { d.y = SZ / 2; d.vy = Math.abs(d.vy) * 0.7; hit = Math.abs(d.vy); }
          if (d.y > H - SZ / 2) { d.y = H - SZ / 2; d.vy = -Math.abs(d.vy) * 0.7; hit = Math.abs(d.vy); }
          if (hit > 80) { d.va += (Math.random() - 0.5) * 20; SFX.step(); if (hit > 300) Render.shake(2); for (let i = 0; i < 5; i++) parts.push({ x: d.x, y: d.y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0, max: 0.3, col: 'rgba(255,255,255,.7)' }); }
          if ((Math.hypot(d.vx, d.vy) < 55 && Math.abs(d.va) < 4) || d.rollT > 1.4) settle(d);
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
          c.fillText('DRAG AND FLING, OR PRESS SPACE!', W / 2, H / 2 + 8);
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
  // at Super and Max speed only banners about you show (your turn, your HQ, a betrayal of you...): the rest would just flash past
  function banner(text, sub, color, mine) {
    if (!mine && ['super', 'max'].includes(gameSpeed())) return;
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
  // is this move the run-up to a fight that plays as a one-hit obliteration?
  const oblitPlays = e => e.e === 'combat' && !e.ranged && e.attWin && (e.crush || e.winProb >= 0.95) && humanIn(e) && gameSpeed() !== 'max';
  function oblitAfter(events, ev) {
    for (let j = events.indexOf(ev) + 1; j < events.length; j++) { const e = events[j]; if (e.e === 'move') continue; return oblitPlays(e) ? e : null; }
    return null;
  }
  // fog of war: an event that happens entirely in hexes you can't see (and doesn't involve you) is silent, and its
  // effects (encirclement banners, loot, builds, fights) don't play
  const HIDDEN_FX = new Set(['annex', 'loot', 'build', 'deploy', 'razed', 'combat', 'capture', 'cache', 'bridge', 'digin', 'fire', 'tactic', 'airstrike', 'strike']);
  function unseen(e) {
    if (!S || !S.fogOn) return false;
    if (e.pid === you || e.to === you || e.victim === you || (e.att && e.att.pid === you) || (e.def && e.def.pid === you)) return false;
    const ks = [e.hex, e.to, e.from, e.target, e.at, ...(e.path || []), ...(e.hexes || [])].filter(k => typeof k === 'string' && S.map.tiles[k]);
    return ks.length > 0 && ks.every(k => S.map.tiles[k].fog);
  }
  async function playEvents(events, by) {
    Render.setState(S); evBy = by;
    const watch = by !== you;
    try { for (const ev of events) {
      const hid = unseen(ev); SFX.quiet = hid;
      if (hid && HIDDEN_FX.has(ev.e)) continue;
      switch (ev.e) {
        case 'turn': {
          const p = S.players.find(x => x.id === ev.pid);
          if (ev.pid === you) {
            SFX.yourTurn(); banner('YOUR TURN', 'Round ' + ev.round, pColor(you), true);
            const [hx, hy] = Render.screenOf(p.hq);
            if (hx < 0 || hx > innerWidth || hy < 0 || hy > innerHeight) Render.focus(p.hq);
          }
          else { SFX.turn(); banner(p.name.toUpperCase(), 'Round ' + ev.round, p.color); }
          await sleep(ev.pid === you ? 900 : 500);
          break;
        }
        case 'income': Render.float(ev.hq, '+$' + ev.amount, '#ffc53d', 22); if (ev.pid === you) SFX.coin(Math.min(8, ev.amount / 2 | 0)); await sleep(250); break;
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
          if (ev.pid === you && d && ev.refund) { toast(`${d.name} is maxed: +$${ev.refund}`); break; }
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
          await tween(ev.pid === you ? 150 : 260, p => { Render.unitPos[u.id] = { x, y: y - 120 * (1 - p * p) }; });
          delete Render.unitPos[u.id]; Render.extraUnits.splice(Render.extraUnits.indexOf(u), 1);
          S.units[u.id] = u;
          if (ev.claimed) flipTile(ev.hex, ev.pid, 3);
          if (ev.muster) { Render.ring(ev.hex, '#ff4a2a', 60, 0.5, 5); Render.float(ev.hex, 'MUSTER! READY TO FIGHT', '#ffb03a', 16); if (ev.pid === you) SFX.rare(); }
          SFX.deploy(); Render.shake(3); Render.burst(ev.hex, ['#c9b78f', '#8f8068'], 14, { up: 30, g: 120, size: 3 }); Render.ring(ev.hex, pColor(ev.pid), 40, 0.4, 3);
          if (ev.pid === you) continue; await sleep(120); break;
        }
        case 'build': {
          { const tt = S.map.tiles[ev.hex]; tt.structs = E.structsOf(tt).slice(); const ex = tt.structs.find(x => x.type === ev.struct);
            if (ex) ex.lvl = ev.lvl || ex.lvl; else tt.structs.push({ type: ev.struct, owner: ev.pid, lvl: ev.lvl || 1, lock: ev.lock || 0 });
            if (!tt.struct || ev.struct === 'hq' || ev.struct === 'fob') tt.struct = tt.structs.find(x => x.type === ev.struct); }
          if (ev.lvl > 1) { Render.ring(ev.hex, '#ffc53d', 70, 0.6, 5); Render.float(ev.hex, '★'.repeat(ev.lvl) + ' UPGRADED', '#ffc53d', 18); }
          Render.pop(ev.hex); SFX.build(); Render.burst(ev.hex, [pColor(ev.pid), '#fff', '#ffc53d'], 22, { square: true, up: 140 }); Render.float(ev.hex, E.STRUCTS[ev.struct].name.toUpperCase(), '#fff', 16);
          if (ev.pid === you) continue; await sleep(350); break;
        }
        case 'move': {
          if (watch) { follow(ev.path[ev.path.length - 1]); await sleep(150); }
          // a sure win: the troops roll straight onto the target and it goes up as they land, instead of stopping short first
          const ob = oblitAfter(events, ev);
          if (ob && E.dist(ev.path[ev.path.length - 1], ob.to) === 1) { await animMove({ ...ev, path: ev.path.concat([ob.to]) }); ob.landed = true; }
          else await animMove(ev);
          break;
        }
        case 'combat': {
          follow(ev.to);
          if (ev.def && ev.def.pid === you && ev.att.pid !== you) pushAlert(`⚔ ${pName(ev.att.pid)} ${ev.overwatch ? 'fired on' : 'attacked'} you${ev.attWin ? '. You lost the fight' : '. You held'}`, ev.to);
          if (ev.overwatch) { Render.float(ev.from, '🎯 OVERWATCH', '#ffc53d', 18); }
          if (ev.ranged) await fireFx(ev.att.units, ev.from, ev.to);
          // the dice tray is for fights a human is in: bot-vs-bot (or bot-vs-garrison) plays a quick clash on the map.
          // A 95%+ fight that went the expected way skips the dice and the long animation too
          // at max speed nothing waits on the dice tray either
          if (!humanIn(ev) || gameSpeed() === 'max') await quickClash(ev);
          else if (ev.crush || (ev.attWin && ev.winProb >= 0.95)) await obliterate(ev); else await showCombat(ev);
          if (ev.landed) { for (const id of ev.killed.concat(ev.pyrrhic || [])) delete S.units[id]; ev.killed = []; ev.pyrrhic = []; }   // already blown up on landing
          if (ev.splash && ev.splash.length) {
            // MLRS salvo: rockets rain on the stacks around the target
            for (const id of ev.splash) { const u = S.units[id]; if (u) { Render.burst(u.hex, ['#ffcf5a', '#ff5a2a', '#fff'], 18, { speed: 1.3 }); Render.float(u.hex, 'SALVO', '#ffb03a', 16); } }
            SFX.boom(0.8); Render.shake(8);
          }
          killUnits(ev.killed.concat(ev.pyrrhic, ev.splash || []), ev.killed.length > 2);
          await sleep(350); break;
        }
        case 'advance': {
          const path = [ev.from, ev.to];
          const landed = events.some(e => e.e === 'combat' && e.landed && e.to === ev.to);
          if (landed) for (const id of ev.units) { if (S.units[id]) S.units[id].hex = ev.to; } else await animMove({ pid: ev.pid, units: ev.units, path, captures: [] }, true);
          flipTile(ev.to, ev.pid, 6); Render.ring(ev.to, pColor(ev.pid), 70, 0.6, 5);
          await sleep(200); break;
        }
        case 'airbase': {
          // your airbase rolls out this turn's strike card
          if (ev.pid === you) { const d = E.cardDef(ev.card); Render.float(ev.hex, '✈ ' + (d ? d.name.toUpperCase() : 'STRIKE') + ' READY', '#9fd8ff', 16); SFX.card(); }
          break;
        }
        case 'marketOpen': {
          if (ev.pid === you) { banner('🕶 BLACK MARKET OPEN', 'Your economy has connections now: buy tactic cards for cash every turn', '#c58bff', true); SFX.legendary(); await sleep(900); }
          break;
        }
        case 'silo': {
          const d = E.cardDef(ev.card);
          follow(ev.hex); Render.lance(ev.hex, '#ffffff', 0.8 * speed()); Render.ring(ev.hex, '#fff', 90, 0.8, 6); SFX.legendary();
          banner('🚀 SILO ARMED', pName(ev.pid) + ' gets ' + (d ? d.name : 'a mythic'), '#ffffff');
          if (ev.pid === you) Render.flash(0.4, '#ffffff');
          await sleep(1100); break;
        }
        case 'eliminate': {
          const p = S.players.find(x => x.id === ev.pid);
          SFX.alarm(); Render.flash(0.5, '#ff2030'); Render.shake(22);
          banner(p.name.toUpperCase() + ' HAS FALLEN', ev.by ? 'conquered by ' + pName(ev.by) + (ev.plunder ? ' · +$' + ev.plunder + ' plunder' + (ev.cards ? ' + ' + ev.cards + ' card' + (ev.cards > 1 ? 's' : '') : '') : '') : '', '#b52b38');
          if (ev.by === you && ev.plunder) { toast(`💰 Spoils of war: +$${ev.plunder}${ev.cards ? ' and ' + ev.cards + ' of their cards' : ''}`, 'good'); SFX.coin(8); }
          killUnits(ev.units.filter(id => S.units[id]), true);
          const hexes = ev.hexes.slice().sort((a, b) => E.dist(a, ev.hq) - E.dist(b, ev.hq));
          const taken = new Set(ev.taken || (ev.by ? hexes : []));
          for (let i = 0; i < hexes.length; i++) { if (taken.has(hexes[i])) flipTile(hexes[i], ev.by, i % 12); else { const tt = S.map.tiles[hexes[i]]; tt.owner = null; tt.structs = (tt.structs || []).filter(x => x.type === 'bridge'); tt.struct = tt.structs[0] || null; Render.recolor(); } await sleep(18); }
          await sleep(700);
          if (ev.pid === you) { SFX.lose(); toast('Your HQ fell. You can keep watching.', 'err'); }
          break;
        }
        case 'tactic': if (ev.target) { follow(ev.target); await sleep(200); } await animTactic(ev); break;
        case 'undo': if (ev.pid === you) toast('↶ Undone'); break;
        case 'crash': { const at = ev.units.map(id => S.units[id]).find(Boolean); if (at) Render.float(at.hex, '🚁 WENT DOWN', '#ffb03a', 16); killUnits(ev.units, true); await sleep(300); break; }
        case 'bridgeRot': { const tt = S.map.tiles[ev.hex]; if (tt) tt.bridgeRot = ev.rot; Render.invalidate(); SFX.click(); break; }
        case 'overwatch': { for (const id of ev.units) if (S.units[id]) { S.units[id].ow = true; S.units[id].moved = true; } Render.ring(ev.hex, pColor(ev.pid), 45, 0.6, 3); if (ev.pid === you) toast('🎯 On overwatch: they will fire on enemies that stop next to them'); break; }
        case 'radar': { Render.ring(ev.hex, '#59f08a', 60, 1.2, 3); Render.float(ev.hex, '📡 CONTACT', '#59f08a', 16); pushAlert('📡 Enemy contact near your land', ev.hex); break; }
        case 'gift': {
          const what = ev.amount ? '$' + ev.amount : (E.TACTICS[ev.card] || {}).name || 'a card';
          if (ev.to === you) { toast(`🎁 ${pName(ev.pid)} sent you ${what}`, 'good'); SFX.coin(ev.amount ? 4 : 1); }
          else if (ev.pid === you) toast(`Sent ${pName(ev.to)} ${what}`);
          if (!$('#teamPanel').hidden) renderTeam();
          break;
        }
        case 'donate': {
          for (const id of ev.units) if (S.units[id]) S.units[id].owner = ev.to;
          Render.ring(ev.hex, pColor(ev.to), 60, 0.6, 4); Render.float(ev.hex, '🎁 ' + pName(ev.to).toUpperCase(), pColor(ev.to), 15); SFX.select();
          if (ev.to === you) toast(`🎁 ${pName(ev.pid)} gave you ${ev.units.length} unit${ev.units.length > 1 ? 's' : ''}`, 'good');
          break;
        }
        case 'evicted': {
          // the pact ended with troops still across the border
          for (const id of ev.units) { const u = S.units[id]; if (u) { Render.burst(u.hex, ['#ff4f5e', '#fff'], 18, { up: 120 }); Render.float(u.hex, 'CUT OFF', '#ff8a5a', 18); } }
          killUnits(ev.units.filter(id => S.units[id]));
          if (ev.a === you || ev.b === you) toast('🚫 Troops left in the other side\'s land when the pact ended were lost', 'err');
          await sleep(400); break;
        }
        case 'intercept': {
          // a SAM battery (Sentinel or Grumble) swats the missile out of the sky
          { const o = { loft: 220, dur: 0.9 * speed(), stopAt: 0.75, size: 1.5, color: '#ffd27a' };
            SFX.whoosh(); Render.smoke(ev.from, 10, 'rgba(220,220,220,'); Render.missile(ev.from, ev.to, o);
            samFire(ev.by || [], Render.missileAt(ev.from, ev.to, o, 0.75), o.dur * 0.75); await sleep(675); }
          Render.burst(Render.missileAt(ev.from, ev.to, { loft: 220 }, 0.75), ['#ffb03a', '#fff', '#7ff3ff'], 40, { up: 60, speed: 1.6 }); SFX.boom(0.8);
          Render.float(ev.to, '🛡 MISSILE INTERCEPTED', '#7ff3ff', 18);
          if (S.units) for (const id in S.units) { const u = S.units[id]; if (u.owner === ev.pid && u.hex === ev.from) u.moved = true; }
          await sleep(300); break;
        }
        case 'shell': {
          // artillery or warships shelling an undefended building
          await fireFx(ev.units, ev.from, ev.to);
          Render.shake(6); infraHit(ev.to, ev.infra, ev.structs);
          if (S.units) for (const id in S.units) { const u = S.units[id]; if (u.owner === ev.pid && u.hex === ev.from) u.moved = true; }
          await sleep(250); break;
        }
        case 'digin': {
          // the stack digs in: spades of earth and a sandbag ring
          Render.burst(ev.hex, ['#8a7a66', '#5d5144', '#c9b78f'], 18, { up: 70, speed: 0.9, size: 2.6 }); Render.ring(ev.hex, '#c9b78f', 44, 0.5, 4);
          Render.float(ev.hex, '⛏ DUG IN', '#cfe3ff', 16); SFX.clank(); SFX.deploy();
          for (const id of ev.units || []) if (S.units[id]) S.units[id].dug = true;
          await sleep(300); break;
        }
        case 'intel': {
          // only the commander who paid for it sees the satellite pass
          if (ev.pid === you) { Render.ring(ev.hex, '#7ff3ff', 70, 0.8, 3); later(0.25, () => Render.ring(ev.hex, '#7ff3ff', 110, 0.9, 2)); Render.float(ev.hex, '🛰 SCOUTED', '#7ff3ff', 18); SFX.zap(); }
          break;
        }
        case 'battleCard': { const d = E.TACTICS[ev.id]; Render.float(ev.hex, '🃏 ' + d.name.toUpperCase(), pColor(ev.pid), 16); Render.ring(ev.hex, pColor(ev.pid), 50, 0.5, 4); SFX.rare(); break; }
        case 'fogstop': if (ev.pid === you) { toast(ev.ambush ? '🌫 Ambush! Hidden enemies in the fog' : '🌫 The fog hid an obstacle: your troops stopped short', 'err'); Render.float(ev.hex, ev.ambush ? 'AMBUSH!' : 'STOPPED', '#cfe3ff', 16); } break;
        case 'razed': {
          Render.burst(ev.hex, ['#ffb03a', '#ff5a2a', '#8a8a8a', '#3a3a3a'], 40, { speed: 1.8, size: 4, up: 160 });
          Render.ring(ev.hex, '#ff6a2a', 70, 0.5, 5); Render.smoke(ev.hex, 14, 'rgba(90,85,80,');
          Render.float(ev.hex, 'BUNKER DESTROYED', '#ff8a5a', 18); SFX.boom(1); Render.shake(10);
          await sleep(500); break;
        }
        case 'weather': {
          const w = E.WEATHER[ev.id]; if (!w) break;
          banner(w.icon + ' ' + w.name.toUpperCase(), w.desc, '#2a4f6b'); SFX.whoosh(); await sleep(1000); break;
        }
        case 'ally': {
          const a = pName(ev.from), b = pName(ev.to), meIn = ev.from === you || ev.to === you;
          if (ev.status === 'formed') { banner('🤝 ALLIANCE FORMED', a + ' & ' + b, '#2f6b4a'); SFX.rare(); await sleep(900); }
          else if (ev.status === 'declined' && meIn) toast(ev.cap ? `🤝 That alliance would be too big for the commanders left` : `${b} declined the alliance`);
          else if (ev.status === 'offer' && !meIn) toast(`🤝 ${a} offered ${b} an alliance`);
          else if (ev.status === 'breaking') { if (ev.to === you || ev.from === you) { banner('🗡 BETRAYAL INCOMING', (ev.to === you ? a + ' is breaking your alliance next turn' : 'Your pact with ' + b + ' ends next turn') + '. Pull your troops out of their land.', '#7a1f2b', true); SFX.alarm(); } else toast(`🗡 ${a} is breaking the alliance with ${b}`); }
          else if (ev.status === 'broken') { toast(`💔 ${a} broke the alliance with ${b}`, 'err'); }
          else if (ev.status === 'renewed') { banner('🤝 ALLIANCE RENEWED', a + ' & ' + b + ' · 5 more rounds', '#2f6b4a'); SFX.rare(); await sleep(700); }
          else if (ev.status === 'renewing' && ev.to === you) { toast(`🤝 ${a} wants to renew your alliance. Press RENEW on their name.`); SFX.select(); }
          else if (ev.status === 'expired') { toast(meIn ? `🕊 Your alliance with ${ev.from === you ? b : a} ran out` : `🕊 ${a} & ${b}'s alliance ran out`); }
          break;
        }
        case 'spawnPicked': {
          Render.recolor && Render.recolor();
          Render.ring(ev.hex, pColor(ev.pid), 90, 0.8, 6); Render.burst(ev.hex, [pColor(ev.pid), '#fff'], 30, { up: 140, square: true });
          SFX.deploy(); Render.shake(6); follow(ev.hex); await sleep(500); break;
        }
        case 'spawnTurn': if (ev.pid === you) { toast('Your pick: choose an HQ hex'); SFX.yourTurn(); } break;
        case 'loot': {
          Render.ring(ev.hex, '#ffcf4a', 60, 0.6, 4);
          Render.burst(ev.hex, ['#ffcf4a', '#fff3a8', '#d9b77a'], 22, { up: 120, square: true });
          if (ev.poi === 'ruins') { Render.float(ev.hex, '+$' + ev.amount + ' LOOT', '#ffc53d', 22); if (ev.pid === you) SFX.coin(6); }
          else { Render.float(ev.hex, 'SUPPLY CACHE!', '#ffcf4a', 20); if (ev.pid === you) { SFX.rare(); toast('📦 Found a cache: ' + E.TACTICS[ev.card].name, 'leg'); } }
          if (S.map.tiles[ev.hex]) delete S.map.tiles[ev.hex].poi;
          await sleep(350); break;
        }
        case 'embargoHit': if (ev.pid === you) banner('EMBARGO', 'Your income is halved this turn', '#b52b38', true); else toast(`⛔ ${pName(ev.pid)} is under embargo`); break;
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
          if (ev.victim === you) banner('YOUR HQ IS UNDER SIEGE', 'Muster troops around it and retake it on your turn', '#b52b38', true);
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
    } } finally { SFX.quiet = false; }
  }

  // how a moving group travels, judged by the biggest piece of kit in it (Grunts riding along don't count)
  const TRACKED = new Set(['mauler', 'hellcat', 'scorpion', 'goliath', 'leviathan', 'titan', 'hailstorm']);
  function moveStyle(ids) {
    const us = ids.map(id => S.units[id]).filter(Boolean); if (!us.length) return 'foot';
    const ride = E.riders(us), lead = us.filter(u => !ride.includes(u));
    const top = lead.slice().sort((a, b) => E.UNITS[b.type].cost - E.UNITS[a.type].cost)[0], d = E.UNITS[top.type];
    if (d.cls === 'sea') return 'sea';
    if (d.cls === 'air') return d.heli || top.type === 'valkyrie' ? 'heli' : 'jet';
    if (TRACKED.has(top.type)) return 'tracks';
    if (d.cls === 'veh' || ['basilisk', 'sentinel', 'oracle'].includes(top.type)) return 'wheels';
    return 'foot';
  }
  async function animMove(ev, quick) {
    const ids = ev.units.filter(id => S.units[id]);
    const caps = new Set(ev.captures);
    const style = moveStyle(ids), dust = 'rgba(150,130,100,';
    let ci = 0;
    ({ heli: () => SFX.rotor(Math.min(10, 3 + ev.path.length * 2)), jet: () => SFX.jet(), tracks: () => SFX.tracks(), wheels: () => SFX.engine(), sea: () => SFX.wake(), foot: () => {} })[style]();
    // aircraft climb out at the start and settle at the end; everything else follows the ground
    const n = ev.path.length - 1, alt = style === 'heli' ? 16 : style === 'jet' ? 24 : 0;
    const per = style === 'jet' ? 85 : style === 'heli' ? 150 : style === 'tracks' ? 165 : style === 'wheels' ? 110 : style === 'sea' ? 150 : 130;
    for (let i = 1; i < ev.path.length; i++) {
      const [ax, ay] = Render.topOf(ev.path[i - 1]), [bx, by] = Render.topOf(ev.path[i]);
      await tween(quick ? 160 : per, p => {
        const e = style === 'jet' || style === 'heli' ? p : ease(p), g = (i - 1 + p) / n;
        let lift;
        if (alt) lift = alt * Math.min(1, g * 3, (1 - g) * 3 + (i === n ? 0 : 1)) + (style === 'heli' ? Math.sin((i + p) * 5) * 1.5 : 0);
        else if (style === 'foot') lift = Math.sin(p * Math.PI) * 8;
        else if (style === 'tracks') lift = Math.abs(Math.sin(p * Math.PI * 4)) * 1.4;   // a heavy, juddering crawl
        else if (style === 'sea') lift = Math.sin(p * Math.PI * 2) * 1.5;
        else lift = Math.sin(p * Math.PI) * 2.5;
        const sx = style === 'heli' ? Math.sin((i + p) * 3.3) * 1.5 : 0;
        for (const id of ids) Render.unitPos[id] = { x: ax + (bx - ax) * e + sx, y: ay + (by - ay) * e - lift, s: alt ? 1 + lift / 160 : 1 };
      });
      const k = ev.path[i];
      if (style === 'foot') SFX.step();
      else if (style === 'tracks') { SFX.clank(); Render.smoke(k, 3, dust); if (!fastForward) Render.shake(1.5); }
      else if (style === 'wheels') Render.smoke(k, 2, dust);
      else if (style === 'sea') Render.ring(k, '#bfeeff', 26, 0.6, 2);
      else if (style === 'heli' && (i === 1 || i === n)) Render.ring(k, 'rgba(220,240,255,.7)', 34, 0.5, 2);   // rotor wash on take-off and landing
      else if (style === 'jet') Render.smoke(ev.path[i - 1], 1, 'rgba(235,240,245,');
      if (caps.has(ev.path[i])) flipTile(ev.path[i], ev.pid, ci++);
    }
    const last = ev.path[ev.path.length - 1];
    for (const id of ids) { delete Render.unitPos[id]; if (S.units[id]) { S.units[id].hex = last; S.units[id].moved = true; } }
    if (ci >= 3) Render.float(last, ci + ' HEXES!', '#ffc53d', 18);
  }

  // economic warfare: show what a strike or shell did to the buildings on a hex
  function infraHit(k, infra, structs) {
    const tt = S.map.tiles[k]; if (tt && structs) { tt.structs = structs; tt.struct = structs.find(x => x.type === 'hq') || structs.find(x => x.type === 'fob') || structs[0] || null; }
    if (!infra || !infra.length) { Render.float(k, 'NO DAMAGE', '#cfd8df', 16); return; }
    const txt = infra.map(h => E.STRUCTS[h.type].name.toUpperCase() + (h.to ? ' ' + '★'.repeat(h.from) + '→' + '★'.repeat(h.to) : ' DESTROYED')).join(' · ');
    Render.float(k, txt, '#ffb03a', 16);
    Render.burst(k, ['#ffb03a', '#8a8a8a', '#3a3a3a'], 30, { speed: 1.6, size: 4, up: 140 }); Render.smoke(k, 12, 'rgba(90,85,80,');
    Render.invalidate && Render.invalidate();
  }
  // effects on the render clock run in seconds; this keeps their timers in step with the game speed, like sleep()
  const later = (sec, f) => setTimeout(f, sec * 1000 * speed());
  // ranged fire, drawn per weapon: every kind of gun in the firing group shows its own shot, launched together
  const FIRE_ORDER = ['direct', 'naval', 'mortar', 'rockets', 'mlrs', 'aa', 'ballistic', 'sub'];
  function fireKind(type) {
    const d = E.UNITS[type] || {};
    if (type === 'trident') return 'sub';
    if (type === 'oracle') return 'ballistic';
    if (['aa', 'sam'].includes(d.ability)) return 'aa';
    if (d.ability === 'salvo') return 'mlrs';
    if (type === 'basilisk') return 'rockets';
    if (d.cls === 'art') return 'mortar';
    if (d.cls === 'sea' && d.range) return 'naval';
    return 'direct';   // overwatch: rifles and tank guns on a watching stack
  }
  async function fireFx(types, from, to) {
    const sp = speed(), kinds = [...new Set((types || []).map(fireKind))].sort((a, b) => FIRE_ORDER.indexOf(a) - FIRE_ORDER.indexOf(b));
    if (!kinds.length) kinds.push('direct');
    const [x, y] = Render.topOf(to), jit = r => [x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r * 0.5];
    const dirt = p => { Render.burst(p, ['#ffcf5a', '#8a7a66', '#5d5144', '#fff'], 12, { speed: 1, up: 90, size: 2.6 }); SFX.boom(0.5); };
    let end = 0;
    kinds.forEach((kind, ki) => {
      const d0 = ki * 0.14;   // a mixed group fires in a quick ripple, not one on top of another
      const at = (s, f) => later(d0 + s, f);
      if (kind === 'sub') {
        at(0, () => { SFX.whoosh(); Render.smoke(from, 14, 'rgba(220,220,220,'); Render.burst(from, ['#ffd27a', '#fff'], 18, { up: 200 }); });
        Render.missile(from, to, { loft: 220, dur: 0.9 * sp, delay: d0 * sp, size: 1.5, color: '#ffd27a', boom: false, onHit: () => { Render.flash(0.3, '#ffd9a0'); Render.shake(14); Render.burst(to, ['#fff', '#ffb03a', '#ff5a2a'], 50, { speed: 2 }); SFX.boom(1.2); } });
        end = Math.max(end, d0 + 0.9);
      } else if (kind === 'ballistic') {
        at(0, () => { SFX.whoosh(); Render.smoke(from, 12, 'rgba(225,225,225,'); Render.burst(from, ['#ffd27a', '#fff', '#ff8a3a'], 20, { up: 160 }); Render.ring(to, '#7ff3ff', 36, 0.5, 3); });
        Render.missile(from, to, { loft: 260, accel: 1.1, dur: 1.0 * sp, delay: d0 * sp, size: 1.6, color: '#e9edf2', boom: false, onHit: () => { Render.flash(0.3, '#ffd9a0'); Render.shake(14); Render.burst(to, ['#fff', '#ffd27a', '#ffb03a', '#ff5a2a'], 50, { speed: 2, up: 140 }); SFX.boom(1.2); } });
        end = Math.max(end, d0 + 1.0);
      } else if (kind === 'aa') {
        // anti-air: a salvo straight in on white trails (aircraft fly, so they're hit up in the air)
        const n = Math.min(4, Math.max(2, types.filter(ut => fireKind(ut) === 'aa').length));
        for (let i = 0; i < n; i++) Render.missile(from, [x + (i - (n - 1) / 2) * 8, y - 40], { alt0: 14, loft: 12, accel: 1.35, dur: (0.45 + i * 0.06) * sp, delay: (d0 + i * 0.09) * sp });
        at(0, () => { Render.burst(from, ['#fff', '#ffd27a'], 10, { up: 60, speed: 0.8 }); SFX.whoosh(); }); at(0.5, () => SFX.boom(0.6));
        end = Math.max(end, d0 + 0.45 + n * 0.15);
      } else if (kind === 'mlrs' || kind === 'rockets') {
        // rocket artillery: a ripple of rockets arcing in, each with its own little blast
        const n = kind === 'mlrs' ? 6 : 3, spread = kind === 'mlrs' ? 34 : 16;
        for (let i = 0; i < n; i++) { Render.missile(from, jit(spread), { loft: kind === 'mlrs' ? 120 : 90, accel: 1.2, dur: 0.7 * sp, delay: (d0 + i * 0.08) * sp, size: 0.8 }); at(i * 0.08, () => SFX.whoosh()); }
        at(0, () => Render.burst(from, ['#fff', '#ffd27a', '#ff8a3a'], 14, { up: 80, speed: 0.9 })); at(0.7, () => { SFX.boom(0.8); Render.shake(7); });
        end = Math.max(end, d0 + 0.7 + n * 0.08);
      } else if (kind === 'mortar') {
        // mortar: rounds lobbed high, a thump at the tube and dirt where they land
        for (let i = 0; i < 2; i++) { const p = jit(10); Render.missile(from, p, { shell: true, loft: 160, accel: 1, dur: 0.8 * sp, delay: (d0 + i * 0.2) * sp, color: '#2b3036', boom: false, onHit: () => dirt(p) }); at(i * 0.2, () => { SFX.shot(); Render.smoke(from, 4, 'rgba(210,210,210,'); }); }
        end = Math.max(end, d0 + 1.0);
      } else if (kind === 'naval') {
        // warship guns: a muzzle flash, shells on a flat arc
        for (let i = 0; i < 2; i++) { const p = jit(12); Render.missile(from, p, { shell: true, loft: 60, accel: 1, dur: 0.5 * sp, delay: (d0 + i * 0.16) * sp, color: '#2b3036', boom: false, onHit: () => dirt(p) }); at(i * 0.16, () => { SFX.shot(); Render.burst(from, ['#fff2a8', '#ffb03a'], 10, { up: 30, speed: 0.9 }); Render.smoke(from, 5, 'rgba(200,200,200,'); }); }
        end = Math.max(end, d0 + 0.7);
      } else {
        // direct fire: tracers
        for (let i = 0; i < 3; i++) at(i * 0.1, () => { SFX.shot(); Render.beam(from, to, '#ffcf5a', 0.22 * sp, 6); });
        at(0.35, () => Render.burst(to, ['#ffcf5a', '#fff'], 12, { speed: 1.1 }));
        end = Math.max(end, d0 + 0.45);
      }
    });
    await sleep(end * 1000 + 120);
  }
  // air defence fire: tracer bursts climbing from each defender toward the target
  // anti-air: each battery looses a missile, straight and fast with a white smoke trail, timed to meet `at`
  // (a world point in the air) `inSec` seconds from now
  function samFire(from, at, inSec) {
    from.forEach((k, i) => {
      const dur = Math.min(0.42 + i * 0.04, inSec * 0.85), delay = Math.max(0, inSec - dur);
      Render.missile(k, at, { alt0: 14, alt1: 0, loft: 10, accel: 1.35, dur, delay, boom: false });
      setTimeout(() => { Render.burst(k, ['#fff', '#ffd27a'], 10, { up: 60, speed: 0.8 }); Render.smoke(k, 4, 'rgba(230,230,230,'); }, delay * 1000);
    });
    setTimeout(() => SFX.whoosh(), Math.max(0, inSec - 0.45) * 1000);
  }
  // a bridge goes into the water and leaves wreckage behind
  function dropBridge(k) {
    const tt = S.map.tiles[k]; if (!tt) return;
    tt.structs = (tt.structs || []).filter(x => x.type !== 'bridge'); tt.struct = tt.structs[0] || null; tt.bridge = false; tt.owner = null; tt.wreck = true;
    Render.burst(k, ['#8a7a66', '#5d5144', '#9fe8ff', '#ffffff'], 40, { up: 180, speed: 1.6 }); SFX.boom(0.9); Render.shake(8);
    Render.recolor(); Render.invalidate();
  }
  // where a missile launch comes from: the striker's nearest airbase or land you can see, a few hexes back from the target
  function launchSite(pid, target) {
    let best = null, bd = 1e9;
    for (const k in S.map.tiles) {
      const t = S.map.tiles[k]; if (t.owner !== pid || t.fog || !E.isLandTile(t)) continue;
      const d = E.dist(k, target); if (d < 2) continue;
      const score = d - ((t.structs || []).some(x => x.type === 'airbase') ? 3 : 0);
      if (score < bd) { bd = score; best = k; }
    }
    if (best) return best;
    const [x, y] = Render.topOf(target), a = Math.random() * Math.PI * 2; return [x + Math.cos(a) * 420, y + Math.sin(a) * 210];   // from out of the fog
  }
  // a cruise missile's flight: low and level, a pop-up near the end, slower over longer distances
  function cruiseOpts(from, target, sp) {
    const [ax, ay] = Array.isArray(from) ? from : Render.topOf(from), [bx, by] = Render.topOf(target), far = Math.hypot(bx - ax, (by - ay) * 2);
    return { alt0: 10, alt1: 0, loft: 26, accel: 1.15, size: 1.8, color: '#e9edf2', dur: Math.min(2.4, 0.9 + far / 500) * sp };
  }
  async function animTactic(ev) {
    const d = E.TACTICS[ev.id];
    const who = pName(ev.pid);
    toast(`${who} played ${d.name}`, d.rarity === 'legendary' ? 'leg' : '');
    if (ev.intercepted) {
      // the missiles meet it over the target: a drone mid-dive, a jet right overhead
      SFX.whoosh();
      const sp = speed();   // effects run on the render clock: scale them like sleep() is scaled
      if (ev.id === 'kamikaze') { const dr = Render.drone(ev.target, { color: pColor(ev.pid), dur: 1.5 * sp, stopAt: 0.8 }); samFire(ev.by || [], Render.droneAt(dr, 0.8), 1.2 * sp); await sleep(1200); }
      else if (ev.id === 'cruise') { const from = launchSite(ev.pid, ev.target), o = cruiseOpts(from, ev.target, sp); Render.missile(from, ev.target, { ...o, stopAt: 0.82 }); samFire(ev.by || [], Render.missileAt(from, ev.target, o, 0.82), o.dur * 0.82); await sleep(o.dur * 820 / sp); }
      else { const [x, y] = Render.topOf(ev.target); Render.flyover([ev.target, ev.target], { color: pColor(ev.pid), dur: 1.4 * sp, noBombs: true, downAt: 0.5 }); samFire(ev.by || [], [x, y - 150], 0.7 * sp); await sleep(700); }
      SFX.boom(0.7); Render.shake(6); await sleep(150);
      Render.float(ev.target, '🛡 SHOT DOWN', '#7ff3ff', 18);
      if (ev.pid === you) toast(`🛡 Your ${d.name} was shot down by air defences`, 'err');
      await sleep(500); return;
    }
    const me = S.players.find(p => p.id === ev.pid);
    switch (ev.id) {
      case 'cache': case 'bonds': Render.float(me.hq, '+$' + ev.amount, '#ffc53d', 22); SFX.coin(6); break;
      case 'blitz': banner('BLITZ!', who + ' — all units +1 move', pColor(ev.pid)); SFX.zap(); Render.flash(0.2, pColor(ev.pid)); await sleep(600); break;
      case 'smoke': Render.smoke(ev.target, 22); SFX.whoosh(); break;
      case 'march': Render.ring(ev.target, pColor(ev.pid), 60, 0.6, 4); Render.float(ev.target, 'FORCED MARCH', '#fff', 16); SFX.select(); break;
      case 'conscript': for (const u of ev.units) { S.units[u.id] = u; } Render.ring(ev.target, pColor(ev.pid), 50, 0.5); SFX.deploy(); Render.shake(4); break;
      case 'carpet': {
        // a three-jet formation lays bombs along the strip
        SFX.whoosh();
        Render.flyover(ev.area.filter(k2 => S.map.tiles[k2]), { count: 3, color: pColor(ev.pid), dur: 2.1 * speed(), fall: 0.42 * speed(), onBomb: () => { SFX.boom(0.5); Render.shake(6); } });
        await sleep(2000);
        Render.float(ev.target, ev.kills.length + ' DESTROYED', '#ff4f5e', 20); killUnits(ev.kills);
        for (const k of ev.shot || []) { Render.burst(k, ['#ffb03a', '#fff'], 20, { up: 200 }); Render.float(k, '🛡 SHOT DOWN', '#7ff3ff', 18); }
        await sleep(300); break;
      }
      case 'jackpot': SFX.coin(8); Render.flash(0.2, '#ffc53d'); break;
      case 'strategic': {
        // a bomber stream crosses the target area; every hex under it smokes and stops paying
        SFX.whoosh(); SFX.alarm();
        Render.flyover(ev.hexes.map(h => h.k).concat([ev.target]), { color: pColor(ev.pid), dur: 2.2 * speed(), fall: 0.42 * speed(), onBomb: () => { SFX.boom(0.8); Render.shake(10); } });
        await sleep(1900);
        for (const h of ev.hexes) { const tt = S.map.tiles[h.k]; if (tt) tt.ruin = 2; if (h.infra.length) infraHit(h.k, h.infra, h.structs); else { Render.burst(h.k, ['#ffb03a', '#5a5a5a'], 14, { up: 90 }); Render.smoke(h.k, 8, 'rgba(70,65,60,'); } }
        Render.recolor(); Render.invalidate();
        for (const k of ev.shot || []) { Render.burst(k, ['#ffb03a', '#fff'], 20, { up: 200 }); Render.float(k, '🛡 SHOT DOWN', '#7ff3ff', 18); }
        { const hit = ev.hexes.reduce((n, h) => n + h.infra.length, 0), kills = (ev.kills || []).length;
          Render.float(ev.target, [kills ? kills + ' DESTROYED' : '', hit ? hit + ' BUILDING' + (hit > 1 ? 'S' : '') + ' HIT' : '', ev.hexes.length ? ev.hexes.length + ' HEXES PAY NOTHING FOR 2 TURNS' : ''].filter(Boolean).join(' · ') || 'NOTHING HIT', kills ? '#ff4f5e' : '#ff8a5a', kills ? 20 : 18);
          killUnits(ev.kills || []); }
        await sleep(500); break;
      }
      case 'buster': {
        // a heavy bomber, a long fall, then the fortifications crumble
        SFX.whoosh(); Render.flyover([ev.target, ev.target], { color: pColor(ev.pid), dur: 1.9 * speed(), fall: 0.42 * speed(), onBomb: () => { SFX.boom(1); Render.shake(16); Render.flash(0.25, '#ffb03a'); } });
        await sleep(1700);
        { const tt = S.map.tiles[ev.target]; if (tt && ev.structs) { tt.structs = ev.structs; tt.struct = ev.structs.find(x => x.type === 'hq') || ev.structs[0] || null; } }
        Render.burst(ev.target, ['#ffb03a', '#8a8a8a', '#3a3a3a'], 40, { speed: 1.8, size: 4, up: 160 }); Render.smoke(ev.target, 16, 'rgba(90,85,80,');
        Render.float(ev.target, (ev.hit ? ev.hit + ' FORT' + (ev.hit > 1 ? 'S' : '') + ' WRECKED · ' : '') + ev.kills.length + ' DESTROYED', '#ff8a5a', 18);
        killUnits(ev.kills); await sleep(300); break;
      }
      case 'kamikaze': {
        // the drone runs in low, noses over and flies straight into the target
        SFX.whoosh();
        Render.drone(ev.target, { color: pColor(ev.pid), dur: 1.5 * speed(), onHit: () => { SFX.boom(0.9); Render.shake(10); } });
        await sleep(1550);
        if (ev.bridge !== undefined) { if (ev.bridge) { dropBridge(ev.target); Render.float(ev.target, 'BRIDGE DESTROYED', '#ff8a5a', 18); } else Render.float(ev.target, 'MISSED THE BRIDGE', '#cfd8df', 16); }
        else if (ev.infra) infraHit(ev.target, ev.infra, ev.structs);
        else Render.float(ev.target, ev.kills.length ? ev.kills.length + ' DESTROYED' : 'MISSED', ev.kills.length ? '#ff4f5e' : '#cfd8df', 20);
        killUnits(ev.kills); await sleep(300); break;
      }
      case 'gunrun': case 'precision': case 'airstrike': case 'cruise': {
        const sp = speed(), col = pColor(ev.pid), [x, y] = Render.topOf(ev.target);
        if (ev.id === 'cruise') {
          // a cruise missile: launched from the striker's nearest land, it skims in low with a smoke trail, pops up and dives in
          const from = launchSite(ev.pid, ev.target), o = cruiseOpts(from, ev.target, sp);
          Render.burst(from, ['#fff', '#ffd27a', '#ff8a3a'], 18, { up: 80, speed: 1 }); Render.smoke(from, 10, 'rgba(225,225,225,'); SFX.whoosh();
          for (let i = 0; i < 3; i++) setTimeout(() => Render.ring(ev.target, '#ff4f5e', 46 - i * 10, 0.5, 3), (o.dur * 0.4 + i * 0.2 * sp) * 1000);
          Render.missile(from, ev.target, { ...o, boom: false, onHit: () => { Render.flash(0.45, '#ffd27a'); SFX.boom(1.5); Render.shake(20); Render.ring(ev.target, '#fff', 90, 0.5, 6); Render.ring(ev.target, '#ffb03a', 130, 0.8, 5); Render.burst(ev.target, ['#fff', '#fff2a8', '#ffb03a', '#ff5a2a', '#444'], 70, { speed: 2.2, size: 4, up: 170 }); Render.smoke(ev.target, 18, 'rgba(80,75,70,'); } });
          await sleep(o.dur * 1000 / sp + 250);
        } else if (ev.id === 'precision') {
          // a laser lock on the target, then a guided bomb falls straight down out of a high jet's pass
          Render.float(ev.target, '◎ LASER LOCK', '#ff4f5e', 20, 1);
          for (let i = 0; i < 4; i++) later(i * 0.16, () => { Render.ring(ev.target, '#ff4f5e', 34 - i * 6, 0.35, 2); SFX.click(); });
          Render.flyover([ev.target], { color: col, dur: 1.5 * sp, noBombs: true }); SFX.jet();
          await sleep(650);
          Render.missile([x + 70, y], ev.target, { alt0: 230, alt1: 0, loft: 0, accel: 2.2, dur: 0.6 * sp, color: '#d9e1e8', size: 1.2, boom: false, onHit: () => { SFX.boom(1); Render.shake(13); Render.flash(0.2, '#fff'); Render.ring(ev.target, '#fff', 60, 0.4, 5); Render.burst(ev.target, ['#fff', '#ffd27a', '#ff8a3a', '#555'], 40, { speed: 1.6, size: 3.4, up: 150 }); } });
          await sleep(750);
        } else if (ev.id === 'gunrun') {
          // a strafing run: the cannon walks a line of hits through the hex as the jet passes low
          const ang = Math.random() * 0.6 - 0.3, dx = Math.cos(ang), dy = Math.sin(ang) * 0.5, dur = 1.4 * sp;
          SFX.brrrt(); Render.flyover([ev.target], { color: col, dur, noBombs: true, angle: ang });
          for (let i = 0; i < 9; i++) setTimeout(() => { const o = (i - 4) * 9; Render.burst([x + dx * o, y + dy * o], ['#fff2a8', '#ffb03a', '#8a7a66'], 5, { up: 50, speed: 0.6, size: 2 }); if (i % 3 === 0) Render.shake(3); }, (dur * 0.5 + (i * 0.05 - 0.3) * sp) * 1000);
          await sleep(1300);
        } else {
          // an airstrike: a stick of three bombs walks across the target
          const ang = Math.random() * 0.6 - 0.3, dx = Math.cos(ang), dy = Math.sin(ang) * 0.5;
          SFX.whoosh(); Render.flyover([[x - dx * 22, y - dy * 22], [x, y], [x + dx * 22, y + dy * 22]], { color: col, dur: 1.6 * sp, fall: 0.42 * sp, angle: ang, onBomb: () => { SFX.boom(0.7); Render.shake(8); } });
          await sleep(1600);
        }
        if (ev.bridge !== undefined) { if (ev.bridge) { dropBridge(ev.target); Render.float(ev.target, 'BRIDGE DESTROYED', '#ff8a5a', 18); } else Render.float(ev.target, 'MISSED THE BRIDGE', '#cfd8df', 16); }
        else if (ev.infra) infraHit(ev.target, ev.infra, ev.structs);
        else Render.float(ev.target, ev.kills.length ? ev.kills.length + ' DESTROYED' : 'MISSED', ev.kills.length ? '#ff4f5e' : '#cfd8df', 20);
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
      case 'sabotage':
        // a commando's charge: a red light blinks faster and faster, then the blast
        for (let i = 0; i < 4; i++) { Render.ring(ev.target, '#ff4f5e', 18, 0.22, 3); SFX.click(); await sleep(260 - i * 50); }
        Render.flash(0.25, '#ffb03a'); Render.burst(ev.target, ['#fff', '#ffb03a', '#ff5a2a', '#666'], 44, { speed: 1.8, size: 3.6, up: 160 }); Render.smoke(ev.target, 12, 'rgba(70,65,60,'); SFX.boom(1.2); Render.shake(12); if (ev.struct === 'bridge') dropBridge(ev.target); else S.map.tiles[ev.target].struct = null; await sleep(300); break;
      case 'emp': {
        SFX.zap(); Render.emp(ev.target, 1.3 * speed()); Render.shake(6); await sleep(250);
        for (const id of ev.units || []) if (S.units[id]) S.units[id].stun = 1;
        Render.float(ev.target, '⚡ ' + (ev.units || []).length + ' FROZEN', '#7ff3ff', 18); await sleep(900); break;
      }
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
      case 'quarry': {
        Render.lance(ev.target, '#ffb03a', 0.5 * speed()); await sleep(200);
        SFX.boom(1.4); Render.shake(16); Render.burst(ev.target, ['#8a7a66', '#5d5144', '#c9b78f', '#ffb03a'], 70, { speed: 2.2, size: 4, up: 160 });
        Render.smoke(ev.target, 24, 'rgba(150,135,115,');
        S.map.tiles[ev.target].t = 'hills'; Render.recolor(); Render.invalidate();
        if (ev.also && S.map.tiles[ev.also]) { await sleep(250); Render.lance(ev.also, '#ffb03a', 0.4 * speed()); SFX.boom(1.1); Render.shake(12); Render.burst(ev.also, ['#8a7a66', '#5d5144', '#c9b78f', '#ffb03a'], 50, { speed: 2, size: 4, up: 140 }); Render.smoke(ev.also, 18, 'rgba(150,135,115,'); S.map.tiles[ev.also].t = 'hills'; Render.recolor(); Render.invalidate(); }
        Render.float(ev.target, 'PASS OPENED', '#ffb03a', 16); await sleep(500); break;
      }
      case 'spy': {
        const thief = ev.pid === you, victim = ev.from === you, d = E.cardDef(ev.card);
        Render.float(ev.target, '🕵 CARD STOLEN', '#c25cff', 18); SFX.rare();
        if (thief) toast(`Spy Ring stole ${d ? d.name : 'a card'} from ${pName(ev.from)}`, 'leg');
        else if (victim) { toast(`${pName(ev.pid)}'s spies stole your ${d ? d.name : 'card'}!`, 'err'); SFX.alarm(); }
        await sleep(400); break;
      }
      case 'tsar': {
        banner('☢ TSAR BOMBA', who + ' — 9-hex blast', '#ffffff'); SFX.alarm(); await sleep(900); SFX.alarm(); await sleep(700);
        Render.lance(ev.target, '#ffffff', 1.0 * speed()); await sleep(450);
        Render.flash(1.6, '#ffffff'); SFX.boom(3); later(0.22, () => SFX.boom(2.4)); Render.shake(55);
        for (let i = 0; i < 6; i++) Render.ring(ev.target, ['#fff', '#ffe6a0', '#ffdd55', '#ff7a2a', '#d9ff3b', '#ffffff'][i], 200 + i * 55, 1.1 + i * 0.3, 10);
        for (const k of ev.area) { Render.burst(k, ['#fff', '#ffdd55', '#ff7a2a', '#ff3a1a', '#444'], 50, { speed: 2.6, size: 5, life: 1.4 }); Render.smoke(k, 16, 'rgba(120,110,90,'); }
        for (const id of ev.units) delete S.units[id];
        for (const k of ev.area) { const t = S.map.tiles[k]; if (!t) continue; const hq = (t.structs || []).find(x => x.type === 'hq'); if (hq) { t.structs = [hq]; t.struct = hq; continue; } t.owner = null; t.struct = null; t.structs = []; if (E.isLandTile(t)) t.contam = 5; }
        Render.recolor(); await sleep(1400); break;
      }
      case 'regime': {
        banner('🏛 REGIME CHANGE', who + ' takes ' + ev.hexes.length + ' hexes', pColor(ev.pid)); SFX.rare(); await sleep(500);
        for (const id of ev.units) if (S.units[id]) S.units[id].owner = ev.pid;
        for (let i = 0; i < ev.hexes.length; i++) { flipTile(ev.hexes[i], ev.pid, i); Render.ring(ev.hexes[i], pColor(ev.pid), 50, 0.5, 4); await sleep(70); }
        await sleep(400); break;
      }
      case 'aegis': {
        // Industrial Revolution: every building of theirs goes up a level, one after another
        banner('🏭 INDUSTRIAL REVOLUTION', who + ' — every building up a level', '#ffc53d'); SFX.legendary();
        for (const u of ev.ups || []) {
          const tt = S.map.tiles[u.k]; const st = tt && (tt.structs || []).find(x => x.type === u.type && x.owner === ev.pid);
          if (st) { st.lvl = u.lvl; delete st.lock; }
          if (!unseen({ hex: u.k })) { Render.ring(u.k, '#ffc53d', 46, 0.5, 4); Render.float(u.k, '★'.repeat(u.lvl), '#ffc53d', 18); }
          await sleep(60);
        }
        Render.invalidate(); await sleep(500); break;
      }
      case 'rally': case 'bayonets': case 'barrage': case 'reserves': case 'steady': banner(d.name.toUpperCase() + '!', who + ' — readied for their next attack', pColor(ev.pid)); SFX.rare(); await sleep(500); break;
      case 'bounty': Render.float(me.hq, 'BOUNTY: $' + (ev.amount || 2) + ' PER KILL', '#ffc53d', 18); SFX.coin(3); break;
      case 'fortify': Render.ring(ev.target, pColor(ev.pid), 60, 0.6, 5); Render.float(ev.target, 'FORTIFIED ' + '★'.repeat(ev.lvl || 1), '#ffc53d', 18); SFX.deploy(); Render.shake(4); break;
      case 'embargo': Render.ring(ev.target, '#ff4f5e', 90, 0.8, 5); Render.float(ev.target, 'EMBARGO', '#ff4f5e', 20); SFX.alarm(); break;
      case 'orbital': {
        SFX.zap(); Render.lance(ev.target, '#bff6ff', 1.1 * speed()); await sleep(450);
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
    if (S.scenario) return;   // missions have their own result screen
    const w = S.winner; const wp = S.players.find(p => p.id === w.pid);
    const winners = w.pids || [w.pid];
    const mine = winners.includes(you);
    mine ? SFX.win() : SFX.lose();
    const counts = {}; for (const k in S.map.tiles) { const o = S.map.tiles[k].owner; if (o) counts[o] = (counts[o] || 0) + 1; }
    const rows = S.players.slice().sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).map(p => `<tr><td style="color:${p.color}">■ ${esc(p.name)}</td><td>${E.FACTIONS[p.faction] ? E.FACTIONS[p.faction].name : ''}</td><td>${counts[p.id] || 0}</td><td>${p.stats.captured}</td><td>${p.stats.kills}</td><td>${p.stats.lost}</td></tr>`).join('');
    v.innerHTML = `<div class="vic panel" style="padding:30px 40px"><h1 style="color:${wp.color};text-shadow:0 6px 0 #000">${mine ? 'VICTORY' : myP() ? 'DEFEAT' : 'GAME OVER'}</h1><div class="why"><b style="color:${wp.color}">${esc(wp.name)}</b> ${esc(w.reason)}</div>
      ${winners.length > 1 ? `<div class="why">🤝 ${winners.map(id => `<b style="color:${pColor(id)}">${esc(pName(id))}</b>`).join(' & ')}</div>` : ''}
      <div class="power"><div class="wr-tabs"><h3>WAR REPORT</h3><button class="on" data-wr="power">Balance of power</button><button data-wr="heat">Battle heatmap</button><button data-wr="flips">Land swings</button><button data-wr="inc">Economy</button><button data-wr="army">Armies</button><button data-wr="awards">Awards</button></div>
        <div class="wr-pane" data-p="power"><canvas id="powerChart" width="1240" height="400"></canvas><div id="powerNotes"></div></div>
        <div class="wr-pane" data-p="heat" hidden><canvas id="heatChart" width="1240" height="520"></canvas><div class="wr-cap">Every battle, airstrike and bombardment, glowing hotter where more units fell.</div></div>
        <div class="wr-pane" data-p="flips" hidden><canvas id="flipChart" width="1240" height="520"></canvas><div class="wr-cap">How often each hex changed hands. The bright bands are the front lines.</div></div>
        <div class="wr-pane" data-p="inc" hidden><canvas id="incChart" width="1240" height="400"></canvas><div class="wr-cap">Income per turn, round by round.</div></div>
        <div class="wr-pane" data-p="army" hidden><canvas id="armyChart" width="1240" height="400"></canvas><div class="wr-cap">Army size (total unit cost on the board), round by round.</div></div>
        <div class="wr-pane" data-p="awards" hidden><div id="awards" class="awards"></div></div>
      </div>
      <table class="stats"><tr><th>COMMANDER</th><th>FACTION</th><th>HEXES</th><th>CAPTURED</th><th>KILLS</th><th>LOST</th></tr>${rows}</table>
      <div class="row" style="justify-content:center"><button class="btn big" id="vicLook">VIEW BOARD</button>${lobby && lobby.hostId === realId ? '<button class="btn big red" id="vicLobby">BACK TO LOBBY</button>' : ''}${lobby && lobby.kind === 'public' ? '<button class="btn big red" id="vicAgain">PLAY AGAIN</button>' : ''}<button class="btn big gold" id="vicMenu">MAIN MENU</button></div></div>`;
    v.hidden = false;
    try { drawPower($('#powerChart'), S.history || [], S.players); } catch (e) { console.error(e); }
    const drawn = {};
    const drawPane = k => {
      if (drawn[k]) return; drawn[k] = true;
      try {
        if (k === 'heat') drawHeat($('#heatChart'), S.heat || {}, '#ff3b2f');
        if (k === 'flips') drawHeat($('#flipChart'), S.flips || {}, '#7af7ff');
        if (k === 'inc') drawLines($('#incChart'), S.history || [], S.players, h => h.inc, '$');
        if (k === 'army') drawLines($('#armyChart'), S.history || [], S.players, h => h.army, '');
        if (k === 'awards') $('#awards').innerHTML = awardsHTML();
      } catch (e) { console.error(e); }
    };
    v.querySelectorAll('[data-wr]').forEach(b => b.onclick = () => {
      SFX.click(); v.querySelectorAll('[data-wr]').forEach(x => x.classList.toggle('on', x === b));
      v.querySelectorAll('.wr-pane').forEach(p => { p.hidden = p.dataset.p !== b.dataset.wr; }); drawPane(b.dataset.wr);
    });
    for (let i = 0; i < 6; i++) setTimeout(() => { if (!S) return; const k = Object.keys(S.map.tiles).filter(k => S.map.tiles[k].owner === w.pid); const r = k[Math.floor(Math.random() * k.length)]; if (r) { Render.burst(r, [wp.color, '#fff', '#ffc53d'], 30, { speed: 1.6, up: 200, square: true }); } }, i * 300);
    $('#vicLook').onclick = () => { v.hidden = true; setTimeout(() => { if (S && S.phase === 'over') { v.hidden = false; } }, 8000); };
    const bl = $('#vicLobby'); if (bl) bl.onclick = () => send({ t: 'toLobby' });
    const ag = $('#vicAgain'); if (ag) ag.onclick = () => { SFX.select(); send({ t: 'quick', name: myName() }); };
    $('#vicMenu').onclick = () => { SFX.click(); send({ t: 'leave' }); setTimeout(() => { if (S || $('#home').hidden) { lobby = null; backToMenu(); } }, 1500); };
  }

  // ── random map type: a slot reel of battlefield thumbnails that lands on the real map ──
  const ARCH_NAME = { continent: 'Continent', pangaea: 'Supercontinent', twin: 'Twin Continents', archipelago: 'Archipelago', inland: 'Inland Sea', crescent: 'Crescent Isles', ocean: 'Open Ocean' };
  const thumbCache = {};
  const THUMB_THEME = { arctic: { plains: '#c3ced3', tundra: '#dfe7eb', forest: '#56706a' }, desert: { plains: '#9a8c5c' }, badlands: { plains: '#8f7350', desert: '#b98d5c' }, jungle: { plains: '#55803f' }, wetlands: { plains: '#5a7650' } };
  function mapThumb(tiles, w = 150, h = 96, theme) {
    const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; const c = cv.getContext('2d'); c.scale(2, 2);
    const pts = Object.keys(tiles).map(k => { const [q, r] = E.parse(k); return [q + r / 2, r * 0.866, tiles[k]]; });
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = Math.min((w - 10) / (x1 - x0 + 1), (h - 10) / (y1 - y0 + 1)), ox = (w - (x1 - x0) * sc) / 2, oy = (h - (y1 - y0) * sc) / 2;
    c.fillStyle = '#0d2233'; c.fillRect(0, 0, w, h);
    const col = { water: '#16405a', mountain: '#6d6a75', hills: '#7a7a52', forest: '#3f6a3f', jungle: '#2f6a3a', desert: '#b69a5e', tundra: '#a9b6bd', swamp: '#4d6048', canyon: '#b0582e', plains: '#6a8a4c', ...(THUMB_THEME[theme] || {}) };
    for (const [x, y, t] of pts) { if (t.t === 'water' && t.deep) continue; c.fillStyle = col[t.t] || '#6a8a4c'; c.beginPath(); c.arc(ox + (x - x0) * sc, oy + (y - y0) * sc, sc * 0.62, 0, Math.PI * 2); c.fill(); }
    return cv.toDataURL();
  }
  function archThumb(a, n) { const k = a + n; if (!thumbCache[k]) thumbCache[k] = mapThumb(E.generateMap({ seed: 9100 + Object.keys(ARCH_NAME).indexOf(a), nPlayers: n, size: 'small', archetype: a }).tiles); return thumbCache[k]; }
  async function showMapReel(state) {
    const arch = state.map.arch, n = state.players.length, archs = Object.keys(ARCH_NAME);
    const box = el('div', '', ''); box.id = 'mapReel'; document.body.appendChild(box); document.body.classList.add('reeling'); setTimeout(() => document.body.classList.remove('reeling'), 8000);   // never leave the board hidden
    box.innerHTML = `<h2>ROLLING THE BATTLEFIELD</h2><div class="mr-window"><div class="mr-strip"></div><div class="mr-mark"></div></div><div class="mr-name">&nbsp;</div>`;
    const strip = box.querySelector('.mr-strip'), cells = [], land = 22;
    for (let i = 0; i < 28; i++) {
      const a = i === land ? arch : archs[(i * 5 + Math.floor(Math.random() * 6)) % archs.length];
      const cell = el('div', 'mr-cell', `<img src="${i === land ? mapThumb(state.map.tiles, 150, 96, state.map.theme) : archThumb(a, n)}" alt=""><span>${ARCH_NAME[a].toUpperCase()}</span>`);
      strip.appendChild(cell); cells.push(cell);
    }
    await sleep(60);
    const cw = 176, win = box.querySelector('.mr-window').clientWidth, off = land * cw - (win / 2 - cw / 2);
    const t0 = performance.now(), dur = 2600; let last = -1;
    await new Promise(res => { const stepF = () => { const p = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - p, 4); strip.style.transform = `translateX(${-off * e}px)`; const idx = Math.floor((off * e + win / 2) / cw); if (idx !== last) { last = idx; SFX.chip(idx % 10); } if (p < 1) requestAnimationFrame(stepF); else res(); }; stepF(); });
    cells[land].classList.add('won'); SFX.victoryHit(); Render.shake(6);
    const th = E.THEMES[state.map.theme];
    box.querySelector('.mr-name').innerHTML = `<b>${ARCH_NAME[arch].toUpperCase()}</b>` + (th && state.map.theme !== 'mixed' ? ` <span class="mr-theme">· ${th.name.toUpperCase()}</span>` : '');
    await sleep(1500);
    document.body.classList.remove('reeling');   // the board appears as the reel fades away
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

  // the whole battlefield, each hex tinted by its final owner, glowing wherever `vals` is high
  function drawHeat(cv, vals, hot) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, tiles = S.map.tiles;
    const xy = k => { const [q, r] = E.parse(k); return [q + r / 2, r * 0.866]; };
    const pts = Object.keys(tiles).map(k => { const [x, y] = xy(k); return { k, x, y, t: tiles[k] }; });
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = Math.min((W - 30) / (x1 - x0 + 1), (H - 30) / (y1 - y0 + 1)), ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
    const P = (x, y) => [ox + (x - x0) * sc, oy + (y - y0) * sc];
    c.fillStyle = '#081018'; c.fillRect(0, 0, W, H);
    const hex = (x, y, r) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); };
    for (const p of pts) {
      // a neutral board, so the heat reads clearly whoever won
      const [x, y] = P(p.x, p.y);
      hex(x, y, sc * 0.58);
      c.fillStyle = p.t.t === 'water' ? '#0d1f2c' : p.t.t === 'mountain' ? '#3a3d48' : '#26313c'; c.fill();
    }
    const max = Math.max(1, ...Object.values(vals));
    c.globalCompositeOperation = 'lighter';
    for (const p of pts) {
      const v = vals[p.k]; if (!v) continue;
      const [x, y] = P(p.x, p.y), f = Math.sqrt(v / max), r = sc * (0.8 + f * 1.8);
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, f > 0.6 ? '#fff4b0' : hot); g.addColorStop(0.45, hot); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.25 + f * 0.75; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    for (const p of S.players) if (p.hq && tiles[p.hq]) { const [hx, hy] = xy(p.hq), [x, y] = P(hx, hy); c.fillStyle = p.color; c.strokeStyle = '#000'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, Math.max(6, sc * 0.5), 0, Math.PI * 2); c.fill(); c.stroke(); }
    if (!Object.keys(vals).length) { c.fillStyle = '#7f8c98'; c.font = '600 26px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.fillText('No data for this war', W / 2, H / 2); }
  }
  // one line per commander
  function drawLines(cv, hist, players, get, unit) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, padL = 60, padR = 20, padT = 20, padB = 46;
    const rows = hist.filter(h => get(h)), n = rows.length;
    c.clearRect(0, 0, W, H); c.fillStyle = '#0b1117'; c.fillRect(padL, padT, W - padL - padR, H - padT - padB);
    if (n < 2) { c.fillStyle = '#7f8c98'; c.font = '600 22px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.fillText('Not enough rounds recorded', W / 2, H / 2); return; }
    const iw = W - padL - padR, ih = H - padT - padB, max = Math.max(1, ...rows.flatMap(h => players.map(p => get(h)[p.id] || 0)));
    const X = i => padL + iw * i / (n - 1), Y = v => padT + ih * (1 - v / max);
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.font = '600 18px "Chakra Petch", sans-serif'; c.fillStyle = '#7f8c98'; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (const f of [0, 0.25, 0.5, 0.75, 1]) { const y = padT + ih * (1 - f); c.beginPath(); c.moveTo(padL, y); c.lineTo(padL + iw, y); c.stroke(); c.fillText(unit + Math.round(max * f), padL - 8, y); }
    c.textAlign = 'center'; c.textBaseline = 'top'; const step = Math.max(1, Math.ceil(n / 12));
    for (let i = 0; i < n; i += step) c.fillText('R' + rows[i].r, X(i), padT + ih + 8);
    for (const p of players) {
      c.beginPath(); rows.forEach((h, i) => { const y = Y(get(h)[p.id] || 0); i ? c.lineTo(X(i), y) : c.moveTo(X(i), y); });
      c.strokeStyle = '#000'; c.lineWidth = 7; c.stroke(); c.strokeStyle = p.color; c.lineWidth = 4; c.stroke();
    }
  }
  function awardsHTML() {
    const ps = S.players, hist = S.history || [];
    const best = (f, fmt) => { const p = ps.slice().sort((a, b) => f(b) - f(a))[0]; return p && f(p) > 0 ? { p, v: fmt ? fmt(f(p)) : f(p) } : null; };
    const peak = p => Math.max(0, ...hist.map(h => h.c[p.id] || 0));
    const list = [
      ['⚔', 'Warmonger', 'most enemy units destroyed', best(p => p.stats.kills)],
      ['🗺', 'Land Baron', 'biggest empire at its peak', best(peak, v => v + ' hexes')],
      ['💰', 'Tycoon', 'most money earned', best(p => p.stats.earned || 0, v => '$' + v)],
      ['🚩', 'Conqueror', 'most hexes captured', best(p => p.stats.captured)],
      ['📦', 'Scavenger', 'most crates opened', best(p => p.stats.crates)],
      ['🪦', 'Meat Grinder', 'most units lost', best(p => p.stats.lost)],
    ].filter(a => a[3]);
    let html = list.map(([ic, t, d, w]) => `<div class="aw" style="--pc:${w.p.color}"><div class="aw-i">${ic}</div><div><div class="aw-t">${t}</div><div class="aw-n">${esc(w.p.name)} · <b>${w.v}</b></div><div class="aw-d">${d}</div></div></div>`).join('');
    const bb = S.bigBattle;
    if (bb) html += `<div class="aw big" style="--pc:${pColor(bb.att)}"><div class="aw-i">💥</div><div><div class="aw-t">Biggest battle · round ${bb.round}</div><div class="aw-n"><b style="color:${pColor(bb.att)}">${esc(pName(bb.att))}</b> vs <b style="color:${bb.def ? pColor(bb.def) : '#aaa'}">${bb.def ? esc(pName(bb.def)) : 'a garrison'}</b></div><div class="aw-d">${bb.size} chips clashed · ${bb.attWin ? 'the attack broke through' : 'the defence held'} · ${bb.killed} unit${bb.killed === 1 ? '' : 's'} died</div></div></div>`;
    return html || '<div class="wr-cap">No awards: the war was too short.</div>';
  }

  // ───────────── misc UI ─────────────
  function toast(msg, cls = '') {
    const t = el('div', 'toast ' + cls, esc(msg)); $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 2700);
    while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  }
  function addLog(html, cls = '') {
    const box = $('#log'), atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 24;
    const l = el('div', 'lg ' + cls, html); box.appendChild(l);
    while (box.children.length > 80) box.firstChild.remove();
    if (atEnd) box.scrollTop = box.scrollHeight;   // follow the newest line, unless you've scrolled up to read
  }
  // team games: chat goes to your team by default (the TEAM/ALL switch, or Tab, flips it)
  let teamChat = true;
  const teamGame = () => !!(S && S.settings && S.settings.teams === 'on' && myP());
  const chatMode = () => { const b = $('#chatMode'); if (!b) return; b.hidden = !teamGame(); b.textContent = teamChat ? 'TEAM' : 'ALL'; b.classList.toggle('team', teamChat); };
  { const b = el('button', '', 'TEAM'); b.id = 'chatMode'; b.hidden = true; b.title = 'Who hears you: your team, or everyone (Tab)'; b.onclick = () => { teamChat = !teamChat; chatMode(); SFX.click(); }; $('#chatIn').before(b); }
  $('#chatIn').addEventListener('keydown', e => {
    if (e.key === 'Tab' && teamGame()) { e.preventDefault(); teamChat = !teamChat; chatMode(); return; }
    if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) send({ t: 'chat', text: v, team: teamGame() && teamChat }); e.target.value = ''; e.target.blur(); }
  });
  $('#muteBtn').onclick = () => { const m = SFX.toggle(); setTimeout(menuMusic, 50); $('#muteBtn').textContent = m ? '✕' : '♪'; };
  $('#muteBtn').textContent = SFX.muted ? '✕' : '♪';

  function showRules() {
    const r = $('#rules');
    r.innerHTML = `<div class="panel rules-card"><h2>HOW TO PLAY SECTOR</h2>
    <p>Grab land, build an economy, crush your rivals. <b>Every hex you hold pays you</b>, so sitting still is losing.</p>
    <div class="grid2"><div>
    <h4>YOUR TURN</h4>
    <b>1. Resupply:</b> flip 3 cards: take one <i>plus most of your income</i> (a card costs about half your income early on, much less once your economy is big, and big economies flip rarer cards), or skip them for the full income. Reroll for cash.<br>
    <b>2. Act:</b> deploy (hotbar <kbd>1</kbd>–<kbd>0</kbd>), build (<kbd>Z</kbd>–<kbd>M</kbd>), move, attack, play tactics and trade, in any order.<br>
    <b>3. End turn.</b>
    <h4>INCOME</h4>
    $3 base + $1 per 3 hexes + $2 per resource node ◆ + refineries and warehouses (building income tapers past $8, total income past $50). Hexes <b>cut off</b> from your HQ / FOB / Port network (hatched) pay nothing, so protect your supply lines.
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
    Attacker: total <span style="color:var(--chips)">ATK chips</span> × (<span style="color:var(--mult)">d6 + 2 + mult bonuses</span>).<br>Defender: total <span style="color:var(--chips)">DEF chips</span> × (<span style="color:var(--mult)">d6 + 2 + terrain/structure mult</span>). Ties go to the defender.<br>
    The loser's stack is wiped out. A close fight (loser ≥ 60%) costs the winner its weakest unit.<br>
    <b>Bonuses:</b> Flanking (+1 mult per other friendly stack touching the target), Combined Arms (3+ unit types), Forest +1, Highlands +2, Bunker +2, FOB +1, HQ +2 and garrison.
    <b>You throw your own die</b>: drag and fling it in the tray.
    <h4>ARTILLERY & GUNSHIPS</h4> Ranged units fire instead of moving. Hit = destroy 1 unit (2 at 1.6× their score, 3 at 2.5×). Miss = nothing. An undefended building always takes the hit (it loses a level). Can't shoot through mountains.
    <h4>CARDS</h4> <b>Units</b> form your deck (max 10): deploy as many as you can afford. Pull a unit you already own and it levels up (★ +1 ATK/DEF, max ★★★). Deck full? Replace a card. <b>Tactics</b> are single-use. <b style="color:var(--gold)">Legendaries are unique</b>: only one exists until it's spent or its owner falls.
    <h4>TRADING</h4> On your turn click <b>TRADE</b> under a rival's name: offer cash/cards for cash. They accept or decline.
    <h4>CONTROLS</h4> <kbd>1</kbd>–<kbd>0</kbd> deploy · <kbd>Z</kbd>–<kbd>M</kbd> build · <kbd>Click</kbd> select / order · <kbd>Right-click</kbd> cancel · <kbd>Drag</kbd> / <kbd>WASD</kbd> pan · <kbd>Wheel</kbd> zoom · <kbd>F</kbd> find HQ · <kbd>Enter</kbd> chat
    </div></div>
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn big red" id="rulesClose">GOT IT</button></div></div>`;
    r.hidden = false; $('#rulesClose').onclick = () => { r.hidden = true; SFX.click(); };
  }
  $('#rulesBtn').onclick = showRules; $('#rulesBtn2').onclick = showRules;
  for (const b of ['#indexBtn', '#indexBtn2', '#indexBtn3']) $(b).onclick = () => { SFX.select(); Cards.showIndex(); };
  // missions: from the lobby, or from the front page (enlist first, then the board opens)
  $('#missionsBtn3').onclick = () => { SFX.select(); Missions.board(); };   // picking a mission opens a private room for it
  $('#rulesBtn3').onclick = showRules;
  $('#lanFind').onclick = () => { SFX.select(); $('#joinNet').hidden = false; renderRecent(); if (!$('#scanBtn').disabled && !$('#scanList .srv')) $('#scanBtn').click(); };
  $('#lanClose').onclick = () => { SFX.click(); $('#joinNet').hidden = true; };
  $('#joinNet').onclick = e => { if (e.target === $('#joinNet')) $('#joinNet').hidden = true; };
  Home.init({ send, name: myName });
  if (!seat) showHome();

  Locker.init({ send }); window.SECTOR_TOAST = t => toast(t, 'good');
  window.SECTOR_DEBUG = { flyTo: (a, b) => flyTo(a, b), resume: () => pump(), refresh: () => refreshAll(), victoryFx: () => showVictory(), crushFx: ev => obliterate(ev), combatFx: ev => showCombat(ev), tacticFx: ev => animTactic(ev), fireFx: (types, from, to) => fireFx(types, from, to), send, state: () => S, you: () => you, plan: () => plan, planState: () => planState, act: doAction, click: onHexClick };
  connect();
})();
