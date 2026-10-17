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
    mutiny(c) { rr(c, -0.65, -0.85, 0.12, 1.7, 0.03); c.fill(); c.beginPath(); c.moveTo(-0.53, -0.8); c.quadraticCurveTo(0, -0.95, 0.2, -0.75); c.quadraticCurveTo(0.5, -0.55, 0.85, -0.7); c.lineTo(0.85, 0.05); c.quadraticCurveTo(0.5, 0.2, 0.2, 0.0); c.quadraticCurveTo(0, -0.15, -0.53, 0.0); c.closePath(); c.fill(); },
  };

  const STRUCT = {
    hq(c) { poly(c, [-0.55, 0.8, -0.4, -0.3, 0.4, -0.3, 0.55, 0.8]); c.fill(); rr(c, -0.55, -0.5, 1.1, 0.28, 0.04); c.fill(); for (let i = -2; i <= 2; i++) c.fillRect(i * 0.22 - 0.07, -0.68, 0.14, 0.2); },
    fob(c) { poly(c, [-0.85, 0.7, 0, -0.35, 0.85, 0.7]); c.fill(); rr(c, -0.04, -0.95, 0.08, 0.7, 0.02); c.fill(); poly(c, [0.04, -0.95, 0.6, -0.8, 0.04, -0.62]); c.fill(); },
    bunker(c) { c.beginPath(); c.arc(0, 0.55, 0.8, P, 0); c.closePath(); c.fill(); c.save(); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-0.4, 0.05, 0.8, 0.12); c.restore(); },
    refinery(c) { rr(c, -0.75, 0.0, 1.0, 0.75, 0.05); c.fill(); rr(c, 0.3, -0.75, 0.32, 1.5, 0.05); c.fill(); poly(c, [-0.75, 0, -0.45, -0.3, -0.45, 0, -0.15, -0.3, -0.15, 0]); c.fill(); },
    flak(c) { rr(c, -0.65, 0.3, 1.3, 0.45, 0.1); c.fill(); circ(c, 0, 0.2, 0.35); c.fill(); c.save(); c.rotate(-0.7); rr(c, -0.2, -0.95, 0.12, 0.9, 0.03); c.fill(); rr(c, 0.08, -0.95, 0.12, 0.9, 0.03); c.fill(); c.restore(); },
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
    const fn = (kind === 'unit' ? UNIT : kind === 'tactic' ? TACTIC : kind === 'struct' ? STRUCT : GLYPH)[id];
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
  function cardArt(id) {
    const k = 'card' + id; if (cache[k]) return cache[k];
    const E = SectorEngine, d = E.cardDef(id), rc = E.RARITY[d.rarity].color;
    const W = 300, H = 190, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, W, H);
    const bg = d.kind === 'unit' ? ['#1c2a33', '#0e161c'] : ['#2b1d33', '#140d19'];
    g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // halftone dots
    c.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = 0; y < H; y += 10) for (let x = (y / 10) % 2 * 5; x < W; x += 10) { c.beginPath(); c.arc(x, y, 1.4, 0, P * 2); c.fill(); }
    // radial burst
    c.save(); c.translate(W / 2, H / 2 + 6); c.globalAlpha = 0.16; c.fillStyle = rc;
    for (let i = 0; i < 16; i++) { c.rotate(P / 8); c.beginPath(); c.moveTo(0, 0); c.lineTo(-18, -200); c.lineTo(18, -200); c.fill(); }
    c.restore();
    const rg = c.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 110); rg.addColorStop(0, rc + '55'); rg.addColorStop(1, 'transparent'); c.fillStyle = rg; c.fillRect(0, 0, W, H);
    // icon with drop shadow
    c.save(); c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowOffsetY = 6; c.shadowBlur = 0;
    drawIcon(c, d.kind, id, W / 2, H / 2 + 4, 62, '#f4f1e8'); c.restore();
    c.save(); c.globalAlpha = 0.35; drawIcon(c, d.kind, id, W / 2 + 3, H / 2 + 1, 62, rc); c.restore();
    drawIcon(c, d.kind, id, W / 2, H / 2 + 4, 62, '#f4f1e8');
    return cache[k] = cv.toDataURL('image/webp', 0.86);
  }

  return { drawIcon, iconURL, cardArt, UNIT, TACTIC, STRUCT, GLYPH };
})();
