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
      // colossus mech: back cannon, heavy legs, armoured chest, shoulder plates, arm guns
      c.save(); c.translate(0.3, -0.42); c.rotate(-0.62); rr(c, 0, -0.09, 0.78, 0.18, 0.05); c.fill(); rr(c, 0.72, -0.12, 0.14, 0.24, 0.03); c.fill(); c.restore();
      poly(c, [-0.46, 0.22, -0.14, 0.22, -0.19, 0.72, -0.5, 0.72]); c.fill(); poly(c, [0.14, 0.22, 0.46, 0.22, 0.5, 0.72, 0.19, 0.72]); c.fill();
      rr(c, -0.64, 0.68, 0.52, 0.24, 0.07); c.fill(); rr(c, 0.12, 0.68, 0.52, 0.24, 0.07); c.fill();
      rr(c, -0.42, 0.1, 0.84, 0.2, 0.05); c.fill();
      poly(c, [-0.56, -0.52, 0.56, -0.52, 0.46, 0.18, -0.46, 0.18]); c.fill();
      rr(c, -0.17, -0.76, 0.34, 0.28, 0.1); c.fill();
      rr(c, -0.88, -0.24, 0.3, 0.54, 0.08); c.fill(); rr(c, 0.58, -0.24, 0.3, 0.54, 0.08); c.fill();
      for (const x of [-0.84, -0.7, 0.62, 0.76]) { rr(c, x, 0.26, 0.09, 0.28, 0.03); c.fill(); }
      circ(c, -0.7, -0.38, 0.25); c.fill(); circ(c, 0.7, -0.38, 0.25); c.fill();
      shade(c, () => {
        rrp(c, -0.11, -0.66, 0.22, 0.06, 0.02);                                              // visor
        c.moveTo(-0.3, -0.4); c.lineTo(0.3, -0.4); c.lineTo(0.24, -0.18); c.lineTo(-0.24, -0.18); c.closePath(); // cockpit
        rrp(c, -0.36, -0.04, 0.72, 0.05, 0.02);                                               // belly plate
        c.moveTo(-0.25, 0.48); c.arc(-0.32, 0.48, 0.07, 0, P * 2); c.moveTo(0.39, 0.48); c.arc(0.32, 0.48, 0.07, 0, P * 2); // knees
        rrp(c, -0.88, 0.06, 0.3, 0.05, 0.02); rrp(c, 0.58, 0.06, 0.3, 0.05, 0.02);            // arm bands
      }, 'rgba(0,0,0,.4)');
      shade(c, () => { c.arc(-0.7, -0.38, 0.13, 0, P * 2); c.moveTo(0.83, -0.38); c.arc(0.7, -0.38, 0.13, 0, P * 2); }, 'rgba(0,0,0,.25)');
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
      // launcher resting on the right shoulder, clear of the head
      c.save(); c.translate(-0.22, 0.04); c.scale(0.88, 0.88); soldier(c); c.restore();
      const tube = (withHead) => { c.save(); c.translate(0.5, 0.3); c.rotate(-0.28);
        rrp(c, -0.38, -0.13, 0.74, 0.26, 0.07);
        c.moveTo(-0.38, -0.16); c.lineTo(-0.52, -0.24); c.lineTo(-0.52, 0.2); c.lineTo(-0.38, 0.13); c.closePath();
        rrp(c, -0.08, -0.29, 0.18, 0.16, 0.03); rrp(c, 0.02, 0.1, 0.11, 0.22, 0.03);
        if (withHead) { c.moveTo(0.36, -0.12); c.lineTo(0.6, 0); c.lineTo(0.36, 0.12); c.closePath(); }
        c.restore(); };
      c.beginPath(); tube(true); c.fill();
      shade(c, () => tube(false), 'rgba(0,0,0,.5)');
      shade(c, () => { c.save(); c.translate(0.5, 0.3); c.rotate(-0.28); rrp(c, -0.28, -0.13, 0.05, 0.26, 0.01); rrp(c, 0.22, -0.13, 0.05, 0.26, 0.01); c.restore(); }, 'rgba(0,0,0,.35)');
      // hand on the grip
      c.save(); c.translate(0.5, 0.3); c.rotate(-0.28); c.beginPath(); c.ellipse(0.075, 0.3, 0.1, 0.09, 0, 0, P * 2); c.fill(); c.restore();
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

  // ── real-world counterparts: every vehicle and aircraft is drawn after a real machine ──
  Object.assign(UNIT, {
    // FIM-92 Stinger team: soldier with a launch tube on the shoulder
    stinger(c) {
      c.save(); c.translate(-0.22, 0.06); c.scale(0.86, 0.86); soldier(c); c.restore();
      c.save(); c.translate(0.3, 0.16); c.rotate(-0.62);
      rr(c, -0.62, -0.09, 1.36, 0.18, 0.06); c.fill();
      rr(c, -0.72, -0.13, 0.13, 0.26, 0.03); c.fill(); rr(c, 0.64, -0.13, 0.13, 0.26, 0.03); c.fill();
      rr(c, -0.06, -0.34, 0.24, 0.2, 0.03); c.fill(); rr(c, 0.02, 0.08, 0.1, 0.22, 0.03); c.fill();
      shade(c, () => { rrp(c, -0.5, -0.02, 1.1, 0.05, 0.02); rrp(c, -0.02, -0.3, 0.16, 0.06, 0.02); }, 'rgba(0,0,0,.42)');
      c.restore();
    },
    // Gepard: tracked flak tank, twin 35mm cannons, search radar behind, tracking dish in front
    scorpion(c) {
      tracks(c, -0.92, 0.2, 1.84, 0.32, 5);
      poly(c, [-0.95, 0.22, -0.85, -0.05, 0.85, -0.05, 0.95, 0.22]); c.fill();
      rr(c, -0.42, -0.42, 0.78, 0.4, 0.07); c.fill();
      c.save(); c.translate(0.18, -0.3); c.rotate(-0.55); rr(c, 0, -0.08, 0.85, 0.07, 0.02); c.fill(); rr(c, 0, 0.04, 0.85, 0.07, 0.02); c.fill(); c.restore();
      rr(c, -0.36, -0.7, 0.06, 0.3, 0.02); c.fill(); c.beginPath(); c.ellipse(-0.33, -0.76, 0.3, 0.08, 0, 0, P * 2); c.fill();
      circ(c, 0.28, -0.5, 0.13); c.fill();
      sh(c, () => { rr(c, -0.35, -0.3, 0.55, 0.07, 0.02); c.fill(); circ(c, 0.28, -0.5, 0.06); c.fill(); c.fillRect(-0.85, 0.06, 1.7, 0.05); });
    },
    // Pantsir: 8x8 truck with a gun-missile turret and search radar
    skyguard(c) {
      rr(c, -0.95, 0.1, 1.86, 0.26, 0.06); c.fill();
      poly(c, [0.48, 0.1, 0.53, -0.24, 0.85, -0.24, 0.96, -0.02, 0.96, 0.1]); c.fill();
      rr(c, -0.72, -0.24, 0.98, 0.36, 0.06); c.fill();
      c.save(); c.translate(-0.62, -0.3); c.rotate(-0.32); for (const y of [-0.13, -0.01]) { rr(c, 0, y, 0.62, 0.1, 0.04); c.fill(); } c.restore();
      c.save(); c.translate(0.08, -0.26); c.rotate(-0.32); rr(c, 0, -0.07, 0.62, 0.05, 0.02); c.fill(); rr(c, 0, 0.02, 0.62, 0.05, 0.02); c.fill(); c.restore();
      rr(c, -0.2, -0.66, 0.06, 0.42, 0.02); c.fill(); rr(c, -0.44, -0.74, 0.54, 0.14, 0.05); c.fill();
      for (const x of [-0.75, -0.47, 0.3, 0.68]) hub(c, x, 0.4, 0.15);
      sh(c, () => { rr(c, 0.6, -0.18, 0.2, 0.12, 0.02); c.fill(); c.fillRect(-0.9, 0.2, 1.76, 0.05); rr(c, -0.62, -0.12, 0.78, 0.06, 0.02); c.fill(); });
    },
    // Patriot: truck-mounted launcher, canister box raised
    sentinel(c) {
      rr(c, -0.95, 0.12, 1.86, 0.24, 0.06); c.fill();
      poly(c, [0.48, 0.12, 0.52, -0.25, 0.86, -0.25, 0.96, -0.02, 0.96, 0.12]); c.fill();
      c.save(); c.translate(0.08, 0.1); c.rotate(-1.1); rr(c, 0, -0.04, 0.44, 0.08, 0.02); c.fill(); c.restore();
      c.save(); c.translate(-0.62, 0.02); c.rotate(-0.6);
      rr(c, 0, -0.36, 1.05, 0.46, 0.04); c.fill();
      sh(c, () => { c.fillRect(0.04, -0.14, 0.97, 0.03); c.fillRect(0.52, -0.36, 0.03, 0.46); c.fillRect(0.95, -0.33, 0.06, 0.4); });
      c.restore();
      for (const x of [-0.72, -0.42, 0.64]) hub(c, x, 0.4, 0.16);
      sh(c, () => { rr(c, 0.58, -0.19, 0.22, 0.12, 0.02); c.fill(); c.fillRect(-0.9, 0.22, 1.76, 0.05); });
    },
    // S-300: a big 8x8 launcher truck with its four missile tubes stood up on end behind the cab
    grumble(c) {
      rr(c, -0.98, 0.12, 1.94, 0.24, 0.06); c.fill();
      poly(c, [0.5, 0.12, 0.54, -0.28, 0.88, -0.28, 0.98, -0.04, 0.98, 0.12]); c.fill();             // cab
      c.save(); c.translate(-0.66, 0.1); c.rotate(-1.42);
      for (const y of [-0.2, 0.0]) { rr(c, 0, y, 1.08, 0.18, 0.08); c.fill(); }                        // tubes, raised to fire
      sh(c, () => { for (const y of [-0.2, 0.0]) { c.fillRect(0.2, y + 0.07, 0.03, 0.05); c.fillRect(0.62, y + 0.07, 0.03, 0.05); c.fillRect(1.02, y + 0.02, 0.05, 0.14); } });
      c.restore();
      c.save(); c.translate(0.1, 0.1); c.rotate(-2.2); rr(c, 0, -0.04, 0.5, 0.08, 0.02); c.fill(); c.restore();   // erector arm
      for (const x of [-0.74, -0.46, 0.22, 0.56]) hub(c, x, 0.4, 0.15);
      sh(c, () => { rr(c, 0.6, -0.22, 0.22, 0.12, 0.02); c.fill(); c.fillRect(-0.92, 0.22, 1.8, 0.05); });
    },
    // HIMARS: 6x6 truck with a rocket pod
    basilisk(c) {
      rr(c, -0.95, 0.1, 1.86, 0.26, 0.06); c.fill();
      poly(c, [0.42, 0.1, 0.46, -0.3, 0.84, -0.3, 0.96, -0.05, 0.96, 0.1]); c.fill();
      c.save(); c.translate(-0.78, 0.04); c.rotate(-0.48);
      rr(c, 0, -0.44, 1.02, 0.46, 0.04); c.fill();
      sh(c, () => { c.fillRect(0.04, -0.3, 0.94, 0.03); c.fillRect(0.04, -0.16, 0.94, 0.03); for (let i = 0; i < 3; i++) { circ(c, 0.92, -0.37 + i * 0.14, 0.04); c.fill(); } });
      c.restore();
      for (const x of [-0.72, -0.4, 0.62]) hub(c, x, 0.4, 0.16);
      sh(c, () => { rr(c, 0.5, -0.24, 0.26, 0.14, 0.02); c.fill(); c.fillRect(-0.9, 0.2, 1.76, 0.05); });
    },
    // LCAC: armed hovercraft on its skirt, ducted fans at the back
    wraith(c) {
      rr(c, -0.98, 0.1, 1.96, 0.36, 0.18); c.fill();
      sh(c, () => { for (let i = 0; i < 7; i++) { rr(c, -0.86 + i * 0.26, 0.17, 0.06, 0.24, 0.03); c.fill(); } });
      rr(c, -0.86, -0.08, 1.72, 0.22, 0.05); c.fill();
      rr(c, 0.45, -0.34, 0.32, 0.28, 0.05); c.fill();
      for (const x of [-0.7, -0.34]) { circ(c, x, -0.36, 0.2); c.fill(); sh(c, () => { circ(c, x, -0.36, 0.13); c.fill(); }, SH2); rr(c, x - 0.02, -0.5, 0.04, 0.28, 0.01); c.fill(); }
      rr(c, 0.0, -0.28, 0.3, 0.2, 0.05); c.fill(); rr(c, 0.26, -0.24, 0.46, 0.06, 0.02); c.fill();
      sh(c, () => { rr(c, 0.5, -0.28, 0.22, 0.08, 0.02); c.fill(); c.fillRect(-0.8, 0.0, 1.6, 0.04); });
    },
    // Sturmtiger: siege mortar in a boxy casemate on a heavy tank hull
    goliath(c) {
      tracks(c, -0.95, 0.16, 1.9, 0.36, 6);
      poly(c, [-0.95, 0.18, -0.9, -0.08, 0.9, -0.08, 0.98, 0.18]); c.fill();
      poly(c, [-0.55, -0.08, -0.5, -0.56, 0.45, -0.56, 0.62, -0.08]); c.fill();
      rr(c, 0.46, -0.44, 0.4, 0.26, 0.1); c.fill(); circ(c, 0.86, -0.31, 0.13); c.fill();
      c.save(); c.translate(-0.46, -0.56); c.rotate(-0.95); rr(c, 0, -0.03, 0.36, 0.06, 0.02); c.fill(); c.restore();
      sh(c, () => { circ(c, 0.86, -0.31, 0.06); c.fill(); rr(c, -0.4, -0.46, 0.7, 0.06, 0.02); c.fill(); rr(c, -0.85, 0.0, 1.7, 0.05, 0.02); c.fill(); });
    },
    // Ratte: a landship with naval guns, a rear turret and AA mount
    titan(c) {
      tracks(c, -1.02, 0.2, 2.04, 0.34, 7);
      poly(c, [-1.0, 0.22, -0.95, -0.1, 0.95, -0.1, 1.02, 0.22]); c.fill();
      poly(c, [-0.35, -0.1, -0.3, -0.52, 0.35, -0.52, 0.45, -0.1]); c.fill();
      rr(c, 0.3, -0.44, 0.74, 0.08, 0.03); c.fill(); rr(c, 0.3, -0.31, 0.74, 0.08, 0.03); c.fill();
      rr(c, -0.86, -0.33, 0.36, 0.23, 0.05); c.fill(); rr(c, -1.04, -0.27, 0.22, 0.05, 0.02); c.fill();
      rr(c, -0.14, -0.7, 0.18, 0.18, 0.04); c.fill(); rr(c, -0.06, -0.84, 0.04, 0.16, 0.01); c.fill();
      sh(c, () => { rr(c, -0.25, -0.42, 0.55, 0.07, 0.02); c.fill(); rr(c, -0.92, 0.02, 1.84, 0.05, 0.02); c.fill(); });
    },
    // V-22 Osprey from above: tiltrotor nacelles on the wingtips
    valkyrie(c) {
      c.beginPath(); c.moveTo(0, -0.9); c.quadraticCurveTo(0.16, -0.85, 0.15, -0.55); c.lineTo(0.13, 0.6); c.lineTo(-0.13, 0.6); c.lineTo(-0.15, -0.55); c.quadraticCurveTo(-0.16, -0.85, 0, -0.9); c.fill();
      rr(c, -0.66, -0.14, 1.32, 0.16, 0.05); c.fill();
      poly(c, [-0.4, 0.55, 0.4, 0.55, 0.4, 0.66, -0.4, 0.66]); c.fill();
      for (const x of [-0.4, 0.4]) { rr(c, x - 0.04, 0.48, 0.08, 0.26, 0.02); c.fill(); }
      for (const x of [-0.68, 0.68]) {
        rr(c, x - 0.09, -0.3, 0.18, 0.38, 0.06); c.fill();
        c.save(); c.globalAlpha *= 0.4; circ(c, x, -0.36, 0.3); c.fill(); c.restore();
        for (let i = 0; i < 3; i++) { c.save(); c.translate(x, -0.36); c.rotate(i * P * 2 / 3 + 0.3); rr(c, -0.03, -0.3, 0.06, 0.3, 0.02); c.fill(); c.restore(); }
      }
      shade(c, () => { c.ellipse(0, -0.68, 0.07, 0.13, 0, 0, P * 2); }, 'rgba(0,0,0,.4)');
    },
    // AC-130 gunship from above: four turboprops, guns down the port side
    seraph(c) {
      c.beginPath(); c.moveTo(0, -0.96); c.quadraticCurveTo(0.17, -0.9, 0.16, -0.6); c.lineTo(0.13, 0.55); c.lineTo(0.05, 0.86); c.lineTo(-0.05, 0.86); c.lineTo(-0.13, 0.55); c.lineTo(-0.16, -0.6); c.quadraticCurveTo(-0.17, -0.9, 0, -0.96); c.fill();
      poly(c, [-1.02, -0.24, 1.02, -0.24, 1.0, -0.1, -1.0, -0.1]); c.fill();
      poly(c, [-0.44, 0.62, 0.44, 0.62, 0.4, 0.74, -0.4, 0.74]); c.fill();
      for (const x of [-0.72, -0.38, 0.38, 0.72]) { rr(c, x - 0.06, -0.38, 0.12, 0.34, 0.05); c.fill(); rr(c, x - 0.2, -0.42, 0.4, 0.04, 0.02); c.fill(); }
      for (const y of [-0.36, 0.04, 0.3]) { rr(c, -0.33, y, 0.2, 0.05, 0.02); c.fill(); }
      shade(c, () => { c.ellipse(0, -0.8, 0.08, 0.1, 0, 0, P * 2); rrp(c, -0.02, -0.5, 0.04, 1.0, 0.02); }, 'rgba(0,0,0,.35)');
    },
    // Stryker-style 8x8 fighting vehicle with a remote weapon station
    wraith(c) {
      poly(c, [-0.95, 0.18, -0.9, -0.12, -0.6, -0.26, 0.62, -0.26, 0.96, -0.02, 0.98, 0.18]); c.fill();
      rr(c, -0.2, -0.46, 0.4, 0.22, 0.05); c.fill(); rr(c, 0.14, -0.4, 0.56, 0.06, 0.02); c.fill(); rr(c, -0.12, -0.58, 0.08, 0.14, 0.02); c.fill();
      for (const x of [-0.7, -0.4, 0.25, 0.6]) hub(c, x, 0.3, 0.16);
      sh(c, () => { rr(c, -0.85, -0.04, 1.7, 0.06, 0.02); c.fill(); for (const x of [-0.55, -0.1, 0.35]) { rr(c, x, -0.18, 0.18, 0.08, 0.02); c.fill(); } rr(c, 0.62, -0.18, 0.2, 0.1, 0.02); c.fill(); });
    },
    // up-armoured Humvee: wide, low, flat armoured body, a gunner's shield and an M2
    jackal(c) {
      const tyre = (x) => { circ(c, x, 0.3, 0.25); c.fill(); sh(c, () => { circ(c, x, 0.3, 0.13); c.fill(); }, SH2); circ(c, x, 0.3, 0.06); c.fill(); };
      poly(c, [-0.98, 0.18, -0.98, -0.12, -0.62, -0.14, -0.55, -0.36, 0.2, -0.36, 0.3, -0.14, 0.95, -0.1, 0.98, 0.0, 0.98, 0.18]); c.fill();
      rr(c, 0.86, -0.08, 0.16, 0.24, 0.03); c.fill();                       // brush guard
      poly(c, [-0.32, -0.36, -0.3, -0.72, -0.02, -0.72, 0.02, -0.36]); c.fill();   // gunner's shield plate
      rr(c, -0.06, -0.64, 0.7, 0.07, 0.02); c.fill(); rr(c, 0.56, -0.67, 0.1, 0.12, 0.02); c.fill();   // M2 heavy machine gun
      tyre(-0.6); tyre(0.6);
      sh(c, () => {
        rr(c, -0.5, -0.31, 0.26, 0.08, 0.02); c.fill(); rr(c, -0.16, -0.31, 0.3, 0.08, 0.02); c.fill();   // slit armoured glass
        c.fillRect(-0.98, 0.0, 1.96, 0.05); rr(c, 0.34, -0.08, 0.5, 0.05, 0.02); c.fill();                 // body line, hood vent
        for (const x of [-0.24, 0.0]) c.fillRect(x, -0.62, 0.03, 0.22);                                     // shield rivets
      });
    },
    // JLTV: tall, angular V-hull with armour panels, a spare tyre and a sensor mast
    coyote(c) {
      const tyre = (x) => { circ(c, x, 0.32, 0.25); c.fill(); sh(c, () => { circ(c, x, 0.32, 0.13); c.fill(); }, SH2); circ(c, x, 0.32, 0.06); c.fill(); };
      poly(c, [-0.98, 0.16, -0.98, -0.22, -0.55, -0.28, -0.48, -0.5, 0.18, -0.5, 0.36, -0.2, 0.92, -0.12, 1.0, 0.04, 0.9, 0.2, -0.9, 0.2]); c.fill();
      circ(c, -1.0, -0.06, 0.15); c.fill();                                  // spare on the tailgate
      rr(c, -0.3, -0.98, 0.06, 0.5, 0.02); c.fill(); rr(c, -0.45, -1.02, 0.36, 0.14, 0.04); c.fill();   // sensor mast and head
      tyre(-0.58); tyre(0.6);
      sh(c, () => {
        rr(c, -0.4, -0.45, 0.22, 0.12, 0.02); c.fill(); rr(c, -0.12, -0.45, 0.24, 0.12, 0.02); c.fill();   // armoured windows
        poly(c, [-0.9, 0.06, 0.9, 0.06, 0.8, 0.16, -0.8, 0.16]); c.fill();                                    // V-hull belly
        c.fillRect(-0.5, -0.24, 0.02, 0.24); c.fillRect(0.2, -0.24, 0.02, 0.24); c.fillRect(-0.4, -0.99, 0.26, 0.04);
      });
    },
    // M270 MLRS: tracked chassis, armoured cab up front, twin rocket pods raised
    hailstorm(c) {
      tracks(c, -0.95, 0.16, 1.9, 0.34, 6);
      poly(c, [-0.95, 0.18, -0.92, -0.06, 0.92, -0.06, 0.98, 0.18]); c.fill();
      poly(c, [0.42, -0.06, 0.48, -0.42, 0.86, -0.42, 0.96, -0.06]); c.fill();
      c.save(); c.translate(-0.82, -0.04); c.rotate(-0.5);
      for (const y of [-0.5, -0.24]) { rr(c, 0, y, 1.0, 0.24, 0.03); c.fill(); }
      sh(c, () => { for (const y of [-0.5, -0.24]) { c.fillRect(0.04, y + 0.1, 0.92, 0.03); for (let i = 0; i < 3; i++) { circ(c, 0.94, y + 0.05 + i * 0.07, 0.025); c.fill(); } } });
      c.restore();
      sh(c, () => { rr(c, 0.52, -0.36, 0.3, 0.12, 0.02); c.fill(); rr(c, -0.88, 0.0, 1.76, 0.05, 0.02); c.fill(); });
    },
    // Ohio-class missile submarine: a long hull with the missile deck hump, one missile leaving its tube
    trident(c) {
      c.beginPath(); c.ellipse(0, 0.2, 1.0, 0.24, 0, 0, P * 2); c.fill();
      rr(c, -0.5, -0.08, 0.95, 0.16, 0.06); c.fill();
      poly(c, [0.4, 0.02, 0.48, -0.32, 0.72, -0.32, 0.78, 0.02]); c.fill(); rr(c, 0.4, -0.22, 0.46, 0.05, 0.02); c.fill();
      poly(c, [-0.94, 0.2, -1.12, -0.05, -1.04, 0.2, -1.12, 0.45]); c.fill();
      c.save(); c.translate(-0.15, -0.2); c.rotate(-0.12);
      rr(c, -0.06, -0.75, 0.12, 0.6, 0.05); c.fill(); poly(c, [-0.06, -0.75, 0, -0.92, 0.06, -0.75]); c.fill();
      poly(c, [-0.06, -0.22, -0.14, -0.12, -0.06, -0.15]); c.fill(); poly(c, [0.06, -0.22, 0.14, -0.12, 0.06, -0.15]); c.fill();
      c.save(); c.globalAlpha *= 0.5; c.beginPath(); c.ellipse(0, -0.06, 0.16, 0.08, 0, 0, P * 2); c.fill(); c.restore();
      c.restore();
      sh(c, () => { for (let i = 0; i < 6; i++) { rr(c, -0.45 + i * 0.14, -0.06, 0.08, 0.05, 0.02); c.fill(); } c.beginPath(); c.ellipse(0, 0.3, 0.92, 0.1, 0, 0, P); c.fill(); });
    },
    // E-2 Hawkeye from above: radar rotodome over the fuselage
    warden(c) {
      c.beginPath(); c.moveTo(0, -0.9); c.quadraticCurveTo(0.15, -0.85, 0.14, -0.55); c.lineTo(0.11, 0.7); c.lineTo(-0.11, 0.7); c.lineTo(-0.14, -0.55); c.quadraticCurveTo(-0.15, -0.85, 0, -0.9); c.fill();
      poly(c, [-0.95, -0.34, 0.95, -0.34, 0.9, -0.2, -0.9, -0.2]); c.fill();
      for (const x of [-0.4, 0.4]) { rr(c, x - 0.07, -0.52, 0.14, 0.34, 0.05); c.fill(); rr(c, x - 0.22, -0.54, 0.44, 0.04, 0.02); c.fill(); }
      poly(c, [-0.46, 0.58, 0.46, 0.58, 0.46, 0.68, -0.46, 0.68]); c.fill();
      for (const x of [-0.46, -0.16, 0.16, 0.46]) { rr(c, x - 0.03, 0.52, 0.06, 0.22, 0.02); c.fill(); }
      circ(c, 0, 0.1, 0.36); c.fill();
      shade(c, () => { c.ellipse(0, 0.1, 0.36, 0.09, 0, 0, P * 2); }, 'rgba(0,0,0,.35)');
      sh(c, () => { c.lineWidth = 0.05; circ(c, 0, 0.1, 0.36); c.stroke(); });
    },
  });
  const TACTIC = {
    cache(c) { rr(c, -0.75, -0.45, 1.5, 1.05, 0.08); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-0.75, -0.12, 1.5, 0.14); c.fillRect(-0.08, -0.45, 0.16, 1.05); c.restore(); poly(c, [-0.3, -0.45, 0, -0.85, 0.3, -0.45]); c.fill(); },
    smoke(c) { for (const [x, y, r] of [[-0.45, 0.2, 0.38], [0.1, -0.05, 0.5], [0.55, 0.25, 0.33], [-0.05, 0.4, 0.35], [-0.3, -0.35, 0.3]]) { circ(c, x, y, r); c.fill(); } },
    march(c) { for (let i = 0; i < 3; i++) { poly(c, [-0.9 + i * 0.55, -0.6, -0.55 + i * 0.55, -0.6, -0.15 + i * 0.55, 0, -0.55 + i * 0.55, 0.6, -0.9 + i * 0.55, 0.6, -0.5 + i * 0.55, 0]); c.fill(); } },
    conscript(c) { c.save(); c.translate(-0.15, 0.1); c.scale(0.8, 0.8); UNIT.grunt(c); c.restore(); rr(c, 0.45, -0.75, 0.16, 0.6, 0.04); c.fill(); rr(c, 0.23, -0.53, 0.6, 0.16, 0.04); c.fill(); },
    airstrike(c) { poly(c, [-0.9, -0.55, 0.6, -0.75, 0.95, -0.62, 0.6, -0.48, -0.9, -0.45]); c.fill(); poly(c, [-0.2, -0.6, 0.15, -0.95, 0.35, -0.95, 0.2, -0.6]); c.fill(); for (const [x, y] of [[-0.4, 0.05], [0.05, 0.3], [0.45, 0.6]]) { c.beginPath(); c.ellipse(x, y, 0.12, 0.22, -0.3, 0, P * 2); c.fill(); } },
    // loitering munition (Shahed / Switchblade style): a delta-wing drone diving onto its target
    kamikaze(c) {
      c.save(); c.translate(-0.1, -0.1); c.rotate(0.75);
      poly(c, [0, -0.9, 0.62, 0.45, 0.14, 0.32, 0, 0.5, -0.14, 0.32, -0.62, 0.45]); c.fill();
      for (const x of [-0.58, 0.58]) { rr(c, x - 0.04, 0.22, 0.08, 0.26, 0.02); c.fill(); }
      rr(c, -0.07, 0.42, 0.14, 0.16, 0.04); c.fill();
      shade(c, () => { c.moveTo(0, -0.9); c.lineTo(0.08, 0.3); c.lineTo(-0.08, 0.3); c.closePath(); }, 'rgba(0,0,0,.3)');
      c.restore();
      c.save(); c.globalAlpha *= 0.7; for (const [x, y, r] of [[0.62, 0.62, 0.12], [0.78, 0.5, 0.08], [0.5, 0.8, 0.09]]) { circ(c, x, y, r); c.fill(); } c.restore();
    },
    gunrun(c) { // A-10 style attack jet, top-down, with a strafing line
      poly(c, [0, -0.9, 0.12, -0.55, 0.12, -0.1, 0.95, 0.05, 0.95, 0.2, 0.12, 0.2, 0.1, 0.55, 0.42, 0.7, 0.42, 0.82, -0.42, 0.82, -0.42, 0.7, -0.1, 0.55, -0.12, 0.2, -0.95, 0.2, -0.95, 0.05, -0.12, -0.1, -0.12, -0.55]); c.fill();
      for (const x of [-0.28, 0.28]) { c.beginPath(); c.ellipse(x, 0.45, 0.12, 0.2, 0, 0, P * 2); c.fill(); }
      c.save(); c.globalAlpha *= 0.7; for (let i = 0; i < 4; i++) { rr(c, -0.03, -1.0 - i * 0.0, 0.06, 0.08, 0.02); } c.restore();
      c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, -0.55, 0.06, 0.13, 0, 0, P * 2); c.fill(); c.restore();
    },
    strategic(c) { // B-52 stream from above, bombs falling in a line
      c.save(); c.translate(0, -0.25); c.scale(0.8, 0.8);
      c.beginPath(); c.moveTo(0, -0.9); c.quadraticCurveTo(0.12, -0.85, 0.11, -0.6); c.lineTo(0.09, 0.6); c.lineTo(-0.09, 0.6); c.lineTo(-0.11, -0.6); c.quadraticCurveTo(-0.12, -0.85, 0, -0.9); c.fill();
      poly(c, [0, -0.35, 1.1, 0.2, 1.1, 0.3, 0, 0.0, -1.1, 0.3, -1.1, 0.2]); c.fill();
      for (const x of [-0.75, -0.45, 0.45, 0.75]) { rr(c, x - 0.05, -0.05 + Math.abs(x) * 0.42 - 0.2, 0.1, 0.28, 0.04); c.fill(); }
      poly(c, [-0.35, 0.55, 0.35, 0.55, 0.3, 0.66, -0.3, 0.66]); c.fill();
      c.restore();
      for (let i = 0; i < 5; i++) { c.save(); c.translate(-0.6 + i * 0.3, 0.55 + (i % 2) * 0.12); rr(c, -0.05, -0.1, 0.1, 0.22, 0.05); c.fill(); poly(c, [-0.08, -0.12, 0.08, -0.12, 0, -0.02]); c.fill(); c.restore(); }
    },
    precision(c) { // guided bomb on a crosshair
      c.lineWidth = 0.08; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(0, 0, 0.78, 0, P * 2); c.stroke();
      for (const [x, y, w, h] of [[-0.04, -1, 0.08, 0.35], [-0.04, 0.65, 0.08, 0.35], [-1, -0.04, 0.35, 0.08], [0.65, -0.04, 0.35, 0.08]]) { c.fillRect(x, y, w, h); }
      c.save(); c.rotate(0.7);
      rr(c, -0.14, -0.55, 0.28, 0.9, 0.14); c.fill(); poly(c, [-0.14, 0.25, -0.3, 0.5, 0.3, 0.5, 0.14, 0.25]); c.fill(); poly(c, [-0.14, -0.2, -0.28, -0.05, -0.14, -0.05]); c.fill(); poly(c, [0.14, -0.2, 0.28, -0.05, 0.14, -0.05]); c.fill();
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-0.14, -0.3, 0.28, 0.06); c.restore();
    },
    buster(c) { // massive penetrator bomb punching into a bunker
      c.beginPath(); c.arc(0, 0.85, 0.85, P, 0); c.closePath(); c.fill();
      c.save(); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-0.45, 0.42, 0.9, 0.1); c.restore();
      rr(c, -0.17, -0.95, 0.34, 1.15, 0.16); c.fill(); poly(c, [-0.17, -0.65, -0.36, -0.95, 0.36, -0.95, 0.17, -0.65]); c.fill();
      c.save(); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-0.17, -0.35, 0.34, 0.06); c.fillRect(-0.17, -0.1, 0.34, 0.06); c.restore();
      for (const [x, y] of [[-0.55, 0.05], [0.55, 0.05], [-0.38, -0.25], [0.4, -0.22]]) { c.save(); c.translate(x, y); c.rotate(x); rr(c, -0.04, -0.12, 0.08, 0.24, 0.03); c.fill(); c.restore(); }
    },
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
    embargo(c) {
      // a crate of gold locked shut with chains and a padlock
      rr(c, -0.78, -0.42, 1.56, 1.12, 0.08); c.fill();
      c.save(); c.fillStyle = 'rgba(0,0,0,.32)'; c.fillRect(-0.78, -0.1, 1.56, 0.07); c.fillRect(-0.78, 0.28, 1.56, 0.07); c.fillRect(-0.05, -0.42, 0.1, 1.12); c.restore();
      for (const [x, y] of [[-0.45, -0.62], [-0.1, -0.7], [0.28, -0.6]]) { c.beginPath(); c.ellipse(x, y, 0.2, 0.09, 0, 0, Math.PI * 2); c.fill(); }
      c.save(); c.lineWidth = 0.11; c.lineCap = 'round'; c.strokeStyle = 'rgba(0,0,0,.55)';
      // two chains crossing the crate in an X: links alternate flat and edge-on along each diagonal
      for (const [x0, y0, x1, y1] of [[-0.82, -0.36, 0.82, 0.64], [0.82, -0.36, -0.82, 0.64]]) {
        const ang = Math.atan2(y1 - y0, x1 - x0), n = 8;
        for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; c.beginPath(); if (i % 2) c.ellipse(x, y, 0.12, 0.035, ang, 0, Math.PI * 2); else c.ellipse(x, y, 0.12, 0.075, ang, 0, Math.PI * 2); c.stroke(); }
      }
      c.restore();
      c.save(); c.fillStyle = 'rgba(0,0,0,.55)'; rr(c, -0.22, 0.02, 0.44, 0.38, 0.06); c.fill(); c.lineWidth = 0.09; c.strokeStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.arc(0, 0.02, 0.14, Math.PI, 0); c.stroke(); c.restore();
      c.save(); c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, 0, 0.2, 0.05); c.fill(); c.restore();
    },
    bounty(c) { c.lineWidth = 0.1; circ(c, 0, 0, 0.7); c.stroke(); circ(c, 0, 0, 0.38); c.stroke(); for (const [x, y, w, h] of [[-0.05, -1, 0.1, 0.5], [-0.05, 0.5, 0.1, 0.5], [-1, -0.05, 0.5, 0.1], [0.5, -0.05, 0.5, 0.1]]) c.fillRect(x, y, w, h); circ(c, 0, 0, 0.12); c.fill(); },
    orbital(c) { rr(c, -0.25, -0.95, 0.5, 0.32, 0.05); c.fill(); rr(c, -0.8, -0.88, 0.45, 0.18, 0.03); c.fill(); rr(c, 0.35, -0.88, 0.45, 0.18, 0.03); c.fill(); poly(c, [-0.12, -0.6, 0.12, -0.6, 0.3, 0.55, -0.3, 0.55]); c.fill(); c.beginPath(); c.ellipse(0, 0.65, 0.7, 0.2, 0, 0, P * 2); c.fill(); },
    quarry(c) {
      // a mountain split by a blast: two broken peaks and flying rocks
      poly(c, [-1, 0.75, -0.55, -0.35, -0.3, 0.05, -0.12, -0.2, -0.05, 0.75]); c.fill();
      poly(c, [0.1, 0.75, 0.22, -0.1, 0.45, -0.55, 1, 0.75]); c.fill();
      c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; poly(c, [-0.55, -0.35, -0.42, 0.75, -0.05, 0.75, -0.3, 0.05]); c.fill(); poly(c, [0.45, -0.55, 0.5, 0.75, 1, 0.75]); c.fill(); c.restore();
      for (const [x, y, r] of [[0.02, -0.55, 0.11], [-0.25, -0.8, 0.08], [0.32, -0.88, 0.07], [0.05, -0.95, 0.05]]) { poly(c, [x - r, y, x, y - r, x + r, y + r * 0.3, x - r * 0.2, y + r]); c.fill(); }
      c.save(); c.lineWidth = 0.07; c.strokeStyle = c.fillStyle; c.lineCap = 'round'; for (const a of [-2.2, -1.6, -0.95]) { c.beginPath(); c.moveTo(0.02 + Math.cos(a) * 0.18, -0.3 + Math.sin(a) * 0.18); c.lineTo(0.02 + Math.cos(a) * 0.34, -0.3 + Math.sin(a) * 0.34); c.stroke(); } c.restore();
    },
    spy(c) {
      // a fedora and a card slipping out from under it
      c.save(); c.translate(0.32, 0.22); c.rotate(0.35); rr(c, -0.3, -0.42, 0.6, 0.84, 0.07); c.fill(); c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, -0.2, -0.3, 0.4, 0.6, 0.05); c.fill(); c.restore();
      c.beginPath(); c.ellipse(-0.18, -0.08, 0.82, 0.2, -0.08, 0, P * 2); c.fill();
      poly(c, [-0.62, -0.1, -0.5, -0.62, -0.18, -0.52, 0.12, -0.66, 0.26, -0.12]); c.fill();
      c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; poly(c, [-0.6, -0.2, 0.24, -0.24, 0.25, -0.12, -0.61, -0.1]); c.fill(); c.restore();
      c.save(); c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.ellipse(-0.36, 0.28, 0.16, 0.07, 0, 0, P * 2); c.fill(); c.beginPath(); c.ellipse(0.0, 0.28, 0.16, 0.07, 0, 0, P * 2); c.fill(); c.restore();
    },
    tsar(c) {
      // a towering mushroom cloud with a ring of shock
      c.beginPath(); c.ellipse(0, -0.48, 0.7, 0.36, 0, 0, P * 2); c.fill();
      for (const [x, y, r] of [[-0.45, -0.6, 0.3], [0.42, -0.62, 0.32], [0, -0.78, 0.34], [-0.2, -0.38, 0.26], [0.22, -0.36, 0.26]]) { circ(c, x, y, r); c.fill(); }
      poly(c, [-0.16, -0.2, 0.16, -0.2, 0.24, 0.58, -0.24, 0.58]); c.fill();
      c.beginPath(); c.ellipse(0, 0.66, 0.92, 0.2, 0, 0, P * 2); c.fill();
      c.save(); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, -0.42, 0.58, 0.16, 0, 0, P); c.fill(); c.fillRect(-0.06, -0.15, 0.12, 0.7); c.restore();
      c.save(); c.lineWidth = 0.06; c.strokeStyle = c.fillStyle; c.beginPath(); c.ellipse(0, 0.66, 1.0, 0.28, 0, P * 1.05, P * 1.95); c.stroke(); c.restore();
    },
    regime(c) {
      // a capitol dome with a new flag planted on top
      rr(c, -0.85, 0.55, 1.7, 0.22, 0.03); c.fill(); rr(c, -0.72, 0.4, 1.44, 0.17, 0.03); c.fill();
      for (let i = 0; i < 5; i++) { rr(c, -0.6 + i * 0.29, -0.05, 0.12, 0.47, 0.02); c.fill(); }
      poly(c, [-0.75, -0.05, 0, -0.32, 0.75, -0.05]); c.fill();
      c.beginPath(); c.arc(0, -0.34, 0.3, P, 0); c.closePath(); c.fill();
      rr(c, -0.03, -0.95, 0.06, 0.62, 0.02); c.fill(); poly(c, [0.03, -0.95, 0.55, -0.82, 0.03, -0.66]); c.fill();
    },
    aegis(c) {
      // a big shield under a ring of hexagonal force-field cells, all inside the icon box
      c.save(); c.lineWidth = 0.07; c.strokeStyle = c.fillStyle;
      const cells = [[-0.62, -0.28], [-0.36, -0.62], [0, -0.76], [0.36, -0.62], [0.62, -0.28]];
      for (const [x, y] of cells) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.lineTo(x + Math.cos(a) * 0.15, y + Math.sin(a) * 0.15); } c.closePath(); c.stroke(); }
      c.restore();
      c.beginPath(); c.moveTo(0, -0.42); c.lineTo(0.52, -0.24); c.lineTo(0.48, 0.24); c.quadraticCurveTo(0.34, 0.68, 0, 0.88); c.quadraticCurveTo(-0.34, 0.68, -0.48, 0.24); c.lineTo(-0.52, -0.24); c.closePath(); c.fill();
      c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(0, -0.42); c.lineTo(0, 0.88); c.quadraticCurveTo(0.34, 0.68, 0.48, 0.24); c.lineTo(0.52, -0.24); c.closePath(); c.fill(); c.restore();
      c.save(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(-0.08, -0.12); c.lineTo(0.08, -0.12); c.lineTo(0.06, 0.42); c.lineTo(-0.06, 0.42); c.closePath(); c.fill(); c.fillRect(-0.24, 0.04, 0.48, 0.12); c.restore();
    },
  });
  // ── helicopters, side-on, nose to the right ──
  const blur = (c, f) => { c.save(); c.globalAlpha *= 0.5; f(); c.restore(); };
  const tailRotor = (c, x, y, r) => { blur(c, () => { circ(c, x, y, r); c.fill(); }); rr(c, x - 0.02, y - r, 0.04, r * 2, 0.01); c.fill(); };
  Object.assign(UNIT, {
    // UH-60 Black Hawk: long cabin with a sliding door, sloped nose, engine hump, tail boom up to a canted fin, fixed wheels
    stormcrow(c) {
      blur(c, () => { rr(c, -1.02, -0.74, 1.86, 0.06, 0.03); c.fill(); });
      rr(c, -0.2, -0.72, 0.08, 0.24, 0.02); c.fill();
      rr(c, -0.5, -0.54, 0.66, 0.16, 0.07); c.fill();
      c.beginPath(); c.moveTo(-0.58, -0.4); c.lineTo(0.42, -0.4); c.quadraticCurveTo(0.78, -0.36, 0.94, -0.08); c.lineTo(0.96, 0.1); c.quadraticCurveTo(0.9, 0.2, 0.72, 0.2); c.lineTo(-0.5, 0.2); c.lineTo(-0.64, -0.02); c.closePath(); c.fill();
      poly(c, [-0.62, -0.34, -1.02, -0.26, -1.02, -0.18, -0.6, 0.0]); c.fill();
      poly(c, [-0.98, -0.22, -1.1, -0.66, -0.96, -0.66, -0.86, -0.24]); c.fill();
      rr(c, -1.12, -0.12, 0.3, 0.05, 0.02); c.fill();
      tailRotor(c, -1.05, -0.52, 0.16);
      c.lineWidth = 0.06; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(0.58, 0.18); c.lineTo(0.62, 0.34); c.moveTo(-0.24, 0.18); c.lineTo(-0.26, 0.34); c.stroke();
      hub(c, 0.62, 0.38, 0.1); hub(c, -0.26, 0.38, 0.1);
      rr(c, 0.02, 0.0, 0.08, 0.2, 0.02); c.fill(); rr(c, 0.06, 0.04, 0.34, 0.05, 0.02); c.fill();   // door gun
      sh(c, () => {
        poly(c, [0.46, -0.34, 0.76, -0.3, 0.86, -0.08, 0.5, -0.08]); c.fill();            // cockpit glass
        rr(c, -0.3, -0.3, 0.36, 0.26, 0.03); c.fill();                                  // open cabin door
        rr(c, -0.5, -0.04, 1.4, 0.05, 0.02); c.fill(); circ(c, -0.12, -0.46, 0.05); c.fill();
      }, SH2);
    },
    // MH-6 Little Bird: egg-shaped bubble cabin, thin boom, T-tail, skids, troop benches
    wren(c) {
      blur(c, () => { rr(c, -0.86, -0.64, 1.58, 0.06, 0.03); c.fill(); });
      rr(c, -0.02, -0.62, 0.08, 0.2, 0.02); c.fill();
      c.beginPath(); c.ellipse(0.16, -0.14, 0.52, 0.36, 0, 0, P * 2); c.fill();
      poly(c, [-0.3, -0.22, -1.0, -0.15, -1.0, -0.08, -0.3, 0.06]); c.fill();
      poly(c, [-0.98, -0.12, -1.06, -0.46, -0.92, -0.46, -0.86, -0.12]); c.fill(); rr(c, -1.12, -0.5, 0.3, 0.05, 0.02); c.fill();
      tailRotor(c, -1.0, -0.26, 0.12);
      rr(c, -0.42, 0.44, 1.14, 0.06, 0.03); c.fill(); rr(c, 0.66, 0.38, 0.1, 0.08, 0.03); c.fill();
      c.lineWidth = 0.06; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(-0.18, 0.18); c.lineTo(-0.22, 0.44); c.moveTo(0.42, 0.18); c.lineTo(0.48, 0.44); c.stroke();
      rr(c, -0.24, 0.16, 0.86, 0.08, 0.03); c.fill();                                   // outboard bench
      for (const x of [-0.1, 0.2]) { circ(c, x, 0.02, 0.09); c.fill(); }                  // troopers riding on it
      sh(c, () => { c.beginPath(); c.ellipse(0.36, -0.2, 0.3, 0.22, 0, 0, P * 2); c.fill(); }, SH2);
    },
    // AH-64 Apache: slim body, stepped tandem cockpit, stub wings with Hellfire racks, chin gun, tailwheel
    banshee(c) {
      blur(c, () => { rr(c, -1.0, -0.78, 1.82, 0.06, 0.03); c.fill(); });
      rr(c, -0.14, -0.76, 0.08, 0.22, 0.02); c.fill(); circ(c, -0.1, -0.78, 0.07); c.fill();   // mast-top radar dome
      rr(c, -0.5, -0.56, 0.62, 0.18, 0.08); c.fill();
      c.beginPath(); c.moveTo(-0.62, -0.32); c.lineTo(0.06, -0.38); c.lineTo(0.12, -0.56); c.lineTo(0.36, -0.56); c.lineTo(0.44, -0.42); c.lineTo(0.62, -0.42); c.lineTo(0.9, -0.16); c.lineTo(0.92, 0.0); c.lineTo(0.56, 0.08); c.lineTo(-0.5, 0.08); c.closePath(); c.fill();
      poly(c, [-0.62, -0.3, -1.02, -0.22, -1.02, -0.14, -0.56, 0.04]); c.fill();
      poly(c, [-0.98, -0.18, -1.1, -0.66, -0.96, -0.66, -0.86, -0.2]); c.fill(); rr(c, -1.1, -0.16, 0.28, 0.05, 0.02); c.fill();
      tailRotor(c, -1.04, -0.5, 0.15);
      rr(c, -0.3, 0.02, 0.68, 0.08, 0.03); c.fill();                                    // stub wing
      for (const x of [-0.26, 0.1]) { rr(c, x, 0.1, 0.26, 0.14, 0.03); c.fill(); }       // missile racks
      rr(c, 0.56, 0.06, 0.08, 0.12, 0.02); c.fill(); rr(c, 0.58, 0.14, 0.32, 0.05, 0.02); c.fill();   // chin gun
      c.lineWidth = 0.06; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(0.42, 0.06); c.lineTo(0.48, 0.32); c.moveTo(-0.9, -0.14); c.lineTo(-0.9, 0.0); c.stroke();
      hub(c, 0.48, 0.36, 0.1); hub(c, -0.9, 0.04, 0.06);
      sh(c, () => {
        poly(c, [0.46, -0.38, 0.6, -0.38, 0.82, -0.18, 0.48, -0.18]); c.fill();          // gunner's glass
        poly(c, [0.14, -0.52, 0.34, -0.52, 0.4, -0.4, 0.12, -0.38]); c.fill();           // pilot's glass, higher
        for (const x of [-0.22, 0.14]) c.fillRect(x, 0.16, 0.22, 0.03);
        circ(c, -0.16, -0.46, 0.06); c.fill();                                            // engine intake
      }, SH2);
    },
    // Mi-28: heavier, drooping armoured nose with a sensor ball, big chin cannon, rocket pods under the wings
    ravager(c) {
      blur(c, () => { rr(c, -1.0, -0.76, 1.8, 0.06, 0.03); c.fill(); });
      rr(c, -0.16, -0.74, 0.08, 0.22, 0.02); c.fill();
      rr(c, -0.52, -0.56, 0.7, 0.2, 0.08); c.fill(); rr(c, -0.6, -0.5, 0.12, 0.1, 0.03); c.fill();   // exhausts turned down
      c.beginPath(); c.moveTo(-0.62, -0.32); c.lineTo(0.04, -0.38); c.lineTo(0.12, -0.6); c.lineTo(0.42, -0.6); c.lineTo(0.5, -0.44); c.lineTo(0.66, -0.42); c.quadraticCurveTo(0.92, -0.3, 0.9, 0.0); c.quadraticCurveTo(0.86, 0.14, 0.66, 0.12); c.lineTo(-0.5, 0.1); c.closePath(); c.fill();
      circ(c, 0.86, 0.1, 0.1); c.fill();                                                  // nose sensor ball
      poly(c, [-0.62, -0.3, -1.02, -0.22, -1.02, -0.14, -0.56, 0.04]); c.fill();
      poly(c, [-0.98, -0.18, -1.08, -0.64, -0.94, -0.64, -0.86, -0.2]); c.fill(); rr(c, -1.08, -0.16, 0.26, 0.05, 0.02); c.fill();
      tailRotor(c, -1.02, -0.48, 0.15);
      rr(c, -0.32, 0.02, 0.66, 0.08, 0.03); c.fill();
      for (const x of [-0.18, 0.18]) { c.beginPath(); c.ellipse(x, 0.18, 0.15, 0.08, 0, 0, P * 2); c.fill(); }   // rocket pods
      rr(c, 0.6, 0.1, 0.12, 0.14, 0.03); c.fill(); rr(c, 0.62, 0.2, 0.36, 0.07, 0.02); c.fill();               // 30mm cannon
      c.lineWidth = 0.06; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(0.36, 0.1); c.lineTo(0.42, 0.34); c.moveTo(-0.9, -0.14); c.lineTo(-0.9, 0.0); c.stroke();
      hub(c, 0.42, 0.38, 0.1); hub(c, -0.9, 0.04, 0.06);
      sh(c, () => {
        poly(c, [0.5, -0.4, 0.64, -0.4, 0.76, -0.22, 0.52, -0.22]); c.fill();
        poly(c, [0.14, -0.56, 0.38, -0.56, 0.44, -0.44, 0.12, -0.4]); c.fill();
        for (const x of [-0.18, 0.18]) { circ(c, x + 0.12, 0.18, 0.04); c.fill(); }
      }, SH2);
    },
  });
  Object.assign(UNIT, {
    // E-3 Sentry from above: a swept-wing four-engine airliner with the striped rotodome over the rear fuselage
    warden(c) {
      c.beginPath(); c.moveTo(0, -0.98); c.quadraticCurveTo(0.12, -0.92, 0.12, -0.7); c.lineTo(0.11, 0.7); c.lineTo(0.04, 0.95); c.lineTo(-0.04, 0.95); c.lineTo(-0.11, 0.7); c.lineTo(-0.12, -0.7); c.quadraticCurveTo(-0.12, -0.92, 0, -0.98); c.fill();
      for (const s of [1, -1]) {
        poly(c, [s * 0.1, -0.32, s * 0.98, 0.18, s * 0.98, 0.28, s * 0.1, 0.04]); c.fill();
        poly(c, [s * 0.08, 0.62, s * 0.42, 0.84, s * 0.42, 0.92, s * 0.06, 0.8]); c.fill();
        for (const x of [0.4, 0.7]) { const y = -0.32 + (x - 0.1) * 0.57; rr(c, s * x - 0.05, y - 0.1, 0.1, 0.24, 0.04); c.fill(); }
      }
      circ(c, 0, 0.36, 0.34); c.fill();
      sh(c, () => { rr(c, -0.34, 0.31, 0.68, 0.1, 0.02); c.fill(); }, SH2);
      sh(c, () => { c.beginPath(); c.ellipse(0, -0.82, 0.07, 0.1, 0, 0, P * 2); c.fill(); });
    },
    // V-22 Osprey, side-on: nacelles tilted up with the proprotors turning above, high wing, rear ramp, H-tail
    valkyrie(c) {
      c.beginPath(); c.moveTo(-0.86, -0.24); c.lineTo(0.5, -0.26); c.quadraticCurveTo(0.9, -0.22, 0.96, 0.0); c.quadraticCurveTo(0.92, 0.18, 0.7, 0.2); c.lineTo(-0.55, 0.2); c.lineTo(-0.96, -0.06); c.closePath(); c.fill();
      poly(c, [-0.94, -0.12, -1.06, -0.6, -0.9, -0.6, -0.78, -0.22]); c.fill(); rr(c, -1.08, -0.64, 0.32, 0.06, 0.02); c.fill();
      rr(c, -0.32, -0.36, 0.7, 0.11, 0.04); c.fill();
      rr(c, 0.62, -0.32, 0.4, 0.04, 0.02); c.fill();                                       // refuelling probe
      rr(c, -0.02, -0.74, 0.18, 0.5, 0.07); c.fill();                                     // nacelle, tilted up
      blur(c, () => { c.beginPath(); c.ellipse(0.07, -0.78, 0.8, 0.09, 0, 0, P * 2); c.fill(); });
      for (const a2 of [-0.3, 0.5]) { c.save(); c.translate(0.07, -0.78); c.scale(1, 0.12); c.rotate(a2); rr(c, -0.8, -0.05, 1.6, 0.1, 0.05); c.fill(); c.restore(); }
      rr(c, -0.16, 0.1, 0.56, 0.14, 0.05); c.fill();                                      // sponson
      hub(c, -0.04, 0.32, 0.09); hub(c, 0.26, 0.32, 0.09); hub(c, 0.74, 0.3, 0.07);
      sh(c, () => {
        poly(c, [0.56, -0.2, 0.8, -0.18, 0.88, -0.02, 0.58, -0.02]); c.fill();          // cockpit glass
        for (const x of [-0.5, -0.32, 0.38]) { rr(c, x, -0.14, 0.1, 0.08, 0.02); c.fill(); }
        c.beginPath(); c.moveTo(-0.55, 0.2); c.lineTo(-0.9, -0.02); c.lineTo(-0.86, -0.06); c.lineTo(-0.52, 0.14); c.closePath(); c.fill();   // ramp
      }, SH2);
    },
  });
  // ── v4: every helicopter, the gunship and the armour get a silhouette you can tell apart at token size ──
  Object.assign(UNIT, {
    // AH-64 Apache, head-on: the Longbow radar dome over the rotor, narrow tandem cockpit, engine pods, stub wings hung with Hellfires
    banshee(c) {
      blur(c, () => { c.beginPath(); c.ellipse(0, -0.6, 1.08, 0.07, 0, 0, P * 2); c.fill(); });
      rr(c, -0.05, -0.68, 0.1, 0.24, 0.02); c.fill();
      c.beginPath(); c.ellipse(0, -0.8, 0.2, 0.12, 0, 0, P * 2); c.fill();               // Longbow radar
      c.beginPath(); c.moveTo(-0.13, -0.46); c.lineTo(0.13, -0.46); c.lineTo(0.2, -0.1); c.lineTo(0.16, 0.22); c.lineTo(0.08, 0.36); c.lineTo(-0.08, 0.36); c.lineTo(-0.16, 0.22); c.lineTo(-0.2, -0.1); c.closePath(); c.fill();
      for (const sx of [-1, 1]) {
        c.beginPath(); c.ellipse(sx * 0.34, -0.3, 0.14, 0.17, 0, 0, P * 2); c.fill();      // engine nacelle
        poly(c, [sx * 0.16, -0.06, sx * 0.92, 0.0, sx * 0.92, 0.08, sx * 0.16, 0.06]); c.fill();   // stub wing
        for (const wx of [0.5, 0.78]) { rr(c, sx * wx - 0.09, 0.08, 0.18, 0.2, 0.03); c.fill(); }  // Hellfire launchers
        c.lineWidth = 0.05; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(sx * 0.18, 0.18); c.lineTo(sx * 0.34, 0.52); c.stroke();
        rr(c, sx * 0.34 - 0.07, 0.46, 0.14, 0.18, 0.05); c.fill();                          // main wheels
      }
      circ(c, 0, 0.4, 0.09); c.fill();                                                       // chin gun turret
      shade(c, () => {
        c.moveTo(-0.1, -0.4); c.lineTo(0.1, -0.4); c.lineTo(0.13, -0.2); c.lineTo(-0.13, -0.2); c.closePath();   // pilot's glass
        c.moveTo(-0.13, -0.12); c.lineTo(0.13, -0.12); c.lineTo(0.15, 0.08); c.lineTo(-0.15, 0.08); c.closePath(); // gunner's glass
        for (const sx of [-1, 1]) { c.moveTo(sx * 0.34 + 0.08, -0.3); c.arc(sx * 0.34, -0.3, 0.08, 0, P * 2); }
        for (const sx of [-1, 1]) for (const wx of [0.5, 0.78]) for (const [dx, dy] of [[-0.04, 0.13], [0.04, 0.13], [-0.04, 0.22], [0.04, 0.22]]) { c.moveTo(sx * wx + dx + 0.03, dy); c.arc(sx * wx + dx, dy, 0.03, 0, P * 2); }
        c.moveTo(0.04, 0.48); c.arc(0, 0.48, 0.04, 0, P * 2);
        c.moveTo(-0.2, -0.84); c.lineTo(0.2, -0.84); c.lineTo(0.2, -0.8); c.lineTo(-0.2, -0.8); c.closePath();
      }, SH2);
    },
    // Mi-28 Havoc, side-on: a slim armoured body with stepped flat-paned cockpits (gunner low in front, pilot raised behind),
    // a nose that drops to a big chin cannon, an engine hump under the rotor, stub wings with a rocket pod and missile tubes,
    // a long thin tail boom with a tall fin, and a tail wheel
    ravager(c) {
      blur(c, () => { rr(c, -1.02, -0.78, 1.9, 0.07, 0.03); c.fill(); });
      rr(c, -0.14, -0.76, 0.1, 0.2, 0.02); c.fill();                                            // rotor mast
      rr(c, -0.46, -0.58, 0.6, 0.18, 0.07); c.fill();                                           // engine hump
      poly(c, [-0.46, -0.52, -0.6, -0.48, -0.6, -0.4, -0.44, -0.42]); c.fill();                 // exhaust
      c.beginPath(); c.moveTo(-0.52, -0.4); c.lineTo(0.06, -0.42); c.lineTo(0.12, -0.6); c.lineTo(0.36, -0.6); c.lineTo(0.42, -0.4);
      c.lineTo(0.5, -0.4); c.lineTo(0.56, -0.48); c.lineTo(0.72, -0.48); c.lineTo(0.84, -0.24); c.lineTo(0.96, -0.04);
      c.quadraticCurveTo(0.98, 0.1, 0.84, 0.12); c.lineTo(0.0, 0.14); c.lineTo(-0.52, 0.02); c.closePath(); c.fill();
      poly(c, [-0.5, -0.38, -1.02, -0.3, -1.02, -0.22, -0.5, -0.02]); c.fill();                // thin tail boom
      poly(c, [-0.9, -0.28, -1.02, -0.74, -0.92, -0.74, -0.82, -0.28]); c.fill();              // fin
      rr(c, -0.86, -0.32, 0.26, 0.05, 0.02); c.fill();                                          // stabiliser
      tailRotor(c, -1.0, -0.56, 0.15);
      c.lineWidth = 0.05; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(-0.9, -0.24); c.lineTo(-0.92, -0.08); c.stroke(); hub(c, -0.92, -0.04, 0.06);
      poly(c, [-0.24, 0.0, 0.3, 0.0, 0.26, 0.07, -0.26, 0.07]); c.fill();                       // stub wing
      rr(c, -0.14, 0.06, 0.38, 0.17, 0.08); c.fill();                                           // B-8 rocket pod
      rr(c, -0.3, 0.03, 0.12, 0.13, 0.03); c.fill();                                            // Ataka tubes
      circ(c, 0.74, 0.2, 0.09); c.fill(); poly(c, [0.76, 0.18, 1.12, 0.24, 1.12, 0.29, 0.74, 0.26]); c.fill();   // 30mm chin cannon
      c.lineWidth = 0.07; c.beginPath(); c.moveTo(0.42, 0.12); c.lineTo(0.48, 0.44); c.stroke(); hub(c, 0.48, 0.48, 0.11);   // main gear
      shade(c, () => {
        c.moveTo(0.14, -0.57); c.lineTo(0.34, -0.57); c.lineTo(0.39, -0.43); c.lineTo(0.12, -0.43); c.closePath();   // pilot's panes
        c.moveTo(0.58, -0.45); c.lineTo(0.7, -0.45); c.lineTo(0.8, -0.26); c.lineTo(0.56, -0.26); c.closePath();     // gunner's panes
        for (const [x, y] of [[0.18, 0.11], [0.18, 0.18], [0.11, 0.145]]) { c.moveTo(x + 0.025, y); c.arc(x, y, 0.025, 0, P * 2); }   // rocket tubes
        rrp(c, -0.46, -0.12, 1.2, 0.04, 0.02);
      }, SH2);
    },
    // UH-60 Black Hawk: a long, tall utility cabin, the big door slid open with troops inside, a door gun, fixed wheels, no weapon wings
    stormcrow(c) {
      blur(c, () => { rr(c, -1.06, -0.78, 1.96, 0.07, 0.03); c.fill(); });
      rr(c, -0.12, -0.76, 0.08, 0.22, 0.02); c.fill();
      rr(c, -0.5, -0.6, 0.72, 0.2, 0.08); c.fill(); rr(c, -0.42, -0.66, 0.2, 0.08, 0.03); c.fill(); rr(c, -0.02, -0.66, 0.2, 0.08, 0.03); c.fill();
      c.beginPath(); c.moveTo(-0.62, -0.46); c.lineTo(0.5, -0.46); c.quadraticCurveTo(0.86, -0.42, 1.0, -0.1); c.lineTo(1.0, 0.12); c.quadraticCurveTo(0.96, 0.26, 0.76, 0.26); c.lineTo(-0.52, 0.26); c.lineTo(-0.66, 0.04); c.closePath(); c.fill();
      poly(c, [-0.64, -0.4, -1.04, -0.3, -1.04, -0.2, -0.62, 0.04]); c.fill();
      poly(c, [-1.0, -0.26, -1.12, -0.74, -0.98, -0.74, -0.88, -0.28]); c.fill();
      rr(c, -1.2, -0.18, 0.36, 0.06, 0.02); c.fill();                                          // stabilator
      tailRotor(c, -1.06, -0.56, 0.17);
      c.lineWidth = 0.06; c.strokeStyle = c.fillStyle; c.beginPath(); c.moveTo(0.64, 0.24); c.lineTo(0.68, 0.42); c.moveTo(-0.34, 0.24); c.lineTo(-0.38, 0.42); c.stroke();
      hub(c, 0.68, 0.46, 0.1); hub(c, -0.38, 0.46, 0.1);
      rr(c, 0.36, -0.02, 0.08, 0.2, 0.02); c.fill(); rr(c, 0.38, 0.02, 0.4, 0.05, 0.02); c.fill();   // M240 door gun
      shade(c, () => {
        c.moveTo(0.56, -0.4); c.lineTo(0.8, -0.36); c.lineTo(0.92, -0.08); c.lineTo(0.58, -0.08); c.closePath();   // cockpit glass
        rrp(c, -0.36, -0.36, 0.72, 0.5, 0.04);                                                    // the open door
        rrp(c, -0.56, -0.02, 0.16, 0.12, 0.03);
      }, SH2);
      for (const x of [-0.24, 0.0, 0.22]) { circ(c, x, -0.18, 0.08); c.fill(); rr(c, x - 0.08, -0.1, 0.16, 0.2, 0.04); c.fill(); }   // troops aboard
    },
    // AC-130 Spectre, side-on: the Hercules' fat tube of a body, blunt radome nose with the flight deck on top, a high wing
    // with turboprops hung in front of it, landing-gear blisters on the belly, an upswept tail under a tall rounded fin,
    // and the side-firing guns poking out of the port side
    seraph(c) {
      c.beginPath(); c.moveTo(-0.5, -0.28); c.lineTo(0.7, -0.28); c.quadraticCurveTo(0.82, -0.28, 0.9, -0.18);
      c.lineTo(0.96, -0.08); c.quadraticCurveTo(1.08, 0.0, 1.04, 0.1); c.quadraticCurveTo(0.98, 0.18, 0.84, 0.18);
      c.lineTo(-0.32, 0.18); c.lineTo(-0.9, -0.1); c.lineTo(-1.0, -0.16); c.lineTo(-0.98, -0.24); c.closePath(); c.fill();   // fuselage
      c.beginPath(); c.moveTo(-0.56, -0.26); c.lineTo(-0.8, -0.8); c.quadraticCurveTo(-0.86, -0.9, -0.96, -0.86); c.lineTo(-1.0, -0.24); c.closePath(); c.fill();   // tall fin
      rr(c, -1.12, -0.26, 0.42, 0.06, 0.03); c.fill();                                          // tailplane
      rr(c, -0.26, -0.36, 0.62, 0.09, 0.04); c.fill();                                          // high wing
      for (const [x, y] of [[0.36, -0.3], [0.16, -0.33]]) {                                     // turboprops slung in front of the wing
        rr(c, x - 0.3, y - 0.06, 0.34, 0.12, 0.06); c.fill();
        blur(c, () => { c.beginPath(); c.ellipse(x + 0.07, y, 0.035, 0.24, 0, 0, P * 2); c.fill(); });
      }
      rr(c, -0.26, 0.08, 0.56, 0.16, 0.07); c.fill();                                           // gear blister
      hub(c, -0.12, 0.27, 0.07); hub(c, 0.14, 0.27, 0.07); hub(c, 0.86, 0.25, 0.06);
      c.lineWidth = 0.07; c.strokeStyle = c.fillStyle; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-0.5, 0.02); c.lineTo(-0.6, 0.26); c.moveTo(0.44, 0.08); c.lineTo(0.38, 0.28); c.stroke();   // 105mm howitzer and 40mm
      shade(c, () => {
        c.moveTo(0.72, -0.24); c.lineTo(0.86, -0.2); c.lineTo(0.92, -0.1); c.lineTo(0.72, -0.1); c.closePath();   // flight deck glass
        rrp(c, -0.84, -0.06, 1.68, 0.035, 0.015);                                                   // fuselage stripe
        for (const x of [0.5, 0.2, -0.1, -0.4]) { c.moveTo(x + 0.035, -0.16); c.arc(x, -0.16, 0.035, 0, P * 2); }   // portholes
      }, SH2);
    },
    // M1 Abrams: long low hull with side skirts, an angular slab-sided turret with a bustle rack, a long 120mm gun, an M2 on the cupola
    mauler(c) {
      tracks(c, -0.98, 0.22, 1.96, 0.38, 7);
      poly(c, [-1.0, 0.3, -1.0, 0.04, -0.86, -0.06, 0.78, -0.06, 1.02, 0.12, 0.96, 0.3]); c.fill();   // hull with skirts down over the tracks
      poly(c, [-0.66, -0.06, -0.6, -0.36, 0.14, -0.4, 0.5, -0.24, 0.52, -0.06]); c.fill();            // wedge turret
      rr(c, -0.86, -0.3, 0.24, 0.22, 0.03); c.fill();                                                  // bustle rack
      rr(c, 0.44, -0.27, 0.68, 0.1, 0.03); c.fill(); rr(c, 0.62, -0.29, 0.14, 0.14, 0.03); c.fill();  // gun and its sleeve band
      rr(c, -0.3, -0.52, 0.22, 0.14, 0.03); c.fill(); rr(c, -0.12, -0.5, 0.3, 0.04, 0.01); c.fill();  // cupola and the M2
      rr(c, 0.04, -0.5, 0.12, 0.12, 0.02); c.fill();                                                   // gunner's sight
      shade(c, () => {
        rrp(c, -0.96, 0.08, 1.9, 0.05, 0.02);
        for (const x of [-0.8, -0.52, -0.24, 0.04, 0.32, 0.6]) rrp(c, x, 0.13, 0.18, 0.06, 0.02);       // skirt panels
        c.moveTo(0.14, -0.38); c.lineTo(0.48, -0.24); c.lineTo(0.48, -0.2); c.lineTo(0.14, -0.33); c.closePath();
        for (const y of [-0.26, -0.18]) rrp(c, -0.84, y, 0.2, 0.025, 0.01);
      }, SH2);
    },
    // M18 Hellcat: a fast, light tank destroyer. Sharply sloped hull, open-topped turret, long 76mm gun with a muzzle brake
    hellcat(c) {
      c.strokeStyle = c.fillStyle; c.save(); c.globalAlpha *= 0.6; for (const [y, l] of [[-0.32, 0.5], [-0.06, 0.8], [0.22, 0.45]]) line(c, 0.07, [-1.1, y, -1.1 + l * 0.5, y]); c.restore();
      tracks(c, -0.78, 0.22, 1.66, 0.42, 5);
      poly(c, [-0.8, 0.26, -0.66, -0.06, 0.42, -0.08, 0.92, 0.16, 0.88, 0.28]); c.fill();
      poly(c, [-0.42, -0.06, -0.3, -0.42, 0.28, -0.42, 0.42, -0.08]); c.fill();
      rr(c, 0.3, -0.34, 0.8, 0.08, 0.03); c.fill(); rr(c, 1.04, -0.38, 0.1, 0.16, 0.03); c.fill(); rr(c, 0.96, -0.37, 0.05, 0.14, 0.02); c.fill();   // gun + muzzle brake
      shade(c, () => {
        c.moveTo(-0.26, -0.42); c.lineTo(0.24, -0.42); c.lineTo(0.2, -0.36); c.lineTo(-0.22, -0.36); c.closePath();   // open top
        c.moveTo(-0.6, 0.06); c.lineTo(0.4, 0.02); c.lineTo(0.72, 0.16); c.lineTo(-0.62, 0.18); c.closePath();
      }, SH2);
    },
    // Maus: the super-heavy. A towering slab hull, skirts almost to the ground, a huge rounded turret with a 128mm gun and a 75mm beside it
    leviathan(c) {
      tracks(c, -1.02, 0.42, 2.04, 0.32, 8);
      poly(c, [-1.04, 0.5, -1.04, -0.12, -0.9, -0.22, 0.86, -0.22, 1.04, 0.0, 1.04, 0.5]); c.fill();
      c.beginPath(); c.moveTo(-0.62, -0.22); c.lineTo(-0.56, -0.6); c.lineTo(0.18, -0.62); c.quadraticCurveTo(0.5, -0.6, 0.52, -0.38); c.lineTo(0.52, -0.22); c.closePath(); c.fill();
      rr(c, 0.48, -0.5, 0.66, 0.13, 0.04); c.fill(); rr(c, 0.48, -0.32, 0.36, 0.06, 0.02); c.fill();   // 128mm and the coaxial 75mm
      rr(c, -0.3, -0.72, 0.2, 0.12, 0.03); c.fill();
      shade(c, () => {
        rrp(c, -1.0, 0.1, 2.0, 0.06, 0.02); rrp(c, -1.0, 0.36, 2.0, 0.04, 0.02);
        for (const x of [-0.8, -0.4, 0.0, 0.4, 0.8]) { c.moveTo(x + 0.04, 0.24); c.arc(x, 0.24, 0.04, 0, P * 2); }   // skirt bolts
        c.moveTo(0.18, -0.6); c.quadraticCurveTo(0.48, -0.58, 0.5, -0.38); c.lineTo(0.42, -0.38); c.quadraticCurveTo(0.4, -0.52, 0.16, -0.54); c.closePath();
      }, SH2);
    },
    // Landkreuzer P.1000 Ratte: a land battleship. Three track units, a twin 280mm naval turret, a bridge mast and a rear flak turret
    titan(c) {
      tracks(c, -1.08, 0.3, 0.7, 0.36, 3); tracks(c, -0.35, 0.3, 0.7, 0.36, 3); tracks(c, 0.38, 0.3, 0.7, 0.36, 3);
      poly(c, [-1.1, 0.34, -1.06, -0.14, 0.92, -0.14, 1.1, 0.1, 1.08, 0.34]); c.fill();
      poly(c, [-0.24, -0.14, -0.16, -0.5, 0.42, -0.5, 0.54, -0.14]); c.fill();                // the naval turret
      rr(c, 0.4, -0.44, 0.74, 0.1, 0.03); c.fill(); rr(c, 0.4, -0.3, 0.74, 0.1, 0.03); c.fill();
      rr(c, -0.5, -0.46, 0.16, 0.32, 0.03); c.fill(); rr(c, -0.46, -0.78, 0.06, 0.34, 0.02); c.fill(); rr(c, -0.56, -0.7, 0.26, 0.04, 0.01); c.fill();   // bridge mast
      rr(c, -0.96, -0.32, 0.3, 0.18, 0.05); c.fill(); rr(c, -1.12, -0.28, 0.2, 0.05, 0.02); c.fill();   // rear flak
      shade(c, () => { rrp(c, -1.04, 0.0, 2.08, 0.06, 0.02); rrp(c, -0.1, -0.42, 0.44, 0.06, 0.02); for (const x of [0.64, 0.92]) { rrp(c, x, -0.44, 0.04, 0.24, 0.01); } }, SH2);
    },
    // M2 Bradley: tall box hull with a steep glacis, side skirts, a small turret with the 25mm Bushmaster and the twin TOW box on its side
    bulwark(c) {
      tracks(c, -0.98, 0.24, 1.9, 0.36, 6);
      poly(c, [-0.98, 0.3, -0.98, -0.3, 0.42, -0.3, 1.0, 0.04, 0.96, 0.3]); c.fill();
      poly(c, [-0.36, -0.3, -0.3, -0.56, 0.2, -0.56, 0.28, -0.3]); c.fill();
      rr(c, 0.2, -0.48, 0.66, 0.06, 0.02); c.fill();                                            // 25mm
      rr(c, -0.66, -0.66, 0.34, 0.22, 0.04); c.fill();                                          // TOW launcher
      rr(c, -0.98, -0.26, 0.08, 0.5, 0.02); c.fill();                                           // rear ramp
      shade(c, () => {
        rrp(c, -0.96, 0.04, 1.86, 0.05, 0.02);
        for (const x of [-0.7, -0.3, 0.1]) { c.moveTo(x + 0.035, -0.14); c.arc(x, -0.14, 0.035, 0, P * 2); }   // firing ports
        c.moveTo(-0.6, -0.6); c.arc(-0.64, -0.6, 0.0001, 0, P * 2); rrp(c, -0.64, -0.62, 0.3, 0.05, 0.02); rrp(c, -0.64, -0.52, 0.3, 0.05, 0.02);
      }, SH2);
    },
  });
  // M18 Claymore on its scissor legs, curved face toward the enemy, firing wire trailing off
  Object.assign(TACTIC, {
    ambush(c) {
      c.beginPath(); c.moveTo(-0.72, -0.36); c.quadraticCurveTo(0, -0.52, 0.72, -0.36); c.lineTo(0.72, 0.24); c.quadraticCurveTo(0, 0.08, -0.72, 0.24); c.closePath(); c.fill();
      rr(c, -0.38, -0.64, 0.16, 0.2, 0.03); c.fill(); rr(c, 0.22, -0.64, 0.16, 0.2, 0.03); c.fill();
      c.lineWidth = 0.09; c.lineCap = 'round'; c.strokeStyle = c.fillStyle;
      c.beginPath(); c.moveTo(-0.52, 0.18); c.lineTo(-0.72, 0.78); c.moveTo(-0.32, 0.16); c.lineTo(-0.14, 0.78); c.moveTo(0.32, 0.16); c.lineTo(0.14, 0.78); c.moveTo(0.52, 0.18); c.lineTo(0.72, 0.78); c.stroke();
      c.lineWidth = 0.05; c.beginPath(); c.moveTo(0.3, -0.64); c.bezierCurveTo(0.45, -0.95, 0.75, -0.6, 0.98, -0.88); c.stroke();
      sh(c, () => { rr(c, -0.5, -0.24, 1.0, 0.07, 0.02); c.fill(); rr(c, -0.4, -0.1, 0.8, 0.06, 0.02); c.fill(); }, SH2);
    },
  });
  // Carrier: a flat-deck legendary airbase
  Object.assign(UNIT, {
    carrier(c) {
      poly(c, [-1.08, -0.08, 1.08, -0.08, 0.86, 0.42, -0.92, 0.42]); c.fill();
      poly(c, [-1.12, -0.22, 1.12, -0.22, 1.08, -0.08, -1.08, -0.08]); c.fill();
      rr(c, 0.38, -0.6, 0.3, 0.4, 0.04); c.fill(); rr(c, 0.48, -0.86, 0.06, 0.28, 0.02); c.fill(); rr(c, 0.42, -0.8, 0.2, 0.05, 0.02); c.fill();
      sh(c, () => { c.fillRect(-1.0, -0.17, 1.3, 0.03); for (let i = 0; i < 6; i++) c.fillRect(-0.95 + i * 0.22, -0.2, 0.1, 0.09); rr(c, 0.43, -0.52, 0.2, 0.08, 0.02); c.fill(); c.fillRect(-0.85, 0.16, 1.65, 0.06); });
      // two parked jets on the deck
      for (const x of [-0.65, -0.2]) { poly(c, [x - 0.14, -0.26, x + 0.14, -0.26, x + 0.02, -0.4, x - 0.02, -0.4]); c.fill(); rr(c, x - 0.03, -0.46, 0.06, 0.22, 0.02); c.fill(); }
    },
  });
  // ── tactics drawn as the real kit they stand for ──
  const jet = (c, w) => { // a top-down fighter outline, nose up
    c.beginPath(); c.moveTo(0, -0.95); c.quadraticCurveTo(0.12, -0.8, 0.12, -0.45); c.lineTo(0.12, 0.45); c.lineTo(0.06, 0.62); c.lineTo(-0.06, 0.62); c.lineTo(-0.12, 0.45); c.lineTo(-0.12, -0.45); c.quadraticCurveTo(-0.12, -0.8, 0, -0.95); c.fill();
    poly(c, [0.1, -0.25, w, 0.15, w, 0.28, 0.1, 0.18]); c.fill(); poly(c, [-0.1, -0.25, -w, 0.15, -w, 0.28, -0.1, 0.18]); c.fill();
    poly(c, [0.08, 0.42, 0.36, 0.62, 0.36, 0.72, 0.06, 0.62]); c.fill(); poly(c, [-0.08, 0.42, -0.36, 0.62, -0.36, 0.72, -0.06, 0.62]); c.fill();
  };
  // battle cards
  Object.assign(TACTIC, {
    // a heater shield, braced
    holdfast(c) {
      c.beginPath(); c.moveTo(-0.72, -0.82); c.lineTo(0.72, -0.82); c.lineTo(0.72, -0.1); c.quadraticCurveTo(0.68, 0.6, 0, 0.95); c.quadraticCurveTo(-0.68, 0.6, -0.72, -0.1); c.closePath(); c.fill();
      sh(c, () => { c.beginPath(); c.moveTo(0, -0.82); c.lineTo(0.72, -0.82); c.lineTo(0.72, -0.1); c.quadraticCurveTo(0.68, 0.6, 0, 0.95); c.closePath(); c.fill(); });
      c.save(); c.globalCompositeOperation = 'destination-out'; rr(c, -0.07, -0.6, 0.14, 1.1, 0.04); c.fill(); rr(c, -0.45, -0.25, 0.9, 0.14, 0.04); c.fill(); c.restore();
    },
    // a rifle with its bayonet fixed, at the charge
    bayonets(c) {
      c.save(); c.rotate(-0.62);
      rr(c, -0.95, -0.06, 1.2, 0.13, 0.03); c.fill();                       // barrel and stock line
      poly(c, [-0.95, -0.06, -0.55, -0.06, -0.5, 0.2, -0.95, 0.24]); c.fill();   // stock
      rr(c, -0.2, 0.06, 0.08, 0.2, 0.02); c.fill();                          // magazine
      poly(c, [0.25, -0.02, 0.98, 0.02, 0.25, 0.08]); c.fill();               // the blade
      sh(c, () => { rr(c, 0.2, -0.08, 0.07, 0.2, 0.02); c.fill(); });
      c.restore();
    },
    // shells coming down in a creeping barrage
    barrage(c) {
      for (const [x, y] of [[-0.55, -0.35], [0.05, -0.6], [0.55, -0.15]]) {
        c.save(); c.translate(x, y); c.rotate(0.45);
        c.beginPath(); c.moveTo(0, 0.55); c.quadraticCurveTo(0.17, 0.35, 0.15, 0.05); c.lineTo(0.15, -0.25); c.lineTo(-0.15, -0.25); c.lineTo(-0.15, 0.05); c.quadraticCurveTo(-0.17, 0.35, 0, 0.55); c.fill();
        sh(c, () => { c.fillRect(-0.15, -0.12, 0.3, 0.07); });
        c.globalAlpha = 0.5; c.fillRect(-0.04, -0.75, 0.08, 0.42); c.restore();
      }
      c.beginPath(); c.ellipse(0, 0.82, 0.85, 0.12, 0, 0, Math.PI * 2); c.fill();
    },
    // fresh troops coming up: three helmets, one more on the way
    reserves(c) {
      for (const [x, y, k] of [[-0.5, 0.15, 0.9], [0.5, 0.15, 0.9], [0, -0.05, 1.05]]) {
        c.save(); c.translate(x, y); c.scale(k, k);
        c.beginPath(); c.arc(0, 0.1, 0.42, Math.PI, 0); c.lineTo(0.52, 0.18); c.lineTo(-0.52, 0.18); c.closePath(); c.fill();
        sh(c, () => { c.fillRect(-0.52, 0.1, 1.04, 0.08); });
        rr(c, -0.24, 0.24, 0.48, 0.5, 0.12); c.fill();
        c.restore();
      }
      rr(c, 0.62, -0.92, 0.12, 0.42, 0.03); c.fill(); rr(c, 0.47, -0.77, 0.42, 0.12, 0.03); c.fill();
    },
    // a die that can't come up low, on a level line
    steady(c) {
      c.save(); c.rotate(-0.12); rr(c, -0.62, -0.78, 1.24, 1.24, 0.2); c.fill();
      c.globalCompositeOperation = 'destination-out';
      for (const [x, y] of [[-0.3, -0.46], [0, -0.16], [0.3, 0.14]]) { c.beginPath(); c.arc(x, y, 0.12, 0, Math.PI * 2); c.fill(); }
      c.restore();
      rr(c, -0.9, 0.7, 1.8, 0.1, 0.04); c.fill(); rr(c, -0.06, 0.58, 0.12, 0.34, 0.04); c.fill();
    },
  });
  Object.assign(TACTIC, {
    // M18 smoke grenade with a plume
    smoke(c) {
      rr(c, -0.6, 0.05, 0.42, 0.8, 0.08); c.fill(); rr(c, -0.66, -0.08, 0.54, 0.16, 0.04); c.fill(); rr(c, -0.44, -0.28, 0.12, 0.22, 0.03); c.fill();
      c.save(); c.lineWidth = 0.08; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(-0.24, -0.2, 0.14, P, P * 1.9); c.stroke(); c.restore();
      sh(c, () => { c.fillRect(-0.6, 0.32, 0.42, 0.08); c.fillRect(-0.6, 0.6, 0.42, 0.06); });
      for (const [x, y, r] of [[-0.05, -0.45, 0.22], [0.25, -0.62, 0.28], [0.58, -0.4, 0.3], [0.35, -0.15, 0.24], [0.66, -0.02, 0.22]]) { circ(c, x, y, r); c.fill(); }
    },
    // a pair of combat boots, mid-stride
    march(c) {
      for (const [ox, oy, rot] of [[-0.38, 0.12, -0.1], [0.3, -0.12, 0.12]]) {
        c.save(); c.translate(ox, oy); c.rotate(rot);
        poly(c, [-0.18, -0.65, 0.14, -0.65, 0.16, 0.22, 0.5, 0.3, 0.55, 0.52, -0.22, 0.52, -0.22, 0.2]); c.fill();
        sh(c, () => { c.fillRect(-0.22, 0.4, 0.77, 0.12); for (let i = 0; i < 4; i++) c.fillRect(-0.12, -0.5 + i * 0.16, 0.24, 0.04); });
        c.restore();
      }
    },
    // a bugle sounding the charge
    rally(c) {
      c.save(); c.rotate(-0.35);
      c.lineWidth = 0.12; c.strokeStyle = c.fillStyle; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-0.8, 0.05); c.lineTo(0.2, 0.05); c.quadraticCurveTo(0.45, 0.05, 0.45, 0.25); c.quadraticCurveTo(0.45, 0.45, 0.2, 0.45); c.lineTo(-0.35, 0.45); c.quadraticCurveTo(-0.55, 0.45, -0.55, 0.25); c.stroke();
      poly(c, [0.2, -0.05, 0.85, -0.38, 0.85, 0.48, 0.2, 0.15]); c.fill();
      rr(c, -0.92, -0.02, 0.16, 0.14, 0.04); c.fill();
      c.restore();
      sh(c, () => { c.save(); c.rotate(-0.35); c.fillRect(0.75, -0.3, 0.06, 0.7); c.restore(); });
    },
    // A-10 Warthog from above: straight wings, twin tail engines
    gunrun(c) {
      c.beginPath(); c.moveTo(0, -0.95); c.quadraticCurveTo(0.12, -0.9, 0.12, -0.6); c.lineTo(0.1, 0.62); c.lineTo(-0.1, 0.62); c.lineTo(-0.12, -0.6); c.quadraticCurveTo(-0.12, -0.9, 0, -0.95); c.fill();
      poly(c, [-0.98, -0.18, 0.98, -0.18, 0.98, 0.0, -0.98, 0.0]); c.fill();
      for (const x of [-0.24, 0.24]) { c.beginPath(); c.ellipse(x, 0.3, 0.1, 0.17, 0, 0, P * 2); c.fill(); }
      poly(c, [-0.45, 0.6, 0.45, 0.6, 0.45, 0.72, -0.45, 0.72]); c.fill();
      for (const x of [-0.45, 0.45]) { rr(c, x - 0.04, 0.52, 0.08, 0.28, 0.02); c.fill(); }
      rr(c, -0.02, -1.05, 0.04, 0.14, 0.01); c.fill();
      sh(c, () => { c.beginPath(); c.ellipse(0, -0.7, 0.06, 0.12, 0, 0, P * 2); c.fill(); for (const x of [-0.7, -0.45, 0.45, 0.7]) { c.fillRect(x - 0.03, -0.18, 0.06, 0.18); } });
    },
    // F-16 Fighting Falcon side-on: bubble canopy, chin intake, one tall tail, bombs falling away
    airstrike(c) {
      c.beginPath(); c.moveTo(1.0, -0.32); c.quadraticCurveTo(0.8, -0.42, 0.55, -0.4); c.lineTo(-0.7, -0.36); c.lineTo(-0.95, -0.3); c.lineTo(-0.95, -0.2); c.lineTo(-0.7, -0.2); c.lineTo(0.55, -0.22); c.quadraticCurveTo(0.85, -0.24, 1.0, -0.32); c.fill();
      c.beginPath(); c.ellipse(0.5, -0.44, 0.2, 0.09, -0.08, P, 0); c.fill();                         // bubble canopy
      poly(c, [0.3, -0.22, 0.42, -0.08, 0.1, -0.08, 0.05, -0.22]); c.fill();                          // chin intake
      poly(c, [-0.55, -0.36, -0.82, -0.9, -0.95, -0.9, -0.88, -0.36]); c.fill();                       // vertical tail
      poly(c, [0.2, -0.28, -0.25, -0.05, -0.55, -0.05, -0.3, -0.3]); c.fill();                         // wing
      poly(c, [-0.68, -0.26, -0.95, -0.08, -1.02, -0.08, -0.88, -0.28]); c.fill();                     // tailplane
      for (const [x, y, r] of [[0.0, 0.25, 0.1], [-0.2, 0.52, 0.15], [-0.42, 0.8, 0.2]]) { c.save(); c.translate(x, y); c.rotate(0.6 + r); c.beginPath(); c.ellipse(0, 0, 0.13, 0.06, 0, 0, P * 2); c.fill(); poly(c, [-0.12, 0, -0.22, -0.07, -0.22, 0.07]); c.fill(); c.restore(); }
      sh(c, () => { c.beginPath(); c.ellipse(0.5, -0.44, 0.12, 0.05, -0.08, P, 0); c.fill(); c.fillRect(-0.6, -0.3, 1.1, 0.03); }, SH2);
    },
    // UH-60 Black Hawk from the side
    heli(c) {
      c.beginPath(); c.moveTo(-0.55, 0.0); c.quadraticCurveTo(-0.55, -0.32, -0.2, -0.32); c.lineTo(0.35, -0.32); c.quadraticCurveTo(0.62, -0.3, 0.68, 0.0); c.lineTo(0.62, 0.22); c.lineTo(-0.5, 0.22); c.closePath(); c.fill();
      poly(c, [-0.5, -0.12, -1.0, -0.06, -1.0, 0.04, -0.5, 0.1]); c.fill(); poly(c, [-0.98, -0.32, -0.88, -0.32, -0.9, 0.04, -1.0, 0.04]); c.fill();
      rr(c, -0.1, -0.46, 0.4, 0.16, 0.05); c.fill(); rr(c, 0.06, -0.58, 0.06, 0.14, 0.02); c.fill();
      rr(c, -0.95, -0.62, 1.9, 0.06, 0.03); c.fill();
      rr(c, -0.4, 0.3, 0.9, 0.05, 0.02); c.fill(); for (const x of [-0.3, 0.38]) { rr(c, x, 0.2, 0.05, 0.12, 0.02); c.fill(); }
      sh(c, () => { rr(c, 0.38, -0.24, 0.22, 0.18, 0.04); c.fill(); rr(c, -0.2, -0.22, 0.4, 0.3, 0.03); c.fill(); });
    },
    // a tank charging, dust behind it
    blitz(c) {
      tracks(c, -0.62, 0.2, 1.5, 0.32, 5);
      poly(c, [-0.62, 0.22, -0.55, -0.04, 0.82, -0.04, 0.9, 0.22]); c.fill();
      rr(c, -0.22, -0.32, 0.6, 0.3, 0.07); c.fill(); rr(c, 0.3, -0.24, 0.66, 0.08, 0.03); c.fill();
      c.save(); c.globalAlpha *= 0.7; for (const [y, w] of [[-0.3, 0.32], [-0.05, 0.42], [0.22, 0.3]]) rr(c, -1.0, y, w, 0.07, 0.03), c.fill(); c.restore();
      sh(c, () => { rr(c, -0.15, -0.22, 0.46, 0.06, 0.02); c.fill(); });
    },
    // e-bomb: a canister with antennas, discharging
    emp(c) {
      rr(c, -0.25, -0.35, 0.5, 0.75, 0.08); c.fill(); rr(c, -0.32, 0.38, 0.64, 0.14, 0.04); c.fill();
      for (const x of [-0.14, 0.14]) { rr(c, x - 0.025, -0.65, 0.05, 0.32, 0.02); c.fill(); circ(c, x, -0.67, 0.05); c.fill(); }
      sh(c, () => { c.fillRect(-0.25, -0.1, 0.5, 0.06); c.fillRect(-0.25, 0.1, 0.5, 0.06); poly(c, [0.04, -0.28, -0.1, 0.0, 0.0, 0.0, -0.06, 0.24, 0.1, -0.06, 0.0, -0.06]); c.fill(); });
      c.lineWidth = 0.07; c.strokeStyle = c.fillStyle; for (const r of [0.5, 0.75]) { c.beginPath(); c.arc(0, 0, r, -0.55, 0.55); c.stroke(); c.beginPath(); c.arc(0, 0, r, P - 0.55, P + 0.55); c.stroke(); }
    },
    // a satellite firing its beam down onto the target
    orbital(c) {
      rr(c, -0.16, -0.95, 0.32, 0.36, 0.05); c.fill();
      for (const s of [-1, 1]) { rr(c, s > 0 ? 0.22 : -0.86, -0.88, 0.64, 0.22, 0.03); c.fill(); rr(c, s > 0 ? 0.16 : -0.22, -0.79, 0.06, 0.04, 0.01); c.fill(); }
      sh(c, () => { for (const x of [-0.7, -0.5, -0.3, 0.38, 0.58, 0.78]) c.fillRect(x - 0.01, -0.88, 0.02, 0.22); });
      poly(c, [-0.06, -0.58, 0.06, -0.58, 0.16, 0.62, -0.16, 0.62]); c.fill();
      c.beginPath(); c.ellipse(0, 0.7, 0.55, 0.16, 0, 0, P * 2); c.fill();
      sh(c, () => { c.beginPath(); c.ellipse(0, 0.7, 0.3, 0.08, 0, 0, P * 2); c.fill(); }, SH2);
    },
    // B61 bomb with the radiation mark on its body
    nuke(c) {
      c.save(); c.rotate(-0.5);
      c.beginPath(); c.moveTo(0, -0.92); c.quadraticCurveTo(0.22, -0.88, 0.22, -0.55); c.lineTo(0.2, 0.42); c.lineTo(-0.2, 0.42); c.lineTo(-0.22, -0.55); c.quadraticCurveTo(-0.22, -0.88, 0, -0.92); c.fill();
      poly(c, [-0.2, 0.36, -0.42, 0.75, 0.42, 0.75, 0.2, 0.36]); c.fill(); rr(c, -0.04, 0.4, 0.08, 0.42, 0.02); c.fill();
      sh(c, () => { circ(c, 0, -0.25, 0.04); c.fill(); for (let i = 0; i < 3; i++) { const a0 = -P / 2 + i * P * 2 / 3; c.beginPath(); c.moveTo(0, -0.25); c.arc(0, -0.25, 0.17, a0 - 0.5, a0 + 0.5); c.closePath(); c.fill(); } c.fillRect(-0.21, 0.2, 0.42, 0.05); }, SH2);
      c.restore();
    },
    // an Aegis destroyer: the octagonal SPY-1 radar face on its bridge, radar beams sweeping out
    aegis(c) {
      poly(c, [-1.0, 0.35, 0.95, 0.35, 1.05, 0.15, 0.72, 0.68, -0.85, 0.68]); c.fill();                  // hull
      poly(c, [-0.5, 0.35, -0.42, -0.25, 0.3, -0.25, 0.42, 0.35]); c.fill();                            // superstructure
      rr(c, -0.04, -0.85, 0.08, 0.62, 0.02); c.fill(); rr(c, -0.22, -0.7, 0.44, 0.05, 0.02); c.fill();   // mast
      const oct = (cx, cy, r) => { c.beginPath(); for (let i = 0; i < 8; i++) { const a0 = P / 8 + i * P / 4; c.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r); } c.closePath(); };
      sh(c, () => { oct(-0.05, 0.02, 0.2); c.fill(); }, SH2);
      sh(c, () => { c.fillRect(-0.9, 0.48, 1.75, 0.05); rr(c, 0.55, 0.22, 0.22, 0.12, 0.03); c.fill(); });
      c.lineWidth = 0.06; c.strokeStyle = c.fillStyle; for (const r of [0.32, 0.5]) { c.beginPath(); c.arc(-0.05, 0.02, r, -2.6, -1.9); c.stroke(); c.beginPath(); c.arc(-0.05, 0.02, r, -1.25, -0.55); c.stroke(); }
    },
  });
  const POI = {
    ruins(c) { for (const [x, h] of [[-0.6, 0.9], [-0.2, 0.55], [0.2, 1.1], [0.6, 0.7]]) { rr(c, x - 0.13, 0.6 - h, 0.26, h, 0.03); c.fill(); } rr(c, -0.85, 0.55, 1.7, 0.2, 0.04); c.fill(); rr(c, -0.75, -0.5, 0.75, 0.15, 0.03); c.fill(); },
    cache(c) { TACTIC.cache(c); },
    village(c) { for (const [x, s] of [[-0.45, 0.8], [0.4, 1]]) { c.save(); c.translate(x, 0.2); c.scale(s, s); poly(c, [-0.45, -0.1, 0, -0.55, 0.45, -0.1]); c.fill(); rr(c, -0.35, -0.12, 0.7, 0.6, 0.03); c.fill(); c.restore(); } },
    // an abandoned FOB: a sagging, torn tent and a snapped flagpole leaning over
    fort(c) {
      poly(c, [-0.85, 0.7, -0.2, -0.2, 0.05, 0.1, 0.3, -0.05, 0.85, 0.7]); c.fill();
      c.save(); c.translate(0.1, 0.05); c.rotate(-0.6); rr(c, -0.04, -0.8, 0.08, 0.62, 0.02); c.fill(); poly(c, [0.04, -0.8, 0.42, -0.62, 0.04, -0.5]); c.fill(); c.restore();
      c.save(); c.strokeStyle = 'rgba(0,0,0,.65)'; c.lineWidth = 0.09; c.beginPath(); c.moveTo(-0.45, 0.68); c.lineTo(-0.25, 0.35); c.lineTo(-0.4, 0.15); c.moveTo(0.4, 0.68); c.lineTo(0.3, 0.42); c.lineTo(0.48, 0.3); c.stroke(); c.restore();
    },
    silo(c) { rr(c, -0.42, -0.2, 0.84, 1.05, 0.06); c.fill(); poly(c, [-0.24, -0.2, 0, -0.95, 0.24, -0.2]); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, -0.42, 0.3, 0.84, 0.12, 0.02); c.fill(); poly(c, [0, -0.95, 0.24, -0.2, 0, -0.2]); c.fill(); c.restore(); poly(c, [-0.24, 0.85, -0.5, 0.95, -0.24, 0.55]); c.fill(); poly(c, [0.24, 0.85, 0.5, 0.95, 0.24, 0.55]); c.fill(); },
    relic(c) { poly(c, [0, -0.95, 0.5, -0.1, 0, 0.95, -0.5, -0.1]); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.3)'; poly(c, [0, -0.95, 0.5, -0.1, 0, -0.1]); c.fill(); c.restore(); },
  };
  // ── the airbase's new strike card ──
  Object.assign(TACTIC, {
    // Tomahawk cruise missile: a long tube with pop-out wings and a cross of tail fins, its booster still burning
    cruise(c) {
      c.save(); c.rotate(-0.4);
      c.beginPath(); c.moveTo(0.95, 0); c.quadraticCurveTo(0.9, -0.13, 0.7, -0.13); c.lineTo(-0.7, -0.13); c.lineTo(-0.7, 0.13); c.lineTo(0.7, 0.13); c.quadraticCurveTo(0.9, 0.13, 0.95, 0); c.fill();
      poly(c, [0.12, -0.1, 0.0, -0.34, -0.08, -0.34, -0.04, -0.1]); c.fill(); poly(c, [0.12, 0.1, 0.0, 0.34, -0.08, 0.34, -0.04, 0.1]); c.fill();   // small pop-out wings
      for (const sy of [-1, 1]) { poly(c, [-0.5, sy * 0.1, -0.68, sy * 0.3, -0.76, sy * 0.3, -0.7, sy * 0.1]); c.fill(); }   // tail fins
      c.save(); c.globalAlpha *= 0.75; poly(c, [-0.72, -0.1, -1.1, -0.2, -0.95, 0, -1.1, 0.2, -0.72, 0.1]); c.fill(); c.restore();   // flame
      sh(c, () => { c.fillRect(0.4, -0.13, 0.04, 0.26); c.fillRect(-0.4, -0.13, 0.04, 0.26); circ(c, 0.82, 0, 0.05); c.fill(); });
      c.restore();
    },
  });
  const STRUCT = {
    // airfield emblem: a runway running off into the distance, and a swept-wing jet climbing away above it
    airbase(c) {
      poly(c, [-0.85, 0.95, 0.85, 0.95, 0.22, 0.3, -0.22, 0.3]); c.fill();                                   // runway in perspective
      sh(c, () => { for (const [y, w, h] of [[0.82, 0.08, 0.12], [0.6, 0.06, 0.09], [0.43, 0.045, 0.06]]) c.fillRect(-w / 2, y - h / 2, w, h);   // centre-line dashes
        poly(c, [-0.7, 0.9, -0.63, 0.9, -0.19, 0.34, -0.21, 0.34]); c.fill(); poly(c, [0.7, 0.9, 0.63, 0.9, 0.19, 0.34, 0.21, 0.34]); c.fill(); }, SH2);   // edge lines
      c.save(); c.translate(0.06, -0.38); c.rotate(0.45); c.scale(1.45, 1.45);
      c.beginPath(); c.moveTo(0, -0.5); c.quadraticCurveTo(0.07, -0.4, 0.07, -0.2); c.lineTo(0.06, 0.32); c.lineTo(-0.06, 0.32); c.lineTo(-0.07, -0.2); c.quadraticCurveTo(-0.07, -0.4, 0, -0.5); c.fill();   // fuselage
      poly(c, [0.06, -0.12, 0.48, 0.14, 0.48, 0.22, 0.06, 0.1, -0.06, 0.1, -0.48, 0.22, -0.48, 0.14, -0.06, -0.12]); c.fill();   // swept wings
      poly(c, [0.05, 0.2, 0.22, 0.34, 0.22, 0.39, 0.05, 0.33, -0.05, 0.33, -0.22, 0.39, -0.22, 0.34, -0.05, 0.2]); c.fill();   // tailplanes
      sh(c, () => { c.beginPath(); c.ellipse(0, -0.3, 0.035, 0.08, 0, 0, P * 2); c.fill(); }, SH2);   // canopy
      c.restore();
    },
    mine(c) {
      circ(c, 0, -0.05, 0.5); c.fill();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.save(); c.translate(Math.cos(a) * 0.5, -0.05 + Math.sin(a) * 0.5); c.rotate(a); rr(c, -0.02, -0.07, 0.26, 0.14, 0.04); c.fill(); circ(c, 0.26, 0, 0.09); c.fill(); c.restore(); }
      c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; circ(c, 0.1, 0.05, 0.36); c.fill(); c.restore();
      c.save(); c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, -0.16, -0.22, 0.1); c.fill(); c.restore();
      rr(c, -0.03, 0.45, 0.06, 0.45, 0.02); c.fill();
    },
    hq(c) { poly(c, [-0.55, 0.8, -0.4, -0.3, 0.4, -0.3, 0.55, 0.8]); c.fill(); rr(c, -0.55, -0.5, 1.1, 0.28, 0.04); c.fill(); for (let i = -2; i <= 2; i++) c.fillRect(i * 0.22 - 0.07, -0.68, 0.14, 0.2); },
    fob(c) { poly(c, [-0.85, 0.7, 0, -0.35, 0.85, 0.7]); c.fill(); rr(c, -0.04, -0.95, 0.08, 0.7, 0.02); c.fill(); poly(c, [0.04, -0.95, 0.6, -0.8, 0.04, -0.62]); c.fill(); },
    bunker(c) { c.beginPath(); c.arc(0, 0.55, 0.8, P, 0); c.closePath(); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-0.4, 0.05, 0.8, 0.12); c.restore(); },
    refinery(c) { rr(c, -0.75, 0.0, 1.0, 0.75, 0.05); c.fill(); rr(c, 0.3, -0.75, 0.32, 1.5, 0.05); c.fill(); poly(c, [-0.75, 0, -0.45, -0.3, -0.45, 0, -0.15, -0.3, -0.15, 0]); c.fill(); },
    flak(c) { rr(c, -0.65, 0.3, 1.3, 0.45, 0.1); c.fill(); circ(c, 0, 0.2, 0.35); c.fill(); c.save(); c.rotate(-0.7); rr(c, -0.2, -0.95, 0.12, 0.9, 0.03); c.fill(); rr(c, 0.08, -0.95, 0.12, 0.9, 0.03); c.fill(); c.restore(); },
    bridge(c) { c.lineWidth = 0.16; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(0, 0.75, 0.7, Math.PI, 0); c.stroke(); rr(c, -1, -0.15, 2, 0.18, 0.04); c.fill(); for (const x of [-0.55, 0, 0.55]) { rr(c, x - 0.05, -0.15, 0.1, 0.9, 0.02); c.fill(); } rr(c, -1, -0.45, 0.12, 1.2, 0.03); c.fill(); rr(c, 0.88, -0.45, 0.12, 1.2, 0.03); c.fill(); },
    port(c) { c.lineWidth = 0.16; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(0, -0.05, 0.62, 0.15, Math.PI - 0.15); c.stroke(); rr(c, -0.08, -0.85, 0.16, 1.4, 0.04); c.fill(); rr(c, -0.42, -0.55, 0.84, 0.15, 0.04); c.fill(); circ(c, 0, -0.85, 0.16); c.fill(); poly(c, [-0.75, 0.05, -0.5, -0.15, -0.5, 0.25]); c.fill(); poly(c, [0.75, 0.05, 0.5, -0.15, 0.5, 0.25]); c.fill(); },
    warehouse(c) { // gabled storage shed with a roller door and a pallet of crates
      poly(c, [-0.9, -0.15, 0, -0.75, 0.9, -0.15, 0.9, 0.75, -0.9, 0.75]); c.fill();
      c.save(); c.fillStyle = 'rgba(0,0,0,.45)'; rr(c, -0.5, 0.05, 0.6, 0.7, 0.03); c.fill(); c.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 4; i++) c.fillRect(-0.5, 0.14 + i * 0.15, 0.6, 0.04); c.fillRect(-0.9, -0.2, 1.8, 0.07); c.restore();
      rr(c, 0.28, 0.32, 0.42, 0.42, 0.03); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0.28, 0.5, 0.42, 0.04); c.fillRect(0.47, 0.32, 0.04, 0.42); c.restore();
    },
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
  // ── Supply Drop chests: painted per tier. Body and lid share one 240×200 frame so they stack exactly. ──
  const CHEST = {
    standard: { wood: ['#9a6533', '#86562a'], woodDark: '#5e3a18', metal: '#7f8d99', metalHi: '#c7d2db', metalDark: '#46525d', gem: '#7fd3ff', glow: '#bfe6ff' },
    gilded: { wood: ['#a3222f', '#8c1b27'], woodDark: '#5a0f17', metal: '#ffc53d', metalHi: '#fff1b0', metalDark: '#a8730f', gem: '#ff4f5e', glow: '#ffd76a' },
    mythic: { wood: ['#3d1670', '#30105c'], woodDark: '#1c0838', metal: '#5ee7ff', metalHi: '#e6fbff', metalDark: '#1f7f9c', gem: '#ff7ae6', glow: '#e3a2ff' },
  };
  function chest(tier, part) {
    const k = 'chest' + tier + part; if (cache[k]) return cache[k];
    const C = CHEST[tier] || CHEST.standard, S = 2, W = 240, H = 200;
    const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    const c = cv.getContext('2d'); c.scale(S, S); c.lineJoin = 'round';
    const ink = '#0b0f13';
    const plank = (x, y, w, h) => {
      const n = Math.max(1, Math.round(h / 20));
      for (let i = 0; i < n; i++) { c.fillStyle = C.wood[i % 2]; c.fillRect(x, y + i * h / n, w, h / n + 0.5); }
      c.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 1; i < n; i++) c.fillRect(x, y + i * h / n - 1, w, 2);
      c.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < n; i++) c.fillRect(x, y + i * h / n + 2, w, 2);
    };
    const band = (x, y, w, h) => {
      c.fillStyle = C.metalDark; rr(c, x - 1, y, w + 2, h, 3); c.fill();
      c.fillStyle = C.metal; rr(c, x, y, w, h - 3, 3); c.fill();
      c.fillStyle = C.metalHi; c.fillRect(x + 2, y + 2, 3, h - 8);
      for (const ry of [y + 9, y + h - 12]) { c.fillStyle = C.metalDark; circ(c, x + w / 2, ry, 3.6); c.fill(); c.fillStyle = C.metalHi; circ(c, x + w / 2 - 1, ry - 1, 1.4); c.fill(); }
    };
    if (part === 'body') {
      // box
      c.fillStyle = ink; rr(c, 14, 84, 212, 108, 12); c.fill();
      c.save(); rr(c, 19, 88, 202, 99, 9); c.clip();
      plank(19, 88, 202, 99);
      if (tier === 'mythic') { const g = c.createLinearGradient(0, 88, 0, 187); g.addColorStop(0, 'rgba(94,231,255,.0)'); g.addColorStop(1, 'rgba(94,231,255,.25)'); c.fillStyle = g; c.fillRect(19, 88, 202, 99); }
      c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(19, 88, 202, 12);           // shadow under the lid
      c.restore();
      band(36, 86, 26, 104); band(178, 86, 26, 104);
      // base trim
      c.fillStyle = ink; rr(c, 10, 176, 220, 20, 7); c.fill();
      c.fillStyle = C.metalDark; rr(c, 14, 179, 212, 13, 5); c.fill(); c.fillStyle = C.metal; rr(c, 14, 179, 212, 8, 4); c.fill();
      for (const x of [26, 214]) { c.fillStyle = C.metalHi; circ(c, x, 185, 2.4); c.fill(); }
      // lock plate
      c.fillStyle = ink; c.beginPath(); c.moveTo(96, 82); c.lineTo(144, 82); c.lineTo(144, 120); c.quadraticCurveTo(120, 146, 96, 120); c.closePath(); c.fill();
      c.fillStyle = C.metal; c.beginPath(); c.moveTo(100, 84); c.lineTo(140, 84); c.lineTo(140, 118); c.quadraticCurveTo(120, 140, 100, 118); c.closePath(); c.fill();
      c.fillStyle = C.metalHi; c.fillRect(103, 87, 4, 26);
      // gem
      c.fillStyle = ink; c.beginPath(); c.moveTo(120, 94); c.lineTo(132, 106); c.lineTo(120, 122); c.lineTo(108, 106); c.closePath(); c.fill();
      c.fillStyle = C.gem; c.beginPath(); c.moveTo(120, 97); c.lineTo(129, 106); c.lineTo(120, 118); c.lineTo(111, 106); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(120, 97); c.lineTo(124, 102); c.lineTo(116, 104); c.closePath(); c.fill();
    } else {
      // domed lid
      c.fillStyle = ink; c.beginPath(); c.moveTo(8, 92); c.lineTo(8, 62); c.bezierCurveTo(10, 8, 230, 8, 232, 62); c.lineTo(232, 92); c.closePath(); c.fill();
      c.save(); c.beginPath(); c.moveTo(13, 87); c.lineTo(13, 63); c.bezierCurveTo(16, 14, 224, 14, 227, 63); c.lineTo(227, 87); c.closePath(); c.clip();
      plank(13, 18, 214, 70);
      const hl = c.createLinearGradient(0, 18, 0, 88); hl.addColorStop(0, 'rgba(255,255,255,.22)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)'); c.fillStyle = hl; c.fillRect(13, 18, 214, 70);
      if (tier === 'mythic') { c.fillStyle = 'rgba(255,122,230,.18)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(40 + i * 40, 20); c.lineTo(60 + i * 40, 20); c.lineTo(48 + i * 40, 88); c.closePath(); c.fill(); } }
      c.restore();
      // lid bands follow the dome
      for (const x of [36, 178]) { c.save(); c.beginPath(); c.moveTo(13, 87); c.lineTo(13, 63); c.bezierCurveTo(16, 14, 224, 14, 227, 63); c.lineTo(227, 87); c.closePath(); c.clip(); band(x, 10, 26, 80); c.restore(); }
      // front rim
      c.fillStyle = ink; rr(c, 4, 80, 232, 18, 7); c.fill();
      c.fillStyle = C.metalDark; rr(c, 8, 83, 224, 12, 5); c.fill(); c.fillStyle = C.metal; rr(c, 8, 83, 224, 7, 4); c.fill();
      c.fillStyle = C.metalHi; c.fillRect(12, 84, 216, 2);
      // tier emblem on the dome
      c.fillStyle = ink; c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; c.lineTo(120 + 20 * Math.cos(a), 46 + 20 * Math.sin(a)); } c.closePath(); c.fill();
      c.fillStyle = C.metal; c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; c.lineTo(120 + 16 * Math.cos(a), 46 + 16 * Math.sin(a)); } c.closePath(); c.fill();
      c.fillStyle = C.metalDark; c.font = '900 17px "Black Ops One", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('S', 120, 47);
    }
    return cache[k] = cv.toDataURL('image/png');
  }
  Object.assign(UNIT, {
    // CH-47 Chinook: a long boxy fuselage, a rotor at each end (the rear one up on a tall pylon), a loading ramp, four wheels
    mule(c) {
      blur(c, () => { rr(c, 0.0, -0.66, 1.18, 0.06, 0.03); c.fill(); rr(c, -1.16, -0.86, 1.18, 0.06, 0.03); c.fill(); });   // two rotor discs
      rr(c, 0.52, -0.64, 0.08, 0.2, 0.02); c.fill();                                                                       // front mast
      poly(c, [-0.98, -0.42, -0.86, -0.84, -0.48, -0.84, -0.36, -0.42]); c.fill();                                      // rear pylon
      c.beginPath(); c.moveTo(-1.0, -0.42); c.lineTo(0.66, -0.46); c.quadraticCurveTo(0.98, -0.42, 1.04, -0.12); c.lineTo(1.04, 0.06); c.quadraticCurveTo(1.0, 0.2, 0.8, 0.2); c.lineTo(-0.78, 0.2); c.lineTo(-1.1, 0.0); c.closePath(); c.fill();   // fuselage and ramp
      rr(c, -0.5, 0.12, 0.6, 0.14, 0.05); c.fill();                                                                       // fuel sponson
      c.lineWidth = 0.06; c.strokeStyle = c.fillStyle; c.beginPath();
      for (const x of [0.66, 0.42, -0.58, -0.82]) { c.moveTo(x, 0.18); c.lineTo(x, 0.34); }
      c.stroke();
      for (const x of [0.66, 0.42, -0.58, -0.82]) hub(c, x, 0.38, 0.08);
      shade(c, () => {
        c.moveTo(0.7, -0.4); c.lineTo(0.94, -0.36); c.lineTo(1.0, -0.12); c.lineTo(0.72, -0.12); c.closePath();     // cockpit glass
        for (const x of [-0.7, -0.44, -0.18, 0.08, 0.34]) rrp(c, x, -0.3, 0.14, 0.12, 0.03);                            // cabin windows
        rrp(c, -1.0, -0.04, 0.4, 0.04, 0.02);                                                                           // the ramp's hinge line
      }, SH2);
    },
  });
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

  return { chest, cardBack, drawIcon, iconURL, cardArt, UNIT, TACTIC, STRUCT, GLYPH };
})();
