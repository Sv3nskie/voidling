// Voidling cinematic effects: out-of-focus foreground motes, letterbox bars and fades.
// The motes switch off with Settings → Cinematic effects. (Film grain and a full-screen bloom
// were tried in 0.1.7 and removed: grainy, and too slow on phones.)
(() => {
  const V = window.V;
  const wrap = (v, m) => ((v % m) + m) % m;

  // Foreground motes: big soft discs drifting between you and the camera, moving faster than
  // the world when the camera moves, like dust right in front of the lens
  const bokehCache = new Map();
  const bokeh = color => {
    let c = bokehCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gr.addColorStop(0, color + '55');
    gr.addColorStop(0.72, color + '66');
    gr.addColorStop(0.86, color + '99');
    gr.addColorStop(1, color + '00');
    g.fillStyle = gr;
    g.fillRect(0, 0, 96, 96);
    bokehCache.set(color, c);
    return c;
  };
  const MOTES = Array.from({ length: 11 }, (_, i) => {
    const r = V.rng(900 + i * 37);
    return { x: r() * 1800, y: r() * 1400, s: 22 + r() * 54, d: 1.35 + r() * 0.5, a: 0.05 + r() * 0.07, p: r() * 6.28, c: ['#ff7fc8', '#b98cff', '#5fe3ff', '#ffd6e0'][i % 4] };
  });
  function motes(ctx, W, H, cam, z, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const k = V.clamp(Math.min(W, H) / 800, 0.45, 1), count = W * H < 600000 ? 7 : MOTES.length; // sized to the screen
    for (let i = 0; i < count; i++) {
      const m = MOTES[i], s = m.s * k;
      const x = wrap(m.x - cam.x * z * m.d + Math.sin(t * 0.2 + m.p) * 30, W + 240) - 120;
      const y = wrap(m.y - cam.y * z * m.d + t * 6 * m.d, H + 240) - 120;
      ctx.globalAlpha = m.a * (0.75 + 0.25 * Math.sin(t * 0.7 + m.p));
      ctx.drawImage(bokeh(m.c), x - s, y - s, s * 2, s * 2);
    }
    ctx.restore();
  }

  V.fx = {
    // world = after the world is drawn, before screen-space overlays
    world(ctx, W, H, cam, z, t) { if (V.settings.fx) motes(ctx, W, H, cam, z, t); },
    // Cinematic black bars, k = fraction of the screen height each bar covers
    letterbox(ctx, W, H, k) {
      if (k < 0.002) return;
      const h = Math.round(H * k);
      ctx.fillStyle = '#04010b';
      ctx.fillRect(0, 0, W, h);
      ctx.fillRect(0, H - h, W, h);
      ctx.fillStyle = 'rgba(185,140,255,0.12)';
      ctx.fillRect(0, h, W, 1);
      ctx.fillRect(0, H - h - 1, W, 1);
    },
    fade(ctx, W, H, a) {
      if (a < 0.003) return;
      ctx.fillStyle = `rgba(4,1,11,${Math.min(1, a)})`;
      ctx.fillRect(0, 0, W, H);
    },
  };
})();
