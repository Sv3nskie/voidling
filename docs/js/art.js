// Voidling art: sky background, pre-rendered island and planet sprites
(() => {
  const V = window.V;

  // ---------- Palettes taken from the purple-sunset space references ----------
  V.ISLAND_PALS = [
    { rockTop: '#7a4a5a', rockBot: '#2c1530', top: '#c8a2ff', topHi: '#ecd9ff', gem: '#5fe3ff' }, // lavender
    { rockTop: '#6b4a3a', rockBot: '#2a1622', top: '#7ee08a', topHi: '#c6ffb8', gem: '#5fe3ff' }, // moss
    { rockTop: '#4c4a7a', rockBot: '#1d1840', top: '#8ff0ff', topHi: '#e0fdff', gem: '#b98cff' }, // frost
    { rockTop: '#8a4a3a', rockBot: '#3a1420', top: '#ff9a6a', topHi: '#ffd2b0', gem: '#ff4f7a' }, // ember
  ];
  V.PLANET_PALS = [
    { light: '#f0c6ff', base: '#a764e0', dark: '#3b1466', atmo: '#c78bff' }, // violet
    { light: '#a8f4ff', base: '#3a9fe0', dark: '#122a66', atmo: '#6fd6ff' }, // ocean
    { light: '#ffc0e4', base: '#e0489e', dark: '#4f103e', atmo: '#ff7fc8' }, // rose
    { light: '#ffe08a', base: '#ff8a2a', dark: '#7a2410', atmo: '#ffb066' }, // lava
    { light: '#d0ffe8', base: '#3fd1a0', dark: '#0f4a45', atmo: '#7fffd0' }, // mint
  ];

  // ---------- Island sprite: low-poly floating rock with a grassy cap ----------
  V.makeIslandSprite = (w, depth, seed, pal, ppu) => {
    const rnd = V.rng(seed);
    ppu = Math.min(ppu, 1600 / (w * 1.1));
    const padX = w * 0.05, padTop = w * 0.09;
    const c = document.createElement('canvas');
    c.width = Math.max(8, Math.ceil((w + padX * 2) * ppu));
    c.height = Math.max(8, Math.ceil((depth + padTop + w * 0.04) * ppu));
    const g = c.getContext('2d');
    g.scale(ppu, ppu);
    g.translate(padX, padTop);

    // Rock silhouette: flat top, jagged tapering underside
    const pts = [[-w * 0.01, 0], [w * 1.01, 0]];
    const n = 7;
    for (let i = 1; i < n; i++) {
      const t = 1 - i / n;
      const x = w * t + (rnd() - 0.5) * w * 0.06;
      const bell = Math.sin(t * Math.PI);
      const y = depth * (0.25 + 0.75 * Math.pow(bell, 0.7)) * (0.75 + rnd() * 0.25);
      pts.push([x, y]);
    }
    const rock = new Path2D();
    rock.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) rock.lineTo(x, y);
    rock.closePath();

    const grad = g.createLinearGradient(0, 0, 0, depth);
    grad.addColorStop(0, pal.rockTop);
    grad.addColorStop(1, pal.rockBot);
    g.fillStyle = grad;
    g.fill(rock);

    // Facets for the hand-painted low-poly look
    g.save();
    g.clip(rock);
    for (let i = 0; i < 9; i++) {
      const x = rnd() * w, y = rnd() * depth * 0.8;
      const s = w * (0.12 + rnd() * 0.18);
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,220,240,0.07)' : 'rgba(10,0,25,0.18)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + s, y + s * (0.3 + rnd() * 0.5));
      g.lineTo(x + s * (rnd() - 0.3), y + s * (0.8 + rnd() * 0.6));
      g.closePath();
      g.fill();
    }
    // Shadow under the cap
    const sh = g.createLinearGradient(0, 0, 0, depth * 0.3);
    sh.addColorStop(0, 'rgba(10,0,25,0.45)');
    sh.addColorStop(1, 'rgba(10,0,25,0)');
    g.fillStyle = sh;
    g.fillRect(-w * 0.1, 0, w * 1.2, depth * 0.3);
    g.restore();

    // Embedded crystals on the rock face
    const gems = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < gems; i++) {
      const gx = w * (0.15 + rnd() * 0.7), gy = depth * (0.25 + rnd() * 0.2), gs = w * 0.045 * (0.8 + rnd() * 0.6);
      V.drawGlow(g, gx, gy, gs * 3, pal.gem, 0.55);
      g.fillStyle = pal.gem;
      g.beginPath();
      g.moveTo(gx, gy - gs); g.lineTo(gx + gs * 0.75, gy - gs * 0.2); g.lineTo(gx + gs * 0.5, gy + gs * 0.8);
      g.lineTo(gx - gs * 0.5, gy + gs * 0.8); g.lineTo(gx - gs * 0.75, gy - gs * 0.2);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.moveTo(gx, gy - gs); g.lineTo(gx + gs * 0.3, gy - gs * 0.1); g.lineTo(gx - gs * 0.4, gy - gs * 0.1);
      g.closePath();
      g.fill();
    }

    // Grass / frost cap with drips
    const capH = Math.min(w * 0.07, depth * 0.22);
    g.fillStyle = pal.top;
    g.beginPath();
    g.roundRect(-w * 0.025, -capH * 0.55, w * 1.05, capH * 1.25, capH * 0.6);
    g.fill();
    const drips = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < drips; i++) {
      const dx = w * (0.08 + rnd() * 0.84), dr = capH * (0.35 + rnd() * 0.4);
      g.beginPath();
      g.ellipse(dx, capH * 0.6, dr, dr * 1.3, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = pal.topHi;
    g.beginPath();
    g.roundRect(w * 0.02, -capH * 0.45, w * 0.96, capH * 0.32, capH * 0.16);
    g.fill();
    return { canvas: c, ox: padX, oy: padTop, sw: w + padX * 2, sh: c.height / ppu };
  };

  // ---------- Planet sprite: shaded sphere with bands, craters and an atmosphere ----------
  V.makePlanetSprite = (R, seed, pal, ppu) => {
    const rnd = V.rng(seed);
    ppu = Math.min(ppu, 1400 / (R * 2.7));
    const ext = R * 1.35;
    const c = document.createElement('canvas');
    c.width = c.height = Math.max(8, Math.ceil(ext * 2 * ppu));
    const g = c.getContext('2d');
    g.scale(ppu, ppu);
    g.translate(ext, ext);

    const atmo = g.createRadialGradient(0, 0, R * 0.95, 0, 0, ext);
    atmo.addColorStop(0, pal.atmo + '66');
    atmo.addColorStop(1, pal.atmo + '00');
    g.fillStyle = atmo;
    g.beginPath(); g.arc(0, 0, ext, 0, Math.PI * 2); g.fill();

    const body = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
    body.addColorStop(0, pal.light);
    body.addColorStop(0.55, pal.base);
    body.addColorStop(1, pal.dark);
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();

    g.save();
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip();
    if (rnd() < 0.55) {
      const bands = 4 + Math.floor(rnd() * 4);
      for (let i = 0; i < bands; i++) {
        const y = -R + (i + 0.5) * (2 * R / bands) + (rnd() - 0.5) * R * 0.1;
        g.strokeStyle = (rnd() < 0.5 ? pal.light : pal.dark) + '40';
        g.lineWidth = R * (0.06 + rnd() * 0.12);
        g.beginPath();
        for (let x = -R; x <= R; x += R / 8) g.lineTo(x, y + Math.sin(x / R * 4 + i) * R * 0.05);
        g.stroke();
      }
    } else {
      const craters = 4 + Math.floor(rnd() * 6);
      for (let i = 0; i < craters; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * R * 0.8, cr = R * (0.06 + rnd() * 0.14);
        const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
        g.fillStyle = pal.dark + '55';
        g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill();
        g.strokeStyle = pal.light + '44';
        g.lineWidth = cr * 0.2;
        g.beginPath(); g.arc(cx, cy, cr, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      }
    }
    // Night side
    const shade = g.createRadialGradient(-R * 0.45, -R * 0.45, R * 0.2, -R * 0.2, -R * 0.2, R * 1.5);
    shade.addColorStop(0, 'rgba(10,0,30,0)');
    shade.addColorStop(1, 'rgba(10,0,30,0.65)');
    g.fillStyle = shade;
    g.fillRect(-R, -R, R * 2, R * 2);
    g.restore();

    g.strokeStyle = pal.light + 'aa';
    g.lineWidth = R * 0.03;
    g.beginPath(); g.arc(0, 0, R * 0.985, Math.PI * 1.05, Math.PI * 1.65); g.stroke();
    return { canvas: c, ext };
  };

  // ---------- Background: the sky changes with altitude, from canyon sunset to deep space ----------
  const SKIES = [
    ['#140832', '#4a1782', '#b23f86', '#f08a6a'], // canyon sunset
    ['#0f0730', '#331066', '#6b2a8f', '#b04a8a'], // floating isles
    ['#070418', '#170a3a', '#2a1260', '#4a1a6e'], // asteroid belt
    ['#06040e', '#1a0730', '#3a0a3e', '#123048'], // storm wall
    ['#020108', '#06041a', '#0e0a2a', '#1a1040'], // starfield
  ];

  V.Background = class {
    constructor() {
      this.px = 0; this.py = 0;
      this.stars = [];
      for (let i = 0; i < 300; i++) {
        this.stars.push({
          x: Math.random() * 1400, y: Math.random() * 1000,
          f: V.pick([0.03, 0.06, 0.12]),
          s: Math.random() < 0.08 ? 2.2 : V.rand(0.6, 1.5),
          p: Math.random() * 6.28,
          c: V.pick(['#ffffff', '#e6d6ff', '#c9f6ff', '#ffe7f3']),
        });
      }
      this.decor = [
        { x: 260, y: 150, R: 150, spr: V.makePlanetSprite(150, 7, V.PLANET_PALS[0], 1) },
        { x: 1250, y: 520, R: 70, spr: V.makePlanetSprite(70, 21, V.PLANET_PALS[1], 1) },
        { x: 1900, y: 260, R: 34, spr: V.makePlanetSprite(34, 5, V.PLANET_PALS[3], 1.5) },
        { x: 700, y: 1100, R: 110, spr: V.makePlanetSprite(110, 13, V.PLANET_PALS[2], 1) },
      ];
      this.canyons = [this.mesa(1700, 0.22, 11), this.mesa(1300, 0.13, 29)];
      this.dust = [];
      for (let i = 0; i < 22; i++) this.dust.push({ x: Math.random() * 1600, y: Math.random() * 1000, s: V.rand(3, 9), r: Math.random() * 6 });
    }
    mesa(tileW, heightFrac, seed) {
      const rnd = V.rng(seed), pts = [];
      let x = 0;
      while (x < tileW) {
        const w = 30 + rnd() * 110, h = 0.25 + rnd() * 0.75;
        pts.push([x, 1], [x + w * 0.12, 1 - h], [x + w * 0.88, 1 - h * (0.9 + rnd() * 0.1)], [x + w, 1]);
        x += w * (0.8 + rnd() * 0.3);
      }
      return { pts, tileW, heightFrac };
    }
    scroll(dx, dy) { this.px += dx; this.py += dy; }
    // alt = camera altitude in meters
    draw(ctx, W, H, t, alt) {
      const Z = V.ZONES;
      let i = 0;
      while (i + 1 < Z.length && alt >= Z[i + 1].at) i++;
      const k = i === 0 ? 1 : V.clamp((alt - Z[i].at) / 80, 0, 1);
      const from = SKIES[Math.max(0, i - 1)], to = SKIES[i];
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      [0, 0.45, 0.8, 1].forEach((s, j) => sky.addColorStop(s, V.mixHex(from[j], to[j], k)));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      const low = V.clamp(1 - alt / 160, 0, 1);
      if (low > 0) {
        const glow = ctx.createRadialGradient(W * 0.5, H * 1.05, 0, W * 0.5, H * 1.05, H * 0.9);
        glow.addColorStop(0, `rgba(255,140,120,${0.45 * low})`);
        glow.addColorStop(1, 'rgba(255,140,120,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
      }

      const wrap = (v, m) => ((v % m) + m) % m;
      const starA = 0.45 + 0.55 * V.clamp(alt / 300, 0, 1);
      for (const s of this.stars) {
        const x = wrap(s.x - this.px * s.f, 1400), y = wrap(s.y - this.py * s.f, 1000);
        ctx.globalAlpha = (0.55 + 0.45 * Math.sin(t * 2 + s.p)) * starA;
        ctx.fillStyle = s.c;
        for (let ox = x; ox < W; ox += 1400) for (let oy = y; oy < H; oy += 1000) ctx.fillRect(ox, oy, s.s, s.s);
      }
      ctx.globalAlpha = 1;

      // The Star at the top of the climb, growing as you get closer
      if (alt > 550) {
        const s = V.clamp((alt - 550) / 600, 0, 1);
        const sx = W * 0.5, sy = H * 0.1;
        V.drawGlow(ctx, sx, sy, 60 + s * 260, '#ffd86b', 0.25 + s * 0.5);
        V.drawGlow(ctx, sx, sy, 20 + s * 70, '#fff3b8', 0.6 + s * 0.4);
      }

      for (const d of this.decor) {
        const size = d.spr.ext * 2;
        const x = wrap(d.x - this.px * 0.015, 2400) - d.spr.ext;
        const y = wrap(d.y - this.py * 0.03, 1600) - 300;
        ctx.globalAlpha = 0.85;
        for (let ox = x; ox < W + size; ox += 2400) ctx.drawImage(d.spr.canvas, ox, y - d.spr.ext, size, size);
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = V.mixHex('#8a5a6a', '#2a1630', V.clamp(alt / 400, 0, 0.8));
      for (const p of this.dust) {
        const x = wrap(p.x - this.px * 0.35, 1600), y = wrap(p.y - this.py * 0.35 + Math.sin(t + p.r) * 6, 1000);
        for (let ox = x; ox < W; ox += 1600) {
          ctx.save();
          ctx.translate(ox, y * H / 1000);
          ctx.rotate(p.r + t * 0.2);
          ctx.beginPath();
          ctx.moveTo(-p.s, -p.s * 0.4); ctx.lineTo(p.s, -p.s * 0.5); ctx.lineTo(p.s * 0.3, p.s * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Canyon spires: only near the ground, they sink away as you climb
      const sink = alt * 9;
      if (sink < H * 0.5) {
        const cols = ['#8a2f78', '#4e1452'];
        this.canyons.forEach((cy, n) => {
          const f = n === 0 ? 0.12 : 0.3, hh = H * cy.heightFrac, base = H + sink * (n === 0 ? 0.6 : 1);
          const off = wrap(this.px * f, cy.tileW);
          ctx.fillStyle = cols[n];
          for (let ox = -off; ox < W; ox += cy.tileW) {
            ctx.beginPath();
            ctx.moveTo(ox, base);
            for (const [px, py] of cy.pts) ctx.lineTo(ox + px, base - hh + py * hh);
            ctx.lineTo(ox + cy.tileW, base);
            ctx.closePath();
            ctx.fill();
          }
        });
      }
    }
  };
})();
