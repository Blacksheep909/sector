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
  // flag helpers: horizontal (or vertical) bands, and a Nordic cross through the HQ
  function bands(c, W, H, cols, vertical) { cols.forEach((col, i) => { c.fillStyle = col; if (vertical) c.fillRect(i * W / cols.length, 0, W / cols.length + 0.5, H); else c.fillRect(0, i * H / cols.length, W, H / cols.length + 0.5); }); }
  function nordic(c, W, H, hx, hy, tilt, field, crosses) {
    c.fillStyle = field; c.fillRect(0, 0, W, H);
    for (const [col, w] of crosses) { const t = H * w; c.fillStyle = col; c.fillRect(0, hy - t / 2, W, t); c.fillRect(hx - t / 2, 0, t, H); }
  }
  const jitF = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
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
    // ── more countries. Emblems and crosses are centred on your HQ, so the flag is laid out around your capital ──
    't-germany': { kind: 'fit', ratio: 1.67, alpha: 0.7, draw: (c, W, H) => bands(c, W, H, ['#1a1a1a', '#dd0000', '#ffce00']) },
    't-france': { kind: 'fit', ratio: 1.5, alpha: 0.7, draw: (c, W, H) => bands(c, W, H, ['#0055a4', '#ffffff', '#ef4135'], true) },
    't-italy': { kind: 'fit', ratio: 1.5, alpha: 0.7, draw: (c, W, H) => bands(c, W, H, ['#009246', '#ffffff', '#ce2b37'], true) },
    't-ireland': { kind: 'fit', ratio: 2, alpha: 0.7, draw: (c, W, H) => bands(c, W, H, ['#169b62', '#ffffff', '#ff883e'], true) },
    't-netherlands': { kind: 'fit', ratio: 1.5, alpha: 0.7, draw: (c, W, H) => bands(c, W, H, ['#ae1c28', '#ffffff', '#21468b']) },
    't-poland': { kind: 'fit', ratio: 1.6, alpha: 0.7, draw: (c, W, H) => bands(c, W, H, ['#ffffff', '#dc143c']) },
    't-ukraine': { kind: 'fit', ratio: 1.5, alpha: 0.7, draw: (c, W, H) => bands(c, W, H, ['#0057b7', '#ffd700']) },
    't-spain': { kind: 'fit', ratio: 1.5, alpha: 0.7, draw: (c, W, H) => { c.fillStyle = '#aa151b'; c.fillRect(0, 0, W, H); c.fillStyle = '#f1bf00'; c.fillRect(0, H / 4, W, H / 2); } },
    't-sweden': { kind: 'fit', ratio: 1.6, alpha: 0.7, draw: (c, W, H, hx, hy, tilt) => nordic(c, W, H, hx, hy, tilt, '#006aa7', [['#fecc00', 0.13]]) },
    't-norway': { kind: 'fit', ratio: 1.38, alpha: 0.7, draw: (c, W, H, hx, hy, tilt) => nordic(c, W, H, hx, hy, tilt, '#ba0c2f', [['#ffffff', 0.16], ['#00205b', 0.08]]) },
    't-denmark': { kind: 'fit', ratio: 1.32, alpha: 0.7, draw: (c, W, H, hx, hy, tilt) => nordic(c, W, H, hx, hy, tilt, '#c8102e', [['#ffffff', 0.12]]) },
    't-scotland': { kind: 'fit', ratio: 1.67, alpha: 0.7, draw(c, W, H, hx, hy) {
      c.fillStyle = '#005eb8'; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#ffffff'; c.lineWidth = H * 0.2; c.lineCap = 'butt'; const L = W + H;
      c.beginPath(); c.moveTo(hx - L, hy - L * H / W); c.lineTo(hx + L, hy + L * H / W); c.moveTo(hx + L, hy - L * H / W); c.lineTo(hx - L, hy + L * H / W); c.stroke();
    } },
    't-japan': { kind: 'fit', ratio: 1.5, alpha: 0.72, draw(c, W, H, hx, hy, tilt) {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
      const R = Math.min(U * 1.15, Math.min(W, H / tilt) * 0.16); c.save(); c.translate(hx, hy); c.scale(1, tilt); c.fillStyle = '#bc002d';   // about a hex across, round your capital c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill(); c.restore();
    } },
    't-korea': { kind: 'fit', ratio: 1.5, alpha: 0.72, draw(c, W, H, hx, hy, tilt) {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
      const R = Math.min(W, H / tilt) * 0.2; c.save(); c.translate(hx, hy); c.scale(1, tilt); c.rotate(-0.59);
      // the taegeuk: red over blue, each swelling into the other
      c.fillStyle = '#cd2e3a'; c.beginPath(); c.arc(0, 0, R, Math.PI, 0); c.fill();
      c.fillStyle = '#0047a0'; c.beginPath(); c.arc(0, 0, R, 0, Math.PI); c.fill();
      c.fillStyle = '#cd2e3a'; c.beginPath(); c.arc(R / 2, 0, R / 2, 0, Math.PI); c.fill();
      c.fillStyle = '#0047a0'; c.beginPath(); c.arc(-R / 2, 0, R / 2, Math.PI, TAU); c.fill();
      c.restore();
      // the four trigrams at the corners
      c.save(); c.translate(hx, hy); c.scale(1, tilt); c.fillStyle = '#000000';
      const bars = [[1, 1, 1], [0, 1, 0], [1, 0, 1], [0, 0, 0]];
      [[-1, -1], [1, 1], [1, -1], [-1, 1]].forEach(([sx, sy], i) => {
        c.save(); c.translate(sx * R * 1.75, sy * R * 1.15); c.rotate(Math.atan2(sy, sx) + Math.PI / 2);
        bars[i].forEach((solid, j) => { const y = (j - 1) * R * 0.17, w = R * 0.5, h = R * 0.11; if (solid) c.fillRect(-w / 2, y - h / 2, w, h); else { c.fillRect(-w / 2, y - h / 2, w * 0.45, h); c.fillRect(w * 0.05, y - h / 2, w * 0.45, h); } });
        c.restore();
      });
      c.restore();
    } },
    't-china': { kind: 'fit', ratio: 1.5, alpha: 0.7, draw(c, W, H, hx, hy, tilt) {
      c.fillStyle = '#de2910'; c.fillRect(0, 0, W, H);
      const R = Math.min(W, H / tilt) * 0.16; c.save(); c.translate(hx, hy); c.scale(1, tilt); c.fillStyle = '#ffde00';
      star(c, 0, 0, R);
      for (const [x, y] of [[1.7, -1.1], [2.2, -0.45], [2.2, 0.45], [1.7, 1.1]]) star(c, x * R, y * R, R * 0.33, 5, 0.4, Math.atan2(-y, -x));
      c.restore();
    } },
    't-india': { kind: 'fit', ratio: 1.5, alpha: 0.72, draw(c, W, H, hx, hy, tilt) {
      bands(c, W, H, ['#ff9933', '#ffffff', '#138808']);
      const R = Math.min(W, H / tilt) * 0.12; c.save(); c.translate(hx, hy); c.scale(1, tilt);
      c.strokeStyle = '#000080'; c.lineWidth = R * 0.1; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke();
      c.lineWidth = R * 0.04; c.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; c.moveTo(0, 0); c.lineTo(Math.cos(a) * R, Math.sin(a) * R); } c.stroke();
      c.fillStyle = '#000080'; c.beginPath(); c.arc(0, 0, R * 0.18, 0, TAU); c.fill();
      c.restore();
    } },
    't-canada': { kind: 'fit', ratio: 2, alpha: 0.72, draw(c, W, H, hx, hy, tilt) {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
      const R = Math.min(W, H / tilt) * 0.24;
      c.fillStyle = '#d52b1e'; c.fillRect(0, 0, Math.max(0, hx - R * 1.9), H); c.fillRect(hx + R * 1.9, 0, W, H);
      // the maple leaf
      c.save(); c.translate(hx, hy); c.scale(R / 10, R / 10 * tilt);
      c.fill(new Path2D('M0,-10 L1.6,-6.6 L3.6,-7.4 L3,-3 L6,-6 L6.6,-4.2 L9.2,-4.8 L8.2,-2 L9.8,-1.2 L5.6,2.2 L6.4,4 L1.2,3.4 L1.4,8.6 L-1.4,8.6 L-1.2,3.4 L-6.4,4 L-5.6,2.2 L-9.8,-1.2 L-8.2,-2 L-9.2,-4.8 L-6.6,-4.2 L-6,-6 L-3,-3 L-3.6,-7.4 L-1.6,-6.6 Z'));
      c.restore();
    } },
    't-brazil': { kind: 'fit', ratio: 1.43, alpha: 0.72, draw(c, W, H, hx, hy, tilt) {
      c.fillStyle = '#009c3b'; c.fillRect(0, 0, W, H);
      const R = Math.min(W, H / tilt) * 0.22; c.save(); c.translate(hx, hy); c.scale(1, tilt);
      c.fillStyle = '#ffdf00'; c.beginPath(); c.moveTo(-R * 2.2, 0); c.lineTo(0, -R * 1.45); c.lineTo(R * 2.2, 0); c.lineTo(0, R * 1.45); c.closePath(); c.fill();
      c.fillStyle = '#002776'; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip(); c.strokeStyle = '#ffffff'; c.lineWidth = R * 0.16; c.beginPath(); c.arc(-R * 0.3, R * 1.9, R * 2.2, -Math.PI * 0.72, -Math.PI * 0.32); c.stroke(); c.restore();
      c.fillStyle = '#ffffff'; for (let i = 0; i < 9; i++) { const a = jitF(i, 3) * TAU, r = R * (0.35 + jitF(i, 4) * 0.45); star(c, Math.cos(a) * r, Math.sin(a) * r + R * 0.15, R * 0.06); }
      c.restore();
    } },
    't-australia': { kind: 'fit', ratio: 2, alpha: 0.72, draw(c, W, H) {
      c.fillStyle = '#012169'; c.fillRect(0, 0, W, H);
      // the Union Jack in the canton
      c.save(); c.scale(0.5, 0.5); TERR['t-uk'].draw(c, W, H); c.restore();
      c.fillStyle = '#ffffff';
      star(c, W * 0.25, H * 0.75, H * 0.15, 7, 0.45);   // the Commonwealth Star
      for (const [x, y, r] of [[0.75, 0.83, 0.07], [0.62, 0.48, 0.07], [0.75, 0.18, 0.07], [0.87, 0.4, 0.07], [0.8, 0.58, 0.04]]) star(c, W * x, H * y, H * r, 7, 0.45);
    } },
    // ── more patterns ──
    't-blueprint': { kind: 'tile', size: U * 6, alpha: 0.78, make: T => {
      const cv = mk(T, T), c = cv.getContext('2d'); c.fillStyle = '#1d4f91'; c.fillRect(0, 0, T, T);
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; for (let i = 0; i <= T; i += T / 24) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, T); c.moveTo(0, i); c.lineTo(T, i); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.4; for (let i = 0; i <= T; i += T / 4) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, T); c.moveTo(0, i); c.lineTo(T, i); c.stroke(); }
      // drawings: a gear, a bolt, dimension lines
      c.strokeStyle = 'rgba(235,245,255,.75)'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(T * 0.3, T * 0.32, T * 0.12, 0, TAU); c.stroke(); c.beginPath(); c.arc(T * 0.3, T * 0.32, T * 0.05, 0, TAU); c.stroke();
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; c.beginPath(); c.moveTo(T * 0.3 + Math.cos(a) * T * 0.12, T * 0.32 + Math.sin(a) * T * 0.12); c.lineTo(T * 0.3 + Math.cos(a) * T * 0.15, T * 0.32 + Math.sin(a) * T * 0.15); c.stroke(); }
      c.strokeRect(T * 0.58, T * 0.55, T * 0.28, T * 0.16); c.beginPath(); c.moveTo(T * 0.58, T * 0.8); c.lineTo(T * 0.86, T * 0.8); c.moveTo(T * 0.58, T * 0.77); c.lineTo(T * 0.58, T * 0.83); c.moveTo(T * 0.86, T * 0.77); c.lineTo(T * 0.86, T * 0.83); c.stroke();
      c.setLineDash([4, 3]); c.beginPath(); c.moveTo(T * 0.1, T * 0.7); c.lineTo(T * 0.45, T * 0.92); c.stroke(); c.setLineDash([]);
      return cv;
    } },
    't-circuit': { kind: 'tile', size: U * 7, alpha: 0.8, make: T => {
      const cv = mk(T, T), c = cv.getContext('2d'); c.fillStyle = '#0d3b24'; c.fillRect(0, 0, T, T);
      const G = T / 16; let h = 991; const r = () => { h = (h * 16807) % 2147483647; return h / 2147483647; };
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (let n = 0; n < 34; n++) {
        let x = Math.floor(r() * 16), y = Math.floor(r() * 16); const pts = [[x, y]];
        for (let s = 0; s < 4; s++) { const d = Math.floor(r() * 4), L = 1 + Math.floor(r() * 4); if (d === 0) x += L; else if (d === 1) x -= L; else if (d === 2) y += L; else y -= L; pts.push([x, y]); }
        for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) {
          c.strokeStyle = '#c98a3a'; c.lineWidth = G * 0.28; c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(px * G + ox, py * G + oy) : c.moveTo(px * G + ox, py * G + oy)); c.stroke();
          for (const [px, py] of [pts[0], pts[pts.length - 1]]) { c.fillStyle = '#e8b45a'; c.beginPath(); c.arc(px * G + ox, py * G + oy, G * 0.34, 0, TAU); c.fill(); c.fillStyle = '#0d3b24'; c.beginPath(); c.arc(px * G + ox, py * G + oy, G * 0.13, 0, TAU); c.fill(); }
        }
      }
      for (let n = 0; n < 4; n++) { const x = Math.floor(r() * 14) * G, y = Math.floor(r() * 14) * G; c.fillStyle = '#16171a'; c.fillRect(x, y, G * 2.4, G * 1.6); c.fillStyle = '#9aa1a8'; for (let i = 0; i < 4; i++) { c.fillRect(x + G * (0.2 + i * 0.55), y - G * 0.3, G * 0.25, G * 0.3); c.fillRect(x + G * (0.2 + i * 0.55), y + G * 1.6, G * 0.25, G * 0.3); } }
      return cv;
    } },
    't-lava': { kind: 'tile', size: U * 10, alpha: 0.82, make: T => {
      // cooled black rock split by glowing cracks
      const f = fbm(71, 5, 4), g = fbm(73, 3, 2);
      return pixels(T, (u, v) => {
        const n = f(u * 5, v * 5), d = Math.abs(n - 0.5), heat = g(u * 3, v * 3);
        if (d < 0.025) return [255, 210 - d * 2000, 60];
        if (d < 0.06) { const k = 1 - (d - 0.025) / 0.035; return [60 + 190 * k, 20 + 70 * k * k, 10]; }
        const r = 28 + heat * 30 + (n > 0.5 ? 6 : 0); return [r, r * 0.8, r * 0.75];
      });
    } },
    't-nightvision': { kind: 'tile', size: U * 4, alpha: 0.78, make: T => {
      // green phosphor, grain and scan lines
      const f = fbm(81, 4, 3);
      return pixels(T, (u, v, x, y) => { const g = 60 + f(u * 4, v * 4) * 110 + (jitF(x, y) - 0.5) * 50 - (y % 4 < 1 ? 30 : 0); return [g * 0.25, Math.max(0, g), g * 0.3]; });
    } },
    't-splinter': { kind: 'tile', size: U * 12, alpha: 0.66, make: T => {
      // Splittertarn: hard-edged splinters of green and brown, with rain streaks
      const cv = mk(T, T), c = cv.getContext('2d'); c.fillStyle = '#a6a07a'; c.fillRect(0, 0, T, T);
      let h = 4243; const r = () => { h = (h * 16807) % 2147483647; return h / 2147483647; };
      for (let i = 0; i < 26; i++) {
        const cx = r() * T, cy = r() * T, pts = [], n = 3 + Math.floor(r() * 3), R = T * (0.07 + r() * 0.12);
        for (let j = 0; j < n; j++) { const a = j / n * TAU + r(); pts.push([cx + Math.cos(a) * R * (0.5 + r()), cy + Math.sin(a) * R * (0.5 + r()) * 0.6]); }
        c.fillStyle = i % 3 ? '#5f6b3e' : '#6e4f33';
        for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) { c.beginPath(); pts.forEach(([x, y], j) => j ? c.lineTo(x + ox, y + oy) : c.moveTo(x + ox, y + oy)); c.closePath(); c.fill(); }
      }
      c.strokeStyle = 'rgba(40,52,30,.55)'; c.lineWidth = Math.max(1, T / 260);
      for (let i = 0; i < 160; i++) { const x = r() * T, y = r() * T; c.beginPath(); c.moveTo(x, y); c.lineTo(x + T * 0.004, y + T * 0.03); c.stroke(); }
      return cv;
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

  // ───────── border auras: animated light round your frontier ─────────
  // Drawn every frame in board units (a hex is 34 across the middle), over the board, along F = { path, segs, view }:
  // path is the whole frontier as a Path2D, segs its edges { ax, ay, bx, by, nx, ny } (n points out of your land),
  // view the visible board rectangle (particles outside it are skipped). Glows are additive light, built from soft
  // layered strokes and pre-rendered sprites rather than shadowBlur, so they stay crisp and cheap.
  const jit = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
  const at = (g, t, out = 0) => [g.ax + (g.bx - g.ax) * t + g.nx * out, g.ay + (g.by - g.ay) * t + g.ny * out];
  const sprites = {};
  // a soft round glow, cached per colour
  function dot(col) {
    if (sprites[col]) return sprites[col];
    const cv = mk(64, 64), c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, col); g.addColorStop(0.5, col.length === 7 ? col + '55' : col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); return (sprites[col] = cv);
  }
  // a vertical curtain of light that fades upward, cached per colour
  function curtain(col) {
    const k = 'cur' + col; if (sprites[k]) return sprites[k];
    const cv = mk(16, 128), c = cv.getContext('2d'), g = c.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, col); g.addColorStop(0.25, col + 'aa'); g.addColorStop(1, col + '00');
    const h = c.createLinearGradient(0, 0, 16, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, '#000'); h.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 16, 128); c.globalCompositeOperation = 'destination-in'; c.fillStyle = h; c.fillRect(0, 0, 16, 128);
    return (sprites[k] = cv);
  }
  // soft bloom: wide faint strokes under narrow bright ones
  function bloom(c, path, col, w, strength = 1, layers = [[4, 0.05], [2.6, 0.09], [1.6, 0.18], [1, 0.42]]) {
    c.strokeStyle = col; for (const [m, a] of layers) { c.globalAlpha = Math.min(1, a * strength); c.lineWidth = w * m; c.stroke(path); } c.globalAlpha = 1;
  }
  const inView = (g, v) => !v || (g.ax > v.x0 && g.ax < v.x1 && g.ay > v.y0 && g.ay < v.y1);
  const add = c => { c.globalCompositeOperation = 'lighter'; };
  // each aura: glow (the soft light, baked into the cached board when it changes) and anim (the cheap moving parts, every frame)
  const AURA = {
    'b-neon': {
      glow(c, F, col) { add(c); bloom(c, F.path, col, 7, 1.15); },
      anim(c, F, t, col) { const fl = 0.85 + 0.15 * Math.sin(t * 31) * Math.sin(t * 7.3); add(c); c.globalAlpha = 0.9 * fl; c.strokeStyle = '#ffffff'; c.lineWidth = 1.6; c.stroke(F.path); c.globalAlpha = 0.5 * fl; c.strokeStyle = col; c.lineWidth = 4; c.stroke(F.path); },
    },
    'b-pulse': {
      // sonar: a ring of light ripples outward from your frontier, and a bright ping runs along it
      glow(c, F, col) { add(c); bloom(c, F.path, col, 4, 0.8); },
      anim(c, F, t, col) {
        add(c); const ph = (t * 0.6) % 1;
        c.strokeStyle = col; c.globalAlpha = 0.3 * (1 - ph); c.lineWidth = 4 + ph * 34; c.stroke(F.path);
        c.setLineDash([10, 150]); c.lineDashOffset = -t * 120; c.strokeStyle = '#ffffff'; c.globalAlpha = 0.9; c.lineWidth = 3; c.stroke(F.path); c.setLineDash([]);
      },
    },
    'b-frost': {
      glow(c, F) { add(c); bloom(c, F.path, '#8fdcff', 6, 1); c.globalAlpha = 0.85; c.strokeStyle = 'rgba(235,250,255,.85)'; c.lineWidth = 1.4; c.stroke(F.path); },
      anim(c, F, t) {
        // ice crystals that catch the light, and snow drifting off the edge
        add(c); const sp = dot('#cfefff'); c.strokeStyle = '#ffffff'; c.lineWidth = 0.7;
        F.segs.forEach((g, i) => {
          if (!inView(g, F.view)) return;
          const tw = Math.max(0, Math.sin(t * 2.2 + jit(i, 0) * 40));
          if (tw > 0.2) { const [x, y] = at(g, 0.2 + jit(0, i) * 0.6, 2 + jit(i + 9, 0) * 4), r = 2.5 + tw * 5; c.globalAlpha = tw; c.drawImage(sp, x - r, y - r, r * 2, r * 2); c.beginPath(); c.moveTo(x - r * 0.9, y); c.lineTo(x + r * 0.9, y); c.moveTo(x, y - r * 0.9); c.lineTo(x, y + r * 0.9); c.stroke(); }
          const ph = (t * 0.25 + jit(i, 5)) % 1, [x, y] = at(g, jit(i, 6), ph * 16);
          c.globalAlpha = 0.6 * (1 - ph); c.drawImage(sp, x - 2, y - 2 - ph * 6, 4, 4);
        });
      },
    },
    'b-static': {
      glow(c, F) { add(c); bloom(c, F.path, '#4fb8ff', 4, 0.9); },
      anim(c, F, t) {
        // live electricity: the arc re-forms a dozen times a second and throws sparks
        add(c); const f = Math.floor(t * 14); c.lineJoin = 'miter';
        for (const [w, amp, colr, al] of [[3, 1, '#6fd0ff', 0.5], [1.1, 0.7, '#ffffff', 1]]) {
          c.strokeStyle = colr; c.globalAlpha = al; c.lineWidth = w; c.beginPath();
          F.segs.forEach((g, i) => { if (!inView(g, F.view)) return; c.moveTo(g.ax, g.ay); for (let j = 1; j < 5; j++) { const [x, y] = at(g, j / 5, (jit(i + f * 7, j) - 0.5) * 7 * amp); c.lineTo(x, y); } c.lineTo(g.bx, g.by); });
          c.stroke();
        }
        const sp = dot('#9fe8ff'); c.globalAlpha = 1;
        F.segs.forEach((g, i) => { if (jit(i, f) > 0.93 && inView(g, F.view)) { const [x, y] = at(g, jit(f, i), 4 + jit(i, f + 1) * 8); c.drawImage(sp, x - 5, y - 5, 10, 10); } });
      },
    },
    'b-gold': {
      glow(c, F) {
        c.strokeStyle = '#5c3a06'; c.lineWidth = 9; c.stroke(F.path); c.strokeStyle = '#c8901f'; c.lineWidth = 7; c.stroke(F.path);
        c.strokeStyle = '#ffd86e'; c.lineWidth = 3.6; c.stroke(F.path); c.strokeStyle = '#fff6cf'; c.lineWidth = 1; c.stroke(F.path);
        add(c); bloom(c, F.path, '#ffcf4a', 6, 0.5);
      },
      // a glint that runs all the way round
      anim(c, F, t) { add(c); c.setLineDash([14, 260]); c.lineDashOffset = -t * 90; c.strokeStyle = '#ffffff'; c.globalAlpha = 0.9; c.lineWidth = 4; c.stroke(F.path); c.globalAlpha = 0.3; c.lineWidth = 11; c.stroke(F.path); c.setLineDash([]); },
    },
    'b-ember': {
      glow(c, F) { add(c); bloom(c, F.path, '#ff4a0a', 7, 1.1); },
      anim(c, F, t) {
        // a smouldering core that flickers, and embers lifting off it
        add(c); const fl = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
        c.strokeStyle = '#ffb347'; c.globalAlpha = fl; c.lineWidth = 2.2; c.stroke(F.path);
        const sp = dot('#ff8a1e'), sp2 = dot('#ffe08a');
        F.segs.forEach((g, i) => {
          if (!inView(g, F.view)) return;
          for (let j = 0; j < 2; j++) {
            const ph = (t * (0.35 + jit(i, j) * 0.3) + jit(j, i)) % 1, [x0, y0] = at(g, jit(i, j + 3), 1);
            const x = x0 + Math.sin(ph * 6 + i) * 4 + g.nx * ph * 10, y = y0 - ph * 26 + g.ny * ph * 6, r = (1 - ph) * 3.2 + 0.6;
            c.globalAlpha = (1 - ph) * 0.95; c.drawImage(j ? sp : sp2, x - r * 2, y - r * 2, r * 4, r * 4);
          }
        });
      },
    },
    'b-plasma': {
      glow(c, F) { add(c); bloom(c, F.path, '#8a3bff', 6, 0.9); c.globalAlpha = 0.8; c.strokeStyle = '#ffffff'; c.lineWidth = 0.9; c.stroke(F.path); },
      // two charged currents flowing opposite ways
      anim(c, F, t) { add(c); for (const [col, off, sp] of [['#3fe0ff', 0, 60], ['#ff4fd8', 24, -45]]) { c.setLineDash([18, 30]); c.lineDashOffset = off - t * sp; c.strokeStyle = col; c.globalAlpha = 0.9; c.lineWidth = 2.8; c.stroke(F.path); } c.setLineDash([]); },
    },
    'b-toxic': {
      glow(c, F) { add(c); bloom(c, F.path, '#6dff3a', 6, 0.85); },
      anim(c, F, t) {
        // it breathes, and bubbles rise off it
        add(c); const br = 0.6 + 0.4 * Math.sin(t * 2.4);
        c.strokeStyle = '#d6ff9a'; c.globalAlpha = br; c.lineWidth = 1.6; c.stroke(F.path); c.globalAlpha = br * 0.35; c.strokeStyle = '#6dff3a'; c.lineWidth = 6; c.stroke(F.path);
        const sp = dot('#8dff4a');
        F.segs.forEach((g, i) => { if (!inView(g, F.view)) return; const ph = (t * 0.4 + jit(i, 2)) % 1, [x, y] = at(g, jit(i, 3), 2 + ph * 8), r = 1.4 + ph * 2.5; c.globalAlpha = Math.sin(ph * Math.PI) * 0.9; c.drawImage(sp, x - r * 2, y - ph * 14 - r * 2, r * 4, r * 4); });
      },
    },
    'b-prism': {
      glow(c, F) { add(c); bloom(c, F.path, '#b9c8ff', 4, 0.5); },
      // the whole spectrum slides along the edge
      anim(c, F, t) { add(c); c.lineCap = 'butt'; ['#ff3b5c', '#ffb02e', '#f5ff3b', '#3bff7a', '#3bd8ff', '#7a5cff'].forEach((h, i) => { c.setLineDash([12, 60]); c.lineDashOffset = -t * 40 - i * 12; c.strokeStyle = h; c.globalAlpha = 0.9; c.lineWidth = 3.6; c.stroke(F.path); }); c.setLineDash([]); },
    },
    'b-blood': {
      glow(c, F) { add(c); bloom(c, F.path, '#b3001b', 7, 0.6); },
      // a heartbeat
      anim(c, F, t) { const b = t % 1.2, beat = Math.exp(-((b - 0.1) ** 2) / 0.004) + 0.7 * Math.exp(-((b - 0.32) ** 2) / 0.004); add(c); c.strokeStyle = '#ff2040'; c.globalAlpha = 0.25 + beat * 0.45; c.lineWidth = 6 + beat * 8; c.stroke(F.path); c.strokeStyle = '#ff7888'; c.globalAlpha = 0.6 + beat * 0.4; c.lineWidth = 1.6; c.stroke(F.path); },
    },
    'b-stars': {
      glow(c, F) { c.strokeStyle = 'rgba(10,16,48,.55)'; c.lineWidth = 16; c.stroke(F.path); add(c); bloom(c, F.path, '#3c5cff', 5, 0.6); },
      anim(c, F, t) {
        add(c); const sp = dot('#cfe0ff');
        F.segs.forEach((g, i) => { if (!inView(g, F.view)) return; for (let j = 0; j < 2; j++) { const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + jit(i, j) * 3) + jit(j, i) * 30), [x, y] = at(g, jit(i, j + 1), (jit(i + 2, j) - 0.3) * 12), r = 0.8 + tw * (jit(i, j + 7) > 0.8 ? 3.5 : 1.8); c.globalAlpha = 0.35 + tw * 0.65; c.drawImage(sp, x - r * 2, y - r * 2, r * 4, r * 4); } });
      },
    },
    'b-void': {
      glow(c, F) { c.strokeStyle = 'rgba(12,0,26,.8)'; c.lineWidth = 12; c.stroke(F.path); add(c); bloom(c, F.path, '#7a2bff', 6, 0.8); },
      anim(c, F, t) {
        // tendrils that reach out and pull back
        add(c); c.lineWidth = 1.6; c.strokeStyle = '#b07aff'; c.globalAlpha = 0.75; c.beginPath();
        F.segs.forEach((g, i) => {
          if (!inView(g, F.view) || jit(i, 1) < 0.35) return;
          const [x, y] = at(g, 0.2 + jit(i, 2) * 0.6), L = (8 + jit(i, 3) * 12) * (0.6 + 0.4 * Math.sin(t * 1.3 + i)), sw = Math.sin(t * 2 + i * 1.7) * 6;
          c.moveTo(x, y); c.quadraticCurveTo(x + g.nx * L * 0.5 - g.ny * sw, y + g.ny * L * 0.5 + g.nx * sw, x + g.nx * L, y + g.ny * L);
        });
        c.stroke();
      },
    },
    'b-aurora': {
      glow(c, F) { add(c); bloom(c, F.path, '#2fffa8', 4, 0.6); },
      anim(c, F, t) {
        // curtains of green, teal and violet rising from the top edges of your land, swaying
        add(c); const cols = ['#2fffa8', '#2fd8ff', '#b05cff'];
        F.segs.forEach((g, i) => {
          if (g.ny > -0.2 || !inView(g, F.view)) return;
          for (let j = 0; j < 3; j++) {
            const [x, y] = at(g, (j + 0.5) / 3), wave = Math.sin(t * 1.2 + (x + y) * 0.03) * 0.5 + 0.5, h = 18 + wave * 30 + jit(i, j) * 12;
            c.globalAlpha = 0.25 + wave * 0.4; c.drawImage(curtain(cols[Math.floor(((x * 0.01 + t * 0.15) % 3 + 3) % 3)]), x - 5, y - h, 10, h);
          }
        });
      },
    },
    'b-solar': {
      glow(c, F) { add(c); bloom(c, F.path, '#ffb000', 8, 1); c.globalAlpha = 0.95; c.strokeStyle = '#fff3c4'; c.lineWidth = 2; c.stroke(F.path); },
      anim(c, F, t) {
        // flares licking outward
        add(c); c.beginPath();
        F.segs.forEach((g, i) => { if (!inView(g, F.view)) return; for (let j = 0; j < 3; j++) { const [x, y] = at(g, (j + 0.5) / 3), L = 3 + Math.max(0, Math.sin(t * 2.5 + jit(i, j) * 20)) * 12; c.moveTo(x, y); c.lineTo(x + g.nx * L, y + g.ny * L); } });
        c.globalAlpha = 0.6; c.strokeStyle = '#ffd04a'; c.lineWidth = 2.4; c.stroke(); c.globalAlpha = 0.9; c.strokeStyle = '#fff6d8'; c.lineWidth = 0.8; c.stroke();
      },
    },
  };
  // the soft light (clipped so it only spills outward), into the cached board
  function auraGlow(c, id, F, col) {
    const a = AURA[id]; if (!a || !F || !F.segs.length) return;
    c.save(); if (F.outside) c.clip(F.outside, 'evenodd'); c.lineJoin = 'round'; c.lineCap = 'round'; a.glow(c, F, col); c.restore();
  }
  // the moving parts, every frame
  function aura(c, id, F, t, col) {
    const a = AURA[id]; if (!a || !F || !F.segs.length) return;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; a.anim(c, F, t, col); c.restore();
  }

  // ───────── border lines: the frontier line itself, always in your colour. Returns true if it replaced the plain line ─────────
  // (drawn into the cached board on screen: z is the zoom, segs the frontier edges on screen)
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const along = (segs, step, f) => { for (const g of segs) { const L = Math.hypot(g.bx - g.ax, g.by - g.ay), n = Math.max(1, Math.round(L / step)); for (let j = 0; j < n; j++) f(g, (j + 0.5) / n, L / n, j); } };
  const TRIM = {
    'h-double': (c, z, col) => {
      c.strokeStyle = shade(col, -0.55); c.lineWidth = 9 * z; c.stroke();
      c.strokeStyle = col; c.lineWidth = 7 * z; c.stroke();
      c.strokeStyle = shade(col, -0.65); c.lineWidth = 3 * z; c.stroke();
      c.strokeStyle = shade(col, 0.55); c.lineWidth = 1 * z; c.stroke();
    },
    'h-tactical': (c, z, col, segs) => {
      // a boundary on a military map: a hard line with ticks along the outside
      c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 6.5 * z; c.stroke(); c.strokeStyle = col; c.lineWidth = 4 * z; c.stroke();
      c.strokeStyle = shade(col, 0.5); c.lineWidth = 1 * z; c.stroke();
      c.lineCap = 'butt'; c.beginPath();
      along(segs, 9 * z, (g, u) => { const [x, y] = at(g, u, 1.5 * z), [x2, y2] = at(g, u, 7.5 * z); c.moveTo(x, y); c.lineTo(x2, y2); });
      c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 3.4 * z; c.stroke(); c.strokeStyle = col; c.lineWidth = 2 * z; c.stroke();
    },
    'h-barbed': (c, z, col, segs) => {
      // concertina wire: coils of razor wire unrolled along the frontier, on a band of your colour
      c.strokeStyle = shade(col, -0.35); c.lineWidth = 5 * z; c.stroke(); c.strokeStyle = col; c.lineWidth = 3 * z; c.stroke();
      c.lineWidth = 1.1 * z;
      along(segs, 7 * z, (g, u, L) => {
        const [x, y] = at(g, u, 3.5 * z), a = Math.atan2(g.by - g.ay, g.bx - g.ax);
        c.save(); c.translate(x, y); c.rotate(a);
        c.strokeStyle = '#2a2d31'; c.beginPath(); c.ellipse(0, 0, L * 0.75, 3.6 * z, 0, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
        c.strokeStyle = '#a9b2bb'; c.beginPath(); c.ellipse(0, 0, L * 0.75, 3.6 * z, 0, Math.PI * 1.1, Math.PI * 1.55); c.stroke();
        c.strokeStyle = '#1a1c1f'; c.beginPath(); c.moveTo(-1.2 * z, -4.6 * z); c.lineTo(1.2 * z, -2.6 * z); c.stroke();
        c.restore();
      });
      // pickets at the corners
      for (const g of segs) { c.fillStyle = '#3d3022'; c.fillRect(g.ax - 1 * z, g.ay - 6 * z, 2 * z, 7 * z); c.fillStyle = '#6b5638'; c.fillRect(g.ax - 1 * z, g.ay - 6 * z, 0.8 * z, 7 * z); }
    },
    'h-sandbag': (c, z, col, segs) => {
      c.strokeStyle = shade(col, -0.35); c.lineWidth = 5 * z; c.stroke(); c.strokeStyle = col; c.lineWidth = 3.4 * z; c.stroke();
      // a course of plump sandbags laid along the line, lit from the top left
      along(segs, 7.5 * z, (g, u, L) => {
        const [x, y] = at(g, u, 2.6 * z), a = Math.atan2(g.by - g.ay, g.bx - g.ax);
        c.save(); c.translate(x, y); c.rotate(a);
        c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0.5 * z, 1.4 * z, L * 0.54, 3.1 * z, 0, 0, Math.PI * 2); c.fill();
        const gr = c.createLinearGradient(0, -3 * z, 0, 3 * z); gr.addColorStop(0, '#e2d0a6'); gr.addColorStop(0.6, '#b09a6c'); gr.addColorStop(1, '#7c6842');
        c.fillStyle = gr; c.beginPath(); c.ellipse(0, 0, L * 0.54, 3.1 * z, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#5a4a2c'; c.lineWidth = 0.6 * z; c.stroke();
        c.strokeStyle = 'rgba(90,74,44,.55)'; c.beginPath(); c.moveTo(-L * 0.42, -0.4 * z); c.quadraticCurveTo(0, 0.6 * z, L * 0.42, -0.4 * z); c.stroke();
        c.restore();
      });
    },
    'h-teeth': (c, z, col, segs) => {
      // dragon's teeth: a tight row of concrete blocks set along the frontier, lit from the top left
      c.strokeStyle = shade(col, -0.4); c.lineWidth = 6 * z; c.stroke(); c.strokeStyle = col; c.lineWidth = 4 * z; c.stroke();
      along(segs, 6.5 * z, (g, u) => {
        const [x, y] = at(g, u, 1.5 * z), r = 2.3 * z, h = 2.6 * z;
        c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + 1 * z, y + r * 0.7, r * 1.25, r * 0.5, 0, 0, Math.PI * 2); c.fill();
        // a squat block: lit top, two shaded sides
        c.fillStyle = '#8f8a80'; c.beginPath(); c.moveTo(x - r, y - h * 0.3); c.lineTo(x, y + r * 0.55); c.lineTo(x, y + r * 0.55 - h * 0.1); c.lineTo(x - r, y - h); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(x - r, y); c.lineTo(x, y + r * 0.55); c.lineTo(x + r, y); c.lineTo(x + r, y - h * 0.55); c.lineTo(x, y - h * 0.55 + r * 0.55); c.lineTo(x - r, y - h * 0.55); c.closePath(); c.fillStyle = '#7d786e'; c.fill();
        c.fillStyle = '#a9a398'; c.beginPath(); c.moveTo(x, y + r * 0.55); c.lineTo(x + r, y); c.lineTo(x + r, y - h * 0.55); c.lineTo(x, y - h * 0.55 + r * 0.55); c.closePath(); c.fill();
        c.fillStyle = '#e4dfd4'; c.beginPath(); c.moveTo(x - r, y - h * 0.55); c.lineTo(x, y - h * 0.55 - r * 0.55); c.lineTo(x + r, y - h * 0.55); c.lineTo(x, y - h * 0.55 + r * 0.55); c.closePath(); c.fill();
      });
    },
    'h-laser': (c, z, col, segs) => {
      c.globalCompositeOperation = 'lighter';
      for (const [w, a] of [[12, 0.08], [7, 0.16], [4, 0.35]]) { c.strokeStyle = col; c.globalAlpha = a; c.lineWidth = w * z; c.stroke(); }
      c.globalAlpha = 1; c.strokeStyle = '#ffffff'; c.lineWidth = 1.3 * z; c.stroke();
      c.globalCompositeOperation = 'source-over';
      for (const g of segs) { c.fillStyle = '#1b2026'; c.beginPath(); c.arc(g.ax, g.ay, 2.6 * z, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(g.ax, g.ay, 1.2 * z, 0, Math.PI * 2); c.fill(); }
    },
    'h-plate': (c, z, col, segs) => {
      c.strokeStyle = '#1d2125'; c.lineWidth = 9 * z; c.stroke();
      c.strokeStyle = '#6f7880'; c.lineWidth = 7 * z; c.stroke();
      c.strokeStyle = '#a7b0b8'; c.lineWidth = 3 * z; c.stroke();
      c.strokeStyle = col; c.lineWidth = 1.8 * z; c.stroke();
      along(segs, 9 * z, (g, u) => { for (const o of [-2.4, 2.4]) { const [x, y] = at(g, u, o * z); c.fillStyle = '#2b3035'; c.beginPath(); c.arc(x + 0.3 * z, y + 0.3 * z, 1 * z, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e3e8ec'; c.beginPath(); c.arc(x, y, 0.75 * z, 0, Math.PI * 2); c.fill(); } });
    },
    'h-hazard': (c, z, col) => {
      // hazard tape: yellow and black chevrons on a band edged in your colour
      c.strokeStyle = col; c.lineWidth = 9 * z; c.stroke();
      c.lineCap = 'butt'; c.strokeStyle = '#ffc400'; c.lineWidth = 6 * z; c.stroke();
      c.setLineDash([4 * z, 4 * z]); c.strokeStyle = '#141414'; c.stroke(); c.setLineDash([]);
    },
    'h-rail': (c, z, col, segs) => {
      // a railway round your land: ballast, sleepers, and two rails that bend cleanly round every corner
      c.strokeStyle = col; c.lineWidth = 15 * z; c.globalAlpha = 0.55; c.stroke(); c.globalAlpha = 1;
      c.strokeStyle = '#6d655c'; c.lineWidth = 12 * z; c.stroke();
      c.strokeStyle = '#c9ced4'; c.lineWidth = 9.4 * z; c.stroke();
      c.strokeStyle = '#2c2a27'; c.lineWidth = 8.2 * z; c.stroke();
      c.strokeStyle = '#6d655c'; c.lineWidth = 6.8 * z; c.stroke();
      along(segs, 3.6 * z, (g, u) => {
        const [x, y] = at(g, u); c.save(); c.translate(x, y); c.rotate(Math.atan2(g.ny, g.nx));
        c.fillStyle = '#5a412a'; c.fillRect(-3.2 * z, -0.9 * z, 6.4 * z, 1.8 * z); c.fillStyle = '#7a5a3b'; c.fillRect(-3.2 * z, -0.9 * z, 6.4 * z, 0.6 * z); c.restore();
      });
    },
    'h-trench': (c, z, col, segs) => {
      // a dug trench with plank revetments, the parapets either side in your colour
      c.strokeStyle = shade(col, -0.35); c.lineWidth = 13 * z; c.stroke();
      c.strokeStyle = col; c.lineWidth = 11 * z; c.stroke();
      c.strokeStyle = '#2b1d10'; c.lineWidth = 8 * z; c.stroke();
      c.strokeStyle = '#4b331d'; c.lineWidth = 6 * z; c.stroke();
      c.lineCap = 'butt'; c.setLineDash([2.6 * z, 1.1 * z]); c.strokeStyle = '#8a6a43'; c.lineWidth = 2.6 * z; c.stroke(); c.setLineDash([]);
    },
    'h-pylons': (c, z, col, segs) => {
      c.strokeStyle = shade(col, -0.35); c.lineWidth = 5 * z; c.stroke(); c.strokeStyle = col; c.lineWidth = 3.4 * z; c.stroke();
      // power lines: a pylon on every corner, three cables sagging between them
      const H = 13 * z;
      c.lineWidth = 0.6 * z;
      for (const g of segs) for (const [o, dy] of [[-2.6, 0], [2.6, 0], [0, -1.8]]) {
        c.strokeStyle = 'rgba(15,18,22,.85)'; c.beginPath(); c.moveTo(g.ax + o * z, g.ay - H + 2 * z + dy * z); c.quadraticCurveTo((g.ax + g.bx) / 2, (g.ay + g.by) / 2 - H + 7 * z + dy * z, g.bx + o * z, g.by - H + 2 * z + dy * z); c.stroke();
      }
      const seen = new Set();
      for (const g of segs) for (const [x, y] of [[g.ax, g.ay], [g.bx, g.by]]) {
        const k = Math.round(x) + ',' + Math.round(y); if (seen.has(k)) continue; seen.add(k);
        c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x + 2 * z, y + 0.5 * z, 3 * z, 1 * z, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#2e343a'; c.lineWidth = 1 * z; c.beginPath();
        c.moveTo(x - 2.2 * z, y); c.lineTo(x - 0.6 * z, y - H); c.moveTo(x + 2.2 * z, y); c.lineTo(x + 0.6 * z, y - H);
        for (let i = 1; i < 4; i++) { const yy = y - H * i / 4, w = 2.2 - 1.6 * i / 4; c.moveTo(x - w * z, yy); c.lineTo(x + w * z, yy); }
        c.moveTo(x - 3.4 * z, y - H + 2 * z); c.lineTo(x + 3.4 * z, y - H + 2 * z); c.moveTo(x - 2.4 * z, y - H - 0.2 * z); c.lineTo(x + 2.4 * z, y - H - 0.2 * z); c.stroke();
      }
    },
    'h-chain': (c, z, col, segs) => {
      // heavy chain: links alternating face-on and edge-on
      c.strokeStyle = shade(col, -0.4); c.lineWidth = 3 * z; c.stroke();
      along(segs, 5 * z, (g, u, L, j) => {
        const [x, y] = at(g, u, 0.5 * z), a = Math.atan2(g.by - g.ay, g.bx - g.ax);
        c.save(); c.translate(x, y); c.rotate(a);
        if (j % 2) { c.fillStyle = '#3a3f45'; c.fillRect(-L * 0.6, -0.9 * z, L * 1.2, 1.8 * z); c.fillStyle = '#c6ccd2'; c.fillRect(-L * 0.6, -0.9 * z, L * 1.2, 0.6 * z); }
        else { c.strokeStyle = '#2c3035'; c.lineWidth = 1.8 * z; c.beginPath(); c.ellipse(0, 0, L * 0.62, 2.4 * z, 0, 0, Math.PI * 2); c.stroke(); c.strokeStyle = '#d4dae0'; c.lineWidth = 0.7 * z; c.beginPath(); c.ellipse(0, -0.3 * z, L * 0.6, 2.2 * z, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
        c.restore();
      });
    },
  };
  // shapes of their own leave the frontier path pointing at them: put it back for whatever strokes it next
  const repath = (c, segs) => { c.beginPath(); for (const g of segs) { c.moveTo(g.ax, g.ay); c.lineTo(g.bx, g.by); } };
  function trim(c, id, z, col, segs) { const f = TRIM[id]; if (!f) return false; segs = segs || []; c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; f(c, z, col, segs); c.restore(); repath(c, segs); return true; }

  // the frontier of a set of hexes in board units: { path, segs }. cells: [{ wx, wy, h }]; key(cell, i) says whether edge i is shared
  const CORNER = [-90, -30, 30, 90, 150, 210].map(a => [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)]);
  // hexes: the territory's hex centres (lifted), for the outside-only clip
  function frontier(edges, tilt, r = U * 0.965 * 0.97, hexes) {
    const segs = [], path = new Path2D();
    let outside = null;
    if (hexes && hexes.length) {
      outside = new Path2D(); outside.rect(-1e5, -1e5, 2e5, 2e5);
      const R = r / 0.97;
      for (const h of hexes) { outside.moveTo(h.wx + CORNER[0][0] * R, h.wy + CORNER[0][1] * R * tilt); for (let i = 1; i < 6; i++) outside.lineTo(h.wx + CORNER[i][0] * R, h.wy + CORNER[i][1] * R * tilt); outside.closePath(); }
    }
    for (const { wx, wy, i } of edges) {
      const a = CORNER[i], b = CORNER[(i + 1) % 6], ax = wx + a[0] * r, ay = wy + a[1] * r * tilt, bx = wx + b[0] * r, by = wy + b[1] * r * tilt;
      let nx = (ax + bx) / 2 - wx, ny = (ay + by) / 2 - wy; const l = Math.hypot(nx, ny) || 1;
      segs.push({ ax, ay, bx, by, nx: nx / l, ny: ny / l }); path.moveTo(ax, ay); path.lineTo(bx, by);
    }
    return { path, segs, outside };
  }

  // ── Locker previews: an island in a colour wearing a skin (19 hexes for territory, so the big picture shows). Auras animate ──
  function preview(canvas, slot, id, color = '#36a3ff') {
    const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height, TILT = 0.62, R = slot === 'territory' ? 2 : 1;
    const k = (slot === 'territory' ? W / 9.2 : W / 6.4) / U;   // canvas px per board unit
    const cells = []; for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (Math.abs(q + r) <= R) cells.push([q, r]);
    const wpos = ([q, r]) => [U * Math.sqrt(3) * (q + r / 2), U * 1.5 * r * TILT];
    const hexPath = (x, y, r) => { c.beginPath(); for (let i = 0; i < 6; i++) c.lineTo(x + CORNER[i][0] * r, y + CORNER[i][1] * r * TILT); c.closePath(); };
    const ws = cells.map(wpos), box = { x0: Math.min(...ws.map(p => p[0])), x1: Math.max(...ws.map(p => p[0])), y0: Math.min(...ws.map(p => p[1])), y1: Math.max(...ws.map(p => p[1])), hx: 0, hy: 0, tilt: TILT };
    const nbr = [[1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]];   // the neighbour across the edge from corner i to i + 1
    const edges = []; for (const cell of cells) for (let i = 0; i < 6; i++) { const nb = [cell[0] + nbr[i][0], cell[1] + nbr[i][1]]; if (!cells.some(o => o[0] === nb[0] && o[1] === nb[1])) { const [wx, wy] = wpos(cell); edges.push({ wx, wy, i }); } }
    const F = frontier(edges, TILT, U * 0.97, cells.map(cl => { const [wx, wy] = wpos(cl); return { wx, wy }; }));
    const draw = (t) => {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
      c.setTransform(k, 0, 0, k, W / 2, H / 2);
      for (const cell of cells) {
        const [x, y] = wpos(cell);
        c.fillStyle = 'rgba(0,0,0,.45)'; hexPath(x, y + 6, U * 0.97); c.fill();
        c.fillStyle = color; hexPath(x, y, U * 0.97); c.fill();
        if (slot === 'territory') territory(c, id, { cx: x, cy: y, s: U * 0.97, z: 1, wx: x, wy: y, box }, hexPath);
      }
      c.beginPath(); for (const g of F.segs) { c.moveTo(g.ax, g.ay); c.lineTo(g.bx, g.by); }
      if (!(slot === 'trim' && trim(c, id, 1.15, color, F.segs))) { c.lineCap = 'round'; c.strokeStyle = color; c.globalAlpha = 0.35; c.lineWidth = 9; c.stroke(); c.globalAlpha = 1; c.lineWidth = 4; c.stroke(); }
      if (slot === 'border') { auraGlow(c, id, F, color); aura(c, id, F, t, color); }
      c.setTransform(1, 0, 0, 1, 0, 0);
    };
    draw(0);
    if (slot === 'border' && typeof requestAnimationFrame !== 'undefined') {
      // keep it moving while it's on screen
      const t0 = performance.now(), tick = now => { if (!canvas.isConnected) return; draw((now - t0) / 1000); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
  }
  return { territory, aura, auraGlow, trim, frontier, preview, picture, TERR, AURA, TRIM };
})();
