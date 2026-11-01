/* SECTOR — crates: the art, their idle life in the Store, and the opening sequence.
   Field Pack / Elite Pack: foil card packs torn open along the top (the old crate art below is kept for anything that still wants it).
   Earlier: Field Crate, an olive military supply case; Elite Crate, a black armoured case with gold trim and violet light leaking
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

  // ── card packs: a printed foil pack, torn open along the top by hand ──
  // kinds: the supply drop's tiers (standard, gilded, mythic) and the Store's packs (field, elite). Each shows a fan of real
  // cards bursting out of its art, so it reads as a pack full of cards, not an empty wrapper
  const PACK = {
    standard: { foil: ['#dfe9f2', '#8aa1b6', '#2e4054'], ink: '#0f1a24', glow: '#9fd0ff', name: 'STANDARD', sub: 'SUPPLY DROP', fan: ['lancer', 'grunt', 'mauler'] },
    gilded: { foil: ['#fff4c4', '#e6ad22', '#6e4d08'], ink: '#2e1e02', glow: '#ffd36b', name: 'GILDED', sub: 'SUPPLY DROP', fan: ['banshee', 'titan', 'valkyrie'], promise: '★ RARE OR BETTER INSIDE' },
    mythic: { foil: ['#f7e2ff', '#9a6bff', '#22408f'], ink: '#160a2e', glow: '#d59bff', name: 'MYTHIC', sub: 'SUPPLY DROP', fan: ['sentinel', 'leviathan', 'goliath'], holo: true, promise: '✦ EPIC OR BETTER INSIDE' },
    field: { foil: ['#e3e6a8', '#7f8c45', '#33401f'], ink: '#1a2110', glow: '#d8f07a', name: 'FIELD PACK', sub: 'CARD SKINS', fan: ['thumper', 'skitter', 'bulwark'] },
    elite: { foil: ['#f6d885', '#2a2d35', '#0b0c10'], ink: '#f6d885', glow: '#ffcf5a', name: 'ELITE PACK', sub: 'CARD SKINS', fan: ['grumble', 'phantom', 'wraith'], holo: true, promise: '★ PREMIUM SKINS' },
  };
  const PW = 210, SL = 42;   // pack width in px, and how many slivers the top strip tears into
  const zig = (n, y0, y1) => Array.from({ length: n * 2 + 1 }, (_, i) => `${(i / (n * 2) * 100).toFixed(2)}% ${i % 2 ? y1 : y0}`).join(',');
  // a ragged torn edge, different on every pack
  const rag = () => { const pts = []; for (let i = 0; i <= 60; i++) pts.push(`${(i / 60 * 100).toFixed(2)}% ${(2 + Math.random() * 6).toFixed(1)}px`); return `polygon(0 100%,${pts.join(',')},100% 100%)`; };
  function fanCard(id, i) {
    let src = ''; try { src = typeof Art !== 'undefined' && Art.cardArt ? Art.cardArt(id) : ''; } catch (e) {}
    return `<div class="pk-card" style="--i:${i}">${src ? `<img src="${src}" alt="">` : ''}<b></b></div>`;
  }
  // the key art: one unit, filling the face of the pack the way a booster's illustration does
  function heroArt(id) { let src = ''; try { src = id && typeof Art !== 'undefined' && Art.cardArt ? Art.cardArt(id) : ''; } catch (e) {} return src ? `<img src="${src}" alt="">` : ''; }
  // creases: where the bulge of cards meets the flat crimped seals, the foil wrinkles in a fan from each corner
  const CREASES = `<svg viewBox="0 0 210 276" preserveAspectRatio="none">${[[14, 26, -1, -1], [196, 26, 1, -1], [14, 252, -1, 1], [196, 252, 1, 1]].map(([x, y, sx, sy]) =>
    [0, 1, 2, 3].map(k => { const ex = x + sx * (4 + k * 9), ey = y + sy * (22 - k * 4); return `<path d="M${x} ${y} L${ex} ${ey}" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/><path d="M${x + sx} ${y} L${ex + sx} ${ey}" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/>`; }).join('') +
    [0, 1, 2].map(k => { const ex = x - sx * (8 + k * 14), ey = y + sy * (24 - k * 3); return `<path d="M${x} ${y} L${ex} ${ey}" stroke="rgba(255,255,255,.35)" stroke-width="1"/><path d="M${x} ${y + sy} L${ex} ${ey + sy}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`; }).join('')).join('')}</svg>`;
  function pack(kind, opts = {}) {
    const P = PACK[kind] || PACK.standard;
    const p = el('div', 'pack k-' + kind + (P.holo ? ' holo' : ''));
    p.style.setProperty('--f0', P.foil[0]); p.style.setProperty('--f1', P.foil[1]); p.style.setProperty('--f2', P.foil[2]); p.style.setProperty('--ink', P.ink); p.style.setProperty('--pg', P.glow);
    const slices = Array.from({ length: SL }, (_, i) => `<i style="--x:${(-i * PW / SL).toFixed(2)}px"></i>`).join('');
    p.innerHTML = `<div class="pk-glow"></div>
      <div class="pk-body" style="clip-path:polygon(0 0,100% 0,${zig(18, 'calc(100% - 8px)', '100%').split(',').reverse().join(',')})">
        <div class="pk-art">${heroArt(P.fan && P.fan[1])}</div><div class="pk-rays"></div><div class="pk-foil"></div>
        <div class="pk-bulge"></div><div class="pk-creases">${CREASES}</div>
        <div class="pk-brand">SECTOR</div>
        <div class="pk-ribbon"><span>${esc(opts.name || P.name)}</span></div>
        <div class="pk-sub">${esc(opts.sub || P.sub)}</div>
        ${P.promise ? `<div class="pk-promise">${P.promise}</div>` : ''}
        ${opts.count ? `<div class="pk-count">${opts.count} CARD${opts.count > 1 ? 'S' : ''}</div>` : ''}
        <div class="pk-bar"></div><div class="pk-side l"></div><div class="pk-side r"></div><div class="pk-crimp b"></div>
        <div class="pk-pillow"></div><div class="pk-spec"></div><div class="pk-sheen"></div><div class="pk-rag" style="clip-path:${rag()}"></div>
      </div>
      <div class="pk-top">${slices}<div class="pk-perf"></div><div class="pk-notch"></div></div>
      <div class="pk-leak"></div><div class="pk-flecks"></div><div class="pk-hint">${opts.hint || 'GRAB THE TOP AND DRAG TO TEAR'}</div>`;
    tilt(p);
    return p;
  }
  // depth: the pack tilts toward the pointer (and sways on its own when left alone); the light, the card fan, the
  // wordmark and the rays read --mx/--my, each at its own depth, so the layers shift against each other
  function tilt(p) {
    let mx = 0, my = 0, tx = 0, ty = 0, hover = false; const t0 = performance.now() + Math.random() * 4000;
    p.addEventListener('pointermove', e => { const r = p.getBoundingClientRect(); hover = true; tx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1)); ty = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1)); });
    p.addEventListener('pointerleave', () => { hover = false; });
    const loop = now => {
      if (!p.isConnected && now - t0 > 3000) return;
      if (!hover) { const k = (now - t0) / 1000; tx = Math.sin(k * 0.9) * 0.55; ty = Math.sin(k * 0.6 + 1) * 0.3; }
      if (p.classList.contains('tearing')) { tx *= 0.6; ty *= 0.6; }
      mx += (tx - mx) * 0.12; my += (ty - my) * 0.12;
      p.style.setProperty('--mx', mx.toFixed(3)); p.style.setProperty('--my', my.toFixed(3));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  // tear it open by hand: grab the top strip and drag across. The torn flap curls up behind the tear and follows the
  // pointer (pull up to lift it), the foil crackles, light the colour of the best card inside pours out of the gap, and
  // near the end the strip snaps off. It tears a little slower than a flick, so you feel it give. A click rips a small
  // bite; Space or Enter opens it for you (and after a long idle it opens itself). Resolves with the opening's centre
  function tear(p, opts = {}) {
    const S = typeof SFX !== 'undefined' ? SFX : {}, col = opts.col || '#fff', top = p.querySelector('.pk-top'), slices = [...top.querySelectorAll('i')];
    const leak = p.querySelector('.pk-leak'), ragEl = p.querySelector('.pk-rag'), flecks = p.querySelector('.pk-flecks'), tab = p.querySelector('.pk-tab');
    p.style.setProperty('--lc', col);
    return new Promise(res => {
      let front = 0, target = 0, lift = 0, done = false, dragging = false, auto = false, moved = 0, last = -1, lastT = performance.now(), raf = 0, idle = null, downX = 0;
      const at = e => { const r = p.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, py: e.clientY - r.top }; };
      const fleck = (x, n) => { for (let k = 0; k < n; k++) { const f = document.createElement('b'); f.style.left = (x * 100) + '%'; f.style.setProperty('--dx', ((Math.random() - 0.3) * 70).toFixed(0) + 'px'); f.style.setProperty('--dy', (-20 - Math.random() * 60).toFixed(0) + 'px'); f.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg'); flecks.appendChild(f); setTimeout(() => f.remove(), 700); } };
      const draw = () => {
        // the flap: every torn sliver curls up from its foot, more the further it is behind the tear
        for (let i = 0; i < slices.length; i++) {
          const x = (i + 1) / slices.length, d = (front - x) * PW;
          if (d <= 0) { slices[i].style.transform = ''; slices[i].classList.remove('torn'); continue; }
          // one flap, hinged at the tear: it peels up as you pull (more if you pull upward) and curls toward its free end
          const left = i * PW / slices.length, pivot = front * PW - left;
          const ang = Math.min(150, 22 + front * 38 + Math.max(0, -lift) * 0.6 + d * 0.16);
          slices[i].style.transformOrigin = `${pivot.toFixed(1)}px 100%`; slices[i].style.transform = `rotate(${ang.toFixed(1)}deg)`; slices[i].classList.add('torn');
        }
        leak.style.width = (front * 100) + '%'; ragEl.style.setProperty('--w', (front * 100) + '%'); p.style.setProperty('--tear', front.toFixed(3));
        if (tab) tab.style.left = `calc(${(front * 100).toFixed(1)}% - 4px)`;
      };
      const step = now => {
        const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
        if (!done) {
          const want = auto ? 1.02 : target, maxV = auto ? 1.6 : 2.1;   // widths per second: the foil gives, but not instantly
          const was = front; if (want > front) front = Math.min(1, front + Math.min(want - front, maxV * dt + (want - front) * 0.08));
          const v = (front - was) / Math.max(dt, 1e-3);
          const n = Math.floor(front * slices.length);
          if (n !== last && front > was) { last = n; S.rip && S.rip(Math.min(1, v / 1.6)); fleck(front, 1 + (v > 1 ? 2 : 0)); if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) navigator.vibrate(4); if (opts.fx && n % 3 === 0) { const r = p.getBoundingClientRect(); opts.fx.burst(r.left + r.width * front, r.top + 40, col, 3, 140, { up: true, spread: 1.2 }); } }
          p.style.setProperty('--shake', (front > was ? (Math.random() - 0.5) * Math.min(2.5, v * 2) : 0).toFixed(2) + 'px');
          draw();
          if (front >= 0.96) return finish();
        }
        raf = requestAnimationFrame(step);
      };
      const finish = () => {
        if (done) return; done = true; cancelAnimationFrame(raf); clearTimeout(idle); front = 1; draw();
        p.onpointerdown = p.onpointermove = p.onpointerup = p.onpointercancel = null; removeEventListener('keydown', key);
        p.classList.add('torn-open'); p.classList.remove('tearing'); p.style.setProperty('--shake', '0px');
        S.ripPop && S.ripPop(); S.boom && S.boom(0.5); S.rare && S.rare(); fleck(0.9, 10);
        if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) navigator.vibrate([18, 30, 12]);
        const r = p.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * 0.1;
        if (opts.fx) { opts.fx.burst(x, y, col, 60, 560, { up: true, spread: 1.7 }); opts.fx.ring(x, y, col, 340); }
        setTimeout(() => res([x, y]), 380);
      };
      const start = () => { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(step); } };
      const go = () => { if (done) return; auto = true; p.classList.add('tearing'); S.whoosh && S.whoosh(); start(); };
      p.onpointerdown = e => {
        if (done) return; const q = at(e); clearTimeout(idle);
        if (q.y > 0.3) { p.classList.remove('nudge'); void p.offsetWidth; p.classList.add('nudge'); return; }   // not the strip: a wiggle points at it
        dragging = true; moved = 0; downX = q.x; p.setPointerCapture && p.setPointerCapture(e.pointerId); p.classList.add('tearing'); target = Math.max(target, front + 0.02); lift = 0; start();
      };
      p.onpointermove = e => { if (!dragging) return; const q = at(e); moved = Math.max(moved, Math.abs(q.x - downX)); target = Math.max(target, Math.min(1.05, q.x)); lift = Math.min(0, q.py - 28); };
      p.onpointerup = p.onpointercancel = () => {
        if (!dragging) return; dragging = false; lift = 0;
        if (moved < 0.04) target = Math.max(target, front + 0.14);   // a click: a small bite
        if (front > 0.75 || target > 0.9) auto = true;   // nearly there: it gives way
        idle = setTimeout(go, 20000);
      };
      const key = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); go(); } };
      addEventListener('keydown', key);
      idle = setTimeout(go, opts.autoAfter || 20000);
    });
  }

  // ── a crate on the Store shelf: hovering, breathing light, motes, and it leans toward the pointer ──
  function shelf(kind, B, priceHtml, canAfford, onOpen) {
    const t = el('div', 'crate-tile k-' + kind);
    const odds = Object.entries(B.odds).map(([r, w]) => `<div class="co-row"><i style="background:${RCOL[r]}"></i><span>${r[0].toUpperCase() + r.slice(1)}</span><b>${w}%</b></div>`).join('');
    t.innerHTML = `<div class="ct-stage"><div class="ct-rays"></div><div class="ct-motes">${Array.from({ length: kind === 'elite' ? 14 : 8 }, (_, i) => `<span style="--x:${(i * 37) % 100}%;--d:${(i % 5) * 0.7}s;--s:${0.6 + (i % 3) * 0.3}"></span>`).join('')}</div><div class="ct-crate ct-pack"></div></div>
      <div class="ct-info"><div class="ct-tag">${kind === 'elite' ? '★ PREMIUM' : 'STANDARD ISSUE'}</div><h3>${esc(B.name)}</h3><div class="ct-desc">${esc(B.desc)}</div><div class="ct-odds">${odds}</div></div>`;
    t.querySelector('.ct-pack').appendChild(pack(kind === 'elite' ? 'elite' : 'field', { name: B.name.toUpperCase().replace(/ CRATE$/, ' PACK'), hint: ' ' }));
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
    v.innerHTML = `<div class="co-vignette"></div><div class="co-stage"><div class="co-beam"></div><div class="co-crate co-pack"></div><div class="co-flipper"><div class="co-back"><div class="cb-logo">SECTOR</div></div><div class="co-front"></div></div></div>
      <div class="co-label"></div><div class="co-btns"></div><div class="co-skip">${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click or press Space'} to skip</div>`;
    const fx = fxCanvas(v), crate = v.querySelector('.co-crate'), flip = v.querySelector('.co-flipper');
    const B = (typeof SectorCosmetics !== 'undefined' && SectorCosmetics.BOXES[m.box]) || {};
    const pk = pack(m.box === 'elite' ? 'elite' : 'field', { name: (B.name || 'Pack').toUpperCase().replace(/ CRATE$/, ' PACK'), count: 1 }); pk.classList.add('drop-in'); crate.appendChild(pk);
    v.querySelector('.co-front').appendChild(card);
    let skip = false; v.onclick = () => { skip = true; };
    const skipKey = e => { if (e.key === ' ' && !e.repeat) { e.preventDefault(); skip = true; } }; addEventListener('keydown', skipKey);
    const W = ms => skip ? Promise.resolve() : wait(ms);
    const center = () => { const r = crate.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.42]; };
    const S = typeof SFX !== 'undefined' ? SFX : {};
    S.whoosh && S.whoosh();
    await W(650);
    // tear the pack open: the light that pours out is the card's rarity colour (a click, Space or skipping tears it for you)
    v.onclick = null;
    const [ox, oy] = await tear(pk, { col, fx });
    v.onclick = () => { skip = true; };
    crate.classList.add('opened'); v.classList.add('lit');
    S.boom && S.boom(0.5 + tier * 0.2); tier >= 3 ? S.legendary && S.legendary() : S.rare && S.rare();
    fx.burst(ox, oy, col, 50 + tier * 30, 560 + tier * 80, { up: true, spread: 2.2 }); fx.ring(ox, oy, col, 380 + tier * 80); if (tier >= 3) { fx.ring(ox, oy, '#ffffff', 600, 1.2); v.classList.add('flash'); } fx.motes(ox, oy, col, 20 + tier * 8);
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
    removeEventListener('keydown', skipKey);
    const btns = v.querySelector('.co-btns'); v.querySelector('.co-skip').remove();
    if (opts.again) { const b = el('button', 'btn big gold', 'OPEN ANOTHER · ' + opts.againLabel); b.onclick = e => { e.stopPropagation(); fx.stop(); v.remove(); opts.again(); }; btns.appendChild(b); }
    const d = el('button', 'btn big', 'DONE'); d.onclick = e => { e.stopPropagation(); fx.stop(); v.remove(); opts.done && opts.done(); }; btns.appendChild(d);
    v.onclick = null;
  }
  return { svg, shelf, open, pack, tear, fxCanvas, RCOL };
})();
