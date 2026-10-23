/* SECTOR — the Locker (your skins), the Store (today's rotation), coins, objectives and match rewards.
   The server owns the profile: this only shows it and asks for buys and equips. */
const Locker = (() => {
  const C = SectorCosmetics, E = SectorEngine;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let profile = null, send = () => {}, open = null;   // open: 'locker' | 'store' | null
  let tab = 'territory', cardFilter = 'owned', search = '';

  // this device's profile key (until accounts arrive, the browser holds it)
  function identity() {
    try {
      let id = localStorage.getItem('sector.pid'), secret = localStorage.getItem('sector.psecret');
      if (!id || !secret) {
        const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
        id = hex(16); secret = hex(24); localStorage.setItem('sector.pid', id); localStorage.setItem('sector.psecret', secret);
      }
      return { id, secret };
    } catch (e) { return null; }
  }
  // a recruit link: /?ref=CODE (kept until the profile is made)
  function ref() {
    try { const r = new URLSearchParams(location.search).get('ref'); if (r) localStorage.setItem('sector.ref', r); return r || localStorage.getItem('sector.ref'); } catch (e) { return null; }
  }
  function init(o) { send = o.send; }
  function set(p) { profile = p; pill(); if (open === 'locker') drawLocker(); if (open === 'store') drawStore(); }
  const owns = id => !!profile && profile.owned.includes(id);
  const variant = cardId => (profile && profile.cards && profile.cards[cardId]) || null;
  const bannerClass = cos => cos && cos.banner ? ' bn-' + cos.banner : '';

  // ── the Valor pill on the menu (Valor is the in-game currency: medals for service) ──
  function pill() {
    let p = $('#coinPill');
    if (!p) {
      p = el('div', 'coin-pill', ''); p.id = 'coinPill';
      $('#menu').appendChild(p);
    }
    p.innerHTML = profile
      ? `<i class="vm"></i><b>${profile.coins.toLocaleString()}</b><button class="btn tiny" data-o="locker">LOCKER</button><button class="btn tiny gold" data-o="store">STORE</button>`
      : `<span class="sub">Enlist to load your skins</span>`;
    p.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { SFX.select(); show(b.dataset.o); });
  }

  // ── shared modal shell ──
  function shell(title) {
    let m = $('#lockerModal'); if (!m) { m = el('div', 'modal-bg'); m.id = 'lockerModal'; document.body.appendChild(m); }
    m.hidden = false; m.innerHTML = '';
    const p = el('div', 'panel locker-card');
    p.innerHTML = `<div class="ix-head"><h2>${title}</h2><div class="lk-coins"><i class="vm"></i><b>${profile ? profile.coins.toLocaleString() : 0}</b></div><button class="icon-btn" id="lkClose">✕</button></div>`;
    m.appendChild(p);
    const close = () => { m.hidden = true; open = null; SFX.click(); };
    p.querySelector('#lkClose').onclick = close; m.onclick = e => { if (e.target === m) close(); };
    return p;
  }
  function show(which) { if (!profile) return; open = which; which === 'store' ? drawStore() : drawLocker(); }
  const rar = id => C.ITEMS[id] ? E.RARITY[C.ITEMS[id].rarity] : E.RARITY.common;

  // a tile: preview, name, and what you can do with it
  function tile(it, inStore) {
    const t = el('div', 'lk-tile s-' + it.slot + ' r-' + it.rarity + (owns(it.id) ? ' owned' : '') + (isOn(it) ? ' on' : ''));
    const prev = el('div', 'lk-prev');
    if (it.slot === 'territory' || it.slot === 'border' || it.slot === 'trim') { const cv = el('canvas'); cv.width = 260; cv.height = 170; Skins.preview(cv, it.slot, it.id, '#36a3ff'); prev.appendChild(cv); }
    else if (it.slot === 'banner') prev.appendChild(el('div', 'pchip demo bn-' + it.id, `<div class="pn">${esc((profile && profile.name) || 'Commander')}</div><div class="ps"><span>⬢ <b>24</b></span><span>$<b>31</b></span></div>`));
    else prev.appendChild(Cards.make(it.card, { variant: it.variant }));
    t.appendChild(prev);
    t.appendChild(el('div', 'lk-name', `<b>${esc(it.name)}</b><span style="color:${rar(it.id).color}">${rar(it.id).name}</span>`));
    t.appendChild(el('div', 'lk-desc', esc(it.desc)));
    const act = el('div', 'lk-act');
    if (owns(it.id)) {
      const b = el('button', 'btn tiny' + (isOn(it) ? ' green' : ''), isOn(it) ? '✔ EQUIPPED' : 'EQUIP');
      b.onclick = () => { SFX.select(); send({ t: 'equip', slot: it.slot, item: it.slot !== 'card' && isOn(it) ? null : it.id }); };
      act.appendChild(b);
    } else if (it.buy === false) act.appendChild(el('span', 'sub', it.id.includes('recruit') ? '🎖 Earned by recruiting' : '🏅 Never sold'));
    else if (it.slot !== 'card' && !inStore && !C.dailyStore(profile.store.day).items.includes(it.id)) act.appendChild(el('span', 'sub', '<i class="vm"></i>' + it.price.toLocaleString() + ' · when it’s in the store'));
    else { const b = el('button', 'btn tiny gold', '<i class="vm"></i>' + it.price.toLocaleString()); b.disabled = profile.coins < it.price; b.onclick = () => { SFX.coin(4); send({ t: 'buy', item: it.id }); }; act.appendChild(b); }
    t.appendChild(act);
    return t;
  }
  const isOn = it => !!profile && (it.slot === 'card' ? profile.cards[it.card] === it.variant : profile.equipped[it.slot] === it.id);

  // ── the Locker: everything, owned or not, by slot ──
  function drawLocker() {
    const p = shell('LOCKER');
    const tabs = el('div', 'ix-tabs');
    for (const [k, label] of Object.entries(C.SLOTS)) { const b = el('button', 'btn' + (tab === k ? ' on' : ''), label.toUpperCase()); b.onclick = () => { tab = k; SFX.click(); drawLocker(); }; tabs.appendChild(b); }
    p.appendChild(tabs);
    p.appendChild(recruitBox());
    const grid = el('div', 'lk-grid');
    let items = Object.values(C.ITEMS).filter(i => i.slot === tab);
    if (tab === 'card') {
      const bar = el('div', 'lk-filter', `<button class="chip${cardFilter === 'owned' ? ' on' : ''}" data-f="owned">MINE</button><button class="chip${cardFilter === 'all' ? ' on' : ''}" data-f="all">ALL CARDS</button><input placeholder="Search a card…" value="${esc(search)}">`);
      bar.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { cardFilter = b.dataset.f; drawLocker(); });
      const inp = bar.querySelector('input'); inp.oninput = () => { search = inp.value; clearTimeout(inp._t); inp._t = setTimeout(() => { drawLocker(); const i2 = $('.lk-filter input'); if (i2) { i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); } }, 250); };
      p.appendChild(bar);
      const q = search.trim().toLowerCase();
      items = items.filter(i => (cardFilter === 'all' || owns(i.id)) && (!q || E.cardDef(i.card).name.toLowerCase().includes(q)));
      if (cardFilter === 'owned' && !items.length && !q) grid.appendChild(el('div', 'ix-empty', 'No card versions yet. Every card comes in <b>Foil</b>, <b>Gilded</b> and <b>Blackout</b>: switch to ALL CARDS to browse and buy them.'));
      items = items.slice(0, 90);
    } else items.sort((a, b) => (owns(b.id) - owns(a.id)) || E.RARITY_ORDER.indexOf(a.rarity) - E.RARITY_ORDER.indexOf(b.rarity));
    for (const it of items) grid.appendChild(tile(it, false));
    if (tab !== 'card') { const none = el('div', 'lk-tile none' + (!profile.equipped[tab] ? ' on' : ''), `<div class="lk-prev"><div class="sub">Standard</div></div><div class="lk-name"><b>None</b></div><div class="lk-act"></div>`); const b = el('button', 'btn tiny', profile.equipped[tab] ? 'USE STANDARD' : '✔ EQUIPPED'); b.onclick = () => send({ t: 'equip', slot: tab, item: null }); none.querySelector('.lk-act').appendChild(b); grid.prepend(none); }
    p.appendChild(grid);
  }
  function recruitBox() {
    const link = location.origin + '/?ref=' + profile.refCode;
    const b = el('div', 'lk-recruit', `<span>🎖 <b>Recruit:</b> friends who join with your link and finish a game earn you <b><i class="vm"></i>250</b> each (3 earn the Recruiter banner) · recruited <b>${profile.recruits}</b></span><code>${esc(link)}</code><button class="btn tiny">COPY</button>`);
    b.querySelector('button').onclick = () => { try { navigator.clipboard.writeText(link); toastish('Link copied'); } catch (e) {} };
    return b;
  }
  function toastish(t) { if (window.SECTOR_TOAST) window.SECTOR_TOAST(t); }

  // ── the Store: today's rotation, objectives, and (later) coin packs ──
  function drawStore() {
    const p = shell('STORE');
    const ends = Date.now() + profile.store.endsIn, left = () => { const ms = Math.max(0, ends - Date.now()), h = Math.floor(ms / 3.6e6), m = Math.floor(ms / 6e4) % 60; return h + 'h ' + String(m).padStart(2, '0') + 'm'; };
    const head = el('div', 'st-head', `<b>TODAY’S STORE</b><span class="sub">new items in <i>${left()}</i></span>`);
    p.appendChild(head);
    const tick = setInterval(() => { if (!document.contains(head)) return clearInterval(tick); head.querySelector('i').textContent = left(); }, 30000);
    const grid = el('div', 'lk-grid store');
    for (const id of profile.store.items) grid.appendChild(tile(C.ITEMS[id], true));
    p.appendChild(grid);
    const obj = el('div', 'st-obj');
    const row = o => `<div class="ob${o.done ? ' done' : ''}"><span>${esc(o.text)}</span><div class="bar"><i style="width:${Math.round(o.have / o.need * 100)}%"></i></div><b>${o.done ? '✔' : o.have + '/' + o.need}</b><em><i class="vm"></i>${o.coins}</em></div>`;
    obj.innerHTML = `<div><h3>DAILY</h3>${profile.daily.map(row).join('')}</div><div><h3>WEEKLY</h3>${profile.weekly.map(row).join('')}</div>`
      + `<div class="sub st-note">Matches pay Valor too: more for winning and fighting well. The more you've earned today (<i class="vm"></i>${profile.earnedToday.toLocaleString()} so far), the less each extra match adds, so play when you like without grinding.</div>`;
    p.appendChild(obj);
    p.appendChild(el('div', 'st-packs', '<h3>VALOR PACKS</h3><div class="sub">Buying Valor arrives with accounts. Everything in the store is looks only: nothing you can buy changes the game.</div>'));
  }

  // ── after a game: what you earned ──
  function reward(r) {
    const lines = [];
    if (r.match) lines.push(`Match · <b><i class="vm"></i>${r.match}</b>` + (r.base > r.match ? ` <span class="sub">(<i class="vm"></i>${r.base} before today's tapering)</span>` : ''));
    else if (r.why) lines.push(`<span class="sub">${esc(r.why)}</span>`);
    for (const o of r.objectives || []) lines.push(`✔ ${esc(o.text)} · <b><i class="vm"></i>${o.coins}</b>`);
    if (r.referral) lines.push(`🎖 Welcome bonus for joining with a friend's link · <b><i class="vm"></i>${r.referral}</b>`);
    if (!lines.length) return;
    const total = (r.match || 0) + (r.objectives || []).reduce((a, o) => a + o.coins, 0) + (r.referral || 0);
    const b = el('div', 'reward-pop', `<h3>VALOR EARNED</h3><div class="rw-total"><i class="vm big"></i><b>+0</b></div>${lines.map((l, i) => `<div style="animation-delay:${0.25 + i * 0.18}s">${l}</div>`).join('')}`);
    document.body.appendChild(b);
    // the total counts up with a rising chime, and medals spin off toward your Valor pill
    const tb = b.querySelector('.rw-total b'), t0 = performance.now(), dur = Math.min(1600, 500 + total * 2);
    let lastStep = -1;
    const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = Math.round(total * e); tb.textContent = '+' + v.toLocaleString(); const st = Math.floor(e * 12); if (st > lastStep) { lastStep = st; SFX.coin(1 + st % 6); } if (k < 1) requestAnimationFrame(tick); else { tb.parentElement.classList.add('done'); SFX.rare(); } };
    requestAnimationFrame(tick);
    const pillEl = $('#coinPill'), to = pillEl && pillEl.getBoundingClientRect(), from = b.querySelector('.rw-total').getBoundingClientRect();
    if (to && to.width) for (let i = 0; i < Math.min(14, 4 + Math.round(total / 40)); i++) setTimeout(() => {
      const m = el('i', 'vm fly'); m.style.left = (from.left + 20 + Math.random() * 40) + 'px'; m.style.top = (from.top + 10) + 'px'; document.body.appendChild(m);
      requestAnimationFrame(() => { m.style.transform = `translate(${to.left + 20 - from.left - 40}px, ${to.top + 10 - from.top - 10}px) rotate(${360 + Math.random() * 360}deg) scale(.7)`; m.style.opacity = '0.4'; });
      setTimeout(() => { m.remove(); if (pillEl) { pillEl.classList.remove('bump'); void pillEl.offsetWidth; pillEl.classList.add('bump'); } }, 750);
    }, 400 + i * 90);
    setTimeout(() => b.classList.add('gone'), 7000); setTimeout(() => b.remove(), 7600);
    b.onclick = () => b.remove();
  }
  return { init, identity, ref, set, show, variant, bannerClass, reward, get profile() { return profile; } };
})();
