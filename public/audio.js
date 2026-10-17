/* SECTOR — synthesized sound effects (WebAudio, no assets) */
const SFX = (() => {
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem('sector.muted') === '1'; } catch (e) {}
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.32;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  window.addEventListener('pointerdown', ensure, { once: false, passive: true });
  function tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, delay = 0, attack = 0.004 } = {}) {
    if (muted || !isFinite(freq) || !ensure()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(dur, { vol = 0.3, freq = 1200, q = 0.8, type = 'lowpass', delay = 0, sweep = 0 } = {}) {
    if (muted || !ensure()) return;
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  const PENTA = [0, 2, 4, 7, 9];
  const note = n => (n = Math.floor(n) || 0, 220 * Math.pow(2, (Math.floor(n / 5) * 12 + PENTA[((n % 5) + 5) % 5]) / 12));
  return {
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('sector.muted', muted ? '1' : '0'); } catch (e) {} return muted; },
    click() { tone(880, 0.05, { type: 'square', vol: 0.12 }); },
    hover() { tone(1320, 0.025, { type: 'sine', vol: 0.05 }); },
    select() { tone(520, 0.06, { vol: 0.14 }); tone(780, 0.08, { vol: 0.12, delay: 0.04 }); },
    error() { tone(160, 0.16, { type: 'sawtooth', vol: 0.16 }); tone(120, 0.2, { type: 'sawtooth', vol: 0.12, delay: 0.08 }); },
    // ascending pluck for capture chains (Balatro chip-count feel)
    capture(i = 0) { const f = note(7 + i); tone(f, 0.16, { type: 'triangle', vol: 0.22 }); tone(f * 2, 0.08, { type: 'sine', vol: 0.08 }); },
    chip(i = 0) { const f = note(5 + i); tone(f, 0.09, { type: 'square', vol: 0.13 }); },
    mult(i = 0) { const f = note(10 + i); tone(f, 0.14, { type: 'sawtooth', vol: 0.12 }); tone(f * 1.5, 0.12, { type: 'square', vol: 0.06, delay: 0.03 }); },
    coin(n = 3) { for (let i = 0; i < Math.min(n, 8); i++) { tone(1046 + i * 90, 0.07, { type: 'square', vol: 0.1, delay: i * 0.055 }); tone(1568 + i * 90, 0.09, { type: 'sine', vol: 0.08, delay: i * 0.055 + 0.03 }); } },
    deploy() { noise(0.18, { vol: 0.35, freq: 300, sweep: -200 }); tone(90, 0.2, { type: 'sine', vol: 0.4, slide: -40 }); },
    build() { for (let i = 0; i < 3; i++) { noise(0.06, { vol: 0.25, freq: 2400, type: 'bandpass', q: 3, delay: i * 0.09 }); tone(300 + i * 40, 0.05, { vol: 0.08, delay: i * 0.09 }); } },
    step() { noise(0.05, { vol: 0.12, freq: 700, type: 'bandpass', q: 1.5 }); },
    dice() { for (let i = 0; i < 6; i++) noise(0.04, { vol: 0.2, freq: 3000 + Math.random() * 2000, type: 'bandpass', q: 4, delay: i * 0.05 + Math.random() * 0.02 }); },
    diceLand() { tone(220, 0.08, { type: 'square', vol: 0.16 }); noise(0.08, { vol: 0.25, freq: 1800, type: 'bandpass', q: 2 }); },
    boom(big = 1) { noise(0.5 * big + 0.2, { vol: 0.55, freq: 900, sweep: -800 }); tone(70, 0.4 * big + 0.1, { type: 'sine', vol: 0.5, slide: -45 }); },
    shot() { noise(0.12, { vol: 0.3, freq: 2000, sweep: -1700 }); tone(240, 0.1, { type: 'sawtooth', vol: 0.12, slide: -180 }); },
    whoosh() { noise(0.4, { vol: 0.2, freq: 400, sweep: 2600, type: 'bandpass', q: 1 }); },
    card() { noise(0.09, { vol: 0.18, freq: 5000, type: 'highpass' }); tone(660, 0.05, { type: 'sine', vol: 0.06, delay: 0.03 }); },
    rare() { [0, 4, 7, 12].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.25, { type: 'triangle', vol: 0.14, delay: i * 0.06 })); },
    legendary() { [0, 4, 7, 11, 14, 19].forEach((s, i) => { tone(392 * Math.pow(2, s / 12), 0.5, { type: 'triangle', vol: 0.16, delay: i * 0.07 }); tone(784 * Math.pow(2, s / 12), 0.3, { type: 'sine', vol: 0.06, delay: i * 0.07 }); }); },
    yourTurn() { tone(392, 0.12, { type: 'square', vol: 0.12 }); tone(587, 0.12, { type: 'square', vol: 0.12, delay: 0.1 }); tone(784, 0.25, { type: 'triangle', vol: 0.16, delay: 0.2 }); },
    turn() { tone(330, 0.1, { type: 'triangle', vol: 0.08 }); },
    win() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(262 * Math.pow(2, s / 12), 0.4, { type: 'square', vol: 0.11, delay: i * 0.09 })); },
    lose() { [12, 8, 5, 0].forEach((s, i) => tone(262 * Math.pow(2, s / 12), 0.35, { type: 'sawtooth', vol: 0.1, delay: i * 0.16 })); },
    victoryHit() { tone(130, 0.3, { type: 'square', vol: 0.18 }); tone(196, 0.3, { type: 'square', vol: 0.14, delay: 0.05 }); noise(0.3, { vol: 0.3, freq: 1500 }); },
    alarm() { for (let i = 0; i < 3; i++) { tone(880, 0.12, { type: 'square', vol: 0.12, delay: i * 0.25 }); tone(660, 0.12, { type: 'square', vol: 0.12, delay: i * 0.25 + 0.12 }); } },
    zap() { tone(1800, 0.25, { type: 'sawtooth', vol: 0.12, slide: -1600 }); noise(0.2, { vol: 0.2, freq: 4000, type: 'highpass' }); },
  };
})();
