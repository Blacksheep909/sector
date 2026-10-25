/* SECTOR — 2.5D hex board renderer */
const Render = (() => {
  const E = SectorEngine;
  let lowGfx = false; try { lowGfx = localStorage.getItem('sector.gfx') === 'low'; } catch (e) {}
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
  // the layer is drawn with a margin around the screen at one camera (lcam), then slid and scaled while you pan and zoom
  const cosOf = {}, hqOf = {}, terrBox = {};   // each commander's skins, where their HQ is, and the bounds of their land (a territory skin covers it all)
  let LM = 0, camMovedAt = 0, boardSig = ''; const lcam = { x: 0, y: 0, z: 1, w: 0, h: 0, whole: false }, lastCam = { x: 0, y: 0, z: 1 };
  const LAYER_MAX = 4096;   // device pixels per side: a whole map that fits is cached in one piece, so panning never redraws it
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
    const resize = () => { DPR = lowGfx ? 1 : Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px'; LM = Math.round(0.2 * Math.max(W, H)); layerKey = ''; };
    addEventListener('resize', resize); resize();
    requestAnimationFrame(loop);
  }

  function invalidate() { stateVer++; }
  function setState(s) {
    const fresh = !S_ || !s || !S_.map || S_.seed !== s.seed;
    S_ = s;
    if (!s) return;
    // the HUD hands the board over on every refresh: only recolour (and redraw the terrain layer) when what's drawn has changed
    let sig = s.players.map(p => p.id + p.color + p.alive + JSON.stringify(p.cos || '') + (p.hq || '')).join() + '|' + (s.map.beacon || '');
    for (const k in s.map.tiles) sig += JSON.stringify(s.map.tiles[k]);
    if (!fresh && sig === boardSig) return;
    boardSig = sig;
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
    for (const k in cosOf) delete cosOf[k]; for (const k in hqOf) delete hqOf[k];
    for (const k in terrBox) delete terrBox[k];
    for (const p of S_.players) { if (p.cos) cosOf[p.id] = p.cos; if (p.hq) hqOf[p.id] = p.hq; }
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
      if (owned && t.fog !== 2 && cosOf[t.owner] && cosOf[t.owner].territory) { const b = terrBox[t.owner] || (terrBox[t.owner] = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, tilt: TILT }); b.x0 = Math.min(b.x0, c.wx); b.x1 = Math.max(b.x1, c.wx); b.y0 = Math.min(b.y0, c.wy); b.y1 = Math.max(b.y1, c.wy); }
      c.owner = t.owner; c.oc = t.owner && pc[t.owner] && t.fog !== 2 ? rgb(shade(pc[t.owner], 0.45)) : null;
    }
    if (S_._sup) delete S_._sup;
    buildFrontiers();
    computeRoads();
    stateVer++;
  }
  // border auras animate every frame, so each commander who wears one gets their frontier as one path (in board units,
  // lifted to each hex's height), rebuilt only when the board changes
  const frontiers = {};
  function buildFrontiers() {
    for (const k in frontiers) delete frontiers[k];
    if (typeof Skins === 'undefined' || !Skins.frontier) return;
    const want = {}, hexes = {}; for (const pid in cosOf) if (cosOf[pid].border) { want[pid] = []; hexes[pid] = []; }
    if (!Object.keys(want).length) return;
    for (const k of order) {
      const t = S_.map.tiles[k], c = tc[k]; if (!t.owner || !want[t.owner] || !c.oc) continue;
      const nb = E.neighbors(k), wy = c.wy - c.h * (S / 34); hexes[t.owner].push({ wx: c.wx, wy });
      for (let i = 0; i < 6; i++) { const n = S_.map.tiles[nb[EDGE_DIR[i]]]; if (n && n.owner === t.owner) continue; want[t.owner].push({ wx: c.wx, wy, i }); }
    }
    for (const pid in want) if (want[pid].length) { frontiers[pid] = Skins.frontier(want[pid], TILT, undefined, hexes[pid]); frontiers[pid].col = (tc[order.find(k => S_.map.tiles[k].owner === pid && tc[k].oc)] || {}).oc || '#fff'; }
  }
  function drawAuras(glow) {
    const ids = Object.keys(frontiers); if (!ids.length) return;
    const z = cam.z, view = { x0: cam.x - W / 2 / z - 40, x1: cam.x + W / 2 / z + 40, y0: cam.y - H / 2 / z - 60, y1: cam.y + H / 2 / z + 40 };
    ctx.save(); ctx.transform(z, 0, 0, z, W / 2 - cam.x * z, H / 2 - cam.y * z);
    for (const pid of ids) { const F = frontiers[pid], cs = cosOf[pid]; if (!cs || !cs.border) continue; F.view = view; if (glow) Skins.auraGlow(ctx, cs.border, F, F.col); else Skins.aura(ctx, cs.border, F, t, F.col); }
    ctx.restore();
  }
  // roads: each commander's buildings are linked back to their HQ along the shortest route through their own land.
  // Recomputed from the board every time it changes, so a captured or cut-off hex breaks the road there.
  let roads = {};
  function computeRoads() {
    roads = {};
    const tiles = S_.map.tiles, link = (a, b) => { (roads[a] || (roads[a] = new Set())).add(b); (roads[b] || (roads[b] = new Set())).add(a); };
    for (const p of S_.players) {
      if (!p.alive || !p.hq || !tiles[p.hq] || tiles[p.hq].owner !== p.id) continue;
      const passable = k => { const t = tiles[k]; return t && t.owner === p.id && t.fog !== 2 && E.isLandTile(t) && t.t !== 'mountain' && (!t.river || t.bridge); };   // roads only cross rivers on a bridge
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
  // fit the whole board on screen; `pad` keeps it clear of the HUD (pixels from each edge)
  function fitMap(pad) {
    if (!S_) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const k of order) { const c = tc[k]; x0 = Math.min(x0, c.wx); x1 = Math.max(x1, c.wx); y0 = Math.min(y0, c.wy); y1 = Math.max(y1, c.wy); }
    const p = pad || { l: 0, r: 0, t: 60, b: 60 }, fw = Math.max(200, W - p.l - p.r), fh = Math.max(150, H - p.t - p.b);
    const z = Math.min(fw / (x1 - x0 + S * 3), fh / (y1 - y0 + S * 3));
    cam.tz = cam.z = Math.max(0.3, Math.min(1.6, z));
    // the board's centre lands in the middle of the free area, not of the whole screen
    cam.tx = cam.x = (x0 + x1) / 2 - (p.l - p.r) / 2 / cam.z; cam.ty = cam.y = (y0 + y1) / 2 - 10 - (p.t - p.b) / 2 / cam.z;
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
      planes.push({ x0: cx - dx * L - dy * side, y0: cy - dy * L + dx * side * 0.5, x1: cx + dx * L - dy * side, y1: cy + dy * L + dx * side * 0.5, alt, t0: t0 + i * 0.12, dur, color: opts.color || '#e9edf2', ang, down: i === 0 ? opts.downAt : null });
    }
    // bombs leave the lead plane as it passes over each target, in flight order (a plane that gets shot down drops none)
    if (!opts.noBombs) pts.slice().sort((a, b) => (a[0] - cx) * dx + (a[1] - cy) * dy - ((b[0] - cx) * dx + (b[1] - cy) * dy)).forEach((p, i) => {
      const along = ((p[0] - cx) * dx + (p[1] - cy) * dy + L) / (2 * L);   // 0..1 along the path
      const tDrop = t0 + along * dur - 0.32 + i * 0.03;
      bombs.push({ tx: p[0], ty: p[1], tDrop, fall: 0.42, alt, colors: opts.colors });
      // the bang (sound, shake) runs on the clock, not the render loop: the loop pauses under full-screen panels and in background tabs
      if (opts.onBomb) setTimeout(opts.onBomb, Math.max(0, (tDrop + 0.42 - t) * 1000));
    });
  }
  // a swept-wing strike jet seen from above, facing +x, s = half its length
  function jet(s, fill, ink) {
    const P = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)); ctx.closePath(); };
    const wing = m => P([[0.28, 0.09 * m], [-0.32, 0.78 * m], [-0.56, 0.8 * m], [-0.3, 0.1 * m]]);
    const fin = m => P([[-0.62, 0.08 * m], [-0.92, 0.4 * m], [-1.04, 0.4 * m], [-0.9, 0.07 * m]]);
    const body = () => P([[1.05, 0], [0.78, -0.09], [0.2, -0.12], [-0.85, -0.1], [-1.02, -0.06], [-1.02, 0.06], [-0.85, 0.1], [0.2, 0.12], [0.78, 0.09]]);
    const parts = [() => wing(1), () => wing(-1), () => fin(1), () => fin(-1), body];
    ctx.lineJoin = 'round';
    if (ink) { ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.5, s * 0.16); for (const f of parts) { f(); ctx.stroke(); } }
    ctx.fillStyle = fill; for (const f of parts) { f(); ctx.fill(); }
    if (ink) {
      ctx.fillStyle = 'rgba(255,255,255,.28)'; P([[1.0, 0], [0.2, -0.06], [-0.85, -0.05], [-0.85, 0], [0.2, 0]]); ctx.fill();   // light along the spine
      ctx.fillStyle = '#16324a'; ctx.beginPath(); ctx.ellipse(0.55 * s, 0, 0.17 * s, 0.06 * s, 0, 0, Math.PI * 2); ctx.fill();   // canopy
    }
  }
  // ── guided missiles: a fast dart with a white smoke trail that hangs in the air after it hits ──
  // a, b: hex keys or world points; alt0/alt1: height at launch and at the end; loft: extra height mid-flight.
  // stopAt (0..1) makes it burst early (an interception in mid-air); onHit fires on the clock when it gets there
  const missiles = [];
  const ptOf = k => Array.isArray(k) ? k : topOf(k);
  function missilePos(m, p) {
    const e = Math.pow(p, m.accel), [ax, ay] = m.a, [bx, by] = m.b;
    return [ax + (bx - ax) * e, ay + (by - ay) * e - (m.alt0 + (m.alt1 - m.alt0) * e + Math.sin(Math.PI * e) * m.loft)];
  }
  function missile(a, b, opts = {}) {
    const m = { a: ptOf(a), b: ptOf(b), alt0: opts.alt0 ?? 12, alt1: opts.alt1 ?? 0, loft: opts.loft ?? 18, accel: opts.accel ?? 1.5, t0: t + (opts.delay || 0), dur: opts.dur || 0.55, stop: opts.stopAt || 1, color: opts.color || '#ffffff', size: opts.size || 1, trail: [], boom: opts.boom !== false, gone: null };
    missiles.push(m);
    if (opts.onHit) setTimeout(opts.onHit, Math.max(0, (m.t0 + m.dur * m.stop - t) * 1000));
    return m;
  }
  // where a missile fired with these options will be at fraction p of its flight (to aim interceptors at it)
  function missileAt(a, b, opts = {}, p = 1) { return missilePos({ a: ptOf(a), b: ptOf(b), alt0: opts.alt0 ?? 12, alt1: opts.alt1 ?? 0, loft: opts.loft ?? 18, accel: opts.accel ?? 1.5 }, p); }
  // a little arrowhead of a missile, facing +x
  function dart(s, fill) {
    ctx.fillStyle = '#0b0f13'; ctx.beginPath(); ctx.moveTo(s * 1.25, 0); ctx.lineTo(-s, -s * 0.42); ctx.lineTo(-s, s * 0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.8, -s * 0.24); ctx.lineTo(-s * 0.8, s * 0.24); ctx.closePath(); ctx.fill();
  }
  function drawMissiles() {
    const z = cam.z;
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i], p = (t - m.t0) / m.dur;
      if (p < 0) continue;
      if (!m.gone) {
        const q = Math.min(p, m.stop), [x, y] = missilePos(m, q);
        m.trail.push([x, y, t]);
        if (Math.random() < 0.7) fx.parts.push({ x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 8, vy: -4 - Math.random() * 6, life: 0, max: 0.9 + Math.random() * 0.5, col: null, smoke: 'rgba(235,240,245,', sa: 0.5, sz: 2.2 + Math.random() * 1.6, g: -6 });
        if (p >= m.stop) {
          m.gone = t;
          if (m.boom) { burst([x, y], ['#fff', '#ffd27a', '#ff8a3a', '#9aa4ad'], 16, { speed: 1.1, size: 2.6, up: 40, g: 120 }); ring([x, y], '#fff', 34, 0.35, 3); }
        } else {
          // the dart, nose along its flight on screen, with a hot exhaust
          const [px, py] = missilePos(m, Math.max(0, q - 0.03)), [sx, sy] = toScreen(x, y), [ox, oy] = toScreen(px, py), head = Math.atan2(sy - oy, sx - ox);
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(head);
          ctx.fillStyle = 'rgba(255,190,90,.85)'; ctx.beginPath(); ctx.ellipse(-6 * z * m.size, 0, 4 * z * m.size, 2 * z * m.size, 0, 0, Math.PI * 2); ctx.fill();
          dart(4.2 * z * m.size, m.color); ctx.restore();
        }
      }
      // the trail: a crisp white line that thins and fades from the tail
      const life = 1.1, tr = m.trail;
      while (tr.length && t - tr[0][2] > life) tr.shift();
      if (tr.length > 1) {
        ctx.lineCap = 'round';
        for (let j = 1; j < tr.length; j++) {
          const k = 1 - (t - tr[j][2]) / life; if (k <= 0) continue;
          const [x0, y0] = toScreen(tr[j - 1][0], tr[j - 1][1]), [x1, y1] = toScreen(tr[j][0], tr[j][1]);
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * k).toFixed(3) + ')'; ctx.lineWidth = (1 + 2.2 * k) * z * m.size;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
      }
      if (m.gone && !tr.length) missiles.splice(i, 1);
    }
  }
  // ── kamikaze drones: a delta-wing drone cruises in low, noses over and dives into the target ──
  const drones = [];
  function drone(k, opts = {}) {
    const b = ptOf(k), ang = opts.angle ?? (Math.PI + (Math.random() - 0.5) * 1.2), dx = Math.cos(ang), dy = Math.sin(ang) * 0.5;
    const d = { b, p0: [b[0] + dx * 620, b[1] + dy * 620], p1: [b[0] + dx * 120, b[1] + dy * 120], alt: 115, t0: t + (opts.delay || 0), dur: opts.dur || 1.5, stop: opts.stopAt || 1, color: opts.color || '#e9edf2', gone: false };
    drones.push(d);
    if (opts.onHit) setTimeout(opts.onHit, Math.max(0, (d.t0 + d.dur * d.stop - t) * 1000));
    return d;
  }
  // [ground x, ground y, height] at fraction p: a level run in, then a steepening dive
  function dronePos(d, p) {
    const C = 0.62;
    if (p < C) { const e = p / C; return [d.p0[0] + (d.p1[0] - d.p0[0]) * e, d.p0[1] + (d.p1[1] - d.p0[1]) * e, d.alt + Math.sin(e * Math.PI) * 8]; }
    const e = (p - C) / (1 - C), f = e * e;
    return [d.p1[0] + (d.b[0] - d.p1[0]) * e, d.p1[1] + (d.b[1] - d.p1[1]) * e, d.alt * (1 - f)];
  }
  function droneAt(d, p) { const [x, y, h] = dronePos(d, p); return [x, y - h]; }
  // the drone from above: a delta wing with canards and a pusher prop disc, facing +x
  function deltaWing(s, fill, ink) {
    const P = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)); ctx.closePath(); };
    const body = () => P([[1.0, 0], [0.55, -0.12], [-0.55, -0.92], [-0.78, -0.92], [-0.62, -0.1], [-0.82, -0.06], [-0.82, 0.06], [-0.62, 0.1], [-0.78, 0.92], [-0.55, 0.92], [0.55, 0.12]]);
    if (ink) { ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1.5, s * 0.16); ctx.lineJoin = 'round'; body(); ctx.stroke(); }
    ctx.fillStyle = fill; body(); ctx.fill();
    if (ink) {
      ctx.fillStyle = 'rgba(255,255,255,.3)'; P([[0.95, 0], [0.5, -0.06], [-0.6, -0.05], [-0.6, 0.02], [0.5, 0.03]]); ctx.fill();
      ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.arc(0.78 * s, 0, 0.09 * s, 0, Math.PI * 2); ctx.fill();   // warhead seeker
      ctx.strokeStyle = 'rgba(30,36,42,.55)'; ctx.lineWidth = Math.max(1, s * 0.08); ctx.beginPath(); ctx.moveTo(-0.9 * s, -0.32 * s); ctx.lineTo(-0.9 * s, 0.32 * s); ctx.stroke();   // spinning prop
    }
  }
  function drawDrones() {
    const z = cam.z;
    for (let i = drones.length - 1; i >= 0; i--) {
      const d = drones[i], p = (t - d.t0) / d.dur;
      if (p < 0) continue;
      if (p >= d.stop) {
        const [x, y] = droneAt(d, d.stop), inAir = d.stop < 0.99;
        burst([x, y], inAir ? ['#fff', '#ffb03a', '#ff5a2a', '#555'] : ['#ffb03a', '#ff5a2a', '#fff2a8', '#555'], inAir ? 26 : 34, { speed: inAir ? 1.3 : 1.7, size: 3.2, up: inAir ? 60 : 150 });
        ring([x, y], '#ffb03a', inAir ? 45 : 70, 0.45, 4); if (!inAir) smoke([x, y], 8, 'rgba(70,65,60,');
        drones.splice(i, 1); continue;
      }
      const [gx, gy, h] = dronePos(d, p), [ax, ay, ah] = dronePos(d, Math.max(0, p - 0.02));
      const [sx, sy] = toScreen(gx, gy - h), [ox, oy] = toScreen(ax, ay - ah), head = Math.atan2(sy - oy, sx - ox);
      const [hx, hy] = toScreen(gx, gy), [hx0, hy0] = toScreen(ax, ay), gh = Math.atan2(hy - hy0, hx - hx0);
      // shadow on the ground, the faint exhaust behind it, then the drone itself (it grows as it dives at the camera)
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(gh); ctx.scale(1, 0.5); ctx.globalAlpha = 0.28; deltaWing(13 * z, '#000', null); ctx.restore();
      if (Math.random() < 0.5) fx.parts.push({ x: gx, y: gy - h, vx: 0, vy: -3, life: 0, max: 0.6, col: null, smoke: 'rgba(200,200,200,', sz: 2.5, g: -4 });
      const grow = 1 + Math.max(0, (p - 0.62) / 0.38) * 0.35;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(head); deltaWing(14 * z * grow, d.color, '#0b0f13'); ctx.restore();
    }
  }
  function drawAir() {
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i], p = (t - b.tDrop) / b.fall;
      if (p < 0) continue;
      if (p >= 1) { burst([b.tx, b.ty], b.colors || ['#ffb03a', '#ff5a2a', '#fff2a8', '#555'], 22, { speed: 1.4, size: 3.2 }); ring([b.tx, b.ty], '#ffb03a', 55, 0.45, 4); bombs.splice(i, 1); continue; }
      const [sx, sy] = toScreen(b.tx, b.ty - b.alt * (1 - p * p)), z = cam.z;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; const [gx, gy] = toScreen(b.tx, b.ty); ctx.beginPath(); ctx.ellipse(gx, gy, 5 * z * p, 2 * z * p, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(sx, sy); ctx.fillStyle = '#20262c'; ctx.beginPath(); ctx.ellipse(0, 0, 2.6 * z, 5 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb03a'; ctx.fillRect(-2.5 * z, -6.5 * z, 5 * z, 2 * z); ctx.restore();
    }
    for (let i = planes.length - 1; i >= 0; i--) {
      const pl = planes[i], p = (t - pl.t0) / pl.dur;
      if (p > 1) { planes.splice(i, 1); continue; }
      if (pl.down != null && p >= pl.down) {   // shot down: it blows apart in the air
        const wx = pl.x0 + (pl.x1 - pl.x0) * pl.down, wy = pl.y0 + (pl.y1 - pl.y0) * pl.down - pl.alt;
        burst([wx, wy], ['#fff', '#ffb03a', '#ff5a2a', '#3a3f44'], 30, { speed: 1.4, size: 3, up: 30, g: 200 }); ring([wx, wy], '#ffb03a', 50, 0.45, 4); smoke([wx, wy], 6, 'rgba(60,60,60,');
        planes.splice(i, 1); continue;
      }
      if (p < 0) continue;
      const wx = pl.x0 + (pl.x1 - pl.x0) * p, wy = pl.y0 + (pl.y1 - pl.y0) * p, z = cam.z;
      const [gx, gy] = toScreen(wx, wy), [sx, sy] = toScreen(wx, wy - pl.alt);
      // the heading on screen (the flight path, not the old icon's built-in rotation)
      const [ax, ay] = toScreen(pl.x0, pl.y0), [bx, by] = toScreen(pl.x1, pl.y1), head = Math.atan2(by - ay, bx - ax);
      // ground shadow
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(head); ctx.scale(1, 0.5); ctx.globalAlpha = 0.3; jet(15 * z, '#000', null); ctx.restore();
      // contrail
      const [tx0, ty0] = toScreen(wx - (pl.x1 - pl.x0) * 0.08, wy - pl.alt - (pl.y1 - pl.y0) * 0.08);
      const g = ctx.createLinearGradient(tx0, ty0, sx, sy); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.55)');
      ctx.strokeStyle = g; ctx.lineWidth = 3 * z; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(sx, sy); ctx.stroke();
      // the strike jet, nose first along its path: team-coloured, with an ink outline
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(head); jet(15 * z, pl.color, '#0b0f13'); ctx.restore();
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
  function beam(a, b, color, dur, arc = 0, cb) { fx.beams.push({ a: topOf(a), b: topOf(b), color, t0: t, dur, arc, done: false }); if (cb) setTimeout(cb, dur * 1000); }   // impact on the clock, like bombs
  function shake(v) { fx.shake = Math.max(fx.shake, v); }
  function flash(v, col = '#fff') { fx.flash = Math.max(fx.flash, v); fx.flashCol = col; }
  function pop(k) { fx.pops[k] = t; }

  // ── drawing ──
  function hexPath(cx, cy, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const x = cx + VERT[i][0] * s, y = cy + VERT[i][1] * s * TILT; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
  }
  // the sea background: painted into its own canvas a few times a second, and copied to the screen every frame
  const bgc = document.createElement('canvas'), bgx = bgc.getContext('2d'); let bgAt = -1, bgSize = '';
  function bg() {
    const size = W + 'x' + H + 'x' + DPR;
    if (size !== bgSize || t - bgAt > 0.25) {
      bgSize = size; bgAt = t; bgc.width = Math.ceil(W * DPR); bgc.height = Math.ceil(H * DPR);
      const main = ctx; ctx = bgx; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); paintBg(); ctx = main;
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bgc, 0, 0); ctx.restore();
  }
  function paintBg() {
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
    if (ov.objectives && ov.objectives.has(k)) return true;
    if (ov.targets && ov.targets.has(k)) return true;
    if (ov.fire && ov.fire.has(k)) return true;
    if (ov.planTiles && ov.planTiles.has(k)) return true;
    if (ov.selectedExtra && ov.selectedExtra.includes(k)) return true;
    const r = ov.reach && ov.reach[k]; return !!(r && r.kind !== 'start' && r.kind !== 'pass');
  }
  function drawOverlays(k, cx, cy, s, z) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    // a mission objective: a gold ring and a flag (green once it's yours)
    if (ov.objectives && ov.objectives.has(k)) {
      const mine = S_.map.tiles[k] && S_.map.tiles[k].owner === ov.me, col = mine ? '#59f08a' : '#ffc53d';
      hexPath(cx, cy, s * (0.9 + pulse * 0.05)); ctx.strokeStyle = col; ctx.lineWidth = 3 * z; ctx.setLineDash([7 * z, 5 * z]); ctx.lineDashOffset = -t * 25; ctx.stroke(); ctx.setLineDash([]);
      const fx = cx + s * 0.42, fy = cy - 4 * z;
      ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 1.8 * z; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 26 * z); ctx.stroke();
      ctx.fillStyle = col; ctx.strokeStyle = '#0a0e12'; ctx.lineWidth = 1.2 * z; ctx.beginPath(); ctx.moveTo(fx, fy - 26 * z);
      for (let i = 0; i <= 4; i++) ctx.lineTo(fx + i * 3.4 * z, fy - 26 * z + Math.sin(t * 5 + i) * 1.3 * z);
      for (let i = 4; i >= 0; i--) ctx.lineTo(fx + i * 3.4 * z, fy - 17 * z + Math.sin(t * 5 + i) * 1.3 * z);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0a0e12'; ctx.font = `bold ${7 * z}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', fx + 7 * z, fy - 21.5 * z);
    }
    // land the blueprint will take: a light-blue wash with a dashed edge
    if (ov.planTiles && ov.planTiles.has(k)) { hexPath(cx, cy, s * 0.9); ctx.fillStyle = 'rgba(143,220,255,.22)'; ctx.fill(); ctx.strokeStyle = 'rgba(143,220,255,.8)'; ctx.lineWidth = 2 * z; ctx.setLineDash([5 * z, 4 * z]); ctx.stroke(); ctx.setLineDash([]); }
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
  // tiles are drawn into the cached map, which only refreshes now and then: anything there that moved with time hopped
  // between positions (bobbing markers, swaying trees, waving flags). Tiles use a frozen clock, so they sit still and crisp
  const tv = 0;
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
    // the owner's territory skin, over their colour (land only: the sea and rivers keep their water look)
    if (c.owned && tile.fog !== 2) { const cs = cosOf[tile.owner], box = terrBox[tile.owner]; if (cs && cs.territory && box && typeof Skins !== 'undefined') { const hq = tc[hqOf[tile.owner]]; if (hq) { box.hx = hq.wx; box.hy = hq.wy; } Skins.territory(ctx, cs.territory, { cx, cy, s, z, wx: c.wx, wy: c.wy, box }, hexPath); } }
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
      const d = 0.5 + 0.5 * Math.sin(tv * 0.3 + c.q * 0.7 + c.r * 0.5);
      ctx.fillStyle = `rgba(120,135,150,${0.06 + d * 0.05})`;
      ctx.beginPath(); ctx.ellipse(cx + (c.v - 0.5) * 10 * z, cy - 1 * z, s * 0.6, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      if (tile.struct && tile.struct.type === 'hq') drawStruct(tile, cx, cy, z, k);
      return;
    }
    if (c.river) drawRiver(k, tile, cx, cy, z, s); else decorate(tile, c, cx, cy, s, z);
    drawRoad(k, cx, cy, z);
    // bridges and their wreckage (sea and river alike)
    if (tile.bridge) drawBridge(tile, c.q + ',' + c.r, cx, cy, s, z);
    else if (tile.wreck) {
      // the stumps and twisted deck of a destroyed bridge
      ctx.save(); ctx.fillStyle = '#4a3d2c';
      for (const ox of [-0.38, 0.32]) { ctx.fillRect(cx + ox * s - 2.5 * z, cy - 4 * z, 5 * z, 8 * z); }
      ctx.translate(cx, cy); ctx.rotate(0.35); ctx.fillStyle = 'rgba(70,58,42,.85)'; ctx.fillRect(-0.3 * s, -1.5 * z, 0.32 * s, 3 * z); ctx.rotate(-0.8); ctx.fillRect(0.02 * s, -1.5 * z, 0.26 * s, 3 * z);
      ctx.restore();
    }
    // territory borders
    if (tile.owner && c.oc) {
      const nb = E.neighbors(k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      const cs = cosOf[tile.owner], skinned = cs && cs.trim && typeof Skins !== 'undefined', segs = skinned ? [] : null;
      for (let i = 0; i < 6; i++) {
        const n = S_.map.tiles[nb[EDGE_DIR[i]]];
        if (n && n.owner === tile.owner) continue;
        const a = VERT[i], b = VERT[(i + 1) % 6], ss = s * 0.97, ax = cx + a[0] * ss, ay = cy + a[1] * ss * TILT, bx = cx + b[0] * ss, by = cy + b[1] * ss * TILT;
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        if (segs) { let nx = (ax + bx) / 2 - cx, ny = (ay + by) / 2 - cy; const l = Math.hypot(nx, ny) || 1; segs.push({ ax, ay, bx, by, nx: nx / l, ny: ny / l }); }
      }
      // the line itself: a border-line skin, or the plain one
      if (!(skinned && cs.trim && Skins.trim(ctx, cs.trim, z, c.oc, segs))) {
        ctx.strokeStyle = c.oc; ctx.globalAlpha = 0.28; ctx.lineWidth = 10 * z; ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineWidth = 4.5 * z; ctx.stroke();
      }
      // your allies' land: a dashed green line just inside their border, so you can see every friendly hex at a glance
      if (ov.me && tile.owner !== ov.me && E.isAlly(S_, ov.me, tile.owner)) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const n = S_.map.tiles[nb[EDGE_DIR[i]]]; if (n && n.owner === tile.owner) continue;
          const a = VERT[i], b = VERT[(i + 1) % 6], ss = s * 0.8;
          ctx.moveTo(cx + a[0] * ss, cy + a[1] * ss * TILT); ctx.lineTo(cx + b[0] * ss, cy + b[1] * ss * TILT);
        }
        ctx.strokeStyle = '#9cf0b4'; ctx.lineWidth = 2.2 * z; ctx.setLineDash([5 * z, 4 * z]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    if (tile.struct && tile.struct.type !== 'bridge') {
      drawStruct(tile, cx, cy, z, k);
      const extra = (tile.structs || []).filter(st => st !== tile.struct && st.type !== tile.struct.type);
      extra.forEach((st, i) => drawMini(st, cx - 16 * z + i * 32 * z, cy + 7 * z, z));
      const h = (tile.structs || []).find(st => st.type === 'hq');
      if (h && h.siege) {
        const pulse = 0.5 + 0.5 * Math.sin(tv * 8);
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
  // a 2.5D bridge: concrete piers in the water, an asphalt deck with a visible edge, railings, and a steel arch overhead.
  // River bridges run bank to bank (across the flow)
  function drawBridge(tile, k, cx, cy, s, z) {
    const tiles = S_.map.tiles, bank = n => tiles[n] && E.TERRAIN[tiles[n].t].land && !tiles[n].river;
    const nb = E.neighbors(k).filter(n => tiles[n] && (tile.river ? bank(n) : E.TERRAIN[tiles[n].t].land));
    let a = null, b = null, best = -1;
    for (const p of nb) for (const q of nb) { const d = E.dist(p, q); if (d > best) { best = d; a = p; b = q; } }
    // the owner can turn it: step from the automatic axis to the next of the hex's three axes
    const [q0, r0] = E.parse(k), axisOf = n => { if (!n) return 0; const [q1, r1] = E.parse(n); const i = E.DIRS.findIndex(d => d[0] === q1 - q0 && d[1] === r1 - r0); return i < 0 ? 0 : i % 3; };
    if (tile.bridgeRot || !a || !b || best < 2) {
      const ax = (axisOf(best >= 2 ? a : null) + (tile.bridgeRot || 0)) % 3;
      a = (q0 + E.DIRS[ax][0]) + ',' + (r0 + E.DIRS[ax][1]); b = (q0 + E.DIRS[ax + 3][0]) + ',' + (r0 + E.DIRS[ax + 3][1]);
    }
    if (!tc[k]) return;
    // a span pointing off the map still needs ends: mirror the hex centre
    const end = n => tc[n] || { wx: 2 * tc[k].wx - (tc[n === a ? b : a] || tc[k]).wx, wy: 2 * tc[k].wy - (tc[n === a ? b : a] || tc[k]).wy };
    if (!tc[a] && !tc[b]) return;
    const c0 = tc[k], sc = S / 34;
    // deck ends sit on the hex edges toward each shore, in world space
    const ea = end(a), eb = end(b), e1 = [(c0.wx + ea.wx) / 2, (c0.wy + ea.wy) / 2], e2 = [(c0.wx + eb.wx) / 2, (c0.wy + eb.wy) / 2];
    const dx = e2[0] - e1[0], dy = e2[1] - e1[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * S * 0.2, ny = dx / L * S * 0.2;
    const waterH = c0.h * sc, deckH = waterH + 9, thick = 3.2;
    const P = (wx, wy, h) => { const [x, y] = toScreen(wx, wy); return [x, y - h * z]; };
    const at = (t, side, h) => P(e1[0] + dx * t + nx * side, e1[1] + dy * t + ny * side, h);
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    ctx.save();
    // shadow on the water
    poly([at(0, -1.1, waterH), at(1, -1.1, waterH), at(1, 1.1, waterH), at(0, 1.1, waterH)], 'rgba(0,0,0,.28)');
    // piers
    for (const t of [0.3, 0.7]) {
      const p1 = at(t, -0.75, waterH), p2 = at(t, 0.75, waterH), q1 = at(t, -0.75, deckH - thick), q2 = at(t, 0.75, deckH - thick);
      poly([p1, p2, q2, q1], '#8d8a83'); poly([p1, [p1[0] + 2 * z, p1[1]], [q1[0] + 2 * z, q1[1]], q1], 'rgba(0,0,0,.25)');
    }
    // deck: the near edge face, then the road surface
    const front = at(0, 1, deckH)[1] > at(0, -1, deckH)[1] ? 1 : -1;
    poly([at(0, front, deckH), at(1, front, deckH), at(1, front, deckH - thick), at(0, front, deckH - thick)], '#5f5b55');
    poly([at(0, -1, deckH), at(1, -1, deckH), at(1, 1, deckH), at(0, 1, deckH)], '#4a4d52');
    // lane line
    ctx.strokeStyle = 'rgba(255,214,90,.8)'; ctx.lineWidth = 1.2 * z; ctx.setLineDash([4 * z, 4 * z]);
    { const m1 = at(0.04, 0, deckH), m2 = at(0.96, 0, deckH); ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.stroke(); }
    ctx.setLineDash([]);
    // railings with posts, the owner's colour along the top rail
    const col = bridgeCol(tile);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#2b2d31'; ctx.lineWidth = 1 * z;
      for (let i = 0; i <= 8; i++) { const b0 = at(i / 8, side, deckH), b1 = at(i / 8, side, deckH + 3); ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke(); }
      const r1 = at(0, side, deckH + 3), r2 = at(1, side, deckH + 3);
      ctx.strokeStyle = col; ctx.lineWidth = 1.6 * z; ctx.beginPath(); ctx.moveTo(r1[0], r1[1]); ctx.lineTo(r2[0], r2[1]); ctx.stroke();
    }
    // steel arch with hangers over the span
    for (const side of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(at(t, side * 0.95, deckH + 3 + Math.sin(t * Math.PI) * 10)); }
      ctx.strokeStyle = '#c9ccd1'; ctx.lineWidth = 2 * z; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.strokeStyle = 'rgba(201,204,209,.7)'; ctx.lineWidth = 0.8 * z;
      for (let i = 2; i <= 10; i += 2) { const t = i / 12, top = at(t, side * 0.95, deckH + 3 + Math.sin(t * Math.PI) * 10), bot = at(t, side * 0.95, deckH + 3); ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(bot[0], bot[1]); ctx.stroke(); }
    }
    ctx.restore();
  }
  function bridgeCol(tile) { const p = tile.owner && S_.players.find(pl => pl.id === tile.owner); return p ? p.color : '#5a4630'; }
  // an offshore platform: four legs standing in the sea, a deck with a helipad, a lattice derrick, a crane and a flare boom
  function drawRig(cx, cy, z, v, owner) {
    const x = cx + 1.5 * z, y = cy - 1 * z; z *= 0.8;   // sized so the whole platform, flare boom included, sits inside its hex
    const op = owner && S_.players.find(p => p.id === owner), oc = op ? op.color : null;
    const P = (dx, dy) => [x + dx * z, y + dy * z];
    const line = (pts, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w * z; ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(...P(a, b)) : ctx.moveTo(...P(a, b))); ctx.stroke(); };
    const poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(...P(a, b)) : ctx.moveTo(...P(a, b))); ctx.closePath(); ctx.fill(); };
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // an owned rig sits in a ring of its owner's colour
    if (oc) { ctx.globalAlpha = 0.3; ctx.fillStyle = oc; ctx.beginPath(); ctx.ellipse(x, y + 8 * z, 17 * z, 6.5 * z, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = oc; ctx.lineWidth = 1.5 * z; ctx.stroke(); }
    // legs, and the swell breaking round them
    const ph = t * 2 + v * 10;
    for (const [lx, ly] of [[-9, 4], [9, 4], [-7, 0], [7, 0]]) {
      ctx.strokeStyle = 'rgba(220,240,255,.5)'; ctx.lineWidth = 0.8 * z; ctx.beginPath(); ctx.ellipse(...P(lx, ly + 6), (2.6 + Math.sin(ph + lx) * 0.5) * z, 1 * z, 0, 0, Math.PI * 2); ctx.stroke();
      line([[lx, ly + 6], [lx, ly - 2]], '#2b3036', 2.4); line([[lx - 0.5, ly + 6], [lx - 0.5, ly - 2]], '#6d7680', 0.7);
    }
    line([[-9, 8], [-7, 3], [7, 3], [9, 8]], '#3a4148', 0.9);   // bracing between the legs
    // the deck: top and front face
    poly([[-13, -2], [11, -2], [13, 1], [-11, 1]], '#7c8792');
    poly([[-11, 1], [13, 1], [13, 3.4], [-11, 3.4]], '#454d56');
    line([[-11, 1], [13, 1]], oc || '#e0b33a', 1.1);   // deck edge in the owner's colour (hazard yellow when nobody holds it)
    // modules: accommodation block with windows
    poly([[-3, -2], [5, -2], [5, -7], [-3, -7]], '#d9dde1'); poly([[5, -2], [6.6, -0.6], [6.6, -5.6], [5, -7]], '#a6adb4');
    ctx.fillStyle = '#2f3a46'; for (let i = 0; i < 3; i++) ctx.fillRect(...P(-2 + i * 2.4, -5.8), 1.4 * z, 1.1 * z);
    // helipad, cantilevered off the right
    ctx.fillStyle = '#39424b'; ctx.beginPath(); ctx.ellipse(...P(9.5, -3.2), 4.6 * z, 1.9 * z, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e0b33a'; ctx.lineWidth = 0.6 * z; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold ${2.6 * z}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', ...P(9.5, -3.1));
    // the derrick: a tapering lattice tower
    const B = [[-10.5, -2], [-6.5, -2]], T = [[-9, -21], [-8, -21]];
    line([B[0], T[0]], '#c8ced4', 1.1); line([B[1], T[1]], '#c8ced4', 1.1);
    for (let i = 0; i < 4; i++) { const f0 = i / 4, f1 = (i + 1) / 4, lx = a => B[0][0] + (T[0][0] - B[0][0]) * a, rx = a => B[1][0] + (T[1][0] - B[1][0]) * a, yy = a => -2 - 19 * a; line([[lx(f0), yy(f0)], [rx(f1), yy(f1)]], '#9aa3ab', 0.5); line([[rx(f0), yy(f0)], [lx(f1), yy(f1)]], '#9aa3ab', 0.5); line([[lx(f1), yy(f1)], [rx(f1), yy(f1)]], '#9aa3ab', 0.5); }
    poly([[-9.6, -21], [-7.4, -21], [-7.4, -22.6], [-9.6, -22.6]], '#e0b33a');
    // crane: a boom angled out over the sea
    line([[2, -7], [12, -15]], '#e0b33a', 1); line([[12, -15], [12, -9]], '#6d7680', 0.4);
    // flare boom off the left, its flame flickering
    line([[-11, -1], [-17, -9]], '#9aa3ab', 0.9);
    const f = 0.7 + 0.3 * Math.sin(tv * 9 + v * 20);
    ctx.fillStyle = `rgba(255,${120 + 80 * f | 0},30,.9)`; ctx.beginPath(); ctx.ellipse(...P(-17.3, -11 - f), 1.6 * z, 3 * z * f, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,180,.95)'; ctx.beginPath(); ctx.ellipse(...P(-17.2, -10.2 - f * 0.6), 0.7 * z, 1.4 * z * f, -0.3, 0, Math.PI * 2); ctx.fill();
    if (oc) {
      // the owner's flag on the derrick
      const [fx0, fy] = P(-8.5, -22.6);
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.9 * z; ctx.beginPath(); ctx.moveTo(fx0, fy); ctx.lineTo(fx0, fy - 7 * z); ctx.stroke();
      ctx.fillStyle = oc; ctx.beginPath(); ctx.moveTo(fx0, fy - 7 * z);
      for (let i = 0; i <= 4; i++) ctx.lineTo(fx0 + i * 2.2 * z, fy - 7 * z + Math.sin(tv * 6 + i * 0.9 + v * 9) * 1.1 * z);
      for (let i = 4; i >= 0; i--) ctx.lineTo(fx0 + i * 2.2 * z, fy - 3 * z + Math.sin(tv * 6 + i * 0.9 + v * 9) * 1.1 * z);
      ctx.fill();
    }
    ctx.restore();
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
        const sway = Math.sin(tv * 1.3 + c.q + ox * 3) * 1.2 * z;
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
        const x = cx + ox * s, y = cy + oy * s * TILT * 1.6, sway = Math.sin(tv * 1.1 + c.q + ox * 3) * 1.5 * z;
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
      const a = 0.3 + 0.1 * Math.sin(tv * 1.5 + v * 7);
      ctx.fillStyle = `rgba(70,110,95,${a})`;
      for (const [ox, oy, r] of [[-0.25, 0.05, 0.22], [0.2, -0.08, 0.17], [0.08, 0.22, 0.14]]) { ctx.beginPath(); ctx.ellipse(cx + ox * s, cy + oy * s * TILT, r * s, r * s * TILT * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = c.owned ? 'rgba(0,0,0,.3)' : '#8a9a5a'; ctx.lineWidth = 1.3 * z;
      for (let i = 0; i < 4; i++) { const x = cx + (i - 1.5) * 6 * z + (v - 0.5) * 6 * z, y = cy + (i % 2 ? -4 : 5) * z; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1 * z, y - 7 * z); ctx.stroke(); }
    } else if (tile.t === 'plains' && v > 0.7 && !tile.struct && !c.owned) {
      ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 3; i++) ctx.fillRect(cx + (i - 1) * 7 * z + (v * 10 - 5) * z, cy + (i % 2) * 4 * z, 1.6 * z, 4 * z);
    }

    if (tile.fish) {
      const bob = Math.sin(tv * 2.4 + v * 9) * 1.5 * z, x = cx - 6 * z, y = cy + bob;
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
      const bob = Math.sin(tv * 2.2 + v * 6) * 2 * z, x = cx + s * 0.38, y = cy - 4 * z + bob;
      const gl = ctx.createRadialGradient(x, y, 0, x, y, 16 * z); gl.addColorStop(0, 'rgba(110,255,240,.55)'); gl.addColorStop(1, 'rgba(110,255,240,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 16 * z, y - 16 * z, 32 * z, 32 * z);
      ctx.fillStyle = '#9ffcf2'; ctx.beginPath(); ctx.moveTo(x, y - 9 * z); ctx.lineTo(x + 4.5 * z, y); ctx.lineTo(x, y + 4 * z); ctx.lineTo(x - 4.5 * z, y); ctx.fill();
      ctx.fillStyle = '#34c7c0'; ctx.beginPath(); ctx.moveTo(x, y - 9 * z); ctx.lineTo(x + 4.5 * z, y); ctx.lineTo(x, y + 4 * z); ctx.fill();
    }
    if (tile.poi && !(tile.poi === 'fort' && tile.owner)) {
      const bob = Math.sin(tv * 2 + v * 6) * 1.6 * z, x = cx, y = cy - 14 * z + bob, col = POI_COL[tile.poi];
      const pulse = (tile.poi === 'relic' || tile.poi === 'cache' || tile.poi === 'ruins') ? 0.5 + 0.5 * Math.sin(tv * 3 + v * 5) : 0.3;
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
      const a = 0.4 + 0.3 * Math.sin(tv * 3 + v * 9);
      ctx.save(); ctx.globalAlpha = a; Art.drawIcon(ctx, 'tactic', 'nuke', cx, cy, 9 * z, '#d9ff3b'); ctx.restore();
    }
    if (tile.smoke) { ctx.fillStyle = 'rgba(220,225,230,.35)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(cx + Math.sin(tv * 0.8 + i * 1.3) * s * 0.4, cy + Math.cos(tv * 0.6 + i) * s * 0.15 - 4 * z, (7 + i % 3 * 3) * z, 0, Math.PI * 2); ctx.fill(); } }
    if (S_.map.beacon && S_.map.beacon === c.q + ',' + c.r) {
      const g = ctx.createLinearGradient(0, cy - 140 * z, 0, cy); g.addColorStop(0, 'rgba(255,214,90,0)'); g.addColorStop(1, 'rgba(255,214,90,.55)');
      ctx.fillStyle = g; ctx.fillRect(cx - 7 * z, cy - 140 * z, 14 * z, 140 * z);
      ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.ellipse(cx, cy, s * (0.5 + 0.1 * Math.sin(tv * 3)), s * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
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
      const sw = Math.sin(tv * 2.2) * 2.5 * z;
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
      for (let i = 0; i <= 6; i++) ctx.lineTo(fx0 + i * 2.6 * z, fy - 6 * z + Math.sin(tv * 6 + i * 0.9) * 1.6 * z);
      for (let i = 6; i >= 0; i--) ctx.lineTo(fx0 + i * 2.6 * z, fy + 3 * z + Math.sin(tv * 6 + i * 0.9) * 1.6 * z);
      ctx.fill();
    }
    if (type === 'refinery' && Math.random() < 0.04) smoke([world(k).wx + 4, world(k).wy - world(k).h - 22], 1, 'rgba(180,180,180,');
  }

  // ── units ──
  function unitStacks() {
    const stacks = {};
    for (const id in S_.units) { const u = S_.units[id]; if (unitHidden.has(u.id) || unitPos[u.id] || (ov.planMoved && ov.planMoved.has(u.id))) continue; (stacks[u.hex] || (stacks[u.hex] = [])).push(u); }
    return stacks;
  }
  function strongest(units) { return units.slice().sort((a, b) => E.UNITS[b.type].cost - E.UNITS[a.type].cost)[0]; }

  // queued in the blueprint: a light-blue dashed ring under the stack
  function planRing(x, y, z) {
    ctx.save(); ctx.strokeStyle = '#8fdcff'; ctx.lineWidth = 2.5 * z; ctx.setLineDash([5 * z, 4 * z]); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.ellipse(x, y + 2 * z, 21 * z, 9 * z, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  // stack token: a team-coloured shield plate with a bold silhouette and a count
  // a skinned card shows on the board as the backing behind its unit's icon. Returns true if the backing is light (the icon goes dark)
  function skinBacking(x, y, R, z, skin) {
    const disc = () => { ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); };
    if (!skin) { ctx.fillStyle = 'rgba(8,12,16,.82)'; disc(); ctx.fill(); return false; }
    ctx.save(); disc(); ctx.clip();
    if (skin === 'worn') {
      ctx.fillStyle = '#4a3b26'; ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.strokeStyle = 'rgba(20,14,6,.55)'; ctx.lineWidth = 1 * z; ctx.beginPath(); ctx.moveTo(x - R, y - R * 0.3); ctx.lineTo(x + R, y + R * 0.5); ctx.moveTo(x - R * 0.2, y - R); ctx.lineTo(x + R * 0.4, y + R); ctx.stroke();
    } else if (skin === 'foil') {
      const g = ctx.createLinearGradient(x - R, y - R, x + R, y + R); ['#ff8ad9', '#8af7ff', '#fff28a', '#a6ff8a', '#ff8ad9'].forEach((c, i) => g.addColorStop(i / 4, c));
      ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x - R, y - R, R * 2, R * 0.7);
    } else if (skin === 'gilded') {
      const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.35, 0, x, y, R * 1.1); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#f0bf3e'); g.addColorStop(1, '#9a6510');
      ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    } else if (skin === 'blackout') {
      ctx.fillStyle = '#000'; ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1 * z; ctx.beginPath(); ctx.arc(x, y, R - 1.2 * z, 0, Math.PI * 2); ctx.stroke();
    } else if (skin === 'celestial') {
      const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, '#5a3fc0'); g.addColorStop(0.6, '#2a1a6a'); g.addColorStop(1, '#0b0820');
      ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
      const g2 = ctx.createRadialGradient(x - R * 0.4, y - R * 0.3, 0, x - R * 0.4, y - R * 0.3, R * 0.8); g2.addColorStop(0, 'rgba(122,247,255,.55)'); g2.addColorStop(1, 'rgba(122,247,255,0)');
      ctx.fillStyle = g2; ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.fillStyle = '#fff'; for (const [a, b, s2] of [[0.55, -0.5, 1], [-0.6, 0.45, 0.8], [0.3, 0.6, 0.7], [-0.15, -0.7, 0.6], [0.7, 0.2, 0.6]]) { ctx.beginPath(); ctx.arc(x + a * R, y + b * R, s2 * z, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    return skin === 'foil' || skin === 'gilded';
  }
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
    const skin = !opts.ghost && cosOf[owner] && cosOf[owner].cards ? cosOf[owner].cards[top.type] || null : null;
    const spr = tokenSprite(top.type, units.length, col, !!exhausted, r, z, skin);
    { const a0 = ctx.globalAlpha; if (exhausted) ctx.globalAlpha = a0 * 0.6; ctx.drawImage(spr.cv, x - spr.ox, ty - spr.oy, spr.w, spr.h); ctx.globalAlpha = a0; }
    if (d.heli) {
      // a helicopter's main rotor, spinning above the token
      const ry = ty - r * 1.08, spin = t * (exhausted ? 6 : 22), w = r * 1.25;
      ctx.save(); ctx.globalAlpha *= 0.22; ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.ellipse(x, ry, w, w * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(20,24,30,.85)'; ctx.lineWidth = 2 * z; ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) { const a = spin + i * Math.PI / 2, dx = Math.cos(a) * w, dy = Math.sin(a) * w * 0.22; ctx.beginPath(); ctx.moveTo(x - dx, ry - dy); ctx.lineTo(x + dx, ry + dy); ctx.stroke(); }
      ctx.restore();
    }
    if (units.some(u => u.stun)) {
      // stunned: a slow cyan pulse and a lightning badge
      const pz = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.strokeStyle = `rgba(127,243,255,${0.45 + pz * 0.45})`; ctx.lineWidth = (1.5 + pz) * z; ctx.beginPath(); ctx.arc(x, ty, r + (3 + pz * 2) * z, 0, Math.PI * 2); ctx.stroke();
      const bx = x - r * 0.95, by = ty - r * 0.7;
      ctx.fillStyle = '#0b1a22'; ctx.beginPath(); ctx.arc(bx, by, 7 * z, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#7ff3ff'; ctx.lineWidth = 1.5 * z; ctx.stroke();
      ctx.fillStyle = '#7ff3ff'; ctx.beginPath(); ctx.moveTo(bx + 1 * z, by - 5 * z); ctx.lineTo(bx - 3 * z, by + 1 * z); ctx.lineTo(bx, by + 1 * z); ctx.lineTo(bx - 1 * z, by + 5 * z); ctx.lineTo(bx + 3 * z, by - 1 * z); ctx.lineTo(bx, by - 1 * z); ctx.closePath(); ctx.fill();
    }
    if (units.some(u => u.ow) && !opts.ghost) {
      // overwatch: a gold eye above the token
      const ex = x, ey = ty - r - 10 * z;
      ctx.fillStyle = '#0b0f13'; ctx.beginPath(); ctx.ellipse(ex, ey, 9 * z, 6 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffc53d'; ctx.lineWidth = 1.6 * z; ctx.beginPath(); ctx.ellipse(ex, ey, 8 * z, 5 * z, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffc53d'; ctx.beginPath(); ctx.arc(ex, ey, 2.4 * z, 0, Math.PI * 2); ctx.fill();
    }
    if (units.every(u => u.dug) && !opts.ghost) {
      // dug in: a sandbag arc under the token
      ctx.fillStyle = '#b8a27a'; ctx.strokeStyle = '#0a0e12'; ctx.lineWidth = 1.5 * z;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(x + i * 6 * z, y + 3 * z - Math.abs(i) * 1.2 * z, 4 * z, 2.6 * z, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
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
  function tokenSprite(type, n, col, exhausted, r, z, skin) {
    const zb = Math.round(z * 20) / 20, key = type + '|' + Math.min(n, 99) + '|' + col + '|' + exhausted + '|' + zb + '|' + r.toFixed(1) + '|' + DPR + '|' + (skin || '');
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
    // the icon's backing: dark as standard, or the card skin's look (the outline stays in the owner's colour)
    const light = skinBacking(x, ty, r * 0.66, z, skin);
    Art.drawIcon(ctx, 'unit', type, x, ty, r * 0.5, exhausted ? '#8a9299' : light ? '#1a1408' : '#ffffff');
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
      const ready = own && ov.myTurn && (ov.planReady ? st.units.some(u => ov.planReady.has(u.id)) : st.units.some(u => E.canAct(S_, u) && (E.moveAllow(S_, u) > 0 || E.UNITS[u.type].range)));
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
      const tx = x + (hasStruct ? 12 * z : 0), ty = y + (hasStruct ? 6 * z : 0);
      if (planned) planRing(tx, ty, z);
      drawToken(tx, ty, st.units, st.units[0].owner, z, { ready, exhausted: exhausted && !planned, planned });
    }
    // animated units
    const moving = {};
    for (const id in unitPos) { const u = S_.units[id] || extraUnits.find(e => e.id == id); if (!u) continue; const p = unitPos[id]; const kk = Math.round(p.x) + ':' + Math.round(p.y) + ':' + u.owner; (moving[kk] || (moving[kk] = { p, units: [], owner: u.owner })).units.push(u); }
    for (const kk in moving) { const m = moving[kk]; const [x, y] = toScreen(m.p.x, m.p.y); drawToken(x, y, m.units, m.owner, z, { scale: m.p.s || 1 }); }
  }

  // ally war-room marks: arrows and circles, only in the Alt view
  function drawNotes() {
    const z = cam.z, all = (ov.notes || []).concat(ov.notePreview ? [ov.notePreview] : []);
    for (const n of all) {
      if (n.type === 'circle') {
        const [x, y] = screenOf(n.a); ctx.save(); ctx.strokeStyle = n.color; ctx.lineWidth = 4 * z; ctx.setLineDash([8 * z, 5 * z]);
        ctx.beginPath(); ctx.ellipse(x, y, 30 * z, 18 * z, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      } else drawPath([n.a, n.b], n.color, false, 0.95);
    }
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
      if (p.smoke) { ctx.fillStyle = p.smoke + (k * (p.sa || 0.35)) + ')'; ctx.beginPath(); ctx.arc(x, y, p.sz * z * (1.6 - k * 0.6), 0, Math.PI * 2); ctx.fill(); }
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
      if (p >= 1) fx.beams.splice(i, 1);
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
    // terrain, background and fog live in an offscreen layer.
    // It only redraws when the board changes, a fade/pop plays, or the camera has come to rest somewhere new.
    // While the camera moves, the cached image (the whole map, or the screen plus a margin) is slid and scaled instead: panning and zooming cost a blit
    const key = W + '|' + H + '|' + DPR + '|' + stateVer + '|' + (ov.unsupplied ? ov.unsupplied.size : 0);
    // at rest = the camera hasn't changed for a moment (dragging and wheel-zoom move it instantly, so its target alone can't tell)
    if (cam.x !== lastCam.x || cam.y !== lastCam.y || cam.z !== lastCam.z) { lastCam.x = cam.x; lastCam.y = cam.y; lastCam.z = cam.z; camMovedAt = t; }
    const settled = t - camMovedAt > 0.15;
    const ls = cam.z / lcam.z, X0 = (lcam.x - cam.x) * cam.z + W / 2 - (lcam.w / 2) * ls, Y0 = (lcam.y - cam.y) * cam.z + H / 2 - (lcam.h / 2) * ls;
    const fills = lcam.w > 0 && X0 <= 0 && Y0 <= 0 && X0 + lcam.w * ls >= W && Y0 + lcam.h * ls >= H;
    // a cached whole map can stretch further while zooming (it's redrawn sharp once you stop), and past its edge there's only open sea
    const covers = lcam.w > 0 && (fills || lcam.whole) && (lcam.whole && !settled ? ls > 0.15 && ls < 4 : ls > (lcam.whole ? 0.5 : 0.8) && ls < (lcam.whole ? 1.5 : 1.25));
    const moved = cam.z !== lcam.z || !fills || lcam.soft || (!lcam.whole && (cam.x !== lcam.x || cam.y !== lcam.y));
    // ambient motion (water, sway, markers) refreshes it now and then, only while the camera is still, and less often the slower the board draws
    const ambient = layerCost < 5 ? 0.25 : layerCost < 12 ? 0.6 : layerCost < 25 ? 2 : Infinity;
    const why = key !== layerKey ? 'state' : t < fadeUntil ? 'fade' : Object.keys(fx.pops).length ? 'pop' : !covers ? 'edge' : settled && moved ? 'rest' : settled && t - layerT > ambient ? 'ambient' : '';
    if (why) {
      const lt0 = performance.now();
      // what to cache: the whole map if it fits at this zoom (then panning never redraws), else the screen plus a margin
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const k of order) { const c = tc[k]; if (c.wx < x0) x0 = c.wx; if (c.wx > x1) x1 = c.wx; if (c.wy < y0) y0 = c.wy; if (c.wy > y1) y1 = c.wy; }
      const pad = 90 / cam.z;
      x0 = Math.min(x0 - pad, cam.x - W / 2 / cam.z); x1 = Math.max(x1 + pad, cam.x + W / 2 / cam.z); y0 = Math.min(y0 - pad * 1.5, cam.y - H / 2 / cam.z); y1 = Math.max(y1 + pad, cam.y + H / 2 / cam.z);
      // mid-zoom/pan, a cache that ran out is redrawn as the whole map at a resolution that fits (soft for a moment, but
      // it then covers any zoom without redrawing again); the sharp redraw waits until the camera rests
      let zDraw = cam.z;
      if (why === 'edge' && !settled) { const fitZ = Math.min(LAYER_MAX / ((x1 - x0) * DPR), LAYER_MAX / ((y1 - y0) * DPR)); if (fitZ < cam.z) zDraw = fitZ; }
      const whole = (x1 - x0) * zDraw * DPR <= LAYER_MAX + 1 && (y1 - y0) * zDraw * DPR <= LAYER_MAX + 1;
      const cx = whole ? (x0 + x1) / 2 : cam.x, cy = whole ? (y0 + y1) / 2 : cam.y;
      const lw = Math.ceil(whole ? (x1 - x0) * zDraw : W + 2 * LM), lh = Math.ceil(whole ? (y1 - y0) * zDraw : H + 2 * LM);
      if (lc.width !== lw * DPR || lc.height !== lh * DPR) { lc.width = lw * DPR; lc.height = lh * DPR; }
      const main = ctx; ctx = lctx;
      const w0 = W, h0 = H, c0x = cam.x, c0y = cam.y, c0z = cam.z; W = lw; H = lh; cam.x = cx; cam.y = cy; cam.z = zDraw;   // draw from the layer's own centre, size and zoom
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);   // just the map: the sea background is drawn on the screen itself, every frame
      for (const k of order) drawTile(k, 'base');
      drawAuras(true);   // their soft glow is baked in here; the moving parts are drawn every frame
      if (S_.fogOn) for (const k of order) if (S_.map.tiles[k].fog === 1) drawFog(k);
      // labels go on top of every tile, so taller neighbours never cut them off
      for (const f of late) f(); late.length = 0;
      W = w0; H = h0; cam.x = c0x; cam.y = c0y; cam.z = c0z;
      ctx = main; layerKey = key; layerT = t; perf.why = why;
      Object.assign(lcam, { x: cx, y: cy, z: zDraw, w: lw, h: lh, whole, soft: zDraw < cam.z });
      perf.layer = { x0: Math.round(x0), x1: Math.round(x1), y0: Math.round(y0), y1: Math.round(y1), whole, lw, lh };
      const lc0 = performance.now() - lt0; layerCost = layerCost ? layerCost * 0.85 + lc0 * 0.15 : lc0;
      bg(); ctx.drawImage(lc, (cx - cam.x) * cam.z + W / 2 - lw / 2 + sx, (cy - cam.y) * cam.z + H / 2 - lh / 2 + sy, lw, lh);
    } else { bg(); ctx.drawImage(lc, X0 + sx, Y0 + sy, lcam.w * ls, lcam.h * ls); }
    // (the background used to be baked into the cached map: zooming out fast shrank it to a box of sea floating on a
    // flat fill until the redraw caught up)
    ctx.translate(sx, sy);
    drawWaterGlints();
    drawAuras();
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
    if (ov.troops) drawNotes();
    const p3 = performance.now();
    drawAir(); drawDrones(); drawMissiles();
    // blueprint ghosts: stacks where the queued orders put them, and buildings the queue will raise
    if (ov.planGhost) for (const g of ov.planGhost.slice().sort((a, b) => (tc[a.hex] ? tc[a.hex].wy : 0) - (tc[b.hex] ? tc[b.hex].wy : 0))) {
      if (!tc[g.hex]) continue;
      const z = cam.z, [wx, wy] = topOf(g.hex); let [x, y] = toScreen(wx, wy);
      if (g.struct) { ctx.save(); ctx.globalAlpha = 0.6; Art.drawIcon(ctx, 'struct', g.struct, x, y - 12 * z, 10 * z, '#8fdcff'); ctx.restore(); }
      if (g.units && g.units.length) {
        const t0 = S_.map.tiles[g.hex]; if ((t0 && t0.struct) || g.struct) { x += 12 * z; y += 6 * z; }
        planRing(x, y, z); ctx.save(); ctx.globalAlpha = 0.8; drawToken(x, y, g.units, g.owner, z, { planned: true }); ctx.restore();
      }
    }
    drawProbs();
    drawFx(dt);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawWeather(dt);
    if (fx.flash > 0.01) { ctx.fillStyle = fx.flashCol; ctx.globalAlpha = Math.min(1, fx.flash); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; fx.flash *= Math.pow(0.04, dt); }
    const p4 = performance.now(), a = 0.08;
    perf.tiles += ((p1 - p0) - perf.tiles) * a; perf.fog += ((p2 - p1) - perf.fog) * a; perf.units += ((p3 - p2) - perf.units) * a; perf.rest += ((p4 - p3) - perf.rest) * a; perf.total += ((p4 - p0) - perf.total) * a;
    if (p4 - p0 > 30) { perf.slow.push({ at: +t.toFixed(2), layer: layerT === t && perf.why, board: +(p1 - p0).toFixed(1), overlay: +(p2 - p1).toFixed(1), units: +(p3 - p2).toFixed(1), fx: +(p4 - p3).toFixed(1) }); if (perf.slow.length > 30) perf.slow.shift(); }   // slow frames, for profiling
  }
  const perf = { tiles: 0, fog: 0, units: 0, rest: 0, total: 0, slow: [] };
  // Settings → Graphics: Low draws at 1× pixel density (much lighter on high-DPI screens and older machines)
  function setLowGfx(on) { lowGfx = !!on; try { localStorage.setItem('sector.gfx', on ? 'low' : 'high'); } catch (e) {} dispatchEvent(new Event('resize')); }

  return { setLowGfx, get lowGfx() { return lowGfx; }, invalidate, perf, flyover, missile, missileAt, drone, droneAt, init, setState, recolor, focus, fitMap, pan, zoomAt, hexAt, screenOf, topOf, world, ov, unitPos, unitHidden, extraUnits, burst, smoke, float, ring, beam, lance, emp, shake, flash, pop, cam, get time() { return t; }, get roads() { return roads; } };
})();
