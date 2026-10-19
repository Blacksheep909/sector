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
  // ── main-menu war theme: a slow D-minor march, synthesized live (strings, brass, horn, timpani, snare, hall reverb) ──
  const Music = (() => {
    let bus = null, verb = null, timer = null, next = 0, step = 0, on = false;
    const BPM = 76, E8 = 60 / BPM / 2;                       // one 8th note
    const N = n => 440 * Math.pow(2, (n - 69) / 12);         // midi -> Hz
    const CH = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]];   // Dm  Bb  Gm  A
    const BASS = [38, 34, 31, 33];
    const MEL = [[62, 4], [null, 2], [65, 1], [64, 1], [62, 4], [57, 4], [58, 2], [60, 2], [62, 4], [57, 6], [null, 2],
                 [62, 2], [65, 2], [69, 4], [67, 2], [65, 2], [64, 4], [62, 2], [61, 2], [62, 8]];
    function impulse(c) {
      const len = c.sampleRate * 3.2, b = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      return b;
    }
    function setup() {
      const c = ensure(); if (!c) return null;
      if (!bus) {
        bus = c.createGain(); bus.gain.value = 0;
        verb = c.createConvolver(); verb.buffer = impulse(c);
        const wet = c.createGain(); wet.gain.value = 0.55; const dry = c.createGain(); dry.gain.value = 0.75;
        bus.connect(dry); bus.connect(verb); verb.connect(wet);
        const out = c.createGain(); out.gain.value = 0.9; dry.connect(out); wet.connect(out); out.connect(master);
      }
      return c;
    }
    function voice(t, freq, dur, { type = 'sawtooth', vol = 0.06, cut = 1200, atk = 0.05, rel = 0.3, detune = 0, vib = 0 } = {}) {
      const c = ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
      if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.2; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + rel); }
      f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + atk); g.gain.setValueAtTime(vol, t + Math.max(atk, dur - 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
      o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + rel + 0.05);
    }
    function hit(t, { freq = 2000, q = 0.8, type = 'bandpass', vol = 0.1, dur = 0.12 } = {}) {
      const c = ctx; if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const src = c.createBufferSource(); src.buffer = noiseBuf; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(bus); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    }
    function timp(t, freq, vol = 0.5) {
      const c = ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 1.5);
      hit(t, { freq: 180, type: 'lowpass', vol: vol * 0.5, dur: 0.25 });
    }
    // schedule one 8th-note step; 128 steps = 16 bars
    function schedule(st, t) {
      const bar = Math.floor(st / 8) % 16, inBar = st % 8, chord = Math.floor(bar / 2) % 4, phrase = Math.floor(bar / 4);
      // low string ostinato: root, root, fifth, root …
      const r = BASS[chord], pat = [0, 0, 7, 0, 0, 12, 7, 0];
      voice(t, N(r + pat[inBar]), E8 * 0.85, { vol: 0.055, cut: 700, atk: 0.01, rel: 0.12 });
      // brass chord swells at each chord change
      if (inBar === 0 && bar % 2 === 0) for (const [k, n] of CH[chord].entries()) { voice(t, N(n), E8 * 15, { vol: 0.035, cut: 1100 + phrase * 250, atk: 0.6, rel: 0.9, detune: k * 4 - 4 }); voice(t, N(n), E8 * 15, { vol: 0.02, cut: 900, atk: 0.8, rel: 0.9, detune: 9, type: 'square' }); }
      // timpani on 1 and 3, a roll into every 4th bar
      if (inBar === 0) timp(t, N(r - 12 + 12), 0.45); if (inBar === 4) timp(t, N(r - 12 + 19), 0.3);
      if (bar % 4 === 3 && inBar >= 4) { for (let i = 0; i < 2; i++) hit(t + i * E8 / 2, { freq: 2600, vol: 0.03 + (inBar - 4) * 0.012, dur: 0.07 }); }
      if (bar % 4 === 0 && inBar === 0) hit(t, { freq: 90, type: 'lowpass', vol: 0.35, dur: 0.9 });
      // horn melody on the second half of the loop
      if (bar >= 8) { const pos = (bar - 8) * 8 + inBar; let acc = 0; for (const [n, len] of MEL) { if (acc === pos && n) { voice(t, N(n), E8 * len * 0.95, { type: 'triangle', vol: 0.07, cut: 2200, atk: 0.08, rel: 0.5, vib: 3 }); voice(t, N(n - 12), E8 * len * 0.95, { type: 'sawtooth', vol: 0.025, cut: 900, atk: 0.1, rel: 0.5 }); } acc += len; } }
    }
    function tick() {
      if (!on || !ctx) return;
      while (next < ctx.currentTime + 0.6) { schedule(step, next); step = (step + 1) % 128; next += E8; }
    }
    function start() {
      if (on || muted) return; const c = setup(); if (!c || c.state !== 'running') return;
      on = true; next = c.currentTime + 0.1; step = 0;
      bus.gain.cancelScheduledValues(c.currentTime); bus.gain.setValueAtTime(bus.gain.value, c.currentTime); bus.gain.linearRampToValueAtTime(1, c.currentTime + 2.5);
      clearInterval(timer); timer = setInterval(tick, 120); tick();
    }
    function stop() {
      if (!on || !ctx) return; on = false;
      bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime); bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.6);
      setTimeout(() => { if (!on) clearInterval(timer); }, 1700);
    }
    return { start, stop, get playing() { return on; } };
  })();
  return { music: Music,
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
    // A-10 Warthog gun run: the GAU-8 cannon's tearing ~65-rounds-a-second "BRRRT", shells crackling on the target,
    // then the TF34 engines' whine screaming past with a doppler drop
    brrrt() {
      if (muted || !ensure()) return;
      const t = ctx.currentTime, dur = 1.5;
      // the cannon: a sawtooth buzz chopped 65 times a second, driven hard through a waveshaper
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(68, t); o.frequency.linearRampToValueAtTime(62, t + dur);
      const chop = ctx.createOscillator(); chop.type = 'square'; chop.frequency.value = 65;
      const am = ctx.createGain(); am.gain.value = 0.5; const amDepth = ctx.createGain(); amDepth.gain.value = 0.5;
      chop.connect(amDepth); amDepth.connect(am.gain);
      const shaper = ctx.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 4); } shaper.curve = curve;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.04); g.gain.setValueAtTime(0.55, t + dur - 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(am); am.connect(shaper); shaper.connect(lp); lp.connect(g); g.connect(master);
      o.start(t); chop.start(t); o.stop(t + dur + 0.05); chop.stop(t + dur + 0.05);
      // grit: noise bursts in step with the gun
      noise(dur, { vol: 0.18, freq: 2400, q: 0.7, type: 'bandpass' });
      // shells landing: a crackle of small explosions
      for (let i = 0; i < 10; i++) noise(0.12, { vol: 0.25, freq: 700 + Math.random() * 500, sweep: -400, delay: 0.2 + i * 0.11 });
      // the jet screaming past: a high whine dropping in pitch, over a rushing roar
      tone(2300, 1.8, { type: 'sine', vol: 0.09, slide: -900, delay: dur - 0.2, attack: 0.3 });
      tone(1150, 1.8, { type: 'triangle', vol: 0.06, slide: -450, delay: dur - 0.2, attack: 0.3 });
      noise(2.0, { vol: 0.28, freq: 300, sweep: 1400, type: 'bandpass', q: 0.6, delay: dur - 0.3 });
    },
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
