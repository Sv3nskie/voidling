// Voidling energy effects, in the style of painted sci-fi VFX: crackling lightning, comet-like
// plasma streaks with flowing wisps, star flares, orbit rings and fire tongues. Everything is
// drawn with additive light in three layers (soft colored glow, bright body, white-hot core)
// and re-shaped every frame, so it flickers and flows instead of sitting still.
(() => {
  const V = window.V, TAU = Math.PI * 2;
  const hex6 = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#ffffff');
  const X = (V.vfx = {});

  const strokePts = (ctx, pts) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };

  // ---------- Lightning ----------
  // Jagged path between two points, bulging most in the middle
  X.boltPath = (x1, y1, x2, y2, rough = 0.22, segs = 8) => {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const pts = [[x1, y1]];
    for (let i = 1; i < segs; i++) {
      const k = i / segs, off = (Math.random() - 0.5) * 2 * rough * len * Math.sin(k * Math.PI);
      pts.push([x1 + dx * k + nx * off, y1 + dy * k + ny * off]);
    }
    pts.push([x2, y2]);
    return pts;
  };
  // Glow, colored body, white core
  X.drawBolt = (ctx, pts, color, w = 2, a = 1) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = a * 0.2; ctx.lineWidth = w * 5; strokePts(ctx, pts);
    ctx.globalAlpha = a * 0.85; ctx.lineWidth = w * 1.6; strokePts(ctx, pts);
    ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = a; ctx.lineWidth = Math.max(0.6, w * 0.55); strokePts(ctx, pts);
    ctx.restore();
  };
  // A lightning arc with forks
  X.lightning = (ctx, x1, y1, x2, y2, color, w = 2, a = 1, forks = 2) => {
    const pts = X.boltPath(x1, y1, x2, y2, 0.24, 9);
    X.drawBolt(ctx, pts, color, w, a);
    const len = Math.hypot(x2 - x1, y2 - y1), base = Math.atan2(y2 - y1, x2 - x1);
    for (let b = 0; b < forks; b++) {
      const [bx, by] = pts[2 + Math.floor(Math.random() * (pts.length - 4))];
      const ang = base + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), bl = len * (0.2 + Math.random() * 0.25);
      X.drawBolt(ctx, X.boltPath(bx, by, bx + Math.cos(ang) * bl, by + Math.sin(ang) * bl, 0.3, 4), color, w * 0.6, a * 0.8);
    }
  };

  // ---------- Star flare (the bright four-point burst at a muzzle or an impact) ----------
  X.flare = (ctx, x, y, r, color, rot = 0, a = 1, spikes = 4) => {
    color = hex6(color);
    V.drawGlow(ctx, x, y, r * 0.9, color, 0.8 * a);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.globalAlpha = a;
    for (let i = 0; i < spikes * 2; i++) {
      const long = i % 2 === 0, L = long ? r : r * 0.45, W = r * (long ? 0.085 : 0.05);
      ctx.save();
      ctx.rotate(i * Math.PI / spikes);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, -W); ctx.lineTo(L, 0); ctx.lineTo(0, W); ctx.lineTo(-W, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, -W * 0.4); ctx.lineTo(L * 0.7, 0); ctx.lineTo(0, W * 0.4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.13, 0, TAU); ctx.fill();
    ctx.restore();
  };

  // ---------- Orbit ring (an energy ellipse around a beam, or around your feet) ----------
  // The near half is brighter than the far half, so it reads as a ring in 3D
  X.orbit = (ctx, x, y, rx, ry, rot, color, a = 1, w = 2) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.strokeStyle = color; ctx.lineCap = 'round';
    for (const [a0, a1, k] of [[Math.PI, TAU, 0.45], [0, Math.PI, 1]]) {
      ctx.globalAlpha = a * k * 0.25; ctx.lineWidth = w * 3.5;
      ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0.1, rx), Math.max(0.1, ry), 0, a0, a1); ctx.stroke();
      ctx.globalAlpha = a * k; ctx.lineWidth = w;
      ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0.1, rx), Math.max(0.1, ry), 0, a0, a1); ctx.stroke();
    }
    ctx.restore();
  };

  // ---------- Plasma streak (a shot with a comet tail) ----------
  // Head at x, y moving along (ux, uy); the tail thins, waves and trails wisps and sparks.
  // style: { color, light, len, w, wisps, zap }
  X.streak = (ctx, x, y, ux, uy, t, seed, s) => {
    const color = hex6(s.color), light = hex6(s.light || '#ffffff'), len = s.len, w = s.w, N = 12;
    const nx = -uy, ny = ux, C = [], Wd = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N, wob = Math.sin(k * 6.5 - t * 26 + seed) * w * 1.1 * k;
      C.push([x - ux * len * k + nx * wob, y - uy * len * k + ny * wob]);
      Wd.push(w * Math.pow(1 - k, 0.75) * (1 + 0.18 * Math.sin(t * 45 + i * 1.7 + seed)));
    }
    // Ribbon along the path; the head end is rounded off so it never looks cut
    const ribbon = sc => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) ctx.lineTo(C[i][0] + nx * Wd[i] * sc, C[i][1] + ny * Wd[i] * sc);
      for (let i = N; i >= 0; i--) ctx.lineTo(C[i][0] - nx * Wd[i] * sc, C[i][1] - ny * Wd[i] * sc);
      ctx.arc(x, y, Wd[0] * sc, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false); // round cap ahead of the head
      ctx.closePath(); ctx.fill();
    };
    // Soft glow: round light sprites along the front of the tail, fading toward its end
    for (let i = 0; i <= N * 0.7; i += 2) V.drawGlow(ctx, C[i][0], C[i][1], w * (3.4 - i * 0.22), color, 0.32 * (1 - i / N));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const along = (stops) => {
      const g = ctx.createLinearGradient(x + ux * w, y + uy * w, x - ux * len, y - uy * len);
      stops.forEach(([k, c]) => g.addColorStop(k, c));
      return g;
    };
    ctx.globalAlpha = 0.5; ctx.fillStyle = along([[0, light], [0.4, color + 'aa'], [1, color + '00']]); ribbon(1.7);
    ctx.globalAlpha = 0.9; ctx.fillStyle = along([[0, light], [0.25, color + 'ee'], [0.65, color + '88'], [1, color + '00']]); ribbon(1);
    ctx.globalAlpha = 1; ctx.fillStyle = along([[0, '#ffffff'], [0.22, '#ffffff99'], [0.45, '#ffffff00']]); ribbon(0.36);
    // Wisps curling around the tail
    ctx.strokeStyle = light; ctx.lineWidth = Math.max(0.7, w * 0.22); ctx.lineCap = 'round';
    for (let k = 0; k < (s.wisps || 2); k++) {
      const side = k % 2 ? 1 : -1, ph = seed + k * 2.1;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let i = 1; i <= N; i++) {
        const off = side * Wd[Math.max(0, i - 2)] * (1.3 + 0.6 * Math.sin(i * 0.9 - t * 30 + ph));
        const px = C[i][0] + nx * off, py = C[i][1] + ny * off;
        i === 1 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Sparks shed along the tail
    ctx.fillStyle = light;
    for (let k = 0; k < 4; k++) {
      const f = ((t * 3 + k * 0.27 + seed * 0.1) % 1), i = Math.floor(f * N), side = Math.sin(seed * 9 + k * 4) * 2.2;
      ctx.globalAlpha = 0.9 * (1 - f);
      ctx.beginPath(); ctx.arc(C[i][0] + nx * Wd[i] * side, C[i][1] + ny * Wd[i] * side, Math.max(0.6, w * 0.16), 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (s.zap && Math.random() < 0.6) { // little arcs crackling off the head
      const ang = Math.atan2(uy, ux) + Math.PI + (Math.random() - 0.5) * 2.2, d = len * (0.25 + Math.random() * 0.3);
      X.drawBolt(ctx, X.boltPath(x, y, x + Math.cos(ang) * d, y + Math.sin(ang) * d, 0.35, 4), color, w * 0.25, 0.8);
    }
    V.drawGlow(ctx, x, y, w * 3.2, color, 0.85);
  };

  // ---------- Fire tongue (one flickering flame pointing along ang) ----------
  X.flame = (ctx, x, y, ang, len, w, t, seed, a = 1) => {
    const flick = 1 + 0.18 * Math.sin(t * 34 + seed), tipY = Math.sin(t * 22 + seed * 3) * w * 0.7, L = len * flick;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.translate(x, y); ctx.rotate(ang);
    const g = ctx.createRadialGradient(L * 0.12, 0, 0, L * 0.25, 0, L * 0.85);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.25, '#ffe066'); g.addColorStop(0.55, '#ff8a1a'); g.addColorStop(1, 'rgba(255,40,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.5);
    ctx.bezierCurveTo(L * 0.35, -w * 1.1, L * 0.7, -w * 0.4 + tipY * 0.5, L, tipY);
    ctx.bezierCurveTo(L * 0.7, w * 0.5 + tipY * 0.5, L * 0.35, w * 1.1, 0, w * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };
})();
