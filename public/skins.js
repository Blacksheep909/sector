/* SECTOR — skin painters: territory patterns and border auras. Used by the board and by the Locker previews.
   Everything is drawn over the player's own colour at partial strength, so on the map you're still clearly you. */
const Skins = (() => {
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function star(c, x, y, r, points = 5, inner = 0.45) {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / points, rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }
  // h: { cx, cy, s, tilt, z, q, r, ox, oy, nearHQ } — cx/cy the hex top centre, s its radius, ox/oy where world (0,0) lands on screen
  // (stripes and pixels line up across neighbouring hexes, so a territory reads as one big flag rather than a pile of tiles)
  const TERRITORY = {
    't-usa'(c, h) {
      const band = 7 * h.z, y0 = h.cy - h.s, y1 = h.cy + h.s;
      for (let y = Math.floor((y0 - h.oy) / band) * band + h.oy; y < y1; y += band) {
        const i = Math.round((y - h.oy) / band); c.fillStyle = i % 2 ? 'rgba(255,255,255,.26)' : 'rgba(191,10,48,.42)';
        c.fillRect(h.cx - h.s, y, h.s * 2, band + 0.5);
      }
      if (h.nearHQ) {
        c.fillStyle = 'rgba(0,40,104,.72)'; c.fillRect(h.cx - h.s, h.cy - h.s, h.s * 2, h.s * 2);
        c.fillStyle = 'rgba(255,255,255,.9)';
        for (let gx = -2; gx <= 2; gx++) for (let gy = -1; gy <= 1; gy++) star(c, h.cx + gx * h.s * 0.36 + (gy % 2 ? h.s * 0.18 : 0), h.cy + gy * h.s * 0.36 * h.tilt, 2.4 * h.z);
      }
    },
    't-uk'(c, h) {
      c.fillStyle = 'rgba(1,33,105,.28)'; c.fillRect(h.cx - h.s, h.cy - h.s, h.s * 2, h.s * 2);
      const line = (w, col, dx, dy) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(h.cx - dx, h.cy - dy); c.lineTo(h.cx + dx, h.cy + dy); c.stroke(); };
      const d = h.s, e = h.s * h.tilt;
      line(5 * h.z, 'rgba(255,255,255,.55)', d, e); line(5 * h.z, 'rgba(255,255,255,.55)', d, -e);
      line(2 * h.z, 'rgba(200,16,46,.75)', d, e); line(2 * h.z, 'rgba(200,16,46,.75)', d, -e);
      line(7 * h.z, 'rgba(255,255,255,.6)', d, 0); line(7 * h.z, 'rgba(255,255,255,.6)', 0, e);
      line(4 * h.z, 'rgba(200,16,46,.85)', d, 0); line(4 * h.z, 'rgba(200,16,46,.85)', 0, e);
    },
    't-nato'(c, h) {
      c.fillStyle = 'rgba(0,38,99,.3)'; c.fillRect(h.cx - h.s, h.cy - h.s, h.s * 2, h.s * 2);
      c.save(); c.translate(h.cx, h.cy); c.scale(1, h.tilt);
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.4 * h.z; c.beginPath(); c.arc(0, 0, h.s * 0.42, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.75)'; star(c, 0, 0, h.s * 0.5, 4, 0.22);
      c.restore();
    },
    't-russia'(c, h) {
      const y0 = h.cy - h.s * h.tilt, third = h.s * h.tilt * 2 / 3;
      c.fillStyle = 'rgba(255,255,255,.34)'; c.fillRect(h.cx - h.s, y0 - h.s, h.s * 2, third + h.s);
      c.fillStyle = 'rgba(0,57,166,.45)'; c.fillRect(h.cx - h.s, y0 + third, h.s * 2, third);
      c.fillStyle = 'rgba(213,43,30,.45)'; c.fillRect(h.cx - h.s, y0 + third * 2, h.s * 2, third + h.s);
    },
    't-wood'(c, h) { camo(c, h, ['rgba(75,83,32,.5)', 'rgba(40,36,24,.55)', 'rgba(120,98,56,.45)', 'rgba(46,74,40,.5)']); },
    't-desert'(c, h) { camo(c, h, ['rgba(201,173,127,.5)', 'rgba(143,111,70,.5)', 'rgba(222,203,160,.45)']); },
    't-digital'(c, h) {
      const p = 4 * h.z, cols = ['rgba(66,84,58,.5)', 'rgba(110,122,90,.45)', 'rgba(40,46,34,.5)', 'rgba(150,150,120,.35)'];
      for (let y = Math.floor((h.cy - h.s - h.oy) / p) * p + h.oy; y < h.cy + h.s; y += p)
        for (let x = Math.floor((h.cx - h.s - h.ox) / p) * p + h.ox; x < h.cx + h.s; x += p) {
          const v = hash(Math.round((x - h.ox) / p), Math.round((y - h.oy) / p)); if (v < 0.35) continue;
          c.fillStyle = cols[Math.floor(v * 97) % cols.length]; c.fillRect(x, y, p + 0.4, p + 0.4);
        }
    },
    't-carbon'(c, h) {
      const p = 4 * h.z;
      for (let y = Math.floor((h.cy - h.s - h.oy) / p) * p + h.oy; y < h.cy + h.s; y += p)
        for (let x = Math.floor((h.cx - h.s - h.ox) / p) * p + h.ox; x < h.cx + h.s; x += p) {
          const odd = (Math.round((x - h.ox) / p) + Math.round((y - h.oy) / p)) % 2;
          c.fillStyle = odd ? 'rgba(0,0,0,.32)' : 'rgba(255,255,255,.06)'; c.fillRect(x, y, p, p / 2); c.fillStyle = odd ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.32)'; c.fillRect(x, y + p / 2, p, p / 2);
        }
    },
    't-hazard'(c, h) {
      const w = 6 * h.z;
      c.save(); c.translate(h.ox, h.oy); c.rotate(-Math.PI / 4);
      const span = 4000, k0 = Math.floor(((h.cx - h.ox) + (h.cy - h.oy)) * 0.7071 / w) - 30;
      for (let k = k0; k < k0 + 60; k++) { c.fillStyle = k % 2 ? 'rgba(20,20,20,.42)' : 'rgba(255,199,0,.42)'; c.fillRect(k * w, -span, w, span * 2); }
      c.restore();
    },
    't-founder'(c, h) {
      const g = c.createLinearGradient(h.cx - h.s, h.cy - h.s, h.cx + h.s, h.cy + h.s);
      g.addColorStop(0, 'rgba(255,215,106,.12)'); g.addColorStop(0.5, 'rgba(255,240,180,.38)'); g.addColorStop(1, 'rgba(201,138,26,.16)');
      c.fillStyle = g; c.fillRect(h.cx - h.s, h.cy - h.s, h.s * 2, h.s * 2);
      if (h.nearHQ || hash(h.q, h.r) < 0.18) {
        c.save(); c.translate(h.cx, h.cy); c.scale(1, h.tilt); c.strokeStyle = 'rgba(255,215,106,.85)'; c.lineWidth = 1.6 * h.z;
        for (const sd of [-1, 1]) { c.beginPath(); c.arc(0, 0, h.s * 0.42, Math.PI / 2 + sd * 0.3, Math.PI / 2 + sd * 2.6, sd < 0); c.stroke();
          for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + sd * (0.6 + i * 0.42); c.beginPath(); c.ellipse(Math.cos(a) * h.s * 0.42, Math.sin(a) * h.s * 0.42, 3 * h.z, 1.4 * h.z, a + sd * 0.9, 0, Math.PI * 2); c.fillStyle = 'rgba(255,215,106,.8)'; c.fill(); } }
        c.restore();
      }
    },
  };
  function camo(c, h, cols) {
    for (let i = 0; i < 6; i++) {
      const v = hash(h.q * 7 + i, h.r * 13 - i), v2 = hash(h.q - i * 3, h.r + i * 5);
      c.fillStyle = cols[i % cols.length]; c.beginPath();
      c.ellipse(h.cx + (v - 0.5) * h.s * 1.5, h.cy + (v2 - 0.5) * h.s * h.tilt * 1.5, h.s * (0.25 + v2 * 0.3), h.s * h.tilt * (0.18 + v * 0.25), v * 3, 0, Math.PI * 2); c.fill();
    }
  }
  // paint a territory skin over one hex: the caller has already filled the hex in the owner's colour
  function territory(c, id, h, hexPath) {
    const f = TERRITORY[id]; if (!f) return;
    c.save(); hexPath(h.cx, h.cy, h.s); c.clip(); f(c, h); c.restore();
  }
  // border auras: drawn under the normal border line, over a path of the hex's frontier edges (already built on c)
  const BORDER = {
    'b-neon': (c, z, col) => { c.shadowColor = col; c.shadowBlur = 16 * z; c.strokeStyle = col; c.lineWidth = 3 * z; c.stroke(); },
    'b-gold': (c, z) => { c.shadowColor = '#ffcf4a'; c.shadowBlur = 10 * z; c.strokeStyle = '#ffe08a'; c.lineWidth = 7 * z; c.stroke(); c.shadowBlur = 0; c.strokeStyle = '#a8620f'; c.lineWidth = 2 * z; c.stroke(); },
    'b-frost': (c, z) => { c.shadowColor = '#bff3ff'; c.shadowBlur = 18 * z; c.strokeStyle = 'rgba(225,250,255,.9)'; c.lineWidth = 3 * z; c.stroke(); },
    'b-ember': (c, z) => { c.shadowColor = '#ff6a1a'; c.shadowBlur = 18 * z; c.strokeStyle = '#ffb03a'; c.lineWidth = 3 * z; c.stroke(); c.setLineDash([1 * z, 9 * z]); c.lineCap = 'round'; c.strokeStyle = '#fff3a8'; c.lineWidth = 3.5 * z; c.stroke(); c.setLineDash([]); },
    'b-static': (c, z) => { c.shadowColor = '#9fe8ff'; c.shadowBlur = 10 * z; c.setLineDash([5 * z, 3 * z, 1 * z, 3 * z]); c.strokeStyle = '#ffffff'; c.lineWidth = 2.2 * z; c.stroke(); c.setLineDash([]); },
    'b-void': (c, z) => { c.shadowColor = '#7a2bff'; c.shadowBlur = 24 * z; c.strokeStyle = 'rgba(30,0,60,.95)'; c.lineWidth = 8 * z; c.stroke(); },
  };
  function border(c, id, z, col) { const f = BORDER[id]; if (!f) return; c.save(); f(c, z, col); c.restore(); }

  // ── Locker previews: a little island of 7 hexes in a colour, wearing a skin ──
  function preview(canvas, slot, id, color = '#36a3ff') {
    const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height, TILT = 0.62, s = W / 6.4, z = W / 260;
    c.clearRect(0, 0, W, H);
    const hexPath = (x, y, r) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * TILT); } c.closePath(); };
    const cells = [[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    const pos = ([q, r]) => [W / 2 + s * Math.sqrt(3) * (q + r / 2), H / 2 + s * 1.5 * r * TILT];
    for (const cell of cells) {
      const [x, y] = pos(cell);
      c.fillStyle = 'rgba(0,0,0,.45)'; hexPath(x, y + 6 * z, s * 0.97); c.fill();
      c.fillStyle = color; hexPath(x, y, s * 0.97); c.fill();
      if (slot === 'territory') territory(c, id, { cx: x, cy: y, s: s * 0.97, tilt: TILT, z, q: cell[0], r: cell[1], ox: W / 2, oy: H / 2, nearHQ: cell[0] === 0 && cell[1] === 0 }, hexPath);
    }
    // the island's outline: its frontier
    c.beginPath();
    const outer = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; outer.push([Math.cos(a), Math.sin(a)]); }
    for (const cell of cells) { const [x, y] = pos(cell); for (let i = 0; i < 6; i++) { const a = outer[i], b = outer[(i + 1) % 6], mx = x + (a[0] + b[0]) / 2 * s * 1.6, my = y + (a[1] + b[1]) / 2 * s * 1.6 * TILT; if (cells.some(o => { const [ox, oy] = pos(o); return Math.hypot(ox - mx, (oy - my) / TILT) < s * 0.6; })) continue; c.moveTo(x + a[0] * s * 0.97, y + a[1] * s * 0.97 * TILT); c.lineTo(x + b[0] * s * 0.97, y + b[1] * s * 0.97 * TILT); } }
    if (slot === 'border') border(c, id, z * 1.4, color);
    c.lineCap = 'round'; c.strokeStyle = '#ffffff'; c.globalAlpha = 0.9; c.lineWidth = 3 * z; c.stroke(); c.globalAlpha = 1;
  }
  return { territory, border, preview, TERRITORY, BORDER };
})();
