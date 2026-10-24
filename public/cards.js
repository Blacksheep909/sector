/* SECTOR — cards: faces, supply crates, opening draft, deck replacement, card index */
const Cards = (() => {
  // paint the shared card back once the title font is ready
  const paintBack = () => { try { document.documentElement.style.setProperty('--card-back', 'url(' + Art.cardBack() + ')'); } catch (e) {} };
  if (document.fonts && document.fonts.load) document.fonts.load('96px "Black Ops One"').then(paintBack, paintBack); else paintBack();
  const E = SectorEngine;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const sleep = ms => new Promise(r => setTimeout(r, document.hidden ? 1 : ms * (Cards.fast ? 0.15 : 1)));
  const RANK = r => E.RARITY_ORDER.indexOf(r);
  const TIER_COL = { standard: '#9fb3c8', gilded: '#ffc53d', mythic: '#c25cff' };

  // ───────────── card face ─────────────
  // opts: { mini, cost, level, key, count, owned, tag }
  function make(id, opts = {}) {
    const d = E.cardDef(id);
    // the version of this card you've equipped (Foil, Gilded, Blackout); the index and other players' cards show the standard one
    const v = opts.variant !== undefined ? opts.variant : (typeof Locker !== 'undefined' && Locker.variant(id));
    const c = el('div', `card r-${d.rarity} k-${d.kind}${opts.mini ? ' mini' : ''}${d.cls ? ' c-' + d.cls : ''}${v ? ' cv-' + v : ''}`);
    c.dataset.id = id;
    c.style.setProperty('--dl', (-Math.random() * 4).toFixed(2) + 's');
    const cost = opts.cost ?? d.cost;
    const lv = opts.level || 0;
    const stars = lv ? `<div class="c-stars">${'★'.repeat(lv)}</div>` : '';
    let stats = '';
    if (d.kind === 'unit') stats = `<div class="c-stats"><span class="a" title="Attack">${d.atk + (d.atk ? lv : 0)}</span><span class="d" title="Defence">${d.def + lv}</span><span class="m" title="Move">${d.mv}</span>${d.range ? `<span class="r" title="Range">${d.range}</span>` : ''}</div>`;
    const type = d.kind === 'unit' ? E.CLASS_NAME[d.cls] : 'Tactic';
    c.innerHTML = `<div class="ci">
      <div class="c-top"><div class="c-cost">$${cost}</div><div class="c-gem" title="${E.RARITY[d.rarity].name}"></div></div>
      <div class="c-art"><img src="${Art.cardArt(id)}" alt=""></div>
      ${stars}
      <div class="c-name${d.name.length > 12 ? ' long' : ''}">${d.name}</div>
      <div class="c-type">${type} · ${E.RARITY[d.rarity].name}</div>
      ${stats}
      <div class="c-desc">${d.desc}</div>
      <div class="c-foil"></div><div class="c-shine"></div>
    </div>` + (opts.key ? `<span class="c-key">${opts.key}</span>` : '') + (opts.count ? `<span class="count">${opts.count}</span>` : '') + (opts.tag ? `<span class="c-tag">${opts.tag}</span>` : '');
    tilt(c);
    return c;
  }
  function tilt(c) {
    const ci = c.querySelector('.ci');
    c.addEventListener('mousemove', e => {
      const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      ci.style.setProperty('--ry', (x * 24).toFixed(1) + 'deg'); ci.style.setProperty('--rx', (-y * 24).toFixed(1) + 'deg');
      ci.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(0) + '%'); ci.style.setProperty('--my', ((y + 0.5) * 100).toFixed(0) + '%');
    });
    c.addEventListener('mouseleave', () => { ci.style.setProperty('--rx', '0deg'); ci.style.setProperty('--ry', '0deg'); });
    c.addEventListener('mouseenter', () => SFX.hover());
  }

  // ───────────── particle helpers (DOM, on #flyLayer) ─────────────
  function burstAt(x, y, colors, n, spread = 220, size = 8) {
    const layer = $('#flyLayer');
    for (let i = 0; i < n; i++) {
      const p = el('div', 'spark'); p.style.background = colors[i % colors.length]; p.style.width = p.style.height = (size * (0.5 + Math.random())) + 'px';
      p.style.left = x + 'px'; p.style.top = y + 'px'; layer.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = spread * (0.3 + Math.random());
      p.animate([{ transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 60}px) rotate(${Math.random() * 720}deg) scale(0)`, opacity: 0 }],
        { duration: 700 + Math.random() * 700, easing: 'cubic-bezier(.1,.8,.3,1)' }).onfinish = () => p.remove();
    }
  }
  // rays anchored to an element: they follow the card wherever its animation takes it
  function raysOn(elm, color, dur = 1200, big = false) {
    const host = (elm.closest && elm.closest('.flip')) || elm;
    const r = el('div', 'rays local' + (big ? ' big' : '')); r.style.setProperty('--rc', color);
    host.insertBefore(r, host.firstChild); setTimeout(() => r.remove(), dur);
  }
  function rays(x, y, color, dur = 1200, big = false) {
    const r = el('div', 'rays' + (big ? ' big' : '')); r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.setProperty('--rc', color);
    $('#flyLayer').appendChild(r); setTimeout(() => r.remove(), dur);
  }
  function bigText(text, color, cls = '') {
    const b = el('div', 'bigtext ' + cls, text); b.style.setProperty('--tc', color); $('#flyLayer').appendChild(b); setTimeout(() => b.remove(), 1700);
  }
  const center = e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  // reveal effect for a single flipped card, by rarity
  async function revealFx(card, rarity, staged) {
    const [x, y] = center(card), col = E.RARITY[rarity].color, rk = RANK(rarity);
    // a staged card is big at the centre: its word goes just above it
    const bigText = (text, color, cls) => { const b = el('div', 'bigtext ' + cls, text); b.style.setProperty('--tc', color); if (staged) { b.style.top = Math.max(8, staged.getBoundingClientRect().top - 110) + 'px'; } $('#flyLayer').appendChild(b); setTimeout(() => b.remove(), 1900); };
    card.classList.add('pop');
    if (rk === 0) { SFX.card(); return; }
    if (rk === 1) { SFX.select(); burstAt(x, y, [col, '#fff'], 16, 160); return; }
    if (rk === 2) { SFX.rare(); raysOn(card, col); burstAt(x, y, [col, '#fff'], 30, 240); Render.shake(5); return; }
    if (rk === 3) { SFX.rare(); setTimeout(() => SFX.legendary(), 120); raysOn(card, col, 1600, true); burstAt(x, y, [col, '#ff8af6', '#fff'], 60, 320, 10); Render.shake(10); bigText('EPIC!', col, 'epic'); return; }
    if (rk >= 5) {
      // mythic: a white-hot, rainbow-edged reveal
      SFX.legendary(); setTimeout(() => SFX.legendary(), 260); Render.flash(0.7, '#ffffff'); Render.shake(24);
      raysOn(card, '#ffffff', 3000, true); burstAt(x, y, ['#ffffff', '#ff7ad9', '#7af7ff', '#fff27a', '#9dff7a', '#b48cff'], 160, 540, 12);
      bigText('MYTHIC', '#ffffff', 'legend mythic');
      setTimeout(() => burstAt(x, y, ['#fff', '#7af7ff', '#ff7ad9'], 80, 420, 9), 450);
      return;
    }
    SFX.legendary(); Render.flash(0.45, '#ffb52e'); Render.shake(18);
    raysOn(card, col, 2400, true); burstAt(x, y, ['#ffb52e', '#fff3a8', '#ff6a3d', '#fff'], 120, 480, 11);
    bigText('LEGENDARY', col, 'legend');
    setTimeout(() => burstAt(x, y, ['#ffb52e', '#fff'], 60, 380, 8), 400);
  }

  // ───────────── hands-on reveal: the backs hint rarity, you flip each card ─────────────
  async function dealIn(slots, settle = 420) {
    for (const s of slots) { s.flip.classList.add('dealt'); SFX.card(); await sleep(110); }
    await sleep(settle);
  }
  // spam-clicking: a click during a flip finishes it at once, and the next flips play at triple speed
  function rush(slots) { let any = false; for (const s of slots) if (s.flipping && s.rush) { s.rush(); any = true; } return any; }
  async function flipCard(s, box, quick) {
    if (s.flipping || s.flip.classList.contains('open')) return;
    s.flipping = true;
    const rk = RANK(s.d.rarity), f = Cards.fast ? 0.3 : quick ? 0.33 : 1;
    if (rk >= 3) return showcase(s, box, rk, f);
    s.flip.classList.remove('tell'); s.flip.classList.add('lifting');
    const r = s.flip.getBoundingClientRect();
    const dx = innerWidth / 2 - (r.left + r.width / 2), dy = innerHeight * 0.45 - (r.top + r.height / 2);
    let frames, dur, revealAt;
    if (rk <= 1) {
      dur = 520 * f; revealAt = 0.55;
      frames = [
        { transform: 'translateY(0) rotateY(180deg) scale(1)' },
        { transform: 'translateY(-36px) rotateY(180deg) scale(1.1)', offset: 0.3 },
        { transform: 'translateY(-30px) rotateY(-12deg) scale(1.18)', offset: 0.7 },
        { transform: 'translateY(6px) rotateY(4deg) scale(.95, 1.05)', offset: 0.86 },
        { transform: 'translateY(0) rotateY(0deg) scale(1)' }];
    } else if (rk === 2) {
      dur = 1050 * f; revealAt = 0.62;
      frames = [
        { transform: 'translateY(0) rotateY(180deg) scale(1)' },
        { transform: 'translateY(-60px) rotateY(180deg) scale(1.2)', offset: 0.25 },
        { transform: 'translateY(-70px) rotateY(-300deg) scale(1.32)', offset: 0.6 },
        { transform: 'translateY(-60px) rotateY(-360deg) scale(1.3)', offset: 0.7 },
        { transform: 'translateY(8px) rotateY(-360deg) scale(.94, 1.06)', offset: 0.88 },
        { transform: 'translateY(0) rotateY(-360deg) scale(1)' }];
    } else if (rk === 3) {
      dur = 2000 * f; revealAt = 0.66;
      const C = `translate(${dx}px, ${dy}px)`;
      frames = [
        { transform: 'translate(0,0) rotateY(180deg) scale(1)' },
        { transform: `${C} rotateY(180deg) scale(1.45)`, offset: 0.2 },
        { transform: `${C} rotateY(180deg) scale(1.5) rotate(-3deg)`, offset: 0.27 },
        { transform: `${C} rotateY(180deg) scale(1.5) rotate(3deg)`, offset: 0.34 },
        { transform: `${C} rotateY(180deg) scale(1.52) rotate(-4deg)`, offset: 0.4 },
        { transform: `${C} rotateY(-720deg) scale(1.7)`, offset: 0.64 },
        { transform: `${C} rotateY(-720deg) scale(1.62)`, offset: 0.84 },
        { transform: 'translate(0,0) rotateY(-720deg) scale(1)' }];
    } else {
      dur = 3000 * f; revealAt = 0.7;
      const C = `translate(${dx}px, ${dy}px)`;
      const jit = [];
      for (let i = 0; i < 8; i++) jit.push({ transform: `${C} rotateY(180deg) scale(${1.5 + i * 0.02}) rotate(${i % 2 ? 5 : -5}deg) translate(${i % 2 ? 4 : -4}px, ${i % 3 ? -3 : 3}px)`, offset: 0.2 + i * 0.03 });
      frames = [
        { transform: 'translate(0,0) rotateY(180deg) scale(1)' },
        { transform: `${C} rotateY(180deg) scale(1.45)`, offset: 0.16 },
        ...jit,
        { transform: `${C} rotateY(-360deg) scale(1.75)`, offset: 0.52, easing: 'cubic-bezier(.5,0,1,1)' },
        { transform: `${C} rotateY(-1080deg) scale(1.9)`, offset: 0.68 },
        { transform: `${C} rotateY(-1080deg) scale(1.82)`, offset: 0.88 },
        { transform: 'translate(0,0) rotateY(-1080deg) scale(1)' }];
    }
    if (rk >= 3) { box.classList.add('dim'); SFX.zap(); }
    if (rk === 4) { SFX.alarm(); s.flip.classList.add('cracking'); }
    SFX.whoosh();
    const anim = s.flip.animate(frames, { duration: dur, easing: 'cubic-bezier(.3,.1,.3,1)' });
    // swap faces at the reveal moment and fire the rarity effects while the card is front and centre
    let shown = false;
    const show = () => {
      if (shown) return; shown = true;
      s.flip.classList.add('open'); s.flip.classList.remove('cracking');
      SFX.diceLand(); SFX.chip(4 + rk * 2);
      revealFx(s.front, s.d.rarity);
      const [x, y] = center(s.front);
      const ring = el('div', 'ringfx'); ring.style.left = x + 'px'; ring.style.top = y + 'px'; ring.style.borderColor = E.RARITY[s.d.rarity].color; $('#flyLayer').appendChild(ring); setTimeout(() => ring.remove(), 800);
      if (rk === 4) confetti();
    };
    setTimeout(show, dur * revealAt);
    s.rush = () => { show(); try { anim.finish(); } catch (e) {} };
    await new Promise(res => { anim.onfinish = res; setTimeout(res, dur + 80); });
    s.rush = null;
    s.flip.classList.remove('lifting');
    box.classList.remove('dim');
    s.flipping = false;
  }
  // epic, legendary and mythic cards get the stage: they charge up at the centre, turn over in one clean half-turn
  // (faces swap exactly edge-on, so nothing is ever seen mirrored), hold big and face-up, then glide back to their slot
  async function showcase(s, box, rk, f) {
    const T = rk >= 5 ? { col: '#ffffff', charge: 1500, hold: 1900, scale: 1.8, word: 'MYTHIC', cls: 'legend mythic' }
      : rk === 4 ? { col: '#ffb52e', charge: 1150, hold: 1450, scale: 1.75, word: 'LEGENDARY', cls: 'legend' }
      : { col: '#c25cff', charge: 550, hold: 750, scale: 1.55, word: 'EPIC!', cls: 'epic' };
    s.flipping = true;
    const el0 = s.flip, anims = [], live = new Set();
    let skip = false;
    const wait = ms => new Promise(res => { if (skip) return res(); const t = setTimeout(res, ms * f); live.add({ t, res }); });
    const hurry = () => { if (skip) return; skip = true; for (const w of live) { clearTimeout(w.t); w.res(); } live.clear(); for (const a of anims) try { a.finish(); } catch (e) {} };
    s.rush = hurry;
    el0.classList.remove('tell'); el0.classList.add('lifting', 'stage-' + (rk >= 5 ? 'mythic' : rk === 4 ? 'legendary' : 'epic'));
    box.classList.add('dim');
    const r = el0.getBoundingClientRect(), dx = innerWidth / 2 - (r.left + r.width / 2), dy = innerHeight * 0.47 - (r.top + r.height / 2);
    const C = `translate(${dx}px, ${dy}px)`, go = (frames, ms, easing) => { const a = el0.animate(frames, { duration: skip ? 1 : ms * f, easing, fill: 'forwards' }); anims.push(a); return new Promise(res => { a.onfinish = res; a.oncancel = res; }); };
    // 1. charge: lift to the centre, then tremble harder and harder while the light builds behind it
    SFX.whoosh(); if (rk >= 4) SFX.alarm(); else SFX.zap();
    const glow = el('div', 'stage-glow'); glow.style.setProperty('--sc', T.col); el0.insertBefore(glow, el0.firstChild);
    await go([{ transform: 'rotateY(180deg)' }, { transform: `${C} rotateY(180deg) scale(${T.scale - 0.2})` }], 420, 'cubic-bezier(.2,.9,.3,1)');
    el0.classList.add('charging');
    const steps = rk >= 4 ? 6 : 3;
    for (let i = 0; i < steps && !skip; i++) {
      el0.style.setProperty('--amp', (1 + i * 1.3).toFixed(1) + 'px'); glow.style.setProperty('--gl', String(0.25 + 0.75 * (i + 1) / steps));
      SFX.chip(4 + i * 2); if (i >= steps - 2) Render.shake(3 + i * 2);
      await wait(T.charge / steps);
    }
    el0.classList.remove('charging');
    // 2. the turn: quick to edge-on, swap faces there, then settle face-up with a little overshoot
    await go([{ transform: `${C} rotateY(180deg) scale(${T.scale - 0.2})` }, { transform: `${C} rotateY(90deg) scale(${T.scale + 0.1})` }], 170, 'cubic-bezier(.5,0,1,.6)');
    el0.classList.add('open');
    { const [x, y] = center(el0); const fl = el('div', 'stage-flash'); fl.style.left = x + 'px'; fl.style.top = y + 'px'; fl.style.setProperty('--sc', T.col); $('#flyLayer').appendChild(fl); setTimeout(() => fl.remove(), 700); }
    SFX.diceLand(); SFX.chip(4 + rk * 2);
    revealFx(s.front, s.d.rarity, el0);
    if (rk === 4) confetti();
    await go([{ transform: `${C} rotateY(90deg) scale(${T.scale + 0.1})` }, { transform: `${C} rotateY(-12deg) scale(${T.scale + 0.05})`, offset: 0.65 }, { transform: `${C} rotateY(0deg) scale(${T.scale})` }], 420, 'cubic-bezier(.2,.9,.3,1)');
    // 3. the showcase: held big and face-up; a click (or Space) moves on
    el0.classList.add('showing');
    const onClick = e => { e.stopPropagation(); hurry(); };
    box.addEventListener('click', onClick, true);
    await wait(T.hold);
    box.removeEventListener('click', onClick, true);
    el0.classList.remove('showing');
    // 4. back to its slot
    const back = el0.animate([{ transform: `${C} rotateY(0deg) scale(${T.scale})` }, { transform: 'rotateY(0deg)' }], { duration: skip ? 160 : 460 * f, easing: 'cubic-bezier(.5,0,.25,1)' });
    for (const a of anims) a.cancel();
    box.classList.remove('dim');
    await new Promise(res => { back.onfinish = res; back.oncancel = res; setTimeout(res, 700); });
    glow.remove();
    el0.classList.remove('lifting', 'stage-epic', 'stage-legendary', 'stage-mythic');
    s.rush = null; s.flipping = false;
  }
  function confetti() {
    const cols = ['#ffb52e', '#fff3a8', '#ff4f5e', '#36c9ff', '#59f08a', '#c25cff'];
    for (let i = 0; i < 90; i++) {
      const p = el('div', 'confetti'); p.style.background = cols[i % cols.length];
      p.style.left = (Math.random() * innerWidth) + 'px'; p.style.top = '-20px';
      $('#flyLayer').appendChild(p);
      p.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${(Math.random() - 0.5) * 300}px, ${innerHeight + 60}px) rotate(${Math.random() * 1440}deg)` }], { duration: 1800 + Math.random() * 1600, delay: Math.random() * 400, easing: 'cubic-bezier(.3,.2,.6,1)' }).onfinish = () => p.remove();
    }
  }
  function revealRow(box, slots, auto) {
    box.querySelectorAll('.reveal-bar').forEach(b => b.remove());
    return new Promise(res => {
      const hint = el('div', 'cr-hint', 'CLICK A CARD TO REVEAL · SPACE FOR NEXT');
      const all = el('button', 'btn reveal-all', 'REVEAL ALL');
      const wrap = el('div', 'reveal-bar'); wrap.append(hint, all); box.appendChild(wrap);
      let done = false;
      const check = () => { if (!done && slots.every(s => s.flip.classList.contains('open') && !s.flipping)) { done = true; removeEventListener('keydown', key, true); wrap.remove(); res(); } };
      const busy = () => slots.some(s => s.flipping);
      let lastClick = 0;
      const quick = () => { const q = Date.now() - lastClick < 1500; lastClick = Date.now(); return q; };
      const next = async () => { const q = quick(); if (busy()) { rush(slots); await sleep(30); } const s = slots.find(s => !s.flip.classList.contains('open') && !s.flipping); if (s) { await flipCard(s, box, q); check(); } };
      const key = e => { if (e.key === ' ' && !box.hidden) { e.preventDefault(); e.stopPropagation(); next(); } };
      addEventListener('keydown', key, true);
      all.onclick = async () => { if (all.disabled) return; all.disabled = true; rush(slots); while (busy()) await sleep(50); for (const s of slots) { if (!s.flip.classList.contains('open')) { await flipCard(s, box, true); await sleep(120); } } check(); };
      slots.forEach(s => {
        s.flip.addEventListener('click', async () => {
          if (s.flip.classList.contains('open')) return;
          const q = quick();
          if (s.flipping) { rush(slots); return; }
          if (busy()) { rush(slots); await sleep(30); }
          await flipCard(s, box, q); check();
        });
        s.flip.addEventListener('mouseenter', () => { if (s.flip.classList.contains('open')) return; const rk = RANK(s.d.rarity); SFX.chip(rk * 3); if (rk >= 3) Render.shake(2); });
      });
      // auto: the cards turn over by themselves one after another (a click or Space still hurries them along)
      if (auto) (async () => {
        await sleep(auto);
        for (const s of slots) {
          if (done || !document.contains(s.flip)) return;
          if (s.flip.classList.contains('open') || s.flipping) continue;
          await flipCard(s, box); check(); await sleep(140);
        }
      })();
      // never stall the game: flip whatever's left after a while
      setTimeout(() => { if (!done) all.click(); }, 14000);
    });
  }

  // ───────────── resupply: the start-of-turn menu (a card + most of your income, or the full income) ─────────────
  let supplyKey = '';
  function openSupply(ctx) {
    const key = ctx.key;
    if (supplyKey === key && !$('#supply').hidden) return;
    supplyKey = key; clearTimeout(supplyFade);
    const box = $('#supply'); box.innerHTML = ''; box.hidden = false; box.className = '';
    Cards.fast = false;
    const { me, offer, income } = ctx;
    box.appendChild(el('div', 'sd-rays'));
    box.appendChild(el('h2', '', 'RESUPPLY'));
    box.appendChild(el('div', 'sub', `Round ${ctx.round} — take a card and keep <b>the cash under it</b>, or skip the cards and collect the full <b>$${income}</b>.`));
    const row = el('div', 'cr-cards');
    const slots = offer.map((id, i) => {
      const d = E.cardDef(id);
      const owned = d.kind === 'unit' && me.arsenal.includes(id);
      const lv = owned ? (me.levels[id] || 0) : 0;
      const tag = owned ? (lv >= E.MAX_LEVEL ? 'MAXED · +$' + (ctx.refund || 4) : 'UPGRADE ★' + (lv + 1)) : (d.kind === 'unit' && me.arsenal.length >= E.DECK_MAX ? 'DECK FULL · REPLACE' : d.kind === 'unit' ? 'NEW UNIT' : 'TACTIC');
      const flip = el('div', 'flip r-' + d.rarity); flip.style.setProperty('--i', i);
      const back = el('div', 'cback', '<div class="cb-logo">⬢</div>');
      const front = make(id, { level: owned ? Math.min(E.MAX_LEVEL, lv + 1) : 0, tag }); front.classList.add('cfront');
      // what you keep of this turn's income if you take this card
      flip.append(back, front, el('div', 'sp-keep', '+$' + (income - E.cardFee(income, id)))); row.appendChild(flip);
      return { flip, front, d, id };
    });
    box.appendChild(row);
    const bar = el('div', 'supply-row');
    const col = el('button', 'btn big green', 'COLLECT $' + income);
    const rr = el('button', 'btn big gold', 'REROLL $' + ctx.rerollCost);
    rr.disabled = me.cash < ctx.rerollCost;
    if (ctx.prep) rr.hidden = true;   // picking ahead for next turn: no rerolls
    const look = el('button', 'btn big', 'PEEK MAP');
    look.onmousedown = () => { box.style.opacity = 0.06; }; look.onmouseup = look.onmouseleave = () => { box.style.opacity = 1; };
    bar.append(col, rr, look); box.appendChild(bar);
    box.appendChild(el('div', 'sd-keys', '<b>1</b> <b>2</b> <b>3</b> take a card · <b>C</b> collect · <b>Space</b> flip'));
    let busy = false;
    col.onclick = async () => { if (busy) return; busy = true; SFX.coin(5); box.classList.add('leaving'); if (!(await ctx.onIncome())) { busy = false; box.classList.remove('leaving'); } };
    rr.onclick = async () => { if (busy) return; busy = true; SFX.card(); slots.forEach(s => s.flip.classList.add('discard')); await sleep(250); if (!(await ctx.onReroll())) busy = false; };
    slots.forEach((s, i) => {
      s.flip.addEventListener('click', async () => {
        if (busy || !s.flip.classList.contains('open') || s.flipping) return;
        let replace = null;
        if (s.d.kind === 'unit' && !me.arsenal.includes(s.id) && me.arsenal.length >= E.DECK_MAX) { replace = await pickReplace(me, s.id); if (!replace) return; }
        busy = true;
        slots.forEach(o => { if (o !== s) o.flip.classList.add('discard'); });
        const ok = await ctx.onPick(i, replace, s.front);
        if (!ok) { busy = false; slots.forEach(o => o.flip.classList.remove('discard')); }
        else box.classList.add('leaving');   // fade out with the picked card on its way to your deck, rather than vanishing
      });
    });
    const tok = box.dataset.tok = String(Math.random());
    (async () => {
      await sleep(180); if (box.dataset.tok !== tok) return; await dealIn(slots, 160);
      // commons and uncommons turn over in a quick cascade (the next starts while the last is still turning); rarer cards get the stage to themselves
      const flips = [];
      for (const s of slots) {
        if (box.dataset.tok !== tok || !document.contains(s.flip)) return;
        const f = flipCard(s, box); flips.push(f);
        if (RANK(s.d.rarity) <= 1) await sleep(230); else { await f; await sleep(120); }
      }
      await Promise.all(flips);
    })();
    pickKeys(box, slots, () => busy, col);
  }
  // closing fades out (a picked card is still flying to the deck); a new resupply opening meanwhile cancels the fade
  let supplyFade = null;
  function closeSupply() {
    const box = $('#supply'); supplyKey = '';
    if (box.hidden) return;
    if (!box.classList.contains('leaving')) box.classList.add('leaving');
    clearTimeout(supplyFade); supplyFade = setTimeout(() => { if (!supplyKey) box.hidden = true; }, 340);
  }
  // keys: 1–3 take that card once it's face up, C collects the full income
  function pickKeys(box, slots, busy, collect) {
    const key = e => {
      if (box.hidden || !document.contains(slots[0].flip)) { removeEventListener('keydown', key, true); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
      const n = +e.key;
      if (n >= 1 && n <= slots.length && !busy() && slots[n - 1].flip.classList.contains('open') && !slots[n - 1].flipping) { e.preventDefault(); e.stopPropagation(); slots[n - 1].flip.click(); }
      else if (collect && (e.key === 'c' || e.key === 'C') && !busy()) { e.preventDefault(); e.stopPropagation(); collect.click(); }
    };
    addEventListener('keydown', key, true);
  }

  // ───────────── the supply crate (from a Supply Drop card) ─────────────
  // ctx: { crate, me, onPick(idx, replace), onScrap() }
  let crateKey = '';
  async function openCrate(ctx) {
    const key = JSON.stringify(ctx.crate.cards) + ctx.crate.tier + ctx.serial;
    if (crateKey === key && !$('#crate').hidden) return;
    crateKey = key;
    const box = $('#crate'); box.innerHTML = ''; box.hidden = false; box.className = 'tier-' + ctx.crate.tier;
    Cards.fast = false;
    box.onclick = e => { if (e.target === box) Cards.fast = true; };
    const { crate, me } = ctx;
    const dropR = (E.TACTICS[ctx.crate.source] || { rarity: 'rare' }).rarity;
    const title = el('h2', 'cr-title', 'SUPPLY DROP'); title.style.setProperty('--dr', E.RARITY[dropR].color);
    box.appendChild(title);
    const T = crate.tier, glowCol = { standard: '#bfe6ff', gilded: '#ffd76a', mythic: '#e3a2ff' }[T] || '#fff';
    const fast = () => Cards.fast, wait = ms => sleep(fast() ? ms * 0.3 : ms);
    // 1. the reel: one smooth ease-out on the browser's own frame clock, then a short settle onto the winning crate
    const odds = E.DROP_TIERS[ctx.crate.source] || E.DROP_TIERS.drop_rare;
    const luckBar = el('div', 'luck', `<span style="color:${E.RARITY[dropR].color}">${E.RARITY[dropR].name.toUpperCase()} DROP</span><b>Standard ${odds.standard}% · <i style="color:#ffc53d;font-style:normal">Gilded ${odds.gilded}%</i> · <i style="color:#e0a0ff;font-style:normal">Mythic ${odds.mythic}%</i></b>`);
    box.appendChild(luckBar);
    const reel = el('div', 'sd-reel'), strip = el('div', 'sd-strip');
    const tiers = [], landAt = 38;
    for (let i = 0; i < 46; i++) { const r = Math.random() * 100; tiers.push(r < Math.max(10, odds.mythic) ? 'mythic' : r < Math.max(10, odds.mythic) + Math.max(25, odds.gilded) ? 'gilded' : 'standard'); }
    tiers[landAt] = T;
    for (const t of tiers) strip.appendChild(el('div', 'sd-cell sd-' + t, `<i></i><span>${t.toUpperCase()}</span>`));
    reel.append(strip, el('div', 'sd-mark'));
    box.appendChild(reel);
    await new Promise(r => requestAnimationFrame(r));
    const cell = strip.children[0].offsetWidth, mid = reel.clientWidth / 2;
    const exact = landAt * cell + cell / 2 - mid, overshoot = exact + (Math.random() - 0.5) * cell * 0.55;
    const dur = T === 'standard' ? 1700 : T === 'gilded' ? 2300 : 3000;
    let last = -1;
    const run = (from, to, ms, ease) => new Promise(res => {
      const t0 = performance.now();
      const step = now => {
        const p = Math.min(1, (now - t0) / (fast() ? ms * 0.2 : ms)), x = from + (to - from) * ease(p);
        strip.style.transform = `translate3d(${-x}px,0,0)`;
        const i = Math.floor((x + mid) / cell); if (i !== last) { last = i; SFX.chip(i % 10); }
        if (p < 1 && document.contains(strip)) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    await run(0, overshoot, dur, p => 1 - Math.pow(1 - p, 5));
    await run(overshoot, exact, 260, p => p * p * (3 - 2 * p));
    const won = strip.children[landAt]; won.classList.add('won');
    SFX.victoryHit(); Render.shake(T === 'mythic' ? 16 : T === 'gilded' ? 8 : 3);
    if (T !== 'standard') { const [x, y] = center(won); rays(x, y, TIER_COL[T], 1400, T === 'mythic'); burstAt(x, y, [TIER_COL[T], '#fff'], T === 'mythic' ? 70 : 30, 260); }
    await wait(520);
    // 2. the chest drops in as the reel clears away: no empty beat in between
    reel.classList.add('sd-out'); luckBar.classList.add('sd-out');
    setTimeout(() => { reel.remove(); luckBar.remove(); }, 350);
    const sun = el('div', 'sd-sun'); sun.style.setProperty('--tc', glowCol); box.appendChild(sun);
    const stage = el('div', 'sd-stage tier-' + T, `<div class="sd-glow"></div><div class="sd-shadow"></div>
      <div class="sd-chest"><img class="sd-body" src="${Art.chest(T, 'body')}" alt=""><div class="sd-leak"></div><img class="sd-lid" src="${Art.chest(T, 'lid')}" alt=""><div class="sd-count">${crate.cards.length}</div></div>
      <div class="sd-hint">CLICK TO OPEN</div>`);
    stage.style.setProperty('--tc', glowCol);
    box.appendChild(stage);
    const chestEl = stage.querySelector('.sd-chest'), countEl = stage.querySelector('.sd-count');
    SFX.whoosh();
    await wait(330);   // it hits the ground 55% of the way through its drop
    { const r = chestEl.getBoundingClientRect(); burstAt(r.left + r.width / 2, r.bottom - 6, ['#b8a68a', '#8c7b62', '#d9cbb2'], 22, 140, 8); }
    SFX.boom(0.5); SFX.deploy(); Render.shake(T === 'mythic' ? 12 : T === 'gilded' ? 9 : 6);
    await wait(300);
    stage.classList.add('ready');
    await new Promise(res => {
      let done = false;
      const go = () => { if (done) return; done = true; removeEventListener('keydown', key); stage.onclick = null; res(); };
      const key = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); go(); } };
      addEventListener('keydown', key); stage.onclick = go; box.addEventListener('click', go, { once: true }); setTimeout(go, fast() ? 40 : 1000);
    });
    // 3. one rising charge: the shake builds and light pours from the seam
    stage.classList.remove('ready'); stage.classList.add('charge');
    for (let i = 0; i < 3; i++) setTimeout(() => { SFX.chip(5 + i * 3); Render.shake(2 + i * 2); }, (fast() ? 30 : 200) * i);
    await wait(620);
    // 4. the lid blows off; the glow stays round the chest instead of whiting out the screen
    stage.classList.remove('charge'); stage.classList.add('open'); sun.classList.add('open');
    const seam = stage.querySelector('.sd-leak').getBoundingClientRect(), mx = seam.left + seam.width / 2, my = seam.top + seam.height / 2;
    SFX.boom(1); SFX.victoryHit(); Render.shake(T === 'mythic' ? 18 : 11);
    burstAt(mx, my, [glowCol, '#ffffff', glowCol], T === 'mythic' ? 70 : 44, 300, 9);
    await wait(200);
    // 5. the cards rise out of the chest one after another and fan into their places
    const row = el('div', 'cr-cards sd-row'); box.appendChild(row);
    const slots = crate.cards.map((id, i) => {
      const d = E.cardDef(id);
      const owned = d.kind === 'unit' && me.arsenal.includes(id);
      const lv = owned ? (me.levels[id] || 0) : 0;
      const tag = owned ? (lv >= E.MAX_LEVEL ? 'MAXED · +$' + (ctx.refund || 4) : 'UPGRADE ★' + (lv + 1)) : (d.kind === 'unit' && me.arsenal.length >= E.DECK_MAX ? 'DECK FULL · REPLACE' : d.kind === 'unit' ? 'NEW UNIT' : 'TACTIC');
      const flip = el('div', 'flip dealt r-' + d.rarity);
      flip.style.setProperty('--i', i);
      const back = el('div', 'cback tb-' + T, '<div class="cb-logo">⬢</div>');
      const front = make(id, { level: owned ? Math.min(E.MAX_LEVEL, lv + 1) : 0, tag }); front.classList.add('cfront');
      flip.append(back, front);
      row.appendChild(flip);
      return { flip, front, d, id };
    });
    const gap = fast() ? 40 : 140, fly = fast() ? 200 : 640;
    slots.forEach((s, i) => {
      const r = s.flip.getBoundingClientRect(), dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2);
      s.flip.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(.2) rotateY(180deg)`, opacity: 0 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 150}px) scale(.8) rotateY(180deg) rotate(${(i - (slots.length - 1) / 2) * -7}deg)`, opacity: 1, offset: 0.5 },
        { transform: 'rotateY(180deg)', opacity: 1 },
      ], { duration: fly, delay: i * gap, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'backwards' });
      setTimeout(() => { countEl.textContent = String(slots.length - 1 - i); countEl.classList.remove('pop'); void countEl.offsetWidth; countEl.classList.add('pop'); SFX.card(); SFX.chip(8 + i * 2); }, i * gap);
    });
    await sleep((slots.length - 1) * gap + fly * 0.7);
    // 6. the empty chest sinks away behind the cards before the reveal starts
    stage.classList.add('gone'); sun.classList.add('fade');
    setTimeout(() => { stage.remove(); sun.remove(); }, 450);
    await wait(320);
    if (!document.contains(row)) return;
    await revealRow(box, slots, 350);
    // 4. choose
    const bar = el('div', 'cr-actions');
    const scrap = el('button', 'btn big', 'SCRAP <small>+$' + (ctx.scrap || E.SCRAP_VALUE) + '</small>');
    bar.appendChild(scrap); box.appendChild(bar);
    box.appendChild(el('div', 'cr-sub', 'Pick one card to keep'));
    let busy = false;
    scrap.onclick = async () => { if (busy) return; busy = true; SFX.coin(2); box.classList.add('leaving'); slots.forEach(s => s.flip.classList.add('discard')); await ctx.onScrap(); };
    pickKeys(box, slots, () => busy, null);
    slots.forEach((s, i) => {
      s.flip.onclick = async () => {
        if (busy) return;
        let replace = null;
        if (s.d.kind === 'unit' && !me.arsenal.includes(s.id) && me.arsenal.length >= E.DECK_MAX) {
          replace = await pickReplace(me, s.id);
          if (!replace) return;
        }
        busy = true;
        slots.forEach(o => { if (o !== s) o.flip.classList.add('discard'); });
        const ok = await ctx.onPick(i, replace, s.front);
        if (!ok) { busy = false; slots.forEach(o => o.flip.classList.remove('discard')); }
      };
    });
  }
  function closeCrate() { $('#crate').hidden = true; crateKey = ''; }

  // ───────────── deck full: choose a card to replace ─────────────
  function pickReplace(me, incoming) {
    return new Promise(res => {
      const m = $('#modal'); m.innerHTML = ''; m.hidden = false;
      const p = el('div', 'panel replace-card');
      p.innerHTML = `<h3>DECK FULL — REPLACE A CARD WITH <span style="color:${E.RARITY[E.UNITS[incoming].rarity].color}">${E.UNITS[incoming].name.toUpperCase()}</span>?</h3><div class="sub">Units already on the board stay. You just can't deploy more of the replaced card.</div>`;
      const grid = el('div', 'rep-grid');
      for (const id of me.arsenal) {
        const c = make(id, { mini: true, level: me.levels[id] || 0 });
        c.onclick = () => { SFX.select(); m.hidden = true; res(id); };
        grid.appendChild(c);
      }
      p.appendChild(grid);
      const cancel = el('button', 'btn big', 'KEEP MY DECK'); cancel.onclick = () => { m.hidden = true; res(null); };
      const row = el('div', 'row'); row.style.justifyContent = 'center'; row.appendChild(cancel); p.appendChild(row);
      m.appendChild(p);
    });
  }

  // ───────────── opening draft ─────────────
  let draftKey = '';
  function showDraft(S, you, onPick) {
    const box = $('#draft');
    const d = S.draft, me = S.players.find(p => p.id === you);
    if (!d || !me) { box.hidden = true; draftKey = ''; return; }
    const picked = !!d.picked[you];
    const round = Math.min(d.rounds, (d.step[you] || 0) + 1);
    const progress = S.players.map(p => d.picked[p.id] ? 'x' : (d.step[p.id] || 0)).join(',');
    const key = round + ':' + picked + ':' + (picked ? progress : '');
    if (key === draftKey && !box.hidden) {
      // others progressing while I pick: just refresh the status chips
      const w = box.querySelector('.dr-who'); if (w) w.outerHTML = whoHtml(S, d);
      return;
    }
    const fresh = draftKey === '';
    draftKey = key;
    box.hidden = false; box.innerHTML = '';
    box.appendChild(el('div', 'sd-rays'));
    box.appendChild(el('h2', '', 'OPENING DRAFT'));
    box.appendChild(el('div', 'dr-round', [1, 2, 3].map(i => `<i class="${picked || i < round ? 'done' : i === round ? 'now' : ''}"></i>`).join('') + `<span>${picked ? 'ALL PICKS IN' : 'PICK ' + round + ' / ' + d.rounds}</span>`));
    const who = el('div', '', whoHtml(S, d)).firstChild;
    if (picked) {
      const left = S.players.filter(p => p.alive && !d.picked[p.id]).length;
      box.appendChild(el('div', 'sub', `Locked in. Waiting for ${left} commander${left === 1 ? '' : 's'} to finish drafting…`));
      box.appendChild(who);
      const deck = el('div', 'dr-deck'); me.arsenal.forEach(id => deck.appendChild(make(id, { mini: true, level: me.levels[id] || 0 })));
      box.appendChild(deck);
      return;
    }
    box.appendChild(el('div', 'sub', 'Choose 1 of 3. Go at your own pace — the war starts when everyone has made all 3 picks.'));
    const row = el('div', 'cr-cards');
    const offer = d.offers[you] || [];
    offer.forEach((id, i) => {
      const dd = E.cardDef(id);
      const owned = dd.kind === 'unit' && me.arsenal.includes(id);
      const flip = el('div', 'flip r-' + dd.rarity); flip.style.setProperty('--i', i);
      const back = el('div', 'cback tb-gilded', '<div class="cb-logo">⬢</div>');
      const front = make(id, { tag: owned ? 'UPGRADE ★' + ((me.levels[id] || 0) + 1) : dd.kind === 'unit' ? 'NEW UNIT' : 'TACTIC' }); front.classList.add('cfront');
      flip.append(back, front); row.appendChild(flip);
      flip.onclick = async () => {
        if (!flip.classList.contains('open')) return;
        let replace = null;
        if (dd.kind === 'unit' && !owned && me.arsenal.length >= E.DECK_MAX) { replace = await pickReplace(me, id); if (!replace) return; }
        row.querySelectorAll('.flip').forEach(f => { if (f !== flip) f.classList.add('discard'); });
        flip.classList.add('chosen'); SFX.select();
        await onPick(i, replace);
      };
    });
    box.appendChild(row);
    box.appendChild(who);
    const dslots = [...row.children].map((f, i) => ({ flip: f, front: f.querySelector('.cfront'), d: E.cardDef(offer[i]) }));
    const tok = box.dataset.tok = String(Math.random());
    (async () => { await sleep(fresh ? 450 : 150); if (box.dataset.tok !== tok) return; await dealIn(dslots); if (box.dataset.tok !== tok) return; await revealRow(box, dslots); })();
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function whoHtml(S, d) {
    return '<div class="dr-who">' + S.players.map(p => { const n = d.picked[p.id] ? d.rounds : (d.step[p.id] || 0); return `<span class="${d.picked[p.id] ? 'ok' : ''}" style="--pc:${p.color}">${d.picked[p.id] ? '✓' : n + '/' + d.rounds} ${esc(p.name)}</span>`; }).join('') + '</div>';
  }
  function hideDraft() { $('#draft').hidden = true; draftKey = ''; }

  // ───────────── card index ─────────────
  function showIndex() {
    const m = $('#index'); m.innerHTML = ''; m.hidden = false;
    const p = el('div', 'panel index-card');
    p.innerHTML = `<div class="ix-head"><h2>CARD INDEX</h2><button class="icon-btn" id="ixClose">✕</button></div>`;
    const tabs = el('div', 'ix-tabs');
    const filters = el('div', 'ix-filters');
    const grid = el('div', 'ix-grid');
    let tab = 'unit', rar = 'all';
    const draw = () => {
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
      filters.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.r === rar));
      filters.hidden = tab === 'struct' || tab === 'faction';
      grid.innerHTML = ''; grid.className = 'ix-grid ix-' + tab;
      if (tab === 'unit' || tab === 'tactic') {
        const src = tab === 'unit' ? E.UNITS : E.TACTICS;
        Object.keys(src).filter(id => rar === 'all' || src[id].rarity === rar).sort((a, b) => RANK(src[a].rarity) - RANK(src[b].rarity) || src[a].cost - src[b].cost)
          .forEach((id, i) => { const c = make(id, { variant: null }); c.style.animationDelay = (i * 0.025) + 's'; c.classList.add('ix-in'); grid.appendChild(c); });
        // an empty filter points you at the tab that has those cards (Mythics are all tactics)
        if (!grid.children.length) {
          const other = tab === 'unit' ? 'tactic' : 'unit', osrc = other === 'unit' ? E.UNITS : E.TACTICS;
          const n = Object.keys(osrc).filter(id => osrc[id].rarity === rar).length;
          const hint = el('div', 'ix-empty', `No ${E.RARITY[rar].name} ${tab === 'unit' ? 'units' : 'tactics'}.` + (n ? ` <button class="btn">SHOW ${n} ${E.RARITY[rar].name.toUpperCase()} ${other === 'unit' ? 'UNITS' : 'TACTICS'}</button>` : ''));
          const go = hint.querySelector('button'); if (go) go.onclick = () => { tab = other; SFX.click(); draw(); };
          grid.appendChild(hint);
        }
      } else if (tab === 'struct') {
        for (const id of E.BUILD_ORDER) { const s = E.STRUCTS[id]; grid.appendChild(el('div', 'ix-struct', `<img src="${Art.iconURL('struct', id, '#fff', 96)}"><div><b>${s.name}</b><span class="gold">$${s.cost}</span><p>${s.desc}</p></div>`)); }
      } else {
        for (const id in E.FACTIONS) { const f = E.FACTIONS[id]; grid.appendChild(el('div', 'ix-struct', `<img src="${Art.iconURL('glyph', f.glyph, '#fff', 96)}"><div><b>${f.name}</b><span class="gold">${f.perk}</span><p>${f.desc}<br>Starts with <b>${E.UNITS[f.starter].name}</b>, Grunts and an Ark.</p></div>`)); }
      }
    };
    for (const [t, label] of [['unit', 'UNITS'], ['tactic', 'TACTICS'], ['struct', 'STRUCTURES'], ['faction', 'FACTIONS']]) {
      const b = el('button', 'btn', label); b.dataset.t = t; b.onclick = () => { tab = t; SFX.click(); draw(); }; tabs.appendChild(b);
    }
    for (const r of ['all', ...E.RARITY_ORDER]) {
      const b = el('button', 'chip r-' + r, r === 'all' ? 'ALL' : E.RARITY[r].name.toUpperCase()); b.dataset.r = r; b.onclick = () => { rar = r; SFX.click(); draw(); }; filters.appendChild(b);
    }
    const odds = el('div', 'ix-odds', Object.entries(E.CRATES).map(([k, c]) => `<div><b style="color:${TIER_COL[k]}">${c.name}</b>${E.RARITY_ORDER.map(r => `<span style="color:${E.RARITY[r].color}">${c.odds[r]}%</span>`).join(' · ')}</div>`).join(''));
    p.append(tabs, filters, odds, grid); m.appendChild(p);
    $('#ixClose').onclick = () => { m.hidden = true; SFX.click(); };
    m.onclick = e => { if (e.target === m) m.hidden = true; };
    draw();
  }

  // ───────────── hover to enlarge ─────────────
  // any card in the deck bar, hand, draft deck or replace picker shows a big copy above it
  const ZOOM_IN = '#hbUnits, #hand, .dr-deck, .rep-grid';
  let zoomT = null, zoomFor = null;
  function zoomShow(card) {
    const id = card.dataset.id; if (!id) return;
    let z = $('#cardZoom'); if (!z) { z = el('div', ''); z.id = 'cardZoom'; document.body.appendChild(z); }
    const lvl = (card.querySelector('.c-stars') || {}).textContent;
    z.innerHTML = ''; const big = make(id, { level: lvl ? lvl.length : 0 }); big.classList.add('zoomed'); z.appendChild(big);
    const r = card.getBoundingClientRect(), W = 236, H = 336;
    let x = r.left + r.width / 2 - W / 2, y = r.top - H - 18;
    if (y < 8) y = Math.min(innerHeight - H - 8, r.bottom + 14);
    x = Math.max(8, Math.min(innerWidth - W - 8, x));
    z.style.left = x + 'px'; z.style.top = y + 'px'; z.hidden = false;
    z.classList.remove('in'); void z.offsetWidth; z.classList.add('in');
  }
  function zoomHide() { clearTimeout(zoomT); zoomFor = null; const z = $('#cardZoom'); if (z) z.hidden = true; }
  document.addEventListener('mouseover', e => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card || !card.closest(ZOOM_IN) || card.closest('#cardZoom')) { if (zoomFor && (!card || card !== zoomFor)) zoomHide(); return; }
    if (card === zoomFor) return;
    zoomHide(); zoomFor = card;
    zoomT = setTimeout(() => { if (zoomFor === card && document.contains(card)) zoomShow(card); }, 220);
  });
  document.addEventListener('mousedown', zoomHide, true);
  // watchdog: the zoom closes as soon as its card isn't hovered (menus opening under the cursor, hand re-renders)
  setInterval(() => { if (zoomFor && (!document.contains(zoomFor) || !zoomFor.matches(':hover'))) zoomHide(); }, 200);

  // dev/test helper: reveal a hand of specific cards (no game effect)
  function demoReveal(ids) {
    const box = $('#supply'); box.innerHTML = ''; box.hidden = false; box.className = '';
    box.appendChild(el('h2', '', 'REVEAL TEST'));
    const row = el('div', 'cr-cards');
    const slots = ids.map((id, i) => { const d = E.cardDef(id); const flip = el('div', 'flip r-' + d.rarity); flip.style.setProperty('--i', i); const front = make(id); front.classList.add('cfront'); flip.append(el('div', 'cback', '<div class="cb-logo">⬢</div>'), front); row.appendChild(flip); return { flip, front, d, id }; });
    box.appendChild(row);
    (async () => { await sleep(300); await dealIn(slots); await revealRow(box, slots); })();
    return slots;
  }
  return { zoomHide, demoReveal, flipCard: (s) => flipCard(s, $('#supply')), make, openSupply, closeSupply, openCrate, closeCrate, showDraft, hideDraft, pickReplace, showIndex, burstAt, rays, revealFx, fast: false };
})();
