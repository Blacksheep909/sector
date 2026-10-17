/* SECTOR — procedural vector art. All icons drawn in a [-1,1] box. */
const Art = (() => {
  const P = Math.PI;
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, P * 2); }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  function wheel(c, x, y, r, col) { circ(c, x, y, r); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; circ(c, x, y, r * 0.45); c.fill(); c.restore(); }

  const UNIT = {
    grunt(c) { // helmeted trooper with rifle
      c.beginPath(); c.arc(0, -0.15, 0.42, P, 0); c.lineTo(0.5, -0.1); c.lineTo(-0.5, -0.1); c.closePath(); c.fill();
      rr(c, -0.5, 0.0, 1.0, 0.55, 0.2); c.fill();
      c.save(); c.translate(0.1, 0.25); c.rotate(-0.6); rr(c, -0.08, -0.85, 0.16, 1.1, 0.05); c.fill(); c.restore();
    },
    skitter(c) { // dune buggy
      poly(c, [-0.85, 0.1, -0.5, -0.25, 0.25, -0.25, 0.55, 0.0, 0.9, 0.05, 0.9, 0.25, -0.85, 0.25]); c.fill();
      c.lineWidth = 0.09; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(-0.35, -0.25); c.lineTo(-0.15, -0.6); c.lineTo(0.2, -0.6); c.lineTo(0.3, -0.25); c.stroke();
      wheel(c, -0.5, 0.35, 0.3); wheel(c, 0.55, 0.35, 0.3);
    },
    thumper(c) { // mortar on bipod
      c.save(); c.rotate(-0.75); rr(c, -0.14, -0.95, 0.28, 1.25, 0.08); c.fill(); c.restore();
      c.lineWidth = 0.12; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(0.05, -0.1); c.lineTo(0.55, 0.65); c.moveTo(0.05, -0.1); c.lineTo(-0.2, 0.65); c.stroke();
      rr(c, -0.75, 0.5, 0.75, 0.22, 0.06); c.fill();
    },
    lancer(c) { // trooper with launcher
      circ(c, -0.2, -0.35, 0.28); c.fill();
      rr(c, -0.55, -0.05, 0.75, 0.75, 0.2); c.fill();
      c.save(); c.rotate(-0.25); rr(c, -0.7, -0.62, 1.6, 0.26, 0.08); c.fill(); poly(c, [0.9, -0.66, 1.0, -0.49, 0.9, -0.32]); c.fill(); c.restore();
    },
    warden(c) { // shield drone
      c.lineWidth = 0.12; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(0, 0, 0.78, -2.6, -0.54); c.stroke(); c.beginPath(); c.arc(0, 0, 0.78, 0.54, 2.6); c.stroke();
      poly(c, [0, -0.45, 0.42, 0, 0, 0.45, -0.42, 0]); c.fill();
    },
    bulwark(c) { // APC
      poly(c, [-0.9, 0.25, -0.9, -0.15, -0.6, -0.45, 0.6, -0.45, 0.9, -0.1, 0.9, 0.25]); c.fill();
      rr(c, -0.15, -0.68, 0.45, 0.25, 0.05); c.fill();
      wheel(c, -0.55, 0.38, 0.22); wheel(c, 0, 0.38, 0.22); wheel(c, 0.55, 0.38, 0.22);
    },
    hornet(c) { // quad drone
      c.lineWidth = 0.14; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(-0.6, -0.6); c.lineTo(0.6, 0.6); c.moveTo(0.6, -0.6); c.lineTo(-0.6, 0.6); c.stroke();
      for (const [x, y] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { c.beginPath(); c.ellipse(x, y, 0.32, 0.12, 0, 0, P * 2); c.fill(); }
      poly(c, [0, -0.3, 0.3, 0, 0, 0.35, -0.3, 0]); c.fill();
    },
    mauler(c) { // battle tank
      rr(c, -0.95, 0.05, 1.9, 0.45, 0.22); c.fill();
      poly(c, [-0.75, 0.05, -0.55, -0.2, 0.6, -0.2, 0.8, 0.05]); c.fill();
      rr(c, -0.4, -0.55, 0.7, 0.4, 0.14); c.fill();
      rr(c, 0.2, -0.45, 0.85, 0.14, 0.05); c.fill();
    },
    basilisk(c) { // railgun
      rr(c, -0.9, 0.2, 1.3, 0.35, 0.1); c.fill();
      c.save(); c.rotate(-0.4); rr(c, -0.4, -0.3, 1.45, 0.14, 0.04); c.fill(); rr(c, -0.4, -0.08, 1.45, 0.14, 0.04); c.fill(); rr(c, -0.55, -0.38, 0.5, 0.5, 0.08); c.fill(); c.restore();
      wheel(c, -0.6, 0.6, 0.18); wheel(c, 0.15, 0.6, 0.18);
    },
    wraith(c) { // hover tank
      poly(c, [-1, 0.15, -0.7, -0.2, 0.7, -0.2, 1, 0.1, 0.75, 0.3, -0.75, 0.3]); c.fill();
      poly(c, [-0.35, -0.2, -0.2, -0.5, 0.35, -0.5, 0.45, -0.2]); c.fill();
      rr(c, 0.3, -0.42, 0.75, 0.1, 0.04); c.fill();
      c.save(); c.globalAlpha *= 0.6; rr(c, -0.7, 0.45, 1.4, 0.1, 0.05); c.fill(); rr(c, -0.45, 0.62, 0.9, 0.08, 0.04); c.fill(); c.restore();
    },
    goliath(c) { // walker
      rr(c, -0.55, -0.6, 1.1, 0.6, 0.15); c.fill();
      rr(c, 0.4, -0.45, 0.6, 0.14, 0.04); c.fill(); rr(c, -1.0, -0.45, 0.6, 0.14, 0.04); c.fill();
      c.lineWidth = 0.18; c.strokeStyle = c.fillStyle; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(-0.3, 0); c.lineTo(-0.55, 0.35); c.lineTo(-0.35, 0.8); c.moveTo(0.3, 0); c.lineTo(0.55, 0.35); c.lineTo(0.35, 0.8); c.stroke();
    },
    leviathan(c) { // dreadnought
      rr(c, -1, 0.1, 2, 0.5, 0.18); c.fill();
      poly(c, [-0.9, 0.1, -0.7, -0.25, 0.75, -0.25, 0.95, 0.1]); c.fill();
      rr(c, -0.7, -0.6, 0.55, 0.38, 0.1); c.fill(); rr(c, 0.05, -0.7, 0.6, 0.45, 0.1); c.fill();
      rr(c, 0.5, -0.58, 0.55, 0.12, 0.04); c.fill(); rr(c, -0.3, -0.5, 0.5, 0.1, 0.04); c.fill();
    },
    seraph(c) { // gunship
      poly(c, [0, -0.85, 0.22, -0.2, 1, 0.15, 1, 0.32, 0.2, 0.2, 0.15, 0.7, 0.4, 0.85, -0.4, 0.85, -0.15, 0.7, -0.2, 0.2, -1, 0.32, -1, 0.15, -0.22, -0.2]); c.fill();
    },
    oracle(c) { // dish
      c.beginPath(); c.ellipse(-0.05, -0.2, 0.75, 0.35, -0.6, 0, P); c.closePath(); c.fill();
      c.lineWidth = 0.1; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(-0.05, -0.2); c.lineTo(0.45, -0.75); c.stroke(); circ(c, 0.5, -0.8, 0.12); c.fill();
      poly(c, [-0.25, 0.1, 0.15, 0.1, 0.4, 0.75, -0.5, 0.75]); c.fill();
    },
  };

  // ── navy: hulls seen side-on, waterline at y≈0.35 ──
  function hull(c, l, r, deck, keel) { poly(c, [l, deck, r, deck, r - 0.25, keel, l + 0.15, keel]); c.fill(); }
  Object.assign(UNIT, {
    barracuda(c) { poly(c, [-0.95, 0.05, 0.95, 0.05, 0.6, 0.4, -0.75, 0.4]); c.fill(); rr(c, -0.35, -0.3, 0.55, 0.35, 0.06); c.fill(); rr(c, 0.1, -0.22, 0.6, 0.1, 0.03); c.fill(); rr(c, -0.25, -0.55, 0.08, 0.28, 0.02); c.fill(); },
    ark(c) { hull(c, -1, 1, 0.0, 0.42); rr(c, -0.8, -0.32, 0.45, 0.3, 0.04); c.fill(); rr(c, -0.25, -0.32, 0.45, 0.3, 0.04); c.fill(); rr(c, 0.3, -0.5, 0.35, 0.48, 0.05); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0.38, -0.42, 0.18, 0.1); c.restore(); },
    marlin(c) { poly(c, [-1, 0.0, 0.85, 0.0, 1, -0.12, 0.7, 0.4, -0.8, 0.4]); c.fill(); poly(c, [-0.3, 0, -0.2, -0.45, 0.2, -0.45, 0.3, 0]); c.fill(); rr(c, -0.04, -0.75, 0.08, 0.32, 0.02); c.fill(); rr(c, 0.35, -0.16, 0.55, 0.09, 0.03); c.fill(); rr(c, -0.85, -0.16, 0.45, 0.09, 0.03); c.fill(); },
    kraken(c) { c.beginPath(); c.ellipse(0, 0.12, 0.98, 0.28, 0, 0, Math.PI * 2); c.fill(); poly(c, [-0.25, -0.1, -0.12, -0.5, 0.22, -0.5, 0.3, -0.1]); c.fill(); rr(c, 0.02, -0.72, 0.06, 0.25, 0.02); c.fill(); poly(c, [-0.98, 0.12, -1.1, -0.15, -1.1, 0.4]); c.fill(); },
    bastion(c) { poly(c, [-1, 0.0, 1, 0.0, 0.75, 0.4, -0.85, 0.4]); c.fill(); rr(c, -0.35, -0.5, 0.6, 0.5, 0.05); c.fill(); rr(c, -0.12, -0.8, 0.14, 0.32, 0.03); c.fill(); for (const x of [-0.75, 0.4]) { rr(c, x, -0.25, 0.3, 0.22, 0.06); c.fill(); rr(c, x + 0.2, -0.2, 0.42, 0.08, 0.03); c.fill(); } },
    abyssal(c) { poly(c, [-1.05, -0.05, 1.05, -0.05, 0.8, 0.42, -0.9, 0.42]); c.fill(); poly(c, [-0.45, -0.05, -0.3, -0.6, 0.3, -0.6, 0.45, -0.05]); c.fill(); poly(c, [-0.08, -0.6, 0, -0.95, 0.08, -0.6]); c.fill(); for (const x of [-0.95, -0.62, 0.48, 0.8]) { rr(c, x, -0.28, 0.24, 0.22, 0.05); c.fill(); } rr(c, 0.55, -0.24, 0.5, 0.07, 0.03); c.fill(); rr(c, -1.1, -0.24, 0.5, 0.07, 0.03); c.fill(); },
  });

  Object.assign(UNIT, {
    valkyrie(c) { rr(c, -0.7, -0.12, 1.4, 0.32, 0.14); c.fill(); poly(c, [0.6, -0.1, 1, -0.3, 1, 0.1, 0.6, 0.18]); c.fill(); poly(c, [-0.3, 0.2, 0.3, 0.2, 0.15, 0.5, -0.15, 0.5]); c.fill();
      for (const x of [-0.6, 0.35]) { c.save(); c.translate(x, -0.35); c.rotate(-0.15); rr(c, -0.45, -0.05, 0.9, 0.1, 0.05); c.fill(); c.restore(); rr(c, x - 0.04, -0.35, 0.08, 0.25, 0.02); c.fill(); } },
  });
  // ── unit art v2: chunky side-on silhouettes with shaded detail. Shading uses translucent black,
  //    so it reads on the light card fill and disappears into the dark ink outline. ──
  const SH = 'rgba(0,0,0,.32)', SH2 = 'rgba(0,0,0,.5)';
  function sh(c, f, a) { c.save(); c.fillStyle = a || SH; c.strokeStyle = a || SH; f(); c.restore(); }
  function line(c, w, pts) { c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); }
  function hub(c, x, y, r) { circ(c, x, y, r); c.fill(); sh(c, () => { circ(c, x, y, r * 0.62); c.fill(); }, SH2); sh(c, () => { circ(c, x, y, r * 0.22); c.fill(); }); }
  function tracks(c, x, y, w, h, n) {
    rr(c, x, y, w, h, h / 2); c.fill();
    sh(c, () => { rr(c, x + h * 0.18, y + h * 0.18, w - h * 0.36, h * 0.64, h * 0.32); c.fill(); });
    for (let i = 0; i < n; i++) { const wx = x + h / 2 + (w - h) * (n === 1 ? 0.5 : i / (n - 1)); circ(c, wx, y + h / 2, h * 0.27); c.fill(); sh(c, () => { circ(c, wx, y + h / 2, h * 0.1); c.fill(); }, SH2); }
  }
  function trooper(c) {
    c.beginPath(); c.moveTo(-0.78, 0.98); c.quadraticCurveTo(-0.8, 0.3, -0.3, 0.24); c.lineTo(0.3, 0.24); c.quadraticCurveTo(0.8, 0.3, 0.78, 0.98); c.closePath(); c.fill();
    rr(c, -0.13, 0.04, 0.26, 0.26, 0.05); c.fill();
    circ(c, 0, -0.08, 0.29); c.fill();
    c.beginPath(); c.arc(0, -0.15, 0.42, P * 1.03, -0.03); c.quadraticCurveTo(0.62, -0.06, 0.52, -0.02); c.lineTo(-0.52, -0.02); c.quadraticCurveTo(-0.62, -0.06, -0.42, -0.16); c.closePath(); c.fill();
    sh(c, () => {
      rr(c, -0.44, -0.1, 0.88, 0.07, 0.03); c.fill();            // helmet band
      rr(c, -0.2, 0.02, 0.4, 0.1, 0.04); c.fill();               // shadow under the brim
      rr(c, -0.5, 0.4, 0.17, 0.58, 0.05); c.fill(); rr(c, 0.33, 0.4, 0.17, 0.58, 0.05); c.fill(); // straps
      rr(c, -0.24, 0.52, 0.48, 0.22, 0.05); c.fill();            // chest pouch
      c.beginPath(); c.arc(-0.14, -0.38, 0.16, P, P * 1.6); c.lineTo(-0.14, -0.38); c.fill();
    });
  }
  Object.assign(UNIT, {
    grunt(c) {
      c.save(); c.translate(0.05, 0.25); c.rotate(-0.62);
      rr(c, -1.0, -0.07, 1.95, 0.14, 0.04); c.fill(); rr(c, -1.0, -0.08, 0.42, 0.24, 0.06); c.fill(); rr(c, 0.18, 0.0, 0.12, 0.26, 0.03); c.fill(); rr(c, -0.2, -0.16, 0.3, 0.1, 0.03); c.fill();
      c.restore();
      trooper(c);
    },
    corpsman(c) {
      trooper(c);
      circ(c, 0, 0.6, 0.24); c.fill(); sh(c, () => { circ(c, 0, 0.6, 0.21); c.fill(); }, SH2);
      rr(c, -0.055, 0.46, 0.11, 0.28, 0.02); c.fill(); rr(c, -0.14, 0.545, 0.28, 0.11, 0.02); c.fill();
      sh(c, () => { rr(c, -0.07, -0.42, 0.14, 0.24, 0.02); c.fill(); rr(c, -0.12, -0.37, 0.24, 0.14, 0.02); c.fill(); }, SH2);
      // field bag
      rr(c, 0.55, 0.3, 0.42, 0.34, 0.06); c.fill(); sh(c, () => { c.fillRect(0.55, 0.42, 0.42, 0.05); });
    },
    ranger(c) {
      c.save(); c.translate(0.05, 0.25); c.rotate(-0.62);
      rr(c, -1.0, -0.07, 2.05, 0.13, 0.04); c.fill(); rr(c, -1.0, -0.08, 0.4, 0.22, 0.06); c.fill(); rr(c, -0.1, -0.24, 0.5, 0.12, 0.05); c.fill(); rr(c, 0.18, 0.0, 0.1, 0.24, 0.03); c.fill();
      c.restore();
      trooper(c);
      // boonie hat brim + camo band
      c.beginPath(); c.ellipse(0, -0.05, 0.74, 0.11, 0, 0, P * 2); c.fill();
      sh(c, () => { rr(c, -0.4, -0.18, 0.8, 0.08, 0.03); c.fill(); for (const [x, y] of [[-0.3, 0.5], [0.25, 0.7], [0.5, 0.45], [-0.55, 0.78]]) { circ(c, x, y, 0.07); c.fill(); } });
    },
    sapper(c) {
      c.save(); c.translate(-0.22, 0.04); c.scale(0.86, 0.86); trooper(c); c.restore();
      rr(c, 0.32, 0.18, 0.62, 0.5, 0.07); c.fill();
      sh(c, () => { c.fillRect(0.32, 0.3, 0.62, 0.06); c.fillRect(0.32, 0.5, 0.62, 0.06); rr(c, 0.52, 0.22, 0.2, 0.12, 0.03); c.fill(); });
      c.lineWidth = 0.06; c.beginPath(); c.moveTo(0.62, 0.18); c.bezierCurveTo(0.6, -0.15, 0.85, -0.2, 0.82, -0.48); c.stroke();
      poly(c, [0.82, -0.78, 0.88, -0.6, 1.02, -0.62, 0.9, -0.5, 0.98, -0.36, 0.82, -0.44, 0.68, -0.34, 0.74, -0.5, 0.62, -0.62, 0.77, -0.6]); c.fill();
    },
    lancer(c) {
      trooper(c);
      c.save(); c.translate(0, -0.18); c.rotate(-0.12);
      rr(c, -0.95, -0.16, 1.75, 0.3, 0.08); c.fill();
      poly(c, [-0.95, -0.2, -1.12, -0.28, -1.12, 0.22, -0.95, 0.14]); c.fill();
      poly(c, [0.8, -0.14, 1.08, -0.02, 0.8, 0.12]); c.fill();
      rr(c, 0.0, -0.36, 0.22, 0.2, 0.04); c.fill(); rr(c, -0.2, 0.1, 0.14, 0.28, 0.04); c.fill();
      sh(c, () => { c.fillRect(-0.55, -0.16, 0.08, 0.3); c.fillRect(0.45, -0.16, 0.08, 0.3); rr(c, 0.04, -0.32, 0.14, 0.1, 0.02); c.fill(); });
      c.restore();
    },
    thumper(c) {
      for (const x of [-0.85, -0.62]) { rr(c, x, 0.32, 0.18, 0.42, 0.08); c.fill(); poly(c, [x, 0.34, x + 0.09, 0.18, x + 0.18, 0.34]); c.fill(); sh(c, () => { c.fillRect(x, 0.42, 0.18, 0.05); }); }
      c.save(); c.translate(0.1, 0.35); c.rotate(-0.85);
      rr(c, -0.08, -0.17, 1.15, 0.34, 0.08); c.fill(); rr(c, 0.95, -0.22, 0.14, 0.44, 0.04); c.fill();
      sh(c, () => { c.fillRect(0.3, -0.17, 0.07, 0.34); c.fillRect(0.6, -0.17, 0.07, 0.34); rr(c, -0.02, -0.08, 0.9, 0.06, 0.02); c.fill(); });
      c.restore();
      c.strokeStyle = c.fillStyle; line(c, 0.1, [0.52, -0.1, 0.78, 0.72]); line(c, 0.1, [0.52, -0.1, 0.3, 0.72]);
      poly(c, [-0.25, 0.62, 0.45, 0.62, 0.55, 0.8, -0.35, 0.8]); c.fill(); sh(c, () => { c.fillRect(-0.3, 0.72, 0.8, 0.05); });
    },
    skitter(c) {
      c.strokeStyle = c.fillStyle; line(c, 0.09, [-0.45, -0.12, -0.25, -0.62, 0.2, -0.62, 0.38, -0.12]); line(c, 0.07, [-0.05, -0.62, 0.05, -0.12]);
      poly(c, [-0.95, 0.05, -0.62, -0.18, 0.4, -0.18, 0.62, 0.0, 0.98, 0.04, 0.98, 0.26, -0.95, 0.26]); c.fill();
      circ(c, 0.02, -0.33, 0.15); c.fill(); sh(c, () => { rr(c, 0.0, -0.37, 0.16, 0.07, 0.03); c.fill(); });
      rr(c, -1.05, -0.12, 0.12, 0.3, 0.04); c.fill(); rr(c, 0.62, -0.32, 0.3, 0.1, 0.04); c.fill();
      sh(c, () => { poly(c, [-0.6, 0.02, 0.36, 0.02, 0.3, 0.14, -0.55, 0.14]); c.fill(); });
      hub(c, -0.55, 0.42, 0.32); hub(c, 0.6, 0.42, 0.32);
    },
    bulwark(c) {
      poly(c, [-0.98, 0.3, -0.98, -0.08, -0.7, -0.42, 0.55, -0.42, 0.98, -0.05, 0.98, 0.3]); c.fill();
      rr(c, -0.3, -0.68, 0.55, 0.28, 0.06); c.fill(); rr(c, 0.2, -0.6, 0.55, 0.1, 0.03); c.fill();
      sh(c, () => { for (const x of [-0.62, -0.3, 0.02]) { rr(c, x, -0.3, 0.2, 0.09, 0.03); c.fill(); } c.fillRect(-0.98, 0.04, 1.96, 0.06); rr(c, 0.55, -0.3, 0.24, 0.24, 0.03); c.fill(); });
      for (const x of [-0.65, -0.22, 0.22, 0.65]) hub(c, x, 0.42, 0.21);
    },
    mauler(c) {
      tracks(c, -0.98, 0.18, 1.96, 0.46, 5);
      poly(c, [-0.88, 0.2, -0.7, -0.12, 0.72, -0.12, 0.92, 0.2]); c.fill();
      c.beginPath(); c.moveTo(-0.5, -0.12); c.quadraticCurveTo(-0.45, -0.58, 0.05, -0.58); c.lineTo(0.38, -0.5); c.lineTo(0.42, -0.12); c.closePath(); c.fill();
      rr(c, 0.3, -0.42, 0.78, 0.13, 0.04); c.fill(); rr(c, 0.92, -0.46, 0.14, 0.21, 0.03); c.fill();
      rr(c, -0.3, -0.72, 0.3, 0.16, 0.05); c.fill();
      sh(c, () => { c.fillRect(-0.8, 0.02, 1.62, 0.06); rr(c, 0.3, -0.45, 0.14, 0.32, 0.03); c.fill(); rr(c, -0.38, -0.36, 0.5, 0.07, 0.03); c.fill(); });
    },
    hellcat(c) {
      c.strokeStyle = c.fillStyle; c.save(); c.globalAlpha *= 0.7; for (const [y, l] of [[-0.3, 0.5], [-0.05, 0.75], [0.2, 0.45]]) line(c, 0.07, [-1.08, y, -1.08 + l * 0.5, y]); c.restore();
      tracks(c, -0.75, 0.24, 1.7, 0.4, 4);
      poly(c, [-0.75, 0.26, -0.55, -0.04, 0.55, -0.12, 0.98, 0.1, 0.92, 0.26]); c.fill();
      poly(c, [-0.35, -0.04, -0.2, -0.38, 0.32, -0.38, 0.45, -0.1]); c.fill();
      rr(c, 0.3, -0.32, 0.78, 0.11, 0.04); c.fill(); poly(c, [1.04, -0.36, 1.12, -0.26, 1.04, -0.17]); c.fill();
      sh(c, () => { poly(c, [-0.5, 0.06, 0.6, 0.0, 0.85, 0.14, -0.55, 0.16]); c.fill(); rr(c, -0.12, -0.3, 0.3, 0.08, 0.03); c.fill(); });
    },
    scorpion(c) {
      poly(c, [-0.98, 0.32, -0.98, -0.02, -0.5, -0.02, -0.4, -0.3, -0.05, -0.3, 0.0, -0.02, 0.98, -0.02, 0.98, 0.32]); c.fill();
      sh(c, () => { rr(c, -0.36, -0.24, 0.24, 0.16, 0.03); c.fill(); c.fillRect(-0.98, 0.1, 1.96, 0.05); });
      c.save(); c.translate(0.45, -0.1); c.rotate(-0.95);
      for (const dy of [-0.14, 0.05]) { rr(c, 0.0, dy, 0.95, 0.1, 0.03); c.fill(); }
      rr(c, -0.18, -0.2, 0.38, 0.4, 0.08); c.fill(); sh(c, () => { c.fillRect(0.5, -0.14, 0.05, 0.29); });
      c.restore();
      c.strokeStyle = c.fillStyle; line(c, 0.06, [-0.75, -0.02, -0.75, -0.5]);
      c.beginPath(); c.ellipse(-0.75, -0.62, 0.22, 0.12, -0.3, 0, P * 2); c.fill(); sh(c, () => { c.beginPath(); c.ellipse(-0.75, -0.6, 0.14, 0.06, -0.3, 0, P * 2); c.fill(); });
      for (const x of [-0.6, 0.0, 0.6]) hub(c, x, 0.42, 0.2);
    },
    wraith(c) {
      c.save(); c.globalAlpha *= 0.55; for (const [y, w] of [[0.48, 1.3], [0.64, 0.9], [0.78, 0.5]]) { rr(c, -w / 2, y, w, 0.08, 0.04); c.fill(); } c.restore();
      poly(c, [-1.0, 0.12, -0.72, -0.18, 0.72, -0.18, 1.0, 0.08, 0.78, 0.34, -0.78, 0.34]); c.fill();
      poly(c, [-0.4, -0.18, -0.25, -0.5, 0.32, -0.5, 0.46, -0.18]); c.fill();
      rr(c, 0.35, -0.42, 0.75, 0.1, 0.04); c.fill(); rr(c, 0.35, -0.3, 0.6, 0.06, 0.03); c.fill();
      sh(c, () => { rr(c, -0.78, 0.08, 1.56, 0.08, 0.04); c.fill(); for (const x of [-0.6, -0.1, 0.4]) { rr(c, x, 0.2, 0.22, 0.08, 0.04); c.fill(); } rr(c, -0.15, -0.44, 0.32, 0.08, 0.03); c.fill(); });
    },
    goliath(c) {
      c.strokeStyle = c.fillStyle;
      line(c, 0.2, [-0.28, 0.05, -0.55, 0.38, -0.35, 0.82]); line(c, 0.2, [0.28, 0.05, 0.55, 0.38, 0.35, 0.82]);
      rr(c, -0.58, 0.76, 0.42, 0.16, 0.05); c.fill(); rr(c, 0.16, 0.76, 0.42, 0.16, 0.05); c.fill();
      hub(c, -0.55, 0.38, 0.12); hub(c, 0.55, 0.38, 0.12);
      poly(c, [-0.55, -0.62, 0.5, -0.62, 0.66, -0.3, 0.45, 0.08, -0.45, 0.08, -0.66, -0.3]); c.fill();
      sh(c, () => { poly(c, [-0.3, -0.5, 0.3, -0.5, 0.38, -0.32, -0.38, -0.32]); c.fill(); c.fillRect(-0.45, -0.12, 0.9, 0.06); });
      rr(c, 0.55, -0.48, 0.5, 0.2, 0.05); c.fill(); rr(c, 0.95, -0.44, 0.15, 0.12, 0.03); c.fill();
      rr(c, -1.08, -0.42, 0.58, 0.16, 0.05); c.fill();
      rr(c, -0.2, -0.82, 0.4, 0.22, 0.06); c.fill(); sh(c, () => { for (let i = 0; i < 3; i++) { circ(c, -0.98 + i * 0.16, -0.34, 0.04); c.fill(); } });
    },
    titan(c) {
      c.strokeStyle = c.fillStyle;
      // colossus mech: wide stance, heavy arms, shoulder battery
      poly(c, [-0.55, 0.2, -0.25, 0.2, -0.32, 0.72, -0.62, 0.72]); c.fill(); poly(c, [0.25, 0.2, 0.55, 0.2, 0.62, 0.72, 0.32, 0.72]); c.fill();
      rr(c, -0.78, 0.68, 0.56, 0.26, 0.06); c.fill(); rr(c, 0.22, 0.68, 0.56, 0.26, 0.06); c.fill();
      poly(c, [-0.6, -0.55, 0.6, -0.55, 0.7, -0.1, 0.45, 0.28, -0.45, 0.28, -0.7, -0.1]); c.fill();
      rr(c, -0.22, -0.8, 0.44, 0.28, 0.08); c.fill();
      rr(c, -1.05, -0.62, 0.42, 0.5, 0.1); c.fill(); rr(c, 0.63, -0.62, 0.42, 0.5, 0.1); c.fill();
      rr(c, -1.0, -0.15, 0.32, 0.6, 0.08); c.fill(); rr(c, 0.68, -0.15, 0.32, 0.6, 0.08); c.fill();
      for (const y of [0.45, 0.58]) { rr(c, 0.74, y, 0.2, 0.3, 0.04); c.fill(); }
      rr(c, -1.12, 0.42, 0.42, 0.18, 0.05); c.fill();
      sh(c, () => {
        rr(c, -0.14, -0.72, 0.28, 0.08, 0.03); c.fill();
        poly(c, [-0.35, -0.4, 0.35, -0.4, 0.42, -0.15, -0.42, -0.15]); c.fill();
        c.fillRect(-0.45, 0.06, 0.9, 0.06);
        for (let i = 0; i < 3; i++) { circ(c, -0.84 + (i % 2) * 0.12, -0.5 + i * 0.13, 0.05); c.fill(); }
      }, SH2);
    },
    leviathan(c) {
      tracks(c, -1.02, 0.28, 0.98, 0.42, 3); tracks(c, 0.04, 0.28, 0.98, 0.42, 3);
      poly(c, [-0.98, 0.3, -0.85, -0.05, 0.85, -0.05, 0.98, 0.3]); c.fill();
      rr(c, -0.75, -0.36, 0.6, 0.32, 0.08); c.fill(); rr(c, 0.1, -0.5, 0.62, 0.46, 0.08); c.fill(); rr(c, 0.22, -0.78, 0.36, 0.3, 0.06); c.fill();
      rr(c, -0.2, -0.28, 0.5, 0.1, 0.03); c.fill(); rr(c, 0.66, -0.42, 0.45, 0.12, 0.03); c.fill(); rr(c, 0.66, -0.24, 0.42, 0.1, 0.03); c.fill(); rr(c, -1.08, -0.26, 0.4, 0.09, 0.03); c.fill();
      sh(c, () => { c.fillRect(-0.85, 0.08, 1.7, 0.06); rr(c, 0.28, -0.7, 0.24, 0.08, 0.03); c.fill(); for (const x of [-0.6, -0.4]) { rr(c, x, -0.26, 0.12, 0.12, 0.02); c.fill(); } });
    },
    basilisk(c) {
      rr(c, -0.95, 0.12, 1.4, 0.32, 0.08); c.fill();
      for (const x of [-0.7, -0.25, 0.2]) hub(c, x, 0.52, 0.19);
      c.save(); c.translate(-0.35, 0.02); c.rotate(-0.42);
      rr(c, -0.2, -0.24, 1.55, 0.13, 0.04); c.fill(); rr(c, -0.2, 0.04, 1.55, 0.13, 0.04); c.fill();
      rr(c, -0.38, -0.32, 0.55, 0.58, 0.1); c.fill();
      for (const x of [0.35, 0.65, 0.95]) { rr(c, x, -0.3, 0.1, 0.56, 0.03); c.fill(); }
      sh(c, () => { c.fillRect(-0.2, -0.11, 1.55, 0.15); rr(c, -0.28, -0.2, 0.32, 0.34, 0.05); c.fill(); });
      circ(c, 1.38, -0.04, 0.09); c.fill();
      c.restore();
    },
    oracle(c) {
      c.strokeStyle = c.fillStyle;
      line(c, 0.11, [-0.05, 0.05, -0.45, 0.82]); line(c, 0.11, [-0.05, 0.05, 0.4, 0.82]); line(c, 0.11, [-0.05, 0.05, -0.05, 0.82]);
      rr(c, -0.62, 0.74, 1.15, 0.16, 0.05); c.fill();
      c.save(); c.translate(-0.05, -0.2); c.rotate(-0.55);
      c.beginPath(); c.ellipse(0, 0, 0.78, 0.36, 0, 0, P); c.closePath(); c.fill();
      sh(c, () => { c.beginPath(); c.ellipse(0, 0.02, 0.62, 0.24, 0, 0, P); c.closePath(); c.fill(); });
      line(c, 0.07, [0, 0, 0, -0.55]); circ(c, 0, -0.6, 0.11); c.fill();
      c.restore();
      c.save(); c.globalAlpha *= 0.6; for (const r of [0.25, 0.42]) { c.lineWidth = 0.06; c.beginPath(); c.arc(0.45, -0.9, r, 0.6, 1.6); c.stroke(); } c.restore();
    },
    warden(c) {
      c.lineWidth = 0.13; c.beginPath(); c.arc(0, 0.05, 0.85, P * 1.08, P * 1.92); c.stroke();
      c.save(); c.globalAlpha *= 0.45; c.beginPath(); c.arc(0, 0.05, 0.85, P * 1.08, P * 1.92); c.lineTo(0, 0.05); c.closePath(); c.fill(); c.restore();
      for (const s of [-1, 1]) { rr(c, s > 0 ? 0.42 : -0.82, 0.08, 0.4, 0.12, 0.05); c.fill(); c.beginPath(); c.ellipse(s * 0.75, 0.04, 0.24, 0.06, 0, 0, P * 2); c.fill(); }
      circ(c, 0, 0.12, 0.38); c.fill(); rr(c, -0.16, 0.42, 0.32, 0.24, 0.05); c.fill();
      sh(c, () => { circ(c, 0, 0.12, 0.22); c.fill(); }, SH2); circ(c, 0, 0.12, 0.1); c.fill();
    },
    hornet(c) {
      c.lineWidth = 0.15; c.lineCap = 'round'; c.beginPath(); c.moveTo(-0.62, -0.5); c.lineTo(0.62, 0.5); c.moveTo(0.62, -0.5); c.lineTo(-0.62, 0.5); c.stroke();
      for (const [x, y] of [[-0.62, -0.5], [0.62, -0.5], [-0.62, 0.5], [0.62, 0.5]]) {
        c.save(); c.globalAlpha *= 0.55; c.beginPath(); c.ellipse(x, y - 0.06, 0.4, 0.13, 0, 0, P * 2); c.fill(); c.restore();
        rr(c, x - 0.1, y - 0.12, 0.2, 0.18, 0.05); c.fill(); sh(c, () => { circ(c, x, y - 0.06, 0.05); c.fill(); }, SH2);
      }
      rr(c, -0.32, -0.24, 0.64, 0.46, 0.14); c.fill();
      circ(c, 0, 0.3, 0.17); c.fill(); sh(c, () => { circ(c, 0, 0.32, 0.09); c.fill(); rr(c, -0.2, -0.14, 0.4, 0.08, 0.03); c.fill(); }, SH2);
    },
    valkyrie(c) {
      c.strokeStyle = c.fillStyle;
      c.beginPath(); c.moveTo(-0.95, -0.02); c.quadraticCurveTo(-0.6, -0.26, 0.0, -0.24); c.lineTo(0.55, -0.2); c.quadraticCurveTo(0.95, -0.1, 0.98, 0.08); c.lineTo(0.5, 0.22); c.lineTo(-0.7, 0.18); c.closePath(); c.fill();
      poly(c, [-0.95, -0.02, -1.08, -0.42, -0.85, -0.42, -0.7, -0.1]); c.fill();
      sh(c, () => { poly(c, [0.45, -0.18, 0.82, -0.1, 0.9, 0.04, 0.5, 0.02]); c.fill(); for (const x of [-0.35, -0.12, 0.1]) { rr(c, x, -0.12, 0.14, 0.12, 0.03); c.fill(); } });
      rr(c, -0.35, 0.02, 0.7, 0.12, 0.04); c.fill();
      for (const x of [-0.42, 0.28]) {
        rr(c, x, -0.34, 0.2, 0.42, 0.08); c.fill();
        c.save(); c.globalAlpha *= 0.65; c.beginPath(); c.ellipse(x + 0.1, -0.44, 0.48, 0.08, 0, 0, P * 2); c.fill(); c.restore();
        rr(c, x + 0.06, -0.5, 0.08, 0.12, 0.02); c.fill();
      }
      rr(c, -0.2, 0.2, 0.1, 0.22, 0.03); c.fill(); rr(c, 0.25, 0.2, 0.1, 0.22, 0.03); c.fill(); rr(c, -0.3, 0.38, 0.75, 0.07, 0.03); c.fill();
    },
    phantom(c) {
      poly(c, [0, -0.85, 0.32, -0.4, 1.02, 0.36, 0.72, 0.42, 0.42, 0.3, 0.2, 0.5, 0, 0.36, -0.2, 0.5, -0.42, 0.3, -0.72, 0.42, -1.02, 0.36, -0.32, -0.4]); c.fill();
      sh(c, () => { poly(c, [0, -0.85, 0.32, -0.4, 1.02, 0.36, 0.72, 0.42, 0.42, 0.3, 0.2, 0.5, 0, 0.36]); c.fill(); }, 'rgba(0,0,0,.18)');
      sh(c, () => { poly(c, [0, -0.6, 0.12, -0.32, 0, -0.15, -0.12, -0.32]); c.fill(); for (const x of [-0.3, 0.3]) { rr(c, x - 0.1, 0.15, 0.2, 0.08, 0.03); c.fill(); } }, SH2);
    },
    seraph(c) {
      poly(c, [0, -0.95, 0.16, -0.55, 0.2, -0.18, 1.02, 0.18, 1.02, 0.34, 0.22, 0.24, 0.16, 0.62, 0.42, 0.8, 0.42, 0.92, -0.42, 0.92, -0.42, 0.8, -0.16, 0.62, -0.22, 0.24, -1.02, 0.34, -1.02, 0.18, -0.2, -0.18, -0.16, -0.55]); c.fill();
      for (const x of [-0.7, -0.45, 0.45, 0.7]) { rr(c, x - 0.05, 0.1, 0.1, 0.32, 0.04); c.fill(); }
      sh(c, () => { c.beginPath(); c.ellipse(0, -0.48, 0.09, 0.2, 0, 0, P * 2); c.fill(); poly(c, [0, -0.2, 1.02, 0.18, 1.02, 0.26, 0.2, 0.06]); c.fill(); poly(c, [0, -0.2, -1.02, 0.18, -1.02, 0.26, -0.2, 0.06]); c.fill(); rr(c, -0.1, 0.66, 0.2, 0.16, 0.04); c.fill(); });
    },
    // ── navy, side-on with the waterline near y≈0.4 ──
    barracuda(c) {
      c.save(); c.globalAlpha *= 0.5; rr(c, -1.05, 0.5, 0.5, 0.07, 0.03); c.fill(); rr(c, -0.95, 0.64, 0.3, 0.06, 0.03); c.fill(); c.restore();
      poly(c, [-0.95, 0.05, 0.75, 0.05, 1.02, -0.12, 0.65, 0.42, -0.8, 0.42]); c.fill();
      rr(c, -0.5, -0.32, 0.62, 0.38, 0.06); c.fill(); poly(c, [0.12, -0.32, 0.3, -0.05, 0.12, 0.05]); c.fill();
      rr(c, 0.35, -0.18, 0.18, 0.18, 0.05); c.fill(); rr(c, 0.45, -0.14, 0.45, 0.08, 0.03); c.fill();
      rr(c, -0.3, -0.62, 0.07, 0.32, 0.02); c.fill(); rr(c, -0.42, -0.55, 0.3, 0.05, 0.02); c.fill();
      sh(c, () => { for (const x of [-0.4, -0.2, 0.0]) { rr(c, x, -0.24, 0.12, 0.1, 0.02); c.fill(); } c.fillRect(-0.85, 0.18, 1.6, 0.06); });
    },
    ark(c) {
      poly(c, [-1.02, -0.02, 0.9, -0.02, 1.04, -0.2, 0.75, 0.42, -0.85, 0.42]); c.fill();
      for (const [x, y, w] of [[-0.88, -0.3, 0.42], [-0.42, -0.3, 0.42], [-0.65, -0.56, 0.42]]) { rr(c, x, y, w, 0.25, 0.03); c.fill(); sh(c, () => { for (let i = 1; i < 4; i++) c.fillRect(x + i * w / 4 - 0.015, y + 0.04, 0.03, 0.17); }); }
      rr(c, 0.25, -0.62, 0.42, 0.62, 0.05); c.fill(); rr(c, 0.38, -0.82, 0.08, 0.22, 0.02); c.fill();
      sh(c, () => { rr(c, 0.31, -0.54, 0.3, 0.1, 0.02); c.fill(); c.fillRect(-0.88, 0.16, 1.7, 0.06); });
    },
    marlin(c) {
      poly(c, [-1.02, -0.02, 0.85, -0.02, 1.05, -0.18, 0.72, 0.42, -0.82, 0.42]); c.fill();
      poly(c, [-0.4, -0.02, -0.3, -0.38, 0.22, -0.38, 0.32, -0.02]); c.fill(); rr(c, -0.2, -0.6, 0.3, 0.24, 0.04); c.fill();
      rr(c, -0.07, -0.95, 0.07, 0.38, 0.02); c.fill(); rr(c, -0.22, -0.82, 0.38, 0.05, 0.02); c.fill();
      for (const [x, dir] of [[0.45, 1], [-0.7, -1]]) { rr(c, x, -0.2, 0.26, 0.2, 0.06); c.fill(); rr(c, dir > 0 ? x + 0.2 : x - 0.4, -0.15, 0.46, 0.07, 0.03); c.fill(); }
      sh(c, () => { for (const x of [-0.22, -0.02, 0.15]) { rr(c, x - 0.04, -0.28, 0.1, 0.09, 0.02); c.fill(); } c.fillRect(-0.85, 0.16, 1.62, 0.06); rr(c, -0.14, -0.54, 0.18, 0.08, 0.02); c.fill(); });
    },
    kraken(c) {
      c.beginPath(); c.ellipse(0, 0.14, 0.98, 0.27, 0, 0, P * 2); c.fill();
      poly(c, [-0.3, -0.08, -0.16, -0.5, 0.22, -0.5, 0.3, -0.08]); c.fill();
      rr(c, 0.02, -0.78, 0.06, 0.3, 0.02); c.fill(); rr(c, 0.02, -0.78, 0.18, 0.06, 0.02); c.fill();
      poly(c, [-0.92, 0.14, -1.12, -0.16, -1.04, 0.14, -1.12, 0.44]); c.fill();
      rr(c, -0.24, -0.3, 0.42, 0.06, 0.03); c.fill();
      sh(c, () => { c.beginPath(); c.ellipse(0, 0.24, 0.9, 0.12, 0, 0, P); c.fill(); for (const x of [0.45, 0.62]) { circ(c, x, 0.08, 0.05); c.fill(); } c.fillRect(-0.12, -0.42, 0.24, 0.06); });
    },
    bastion(c) {
      poly(c, [-1.02, -0.02, 0.88, -0.02, 1.06, -0.2, 0.75, 0.42, -0.85, 0.42]); c.fill();
      poly(c, [-0.35, -0.02, -0.28, -0.42, 0.25, -0.42, 0.32, -0.02]); c.fill(); rr(c, -0.18, -0.68, 0.3, 0.3, 0.05); c.fill(); rr(c, -0.08, -0.95, 0.08, 0.3, 0.02); c.fill();
      for (const [x, dir] of [[0.42, 1], [-0.78, -1]]) { rr(c, x, -0.26, 0.34, 0.26, 0.07); c.fill(); for (const dy of [-0.2, -0.1]) { rr(c, dir > 0 ? x + 0.28 : x - 0.42, dy, 0.48, 0.06, 0.03); c.fill(); } }
      sh(c, () => { for (const x of [-0.2, 0.05]) { rr(c, x, -0.32, 0.12, 0.1, 0.02); c.fill(); } c.fillRect(-0.85, 0.16, 1.62, 0.06); rr(c, -0.12, -0.6, 0.18, 0.08, 0.02); c.fill(); });
    },
    abyssal(c) {
      poly(c, [-1.08, -0.04, 0.95, -0.04, 1.1, -0.22, 0.82, 0.44, -0.92, 0.44]); c.fill();
      poly(c, [-0.42, -0.04, -0.3, -0.5, 0.28, -0.5, 0.4, -0.04]); c.fill();
      poly(c, [-0.22, -0.5, -0.15, -0.78, 0.15, -0.78, 0.22, -0.5]); c.fill(); poly(c, [-0.06, -0.78, 0, -1.0, 0.06, -0.78]); c.fill();
      for (const [x, dir] of [[0.45, 1], [0.78, 1], [-0.72, -1], [-1.02, -1]]) { rr(c, x, -0.24, 0.26, 0.2, 0.06); c.fill(); rr(c, dir > 0 ? x + 0.2 : x - 0.3, -0.2, 0.36, 0.06, 0.03); c.fill(); }
      sh(c, () => { for (const y of [-0.38, -0.66]) { rr(c, -0.16, y, 0.32, 0.08, 0.02); c.fill(); } c.fillRect(-0.92, 0.16, 1.74, 0.06); for (let i = 0; i < 5; i++) { circ(c, -0.6 + i * 0.3, 0.28, 0.04); c.fill(); } });
    },
  });

  // ── infantry v3: one shading pass per tone, so overlapping details never double-darken ──
  const rrp = (c, x, y, w, h, r) => { if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
  function shade(c, build, a) { c.save(); c.fillStyle = a || SH; c.beginPath(); build(); c.fill(); c.restore(); }
  function soldier(c, hat) {
    // shoulders and chest
    c.beginPath(); c.moveTo(-0.8, 0.98); c.quadraticCurveTo(-0.82, 0.32, -0.3, 0.27); c.lineTo(0.3, 0.27); c.quadraticCurveTo(0.82, 0.32, 0.8, 0.98); c.closePath(); c.fill();
    rr(c, -0.14, 0.04, 0.28, 0.28, 0.06); c.fill();
    c.beginPath(); c.ellipse(0, -0.06, 0.25, 0.29, 0, 0, P * 2); c.fill();
    if (hat === 'boonie') {
      c.beginPath(); c.arc(0, -0.17, 0.33, P, 0); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(0, -0.12, 0.66, 0.11, 0, 0, P * 2); c.fill();
    } else {
      c.beginPath(); c.arc(0, -0.16, 0.4, P, 0); c.lineTo(0.5, -0.11); c.quadraticCurveTo(0.53, -0.04, 0.45, -0.04); c.lineTo(-0.45, -0.04); c.quadraticCurveTo(-0.53, -0.04, -0.5, -0.11); c.closePath(); c.fill();
    }
    shade(c, () => {
      rrp(c, -0.19, -0.01, 0.38, 0.1, 0.04);                                         // shadow over the eyes
      c.moveTo(-0.14, 0.29); c.lineTo(0.14, 0.29); c.lineTo(0.08, 0.37); c.lineTo(-0.08, 0.37); c.closePath(); // collar
      rrp(c, -0.64, 0.5, 0.11, 0.48, 0.05); rrp(c, 0.53, 0.5, 0.11, 0.48, 0.05);     // arms
      // webbing: two straps and a belt, as one shape
      c.moveTo(-0.36, 0.33); c.lineTo(-0.24, 0.33); c.lineTo(-0.16, 0.8); c.lineTo(-0.28, 0.8); c.closePath();
      c.moveTo(0.24, 0.33); c.lineTo(0.36, 0.33); c.lineTo(0.28, 0.8); c.lineTo(0.16, 0.8); c.closePath();
      rrp(c, -0.52, 0.8, 1.04, 0.1, 0.03);
    });
    shade(c, () => { if (hat === 'boonie') rrp(c, -0.31, -0.2, 0.62, 0.06, 0.02); else rrp(c, -0.39, -0.13, 0.78, 0.05, 0.02); }, 'rgba(0,0,0,.2)');
  }
  // a rifle held across the chest: the silhouette pokes out past the body, then the whole gun is shaded dark over it
  function heldRifle(c, scope) {
    const build = () => {
      c.save(); c.translate(0.02, 0.58); c.rotate(-0.55);
      rrp(c, -0.88, -0.065, 1.78, 0.13, 0.04); rrp(c, -0.88, -0.08, 0.38, 0.2, 0.05); rrp(c, 0.12, 0.0, 0.11, 0.24, 0.03); rrp(c, 0.84, -0.05, 0.2, 0.1, 0.02);
      if (scope) rrp(c, -0.15, -0.2, 0.42, 0.1, 0.04);
      c.restore();
    };
    return { out: () => { c.beginPath(); build(); c.fill(); }, over: () => shade(c, build, 'rgba(0,0,0,.55)'),
      hands: () => { c.save(); c.translate(0.02, 0.58); c.rotate(-0.55); for (const x of [-0.32, 0.42]) { c.beginPath(); c.ellipse(x, 0.02, 0.11, 0.1, 0, 0, P * 2); c.fill(); } c.restore(); } };
  }
  Object.assign(UNIT, {
    grunt(c) { const r = heldRifle(c); r.out(); soldier(c); r.over(); r.hands(); },
    ranger(c) { const r = heldRifle(c, true); r.out(); soldier(c, 'boonie'); r.over(); r.hands(); },
    corpsman(c) {
      soldier(c);
      // red-cross armband on the chest
      shade(c, () => { c.arc(0, 0.58, 0.2, 0, P * 2); }, 'rgba(0,0,0,.5)');
      c.beginPath(); rrp(c, -0.05, 0.45, 0.1, 0.26, 0.02); rrp(c, -0.13, 0.53, 0.26, 0.1, 0.02); c.fill();
      // medkit hanging at the hip
      rr(c, 0.6, 0.48, 0.42, 0.34, 0.06); c.fill();
      shade(c, () => { rrp(c, 0.6, 0.56, 0.42, 0.05, 0.01); rrp(c, 0.775, 0.62, 0.07, 0.16, 0.01); rrp(c, 0.73, 0.665, 0.16, 0.07, 0.01); }, 'rgba(0,0,0,.42)');
    },
    sapper(c) {
      c.save(); c.translate(-0.24, 0.04); c.scale(0.86, 0.86); soldier(c); c.restore();
      rr(c, 0.34, 0.24, 0.62, 0.46, 0.07); c.fill();
      shade(c, () => { rrp(c, 0.34, 0.34, 0.62, 0.06, 0.01); rrp(c, 0.34, 0.54, 0.62, 0.06, 0.01); rrp(c, 0.55, 0.28, 0.2, 0.1, 0.02); }, 'rgba(0,0,0,.4)');
      c.lineWidth = 0.06; c.lineCap = 'round'; c.beginPath(); c.moveTo(0.65, 0.24); c.bezierCurveTo(0.62, -0.08, 0.86, -0.14, 0.83, -0.42); c.stroke();
      poly(c, [0.83, -0.74, 0.89, -0.56, 1.03, -0.58, 0.91, -0.46, 0.99, -0.32, 0.83, -0.4, 0.69, -0.3, 0.75, -0.46, 0.63, -0.58, 0.78, -0.56]); c.fill();
    },
    lancer(c) {
      soldier(c);
      const tube = () => { c.save(); c.translate(0, -0.2); c.rotate(-0.12); rrp(c, -0.95, -0.15, 1.75, 0.3, 0.08); c.moveTo(-0.95, -0.19); c.lineTo(-1.12, -0.27); c.lineTo(-1.12, 0.23); c.lineTo(-0.95, 0.15); c.closePath(); c.moveTo(0.8, -0.13); c.lineTo(1.08, -0.01); c.lineTo(0.8, 0.11); c.closePath(); rrp(c, 0.0, -0.35, 0.22, 0.2, 0.04); c.restore(); };
      c.beginPath(); tube(); c.fill();
      shade(c, () => { c.save(); c.translate(0, -0.2); c.rotate(-0.12); rrp(c, -0.55, -0.15, 0.08, 0.3, 0.01); rrp(c, 0.45, -0.15, 0.08, 0.3, 0.01); rrp(c, 0.04, -0.31, 0.14, 0.1, 0.02); c.restore(); }, 'rgba(0,0,0,.4)');
    },
    // MQ-9 style hunter-killer drone, seen from above
    hornet(c) {
      c.save(); c.rotate(-0.3);
      const wing = () => { c.moveTo(-1.08, 0.02); c.lineTo(-1.0, -0.07); c.lineTo(1.0, -0.07); c.lineTo(1.08, 0.02); c.lineTo(1.0, 0.08); c.lineTo(-1.0, 0.08); c.closePath(); };
      c.beginPath(); wing(); c.fill();
      c.beginPath(); c.moveTo(0, -0.92); c.quadraticCurveTo(0.2, -0.88, 0.18, -0.55); c.lineTo(0.11, 0.62); c.lineTo(-0.11, 0.62); c.lineTo(-0.18, -0.55); c.quadraticCurveTo(-0.2, -0.88, 0, -0.92); c.fill();
      poly(c, [0.05, 0.48, 0.44, 0.76, 0.44, 0.86, 0.04, 0.68]); c.fill(); poly(c, [-0.05, 0.48, -0.44, 0.76, -0.44, 0.86, -0.04, 0.68]); c.fill();
      for (const x of [-0.72, -0.42, 0.42, 0.72]) { rr(c, x - 0.045, -0.02, 0.09, 0.36, 0.04); c.fill(); }
      c.save(); c.globalAlpha *= 0.55; c.beginPath(); c.ellipse(0, 0.7, 0.3, 0.05, 0, 0, P * 2); c.fill(); c.restore();
      rr(c, -0.05, 0.62, 0.1, 0.12, 0.03); c.fill();
      shade(c, () => {
        c.ellipse(0, -0.7, 0.13, 0.18, 0, 0, P * 2);                                   // satcom dome
        rrp(c, -0.02, -0.42, 0.04, 0.95, 0.02);                                         // spine
        rrp(c, -0.95, 0.03, 0.55, 0.04, 0.02); rrp(c, 0.4, 0.03, 0.55, 0.04, 0.02);      // ailerons
      }, 'rgba(0,0,0,.36)');
      shade(c, () => { c.arc(0, -0.38, 0.07, 0, P * 2); }, 'rgba(0,0,0,.6)');           // sensor ball
      c.restore();
    },
  });

  const TACTIC = {
    cache(c) { rr(c, -0.75, -0.45, 1.5, 1.05, 0.08); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-0.75, -0.12, 1.5, 0.14); c.fillRect(-0.08, -0.45, 0.16, 1.05); c.restore(); poly(c, [-0.3, -0.45, 0, -0.85, 0.3, -0.45]); c.fill(); },
    smoke(c) { for (const [x, y, r] of [[-0.45, 0.2, 0.38], [0.1, -0.05, 0.5], [0.55, 0.25, 0.33], [-0.05, 0.4, 0.35], [-0.3, -0.35, 0.3]]) { circ(c, x, y, r); c.fill(); } },
    march(c) { for (let i = 0; i < 3; i++) { poly(c, [-0.9 + i * 0.55, -0.6, -0.55 + i * 0.55, -0.6, -0.15 + i * 0.55, 0, -0.55 + i * 0.55, 0.6, -0.9 + i * 0.55, 0.6, -0.5 + i * 0.55, 0]); c.fill(); } },
    conscript(c) { c.save(); c.translate(-0.15, 0.1); c.scale(0.8, 0.8); UNIT.grunt(c); c.restore(); rr(c, 0.45, -0.75, 0.16, 0.6, 0.04); c.fill(); rr(c, 0.23, -0.53, 0.6, 0.16, 0.04); c.fill(); },
    airstrike(c) { poly(c, [-0.9, -0.55, 0.6, -0.75, 0.95, -0.62, 0.6, -0.48, -0.9, -0.45]); c.fill(); poly(c, [-0.2, -0.6, 0.15, -0.95, 0.35, -0.95, 0.2, -0.6]); c.fill(); for (const [x, y] of [[-0.4, 0.05], [0.05, 0.3], [0.45, 0.6]]) { c.beginPath(); c.ellipse(x, y, 0.12, 0.22, -0.3, 0, P * 2); c.fill(); } },
    heli(c) { c.beginPath(); c.ellipse(-0.1, 0.1, 0.55, 0.32, 0, 0, P * 2); c.fill(); rr(c, 0.35, 0.02, 0.7, 0.12, 0.04); c.fill(); rr(c, 0.9, -0.15, 0.1, 0.4, 0.03); c.fill(); rr(c, -1, -0.45, 1.8, 0.08, 0.03); c.fill(); rr(c, -0.14, -0.45, 0.08, 0.25, 0.02); c.fill(); c.lineWidth = 0.08; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(-0.5, 0.55); c.lineTo(0.3, 0.55); c.stroke(); },
    sabotage(c) { for (let i = -1; i <= 1; i++) { rr(c, i * 0.32 - 0.13, -0.3, 0.26, 0.95, 0.06); c.fill(); } c.lineWidth = 0.07; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(0, -0.3); c.quadraticCurveTo(0.2, -0.75, 0.55, -0.7); c.stroke(); circ(c, 0.62, -0.72, 0.12); c.fill(); },
    bonds(c) { for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-0.25 + (i % 2) * 0.1, 0.55 - i * 0.28, 0.55, 0.2, 0, 0, P * 2); c.fill(); } c.save(); c.fillStyle = 'rgba(0,0,0,.4)'; c.font = 'bold 0.5px sans-serif'; c.textAlign = 'center'; c.fillText('$', -0.15, -0.15); c.restore(); },
    blitz(c) { poly(c, [0.15, -0.95, -0.55, 0.1, -0.05, 0.1, -0.25, 0.95, 0.6, -0.2, 0.1, -0.2, 0.35, -0.95]); c.fill(); },
    emp(c) { c.lineWidth = 0.1; c.strokeStyle = c.fillStyle; for (const r of [0.35, 0.6, 0.85]) { c.beginPath(); c.arc(0, 0, r, -0.7, 0.7); c.stroke(); c.beginPath(); c.arc(0, 0, r, P - 0.7, P + 0.7); c.stroke(); } circ(c, 0, 0, 0.18); c.fill(); },
    nuke(c) { circ(c, 0, 0, 0.16); c.fill(); for (let i = 0; i < 3; i++) { const a = -P / 2 + i * P * 2 / 3; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 0.85, a - 0.5, a + 0.5); c.closePath(); c.fill(); } c.save(); c.globalCompositeOperation = 'destination-out'; circ(c, 0, 0, 0.27); c.fill(); c.restore(); circ(c, 0, 0, 0.16); c.fill(); },
    jackpot(c) { rr(c, -0.85, -0.6, 1.7, 1.2, 0.15); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.55)'; for (let i = 0; i < 3; i++) rr(c, -0.7 + i * 0.48, -0.42, 0.4, 0.84, 0.06), c.fill(); c.restore(); c.save(); c.font = 'bold 0.62px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; for (let i = 0; i < 3; i++) c.fillText('7', -0.5 + i * 0.48, 0.04); c.restore(); rr(c, 0.88, -0.45, 0.12, 0.5, 0.04); c.fill(); circ(c, 0.94, -0.55, 0.12); c.fill(); },
    carpet(c) { poly(c, [-1, -0.75, 0.6, -0.95, 1, -0.82, 0.6, -0.68, -1, -0.65]); c.fill(); for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(-0.7 + i * 0.35, -0.25 + (i % 2) * 0.3 + i * 0.1, 0.1, 0.2, -0.3, 0, Math.PI * 2); c.fill(); } for (let i = 0; i < 4; i++) { circ(c, -0.6 + i * 0.42, 0.75, 0.16); c.fill(); } },
    drop_rare(c) { TACTIC._drop(c); }, drop_epic(c) { TACTIC._drop(c); }, drop_legendary(c) { TACTIC._drop(c); },
    _drop(c) { c.beginPath(); c.arc(0, -0.35, 0.72, Math.PI, 0); c.closePath(); c.fill(); c.lineWidth = 0.06; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(-0.7, -0.35); c.lineTo(-0.28, 0.25); c.moveTo(0.7, -0.35); c.lineTo(0.28, 0.25); c.moveTo(0, -0.35); c.lineTo(0, 0.25); c.stroke(); rr(c, -0.36, 0.22, 0.72, 0.58, 0.06); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(-0.36, 0.45, 0.72, 0.1); c.fillRect(-0.05, 0.22, 0.1, 0.58); c.restore(); },
    mutiny(c) { rr(c, -0.65, -0.85, 0.12, 1.7, 0.03); c.fill(); c.beginPath(); c.moveTo(-0.53, -0.8); c.quadraticCurveTo(0, -0.95, 0.2, -0.75); c.quadraticCurveTo(0.5, -0.55, 0.85, -0.7); c.lineTo(0.85, 0.05); c.quadraticCurveTo(0.5, 0.2, 0.2, 0.0); c.quadraticCurveTo(0, -0.15, -0.53, 0.0); c.closePath(); c.fill(); },
  };

  Object.assign(TACTIC, {
    rally(c) { rr(c, -0.7, -0.9, 0.1, 1.8, 0.03); c.fill(); poly(c, [-0.6, -0.85, 0.85, -0.6, -0.6, -0.15]); c.fill(); for (let i = 0; i < 3; i++) { poly(c, [-0.3 + i * 0.35, 0.85, -0.15 + i * 0.35, 0.1, 0 + i * 0.35, 0.85]); c.fill(); } },
    fortify(c) { STRUCT.bunker(c); rr(c, -0.08, -0.9, 0.16, 0.6, 0.04); c.fill(); rr(c, -0.3, -0.68, 0.6, 0.16, 0.04); c.fill(); },
    embargo(c) { c.lineWidth = 0.16; circ(c, 0, 0, 0.75); c.stroke(); c.beginPath(); c.moveTo(-0.53, 0.53); c.lineTo(0.53, -0.53); c.stroke(); c.save(); c.font = 'bold 0.8px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.8; c.fillText('$', 0, 0.05); c.restore(); },
    bounty(c) { c.lineWidth = 0.1; circ(c, 0, 0, 0.7); c.stroke(); circ(c, 0, 0, 0.38); c.stroke(); for (const [x, y, w, h] of [[-0.05, -1, 0.1, 0.5], [-0.05, 0.5, 0.1, 0.5], [-1, -0.05, 0.5, 0.1], [0.5, -0.05, 0.5, 0.1]]) c.fillRect(x, y, w, h); circ(c, 0, 0, 0.12); c.fill(); },
    orbital(c) { rr(c, -0.25, -0.95, 0.5, 0.32, 0.05); c.fill(); rr(c, -0.8, -0.88, 0.45, 0.18, 0.03); c.fill(); rr(c, 0.35, -0.88, 0.45, 0.18, 0.03); c.fill(); poly(c, [-0.12, -0.6, 0.12, -0.6, 0.3, 0.55, -0.3, 0.55]); c.fill(); c.beginPath(); c.ellipse(0, 0.65, 0.7, 0.2, 0, 0, P * 2); c.fill(); },
  });
  const POI = {
    ruins(c) { for (const [x, h] of [[-0.6, 0.9], [-0.2, 0.55], [0.2, 1.1], [0.6, 0.7]]) { rr(c, x - 0.13, 0.6 - h, 0.26, h, 0.03); c.fill(); } rr(c, -0.85, 0.55, 1.7, 0.2, 0.04); c.fill(); rr(c, -0.75, -0.5, 0.75, 0.15, 0.03); c.fill(); },
    cache(c) { TACTIC.cache(c); },
    village(c) { for (const [x, s] of [[-0.45, 0.8], [0.4, 1]]) { c.save(); c.translate(x, 0.2); c.scale(s, s); poly(c, [-0.45, -0.1, 0, -0.55, 0.45, -0.1]); c.fill(); rr(c, -0.35, -0.12, 0.7, 0.6, 0.03); c.fill(); c.restore(); } },
    fort(c) { rr(c, -0.85, -0.2, 1.7, 0.95, 0.04); c.fill(); for (let i = 0; i < 4; i++) c.fillRect(-0.85 + i * 0.5, -0.45, 0.3, 0.3); c.save(); c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.arc(0, 0.75, 0.25, P, 0); c.fill(); c.restore(); },
    relic(c) { poly(c, [0, -0.95, 0.5, -0.1, 0, 0.95, -0.5, -0.1]); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.3)'; poly(c, [0, -0.95, 0.5, -0.1, 0, -0.1]); c.fill(); c.restore(); },
  };
  const STRUCT = {
    hq(c) { poly(c, [-0.55, 0.8, -0.4, -0.3, 0.4, -0.3, 0.55, 0.8]); c.fill(); rr(c, -0.55, -0.5, 1.1, 0.28, 0.04); c.fill(); for (let i = -2; i <= 2; i++) c.fillRect(i * 0.22 - 0.07, -0.68, 0.14, 0.2); },
    fob(c) { poly(c, [-0.85, 0.7, 0, -0.35, 0.85, 0.7]); c.fill(); rr(c, -0.04, -0.95, 0.08, 0.7, 0.02); c.fill(); poly(c, [0.04, -0.95, 0.6, -0.8, 0.04, -0.62]); c.fill(); },
    bunker(c) { c.beginPath(); c.arc(0, 0.55, 0.8, P, 0); c.closePath(); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-0.4, 0.05, 0.8, 0.12); c.restore(); },
    refinery(c) { rr(c, -0.75, 0.0, 1.0, 0.75, 0.05); c.fill(); rr(c, 0.3, -0.75, 0.32, 1.5, 0.05); c.fill(); poly(c, [-0.75, 0, -0.45, -0.3, -0.45, 0, -0.15, -0.3, -0.15, 0]); c.fill(); },
    flak(c) { rr(c, -0.65, 0.3, 1.3, 0.45, 0.1); c.fill(); circ(c, 0, 0.2, 0.35); c.fill(); c.save(); c.rotate(-0.7); rr(c, -0.2, -0.95, 0.12, 0.9, 0.03); c.fill(); rr(c, 0.08, -0.95, 0.12, 0.9, 0.03); c.fill(); c.restore(); },
    bridge(c) { c.lineWidth = 0.16; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(0, 0.75, 0.7, Math.PI, 0); c.stroke(); rr(c, -1, -0.15, 2, 0.18, 0.04); c.fill(); for (const x of [-0.55, 0, 0.55]) { rr(c, x - 0.05, -0.15, 0.1, 0.9, 0.02); c.fill(); } rr(c, -1, -0.45, 0.12, 1.2, 0.03); c.fill(); rr(c, 0.88, -0.45, 0.12, 1.2, 0.03); c.fill(); },
    port(c) { c.lineWidth = 0.16; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(0, -0.05, 0.62, 0.15, Math.PI - 0.15); c.stroke(); rr(c, -0.08, -0.85, 0.16, 1.4, 0.04); c.fill(); rr(c, -0.42, -0.55, 0.84, 0.15, 0.04); c.fill(); circ(c, 0, -0.85, 0.16); c.fill(); poly(c, [-0.75, 0.05, -0.5, -0.15, -0.5, 0.25]); c.fill(); poly(c, [0.75, 0.05, 0.5, -0.15, 0.5, 0.25]); c.fill(); },
    market(c) { poly(c, [-0.85, -0.2, -0.6, -0.75, 0.6, -0.75, 0.85, -0.2]); c.fill(); rr(c, -0.7, -0.15, 1.4, 0.9, 0.06); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < 4; i++) c.fillRect(-0.85 + i * 0.425, -0.24, 0.21, 0.12); c.fillRect(-0.25, 0.25, 0.5, 0.5); c.restore(); },
    depot(c) { rr(c, -0.85, -0.1, 0.8, 0.75, 0.05); c.fill(); rr(c, 0.05, 0.15, 0.8, 0.5, 0.05); c.fill(); rr(c, -0.4, -0.75, 0.8, 0.6, 0.05); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-0.85, 0.2, 0.8, 0.08); c.fillRect(-0.4, -0.5, 0.8, 0.08); c.fillRect(0.05, 0.36, 0.8, 0.08); c.restore(); },
  };

  const GLYPH = {
    shield(c) { c.beginPath(); c.moveTo(0, -0.9); c.lineTo(0.75, -0.6); c.quadraticCurveTo(0.75, 0.45, 0, 0.92); c.quadraticCurveTo(-0.75, 0.45, -0.75, -0.6); c.closePath(); c.fill(); },
    bolt(c) { TACTIC.blitz(c); },
    skull(c) { circ(c, 0, -0.15, 0.68); c.fill(); rr(c, -0.38, 0.3, 0.76, 0.55, 0.1); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; circ(c, -0.27, -0.12, 0.18); c.fill(); circ(c, 0.27, -0.12, 0.18); c.fill(); poly(c, [0, 0.1, 0.1, 0.3, -0.1, 0.3]); c.fill(); c.restore(); },
    leaf(c) { c.beginPath(); c.moveTo(-0.7, 0.75); c.quadraticCurveTo(-0.8, -0.6, 0.8, -0.8); c.quadraticCurveTo(0.6, 0.7, -0.7, 0.75); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = 0.1; c.beginPath(); c.moveTo(-0.6, 0.65); c.lineTo(0.5, -0.5); c.stroke(); c.restore(); },
    eye(c) { c.beginPath(); c.moveTo(-0.95, 0); c.quadraticCurveTo(0, -0.85, 0.95, 0); c.quadraticCurveTo(0, 0.85, -0.95, 0); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; circ(c, 0, 0, 0.36); c.fill(); c.restore(); circ(c, 0, 0, 0.18); c.fill(); },
  };

  function drawIcon(c, kind, id, x, y, size, color) {
    const fn = (kind === 'unit' ? UNIT : kind === 'tactic' ? TACTIC : kind === 'struct' ? STRUCT : kind === 'poi' ? POI : GLYPH)[id];
    if (!fn) return;
    c.save(); c.translate(x, y); c.scale(size, size); c.fillStyle = color || '#fff'; c.strokeStyle = color || '#fff'; c.lineCap = 'round';
    fn(c); c.restore();
  }

  const cache = {};
  function iconURL(kind, id, color = '#fff', px = 96) {
    const k = kind + id + color + px; if (cache[k]) return cache[k];
    const cv = document.createElement('canvas'); cv.width = cv.height = px;
    drawIcon(cv.getContext('2d'), kind, id, px / 2, px / 2, px * 0.42, color);
    return cache[k] = cv.toDataURL();
  }

  // full card illustration
  // Balatro-style card art: a chunky pixel swirl in the rarity's palette, halftone, then the
  // silhouette with a thick ink outline
  const PAL = {
    common: ['#24303d', '#3d4f62', '#6f8399'],
    uncommon: ['#103524', '#1f6a43', '#47c17a'],
    rare: ['#0d2148', '#1c4f9a', '#4fa2ff'],
    epic: ['#2a0b40', '#6a1f99', '#d36bff'],
    legendary: ['#3d2005', '#a8620f', '#ffcc4a'],
  };
  const hexRGB = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function swirl(W, H, pal, seed, tactic) {
    const lw = Math.ceil(W / 4), lh = Math.ceil(H / 4);
    const lo = document.createElement('canvas'); lo.width = lw; lo.height = lh;
    const lc = lo.getContext('2d'), img = lc.createImageData(lw, lh);
    const cols = pal.map(hexRGB);
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const dx = (x - lw / 2) / lh, dy = (y - lh / 2) / lh;
      const r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      let v = tactic
        ? Math.sin(r * 22 - seed + Math.sin(ang * 3 + seed) * 1.4)
        : Math.sin(ang * 3 + r * 9 + seed) * 0.7 + Math.sin(r * 14 - ang * 2 + seed * 2) * 0.3;
      v = (v + 1) / 2;
      const band = v < 0.38 ? 0 : v < 0.72 ? 1 : 2;
      const c = cols[band], dim = 1 - Math.min(0.45, r * 0.55);
      const i = (y * lw + x) * 4;
      img.data[i] = c[0] * dim; img.data[i + 1] = c[1] * dim; img.data[i + 2] = c[2] * dim; img.data[i + 3] = 255;
    }
    lc.putImageData(img, 0, 0);
    return lo;
  }
  // the shared card back: crimson hex weave, cream frame, dark panel with the SECTOR emblem
  function hexP(c, cx, cy, r) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = P / 3 * i - P / 2; c.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } c.closePath(); }
  function cardBack() {
    if (cache.back) return cache.back;
    const W = 300, H = 420, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), cx = W / 2, cy = H / 2;
    // outer field + weave
    c.fillStyle = '#9e1f2c'; rr(c, 0, 0, W, H, 22); c.fill();
    c.save(); rr(c, 0, 0, W, H, 22); c.clip();
    for (let row = -1, y = 0; y < H + 20; row++, y += 15) for (let x = (row & 1) * 9 - 9; x < W + 20; x += 18) { hexP(c, x, y, 7.5); c.fillStyle = (row + Math.round(x / 18)) % 3 ? '#b42736' : '#c8394a'; c.fill(); }
    const vg = c.createRadialGradient(cx, cy, 60, cx, cy, 260); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,0,6,.55)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
    c.restore();
    // cream frame and dark panel
    c.fillStyle = '#f3ead6'; rr(c, 16, 16, W - 32, H - 32, 14); c.fill();
    c.fillStyle = '#c9b996'; rr(c, 22, 22, W - 44, H - 44, 11); c.fill();
    const pg = c.createLinearGradient(0, 26, 0, H - 26); pg.addColorStop(0, '#1d2a36'); pg.addColorStop(0.5, '#121b24'); pg.addColorStop(1, '#0c1218');
    c.fillStyle = pg; rr(c, 26, 26, W - 52, H - 52, 9); c.fill();
    // faint gold lattice inside the panel
    c.save(); rr(c, 26, 26, W - 52, H - 52, 9); c.clip();
    c.strokeStyle = 'rgba(255,197,61,.13)'; c.lineWidth = 1.5;
    for (let row = 0, y = 26; y < H; row++, y += 26) for (let x = 26 + (row & 1) * 15; x < W; x += 30) { hexP(c, x, y, 14); c.stroke(); }
    // red chevron bands top and bottom
    for (const [y, dir] of [[70, 1], [H - 70, -1]]) { c.fillStyle = 'rgba(255,79,94,.22)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(26, y + dir * i * 12); c.lineTo(cx, y + dir * (i * 12 - 22)); c.lineTo(W - 26, y + dir * i * 12); c.lineTo(W - 26, y + dir * (i * 12 + 6)); c.lineTo(cx, y + dir * (i * 12 - 16)); c.lineTo(26, y + dir * (i * 12 + 6)); c.closePath(); c.fill(); } }
    c.restore();
    // corner studs
    for (const [x, y] of [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]]) { hexP(c, x, y, 9); c.fillStyle = '#ffc53d'; c.fill(); hexP(c, x, y, 4.5); c.fillStyle = '#7a5410'; c.fill(); }
    // emblem
    hexP(c, cx, cy + 6, 78); c.fillStyle = '#000'; c.fill();
    hexP(c, cx, cy, 78); c.fillStyle = '#b52b38'; c.fill();
    hexP(c, cx, cy - 2, 74); c.fillStyle = '#ff4f5e'; c.fill();
    hexP(c, cx, cy, 62); const eg = c.createLinearGradient(0, cy - 62, 0, cy + 62); eg.addColorStop(0, '#26364a'); eg.addColorStop(1, '#0d141a'); c.fillStyle = eg; c.fill();
    hexP(c, cx, cy, 54); c.strokeStyle = '#ffc53d'; c.lineWidth = 3.5; c.stroke();
    c.font = '96px "Black Ops One", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#000'; c.fillText('S', cx, cy + 9); c.fillStyle = '#b52b38'; c.fillText('S', cx, cy + 5); c.fillStyle = '#f6f3e8'; c.fillText('S', cx, cy + 1);
    // wordmark top, and upside-down at the bottom like a playing card
    c.font = '26px "Black Ops One", Impact, sans-serif';
    const word = (y) => { c.fillStyle = '#000'; c.fillText('SECTOR', 0, y + 3); c.fillStyle = '#ffc53d'; c.fillText('SECTOR', 0, y); };
    c.save(); c.translate(cx, 0); word(104); c.restore();
    c.save(); c.translate(cx, H); c.rotate(P); c.translate(0, 0); word(104); c.restore();
    return cache.back = cv.toDataURL('image/png');
  }
  function cardArt(id) {
    const k = 'card' + id; if (cache[k]) return cache[k];
    const E = SectorEngine, d = E.cardDef(id), pal = PAL[d.rarity] || PAL.common;
    const W = 300, H = 210, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    let seed = 0; for (let i = 0; i < id.length; i++) seed += id.charCodeAt(i) * (i + 1);
    c.imageSmoothingEnabled = false;
    c.drawImage(swirl(W, H, pal, (seed % 100) / 10, d.kind === 'tactic'), 0, 0, W, H);
    // halftone + scanline texture
    c.fillStyle = 'rgba(0,0,0,.16)';
    for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    c.fillStyle = 'rgba(255,255,255,.07)';
    for (let y = 4; y < H; y += 9) for (let x = (y / 9 | 0) % 2 * 4.5; x < W; x += 9) { c.beginPath(); c.arc(x, y, 1.3, 0, P * 2); c.fill(); }
    // vignette
    const vg = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 190); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    // glow behind the silhouette
    const gl = c.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 95); gl.addColorStop(0, pal[2] + 'aa'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    // ink outline: stamp the icon in dark around itself, a drop shadow, then the shaded light fill on top
    const sz = 70, cx = W / 2, cy = H / 2 + 6;
    for (let a = 0; a < 20; a++) { const ang = a / 20 * P * 2; drawIcon(c, d.kind, id, cx + Math.cos(ang) * 5.5, cy + Math.sin(ang) * 5.5, sz, '#0b0f13'); }
    drawIcon(c, d.kind, id, cx + 5, cy + 8, sz, 'rgba(0,0,0,.55)');
    const L = document.createElement('canvas'); L.width = W; L.height = H; const l = L.getContext('2d');
    drawIcon(l, d.kind, id, cx, cy, sz, '#ffffff');
    const M = document.createElement('canvas'); M.width = W; M.height = H; M.getContext('2d').drawImage(L, 0, 0);
    l.globalCompositeOperation = 'multiply';
    const tint = l.createLinearGradient(0, cy - sz, 0, cy + sz); tint.addColorStop(0, '#fffdf6'); tint.addColorStop(0.5, '#f1e8d2'); tint.addColorStop(1, pal[2]);
    l.fillStyle = tint; l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'destination-in'; l.drawImage(M, 0, 0);
    c.drawImage(L, 0, 0);
    return cache[k] = cv.toDataURL('image/webp', 0.9);
  }

  return { cardBack, drawIcon, iconURL, cardArt, UNIT, TACTIC, STRUCT, GLYPH };
})();
