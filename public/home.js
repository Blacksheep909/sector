/* SECTOR — the front page: your commander card, PLAY, your party, the leaderboard, news, and settings.
   Everything here is about the player, not a game; the room lobby and the game itself live in main.js. */
const Home = (() => {
  const C = SectorCosmetics;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const toast = (t, k) => window.SECTOR_TOAST && window.SECTOR_TOAST(t, k);
  const sfx = n => { if (typeof SFX !== 'undefined' && SFX[n]) SFX[n](); };
  let send = () => {}, nameOf = () => 'Commander';
  let stats = null, party = null, me = null, board = { week: null, all: null }, boardTab = 'week', newsData = null, cardKey = '';
  const visible = () => !$('#home').hidden && !$('#menu').hidden;
  const bannerCls = id => id ? ' bn-' + id : '';
  const itemName = id => (id && C.ITEMS[id] ? C.ITEMS[id].name : 'Standard');

  // ── settings: kept in this browser ──
  const OPT_DEF = { music: true, gfx: 'high', calm: false, botchat: true };
  const opts = (() => { try { return { ...OPT_DEF, ...JSON.parse(localStorage.getItem('sector.opts') || '{}') }; } catch (e) { return { ...OPT_DEF }; } })();
  const saveOpts = () => { try { localStorage.setItem('sector.opts', JSON.stringify(opts)); } catch (e) {} };
  const applyOpts = () => { document.body.classList.toggle('calm', !!opts.calm); document.body.classList.toggle('no-botchat', !opts.botchat); };

  function init(o) {
    send = o.send; nameOf = o.name;
    applyOpts();
    $('#setBtn').onclick = () => { sfx('select'); settings(); };
    fetch('/news').then(r => r.json()).then(n => { newsData = n; drawNews(); }).catch(() => {});
    // the menu numbers stay fresh while you're looking at them
    setInterval(() => { if (visible()) { send({ t: 'menu' }); send({ t: 'leaderboard', period: boardTab }); } }, 15000);
  }
  function onMsg(m) {
    switch (m.t) {
      case 'menu': { const first = !stats; stats = m; me = m.you; drawStats(); if (first) send({ t: 'leaderboard', period: boardTab }); return true; }
      case 'party': party = m.party; if (m.you) me = m.you; drawParty(); return true;
      case 'leaderboard': board[m.period] = m.rows; drawBoard(); return true;
      case 'publicProfile': showProfile(m.profile); return true;
      case 'partyFollow': toast('🎖 Your party leader picked a war: room ' + m.code); sfx('select'); return true;
    }
    return false;
  }
  // everything on the page, after the profile (or anything else) changes
  function render() { drawCard(); drawParty(); drawRecruit(); drawBoard(); drawNews(); drawStats(); }
  function shown() { send({ t: 'menu' }); send({ t: 'leaderboard', period: boardTab }); render(); }

  function drawStats() {
    if (!stats) return;
    $('#mmOnline').textContent = stats.online.toLocaleString(); $('#mmWars').textContent = stats.wars.toLocaleString();
    $('#mmVer').textContent = 'v' + stats.version + (stats.mode === 'lan' ? ' · LAN server' : '');
    $('#lanRow').hidden = stats.mode !== 'lan';
    $('#playSub').textContent = stats.waiting ? stats.waiting + ' commander' + (stats.waiting > 1 ? 's' : '') + ' in open wars · Join one' : 'Join an open war, or host your own';
  }

  // ── your commander card: banner, territory skin, record, and the way into the Locker ──
  function drawCard() {
    const box = $('#cmdCard'); if (!box) return;
    const p = Locker.profile;
    const key = JSON.stringify([p && p.equipped, p && p.total, p && p.handle, nameOf(), p && p.scenarios && p.scenarios.length, p && p.links, stats && stats.logins]);
    if (key === cardKey) return; cardKey = key;
    if (!p) { box.innerHTML = '<h3>COMMANDER</h3><div class="sub">Loading your profile…</div>'; return; }
    const t = p.total || {}, eq = p.equipped || {};
    box.innerHTML = `<h3>COMMANDER</h3>
      <div class="pchip demo cc-chip${bannerCls(eq.banner)}"><div class="pn">${esc(nameOf())}</div><div class="ps"><span>🏆 <b>${t.wins || 0}</b></span><span>⚔ <b>${t.kills || 0}</b></span></div></div>
      <div class="cc-terr"><canvas width="300" height="150"></canvas><div class="cc-tag">${esc(itemName(eq.territory))}</div></div>
      <div class="cc-grid"><div><b>${t.games || 0}</b><span>wars</span></div><div><b>${t.games ? Math.round((t.wins || 0) / t.games * 100) : 0}%</b><span>won</span></div><div><b>${(p.scenarios || []).length}/${SectorScenarios.SCENARIOS.length}</b><span>missions</span></div></div>
      <div class="cc-row"><span>Banner</span><b>${esc(itemName(eq.banner))}</b></div><div class="cc-row"><span>Border</span><b>${esc(itemName(eq.border))}</b></div>
      <button class="btn gold cc-go" id="ccLocker">CUSTOMIZE</button>
      ${accountBox(p)}
      <div class="cc-id" title="Your public commander ID: friends can look you up with it">ID <b>${esc(p.handle || '—')}</b></div>`;
    try { Skins.preview(box.querySelector('canvas'), 'territory', eq.territory || null, '#36a3ff'); } catch (e) {}
    box.querySelector('#ccLocker').onclick = () => { sfx('select'); Locker.show('locker'); };
    box.querySelectorAll('[data-login]').forEach(b => b.onclick = () => { sfx('select'); b.disabled = true; send({ t: 'authStart', provider: b.dataset.login }); setTimeout(() => { b.disabled = false; }, 4000); });
    const so = box.querySelector('#ccSignOut'); if (so) so.onclick = () => signOut(so);
    box.querySelector('.cc-chip').onclick = () => p.handle && profile(p.handle);
  }

  // ── accounts: save your commander to a Google or Discord login ──
  const LOGIN = { google: { name: 'Google', icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>' },
    discord: { name: 'Discord', icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#fff" d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 -.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.8-3.6-13.7zM8 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>' },
    mock: { name: 'Test login', icon: '🧪' } };
  function accountBox(p) {
    const on = (stats && stats.logins) || [], links = p.links || {}, linked = Object.keys(links);
    if (linked.length) {
      const k = linked[0], l = links[k];
      return `<div class="acct on"><span class="acct-ic">${(LOGIN[k] || {}).icon || ''}</span><div><b>${esc(l.name || (LOGIN[k] || {}).name)}</b><div class="sub">Saved to ${esc((LOGIN[k] || {}).name || k)}${l.email ? ' · ' + esc(l.email) : ''}</div></div><button class="linkbtn" id="ccSignOut">SIGN OUT</button></div>`;
    }
    if (!on.length) return `<div class="acct off sub">Accounts aren't set up on this server yet, so your commander lives in this browser.</div>`;
    return `<div class="acct"><div class="acct-t"><b>SAVE YOUR PROGRESS</b><span class="sub">Keep your Valor, skins and record on any device</span></div>${on.map(k => `<button class="btn acct-b acct-${k}" data-login="${k}"><span class="acct-ic">${(LOGIN[k] || {}).icon || ''}</span>${esc((LOGIN[k] || {}).name || k)}</button>`).join('')}</div>`;
  }
  // signing out: this browser starts a fresh guest commander (your saved one waits on your login)
  function signOut(btn) {
    if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'SURE?'; setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'SIGN OUT'; }, 3000); return; }
    sfx('click'); const id = Locker.newIdentity(); cardKey = '';
    send({ t: 'auth', name: nameOf(), profile: id }); toast('Signed out. Sign in again any time to get your commander back.');
  }

  // ── party: friends who queue together ──
  // refer a friend: your link, what it pays, and how many have joined through it
  let recruitKey = '';
  function drawRecruit() {
    const box = $('#recruitBox'); if (!box) return;
    const p = Locker.profile;
    const key = JSON.stringify([p && p.refCode, p && p.recruits]); if (key === recruitKey) return; recruitKey = key;
    box.hidden = !p || !p.refCode; if (box.hidden) return;
    const link = location.origin + '/?ref=' + p.refCode, n = p.recruits || 0;
    box.innerHTML = `<h3>RECRUIT FRIENDS <span class="rc-n" title="${n < 3 ? 'Recruit ' + (3 - n) + ' more for the Recruiter banner' : 'You have the Recruiter banner'}">${n}/3 for a banner</span></h3>
      <div class="sub">You get <b><i class="vm"></i>250</b> for each friend who joins with your link and makes an account. They get <b><i class="vm"></i>100</b>.</div>
      <div class="rc-link"><code>${esc(link.replace(/^https?:\/\//, ''))}</code><button class="btn tiny gold" id="rcCopy">COPY LINK</button></div>`;
    box.querySelector('#rcCopy').onclick = () => { sfx('select'); const done = ok => { if (ok) toast('🎖 Recruit link copied'); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(link).then(() => done(true), () => done(false)); else { const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); done(ok); } };
  }
  function drawParty() {
    const box = $('#partyBox'); if (!box) return;
    if (!party) {
      box.innerHTML = `<h3>PARTY</h3><div class="pt-empty"><div class="pt-icons">👤<b>+</b>👤<b>+</b>👤</div><div class="sub">Play with friends: start a party, send them the link, and PLAY takes everyone into the same war.</div></div>
        <div class="pt-act"><button class="btn green" id="ptNew">START A PARTY</button></div>`;
      box.querySelector('#ptNew').onclick = () => { sfx('select'); send({ t: 'partyCreate', name: nameOf() }); };
      return;
    }
    const lead = party.leader === me, link = location.origin + '/?party=' + party.code;
    const where = m => m.playing ? '<span class="pt-st war">⚔ at war</span>' : m.room ? '<span class="pt-st room">in room ' + esc(m.room) + '</span>' : '<span class="pt-st menu">ready</span>';
    box.innerHTML = `<h3>PARTY <span class="pt-n">${party.members.length}/${party.max}</span></h3>
      <div class="pt-code"><span>CODE</span><b>${esc(party.code)}</b><button class="btn tiny" id="ptCopy">🔗 COPY INVITE</button></div>
      <div class="pt-list">${party.members.map(m => `<div class="pt-m pchip demo${bannerCls(m.banner)}" data-h="${esc(m.handle || '')}" title="${m.handle ? 'View profile' : ''}">
        <div class="pn">${m.cid === party.leader ? '<i class="pt-crown" title="Party leader">♛</i>' : ''}${esc(m.name)}${m.cid === me ? ' <span class="pt-you">YOU</span>' : ''}</div>
        <div class="ps">${where(m)}${lead && m.cid !== me ? `<button class="pt-x" data-lead="${m.cid}" title="Make leader">♛</button><button class="pt-x" data-kick="${m.cid}" title="Remove">✕</button>` : ''}</div></div>`).join('')}
        ${party.members.length < party.max ? '<div class="pt-slot">Waiting for friends…</div>' : ''}</div>
      <div class="sub pt-note">${lead ? 'You lead: <b>PLAY</b> or <b>PRIVATE ROOM</b> takes everyone on this screen with you.' : 'The leader picks the war. You can still play on your own.'}</div>
      <div class="pt-act"><button class="btn tiny" id="ptLeave">LEAVE PARTY</button></div>`;
    box.querySelector('#ptCopy').onclick = () => { copyText(link).then(ok => ok && toast('Invite link copied: send it to your friends')); sfx('click'); };
    box.querySelector('#ptLeave').onclick = () => { sfx('click'); send({ t: 'partyLeave' }); };
    box.querySelectorAll('.pt-m').forEach(r => r.onclick = e => { if (e.target.closest('button')) return; if (r.dataset.h) profile(r.dataset.h); });
    box.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => send({ t: 'partyKick', cid: b.dataset.kick }));
    box.querySelectorAll('[data-lead]').forEach(b => b.onclick = () => send({ t: 'partyLead', cid: b.dataset.lead }));
  }

  // ── leaderboard ──
  function drawBoard() {
    const box = $('#boardBox'); if (!box) return;
    const rows = board[boardTab];
    box.innerHTML = `<h3>LEADERBOARD</h3><div class="lb-tabs"><button class="chip${boardTab === 'week' ? ' on' : ''}" data-p="week">THIS WEEK</button><button class="chip${boardTab === 'all' ? ' on' : ''}" data-p="all">ALL TIME</button></div>
      <div class="lb-list">${!rows ? '<div class="sub">Loading…</div>' : !rows.length ? `<div class="lb-empty">No wars won ${boardTab === 'week' ? 'this week' : 'yet'}.<br><b>Be the first on the board.</b></div>`
      : rows.map((r, i) => `<div class="lb-r${i < 3 ? ' top t' + i : ''}" data-h="${esc(r.handle)}"><span class="lb-n">${i + 1}</span><span class="lb-name pchip demo${bannerCls(r.banner)}"><span class="pn">${esc(r.name)}</span></span><span class="lb-v" title="wins">🏆 ${r.wins}</span><span class="lb-k" title="units destroyed">⚔ ${r.kills}</span></div>`).join('')}</div>`;
    box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { boardTab = b.dataset.p; sfx('click'); drawBoard(); send({ t: 'leaderboard', period: boardTab }); });
    box.querySelectorAll('.lb-r').forEach(r => r.onclick = () => profile(r.dataset.h));
  }

  // ── news: the latest release notes ──
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  function drawNews() {
    const box = $('#newsBox'); if (!box) return;
    const r = newsData && newsData.releases && newsData.releases[0];
    if (!r) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<div class="nw-head"><span class="nw-badge">NEW</span><b>${esc(r.version)}</b><span class="nw-title">${md(r.headline)}</span><button class="btn tiny" id="nwAll">PATCH NOTES</button></div>
      <div class="nw-items">${r.items.slice(0, 3).map(i => `<div>${md(i)}</div>`).join('')}</div>`;
    box.querySelector('#nwAll').onclick = () => { sfx('select'); notes(); };
  }
  function notes() {
    const m = modal('newsModal');
    m.innerHTML = `<div class="panel nw-panel"><div class="ix-head"><h2>PATCH NOTES</h2><button class="icon-btn" data-x>✕</button></div>${newsData.releases.map(r => `<section><h3>${esc(r.version)} <span class="sub">${md(r.headline)}</span></h3><ul>${r.items.map(i => `<li>${md(i)}</li>`).join('')}</ul></section>`).join('')}</div>`;
    wire(m);
  }

  // ── a commander's public profile ──
  function profile(handle) { if (!handle) return; send({ t: 'publicProfile', handle }); }
  function showProfile(v) {
    const m = modal('profModal'), s = v.stats, w = v.week;
    const since = new Date(v.since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    m.innerHTML = `<div class="panel pf-panel"><div class="ix-head"><h2>COMMANDER</h2><button class="icon-btn" data-x>✕</button></div>
      <div class="pchip demo pf-chip${bannerCls(v.equipped.banner)}"><div class="pn">${esc(v.name)}</div><div class="ps"><span>ID <b>${esc(v.handle)}</b></span><span>since <b>${esc(since)}</b></span></div></div>
      <div class="pf-body"><div class="pf-terr"><canvas width="280" height="140"></canvas><div class="cc-tag">${esc(itemName(v.equipped.territory))}</div></div>
        <div class="pf-stats">
          <div><b>${s.wins}</b><span>wins</span></div><div><b>${s.games}</b><span>wars</span></div><div><b>${s.games ? Math.round(s.wins / s.games * 100) : 0}%</b><span>win rate</span></div>
          <div><b>${s.kills.toLocaleString()}</b><span>units destroyed</span></div><div><b>${s.captured.toLocaleString()}</b><span>hexes taken</span></div><div><b>${v.missions}/${SectorScenarios.SCENARIOS.length}</b><span>missions</span></div>
        </div></div>
      <div class="pf-week">This week: <b>${w.wins}</b> win${w.wins === 1 ? '' : 's'} in <b>${w.games}</b> war${w.games === 1 ? '' : 's'} · <b>${w.kills}</b> kills</div>
      <div class="pf-gear"><div><span>Banner</span><b>${esc(itemName(v.equipped.banner))}</b></div><div><span>Territory</span><b>${esc(itemName(v.equipped.territory))}</b></div><div><span>Border</span><b>${esc(itemName(v.equipped.border))}</b></div><div><span>Skins owned</span><b>${v.skins}</b></div></div>
    </div>`;
    try { Skins.preview(m.querySelector('canvas'), 'territory', v.equipped.territory || null, '#ff4f5e'); } catch (e) {}
    wire(m); sfx('select');
  }

  // ── settings ──
  function settings() {
    const m = modal('setModal');
    const row = (label, ctl, sub) => `<div class="st-row"><div><b>${label}</b>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${ctl}</div>`;
    const sw = (k, on) => `<button class="sw${on ? ' on' : ''}" data-k="${k}"><i></i></button>`;
    m.innerHTML = `<div class="panel set-panel"><div class="ix-head"><h2>SETTINGS</h2><button class="icon-btn" data-x>✕</button></div>
      <h3>SOUND</h3>
      ${row('Master volume', `<input type="range" min="0" max="100" value="${Math.round(SFX.volume * 100)}" id="stVol"><span class="st-v" id="stVolV">${Math.round(SFX.volume * 100)}%</span>`)}
      ${row('Sound', sw('sound', !SFX.muted), 'Everything: effects and music')}
      ${row('Menu music', sw('music', opts.music))}
      <h3>GRAPHICS</h3>
      ${row('Quality', `<div class="seg" id="stGfx"><button data-v="high" class="${opts.gfx !== 'low' ? 'on' : ''}">HIGH</button><button data-v="low" class="${opts.gfx === 'low' ? 'on' : ''}">LOW</button></div>`, 'Low draws at normal pixel density: smoother on older machines')}
      ${row('Reduced motion', sw('calm', opts.calm), 'Calms the menu animations and idle effects')}
      <h3>GAME</h3>
      ${row('Bot chatter', sw('botchat', opts.botchat), 'Show what bots say in chat and speech bubbles')}
      <div class="sub st-foot">Settings are kept in this browser.</div></div>`;
    const vol = m.querySelector('#stVol'); vol.oninput = () => { SFX.setVolume(vol.value / 100); m.querySelector('#stVolV').textContent = vol.value + '%'; };
    vol.onchange = () => sfx('click');
    m.querySelectorAll('.sw').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k === 'sound') { SFX.toggle(); b.classList.toggle('on', !SFX.muted); const mb = $('#muteBtn'); if (mb) mb.textContent = SFX.muted ? '✕' : '♪'; }
      else { opts[k] = !opts[k]; b.classList.toggle('on', opts[k]); saveOpts(); applyOpts(); }
      if (k === 'music' || k === 'sound') { if (window.SECTOR_MUSIC) window.SECTOR_MUSIC(); }
      sfx('click');
    });
    m.querySelectorAll('#stGfx button').forEach(b => b.onclick = () => { opts.gfx = b.dataset.v; saveOpts(); Render.setLowGfx(opts.gfx === 'low'); m.querySelectorAll('#stGfx button').forEach(x => x.classList.toggle('on', x === b)); sfx('click'); });
    wire(m);
  }

  // shared modal shell
  function modal(id) { let m = $('#' + id); if (!m) { m = el('div', 'modal-bg home-modal'); m.id = id; document.body.appendChild(m); } m.hidden = false; return m; }
  function wire(m) { const close = () => { m.hidden = true; sfx('click'); }; m._close = close; m.querySelectorAll('[data-x]').forEach(b => b.onclick = close); m.onclick = e => { if (e.target === m) close(); }; }

  return { init, onMsg, render, shown, profile, settings, get opts() { return opts; }, get party() { return party; }, get you() { return me; } };
})();
