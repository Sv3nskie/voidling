// Voidling core: math helpers, input, audio, glow sprites
(() => {
  const V = (window.V = window.V || {});
  V.VERSION = '0.1.3'; // shown on the title screen, so bug reports can say which build

  // The tower swaps V.random for its own seeded generator while it builds levels
  V.random = Math.random;
  V.rand = (a = 0, b = 1) => a + V.random() * (b - a);
  V.chance = p => V.random() < p;
  V.pick = arr => arr[Math.floor(V.random() * arr.length)];
  V.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  V.lerp = (a, b, t) => a + (b - a) * t;
  V.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  V.approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
  // Seeded RNG so a sprite looks the same every time it is rebuilt
  V.rng = seed => {
    let s = (seed >>> 0) || 1;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  };

  V.fmtInt = n => Math.floor(n).toLocaleString('en-US');
  const UNITS = [[1e15, 'Pt'], [1e12, 'Tt'], [1e9, 'Gt'], [1e6, 'Mt'], [1e3, 'kt'], [1, 't']];
  V.fmtMass = kg => {
    if (kg < 1000) return kg.toFixed(kg < 10 ? 1 : 0) + ' kg';
    const t = kg / 1000;
    for (const [d, u] of UNITS) {
      if (t >= d) {
        const v = t / d;
        return v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) + ' ' + u;
      }
    }
    return t.toFixed(1) + ' t';
  };

  // ---------- Input ----------
  const keys = new Set();
  const pressed = new Set();
  // A key can trigger several actions (↑ both jumps and aims up)
  const MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: ['jump', 'up'], KeyW: ['jump', 'up'], Space: 'jump', KeyZ: 'jump',
    ArrowDown: 'down', KeyS: 'down',
    ShiftLeft: 'shoot', ShiftRight: 'shoot', KeyE: 'shoot',
    KeyX: 'chomp', KeyC: 'chomp', KeyK: 'chomp',
    KeyG: 'hook', KeyQ: 'hook',
    KeyM: 'mute', KeyP: 'pause', Escape: 'pause', Enter: 'start',
  };
  const actions = code => [].concat(MAP[code] || []);
  const press = a => { if (!keys.has(a)) pressed.add(a); keys.add(a); };
  addEventListener('keydown', e => {
    const list = actions(e.code);
    if (!list.length) return;
    e.preventDefault();
    list.forEach(press);
  });
  addEventListener('keyup', e => actions(e.code).forEach(a => keys.delete(a)));
  addEventListener('blur', () => keys.clear());
  // ---------- Gamepad (standard layout: Xbox / PlayStation / Steam Deck) ----------
  // Left stick or d-pad moves, A jumps, B dashes, X or RT shoots, Y / LB / LT grapples,
  // Start pauses, and the right stick aims in any direction.
  const PAD = { 0: 'jump', 1: 'chomp', 2: 'shoot', 7: 'shoot', 5: 'chomp', 3: 'hook', 4: 'hook', 6: 'hook', 9: ['start', 'pause'], 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  const padHeld = new Set();
  V.pad = { ax: 0, ay: 0, aiming: false, connected: false };
  V.pollPad = () => {
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p && p.connected) : null;
    V.pad.connected = !!gp;
    const want = new Set();
    if (gp) {
      gp.buttons.forEach((b, i) => { if (b.pressed && PAD[i]) [].concat(PAD[i]).forEach(a => want.add(a)); });
      const [lx = 0, ly = 0, rx = 0, ry = 0] = gp.axes;
      if (lx < -0.4) want.add('left');
      if (lx > 0.4) want.add('right');
      if (ly > 0.6) want.add('down');
      if (ly < -0.6) want.add('up');
      const m = Math.hypot(rx, ry);
      V.pad.aiming = m > 0.35;
      if (V.pad.aiming) { V.pad.ax = rx / m; V.pad.ay = ry / m; }
    } else {
      V.pad.aiming = false;
    }
    for (const a of want) if (!padHeld.has(a)) press(a);
    for (const a of padHeld) if (!want.has(a)) keys.delete(a);
    padHeld.clear();
    want.forEach(a => padHeld.add(a));
  };

  V.input = {
    down: a => keys.has(a),
    hit: a => pressed.has(a),
    endFrame: () => pressed.clear(),
    press,
    release: a => keys.delete(a),
  };

  // ---------- Audio (all synthesized, no files) ----------
  let ac = null, master = null, noiseBuf = null, muted = false;
  const tone = (freq, dur = 0.12, type = 'sine', vol = 0.2, slide = 0, delay = 0) => {
    if (!ac) return;
    const t = ac.currentTime + Math.max(0, delay);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  };
  const noise = (dur = 0.2, vol = 0.2, cutoff = 1200, delay = 0) => {
    if (!ac) return;
    const t = ac.currentTime + Math.max(0, delay);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, cutoff * 0.2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.03);
  };
  const startMusic = () => {
    // A-minor pentatonic arpeggio over a slow bass: dreamy, a little ominous
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
    const bass = [55, 55, 43.65, 49];
    const pat = [0, 2, 4, 5, 4, 2, 3, 1];
    const spb = 60 / 92 / 2;
    let step = 0, next = ac.currentTime + 0.15;
    setInterval(() => {
      if (!ac || muted) return;
      if (next < ac.currentTime) next = ac.currentTime + 0.05;
      while (next < ac.currentTime + 0.3) {
        const bar = Math.floor(step / 8) % 4;
        const d = next - ac.currentTime;
        if (step % 8 === 0) tone(bass[bar], spb * 7.5, 'sine', 0.13, 1, d);
        if (Math.random() > 0.18) tone(scale[(pat[step % 8] + bar) % scale.length], spb * 1.8, 'triangle', 0.03, 1, d);
        next += spb;
        step++;
      }
    }, 100);
  };
  V.audio = {
    init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const ch = noiseBuf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        startMusic();
      } catch (e) { ac = null; }
    },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
  };
  V.sfx = {
    eat(ratio) { tone(260 + 700 * V.clamp(1 - ratio, 0, 1), 0.09, 'triangle', 0.16, 1.7); },
    coin() { tone(988, 0.06, 'square', 0.045); tone(1319, 0.1, 'square', 0.045, 1, 0.05); },
    jump() { tone(320, 0.14, 'sine', 0.12, 1.9); },
    djump() { tone(480, 0.16, 'sine', 0.1, 1.8); },
    dash() { noise(0.18, 0.12, 2600); },
    hurt() { tone(170, 0.32, 'sawtooth', 0.12, 0.45); noise(0.2, 0.1, 900); },
    crunch() { noise(0.4, 0.35, 800); tone(95, 0.4, 'sine', 0.28, 0.5); },
    boom() { noise(1.0, 0.5, 500); tone(55, 1.1, 'sine', 0.4, 0.4); },
    tier() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.11, 1, i * 0.09)); },
    zap() { tone(1500, 0.12, 'sawtooth', 0.04, 0.4); },
    charge() { tone(300, 0.7, 'sawtooth', 0.04, 3.5); },
    stomp() { tone(220, 0.12, 'square', 0.1, 2.6); noise(0.1, 0.15, 1800); },
    kill() { tone(660, 0.08, 'triangle', 0.14, 0.5); tone(990, 0.12, 'triangle', 0.1, 1.5, 0.05); },
    hit() { tone(300, 0.08, 'square', 0.08, 0.7); },
    bounce() { tone(180, 0.3, 'sine', 0.18, 4.5); },
    heart() { [784, 988, 1175].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, 1, i * 0.06)); },
    thunder() { noise(1.6, 0.35, 300); },
    wind() { noise(1.8, 0.08, 1400); },
    crumble() { noise(0.35, 0.18, 600); },
    shoot() { tone(1200, 0.08, 'square', 0.05, 0.45); },
    spread() { tone(700, 0.12, 'sawtooth', 0.06, 0.4); noise(0.08, 0.08, 3000); },
    throw() { noise(0.15, 0.1, 2200); tone(400, 0.12, 'sine', 0.06, 1.6); },
    pickup() { tone(523, 0.08, 'triangle', 0.1); tone(784, 0.12, 'triangle', 0.1, 1, 0.06); },
    shatter() { noise(0.2, 0.2, 2500); tone(1600, 0.08, 'triangle', 0.05, 0.6); },
    surgeWarn() { tone(42, 2.5, 'sawtooth', 0.1, 1.7); noise(2.5, 0.12, 220); },
    surge() { noise(4.5, 0.28, 320); tone(36, 4.5, 'sine', 0.32, 1.2); tone(72, 0.6, 'square', 0.08, 0.5); },
  };

  // ---------- Glow sprites (additive, cached per color) ----------
  const glowCache = new Map();
  V.glowSprite = color => {
    let c = glowCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, color + 'ff');
    gr.addColorStop(0.25, color + '99');
    gr.addColorStop(0.6, color + '26');
    gr.addColorStop(1, color + '00');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    glowCache.set(color, c);
    return c;
  };
  // color must be a 7-char hex like #ffcc4d
  V.drawGlow = (ctx, x, y, radius, color, alpha = 1) => {
    if (alpha <= 0 || radius <= 0) return;
    const prevA = ctx.globalAlpha, prevOp = ctx.globalCompositeOperation;
    ctx.globalAlpha = prevA * alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(V.glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = prevA;
    ctx.globalCompositeOperation = prevOp;
  };

  V.mixHex = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(V.lerp(pa >> 16, pb >> 16, t));
    const g = Math.round(V.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    const bl = Math.round(V.lerp(pa & 255, pb & 255, t));
    return `rgb(${r},${g},${bl})`;
  };
})();
