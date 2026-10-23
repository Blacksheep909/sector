/* SECTOR — crates: the art, their idle life in the Store, and the opening sequence.
   Field Crate: an olive military supply case. Elite Crate: a black armoured case with gold trim and violet light leaking
   from its seams. Both are drawn as SVG, so they stay crisp at any size. */
const Crates = (() => {
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const RCOL = { uncommon: '#3fd07a', rare: '#3fa0ff', epic: '#c25cff', legendary: '#ffb52e', mythic: '#f4fbff' };
  const ORDER = ['uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  let uid = 0;

  // ── the art ──
  // the box is seen from slightly above and to the left: a front face, a right side, and a lid on top (its own group, so it can fly off)
  function svg(kind, opts = {}) {
    const p = 'c' + (uid++), elite = kind === 'elite';
    const seam = opts.seam || (elite ? '#b06cff' : '#ffb347');
    // palette
    const F = elite ? ['#2f333c', '#15171c'] : ['#66763f', '#3a4524'];   // front face
    const S = elite ? ['#1d2026', '#0b0c0f'] : ['#47532b', '#2a3218'];   // side
    const T = elite ? ['#3b404b', '#23262d'] : ['#7a8a4c', '#56643a'];   // lid top
    const trim = elite ? '#e9b949' : '#9aa3ab', trimD = elite ? '#8a6418' : '#4b5157', rivet = elite ? '#ffe9a8' : '#d6dde2';
    const corners = [[30, 100], [190, 100], [30, 190], [190, 190]];
    const guard = ([x, y]) => {
      const dx = x < 100 ? 1 : -1, dy = y < 150 ? 1 : -1, L = 22, w = 7;
      return `<path d="M${x} ${y}h${dx * L}v${dy * w}h${-dx * (L - w)}v${dy * (L - w)}h${-dx * w}z" fill="url(#${p}st)" stroke="${trimD}" stroke-width="1"/>
        <circle cx="${x + dx * 4}" cy="${y + dy * 4}" r="1.8" fill="${rivet}"/><circle cx="${x + dx * 15}" cy="${y + dy * 3.5}" r="1.5" fill="${rivet}"/><circle cx="${x + dx * 3.5}" cy="${y + dy * 15}" r="1.5" fill="${rivet}"/>`;
    };
    const latch = x => `<g class="cr-latch" style="transform-origin:${x}px 104px">
        <rect x="${x - 9}" y="96" width="18" height="10" rx="2" fill="url(#${p}st)" stroke="${trimD}"/><rect x="${x - 5}" y="102" width="10" height="16" rx="2" fill="url(#${p}st)" stroke="${trimD}"/>
        <circle cx="${x}" cy="113" r="2.2" fill="${elite ? '#2a1a4a' : '#2a2e33'}"/></g>`;
    const planks = elite ? '' : [118, 136, 154, 172].map(y => `<path d="M31 ${y}h158" stroke="rgba(0,0,0,.28)" stroke-width="1.4"/><path d="M31 ${y + 1.4}h158" stroke="rgba(255,255,255,.06)" stroke-width="1"/>`).join('')
      + [118, 136, 154, 172].map((y, i) => `<path d="M${60 + i * 31} ${y - 17}v17" stroke="rgba(0,0,0,.18)" stroke-width="1"/>`).join('');
    const sidePlanks = elite ? '' : [118, 136, 154, 172].map(y => `<path d="M191 ${y}l28 -17" stroke="rgba(0,0,0,.3)" stroke-width="1.2"/>`).join('');
    const face = elite
      ? `<rect x="30" y="100" width="160" height="90" fill="url(#${p}hex)" opacity=".55"/>
         <g class="cr-emblem"><path d="M110 118l18 10v20l-18 10-18-10v-20z" fill="#140f22" stroke="${trim}" stroke-width="2.5"/><path d="M110 125l3.3 7.4 8 .7-6 5.3 1.8 7.9-7.1-4.2-7.1 4.2 1.8-7.9-6-5.3 8-.7z" fill="${seam}" class="cr-glow"/></g>
         <rect class="cr-strip" x="40" y="168" width="140" height="3" rx="1.5" fill="${seam}"/>
         <text x="110" y="183" text-anchor="middle" font-family="'Black Ops One',sans-serif" font-size="8.5" letter-spacing="2" fill="${trim}">ELITE · CLASSIFIED</text>`
      : `<g opacity=".82"><path d="M110 126l3.6 8 8.7.8-6.6 5.8 2 8.6-7.7-4.6-7.7 4.6 2-8.6-6.6-5.8 8.7-.8z" fill="none" stroke="#e8e0c4" stroke-width="2" stroke-dasharray="3 1.4"/></g>
         <text x="110" y="166" text-anchor="middle" font-family="'Black Ops One',sans-serif" font-size="13" letter-spacing="2" fill="#e8e0c4" opacity=".8">FIELD SUPPLY</text>
         <text x="110" y="180" text-anchor="middle" font-family="monospace" font-size="7" letter-spacing="1" fill="#e8e0c4" opacity=".55">NSN 8140-01-SECTOR · 1 EA</text>`;
    const sideDetail = elite
      ? [120, 134, 148].map((y, i) => `<path class="cr-vent" style="animation-delay:${i * 0.25}s" d="M197 ${y + 2}l18 -11" stroke="${seam}" stroke-width="3" stroke-linecap="round"/>`).join('')
      : `<path d="M199 140c4 10 12 10 16 -5" fill="none" stroke="#c9b27a" stroke-width="3" stroke-linecap="round"/><path d="M199 140c4 10 12 10 16 -5" fill="none" stroke="#8a7448" stroke-width="1.2" stroke-dasharray="2 2"/>`;
    const lidTop = elite
      ? `<path d="M30 100L60 82h160l-30 18z" fill="url(#${p}t)" stroke="${trim}" stroke-width="2"/>
         <path d="M84 91l26 0 6 -4M136 91l-6 -4" stroke="${trim}" stroke-width="2" fill="none" opacity=".7"/><path d="M96 96l20 -12M118 96l20 -12M140 96l20 -12" stroke="rgba(233,185,73,.35)" stroke-width="3"/>`
      : `<path d="M30 100L60 82h160l-30 18z" fill="url(#${p}t)" stroke="#26301a" stroke-width="1.5"/>
         <path d="M70 100l30 -18M110 100l30 -18M150 100l30 -18" stroke="rgba(0,0,0,.25)" stroke-width="1.3"/><path d="M48 91h158" stroke="url(#${p}st)" stroke-width="5"/>`;
    return `<svg class="crate-svg" viewBox="0 0 240 220" xmlns="http://www.w3.org/2000/svg" style="--seam:${seam}">
      <defs>
        <linearGradient id="${p}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${F[0]}"/><stop offset="1" stop-color="${F[1]}"/></linearGradient>
        <linearGradient id="${p}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${S[0]}"/><stop offset="1" stop-color="${S[1]}"/></linearGradient>
        <linearGradient id="${p}t" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${T[0]}"/><stop offset="1" stop-color="${T[1]}"/></linearGradient>
        <linearGradient id="${p}st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${elite ? '#ffe9a8' : '#e2e8ec'}"/><stop offset=".5" stop-color="${trim}"/><stop offset="1" stop-color="${trimD}"/></linearGradient>
        <linearGradient id="${p}sw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${elite ? '.28' : '.2'}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <pattern id="${p}hex" width="10" height="17.3" patternUnits="userSpaceOnUse"><path d="M5 0l5 2.9v5.8L5 11.5 0 8.7V2.9zM0 14.4l5 2.9M10 14.4l-5 2.9" fill="none" stroke="#454b57" stroke-width=".8"/></pattern>
        <clipPath id="${p}clip"><path d="M30 100L60 82h160v90l-30 18H30z"/></clipPath>
        <filter id="${p}blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <ellipse class="cr-shadow" cx="120" cy="200" rx="98" ry="12" fill="rgba(0,0,0,.55)"/>
      <g class="cr-body">
        <path d="M190 100l30 -18v90l-30 18z" fill="url(#${p}s)" stroke="${elite ? trim : '#1d2412'}" stroke-width="${elite ? 1.5 : 1}"/>${sidePlanks}${sideDetail}
        <rect x="30" y="100" width="160" height="90" fill="url(#${p}f)" stroke="${elite ? trim : '#1d2412'}" stroke-width="${elite ? 2 : 1.2}"/>${planks}${face}
        ${corners.map(guard).join('')}
        <path d="M190 100l30 -18" stroke="${elite ? trim : '#1d2412'}" stroke-width="1.5"/>
      </g>
      <g class="cr-seam"><path d="M30 100h160l30 -18" fill="none" stroke="var(--seam)" stroke-width="5" filter="url(#${p}blur)"/><path d="M30 100h160l30 -18" fill="none" stroke="var(--seam)" stroke-width="1.6"/></g>
      <g class="cr-lid">
        ${lidTop}
        <path d="M27 99h166v8H27z" fill="url(#${p}f)" stroke="${elite ? trim : '#1d2412'}" stroke-width="1.2"/><path d="M193 99l30 -18v8l-30 18z" fill="url(#${p}s)" stroke="${elite ? trim : '#1d2412'}" stroke-width="1"/>
        ${latch(70)}${latch(150)}
      </g>
      <g clip-path="url(#${p}clip)" class="cr-sweep"><rect x="-120" y="70" width="90" height="140" fill="url(#${p}sw)" transform="skewX(-20)"><animate attributeName="x" values="-160;320;320" keyTimes="0;.45;1" dur="${elite ? 3.2 : 4.5}s" repeatCount="indefinite"/></rect></g>
    </svg>`;
  }

  // ── a crate on the Store shelf: hovering, breathing light, motes, and it leans toward the pointer ──
  function shelf(kind, B, priceHtml, canAfford, onOpen) {
    const t = el('div', 'crate-tile k-' + kind);
    const odds = Object.entries(B.odds).map(([r, w]) => `<div class="co-row"><i style="background:${RCOL[r]}"></i><span>${r[0].toUpperCase() + r.slice(1)}</span><b>${w}%</b></div>`).join('');
    t.innerHTML = `<div class="ct-stage"><div class="ct-rays"></div><div class="ct-motes">${Array.from({ length: kind === 'elite' ? 14 : 8 }, (_, i) => `<span style="--x:${(i * 37) % 100}%;--d:${(i % 5) * 0.7}s;--s:${0.6 + (i % 3) * 0.3}"></span>`).join('')}</div><div class="ct-crate">${svg(kind)}</div></div>
      <div class="ct-info"><div class="ct-tag">${kind === 'elite' ? '★ PREMIUM' : 'STANDARD ISSUE'}</div><h3>${esc(B.name)}</h3><div class="ct-desc">${esc(B.desc)}</div><div class="ct-odds">${odds}</div></div>`;
    const btn = el('button', 'btn big ct-buy', 'OPEN · ' + priceHtml); btn.disabled = !canAfford;
    btn.onclick = e => { e.stopPropagation(); onOpen(btn); };
    t.appendChild(btn);
    // lean toward the pointer
    const stage = t.querySelector('.ct-stage');
    t.onmousemove = e => { const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; t.style.setProperty('--ry', (x * 18).toFixed(1) + 'deg'); t.style.setProperty('--rx', (-y * 12).toFixed(1) + 'deg'); };
    t.onmouseleave = () => { t.style.setProperty('--ry', '0deg'); t.style.setProperty('--rx', '0deg'); };
    t.onmouseenter = () => { if (typeof SFX !== 'undefined') SFX.hover && SFX.hover(); };
    return t;
  }

  // ── particles for the opening ──
  function fxCanvas(host) {
    const cv = el('canvas', 'co-fx'); host.appendChild(cv);
    const c = cv.getContext('2d'), parts = [], rings = [];
    let w = 0, h = 0, alive = true;
    const size = () => { w = cv.width = innerWidth * (devicePixelRatio || 1); h = cv.height = innerHeight * (devicePixelRatio || 1); cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; };
    size();
    let last = performance.now();
    const loop = now => {
      if (!alive) return; const dt = Math.min(0.05, (now - last) / 1000); last = now;
      c.clearRect(0, 0, w, h); c.globalCompositeOperation = 'lighter';
      const k = devicePixelRatio || 1;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt; if (p.t > p.life) { parts.splice(i, 1); continue; }
        p.vx *= Math.pow(p.drag, dt); p.vy = p.vy * Math.pow(p.drag, dt) + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const a = 1 - p.t / p.life, r = p.r * (p.grow ? 1 + p.t * 2 : a * 0.7 + 0.3);
        const g = c.createRadialGradient(p.x * k, p.y * k, 0, p.x * k, p.y * k, r * k * 2.2);
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.3, p.col + Math.round(a * 200).toString(16).padStart(2, '0')); g.addColorStop(1, p.col + '00');
        c.fillStyle = g; c.beginPath(); c.arc(p.x * k, p.y * k, r * k * 2.2, 0, Math.PI * 2); c.fill();
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.t += dt; if (r.t > r.life) { rings.splice(i, 1); continue; }
        const a = 1 - r.t / r.life; c.strokeStyle = r.col; c.globalAlpha = a; c.lineWidth = (8 * a + 1) * k;
        c.beginPath(); c.arc(r.x * k, r.y * k, (r.r0 + (r.r1 - r.r0) * (1 - Math.pow(a, 2))) * k, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return {
      burst(x, y, col, n, spd = 520, opts = {}) { for (let i = 0; i < n; i++) { const a = opts.up ? -Math.PI / 2 + (Math.random() - 0.5) * (opts.spread || 1.2) : Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random() * 0.8); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: opts.g ?? 520, drag: 0.35, r: 2 + Math.random() * 3.5, life: 0.7 + Math.random() * 0.9, t: 0, col }); } },
      motes(x, y, col, n) { for (let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * 180, y: y + Math.random() * 30, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 90, g: 0, drag: 0.9, r: 1.5 + Math.random() * 2.5, life: 1.4 + Math.random() * 1.6, t: 0, col }); },
      ring(x, y, col, r1 = 420, life = 0.9) { rings.push({ x, y, col, r0: 20, r1, life, t: 0 }); },
      stop() { alive = false; cv.remove(); },
    };
  }

  // ── opening: fly in, rattle (the seams warm up through the rarities), latches, lid off, light, the card ──
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function open(m, it, card, opts) {
    let v = $('#crateOpen'); if (v) v.remove();
    v = el('div', 'k-' + m.box, ''); v.id = 'crateOpen'; document.body.appendChild(v);
    const R = m.rarity || it.rarity, col = RCOL[R] || '#fff', tier = ORDER.indexOf(R);
    v.style.setProperty('--rc', col);
    v.innerHTML = `<div class="co-vignette"></div><div class="co-stage"><div class="co-beam"></div><div class="co-crate">${svg(m.box)}</div><div class="co-flipper"><div class="co-back"><div class="cb-logo">SECTOR</div></div><div class="co-front"></div></div></div>
      <div class="co-label"></div><div class="co-btns"></div><div class="co-skip">click to skip</div>`;
    const fx = fxCanvas(v), crate = v.querySelector('.co-crate'), csvg = crate.querySelector('svg'), flip = v.querySelector('.co-flipper');
    v.querySelector('.co-front').appendChild(card);
    let skip = false; v.onclick = () => { skip = true; };
    const W = ms => skip ? Promise.resolve() : wait(ms);
    const center = () => { const r = crate.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.42]; };
    const S = typeof SFX !== 'undefined' ? SFX : {};
    S.whoosh && S.whoosh();
    await W(650);
    // the rattle: one shake per rarity step, the seam glow climbing through the colours
    for (let i = 0; i <= Math.max(1, tier); i++) {
      const c2 = RCOL[ORDER[Math.min(i, tier)]];
      csvg.style.setProperty('--seam', c2); crate.style.setProperty('--glow', c2);
      crate.classList.remove('rattle'); void crate.offsetWidth; crate.classList.add('rattle'); crate.style.setProperty('--amp', (3 + i * 2.5) + 'px');
      S.clank ? S.clank() : S.click && S.click(); S.chip && S.chip(3 + i * 2);
      const [x, y] = center(); fx.motes(x, y, c2, 6 + i * 4);
      await W(560 - i * 40);
    }
    // latches spring open
    for (const l of crate.querySelectorAll('.cr-latch')) { l.classList.add('pop'); S.click && S.click(); await W(140); }
    await W(220);
    // the lid blows off
    crate.classList.add('opened'); v.classList.add('lit');
    S.boom && S.boom(0.5 + tier * 0.2); tier >= 3 ? S.legendary && S.legendary() : S.rare && S.rare();
    { const [x, y] = center(); fx.burst(x, y, col, 50 + tier * 30, 560 + tier * 80, { up: true, spread: 2.2 }); fx.ring(x, y, col, 380 + tier * 80); if (tier >= 3) { fx.ring(x, y, '#ffffff', 600, 1.2); v.classList.add('flash'); } fx.motes(x, y, col, 30); }
    await W(380);
    // the card rises out of the light and turns over
    flip.classList.add('rise'); S.whoosh && S.whoosh();
    await W(700);
    flip.classList.add('turn'); S.card && S.card();
    await W(450);
    { const r = flip.getBoundingClientRect(); fx.burst(r.left + r.width / 2, r.top + r.height / 2, col, 40 + tier * 20, 420, { g: 120 }); }
    skip = true;
    const lab = v.querySelector('.co-label');
    lab.innerHTML = `<div class="co-rar">${R.toUpperCase()}</div><div class="co-name">${esc(it.name)}</div>${m.dup ? `<div class="co-sub">Already in your Locker · <i class="vm"></i>${m.refund} back</div>` : '<div class="co-sub new">✦ NEW · added to your Locker</div>'}`;
    lab.classList.add('in');
    const btns = v.querySelector('.co-btns'); v.querySelector('.co-skip').remove();
    if (opts.again) { const b = el('button', 'btn big gold', 'OPEN ANOTHER · ' + opts.againLabel); b.onclick = e => { e.stopPropagation(); fx.stop(); v.remove(); opts.again(); }; btns.appendChild(b); }
    const d = el('button', 'btn big', 'DONE'); d.onclick = e => { e.stopPropagation(); fx.stop(); v.remove(); opts.done && opts.done(); }; btns.appendChild(d);
    v.onclick = null;
  }
  return { svg, shelf, open, RCOL };
})();
