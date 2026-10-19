/* SECTOR — 2.5D hex board renderer */
const Render = (() => {
  const E = SectorEngine;
  const S = 34, TILT = 0.68, SQ3 = Math.sqrt(3);
  const VERT = [-90, -30, 30, 90, 150, 210].map(a => [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)]);
  const EDGE_DIR = [1, 0, 5, 4, 3, 2];
  const HEIGHT = { water: 2, plains: 8, forest: 8, hills: 10, mountain: 10, desert: 7, jungle: 8, tundra: 9, swamp: 5, canyon: 12 };
  // neutral land is deliberately muted so player territory pops
  const COL = { river: '#2d7aa6', shallow: '#2a6688', water: '#173d58', plains: '#55644a', forest: '#3f5640', hills: '#6b6150', mountain: '#4a4752', fallout: '#6f7a25', desert: '#9c8a5c', jungle: '#2f5a37', tundra: '#9aa7ae', swamp: '#4b5a46', canyon: '#a8532c' };
  const POI_COL = { ruins: '#d9b77a', cache: '#ffcf4a', village: '#f1efe6', fort: '#c9cfd6', relic: '#c27bff', silo: '#ffffff' };

  let cv, ctx, W = 0, H = 0, DPR = 1;
  const late = [];
  let layerCost = 0, menuKey = '';
  let lc = null, lctx = null, layerKey = '', layerT = -1, stateVer = 0, fadeUntil = 0;   // cached terrain layer
  let S_ = null;                 // display state
  let order = [];                // tile keys sorted for drawing
  const tc = {};                 // tile cache
  const cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 };
  const ov = { reach: null, probs: null, targets: null, spawn: null, selected: null, hover: null, path: null, planArrows: [], planGhost: null, me: null, pulse: null, myTurn: false };
  const unitPos = {};            // id -> {x,y} world override during animation
  const unitHidden = new Set();  // units hidden during animation
  const extraUnits = [];         // units shown during animation not yet in state
  const fx = { parts: [], floats: [], rings: [], beams: [], lances: [], emps: [], shake: 0, flash: 0, flashCol: '#fff', pops: {} };
  let t = 0, lastT = 0;

  // ── colour helpers ──
  const hx = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgb = a => 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')';
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const shade = (a, k) => k < 0 ? a.map(v => v * (1 + k)) : a.map(v => v + (255 - v) * k);
  function hash(q, r) { let h = (q * 73856093) ^ (r * 19349663); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }

  function world(k) { const c = tc[k]; if (c) return c; const [q, r] = E.parse(k); return { wx: S * SQ3 * (q + r / 2), wy: S * 1.5 * r * TILT, h: 12 }; }
  function toScreen(wx, wy) { return [(wx - cam.x) * cam.z + W / 2, (wy - cam.y) * cam.z + H / 2]; }
  function toWorld(sx, sy) { return [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y]; }
  function topOf(k) { const c = world(k); return [c.wx, c.wy - c.h * (S / 34)]; }

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    lc = document.createElement('canvas'); lctx = lc.getContext('2d');
    const resize = () => { DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px'; lc.width = W * DPR; lc.height = H * DPR; layerKey = ''; };
    addEventListener('resize', resize); resize();
    requestAnimationFrame(loop);
  }

  function invalidate() { stateVer++; }
  function setState(s) {
    const fresh = !S_ || !s || !S_.map || S_.seed !== s.seed;
    S_ = s;
    if (!s) return;
    if (fresh) {
      order = Object.keys(s.map.tiles).sort((a, b) => { const [qa, ra] = E.parse(a), [qb, rb] = E.parse(b); return ra - rb || qa - qb; });
      for (const k in tc) delete tc[k];
      for (const k of order) { const [q, r] = E.parse(k); tc[k] = { wx: S * SQ3 * (q + r / 2), wy: S * 1.5 * r * TILT, h: HEIGHT[s.map.tiles[k].t], v: hash(q, r), q, r }; }
    }
    recolor();
  }
  function setCols(c, base, owned) {
    c.top = rgb(base); c.side1 = rgb(shade(base, -0.42)); c.side2 = rgb(shade(base, -0.58));
    c.dark = rgb(shade(base, owned ? -0.35 : -0.3)); c.light = rgb(shade(base, 0.18));
  }
  const FADE = 0.6;
  function fadeNow(c, now) { const p = Math.min(1, (now - c.fadeT0) / FADE), e = p * p * (3 - 2 * p); return mix(c.fadeFrom, c.base, e); }
  function recolor() {
    if (!S_) return;
    const pc = {}; for (const p of S_.players) pc[p.id] = hx(p.color);
    const now = t;
    for (const k of order) {
      const t = S_.map.tiles[k], c = tc[k];
      // rivers are full water hexes: a sunken, flowing channel (they still keep their land rules)
      const river = t.river && t.t !== 'water' && t.fog !== 2 && !t.contam;
      c.h = t.fog === 2 ? 4 : river ? 3.5 : HEIGHT[t.t];
      c.river = river;
      let base = hx(t.fog === 2 ? '#141c24' : t.contam ? COL.fallout : river ? COL.river : t.t === 'water' ? (t.deep ? COL.water : COL.shallow) : COL[t.t]);
      base = shade(base, (c.v - 0.5) * 0.06);
      const owned = t.owner && pc[t.owner] && t.t !== 'water' && !river;
      if (t.owner && pc[t.owner] && (t.t === 'water' || river)) base = mix(base, pc[t.owner], t.bridge ? 0.5 : river ? 0.38 : 0.32);
      if (owned) {
        // flat, saturated team colour; terrain only nudges the brightness
        const tb = { plains: 0, forest: -0.12, hills: 0.08, desert: 0.1, jungle: -0.16, tundra: 0.14, swamp: -0.1, canyon: -0.04 }[t.t] || 0;
        base = mix(shade(pc[t.owner], -0.18), hx(COL[t.t]), 0.18);
        base = shade(base, tb);
      }
      // sea hexes changing hands cross-fade to their new colour instead of snapping
      if (t.t === 'water' && c.base && (c.base[0] !== base[0] || c.base[1] !== base[1] || c.base[2] !== base[2])) { c.fadeFrom = c.fadeFrom ? fadeNow(c, now) : c.base; c.fadeT0 = now; fadeUntil = now + FADE; }
      c.base = base;
      setCols(c, base, owned);
      c.owned = !!owned;
      c.owner = t.owner; c.oc = t.owner && pc[t.owner] && t.fog !== 2 ? rgb(shade(pc[t.owner], 0.45)) : null;
    }
    if (S_._sup) delete S_._sup;
    computeRoads();
    stateVer++;
  }
  // roads: each commander's buildings are linked back to their HQ along the shortest route through their own land.
  // Recomputed from the board every time it changes, so a captured or cut-off hex breaks the road there.
  let roads = {};
  function computeRoads() {
    roads = {};
    const tiles = S_.map.tiles, link = (a, b) => { (roads[a] || (roads[a] = new Set())).add(b); (roads[b] || (roads[b] = new Set())).add(a); };
    for (const p of S_.players) {
      if (!p.alive || !p.hq || !tiles[p.hq] || tiles[p.hq].owner !== p.id) continue;
      const passable = k => { const t = tiles[k]; return t && t.owner === p.id && t.fog !== 2 && E.isLandTile(t) && t.t !== 'mountain'; };
      const prev = { [p.hq]: null }, q = [p.hq];
      for (let i = 0; i < q.length; i++) for (const n of E.neighbors(q[i])) if (!(n in prev) && passable(n)) { prev[n] = q[i]; q.push(n); }
      for (const k of q) {
        if (k === p.hq || !E.structsOf(tiles[k]).some(st => st.owner === p.id && st.type !== 'hq')) continue;
        for (let c = k; prev[c] && !(roads[c] && roads[c].has(prev[c])); c = prev[c]) link(c, prev[c]);
      }
    }
  }
  function drawRoad(k, cx, cy, z) {
    const set = roads[k]; if (!set) return;
    ctx.save(); ctx.lineCap = 'round';
    const ends = [];
    for (const n of set) { const a = tc[n]; if (!a) continue; const [nx, ny] = toScreen(a.wx, a.wy - a.h * (S / 34)); ends.push([(cx + nx) / 2, (cy + ny) / 2]); }
    for (const [w, col] of [[3.4, 'rgba(30,24,16,.28)'], [1.7, 'rgba(226,210,170,.42)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w * z; ctx.beginPath();
      for (const [ex, ey] of ends) { ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── camera ──
  function focus(k, z) { const [x, y] = topOf(k); cam.tx = x; cam.ty = y; if (z) cam.tz = z; }
  function fitMap() {
    if (!S_) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const k of order) { const c = tc[k]; x0 = Math.min(x0, c.wx); x1 = Math.max(x1, c.wx); y0 = Math.min(y0, c.wy); y1 = Math.max(y1, c.wy); }
    const z = Math.min(W / (x1 - x0 + S * 3), (H - 120) / (y1 - y0 + S * 3));
    cam.tz = cam.z = Math.max(0.3, Math.min(1.6, z)); cam.tx = cam.x = (x0 + x1) / 2; cam.ty = cam.y = (y0 + y1) / 2 - 10;
  }
  function pan(dx, dy) { cam.tx -= dx / cam.z; cam.ty -= dy / cam.z; cam.x = cam.tx; cam.y = cam.ty; }
  function zoomAt(sx, sy, f) {
    const [wx, wy] = toWorld(sx, sy);
    cam.tz = Math.max(0.35, Math.min(2.6, cam.tz * f));
    // keep point under cursor fixed (instant for responsiveness)
    cam.z = cam.tz; cam.x = cam.tx = wx - (sx - W / 2) / cam.z; cam.y = cam.ty = wy - (sy - H / 2) / cam.z;
  }

  // ── picking ──
  function hexAt(sx, sy) {
    if (!S_) return null;
    for (let i = order.length - 1; i >= 0; i--) {
      const k = order[i], c = tc[k];
      const [cx, cy] = toScreen(c.wx, c.wy - c.h * (S / 34));
      const dx = (sx - cx) / cam.z, dy = (sy - cy) / cam.z / TILT;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax <= S * SQ3 / 2 && ax / SQ3 + ay <= S) return k;
    }
    return null;
  }
  function screenOf(k) { const [x, y] = topOf(k); return toScreen(x, y); }

  // ── fx api ──
  // ── aircraft: jets cross the map in world space, drop bombs on targets, then fly off ──
  const planes = [], bombs = [];
  function flyover(targets, opts = {}) {
    const pts = targets.map(k => topOf(k)); if (!pts.length) return;
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const ang = opts.angle ?? (Math.random() * 0.6 - 0.3), dx = Math.cos(ang), dy = Math.sin(ang) * 0.5, L = 900, alt = 150;
    const n = opts.count || 1, dur = opts.dur || 1.7, t0 = t;
    for (let i = 0; i < n; i++) {
      const side = (i - (n - 1) / 2) * 46;     // formation spacing, perpendicular to the flight path
      planes.push({ x0: cx - dx * L - dy * side, y0: cy - dy * L + dx * side * 0.5, x1: cx + dx * L - dy * side, y1: cy + dy * L + dx * side * 0.5, alt, t0: t0 + i * 0.12, dur, color: opts.color || '#e9edf2', ang });
    }
    // bombs leave the lead plane as it passes over each target, in flight order
    pts.slice().sort((a, b) => (a[0] - cx) * dx + (a[1] - cy) * dy - ((b[0] - cx) * dx + (b[1] - cy) * dy)).forEach((p, i) => {
      const along = ((p[0] - cx) * dx + (p[1] - cy) * dy + L) / (2 * L);   // 0..1 along the path
      bombs.push({ tx: p[0], ty: p[1], tDrop: t0 + along * dur - 0.32 + i * 0.03, fall: 0.42, alt, cb: opts.onBomb, colors: opts.colors });
    });
  }
  function drawAir() {
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i], p = (t - b.tDrop) / b.fall;
      if (p < 0) continue;
      if (p >= 1) { burst([b.tx, b.ty], b.colors || ['#ffb03a', '#ff5a2a', '#fff2a8', '#555'], 22, { speed: 1.4, size: 3.2 }); ring([b.tx, b.ty], '#ffb03a', 55, 0.45, 4); if (b.cb) b.cb(); bombs.splice(i, 1); continue; }
      const [sx, sy] = toScreen(b.tx, b.ty - b.alt * (1 - p * p)), z = cam.z;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; const [gx, gy] = toScreen(b.tx, b.ty); ctx.beginPath(); ctx.ellipse(gx, gy, 5 * z * p, 2 * z * p, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(sx, sy); ctx.fillStyle = '#20262c'; ctx.beginPath(); ctx.ellipse(0, 0, 2.6 * z, 5 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb03a'; ctx.fillRect(-2.5 * z, -6.5 * z, 5 * z, 2 * z); ctx.restore();
    }
    for (let i = planes.length - 1; i >= 0; i--) {
      const pl = planes[i], p = (t - pl.t0) / pl.dur;
      if (p > 1) { planes.splice(i, 1); continue; }
      if (p < 0) continue;
      const wx = pl.x0 + (pl.x1 - pl.x0) * p, wy = pl.y0 + (pl.y1 - pl.y0) * p, z = cam.z;
      const [gx, gy] = toScreen(wx, wy), [sx, sy] = toScreen(wx, wy - pl.alt);
      // ground shadow
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(pl.ang + Math.PI / 2); ctx.scale(1, 0.5); ctx.globalAlpha = 0.3; Art.drawIcon(ctx, 'unit', 'seraph', 0, 0, 22 * z, '#000'); ctx.restore();
      // contrail
      const [tx0, ty0] = toScreen(wx - (pl.x1 - pl.x0) * 0.08, wy - pl.alt - (pl.y1 - pl.y0) * 0.08);
      const g = ctx.createLinearGradient(tx0, ty0, sx, sy); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.55)');
      ctx.strokeStyle = g; ctx.lineWidth = 3 * z; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(sx, sy); ctx.stroke();
      // jet: ink outline, team-tinted body
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(pl.ang + Math.PI / 2);
      for (let a = 0; a < 8; a++) Art.drawIcon(ctx, 'unit', 'seraph', Math.cos(a / 8 * Math.PI * 2) * 2 * z, Math.sin(a / 8 * Math.PI * 2) * 2 * z, 22 * z, '#0b0f13');
      Art.drawIcon(ctx, 'unit', 'seraph', 0, 0, 22 * z, pl.color);
      ctx.globalAlpha = 0.35; Art.drawIcon(ctx, 'unit', 'seraph', 0, -1.5 * z, 22 * z, '#ffffff');
      ctx.restore();
    }
  }
  function burst(k, color, n = 16, opts = {}) {
    const [x, y] = Array.isArray(k) ? k : topOf(k);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (opts.speed || 1) * (40 + Math.random() * 120);
      fx.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - (opts.up || 80), life: 0, max: (opts.life || 0.7) * (0.6 + Math.random() * 0.6), col: Array.isArray(color) ? color[i % color.length] : color, sz: (opts.size || 3) * (0.6 + Math.random()), g: opts.g ?? 260, sq: opts.square });
    }
  }
  function smoke(k, n = 10, col = 'rgba(200,200,200,') {
    const [x, y] = Array.isArray(k) ? k : topOf(k);
    for (let i = 0; i < n; i++) fx.parts.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 30, life: 0, max: 1 + Math.random(), col: null, smoke: col, sz: 8 + Math.random() * 10, g: -10 });
  }
  function float(k, text, color = '#fff', size = 22, dur = 1.3) { const [x, y] = Array.isArray(k) ? k : topOf(k); fx.floats.push({ x, y: y - 20, text, color, size, t0: t, dur }); }
  function ring(k, color, r1 = 80, dur = 0.6, w = 4) { const [x, y] = Array.isArray(k) ? k : topOf(k); fx.rings.push({ x, y, color, r1, t0: t, dur, w }); }
  // EMP: an electric shockwave rolling out over a hex and its ring, with crackling arcs
  function emp(k, dur = 1.2) { fx.emps.push({ b: topOf(k), t0: t, dur }); }
  // orbital lance: a column of light straight down from the sky onto hex k
  function lance(k, color, dur = 0.9) { fx.lances.push({ b: topOf(k), color, t0: t, dur }); }
  function beam(a, b, color, dur, arc = 0, cb) { fx.beams.push({ a: topOf(a), b: topOf(b), color, t0: t, dur, arc, cb, done: false }); }
  function shake(v) { fx.shake = Math.max(fx.shake, v); }
  function flash(v, col = '#fff') { fx.flash = Math.max(fx.flash, v); fx.flashCol = col; }
  function pop(k) { fx.pops[k] = t; }

  // ── drawing ──
  function hexPath(cx, cy, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const x = cx + VERT[i][0] * s, y = cy + VERT[i][1] * s * TILT; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
  }
  function bg() {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 50, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#173445'); g.addColorStop(0.55, '#0d1d29'); g.addColorStop(1, '#060c12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // drifting swirl blobs (Balatro-esque background motion)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x = W * (0.5 + 0.38 * Math.sin(t * 0.07 + i * 2.1)), y = H * (0.5 + 0.32 * Math.cos(t * 0.05 + i * 1.7));
      const rg = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.45);
      rg.addColorStop(0, ['rgba(40,120,160,.10)', 'rgba(120,60,160,.07)', 'rgba(30,160,120,.06)'][i]); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
    // ocean ripples
    ctx.strokeStyle = 'rgba(120,200,255,.045)'; ctx.lineWidth = 1;
    const step = 46 * cam.z, off = (t * 8 * cam.z) % step;
    for (let y = -step + off - (cam.y * cam.z) % step; y < H + step; y += step) { ctx.beginPath(); for (let x = 0; x <= W; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.012 + t * 0.6 + y) * 4); ctx.stroke(); }
  }

  function drawFog(k) {
    const c = tc[k], z = cam.z, sc = S / 34;
    const [cx, gy] = toScreen(c.wx, c.wy); const cy = gy - c.h * sc * z, s = S * 0.99 * z;
    if (cx < -80 || cx > W + 80 || cy < -120 || gy > H + 120) return;
    const drift = 0.5 + 0.5 * Math.sin(t * 0.35 + c.q * 0.6 + c.r * 0.4);
    hexPath(cx, cy, s); ctx.fillStyle = `rgba(12,18,26,${0.48 + drift * 0.08})`; ctx.fill();
    ctx.fillStyle = `rgba(160,175,190,${0.05 + drift * 0.05})`; ctx.beginPath(); ctx.ellipse(cx + (drift - 0.5) * 8 * z, cy - 2 * z, s * 0.55, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  }
  function hasOverlay(k) {
    if (ov.hover === k || ov.selected === k) return true;
    if (ov.spawn && ov.spawn.has(k)) return true;
    if (ov.targets && ov.targets.has(k)) return true;
    if (ov.fire && ov.fire.has(k)) return true;
    if (ov.selectedExtra && ov.selectedExtra.includes(k)) return true;
    const r = ov.reach && ov.reach[k]; return !!(r && r.kind !== 'start' && r.kind !== 'pass');
  }
  function drawOverlays(k, cx, cy, s, z) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    if (ov.spawn && ov.spawn.has(k)) { hexPath(cx, cy, s * 0.86); ctx.fillStyle = `rgba(120,255,170,${0.18 + pulse * 0.2})`; ctx.fill(); ctx.strokeStyle = '#8affb8'; ctx.lineWidth = 2 * z; ctx.setLineDash([5 * z, 4 * z]); ctx.lineDashOffset = -t * 20; ctx.stroke(); ctx.setLineDash([]); }
    if (ov.targets && ov.targets.has(k)) { hexPath(cx, cy, s * 0.86); ctx.fillStyle = `rgba(255,190,60,${0.16 + pulse * 0.2})`; ctx.fill(); ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 2 * z; ctx.setLineDash([5 * z, 4 * z]); ctx.lineDashOffset = -t * 20; ctx.stroke(); ctx.setLineDash([]); }
    if (ov.reach) {
      const r = ov.reach[k];
      if (r && r.kind !== 'start' && r.kind !== 'pass') {
        const col = r.kind === 'attack' ? [255, 70, 80] : r.kind === 'capture' ? [255, 190, 60] : r.kind === 'board' ? [90, 220, 255] : [255, 255, 255];
        hexPath(cx, cy, s * 0.82); ctx.fillStyle = `rgba(${col},${r.kind === 'move' ? 0.13 + pulse * 0.07 : 0.22 + pulse * 0.15})`; ctx.fill();
        ctx.strokeStyle = `rgba(${col},.85)`; ctx.lineWidth = 1.6 * z; ctx.stroke();
      }
    }
    if (ov.fire && ov.fire.has(k)) { crosshair(cx, cy, s, z, pulse); }
    if (ov.hover === k) { hexPath(cx, cy, s); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.2 * z; ctx.stroke(); }
    if (ov.selectedExtra && ov.selectedExtra.includes(k)) { hexPath(cx, cy, s * (1.02 + pulse * 0.04)); ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 3 * z; ctx.setLineDash([8 * z, 5 * z]); ctx.lineDashOffset = t * 30; ctx.stroke(); ctx.setLineDash([]); }
    if (ov.selected === k) { hexPath(cx, cy, s * (1.02 + pulse * 0.04)); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * z; ctx.setLineDash([8 * z, 5 * z]); ctx.lineDashOffset = t * 30; ctx.stroke(); ctx.setLineDash([]); }
  }
  // sea shimmer: a soft light that swells and fades across the water, drawn per frame so it never snaps
  function drawWaterGlints() {
    const z = cam.z, sc = S / 34, s = S * 0.965 * z;
    for (const k of order) {
      const tile = S_.map.tiles[k], c = tc[k]; if (!c || (tile.t !== 'water' && !c.river) || tile.fog || tile.contam) continue;
      const [cx, gy] = toScreen(c.wx, c.wy); const cy = gy - c.h * sc * z;
      if (cx < -60 || cx > W + 60 || cy < -60 || cy > H + 60) continue;
      if (c.river && z > 0.45) { drawRiver(k, tile, cx, cy, z, s, true); ctx.globalAlpha = 1; }
      const sh = 0.5 + 0.5 * Math.sin(t * 1.1 + c.q * 0.9 - c.r * 0.6); if (sh < 0.55) continue;
      ctx.globalAlpha = Math.pow((sh - 0.55) / 0.45, 2) * (tile.deep ? 0.18 : 0.24);
      ctx.fillStyle = tile.deep ? '#4f8fb8' : '#7cc4e6';
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const v = VERT[i]; i ? ctx.lineTo(cx + v[0] * s, cy + v[1] * s * TILT) : ctx.moveTo(cx + v[0] * s, cy + v[1] * s * TILT); } ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawTile(k, pass) {
    const c = tc[k], tile = S_.map.tiles[k], z = cam.z, sc = S / 34;
    if (pass !== 'overlay' && c.fadeFrom) { if (t - c.fadeT0 >= FADE) { c.fadeFrom = null; setCols(c, c.base, c.owned); } else setCols(c, fadeNow(c, t), c.owned); }
    let h = c.h * sc;
    const popT = fx.pops[k]; let popS = 1;
    if (popT !== undefined) { const p = (t - popT) / 0.35; if (p < 1) { h += Math.sin(p * Math.PI) * 10; popS = 1 + Math.sin(p * Math.PI) * 0.08; } else if (pass !== 'overlay') delete fx.pops[k]; }
    const [cx, gy] = toScreen(c.wx, c.wy);
    const cy = gy - h * z, s = S * 0.965 * z * popS;
    if (cx < -80 || cx > W + 80 || cy < -120 || gy > H + 120) return;
    if (pass === 'overlay') return drawOverlays(k, cx, cy, s, z);
    const base = tile.t === 'water' ? 2 * z : 10 * z;
    // side faces
    for (const [i, col] of [[2, c.side1], [3, c.side2]]) {
      const a = VERT[i], b = VERT[(i + 1) % 6];
      ctx.beginPath();
      ctx.moveTo(cx + a[0] * s, cy + a[1] * s * TILT); ctx.lineTo(cx + b[0] * s, cy + b[1] * s * TILT);
      ctx.lineTo(cx + b[0] * s, gy + base + b[1] * s * TILT); ctx.lineTo(cx + a[0] * s, gy + base + a[1] * s * TILT);
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    }
    // left vertical-ish face (pointy hex has a visible lower-left/right sliver)
    hexPath(cx, cy, s);
    ctx.fillStyle = c.top;   // water shimmer is drawn every frame on top (drawWaterGlints), so it fades smoothly
    ctx.fill();
    // top bevel highlight
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1.2 * z;
    ctx.beginPath(); ctx.moveTo(cx + VERT[4][0] * s, cy + VERT[4][1] * s * TILT); ctx.lineTo(cx + VERT[5][0] * s, cy + VERT[5][1] * s * TILT); ctx.lineTo(cx + VERT[0][0] * s, cy + VERT[0][1] * s * TILT); ctx.lineTo(cx + VERT[1][0] * s, cy + VERT[1][1] * s * TILT); ctx.stroke();

    // bombed out: scorched ground and smoke (pays nothing until it recovers)
    if (tile.ruin && tile.fog !== 2) {
      ctx.save(); hexPath(cx, cy, s); ctx.clip();
      ctx.fillStyle = 'rgba(25,18,12,.42)'; ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
      for (const [ox, oy, rr] of [[-0.3, 0.05, 0.22], [0.25, -0.1, 0.18], [0.05, 0.25, 0.15]]) { ctx.fillStyle = 'rgba(10,8,6,.5)'; ctx.beginPath(); ctx.ellipse(cx + ox * s, cy + oy * s * TILT, rr * s, rr * s * TILT, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    // cut-off (unsupplied) hatch
    if (tile.owner && ov.unsupplied && ov.unsupplied.has(k)) {
      ctx.save(); hexPath(cx, cy, s); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 3 * z;
      for (let x = -s * 2; x < s * 2; x += 9 * z) { ctx.beginPath(); ctx.moveTo(cx + x, cy - s); ctx.lineTo(cx + x + s, cy + s); ctx.stroke(); }
      ctx.restore();
    }
    if (tile.fog === 2) {
      // unexplored: drifting cloud wisps, nothing else (except a known HQ)
      const d = 0.5 + 0.5 * Math.sin(t * 0.3 + c.q * 0.7 + c.r * 0.5);
      ctx.fillStyle = `rgba(120,135,150,${0.06 + d * 0.05})`;
      ctx.beginPath(); ctx.ellipse(cx + (c.v - 0.5) * 10 * z, cy - 1 * z, s * 0.6, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      if (tile.struct && tile.struct.type === 'hq') drawStruct(tile, cx, cy, z, k);
      return;
    }
    if (c.river) drawRiver(k, tile, cx, cy, z, s); else decorate(tile, c, cx, cy, s, z);
    drawRoad(k, cx, cy, z);
    // territory borders
    if (tile.owner && c.oc) {
      const nb = E.neighbors(k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const n = S_.map.tiles[nb[EDGE_DIR[i]]];
        if (n && n.owner === tile.owner) continue;
        const a = VERT[i], b = VERT[(i + 1) % 6], ss = s * 0.97;
        ctx.moveTo(cx + a[0] * ss, cy + a[1] * ss * TILT); ctx.lineTo(cx + b[0] * ss, cy + b[1] * ss * TILT);
      }
      ctx.strokeStyle = c.oc; ctx.globalAlpha = 0.28; ctx.lineWidth = 10 * z; ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 4.5 * z; ctx.stroke();
    }
    if (tile.struct && tile.struct.type !== 'bridge') {
      drawStruct(tile, cx, cy, z, k);
      const extra = (tile.structs || []).filter(st => st !== tile.struct && st.type !== tile.struct.type);
      extra.forEach((st, i) => drawMini(st, cx - 16 * z + i * 32 * z, cy + 7 * z, z));
      const h = (tile.structs || []).find(st => st.type === 'hq');
      if (h && h.siege) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 8);
        ctx.strokeStyle = `rgba(255,70,40,${0.5 + pulse * 0.5})`; ctx.lineWidth = 4 * z;
        hexPath(cx, cy, S * 0.9 * z); ctx.stroke();
        if (Math.random() < 0.25) burst([tc[k].wx + (Math.random() - 0.5) * 30, tc[k].wy - tc[k].h - 10], ['#ff6a2a', '#ffb03a', '#444'], 2, { up: 120, size: 3, life: 0.6 });
      }
    }
  }

  function crosshair(cx, cy, s, z, pulse) {
    ctx.save(); ctx.strokeStyle = '#ff4654'; ctx.lineWidth = 2.4 * z; const r = s * (0.55 + pulse * 0.08);
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * TILT, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6 * TILT); ctx.lineTo(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3 * TILT); ctx.stroke(); }
    ctx.restore();
  }

  function prism(cx, cy, s, h, top, s1, s2) {
    const ty = cy - h;
    for (const [i, col] of [[2, s1], [3, s2]]) {
      const a = VERT[i], b = VERT[(i + 1) % 6];
      ctx.beginPath(); ctx.moveTo(cx + a[0] * s, ty + a[1] * s * TILT); ctx.lineTo(cx + b[0] * s, ty + b[1] * s * TILT);
      ctx.lineTo(cx + b[0] * s, cy + b[1] * s * TILT); ctx.lineTo(cx + a[0] * s, cy + a[1] * s * TILT); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    }
    hexPath(cx, ty, s); ctx.fillStyle = top; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1 * cam.z;
    ctx.beginPath(); ctx.moveTo(cx + VERT[4][0] * s, ty + VERT[4][1] * s * TILT); ctx.lineTo(cx + VERT[5][0] * s, ty + VERT[5][1] * s * TILT); ctx.lineTo(cx + VERT[0][0] * s, ty + VERT[0][1] * s * TILT); ctx.lineTo(cx + VERT[1][0] * s, ty + VERT[1][1] * s * TILT); ctx.stroke();
    return ty;
  }
  // a little low-poly range: back peak + two foothills, light from the upper left
  function drawMountain(c, cx, cy, s, z) {
    const v = c.v, v2 = (v * 7.3) % 1;
    const peaks = [
      { ox: -0.05 + (v - 0.5) * 0.2, oy: -0.1, w: 0.66, h: 34 + v * 12 },
      { ox: -0.46, oy: 0.16, w: 0.4, h: 17 + v2 * 8 },
      { ox: 0.44, oy: 0.2, w: 0.38, h: 14 + v * 7 },
    ];
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(cx + s * 0.05, cy + s * 0.12 * TILT, s * 0.82, s * 0.42 * TILT, 0, 0, Math.PI * 2); ctx.fill();
    for (const pk of peaks) {
      const x = cx + pk.ox * s, y = cy + pk.oy * s * TILT * 1.4 + 4 * z, w = pk.w * s, H = pk.h * z;
      const A = [x + w * 0.06, y - H], L = [x - w, y], R = [x + w, y], F = [x + w * 0.18, y + w * 0.34 * TILT];
      let g = ctx.createLinearGradient(A[0], A[1], L[0], L[1]);
      g.addColorStop(0, '#a7a1b6'); g.addColorStop(1, '#6f6a80');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...L); ctx.lineTo(...F); ctx.closePath(); ctx.fill();
      g = ctx.createLinearGradient(A[0], A[1], R[0], R[1]);
      g.addColorStop(0, '#5f5a72'); g.addColorStop(1, '#3d3a4c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...F); ctx.lineTo(...R); ctx.closePath(); ctx.fill();
      const M = [A[0] + (L[0] - A[0]) * 0.55, A[1] + (L[1] - A[1]) * 0.55];
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...M); ctx.lineTo(F[0] - w * 0.25, F[1] - H * 0.15); ctx.closePath(); ctx.fill();
      if (H > 18 * z) {
        const k = 0.34 + v * 0.06;
        const lerp = (P, Q, t2) => [P[0] + (Q[0] - P[0]) * t2, P[1] + (Q[1] - P[1]) * t2];
        const SL = lerp(A, L, k), SF = lerp(A, F, k * 1.15), SR = lerp(A, R, k * 0.9);
        const J1 = lerp(SL, SF, 0.5); J1[1] += H * 0.07;
        const J2 = lerp(SF, SR, 0.5); J2[1] += H * 0.06;
        ctx.fillStyle = '#f6f8fc'; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...SL); ctx.lineTo(J1[0], J1[1]); ctx.lineTo(...SF); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c3cad8'; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...SF); ctx.lineTo(J2[0], J2[1]); ctx.lineTo(...SR); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.2 * z; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...F); ctx.stroke();
    }
  }
  function drawBridge(tile, k, cx, cy, s, z) {
    const nb = E.neighbors(k).filter(n => S_.map.tiles[n] && E.TERRAIN[S_.map.tiles[n].t].land);
    let a = nb[0], b = nb[1], best = -1;
    for (const p of nb) for (const q of nb) { const d = E.dist(p, q); if (d > best) { best = d; a = p; b = q; } }
    if (!a || !b) return;
    const [ax, ay] = toScreen(tc[a].wx, tc[a].wy), [bx, by] = toScreen(tc[b].wx, tc[b].wy);
    const ang = Math.atan2(by - ay, bx - ax), len = s * 1.9, wd = s * 0.42;
    ctx.save(); ctx.translate(cx, cy - 6 * z); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-len / 2, -wd / 2 + 6 * z, len, wd);
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-len / 2, -wd / 2, len, wd);
    ctx.fillStyle = '#9b7650';
    for (let x = -len / 2 + 2 * z; x < len / 2; x += 6 * z) ctx.fillRect(x, -wd / 2 + 1 * z, 4 * z, wd - 2 * z);
    ctx.fillStyle = bridgeCol(tile); ctx.fillRect(-len / 2, -wd / 2 - 2 * z, len, 2.5 * z); ctx.fillRect(-len / 2, wd / 2 - 0.5 * z, len, 2.5 * z);
    for (let x = -len / 2; x <= len / 2; x += len / 4) { ctx.fillStyle = '#4b3826'; ctx.fillRect(x - 1.5 * z, -wd / 2 - 3 * z, 3 * z, wd + 6 * z); }
    ctx.restore();
  }
  function bridgeCol(tile) { const p = tile.owner && S_.players.find(pl => pl.id === tile.owner); return p ? p.color : '#5a4630'; }
  function drawRig(cx, cy, z, v, owner) {
    const x = cx + 6 * z, y = cy - 2 * z;
    const op = owner && S_.players.find(p => p.id === owner), oc = op ? op.color : null;
    // an owned rig sits in a ring of its owner's colour
    if (oc) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = oc; ctx.beginPath(); ctx.ellipse(x, y + 5 * z, 15 * z, 6 * z, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = oc; ctx.lineWidth = 1.6 * z; ctx.stroke(); ctx.restore(); }
    ctx.strokeStyle = '#2b3138'; ctx.lineWidth = 2 * z;
    for (const dx of [-7, 7]) { ctx.beginPath(); ctx.moveTo(x + dx * z, y); ctx.lineTo(x + dx * z, y + 7 * z); ctx.stroke(); }
    ctx.fillStyle = '#59626d'; ctx.fillRect(x - 10 * z, y - 4 * z, 20 * z, 5 * z);
    ctx.fillStyle = oc || '#c9a53a'; ctx.fillRect(x - 10 * z, y - 4 * z, 20 * z, oc ? 2.2 * z : 1.5 * z);
    ctx.strokeStyle = '#8e98a3'; ctx.lineWidth = 1.4 * z;
    ctx.beginPath(); ctx.moveTo(x - 4 * z, y - 4 * z); ctx.lineTo(x, y - 20 * z); ctx.lineTo(x + 4 * z, y - 4 * z); ctx.moveTo(x - 2.5 * z, y - 10 * z); ctx.lineTo(x + 2.5 * z, y - 10 * z); ctx.stroke();
    const f = 0.7 + 0.3 * Math.sin(t * 9 + v * 20);
    ctx.fillStyle = `rgba(255,${150 + 60 * f | 0},40,.9)`; ctx.beginPath(); ctx.ellipse(x + 7 * z, y - 9 * z - f * 2 * z, 2 * z, 3.5 * z * f, 0, 0, Math.PI * 2); ctx.fill();
    if (oc) {
      // owner's flag on the derrick
      const fx0 = x - 1 * z, fy = y - 20 * z;
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.1 * z; ctx.beginPath(); ctx.moveTo(fx0, fy); ctx.lineTo(fx0, fy - 7 * z); ctx.stroke();
      ctx.fillStyle = oc; ctx.beginPath(); ctx.moveTo(fx0, fy - 7 * z);
      for (let i = 0; i <= 4; i++) ctx.lineTo(fx0 + i * 2.2 * z, fy - 7 * z + Math.sin(t * 6 + i * 0.9 + v * 9) * 1.1 * z);
      for (let i = 4; i >= 0; i--) ctx.lineTo(fx0 + i * 2.2 * z, fy - 3 * z + Math.sin(t * 6 + i * 0.9 + v * 9) * 1.1 * z);
      ctx.fill();
    }
  }
  // a river hex is open water: ripples drift across it toward the hex it drains into
  function drawRiver(k, tile, cx, cy, z, s, flow) {
    const a = tile.flow && tc[tile.flow];
    let dx = 1, dy = 0;
    if (a) { const [nx, ny] = toScreen(a.wx, a.wy - a.h * (S / 34)); const l = Math.hypot(nx - cx, ny - cy) || 1; dx = (nx - cx) / l; dy = (ny - cy) / l; }
    ctx.save(); hexPath(cx, cy, s * 0.96); ctx.clip();
    if (!flow) {
      // banks: a darker rim so the channel reads as sunk into the land
      ctx.strokeStyle = 'rgba(10,30,45,.45)'; ctx.lineWidth = 5 * z; hexPath(cx, cy, s * 0.96); ctx.stroke();
      ctx.restore(); return;
    }
    const v = tc[k] ? tc[k].v : 0.5;
    ctx.strokeStyle = 'rgba(190,235,255,.55)'; ctx.lineWidth = 1.6 * z; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const ph = ((t * 0.35 + i / 4 + v) % 1), off = (i - 1.5) * 7 * z;
      const px = cx - dx * s * 0.8 + dx * ph * s * 1.6 - dy * off, py = cy - dy * s * 0.8 * TILT + dy * ph * s * 1.6 * TILT + dx * off * TILT;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
      ctx.beginPath(); ctx.moveTo(px - dx * 5 * z, py - dy * 5 * z * TILT); ctx.lineTo(px + dx * 5 * z, py + dy * 5 * z * TILT); ctx.stroke();
    }
    ctx.restore();
  }
  function decorate(tile, c, cx, cy, s, z) {
    const v = c.v;
    if (tile.t === 'forest') {
      ctx.save(); if (c.owned) ctx.globalAlpha = 0.55;
      for (const [ox, oy, sz] of [[-0.3, 0.0, 0.75], [0.28, -0.12, 0.65], [0.05, 0.25, 0.8]]) {
        if (sz === 0.65 && v < 0.5) continue;
        const x = cx + ox * s, y = cy + oy * s * TILT * 1.6, hh = 16 * z * sz;
        const sway = Math.sin(t * 1.3 + c.q + ox * 3) * 1.2 * z;
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y, 6 * z * sz, 2.5 * z * sz, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.dark; ctx.beginPath(); ctx.moveTo(x + sway, y - hh); ctx.lineTo(x + 6.5 * z * sz, y); ctx.lineTo(x - 6.5 * z * sz, y); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(x + sway, y - hh); ctx.lineTo(x - 6.5 * z * sz, y); ctx.lineTo(x - 1 * z, y); ctx.fill();
      }
      ctx.restore();
    } else if (tile.t === 'hills') {
      // rolling highland mounds with a lit crest, a shadowed flank and a few rocks
      const mounds = c.v > 0.5 ? [[-0.24, 0.08, 0.42, 0.95], [0.22, -0.02, 0.36, 0.8]] : [[0.18, 0.06, 0.44, 1], [-0.26, -0.04, 0.32, 0.75]];
      for (const [ox, oy, rw, hgt] of mounds) {
        const x = cx + ox * s, y = cy + oy * s * TILT + 4 * z, w = rw * s, hh = 13 * z * hgt;
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x + 2 * z, y + 1 * z, w, w * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.side1; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.15, y - hh * 2, x + w, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.light; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.35, y - hh * 2.05, x + w * 0.2, y - hh * 0.55); ctx.quadraticCurveTo(x - w * 0.3, y - hh * 0.2, x - w, y); ctx.fill();
      }
      if (!c.owned) { ctx.fillStyle = 'rgba(40,36,30,.55)'; for (let i = 0; i < 3; i++) { const rx = cx + (hash(c.q + i * 3, c.r) - 0.5) * s * 0.8, ry = cy + (hash(c.q, c.r + i * 5) - 0.3) * s * 0.3 + 6 * z; ctx.beginPath(); ctx.ellipse(rx, ry, 2.4 * z, 1.5 * z, 0, 0, Math.PI * 2); ctx.fill(); } }
    } else if (tile.t === 'canyon') {
      // red mesas: stacked flat-topped buttes with sediment stripes
      const butte = (ox, oy, w, h, col) => {
        const x = cx + ox * s, y = cy + oy * s * TILT;
        prism(x, y, w * s, h * z, col[0], col[1], col[2]);
      };
      const top = c.light, sideA = c.side1, sideB = c.side2;
      butte(-0.2, 0.05, 0.34, 9, [top, sideA, sideB]);
      butte(0.24, -0.06, 0.26, 6, [top, sideA, sideB]);
      ctx.strokeStyle = 'rgba(255,220,180,.18)'; ctx.lineWidth = 1.2 * z;
      for (let i = 0; i < 3; i++) { const y = cy + (2 + i * 4) * z; ctx.beginPath(); ctx.moveTo(cx - s * 0.48, y + (i % 2) * 2 * z); ctx.lineTo(cx + s * 0.48, y - (i % 2) * 2 * z); ctx.stroke(); }
    } else if (tile.t === 'mountain') {
      drawMountain(c, cx, cy, s, z);
    } else if (tile.t === 'desert') {
      // dunes
      ctx.strokeStyle = 'rgba(255,240,200,.28)'; ctx.lineWidth = 1.6 * z;
      for (let i = 0; i < 2; i++) { const y = cy + (i * 7 - 3 + (v - 0.5) * 4) * z; ctx.beginPath(); ctx.moveTo(cx - s * 0.45, y); ctx.quadraticCurveTo(cx - s * 0.1, y - 5 * z, cx + s * 0.1, y); ctx.quadraticCurveTo(cx + s * 0.3, y + 4 * z, cx + s * 0.45, y - 1 * z); ctx.stroke(); }
      if (v > 0.75 && !tile.struct) { ctx.fillStyle = c.owned ? 'rgba(0,0,0,.25)' : '#5f7a3d'; const x = cx + s * 0.25; ctx.fillRect(x - 1.5 * z, cy - 12 * z, 3 * z, 12 * z); ctx.fillRect(x - 5 * z, cy - 8 * z, 2.5 * z, 5 * z); ctx.fillRect(x + 2.5 * z, cy - 10 * z, 2.5 * z, 5 * z); }
    } else if (tile.t === 'jungle') {
      ctx.save(); if (c.owned) ctx.globalAlpha = 0.55;
      for (const [ox, oy, sz] of [[-0.32, 0.05, 0.9], [0.25, -0.1, 0.8], [0.02, 0.28, 1]]) {
        const x = cx + ox * s, y = cy + oy * s * TILT * 1.6, sway = Math.sin(t * 1.1 + c.q + ox * 3) * 1.5 * z;
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y, 7 * z * sz, 2.6 * z * sz, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a3423'; ctx.fillRect(x - 1 * z, y - 11 * z * sz, 2 * z, 11 * z * sz);
        ctx.fillStyle = c.dark;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.6; ctx.beginPath(); ctx.ellipse(x + sway + Math.cos(a) * 4.5 * z * sz, y - 12 * z * sz + Math.sin(a) * 2 * z * sz, 5.5 * z * sz, 2 * z * sz, a, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    } else if (tile.t === 'tundra') {
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 4; i++) { const x = cx + (hash(c.q + i, c.r) - 0.5) * s * 0.9, y = cy + (hash(c.q, c.r + i) - 0.5) * s * 0.45; ctx.beginPath(); ctx.ellipse(x, y, 4 * z, 1.6 * z, 0, 0, Math.PI * 2); ctx.fill(); }
      if (v > 0.6 && !tile.struct) { ctx.save(); if (c.owned) ctx.globalAlpha = 0.5; const x = cx - s * 0.2, y = cy + 2 * z; ctx.fillStyle = '#3c5a4c'; ctx.beginPath(); ctx.moveTo(x, y - 13 * z); ctx.lineTo(x + 5 * z, y); ctx.lineTo(x - 5 * z, y); ctx.fill(); ctx.fillStyle = '#f2f6f8'; ctx.beginPath(); ctx.moveTo(x, y - 13 * z); ctx.lineTo(x + 2.4 * z, y - 7 * z); ctx.lineTo(x - 2.4 * z, y - 7 * z); ctx.fill(); ctx.restore(); }
    } else if (tile.t === 'swamp') {
      const a = 0.3 + 0.1 * Math.sin(t * 1.5 + v * 7);
      ctx.fillStyle = `rgba(70,110,95,${a})`;
      for (const [ox, oy, r] of [[-0.25, 0.05, 0.22], [0.2, -0.08, 0.17], [0.08, 0.22, 0.14]]) { ctx.beginPath(); ctx.ellipse(cx + ox * s, cy + oy * s * TILT, r * s, r * s * TILT * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = c.owned ? 'rgba(0,0,0,.3)' : '#8a9a5a'; ctx.lineWidth = 1.3 * z;
      for (let i = 0; i < 4; i++) { const x = cx + (i - 1.5) * 6 * z + (v - 0.5) * 6 * z, y = cy + (i % 2 ? -4 : 5) * z; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1 * z, y - 7 * z); ctx.stroke(); }
    } else if (tile.t === 'plains' && v > 0.7 && !tile.struct && !c.owned) {
      ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 3; i++) ctx.fillRect(cx + (i - 1) * 7 * z + (v * 10 - 5) * z, cy + (i % 2) * 4 * z, 1.6 * z, 4 * z);
    }
    if (tile.bridge) drawBridge(tile, c.q + ',' + c.r, cx, cy, s, z);
    else if (tile.wreck) {
      // the stumps and twisted deck of a destroyed bridge
      ctx.save(); ctx.fillStyle = '#4a3d2c';
      for (const ox of [-0.38, 0.32]) { ctx.fillRect(cx + ox * s - 2.5 * z, cy - 4 * z, 5 * z, 8 * z); }
      ctx.translate(cx, cy); ctx.rotate(0.35); ctx.fillStyle = 'rgba(70,58,42,.85)'; ctx.fillRect(-0.3 * s, -1.5 * z, 0.32 * s, 3 * z); ctx.rotate(-0.8); ctx.fillRect(0.02 * s, -1.5 * z, 0.26 * s, 3 * z);
      ctx.restore();
    }
    if (tile.fish) {
      const bob = Math.sin(t * 2.4 + v * 9) * 1.5 * z, x = cx - 6 * z, y = cy + bob;
      ctx.strokeStyle = 'rgba(200,240,255,.35)'; ctx.lineWidth = 1.2 * z;
      for (let i = 0; i < 2; i++) { const r = ((t * 0.6 + v + i * 0.5) % 1) * 12 * z; ctx.globalAlpha = 1 - r / (12 * z); ctx.beginPath(); ctx.ellipse(x, y + 3 * z, r, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f1efe6'; ctx.fillRect(x - 0.8 * z, y - 9 * z, 1.6 * z, 10 * z);
      ctx.fillStyle = '#ff4f5e'; ctx.beginPath(); ctx.arc(x, y - 9 * z, 2.6 * z, 0, Math.PI * 2); ctx.fill();
      const jump = (t * 0.5 + v * 3) % 3;
      if (jump < 0.9) { const p = jump / 0.9, fx = cx + 6 * z + p * 10 * z, fy = cy + 2 * z - Math.sin(p * Math.PI) * 10 * z; ctx.save(); ctx.translate(fx, fy); ctx.rotate(-Math.cos(p * Math.PI) * 0.9); ctx.fillStyle = '#9fd9ff'; ctx.beginPath(); ctx.ellipse(0, 0, 3.2 * z, 1.4 * z, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-3 * z, 0); ctx.lineTo(-5.5 * z, -1.8 * z); ctx.lineTo(-5.5 * z, 1.8 * z); ctx.fill(); ctx.restore(); }
    }
    if (tile.res && tile.t === 'water') drawRig(cx, cy, z, v, tile.owner);
    else if (tile.res) {
      const bob = Math.sin(t * 2.2 + v * 6) * 2 * z, x = cx + s * 0.38, y = cy - 4 * z + bob;
      const gl = ctx.createRadialGradient(x, y, 0, x, y, 16 * z); gl.addColorStop(0, 'rgba(110,255,240,.55)'); gl.addColorStop(1, 'rgba(110,255,240,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 16 * z, y - 16 * z, 32 * z, 32 * z);
      ctx.fillStyle = '#9ffcf2'; ctx.beginPath(); ctx.moveTo(x, y - 9 * z); ctx.lineTo(x + 4.5 * z, y); ctx.lineTo(x, y + 4 * z); ctx.lineTo(x - 4.5 * z, y); ctx.fill();
      ctx.fillStyle = '#34c7c0'; ctx.beginPath(); ctx.moveTo(x, y - 9 * z); ctx.lineTo(x + 4.5 * z, y); ctx.lineTo(x, y + 4 * z); ctx.fill();
    }
    if (tile.poi && !(tile.poi === 'fort' && tile.owner)) {
      const bob = Math.sin(t * 2 + v * 6) * 1.6 * z, x = cx, y = cy - 14 * z + bob, col = POI_COL[tile.poi];
      const pulse = (tile.poi === 'relic' || tile.poi === 'cache' || tile.poi === 'ruins') ? 0.5 + 0.5 * Math.sin(t * 3 + v * 5) : 0.3;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, cy + 2 * z, 8 * z, 3 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.18 + pulse * 0.22; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, (12.5 + pulse * 2.5) * z, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#121820'; ctx.beginPath(); ctx.arc(x, y, 9.5 * z, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.arc(x, y, 9.5 * z, 0, Math.PI * 2); ctx.stroke();
      Art.drawIcon(ctx, 'poi', tile.poi, x, y, 6 * z, col);
      if (tile.gar && !tile.owner) {
        const lvl = tile.gar <= 4 ? 1 : tile.gar <= 7 ? 2 : 3;
        for (let i = 0; i < 3; i++) { const px = x + (i - 1) * 5 * z, py = y + 13 * z; ctx.fillStyle = i < lvl ? '#ff6a4a' : 'rgba(0,0,0,.55)'; ctx.strokeStyle = '#0b0f13'; ctx.lineWidth = 1.2 * z; ctx.beginPath(); ctx.arc(px, py, 2.1 * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      }
    }
    if (tile.contam) {
      const a = 0.4 + 0.3 * Math.sin(t * 3 + v * 9);
      ctx.save(); ctx.globalAlpha = a; Art.drawIcon(ctx, 'tactic', 'nuke', cx, cy, 9 * z, '#d9ff3b'); ctx.restore();
    }
    if (tile.smoke) { ctx.fillStyle = 'rgba(220,225,230,.35)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(cx + Math.sin(t * 0.8 + i * 1.3) * s * 0.4, cy + Math.cos(t * 0.6 + i) * s * 0.15 - 4 * z, (7 + i % 3 * 3) * z, 0, Math.PI * 2); ctx.fill(); } }
    if (S_.map.beacon && S_.map.beacon === c.q + ',' + c.r) {
      const g = ctx.createLinearGradient(0, cy - 140 * z, 0, cy); g.addColorStop(0, 'rgba(255,214,90,0)'); g.addColorStop(1, 'rgba(255,214,90,.55)');
      ctx.fillStyle = g; ctx.fillRect(cx - 7 * z, cy - 140 * z, 14 * z, 140 * z);
      ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.ellipse(cx, cy, s * (0.5 + 0.1 * Math.sin(t * 3)), s * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawMini(st, x, y, z) {
    const p = S_.players.find(pl => pl.id === st.owner);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#10161c'; ctx.beginPath(); ctx.arc(0, 0, 7.5 * z, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p ? p.color : '#ccc'; ctx.lineWidth = 1.8 * z; ctx.stroke();
    Art.drawIcon(ctx, 'struct', st.type, 0, 0, 4.8 * z, '#f1efe6');
    if ((st.lvl || 1) > 1) { ctx.fillStyle = '#ffc53d'; ctx.font = `900 ${7 * z}px "Chakra Petch",sans-serif`; ctx.textAlign = 'center'; ctx.fillText('★'.repeat(st.lvl), 0, 12 * z); }
    ctx.restore();
  }
  function drawStruct(tile, cx, cy, z, k) {
    const p = S_.players.find(pl => pl.id === tile.struct.owner);
    const col = p ? p.color : '#ccc';
    const type = tile.struct.type;
    const big = type === 'hq' ? 1.5 : 1;
    const x = cx, y = cy - 4 * z;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 6 * z, 15 * z * big, 5 * z * big, 0, 0, Math.PI * 2); ctx.fill();
    // plinth
    ctx.save(); ctx.translate(x, y - 8 * z * big);
    ctx.fillStyle = '#10161c'; ctx.beginPath(); ctx.arc(0, 0, 12.5 * z * big, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2.5 * z; ctx.stroke();
    const building = !!tile.struct.lock;   // new FOB, or a captured FOB/Port: comes online next turn
    if (building) { ctx.save(); ctx.globalAlpha = 0.38; }
    Art.drawIcon(ctx, 'struct', type, 0, 0, 8 * z * big, '#f1efe6');
    if (building) {
      ctx.restore();
      // hazard ring
      ctx.lineWidth = 3.2 * z; ctx.setLineDash([4.5 * z, 4.5 * z]);
      ctx.strokeStyle = '#0b0f13'; ctx.lineDashOffset = -t * 14; ctx.beginPath(); ctx.arc(0, 0, 15.5 * z, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffc53d'; ctx.lineDashOffset = -t * 14 + 4.5 * z; ctx.beginPath(); ctx.arc(0, 0, 15.5 * z, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // crane: mast, jib, swinging hook
      const sw = Math.sin(t * 2.2) * 2.5 * z;
      ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 2 * z; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-17 * z, 10 * z); ctx.lineTo(-17 * z, -24 * z); ctx.lineTo(4 * z, -24 * z); ctx.stroke();
      ctx.lineWidth = 1.2 * z; ctx.beginPath(); ctx.moveTo(-17 * z, -18 * z); ctx.lineTo(-11 * z, -24 * z); ctx.moveTo(1 * z, -24 * z); ctx.lineTo(1 * z + sw, -14 * z); ctx.stroke();
      ctx.fillStyle = '#f1efe6'; ctx.fillRect(-2 * z + sw, -14 * z, 6 * z, 4 * z);
      // turns-left badge
      ctx.fillStyle = '#ffc53d'; ctx.strokeStyle = '#0b0f13'; ctx.lineWidth = 2 * z;
      ctx.beginPath(); ctx.arc(12 * z, -11 * z, 6.5 * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0b0f13'; ctx.font = `900 ${8.5 * z}px "Chakra Petch",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('1', 12 * z, -10.5 * z);
    }
    const L = tile.struct.lvl || 1;
    if (L > 1) {
      ctx.font = `900 ${9 * z}px "Chakra Petch",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3 * z; ctx.strokeStyle = '#0b0f13'; ctx.strokeText('★'.repeat(L), 0, 15 * z * big); ctx.fillStyle = '#ffc53d'; ctx.fillText('★'.repeat(L), 0, 15 * z * big);
    }
    ctx.restore();
    if (tile.struct.lock && z > 0.55) late.push(() => {
      const label = 'NEXT TURN';
      ctx.font = `800 ${7 * Math.min(1.25, Math.max(0.85, z))}px "Chakra Petch",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(label).width + 10 * z, ly = y + 13 * z;
      ctx.fillStyle = '#1d1404'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, ly - 6 * z, w, 12 * z, 4 * z) : ctx.rect(x - w / 2, ly - 6 * z, w, 12 * z); ctx.fill();
      ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 1.5 * z; ctx.stroke();
      ctx.fillStyle = '#ffc53d'; ctx.fillText(label, x, ly + 0.5 * z);
    });
    if (type === 'hq' && p) late.push(() => {
      const label = p.name.toUpperCase();
      ctx.font = `800 ${11 * Math.max(0.8, z)}px "Chakra Petch",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(label).width + 12 * z, ly = y - 46 * z;
      ctx.fillStyle = '#0a0e12'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, ly - 8 * z, w, 16 * z, 5 * z) : ctx.rect(x - w / 2, ly - 8 * z, w, 16 * z); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2 * z; ctx.stroke();
      ctx.fillStyle = col; ctx.fillText(label, x, ly + 0.5 * z);
    });
    if (type === 'hq') {
      // flag
      const fx0 = x + 14 * z, fy = y - 24 * z;
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.6 * z; ctx.beginPath(); ctx.moveTo(fx0, fy + 18 * z); ctx.lineTo(fx0, fy - 6 * z); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx0, fy - 6 * z);
      for (let i = 0; i <= 6; i++) ctx.lineTo(fx0 + i * 2.6 * z, fy - 6 * z + Math.sin(t * 6 + i * 0.9) * 1.6 * z);
      for (let i = 6; i >= 0; i--) ctx.lineTo(fx0 + i * 2.6 * z, fy + 3 * z + Math.sin(t * 6 + i * 0.9) * 1.6 * z);
      ctx.fill();
    }
    if (type === 'refinery' && Math.random() < 0.04) smoke([world(k).wx + 4, world(k).wy - world(k).h - 22], 1, 'rgba(180,180,180,');
  }

  // ── units ──
  function unitStacks() {
    const stacks = {};
    for (const id in S_.units) { const u = S_.units[id]; if (unitHidden.has(u.id) || unitPos[u.id]) continue; (stacks[u.hex] || (stacks[u.hex] = [])).push(u); }
    return stacks;
  }
  function strongest(units) { return units.slice().sort((a, b) => E.UNITS[b.type].cost - E.UNITS[a.type].cost)[0]; }

  // stack token: a team-coloured shield plate with a bold silhouette and a count
  function drawToken(x, y, units, owner, z, opts = {}) {
    const p = S_.players.find(pl => pl.id === owner); const col = p ? p.color : '#aaa';
    const top = strongest(units); const d = E.UNITS[top.type];
    const r = 15 * z * (opts.scale || 1);
    const air = units.every(u => E.UNITS[u.type].cls === 'air');
    const sea = units.every(u => E.UNITS[u.type].cls === 'sea');
    const bob = air ? Math.sin(t * 3 + x * 0.05) * 3 * z - 8 * z : sea ? Math.sin(t * 1.6 + x * 0.03) * 1.6 * z : 0;
    const exhausted = opts.exhausted;
    ctx.save();
    if (opts.ghost) ctx.globalAlpha = 0.5;
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x, y + 1 * z, r * 1.0, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    const ty = y - r * 0.95 + bob;
    const spr = tokenSprite(top.type, units.length, col, !!exhausted, r, z);
    { const a0 = ctx.globalAlpha; if (exhausted) ctx.globalAlpha = a0 * 0.6; ctx.drawImage(spr.cv, x - spr.ox, ty - spr.oy, spr.w, spr.h); ctx.globalAlpha = a0; }
    if (units.some(u => u.stun)) {
      // stunned: a slow cyan pulse and a lightning badge
      const pz = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.strokeStyle = `rgba(127,243,255,${0.45 + pz * 0.45})`; ctx.lineWidth = (1.5 + pz) * z; ctx.beginPath(); ctx.arc(x, ty, r + (3 + pz * 2) * z, 0, Math.PI * 2); ctx.stroke();
      const bx = x - r * 0.95, by = ty - r * 0.7;
      ctx.fillStyle = '#0b1a22'; ctx.beginPath(); ctx.arc(bx, by, 7 * z, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#7ff3ff'; ctx.lineWidth = 1.5 * z; ctx.stroke();
      ctx.fillStyle = '#7ff3ff'; ctx.beginPath(); ctx.moveTo(bx + 1 * z, by - 5 * z); ctx.lineTo(bx - 3 * z, by + 1 * z); ctx.lineTo(bx, by + 1 * z); ctx.lineTo(bx - 1 * z, by + 5 * z); ctx.lineTo(bx + 3 * z, by - 1 * z); ctx.lineTo(bx, by - 1 * z); ctx.closePath(); ctx.fill();
    }
    if (exhausted && !opts.ghost) {
      // spent: no unit in this stack can move or fire again this turn
      const bx = x - r * 0.95, by = ty + r * 0.55;
      ctx.fillStyle = '#20262c'; ctx.strokeStyle = '#0a0e12'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.arc(bx, by, 6.5 * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9aa4ad'; ctx.font = `800 ${8 * z}px "Chakra Petch",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('z', bx, by + 0.5 * z);
    }
    // ready marker: bouncing chevron
    if (opts.ready) {
      const cy2 = ty - r - 9 * z + Math.sin(t * 6) * 2.5 * z;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a0e12'; ctx.lineWidth = 2 * z;
      ctx.beginPath(); ctx.moveTo(x - 6 * z, cy2 - 4 * z); ctx.lineTo(x, cy2 + 2 * z); ctx.lineTo(x + 6 * z, cy2 - 4 * z); ctx.lineTo(x + 6 * z, cy2 - 1 * z); ctx.lineTo(x, cy2 + 5 * z); ctx.lineTo(x - 6 * z, cy2 - 1 * z); ctx.closePath(); ctx.stroke(); ctx.fill();
    }
    ctx.restore();
  }
  // cached token bodies, keyed by unit, stack size, colour, state and zoom (zoom is bucketed so sprites get reused)
  const sprites = new Map();
  function tokenSprite(type, n, col, exhausted, r, z) {
    const zb = Math.round(z * 20) / 20, key = type + '|' + Math.min(n, 99) + '|' + col + '|' + exhausted + '|' + zb + '|' + r.toFixed(1) + '|' + DPR;
    let sp = sprites.get(key);
    if (sp) return sp;
    if (sprites.size > 600) sprites.clear();
    const pad = 12 * z, w = r * 2 + pad * 2 + 10 * z, h = r * 2 + pad * 2 + 14 * z, ox = r + pad, oy = r + pad;
    const cv2 = document.createElement('canvas'); cv2.width = Math.ceil(w * DPR); cv2.height = Math.ceil(h * DPR);
    const c2 = cv2.getContext('2d'); c2.scale(DPR, DPR);
    const main = ctx; ctx = c2;
    const x = ox, ty = oy, d = E.UNITS[type];
    for (let i = Math.min(2, n - 1); i >= 1; i--) plate(x, ty + i * 4.5 * z, r, '#0a0e12', col, z, 2);
    plate(x, ty, r, exhausted ? mixHex(col, '#20262c', 0.55) : col, '#0a0e12', z, 3);
    ctx.fillStyle = 'rgba(8,12,16,.82)'; ctx.beginPath(); ctx.arc(x, ty, r * 0.66, 0, Math.PI * 2); ctx.fill();
    Art.drawIcon(ctx, 'unit', type, x, ty, r * 0.5, exhausted ? '#8a9299' : '#ffffff');
    if (d.rarity === 'legendary') { ctx.fillStyle = '#ffb52e'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5 * z; star(x, ty - r - 3 * z, 5.5 * z); ctx.stroke(); }
    if (n > 1) {
      const bx = x + r * 0.95, by = ty - r * 0.7;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0a0e12'; ctx.lineWidth = 2.5 * z;
      ctx.beginPath(); ctx.arc(bx, by, 8 * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0a0e12'; ctx.font = `800 ${11 * z}px "Chakra Petch",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, bx, by + 0.5 * z);
    }
    ctx = main;
    sp = { cv: cv2, ox, oy, w, h }; sprites.set(key, sp);
    return sp;
  }
  function plate(x, y, r, fill, stroke, z, w) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = w * z; ctx.stroke();
  }
  function mixHex(a, b, k) { return rgb(mix(hx(a), hx(b), k)); }
  function star(x, y, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }

  function drawUnits() {
    const z = cam.z;
    const stacks = unitStacks();
    const list = Object.keys(stacks).map(k => ({ k, units: stacks[k], wy: tc[k] ? tc[k].wy : 0 })).sort((a, b) => a.wy - b.wy);
    for (const st of list) {
      const [wx, wy] = topOf(st.k); const [x, y] = toScreen(wx, wy);
      const hasStruct = S_.map.tiles[st.k] && S_.map.tiles[st.k].struct;
      const own = st.units[0].owner === ov.me;
      const ready = own && ov.myTurn && st.units.some(u => E.canAct(S_, u) && (E.moveAllow(S_, u) > 0 || E.UNITS[u.type].range));
      const exhausted = own && ov.myTurn && !ready;
      if (ov.troops) {
        // troops view: owner halo plus the stack's total attack / defence
        const op = S_.players.find(p => p.id === st.units[0].owner), col = op ? op.color : '#aaa';
        ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y + 4 * z, 20 * z, 9 * z, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        drawToken(x, y, st.units, st.units[0].owner, z, { ready, exhausted });
        const atk = st.units.reduce((a, u) => a + E.UNITS[u.type].atk, 0), def = st.units.reduce((a, u) => a + E.UNITS[u.type].def, 0);
        const label = '⚔' + atk + ' 🛡' + def;
        ctx.font = `800 ${Math.max(9, 10 * z)}px "Chakra Petch",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(label).width + 10, ly = y + 22 * z;
        ctx.fillStyle = 'rgba(8,12,18,.92)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, ly - 8, w, 16, 5) : ctx.rect(x - w / 2, ly - 8, w, 16); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(label, x, ly + 0.5);
        continue;
      }
      const planned = own && ov.planHexes && ov.planHexes.has(st.k);
      if (planned) {
        // queued in the blueprint: a light-blue dashed ring under the stack
        ctx.save(); ctx.strokeStyle = '#8fdcff'; ctx.lineWidth = 2.5 * z; ctx.setLineDash([5 * z, 4 * z]); ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); ctx.ellipse(x, y + 2 * z, 21 * z, 9 * z, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      drawToken(x + (hasStruct ? 12 * z : 0), y + (hasStruct ? 6 * z : 0), st.units, st.units[0].owner, z, { ready, exhausted: exhausted && !planned, planned });
    }
    // animated units
    const moving = {};
    for (const id in unitPos) { const u = S_.units[id] || extraUnits.find(e => e.id == id); if (!u) continue; const p = unitPos[id]; const kk = Math.round(p.x) + ':' + Math.round(p.y) + ':' + u.owner; (moving[kk] || (moving[kk] = { p, units: [], owner: u.owner })).units.push(u); }
    for (const kk in moving) { const m = moving[kk]; const [x, y] = toScreen(m.p.x, m.p.y); drawToken(x, y, m.units, m.owner, z, { scale: m.p.s || 1 }); }
  }

  function drawPath(path, color, dashed, alpha = 1) {
    if (!path || path.length < 2) return;
    const z = cam.z;
    const pts = path.map(k => { const [x, y] = topOf(k); return toScreen(x, y - 8); });
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 7 * z; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1] + 2) : ctx.moveTo(p[0], p[1] + 2)); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 4 * z; if (dashed) { ctx.setLineDash([9 * z, 7 * z]); ctx.lineDashOffset = -t * 40; }
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]);
    const a = pts[pts.length - 2], b = pts[pts.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(b[0] + Math.cos(ang) * 6 * z, b[1] + Math.sin(ang) * 6 * z);
    ctx.lineTo(b[0] + Math.cos(ang + 2.5) * 12 * z, b[1] + Math.sin(ang + 2.5) * 12 * z); ctx.lineTo(b[0] + Math.cos(ang - 2.5) * 12 * z, b[1] + Math.sin(ang - 2.5) * 12 * z); ctx.fill();
    ctx.restore();
  }

  function drawProbs() {
    if (!ov.probs) return;
    const z = cam.z;
    for (const k in ov.probs) {
      const p = ov.probs[k]; const [x, y] = screenOf(k);
      const txt = Math.round(p * 100) + '%';
      const col = p >= 0.66 ? '#59f08a' : p >= 0.4 ? '#ffc53d' : '#ff4f5e';
      ctx.font = `800 ${12 * z}px "Chakra Petch",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(txt).width + 10 * z;
      ctx.fillStyle = '#0b0f13'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y + 8 * z, w, 16 * z, 8 * z) : ctx.rect(x - w / 2, y + 8 * z, w, 16 * z); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5 * z; ctx.stroke();
      ctx.fillStyle = col; ctx.fillText(txt, x, y + 16.5 * z);
    }
  }

  // ── weather: snow flakes in depth layers with gusts and a frosty vignette; slanted rain with lightning ──
  const wxParts = []; let wxKind = null, frost = null, frostKey = '';
  function wxSpawn(kind, anywhere) {
    const z = 0.25 + Math.random() * 0.75;
    return kind === 'snow'
      ? { x: Math.random() * (W + 200) - 100, y: anywhere ? Math.random() * H : -10 - Math.random() * 40, z, r: 0.8 + z * 2.6, vy: 18 + z * 55, ph: Math.random() * 6.28, f: 0.6 + Math.random() * 1.4, a: 0.35 + z * 0.55 }
      : { x: Math.random() * (W + 300) - 150, y: anywhere ? Math.random() * H : -20 - Math.random() * 60, z, len: 8 + z * 18, vy: 520 + z * 520, a: 0.18 + z * 0.35 };
  }
  function drawWeather(dt) {
    const id = S_ && S_.phase === 'play' && S_.weather && S_.weather.id;
    const kind = id === 'blizzard' ? 'snow' : (id === 'storm' || id === 'seas') ? 'rain' : null;
    if (kind !== wxKind) { wxParts.length = 0; wxKind = kind; }
    if (!kind) return;
    const target = Math.round(W * H / (kind === 'snow' ? 4200 : 5200));
    while (wxParts.length < target) wxParts.push(wxSpawn(kind, true));
    const gust = Math.sin(t * 0.33) * 0.7 + Math.sin(t * 1.27 + 1) * 0.3;
    if (kind === 'snow') {
      for (let i = 0; i < wxParts.length; i++) {
        const p = wxParts[i];
        p.y += p.vy * dt; p.x += (gust * 70 + Math.sin(t * p.f + p.ph) * 16) * p.z * dt;
        if (p.y > H + 12 || p.x < -120 || p.x > W + 120) { wxParts[i] = wxSpawn('snow', false); continue; }
        if (p.z > 0.7) { ctx.fillStyle = `rgba(235,245,255,${p.a * 0.22})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = `rgba(245,250,255,${p.a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      const k = W + 'x' + H;
      if (frostKey !== k) { frostKey = k; frost = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); frost.addColorStop(0, 'rgba(220,235,250,0)'); frost.addColorStop(1, 'rgba(220,235,250,.22)'); }
      ctx.fillStyle = frost; ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = 'rgba(10,18,30,.18)'; ctx.fillRect(0, 0, W, H);
      const wind = 0.28 + gust * 0.12;
      ctx.lineCap = 'round';
      for (let i = 0; i < wxParts.length; i++) {
        const p = wxParts[i];
        p.y += p.vy * dt; p.x += p.vy * wind * dt;
        if (p.y > H + 20 || p.x > W + 160) { wxParts[i] = wxSpawn('rain', false); continue; }
        ctx.strokeStyle = `rgba(185,210,240,${p.a})`; ctx.lineWidth = 0.6 + p.z * 1.1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len * wind, p.y - p.len); ctx.stroke();
      }
      if (id === 'storm' && Math.random() < dt * 0.06) { fx.flash = 0.35; fx.flashCol = '#dfe9ff'; }
    }
  }
  function drawFx(dt) {
    const z = cam.z;
    for (let i = fx.parts.length - 1; i >= 0; i--) {
      const p = fx.parts[i]; p.life += dt; if (p.life > p.max) { fx.parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985;
      const [x, y] = toScreen(p.x, p.y), k = 1 - p.life / p.max;
      if (p.smoke) { ctx.fillStyle = p.smoke + (k * 0.35) + ')'; ctx.beginPath(); ctx.arc(x, y, p.sz * z * (1.6 - k * 0.6), 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, k * 1.6); const sz = p.sz * z * (0.4 + k * 0.6); if (p.sq) { ctx.save(); ctx.translate(x, y); ctx.rotate(p.life * 8); ctx.fillRect(-sz, -sz, sz * 2, sz * 2); ctx.restore(); } else { ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
    }
    for (let i = fx.rings.length - 1; i >= 0; i--) {
      const r = fx.rings[i], p = (t - r.t0) / r.dur; if (p >= 1) { fx.rings.splice(i, 1); continue; }
      const [x, y] = toScreen(r.x, r.y), e = 1 - Math.pow(1 - p, 3);
      ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = r.w * z * (1 - p) + 1;
      ctx.beginPath(); ctx.ellipse(x, y, r.r1 * e * z, r.r1 * e * z * TILT, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (let i = fx.emps.length - 1; i >= 0; i--) {
      const e = fx.emps[i], p = (t - e.t0) / e.dur; if (p >= 1) { fx.emps.splice(i, 1); continue; }
      const [x, y] = toScreen(e.b[0], e.b[1] - 4), ease = 1 - Math.pow(1 - p, 3), R = (12 + ease * S * 1.9) * z, fade = 1 - p;
      ctx.save();
      // soft charged dome
      const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, `rgba(170,250,255,${0.35 * fade})`); g.addColorStop(0.7, `rgba(80,220,255,${0.18 * fade})`); g.addColorStop(1, 'rgba(80,220,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, R, R * TILT * 1.15, 0, 0, Math.PI * 2); ctx.fill();
      // the shock front
      ctx.strokeStyle = `rgba(190,250,255,${fade})`; ctx.lineWidth = (2 + 4 * fade) * z; ctx.beginPath(); ctx.ellipse(x, y, R, R * TILT * 1.15, 0, 0, Math.PI * 2); ctx.stroke();
      // crackling arcs: they re-strike ~12 times a second (not every frame), so they read as lightning rather than noise
      const step = Math.floor((t - e.t0) * 12);
      ctx.strokeStyle = `rgba(220,255,255,${0.9 * fade})`; ctx.lineWidth = 1.6 * z; ctx.shadowBlur = 0;
      for (let a = 0; a < 7; a++) {
        const h = n => { const v = Math.sin(n * 12.9898 + step * 78.233 + a * 37.719) * 43758.5453; return v - Math.floor(v); };
        const ang = a / 7 * Math.PI * 2 + h(1) * 0.6;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let j = 1; j <= 5; j++) { const rr = R * j / 5, off = (h(j + 2) - 0.5) * 0.45; ctx.lineTo(x + Math.cos(ang + off) * rr, y + Math.sin(ang + off) * rr * TILT * 1.15); }
        ctx.stroke();
      }
      ctx.restore();
    }
    for (let i = fx.lances.length - 1; i >= 0; i--) {
      const l = fx.lances[i], p = (t - l.t0) / l.dur; if (p >= 1) { fx.lances.splice(i, 1); continue; }
      const [x, y] = toScreen(l.b[0], l.b[1] - 6), drop = Math.min(1, p / 0.22), top = -40, bot = top + (y - top) * drop;
      const w = (p < 0.22 ? 3 : 3 + Math.sin(Math.min(1, (p - 0.22) / 0.78) * Math.PI) * 16) * z, a = p < 0.8 ? 1 : (1 - p) / 0.2;
      const g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, l.color); g.addColorStop(1, '#fff');
      ctx.save(); ctx.globalAlpha = a * 0.35; ctx.fillStyle = l.color; ctx.fillRect(x - w * 1.8, top, w * 3.6, bot - top);
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - w / 2, top, w, bot - top);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - w / 6, top, w / 3, bot - top);
      if (drop >= 1) { ctx.globalAlpha = a * 0.6; ctx.fillStyle = l.color; ctx.beginPath(); ctx.ellipse(x, y, w * 2.4, w * 2.4 * TILT, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    for (let i = fx.beams.length - 1; i >= 0; i--) {
      const b = fx.beams[i], p = Math.min(1, (t - b.t0) / b.dur);
      const xw = b.a[0] + (b.b[0] - b.a[0]) * p, yw = b.a[1] + (b.b[1] - b.a[1]) * p - Math.sin(p * Math.PI) * b.arc;
      const [x, y] = toScreen(xw, yw - 10);
      ctx.fillStyle = b.color; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, y, 8 * z, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 4 * z, 0, Math.PI * 2); ctx.fill();
      if (Math.random() < 0.6) fx.parts.push({ x: xw, y: yw - 10, vx: 0, vy: 0, life: 0, max: 0.35, col: b.color, sz: 2.5, g: 0 });
      if (p >= 1) { fx.beams.splice(i, 1); if (b.cb) b.cb(); }
    }
    for (let i = fx.floats.length - 1; i >= 0; i--) {
      const f = fx.floats[i], p = (t - f.t0) / f.dur; if (p >= 1) { fx.floats.splice(i, 1); continue; }
      const [x, y] = toScreen(f.x, f.y - p * 40);
      const sc = p < 0.15 ? 0.6 + p / 0.15 * 0.6 : 1.2 - Math.min(0.2, (p - 0.15));
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.rotate(Math.sin(t * 8 + f.t0) * 0.05);
      ctx.font = `900 ${f.size * Math.max(0.8, z)}px "Black Ops One","Chakra Petch",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 1;
      ctx.lineWidth = 5; ctx.strokeStyle = '#0b0f13'; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }

  // full-screen overlays hide the board, so don't burn the GPU redrawing it underneath them
  const COVERS = '#supply:not([hidden]), #crate:not([hidden]), #draft:not([hidden]), #index:not([hidden]), #passCover:not([hidden])';
  let coveredFrames = 0, covered = false, frameN = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if ((frameN++ & 7) === 0) covered = !!document.querySelector(COVERS);
    if (covered) { if (++coveredFrames > 2) { lastT = now; return; } } else coveredFrames = 0;
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0); lastT = now; t += dt;
    cam.x += (cam.tx - cam.x) * Math.min(1, dt * 8); cam.y += (cam.ty - cam.y) * Math.min(1, dt * 8); cam.z += (cam.tz - cam.z) * Math.min(1, dt * 10);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    let sx = 0, sy = 0;
    if (fx.shake > 0.1) { sx = (Math.random() - 0.5) * fx.shake; sy = (Math.random() - 0.5) * fx.shake; fx.shake *= Math.pow(0.02, dt); } else fx.shake = 0;
    const p0 = performance.now();
    if (!S_ || !S_.map) { const mk = W + 'x' + H + '|' + Math.floor(t * 4); if (mk !== menuKey) { menuKey = mk; bg(); } return; }
    if (Math.abs(cam.tx - cam.x) < 0.02) cam.x = cam.tx; if (Math.abs(cam.ty - cam.y) < 0.02) cam.y = cam.ty; if (Math.abs(cam.tz - cam.z) < 0.0005) cam.z = cam.tz;
    // terrain, background and fog live in an offscreen layer: redrawn only when the view or board changes,
    // while a fade/pop plays, or ~10x a second for ambient motion (water, sway, markers)
    const key = Math.round(cam.x * 4) + '|' + Math.round(cam.y * 4) + '|' + Math.round(cam.z * 2000) + '|' + W + '|' + H + '|' + DPR + '|' + stateVer + '|' + (ov.unsupplied ? ov.unsupplied.size : 0);
    // ambient motion refreshes the layer ~10x a second on fast machines; the slower the board is to draw,
    // the less often it refreshes (down to never), so weak laptops don't stutter on an idle board
    const ambient = layerCost < 5 ? 0.1 : layerCost < 12 ? 0.35 : layerCost < 25 ? 1.2 : Infinity;
    if (key !== layerKey || t < fadeUntil || Object.keys(fx.pops).length || t - layerT > ambient) {
      const lt0 = performance.now();
      const main = ctx; ctx = lctx;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      bg();
      for (const k of order) drawTile(k, 'base');
      if (S_.fogOn) for (const k of order) if (S_.map.tiles[k].fog === 1) drawFog(k);
      // labels go on top of every tile, so taller neighbours never cut them off
      for (const f of late) f(); late.length = 0;
      ctx = main; layerKey = key; layerT = t;
      const lc0 = performance.now() - lt0; layerCost = layerCost ? layerCost * 0.85 + lc0 * 0.15 : lc0;
    }
    ctx.drawImage(lc, sx, sy, W, H);
    ctx.translate(sx, sy);
    drawWaterGlints();
    const p1 = performance.now();
    for (const k of order) if (hasOverlay(k)) drawTile(k, 'overlay');
    for (const pa of ov.planArrows) drawPath(pa.path, pa.color, true, 0.85);
    if (ov.marches) for (const mo of ov.marches) {
      // standing march order: a long dashed line to a flag on the objective
      drawPath(E.line(mo.from, mo.to), '#7ff3ff', true, 0.6);
      const [fx, fy] = screenOf(mo.to), z = cam.z;
      ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.moveTo(fx, fy - 4 * z); ctx.lineTo(fx, fy - 26 * z); ctx.stroke();
      ctx.fillStyle = '#7ff3ff'; ctx.beginPath(); ctx.moveTo(fx, fy - 26 * z); ctx.lineTo(fx + 13 * z, fy - 21 * z); ctx.lineTo(fx, fy - 16 * z); ctx.fill();
    }
    if (ov.path) drawPath(ov.path, ov.pathColor || '#fff', false);
    const p2 = performance.now();
    if (ov.troops) {
      // hold Alt: everything but the armies fades out
      ctx.fillStyle = 'rgba(6,10,16,.74)'; ctx.fillRect(-sx - 20, -sy - 20, W + 40, H + 40);
    }
    drawUnits();
    const p3 = performance.now();
    drawAir();
    if (ov.planGhost) for (const g of ov.planGhost) { const [x, y] = screenOf(g.hex); if (g.units) drawToken(x, y, g.units, g.owner, cam.z, { ghost: true }); if (g.struct) { ctx.save(); ctx.globalAlpha = 0.5; Art.drawIcon(ctx, 'struct', g.struct, x, y - 12 * cam.z, 10 * cam.z, '#fff'); ctx.restore(); } }
    drawProbs();
    drawFx(dt);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawWeather(dt);
    if (fx.flash > 0.01) { ctx.fillStyle = fx.flashCol; ctx.globalAlpha = Math.min(1, fx.flash); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; fx.flash *= Math.pow(0.04, dt); }
    const p4 = performance.now(), a = 0.08;
    perf.tiles += ((p1 - p0) - perf.tiles) * a; perf.fog += ((p2 - p1) - perf.fog) * a; perf.units += ((p3 - p2) - perf.units) * a; perf.rest += ((p4 - p3) - perf.rest) * a; perf.total += ((p4 - p0) - perf.total) * a;
  }
  const perf = { tiles: 0, fog: 0, units: 0, rest: 0, total: 0 };

  return { invalidate, perf, flyover, init, setState, recolor, focus, fitMap, pan, zoomAt, hexAt, screenOf, topOf, world, ov, unitPos, unitHidden, extraUnits, burst, smoke, float, ring, beam, lance, emp, shake, flash, pop, cam, get time() { return t; }, get roads() { return roads; } };
})();
