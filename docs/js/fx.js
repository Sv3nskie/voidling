// Voidling cinematic effects: bloom, film grain, out-of-focus foreground motes, letterbox bars
// and fades. All but the letterbox and fades switch off with Settings → Cinematic effects.
(() => {
  const V = window.V;
  const wrap = (v, m) => ((v % m) + m) % m;
  const canFilter = 'filter' in CanvasRenderingContext2D.prototype;

  // Bloom: a small, blurred, high-contrast copy of the frame added back on top, so the glowing
  // things (crystals, eyes, bullets, the Void's edge) bleed light like a camera lens
  const bloomC = document.createElement('canvas'), bloomG = bloomC.getContext('2d');
  function bloom(ctx) {
    const c = ctx.canvas, w = Math.ceil(c.width / 6), h = Math.ceil(c.height / 6);
    if (bloomC.width !== w || bloomC.height !== h) { bloomC.width = w; bloomC.height = h; }
    bloomG.filter = 'brightness(0.62) contrast(3) blur(2px)';
    bloomG.clearRect(0, 0, w, h);
    bloomG.drawImage(c, 0, 0, w, h);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.32;
    ctx.drawImage(bloomC, 0, 0, c.width, c.height);
    ctx.restore();
  }

  // Film grain: a tiling noise texture, jumped to a new spot 24 times a second
  const grainC = document.createElement('canvas');
  grainC.width = grainC.height = 128;
  {
    const g = grainC.getContext('2d'), img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() * 34;
    }
    g.putImageData(img, 0, 0);
  }
  let grainPat = null, grainT = 0, gx = 0, gy = 0;
  function grain(ctx, t) {
    grainPat = grainPat || ctx.createPattern(grainC, 'repeat');
    if (t - grainT > 1 / 24 || t < grainT) { grainT = t; gx = Math.random() * 128; gy = Math.random() * 128; }
    const c = ctx.canvas, s = Math.max(1, c.width / Math.max(1, ctx.canvas.clientWidth || c.width) * 0.75);
    ctx.save();
    ctx.setTransform(s, 0, 0, s, -gx * s, -gy * s);
    ctx.fillStyle = grainPat;
    ctx.fillRect(0, 0, c.width / s + 128, c.height / s + 128);
    ctx.restore();
  }

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
    for (const m of MOTES) {
      const x = wrap(m.x - cam.x * z * m.d + Math.sin(t * 0.2 + m.p) * 30, W + 240) - 120;
      const y = wrap(m.y - cam.y * z * m.d + t * 6 * m.d, H + 240) - 120;
      ctx.globalAlpha = m.a * (0.75 + 0.25 * Math.sin(t * 0.7 + m.p));
      ctx.drawImage(bokeh(m.c), x - m.s, y - m.s, m.s * 2, m.s * 2);
    }
    ctx.restore();
  }

  V.fx = {
    // world = after the world is drawn, before screen-space overlays
    world(ctx, W, H, cam, z, t) {
      if (!V.settings.fx) return;
      motes(ctx, W, H, cam, z, t);
      if (canFilter) bloom(ctx);
    },
    grain(ctx, t) { if (V.settings.fx) grain(ctx, t); },
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
