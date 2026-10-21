/* SECTOR — skin painters: territory patterns, border auras and border lines. Used by the board and by the Locker previews.
   A territory skin is ONE big picture laid over a commander's whole territory (a flag draped across the land, camouflage
   whose blobs span several hexes), not a little stamp repeated on every hex. Each hex just shows its slice of it.
   Skins are blended over the player's own colour, so on the map you're still clearly you. */
const Skins = (() => {
  const TAU = Math.PI * 2;
  const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h)); return cv; };
  function star(c, x, y, r, points = 5, inner = 0.4, rot = -Math.PI / 2) {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) { const a = rot + i * Math.PI / points, rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }
  // ── seamless noise: value noise on a grid that wraps every `per` cells, so a texture tile repeats without seams ──
  function noise(seed, px, py = px) {
    const g = new Float32Array(px * py);
    let h = seed | 0; const rnd = () => { h = (h + 0x6D2B79F5) | 0; let x = Math.imul(h ^ (h >>> 15), 1 | h); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    const at = (x, y) => g[((y % py + py) % py) * px + ((x % px + px) % px)];
    return (u, v) => {   // u, v in cells
      const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  // fractal noise that still tiles: each octave doubles its grid, so it wraps at the same place
  function fbm(seed, px, oct = 3, py = px) {
    const ns = []; for (let o = 0; o < oct; o++) ns.push(noise(seed + o * 101, px << o, py << o));
    return (u, v) => { let s = 0, a = 1, n = 0; for (let o = 0; o < oct; o++) { s += ns[o](u * (1 << o), v * (1 << o)) * a; n += a; a *= 0.5; } return s / n; };
  }
  const rgb = s => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  // paint a tile pixel by pixel: f(u, v, x, y) (u, v 0..1 across the tile) returns [r, g, b] or null
  function pixels(T, f) {
    const cv = mk(T, T), c = cv.getContext('2d'), img = c.createImageData(T, T), d = img.data;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const p = f(x / T, y / T, x, y); if (!p) continue; const i = (y * T + x) * 4; d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255; }
    c.putImageData(img, 0, 0); return cv;
  }
  // layered camouflage: each layer is a noise field cut at a threshold, painted over the one before
  // (sx/sy stretch a layer's noise: tiger stripes are long and thin)
  function camo(seed, T, per, layers, base) {
    const fs = layers.map((l, i) => fbm(seed + i * 977, per * (l.sx || 1), 3, per * (l.sy || 1)));
    const cols = layers.map(l => rgb(l.col)), b = rgb(base);
    return pixels(T, (u, v) => {
      let out = b;
      for (let i = 0; i < layers.length; i++) { const L = layers[i]; if (fs[i](u * per * (L.sx || 1), v * per * (L.sy || 1)) > L.cut) out = cols[i]; }
      return out;
    });
  }

  // ───────── territory skins ─────────
  // tile: a seamless texture anchored to the world (size = board units it covers), drawn once
  // fit: a picture fitted to the territory's bounds (a flag), redrawn when the territory changes shape
  // alpha: how strongly it covers the owner's colour
  const U = 34;   // a hex's radius in board units
  const TERR = {
    't-wood': { kind: 'tile', size: U * 10, alpha: 0.7, make: T => camo(11, T, 5, [{ col: '#7d8a45', cut: 0.44 }, { col: '#5e4630', cut: 0.52 }, { col: '#1d2017', cut: 0.58 }], '#3a5530') },
    't-desert': { kind: 'tile', size: U * 11, alpha: 0.72, make: T => camo(23, T, 5, [{ col: '#946d44', cut: 0.45 }, { col: '#ead9ae', cut: 0.55 }], '#c4a571') },
    't-arctic': { kind: 'tile', size: U * 10, alpha: 0.72, make: T => camo(31, T, 5, [{ col: '#b3c2ce', cut: 0.45 }, { col: '#76879a', cut: 0.53 }, { col: '#36424e', cut: 0.6 }], '#f1f5f8') },
    't-tiger': { kind: 'tile', size: U * 9, alpha: 0.74, make: T => camo(47, T, 3, [{ col: '#8a7440', cut: 0.45, sy: 4 }, { col: '#14160e', cut: 0.53, sy: 5 }], '#4f6634') },
    't-digital': { kind: 'tile', size: U * 8, alpha: 0.7, make: T => {
      // MARPAT: the same kind of blobs as woodland, cut into square pixels
      const px = Math.max(4, Math.round(T / 72)), f1 = fbm(5, 4, 3), f2 = fbm(9, 4, 3), f3 = fbm(13, 4, 3), cols = ['#535f43', '#7a8460', '#2c3226', '#a3a183'].map(rgb);
      return pixels(T, (u, v, x, y) => { const qu = (Math.floor(x / px) * px) / T * 4, qv = (Math.floor(y / px) * px) / T * 4; return f3(qu, qv) > 0.6 ? cols[2] : f2(qu, qv) > 0.55 ? cols[1] : f1(qu, qv) > 0.62 ? cols[3] : cols[0]; });
    } },
    't-dazzle': { kind: 'tile', size: U * 12, alpha: 0.64, make: T => {
      // WWI dazzle camouflage: big slabs of hard-edged stripes, each at its own angle
      const cv = mk(T, T), c = cv.getContext('2d'); c.fillStyle = '#d9dde0'; c.fillRect(0, 0, T, T);
      let h = 77; const r = () => { h = (h * 16807) % 2147483647; return h / 2147483647; };
      for (let i = 0; i < 9; i++) {
        const pts = [], cx = r() * T, cy = r() * T, R = T * (0.18 + r() * 0.22), n = 3 + Math.floor(r() * 3);
        for (let j = 0; j < n; j++) { const a = j / n * TAU + r() * 0.8; pts.push([cx + Math.cos(a) * R * (0.6 + r() * 0.6), cy + Math.sin(a) * R * (0.6 + r() * 0.6)]); }
        const ang = r() * Math.PI, w = T / (14 + Math.floor(r() * 16)), dark = ['#15191d', '#2c3a4a', '#5e6c78'][i % 3];
        for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) {   // drawn at every wrap, so the tile repeats seamlessly
          c.save(); c.beginPath(); pts.forEach(([x, y], j) => j ? c.lineTo(x + ox, y + oy) : c.moveTo(x + ox, y + oy)); c.closePath(); c.clip();
          c.fillStyle = i % 4 === 3 ? '#f4f6f7' : '#9aa6b0'; c.fillRect(cx + ox - R * 2, cy + oy - R * 2, R * 4, R * 4);
          c.translate(cx + ox, cy + oy); c.rotate(ang); c.fillStyle = dark;
          for (let k = -Math.ceil(R * 2 / w); k < R * 2 / w; k += 2) c.fillRect(k * w, -R * 2, w, R * 4);
          c.restore();
        }
      }
      return cv;
    } },
    't-topo': { kind: 'tile', size: U * 18, alpha: 0.75, make: T => {
      // a topographic map: contour lines, every fifth one heavier
      const f = fbm(61, 3, 4), N = 22, base = rgb('#e8dcc0'), line = rgb('#8a6440'), idx = rgb('#3b2410');
      const Hm = new Float32Array(T * T); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) Hm[y * T + x] = f(x / T * 3, y / T * 3) * N;
      return pixels(T, (u, v, x, y) => {
        const a = Hm[y * T + x], r = Hm[y * T + (x + 1) % T], d = Hm[((y + 1) % T) * T + x];
        const lo = Math.floor(Math.min(a, r, d)), hi = Math.floor(Math.max(a, r, d));
        if (lo !== hi) return hi % 5 === 0 ? idx : line;
        return [base[0] - (a % 1) * 18, base[1] - (a % 1) * 14, base[2] - (a % 1) * 10];
      });
    } },
    't-carbon': { kind: 'tile', size: U * 2, alpha: 0.7, make: T => {
      const p = T / 8;
      return pixels(T, (u, v, x, y) => {
        const cx = Math.floor(x / p), cy = Math.floor(y / p), along = ((cx + cy) % 2 ? (y % p) : (x % p)) / p, sh = 0.5 + 0.5 * Math.sin(along * Math.PI);
        const g = (cx + cy) % 2 ? 26 + sh * 34 : 14 + sh * 22; return [g, g, g + 4];
      });
    } },
    't-hazard': { kind: 'tile', size: U * 4, alpha: 0.62, make: T => {
      const P = T / 4;   // stripe period: the tile holds a whole number of them, so it wraps
      return pixels(T, (u, v, x, y) => (x + y) % P < P / 2 ? [255, 196, 0] : [22, 22, 22]);
    } },
    // flags, draped across the whole territory
    't-usa': { kind: 'fit', ratio: 1.9, alpha: 0.7, draw(c, W, H) {
      for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#b22234'; c.fillRect(0, i * H / 13, W, H / 13 + 0.5); }
      const cw = W * 0.4, ch = H * 7 / 13; c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, cw, ch);
      c.fillStyle = '#ffffff';
      for (let row = 0; row < 9; row++) for (let col = 0; col < (row % 2 ? 5 : 6); col++)
        star(c, cw / 12 * (col * 2 + (row % 2 ? 2 : 1)), ch / 10 * (row + 1), Math.min(cw / 12, ch / 10) * 0.62);
    } },
    't-uk': { kind: 'fit', ratio: 2, alpha: 0.7, draw(c, W, H) {
      c.save(); c.scale(W / 60, H / 30);
      c.fillStyle = '#012169'; c.fillRect(0, 0, 60, 30);
      const saltire = () => { c.beginPath(); c.moveTo(0, 0); c.lineTo(60, 30); c.moveTo(60, 0); c.lineTo(0, 30); c.stroke(); };
      c.strokeStyle = '#ffffff'; c.lineWidth = 6; saltire();
      c.save(); c.clip(new Path2D('M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z')); c.strokeStyle = '#c8102e'; c.lineWidth = 4; saltire(); c.restore();
      c.strokeStyle = '#ffffff'; c.lineWidth = 10; c.beginPath(); c.moveTo(30, 0); c.lineTo(30, 30); c.moveTo(0, 15); c.lineTo(60, 15); c.stroke();
      c.strokeStyle = '#c8102e'; c.lineWidth = 6; c.stroke();
      c.restore();
    } },
    't-russia': { kind: 'fit', ratio: 1.5, alpha: 0.7, draw(c, W, H) { ['#ffffff', '#0039a6', '#d52b1e'].forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * H / 3, W, H / 3 + 0.5); }); } },
    't-nato': { kind: 'fit', ratio: 1.5, alpha: 0.68, draw(c, W, H, hx, hy, tilt) {
      c.fillStyle = '#002f6c'; c.fillRect(0, 0, W, H);
      const R = Math.min(W, H / tilt) * 0.2;
      c.save(); c.translate(hx, hy); c.scale(1, tilt);
      c.strokeStyle = '#ffffff'; c.lineWidth = R * 0.07;
      c.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.moveTo(dx * R * 1.18, dy * R * 1.18); c.lineTo(dx * (W + H / tilt) * 2, dy * (W + H / tilt) * 2); } c.stroke();
      c.lineWidth = R * 0.06; c.beginPath(); c.arc(0, 0, R * 0.8, 0, TAU); c.stroke();
      // the compass star: each point half white, half blue
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 - Math.PI / 2, l = R * 1.12, w = R * 0.24;
        for (const [side, col] of [[1, '#ffffff'], [-1, '#5b8ed6']]) { c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * l, Math.sin(a) * l); c.lineTo(Math.cos(a + side * Math.PI / 4) * w, Math.sin(a + side * Math.PI / 4) * w); c.closePath(); c.fill(); }
      }
      c.restore();
    } },
    't-jolly': { kind: 'fit', ratio: 1.5, alpha: 0.7, draw(c, W, H, hx, hy, tilt) {
      c.fillStyle = '#0d0d0f'; c.fillRect(0, 0, W, H);
      const R = Math.min(W, H / tilt) * 0.17;
      c.save(); c.translate(hx, hy); c.scale(1, tilt); c.fillStyle = '#f2efe6';
      // crossbones
      for (const s of [1, -1]) { c.save(); c.translate(0, R * 0.55); c.rotate(s * 0.75); c.fillRect(-R * 1.5, -R * 0.11, R * 3, R * 0.22); for (const e of [-1.5, 1.5]) for (const o of [-0.15, 0.15]) { c.beginPath(); c.arc(e * R, o * R, R * 0.17, 0, TAU); c.fill(); } c.restore(); }
      // skull
      c.beginPath(); c.ellipse(0, -R * 0.15, R * 0.78, R * 0.72, 0, 0, TAU); c.fill(); c.fillRect(-R * 0.42, R * 0.2, R * 0.84, R * 0.5);
      c.fillStyle = '#0d0d0f'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * R * 0.3, -R * 0.12, R * 0.2, R * 0.24, 0, 0, TAU); c.fill(); }
      c.beginPath(); c.moveTo(0, R * 0.12); c.lineTo(-R * 0.09, R * 0.3); c.lineTo(R * 0.09, R * 0.3); c.closePath(); c.fill();
      for (let i = -2; i <= 2; i++) c.fillRect(i * R * 0.16 - R * 0.02, R * 0.45, R * 0.04, R * 0.25);
      c.restore();
    } },
    't-founder': { kind: 'fit', ratio: 1.5, alpha: 0.8, draw(c, W, H, hx, hy, tilt) {
      const R = Math.max(W, H / tilt);
      const g = c.createRadialGradient(hx, hy, 0, hx, hy, R * 0.9); g.addColorStop(0, '#fff2bf'); g.addColorStop(0.35, '#e0b04a'); g.addColorStop(1, '#6e4a12');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.save(); c.translate(hx, hy); c.scale(1, tilt);
      c.globalAlpha = 0.18; c.fillStyle = '#fff6d6';
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - 0.05) * R * 2, Math.sin(a - 0.05) * R * 2); c.lineTo(Math.cos(a + 0.05) * R * 2, Math.sin(a + 0.05) * R * 2); c.closePath(); c.fill(); }
      c.globalAlpha = 1;
      // the laurel wreath round the HQ
      const r = Math.min(W, H / tilt) * 0.27;
      for (const sd of [-1, 1]) {
        c.strokeStyle = '#5a3a08'; c.lineWidth = r * 0.07; c.beginPath(); c.arc(0, 0, r, Math.PI / 2 + sd * 0.25, Math.PI / 2 + sd * 2.75, sd < 0); c.stroke();
        for (let i = 0; i < 9; i++) { const a = Math.PI / 2 + sd * (0.4 + i * 0.27); for (const o of [-1, 1]) { c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r); c.rotate(a + sd * Math.PI / 2 + o * 0.5); c.fillStyle = o > 0 ? '#fff0b8' : '#a87612'; c.beginPath(); c.ellipse(r * 0.13, 0, r * 0.15, r * 0.06, 0, 0, TAU); c.fill(); c.restore(); } }
      }
      c.fillStyle = '#fff8dc'; star(c, 0, -r * 1.35, r * 0.2);
      c.restore();
    } },
  };
  // fit a flag of the given ratio over the territory: stretch it a little if it must, crop the rest
  function fitRect(b, ratio) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    let fw = w, fh = h; const want = ratio / b.tilt;   // the board is seen at a tilt: a flag lying on it is squashed too
    if (fw / fh > want * 1.5) fh = fw / (want * 1.5); else if (fw / fh < want / 1.5) fw = fh * want / 1.5;
    return { x: cx - fw / 2, y: cy - fh / 2, w: fw, h: fh };
  }
  // the big picture for one territory: { canvas, x0, y0, k (canvas px per board unit), repeat }
  const tiles = {}, fits = new Map();
  function picture(id, box) {
    const T = TERR[id]; if (!T || typeof document === 'undefined') return null;
    if (T.kind === 'tile') {
      if (!tiles[id]) { const px = Math.min(512, Math.round(T.size * 1.1)); tiles[id] = { canvas: T.make(px), x0: 0, y0: 0, k: px / T.size, repeat: true }; }
      return tiles[id];
    }
    if (!box) return null;
    const pad = U * 1.4, b = { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad, tilt: box.tilt };
    const key = id + '|' + [b.x0, b.y0, b.x1, b.y1, box.hx, box.hy].map(v => Math.round(v || 0)).join(',');
    let p = fits.get(key); if (p) return p;
    const f = fitRect(b, T.ratio), k = Math.min(2, 1600 / Math.max(f.w, f.h));
    const cv = mk(f.w * k, f.h * k), c = cv.getContext('2d');
    c.scale(k, k);
    T.draw(c, f.w, f.h, (box.hx ?? (b.x0 + b.x1) / 2) - f.x, (box.hy ?? (b.y0 + b.y1) / 2) - f.y, box.tilt);
    // soft cloth folds, so it reads as a flag lying over the land rather than paint
    { const g = c.createLinearGradient(0, 0, f.w, f.h * 0.4); for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.14)'); c.fillStyle = g; c.fillRect(0, 0, f.w, f.h); }
    p = { canvas: cv, x0: f.x, y0: f.y, k, repeat: false };
    fits.set(key, p); if (fits.size > 32) fits.delete(fits.keys().next().value);
    return p;
  }
  // paint a hex's slice of the owner's territory skin. h: { cx, cy, s, z, wx, wy, box }: the hex's screen centre and radius,
  // screen px per board unit, its board position, and the territory's bounds { x0, y0, x1, y1, hx, hy, tilt } (board units)
  const pats = new WeakMap();
  function territory(c, id, h, hexPath) {
    const p = picture(id, h.box); if (!p) return;
    let pat = pats.get(p.canvas); if (!pat) { pat = c.createPattern(p.canvas, p.repeat ? 'repeat' : 'no-repeat'); pats.set(p.canvas, pat); }
    const sc = h.z / p.k;
    pat.setTransform(new DOMMatrix([sc, 0, 0, sc, h.cx + (p.x0 - h.wx) * h.z, h.cy + (p.y0 - h.wy) * h.z]));
    c.save(); c.globalAlpha = TERR[id].alpha; c.fillStyle = pat; hexPath(h.cx, h.cy, h.s); c.fill(); c.restore();
  }

  // ───────── border auras: a glow round your frontier, drawn under the line ─────────
  // segs: the frontier edges on screen, { ax, ay, bx, by, nx, ny } with n pointing out of your territory
  const jit = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
  const at = (g, t, out = 0) => [g.ax + (g.bx - g.ax) * t + g.nx * out, g.ay + (g.by - g.ay) * t + g.ny * out];
  const BORDER = {
    'b-neon': (c, z, col) => { c.shadowColor = col; c.shadowBlur = 26 * z; c.strokeStyle = col; c.globalAlpha = 0.5; c.lineWidth = 12 * z; c.stroke(); c.globalAlpha = 1; c.shadowBlur = 12 * z; c.lineWidth = 4 * z; c.stroke(); c.shadowBlur = 6 * z; c.shadowColor = '#fff'; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.6 * z; c.stroke(); },
    'b-gold': (c, z) => {
      c.shadowColor = 'rgba(255,207,74,.9)'; c.shadowBlur = 12 * z; c.strokeStyle = '#8a5a0e'; c.lineWidth = 9 * z; c.stroke(); c.shadowBlur = 0;
      c.strokeStyle = '#ffd56a'; c.lineWidth = 6 * z; c.stroke(); c.strokeStyle = '#fff4c4'; c.lineWidth = 1.6 * z; c.stroke();
    },
    'b-frost': (c, z, col, segs) => {
      c.shadowColor = '#bff3ff'; c.shadowBlur = 20 * z; c.strokeStyle = 'rgba(220,248,255,.9)'; c.lineWidth = 3.5 * z; c.stroke(); c.shadowBlur = 4 * z;
      // ice crystals growing outward
      c.strokeStyle = 'rgba(235,252,255,.95)'; c.lineWidth = 1.3 * z; c.beginPath();
      segs.forEach((g, i) => { for (const t of [0.25, 0.7]) {
        const L = (5 + jit(i, t * 10) * 7) * z, [x, y] = at(g, t), [mx, my] = at(g, t, L * 0.5);
        c.moveTo(x, y); c.lineTo(x + g.nx * L, y + g.ny * L);
        for (const sd of [-1, 1]) { c.moveTo(mx, my); c.lineTo(mx + (g.nx - sd * g.ny) * L * 0.3, my + (g.ny + sd * g.nx) * L * 0.3); }
      } });
      c.stroke();
    },
    'b-ember': (c, z, col, segs) => {
      c.shadowColor = '#ff5a10'; c.shadowBlur = 22 * z; c.strokeStyle = '#ff7a1a'; c.lineWidth = 3.5 * z; c.stroke();
      c.shadowBlur = 8 * z; c.shadowColor = '#ffb03a';
      segs.forEach((g, i) => { for (let j = 0; j < 4; j++) { const [x, y] = at(g, jit(i, j), jit(j, i) * 12 * z); c.fillStyle = j % 2 ? '#fff3a8' : '#ffb03a'; c.beginPath(); c.arc(x, y - jit(i + 3, j) * 6 * z, (0.8 + jit(j + 7, i) * 1.4) * z, 0, TAU); c.fill(); } });
    },
    'b-static': (c, z, col, segs) => {
      // a crackling arc: the frontier redrawn as jagged lightning
      c.shadowColor = '#9fe8ff'; c.shadowBlur = 12 * z; c.lineJoin = 'miter';
      for (const [w, amp, colr] of [[3.2, 1, 'rgba(160,232,255,.7)'], [1.4, 0.6, '#ffffff']]) {
        c.strokeStyle = colr; c.lineWidth = w * z; c.beginPath();
        segs.forEach((g, i) => { c.moveTo(g.ax, g.ay); for (let j = 1; j < 6; j++) { const [x, y] = at(g, j / 6, (jit(i, j) - 0.5) * 9 * z * amp); c.lineTo(x, y); } c.lineTo(g.bx, g.by); });
        c.stroke();
      }
    },
    'b-void': (c, z, col, segs) => {
      c.shadowColor = '#7a2bff'; c.shadowBlur = 26 * z; c.strokeStyle = 'rgba(28,0,58,.95)'; c.lineWidth = 9 * z; c.stroke();
      // dark tendrils seeping outward
      c.shadowBlur = 10 * z; c.strokeStyle = 'rgba(122,43,255,.75)'; c.lineWidth = 1.6 * z; c.lineCap = 'round'; c.beginPath();
      segs.forEach((g, i) => { const t = 0.2 + jit(i, 1) * 0.6, [x, y] = at(g, t), L = (8 + jit(i, 2) * 10) * z, bend = (jit(i, 3) - 0.5) * 10 * z; c.moveTo(x, y); c.quadraticCurveTo(x + g.nx * L * 0.5 - g.ny * bend, y + g.ny * L * 0.5 + g.nx * bend, x + g.nx * L, y + g.ny * L); });
      c.stroke();
    },
  };
  // auras and lines may draw shapes of their own: put the frontier path back for whatever strokes it next
  const repath = (c, segs) => { c.beginPath(); for (const g of segs) { c.moveTo(g.ax, g.ay); c.lineTo(g.bx, g.by); } };
  function border(c, id, z, col, segs) { const f = BORDER[id]; if (!f) return; segs = segs || []; c.save(); f(c, z, col, segs); c.restore(); repath(c, segs); }

  // ───────── border lines: the frontier line itself, always in your colour. Returns true if it replaced the plain line ─────────
  const TRIM = {
    'h-double': (c, z, col) => {
      c.strokeStyle = col; c.globalAlpha = 0.3; c.lineWidth = 10 * z; c.stroke(); c.globalAlpha = 1;
      c.lineWidth = 6 * z; c.stroke(); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 3 * z; c.stroke(); c.strokeStyle = col; c.lineWidth = 1.4 * z; c.stroke();
    },
    'h-tactical': (c, z, col, segs) => {
      // a military map boundary: a hard line with ticks along the outside
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 6 * z; c.stroke(); c.strokeStyle = col; c.lineWidth = 3.6 * z; c.stroke();
      c.lineWidth = 2.4 * z; c.lineCap = 'butt'; c.beginPath();
      for (const g of segs) for (const t of [0.2, 0.5, 0.8]) { const [x, y] = at(g, t), [x2, y2] = at(g, t, 6 * z); c.moveTo(x, y); c.lineTo(x2, y2); }
      c.stroke();
    },
    'h-barbed': (c, z, col, segs) => {
      c.strokeStyle = col; c.globalAlpha = 0.4; c.lineWidth = 8 * z; c.stroke(); c.globalAlpha = 1;
      // two twisted strands
      c.lineWidth = 1.3 * z;
      for (const ph of [0, Math.PI]) {
        c.beginPath();
        for (const g of segs) { const L = Math.hypot(g.bx - g.ax, g.by - g.ay), n = Math.max(4, Math.round(L / (2 * z))); for (let j = 0; j <= n; j++) { const t = j / n, [x, y] = at(g, t, Math.sin(t * L / (5 * z) + ph) * 2.2 * z); j ? c.lineTo(x, y) : c.moveTo(x, y); } }
        c.strokeStyle = ph ? '#6a6a6a' : '#1c1c1c'; c.stroke();
      }
      // barbs, and a post at every corner
      c.strokeStyle = '#2a2a2a'; c.lineWidth = 1.2 * z; c.beginPath();
      for (const g of segs) for (const t of [0.17, 0.5, 0.83]) { const [x, y] = at(g, t), d = 3 * z; c.moveTo(x - d, y - d); c.lineTo(x + d, y + d); c.moveTo(x + d, y - d); c.lineTo(x - d, y + d); }
      c.stroke();
      c.fillStyle = '#4a3a26'; for (const g of segs) { c.beginPath(); c.arc(g.ax, g.ay, 2.4 * z, 0, TAU); c.fill(); }
    },
    'h-sandbag': (c, z, col, segs) => {
      c.strokeStyle = col; c.lineWidth = 4 * z; c.stroke();
      for (const g of segs) {
        const L = Math.hypot(g.bx - g.ax, g.by - g.ay), n = Math.max(2, Math.round(L / (9 * z))), a = Math.atan2(g.by - g.ay, g.bx - g.ax);
        for (let j = 0; j < n; j++) {
          const [x, y] = at(g, (j + 0.5) / n, 2.5 * z);
          c.save(); c.translate(x, y); c.rotate(a);
          c.fillStyle = '#b39b6a'; c.strokeStyle = '#5e4e2e'; c.lineWidth = 1 * z; c.beginPath(); c.ellipse(0, 0, L / n * 0.55, 3.2 * z, 0, 0, TAU); c.fill(); c.stroke();
          c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(-L / n * 0.1, -1 * z, L / n * 0.3, 1 * z, 0, 0, TAU); c.fill();
          c.restore();
        }
      }
    },
    'h-teeth': (c, z, col, segs) => {
      // dragon's teeth: concrete pyramids along the frontier
      c.strokeStyle = col; c.lineWidth = 4 * z; c.stroke();
      for (const g of segs) for (const t of [0.25, 0.75]) {
        const [x, y] = at(g, t, 5 * z), r = 3.4 * z;
        c.fillStyle = '#c9c4b8'; c.beginPath(); c.moveTo(x, y - r * 1.3); c.lineTo(x + r, y + r * 0.6); c.lineTo(x - r, y + r * 0.6); c.closePath(); c.fill();
        c.fillStyle = '#8b867a'; c.beginPath(); c.moveTo(x, y - r * 1.3); c.lineTo(x + r, y + r * 0.6); c.lineTo(x + r * 0.15, y + r * 0.6); c.closePath(); c.fill();
      }
    },
    'h-laser': (c, z, col, segs) => {
      c.shadowColor = col; c.shadowBlur = 14 * z; c.strokeStyle = col; c.lineWidth = 3.5 * z; c.stroke();
      c.shadowBlur = 4 * z; c.shadowColor = '#fff'; c.strokeStyle = '#ffffff'; c.lineWidth = 1.2 * z; c.stroke();
      c.shadowBlur = 0; c.fillStyle = '#ffffff'; for (const g of segs) { c.beginPath(); c.arc(g.ax, g.ay, 2.2 * z, 0, TAU); c.fill(); }   // emitters at the corners
    },
    'h-plate': (c, z, col, segs) => {
      c.strokeStyle = '#2b2f33'; c.lineWidth = 8 * z; c.stroke(); c.strokeStyle = '#7d868e'; c.lineWidth = 6 * z; c.stroke(); c.strokeStyle = col; c.lineWidth = 2.4 * z; c.stroke();
      c.fillStyle = '#d6dde2'; for (const g of segs) for (const t of [0.15, 0.5, 0.85]) { const [x, y] = at(g, t, 2 * z); c.beginPath(); c.arc(x, y, 1.1 * z, 0, TAU); c.fill(); }
    },
  };
  function trim(c, id, z, col, segs) { const f = TRIM[id]; if (!f) return false; segs = segs || []; c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; f(c, z, col, segs); c.restore(); repath(c, segs); return true; }

  // ── Locker previews: an island in a colour wearing a skin (19 hexes for territory, so the big picture shows) ──
  function preview(canvas, slot, id, color = '#36a3ff') {
    const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height, TILT = 0.62, R = slot === 'territory' ? 2 : 1;
    const s = slot === 'territory' ? W / 9.2 : W / 6.4, z = s / 40.6;
    c.clearRect(0, 0, W, H);
    const hexPath = (x, y, r) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * TILT); } c.closePath(); };
    const cells = []; for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (Math.abs(q + r) <= R) cells.push([q, r]);
    const pos = ([q, r]) => [W / 2 + s * Math.sqrt(3) * (q + r / 2), H / 2 + s * 1.5 * r * TILT];
    // board units, so the preview shows the same picture the board would
    const wpos = ([q, r]) => [U * Math.sqrt(3) * (q + r / 2), U * 1.5 * r * TILT];
    const ws = cells.map(wpos), box = { x0: Math.min(...ws.map(p => p[0])), x1: Math.max(...ws.map(p => p[0])), y0: Math.min(...ws.map(p => p[1])), y1: Math.max(...ws.map(p => p[1])), hx: 0, hy: 0, tilt: TILT };
    for (const cell of cells) {
      const [x, y] = pos(cell), [wx, wy] = wpos(cell);
      c.fillStyle = 'rgba(0,0,0,.45)'; hexPath(x, y + 6 * z, s * 0.97); c.fill();
      c.fillStyle = color; hexPath(x, y, s * 0.97); c.fill();
      if (slot === 'territory') territory(c, id, { cx: x, cy: y, s: s * 0.97, z: s / U, wx, wy, box }, hexPath);
    }
    // the island's frontier
    const segs = []; c.beginPath();
    const corner = i => { const a = -Math.PI / 2 + i * Math.PI / 3; return [Math.cos(a), Math.sin(a)]; };
    const nbr = [[1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]];   // the neighbour across the edge from corner i to i + 1
    for (const cell of cells) {
      const [x, y] = pos(cell);
      for (let i = 0; i < 6; i++) {
        const nb = [cell[0] + nbr[i][0], cell[1] + nbr[i][1]]; if (cells.some(o => o[0] === nb[0] && o[1] === nb[1])) continue;
        const a = corner(i), b = corner((i + 1) % 6), ss = s * 0.97;
        const ax = x + a[0] * ss, ay = y + a[1] * ss * TILT, bx = x + b[0] * ss, by = y + b[1] * ss * TILT;
        let nx = (ax + bx) / 2 - x, ny = (ay + by) / 2 - y; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        c.moveTo(ax, ay); c.lineTo(bx, by); segs.push({ ax, ay, bx, by, nx, ny });
      }
    }
    if (slot === 'border') border(c, id, z * 1.2, color, segs);
    if (!(slot === 'trim' && trim(c, id, z * 1.2, color, segs))) { c.lineCap = 'round'; c.strokeStyle = color; c.globalAlpha = 0.35; c.lineWidth = 9 * z; c.stroke(); c.globalAlpha = 1; c.lineWidth = 4 * z; c.stroke(); }
  }
  return { territory, border, trim, preview, picture, TERR, BORDER, TRIM };
})();
