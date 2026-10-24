/* SECTOR — the Locker (your skins), the Store (today's shop and crates), Orders (objectives), Valor and match rewards.
   The server owns the profile: this only shows it and asks for buys and equips. */
const Locker = (() => {
  const C = SectorCosmetics, E = SectorEngine;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let profile = null, send = () => {}, open = null;   // open: 'locker' | 'store' | 'orders' | null
  let storeTab = 'shop';
  let tab = 'territory', cardFilter = 'owned', search = '';

  // this device's key to its commander. Signing in with Google or Discord can swap it for the key to that login's
  // commander (setIdentity); signing out starts a fresh guest commander (newIdentity)
  function setIdentity(o) { try { localStorage.setItem('sector.pid', o.id); localStorage.setItem('sector.psecret', o.secret); } catch (e) {} }
  function newIdentity() { try { localStorage.removeItem('sector.pid'); localStorage.removeItem('sector.psecret'); } catch (e) {} profile = null; return identity(); }
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
  function set(p) { profile = p; pill(); if (open === 'locker') drawLocker(); if (open === 'store') drawStore(); if (open === 'orders') drawOrders(); }
  const owns = id => !!profile && profile.owned.includes(id);
  const variant = cardId => (profile && profile.cards && profile.cards[cardId]) || null;
  const bannerClass = cos => cos && cos.banner ? ' bn-' + cos.banner : '';

  // ── the Valor pill on the menu (Valor is the in-game currency: medals for service) ──
  function pill() {
    let p = $('#coinPill');
    if (!p) {
      p = el('div', 'coin-pill', ''); p.id = 'coinPill';
      const bar = $('#mmRight'); if (bar) bar.prepend(p); else $('#menu').appendChild(p);   // the front menu's top bar
    }
    p.innerHTML = profile
      ? `<i class="vm"></i><b>${profile.coins.toLocaleString()}</b><button class="btn tiny" data-o="locker">LOCKER</button><button class="btn tiny${ordersReady() ? ' ping' : ''}" data-o="orders">ORDERS</button><button class="btn tiny gold${profile.freeCrates ? ' ping' : ''}" data-o="store">STORE</button>`
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
  function show(which, sub) { if (!profile) return; open = which; if (which === 'store' && sub) storeTab = sub; which === 'store' ? drawStore() : which === 'orders' ? drawOrders() : drawLocker(); }
  // the weekly crate is one order away
  const ordersReady = () => !!profile && !profile.weeklyCrate && profile.weekly.filter(o => !o.done).length === 1;
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
    else {
      // in today's shop at its price; any other day, three times that
      const price = C.priceOf(it.id, profile.store.day);
      const b = el('button', 'btn tiny gold', '<i class="vm"></i>' + price.toLocaleString()); b.disabled = profile.coins < price;
      b.onclick = () => { SFX.coin(4); b.disabled = true; send({ t: 'buy', item: it.id }); }; act.appendChild(b);
    }
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
      if (cardFilter === 'owned' && !items.length && !q) grid.appendChild(el('div', 'ix-empty', 'No card skins yet. Every card has one at every rarity, from Battle-Worn to a named Mythic. Open <b>crates</b> in the Store to find them, or switch to ALL CARDS to browse and buy one outright.'));
      items = items.slice(0, 90);
    } else items.sort((a, b) => (owns(b.id) - owns(a.id)) || E.RARITY_ORDER.indexOf(a.rarity) - E.RARITY_ORDER.indexOf(b.rarity));
    for (const it of items) grid.appendChild(tile(it, false));
    if (tab !== 'card') { const none = el('div', 'lk-tile none' + (!profile.equipped[tab] ? ' on' : ''), `<div class="lk-prev"><div class="sub">Standard</div></div><div class="lk-name"><b>None</b></div><div class="lk-act"></div>`); const b = el('button', 'btn tiny', profile.equipped[tab] ? 'USE STANDARD' : '✔ EQUIPPED'); b.onclick = () => send({ t: 'equip', slot: tab, item: null }); none.querySelector('.lk-act').appendChild(b); grid.prepend(none); }
    p.appendChild(grid);
  }
  function recruitBox() {
    const link = location.origin + '/?ref=' + profile.refCode;
    const b = el('div', 'lk-recruit', `<span>🎖 <b>Recruit:</b> friends who join with your link and make an account earn you <b><i class="vm"></i>250</b> each (and them <b><i class="vm"></i>100</b>) (3 earn the Recruiter banner) · recruited <b>${profile.recruits}</b></span><code>${esc(link)}</code><button class="btn tiny">COPY</button>`);
    b.querySelector('button').onclick = () => { try { navigator.clipboard.writeText(link); toastish('Link copied'); } catch (e) {} };
    return b;
  }
  function toastish(t) { if (window.SECTOR_TOAST) window.SECTOR_TOAST(t); }

  // ── the Store: things to spend Valor on. TODAY'S SHOP (the daily rotation) and CRATES ──
  function drawStore() {
    const p = shell('STORE');
    p.classList.add('store-card');
    const tabs = el('div', 'ix-tabs st-tabs');
    for (const [k, label] of [['shop', 'TODAY’S SHOP'], ['crates', 'CRATES' + (profile.freeCrates ? ` <span class="st-free">${profile.freeCrates} FREE</span>` : '')], ['factions', 'FACTIONS'], ['valor', 'VALOR']]) {
      const b = el('button', 'btn' + (storeTab === k ? ' on' : ''), label); b.onclick = () => { storeTab = k; SFX.click(); drawStore(); }; tabs.appendChild(b);
    }
    p.appendChild(tabs);
    if (storeTab === 'crates') return drawCrates(p);
    if (storeTab === 'factions') return drawFactions(p);
    if (storeTab === 'valor') return drawValor(p);
    const ends = Date.now() + profile.store.endsIn, left = () => { const ms = Math.max(0, ends - Date.now()), h = Math.floor(ms / 3.6e6), m = Math.floor(ms / 6e4) % 60; return h + 'h ' + String(m).padStart(2, '0') + 'm'; };
    const head = el('div', 'st-head', `<b>TODAY’S SHOP</b><span class="sub">new items in <i>${left()}</i></span><button class="btn tiny" id="stAll">BROWSE EVERYTHING ▸</button>`);
    head.querySelector('#stAll').onclick = () => { SFX.click(); show('locker'); };
    p.appendChild(head);
    const tick = setInterval(() => { if (!document.contains(head)) return clearInterval(tick); head.querySelector('i').textContent = left(); }, 30000);
    const grid = el('div', 'lk-grid store');
    for (const id of profile.store.items) grid.appendChild(tile(C.ITEMS[id], true));
    p.appendChild(grid);
  }
  // factions: one to start with, the rest unlocked for good with Valor (they change how you play, so each is a real choice)
  function drawFactions(p) {
    const own = profile.factions || Object.keys(E.FACTIONS), price = C.FACTION_PRICE;
    p.appendChild(el('div', 'st-head', `<b>FACTIONS</b><span class="sub">Unlock a faction once and play it in every war. You own <b>${own.length}</b> of ${Object.keys(E.FACTIONS).length}.</span>`));
    const grid = el('div', 'fx-grid');
    for (const [id, f] of Object.entries(E.FACTIONS)) {
      const has = own.includes(id), start = id === C.FACTION_START;
      const t = el('div', 'fx-card' + (has ? ' owned' : ''));
      t.innerHTML = `<div class="fx-icon"><img src="${Art.iconURL('glyph', f.glyph, has ? '#ffc53d' : '#8fa1b3', 96)}"></div><h3>${esc(f.name)}</h3><div class="fx-perk"><b>${esc(f.perk)}</b>${esc(f.desc)}</div><div class="fx-start">Starts with <b>${esc(E.UNITS[f.starter].name)}</b></div>`;
      if (has) t.appendChild(el('div', 'fx-own', start ? '✔ STARTER FACTION' : '✔ UNLOCKED'));
      else { const b = el('button', 'btn gold', 'UNLOCK · <i class="vm"></i>' + price.toLocaleString()); b.disabled = profile.coins < price; b.title = b.disabled ? 'Need ' + price.toLocaleString() + ' Valor' : ''; b.onclick = () => { SFX.coin(4); b.disabled = true; send({ t: 'buyFaction', id }); }; t.appendChild(b); }
      grid.appendChild(t);
    }
    p.appendChild(grid);
    p.appendChild(el('div', 'sub st-note', 'Factions change how you play (each has its own perk and starting unit), but none is stronger than the rest. Earn Valor from wars, orders and missions.'));
  }
  // Valor packs: not on sale yet (they arrive with accounts), so this shows where they'll be and how to earn Valor meanwhile
  function drawValor(p) {
    const packs = [['Field Ration', 500], ['Supply Run', 1200], ['War Chest', 2800], ['Treasury', 6500]];
    p.appendChild(el('div', 'st-head', '<b>VALOR PACKS</b><span class="sub">Coming with accounts</span>'));
    const grid = el('div', 'vp-grid');
    for (const [name, n] of packs) grid.appendChild(el('div', 'vp-card', `<div class="vp-medals">${'<i class="vm"></i>'.repeat(Math.min(5, 1 + packs.findIndex(x => x[1] === n)))}</div><h3>${esc(name)}</h3><div class="vp-n"><i class="vm"></i>${n.toLocaleString()}</div><button class="btn" disabled>SOON</button>`));
    p.appendChild(grid);
    p.appendChild(el('div', 'vp-earn', `<h3>EARN VALOR NOW</h3><div><b>Wars</b> pay Valor when they end: more for winning and fighting well.</div><div><b>Orders</b>: daily and weekly objectives, plus a free Field Crate for finishing every weekly order.</div><div><b>Missions</b> pay up to <i class="vm"></i>2,500 the first time you clear them.</div><div><b>Recruits</b>: <i class="vm"></i>250 for every friend who joins with your link and finishes a game.</div>`));
    p.appendChild(el('div', 'sub st-note', 'Everything in the store is looks or a faction to play: nothing you can buy makes you stronger.'));
  }
  // card skins come out of these
  function drawCrates(p) {
    const row = el('div', 'crate-row');
    for (const [id, B] of Object.entries(C.BOXES)) {
      const free = id === 'field' && profile.freeCrates > 0;
      const t = Crates.shelf(id, B, free ? `FREE <small>(${profile.freeCrates})</small>` : '<i class="vm"></i>' + B.price.toLocaleString(), free || profile.coins >= B.price, btn => openCrate(id, btn));
      if (free) t.classList.add('has-free');
      row.appendChild(t);
    }
    p.appendChild(row);
    p.appendChild(el('div', 'sub st-note', 'Every card has a skin at every rarity, Battle-Worn up to a named Mythic. Crates are the cheap way to find them; a few rotate through today’s shop, and any of them can be bought outright from the Locker. A duplicate pays back 30% of its value. Finish every weekly order for a free Field Crate.'));
  }
  function openCrate(id, btn) {
    const free = id === 'field' && profile.freeCrates > 0;
    if (!free && profile.coins < C.BOXES[id].price) return SFX.error && SFX.error();
    SFX.coin(4); if (btn) btn.disabled = true;
    send({ t: 'openBox', box: id, free });
  }

  // ── Orders: the daily and weekly objectives (what you're working toward, apart from what you buy) ──
  function drawOrders() {
    const p = shell('ORDERS');
    p.classList.add('orders-card');
    const row = o => `<div class="ob${o.done ? ' done' : ''}"><span>${esc(o.text)}</span><div class="bar"><i style="width:${Math.round(o.have / o.need * 100)}%"></i></div><b>${o.done ? '✔' : o.have + '/' + o.need}</b><em><i class="vm"></i>${o.coins}</em></div>`;
    const h = Math.floor(Math.max(0, profile.store.endsIn) / 3.6e6);
    const wk = profile.weekly, wDone = wk.filter(o => o.done).length;
    const obj = el('div', 'st-obj');
    obj.innerHTML = `<div class="or-col"><h3>DAILY <span class="sub">new in ${h}h</span></h3>${profile.daily.map(row).join('')}</div>`
      + `<div class="or-col"><h3>WEEKLY <span class="sub">${wDone}/${wk.length} done</span></h3>${wk.map(row).join('')}`
      + `<div class="or-crate${profile.weeklyCrate ? ' got' : ''}"><div class="or-art">${Crates.svg('field')}</div><div class="or-txt"><b>${profile.weeklyCrate ? '✔ Field Crate earned this week' : 'Complete every weekly order'}</b><div class="sub">${profile.weeklyCrate ? (profile.freeCrates ? 'It’s waiting for you in Store → Crates.' : 'New orders arrive next week.') : 'Reward: a free <b>Field Crate</b>, on top of each order’s Valor.'}</div></div>`
      + (profile.freeCrates ? `<button class="btn tiny gold" id="orOpen">OPEN IT</button>` : '') + `</div></div>`
      + `<div class="sub st-note">Matches pay Valor too: more for winning and fighting well. The more you've earned today (<i class="vm"></i>${profile.earnedToday.toLocaleString()} so far), the less each extra match adds, so play when you like without grinding.</div>`;
    p.appendChild(obj);
    const ob = obj.querySelector('#orOpen'); if (ob) ob.onclick = () => { storeTab = 'crates'; show('store'); };
  }

  // the server rolled it: play the opening, then offer another
  function boxOpened(m) {
    set(m.profile);
    const it = C.ITEMS[m.item], B = C.BOXES[m.box];
    const free = m.box === 'field' && profile.freeCrates > 0, can = free || profile.coins >= B.price;
    Crates.open(m, it, Cards.make(it.card, { variant: it.variant }), {
      again: can ? () => openCrate(m.box) : null,
      againLabel: free ? 'FREE' : '<i class="vm"></i>' + B.price.toLocaleString(),
      done: () => { if (open === 'store') drawStore(); },
    });
  }

  // ── something new is yours: it bursts out of a flash, rays turning behind it, and you can wear it straight away ──
  function unlock(o) {
    const it = o.item && C.ITEMS[o.item], f = o.faction && E.FACTIONS[o.faction];
    if (!it && !f) return;
    document.querySelectorAll('.unlock-fx').forEach(x => x.remove());
    const r = it ? rar(it.id) : { name: 'Faction', color: '#ffc53d' }, big = !it || ['epic', 'legendary', 'mythic'].includes(it.rarity);
    const w = el('div', 'unlock-fx' + (big ? ' big' : '')); w.style.setProperty('--rc', r.color);
    const stage = el('div', 'ul-stage', '<div class="ul-rays"></div><div class="ul-ring"></div><div class="ul-ring two"></div>');
    const prev = el('div', 'ul-prev' + (it ? ' s-' + it.slot : ' s-faction'));
    if (f) prev.innerHTML = `<img src="${Art.iconURL('glyph', f.glyph, '#ffc53d', 160)}" alt="">`;
    else if (it.slot === 'territory' || it.slot === 'border' || it.slot === 'trim') { const cv = el('canvas'); cv.width = 520; cv.height = 340; Skins.preview(cv, it.slot, it.id, '#36a3ff'); prev.appendChild(cv); }
    else if (it.slot === 'banner') prev.appendChild(el('div', 'pchip demo bn-' + it.id, `<div class="pn">${esc((profile && profile.name) || 'Commander')}</div><div class="ps"><span>⬢ <b>24</b></span><span>$<b>31</b></span></div>`));
    else prev.appendChild(Cards.make(it.card, { variant: it.variant }));
    stage.appendChild(prev);
    for (let i = 0; i < (big ? 26 : 16); i++) { const s = el('i', 'ul-spark'); s.style.setProperty('--a', (i * 360 / (big ? 26 : 16) + Math.random() * 10) + 'deg'); s.style.setProperty('--d', (150 + Math.random() * 140) + 'px'); s.style.setProperty('--dl', (0.18 + Math.random() * 0.15) + 's'); stage.appendChild(s); }
    w.appendChild(stage);
    const what = it ? (it.slot === 'card' ? 'Card version' : C.SLOTS[it.slot].replace(/s$/, '')) : f.perk;
    w.appendChild(el('div', 'ul-text', `<div class="ul-kicker">UNLOCKED</div><h2>${esc(it ? it.name : f.name)}</h2><div class="ul-rar"><b>${esc(it ? r.name : 'New faction')}</b> · ${esc(what)}</div>`));
    const btns = el('div', 'ul-btns');
    const close = () => { w.classList.add('gone'); setTimeout(() => w.remove(), 250); document.removeEventListener('keydown', key, true); };
    const key = e => { if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); close(); } };
    if (it && !isOn(it)) { const eq = el('button', 'btn gold', 'EQUIP NOW'); eq.onclick = () => { SFX.select(); send({ t: 'equip', slot: it.slot, item: it.id }); close(); }; btns.appendChild(eq); }
    const ok = el('button', 'btn', f ? 'AFFIRMATIVE' : 'CONTINUE'); ok.onclick = () => { SFX.click(); close(); }; btns.appendChild(ok);
    w.appendChild(btns);
    document.addEventListener('keydown', key, true);
    w.onclick = e => { if (e.target === w) close(); };
    document.body.appendChild(w);
    if (!it || ['legendary', 'mythic'].includes(it.rarity)) SFX.legendary(); else if (big || it.rarity === 'rare') SFX.rare(); else SFX.coin(6);
  }

  // ── after a game: what you earned ──
  function reward(r) {
    const lines = [];
    if (r.match) lines.push(`Match · <b><i class="vm"></i>${r.match}</b>` + (r.base > r.match ? ` <span class="sub">(<i class="vm"></i>${r.base} before today's tapering)</span>` : ''));
    else if (r.why) lines.push(`<span class="sub">${esc(r.why)}</span>`);
    for (const o of r.objectives || []) lines.push(`✔ ${esc(o.text)} · <b><i class="vm"></i>${o.coins}</b>`);
    if (r.crate) lines.push(`🎁 Every weekly order done · <b>free Field Crate</b> <span class="sub">(open it in Store → Crates)</span>`);
    if (r.referral) lines.push(`🎖 Welcome bonus for joining with a friend's link · <b><i class="vm"></i>${r.referral}</b>`);
    if (!lines.length) return;
    if (r.crate) setTimeout(() => SFX.legendary && SFX.legendary(), 900);
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
  return { init, identity, setIdentity, newIdentity, ref, set, show, unlock, variant, bannerClass, reward, boxOpened, get profile() { return profile; } };
})();
