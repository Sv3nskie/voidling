// Voidling entity drawing. All functions draw in world units (ctx already scaled by zoom).
(() => {
  const V = window.V;
  const TAU = Math.PI * 2;

  const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };

  V.drawFood = (ctx, f, t) => {
    const { x, a } = f;
    const y = f.y + Math.sin(t * 2.4 + f.phase) * a * 0.25;
    if (f.type === 'coin') {
      V.drawGlow(ctx, x, y, a * 2.4, '#ffcc4d', 0.35);
      const sx = Math.abs(Math.cos(t * 3 + f.phase)) * 0.85 + 0.15;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sx, 1);
      ctx.fillStyle = '#b8741a'; circle(ctx, 0, 0, a); ctx.fill();
      ctx.fillStyle = '#ffcc4d'; circle(ctx, 0, -a * 0.06, a * 0.86); ctx.fill();
      ctx.fillStyle = '#ffe58a'; circle(ctx, 0, -a * 0.06, a * 0.55); ctx.fill();
      ctx.fillStyle = '#e09a2a'; ctx.fillRect(-a * 0.12, -a * 0.4, a * 0.24, a * 0.7);
      ctx.restore();
    } else if (f.type === 'crystal') {
      V.drawGlow(ctx, x, y, a * 2.6, '#5fe3ff', 0.5);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t + f.phase) * 0.15);
      const gr = ctx.createLinearGradient(-a, -a, a, a);
      gr.addColorStop(0, '#c9fbff'); gr.addColorStop(0.5, '#5fe3ff'); gr.addColorStop(1, '#2a6fe0');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(0, -a); ctx.lineTo(a * 0.62, -a * 0.35); ctx.lineTo(a * 0.62, a * 0.45);
      ctx.lineTo(0, a); ctx.lineTo(-a * 0.62, a * 0.45); ctx.lineTo(-a * 0.62, -a * 0.35);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.moveTo(0, -a); ctx.lineTo(a * 0.2, -a * 0.2); ctx.lineTo(-a * 0.62, -a * 0.35); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (f.type === 'star') {
      V.drawGlow(ctx, x, y, a * 3.2, '#ffd86b', 0.6);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 0.8 + f.phase);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? a * 0.45 : a, ang = i * TAU / 10 - Math.PI / 2;
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff3b8'; circle(ctx, 0, 0, a * 0.25); ctx.fill();
      ctx.restore();
    } else { // ruby
      V.drawGlow(ctx, x, y, a * 2.8, '#ff4f7a', 0.6);
      ctx.fillStyle = '#ff2f5f';
      ctx.beginPath(); ctx.moveTo(x, y - a); ctx.lineTo(x + a * 0.8, y); ctx.lineTo(x, y + a); ctx.lineTo(x - a * 0.8, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd0dc'; circle(ctx, x - a * 0.15, y - a * 0.25, a * 0.2); ctx.fill();
    }
  };

  const dangerAura = (ctx, x, y, a, t) => V.drawGlow(ctx, x, y, a * 2.4, '#ff2050', 0.45 + 0.25 * Math.sin(t * 8));

  V.drawWalker = (ctx, e, t, danger) => {
    const { x, y, a } = e;
    if (danger) dangerAura(ctx, x, y, a, t);
    const bob = Math.abs(Math.sin(t * 9 + e.phase)) * a * 0.12;
    ctx.save();
    ctx.translate(x, y - bob);
    ctx.scale(e.dir, 1);
    ctx.strokeStyle = e.color; ctx.lineWidth = a * 0.12; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { // antennae
      ctx.beginPath(); ctx.moveTo(s * a * 0.3, -a * 0.6); ctx.quadraticCurveTo(s * a * 0.5, -a * 1.2, s * a * 0.25, -a * 1.35); ctx.stroke();
      V.drawGlow(ctx, s * a * 0.25, -a * 1.35, a * 0.5, '#fff3b8', 0.8);
    }
    if (e.spikes) { // spiky back: can't be stomped
      ctx.fillStyle = '#ff3d6e';
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI * (0.85 - i * 0.175);
        const bx = Math.cos(ang) * a * 0.8, by = Math.sin(ang) * a * 0.7;
        ctx.beginPath();
        ctx.moveTo(bx - Math.sin(ang) * a * 0.18, by + Math.cos(ang) * a * 0.18);
        ctx.lineTo(bx + Math.cos(ang) * a * 0.55, by + Math.sin(ang) * a * 0.55);
        ctx.lineTo(bx + Math.sin(ang) * a * 0.18, by - Math.cos(ang) * a * 0.18);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.ellipse(0, 0, a, a * 0.85, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.ellipse(-a * 0.3, -a * 0.35, a * 0.35, a * 0.2, -0.5, 0, TAU); ctx.fill();
    const eyes = e.eyes;
    for (let i = 0; i < eyes; i++) {
      const ex = (i - (eyes - 1) / 2) * a * 0.42 + a * 0.15, er = a * (eyes === 1 ? 0.34 : 0.22);
      ctx.fillStyle = '#ffffff'; circle(ctx, ex, -a * 0.15, er); ctx.fill();
      ctx.fillStyle = danger ? '#c4002f' : '#1a0b33'; circle(ctx, ex + er * 0.35, -a * 0.12, er * 0.5); ctx.fill();
    }
    ctx.fillStyle = '#2a0b2a';
    ctx.beginPath(); ctx.ellipse(a * 0.2, a * 0.35, a * 0.25, danger ? a * 0.16 : a * 0.08, 0, 0, TAU); ctx.fill();
    ctx.restore();
  };

  V.drawFlyer = (ctx, e, t, danger) => {
    const { x, y, a } = e;
    if (danger) dangerAura(ctx, x, y, a, t);
    V.drawGlow(ctx, x, y, a * 2.2, e.glow, 0.45);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = e.color; ctx.lineWidth = a * 0.1; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * a * 0.3, a * 0.1);
      for (let k = 1; k <= 4; k++) ctx.lineTo(i * a * 0.3 + Math.sin(t * 5 + k + i) * a * 0.15, a * 0.1 + k * a * 0.32);
      ctx.stroke();
    }
    ctx.fillStyle = e.color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(0, 0, a, Math.PI, 0); ctx.quadraticCurveTo(0, a * 0.35, -a, 0); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff'; circle(ctx, -a * 0.3, -a * 0.35, a * 0.18); ctx.fill(); circle(ctx, a * 0.3, -a * 0.35, a * 0.18); ctx.fill();
    ctx.fillStyle = danger ? '#c4002f' : '#1a0b33'; circle(ctx, -a * 0.3, -a * 0.32, a * 0.09); ctx.fill(); circle(ctx, a * 0.3, -a * 0.32, a * 0.09); ctx.fill();
    ctx.restore();
  };

  // Carnivorous alien plant (the big red maw), rooted on an island
  V.drawMaw = (ctx, e, t, danger) => {
    const { x, a } = e;
    const baseY = e.island.y;
    const hx = e.hx, hy = e.hy;
    ctx.strokeStyle = '#2f7a4a'; ctx.lineWidth = a * 0.28; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, baseY); ctx.quadraticCurveTo(x - a * 0.8, (baseY + hy) / 2, hx, hy + a * 0.6); ctx.stroke();
    ctx.fillStyle = '#3fa060';
    ctx.beginPath(); ctx.ellipse(x - a * 0.5, baseY - a * 0.3, a * 0.5, a * 0.18, -0.5, 0, TAU); ctx.fill();
    if (danger) dangerAura(ctx, hx, hy, a, t);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(e.lean * 0.4);
    const open = e.open;
    for (const s of [-1, 1]) { // two jaws
      ctx.save();
      ctx.rotate(s * open * 0.55);
      ctx.fillStyle = '#e0233f';
      ctx.beginPath(); ctx.ellipse(0, s * a * 0.25, a * 1.05, a * 0.55, 0, s < 0 ? Math.PI : 0, s < 0 ? TAU : Math.PI); ctx.fill();
      ctx.fillStyle = '#ff7a8f';
      for (let i = 0; i < 5; i++) { circle(ctx, -a * 0.6 + i * a * 0.3, s * a * 0.55, a * 0.06); ctx.fill(); }
      ctx.fillStyle = '#fff4e8';
      for (let i = 0; i < 5; i++) {
        const tx = -a * 0.7 + i * a * 0.33;
        ctx.beginPath(); ctx.moveTo(tx, s * a * 0.22); ctx.lineTo(tx + a * 0.12, s * a * 0.22); ctx.lineTo(tx + a * 0.06, -s * a * 0.08); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = '#ffd23f';
    circle(ctx, a * 0.55, -a * 0.25 - open * a * 0.3, a * 0.1); ctx.fill();
    ctx.restore();
  };

  V.drawSaucer = (ctx, e, t, danger) => {
    const { x, y, a } = e;
    if (danger) dangerAura(ctx, x, y, a, t);
    V.drawGlow(ctx, x, y + a * 0.6, a * 2, '#5fe3ff', 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(V.clamp(e.vx / (a * 20), -0.3, 0.3));
    ctx.fillStyle = 'rgba(160,240,255,0.55)';
    ctx.beginPath(); ctx.ellipse(0, -a * 0.25, a * 0.55, a * 0.5, 0, Math.PI, TAU); ctx.fill();
    const body = ctx.createLinearGradient(0, -a * 0.3, 0, a * 0.35);
    body.addColorStop(0, '#f0ecff'); body.addColorStop(1, '#7a76a8');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, a * 1.2, a * 0.36, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const on = Math.floor(t * 6 + i) % 2 === 0;
      ctx.fillStyle = on ? '#ff4f7a' : '#5fe3ff';
      circle(ctx, -a * 0.8 + i * a * 0.4, a * 0.05, a * 0.08); ctx.fill();
    }
    ctx.restore();
  };

  V.drawBullet = (ctx, b) => {
    V.drawGlow(ctx, b.x, b.y, b.a * 3, '#ff4f7a', 0.9);
    ctx.fillStyle = '#ffe0ea';
    circle(ctx, b.x, b.y, b.a * 0.6); ctx.fill();
  };

  // Hostile flyer: a little void bat that swoops at you
  V.drawBat = (ctx, e, t) => {
    const { x, y, a } = e;
    const flap = Math.sin(t * 14 + e.phase);
    V.drawGlow(ctx, x, y, a * 2, '#ff2050', e.swoopT > 0 ? 0.55 : 0.25);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#4a1a6e';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * a * 0.5, -a * 0.1);
      ctx.lineTo(s * a * 1.9, -a * (0.6 + flap * 0.6));
      ctx.lineTo(s * a * 1.4, a * 0.1);
      ctx.lineTo(s * a * 1.7, a * (0.2 - flap * 0.3));
      ctx.lineTo(s * a * 0.6, a * 0.4);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#2a0f40';
    circle(ctx, 0, 0, a * 0.8); ctx.fill();
    ctx.fillStyle = '#ff3d6e';
    for (const s of [-1, 1]) { circle(ctx, s * a * 0.3, -a * 0.12, a * 0.16); ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * a * 0.22, a * 0.3); ctx.lineTo(s * a * 0.1, a * 0.3); ctx.lineTo(s * a * 0.16, a * 0.52); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  V.drawHeart = (ctx, x, y, s, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.fillStyle = '#ff4f7a';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    ctx.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.7, -s * 1.1, 0, -s * 0.4);
    ctx.bezierCurveTo(s * 0.7, -s * 1.1, s * 1.4, -s * 0.1, 0, s * 0.9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(-s * 0.42, -s * 0.38, s * 0.22, s * 0.14, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
  };

  // Checkpoint crystal at the start of each zone
  V.drawBeacon = (ctx, x, y, lit, t) => {
    if (lit) {
      const beam = ctx.createLinearGradient(0, y - 260, 0, y);
      beam.addColorStop(0, 'rgba(95,227,255,0)');
      beam.addColorStop(1, 'rgba(95,227,255,0.28)');
      ctx.fillStyle = beam;
      ctx.fillRect(x - 10, y - 260, 20, 260);
      V.drawGlow(ctx, x, y - 34, 70 + Math.sin(t * 3) * 6, '#5fe3ff', 0.8);
    } else {
      V.drawGlow(ctx, x, y - 34, 34, '#b98cff', 0.35 + 0.2 * Math.sin(t * 4));
    }
    ctx.fillStyle = '#2a1a40';
    ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 9, y - 14); ctx.lineTo(x + 9, y - 14); ctx.lineTo(x + 14, y); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(x - 10, y - 60, x + 10, y - 14);
    g.addColorStop(0, lit ? '#e0fdff' : '#8c7ab0');
    g.addColorStop(1, lit ? '#2aa8e0' : '#3a2a5a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - 62); ctx.lineTo(x + 11, y - 46); ctx.lineTo(x + 8, y - 16); ctx.lineTo(x - 8, y - 16); ctx.lineTo(x - 11, y - 46);
    ctx.closePath(); ctx.fill();
  };

  // A strip of red crystal spikes along the top of a platform
  V.drawSpikes = (ctx, x0, x1, y, t) => {
    const n = Math.max(1, Math.floor((x1 - x0) / 9));
    const w = (x1 - x0) / n;
    V.drawGlow(ctx, (x0 + x1) / 2, y - 4, (x1 - x0) * 0.6, '#ff2050', 0.25 + 0.1 * Math.sin(t * 5));
    for (let i = 0; i < n; i++) {
      const sx = x0 + i * w, h = 11 + (i % 2) * 3;
      ctx.fillStyle = '#c41e4a';
      ctx.beginPath(); ctx.moveTo(sx, y + 1); ctx.lineTo(sx + w / 2, y - h); ctx.lineTo(sx + w, y + 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff7a9a';
      ctx.beginPath(); ctx.moveTo(sx + w * 0.3, y - h * 0.4); ctx.lineTo(sx + w / 2, y - h); ctx.lineTo(sx + w * 0.55, y - h * 0.3); ctx.closePath(); ctx.fill();
    }
  };

  // The rising Void: a dark tide with a glowing edge and eyes that open and close
  // surge 0..1: how hard the Void is surging right now (bigger waves, red edge, tendrils)
  V.drawVoid = (ctx, vy, x0, x1, y1, t, frozen = false, surge = 0) => {
    if (vy > y1 + 40) return;
    const amp = 1 + surge * 1.6, speed = 1 + surge * 1.5;
    const wave = x => vy + (Math.sin(x * 0.03 + t * 2 * speed) * 7 + Math.sin(x * 0.011 - t * 1.3 * speed) * 11) * amp;
    if (surge > 0.05) {
      // Tendrils reaching up out of the Void
      for (let gx = Math.floor(x0 / 70) * 70; gx < x1 + 70; gx += 70) {
        const h = Math.abs(Math.sin(gx * 78.233) * 43758.5453) % 1;
        const len = (25 + h * 70) * surge * (0.55 + 0.45 * Math.sin(t * 5 + h * 12));
        const bx = gx + h * 40, by = wave(bx) + 4;
        ctx.fillStyle = '#14061f';
        ctx.beginPath();
        ctx.moveTo(bx - 9, by);
        ctx.quadraticCurveTo(bx + Math.sin(t * 3 + h * 9) * 14, by - len * 0.6, bx + Math.sin(t * 4 + h * 5) * 8, by - len);
        ctx.quadraticCurveTo(bx + 4, by - len * 0.4, bx + 9, by);
        ctx.closePath(); ctx.fill();
        V.drawGlow(ctx, bx, by - len, 10, '#ff2050', 0.5 * surge);
      }
      for (let x = x0; x <= x1; x += 60) V.drawGlow(ctx, x, wave(x), 46, '#ff2050', 0.28 * surge);
    }
    const grad = ctx.createLinearGradient(0, vy - 40, 0, vy + 260);
    grad.addColorStop(0, 'rgba(138,77,255,0)');
    grad.addColorStop(0.12, 'rgba(138,77,255,0.5)');
    grad.addColorStop(0.22, '#14061f');
    grad.addColorStop(1, '#030106');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0 - 20, Math.max(y1, vy) + 400);
    for (let x = x0 - 20; x <= x1 + 20; x += 16) ctx.lineTo(x, wave(x));
    ctx.lineTo(x1 + 20, Math.max(y1, vy) + 400);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = frozen ? 'rgba(160,240,255,0.95)'
      : `rgba(${Math.round(200 + 55 * surge)},${Math.round(160 - 90 * surge)},${Math.round(255 - 125 * surge)},0.9)`;
    ctx.lineWidth = frozen ? 5 : 3 + surge * 2;
    ctx.beginPath();
    for (let x = x0 - 20; x <= x1 + 20; x += 16) ctx.lineTo(x, wave(x));
    ctx.stroke();
    for (let gx = Math.floor(x0 / 140) * 140; gx < x1; gx += 140) {
      const h = Math.abs(Math.sin(gx * 12.9898) * 43758.5453) % 1;
      const open = surge > 0.5 ? 1 : Math.sin(t * 0.8 + h * 20); // all eyes open during a surge
      if (h < 0.35 || open < 0.2) continue;
      const ex = gx + h * 90, ey = vy + 70 + h * 120, s = 1 + h;
      for (const d of [-1, 1]) {
        V.drawGlow(ctx, ex + d * 9 * s, ey, 10 * s, '#ff2050', 0.7);
        ctx.fillStyle = '#ffd0dc';
        ctx.beginPath(); ctx.ellipse(ex + d * 9 * s, ey, 3.5 * s, 3.5 * s * Math.min(1, (open - 0.2) * 3), 0, 0, TAU); ctx.fill();
      }
    }
  };

  // The Voidling: a scrap of living void with a violet rim and big curious eyes
  V.drawPlayer = (ctx, P, t) => {
    const r = P.r;
    if (P.inv > 0 && Math.floor(t * 20) % 2 === 0) return;
    V.drawGlow(ctx, P.x, P.y, r * 2.6, '#8a4dff', 0.55);
    ctx.save();
    ctx.translate(P.x, P.y);
    const sq = P.squash;
    ctx.scale(1 + sq, 1 - sq);
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    body.addColorStop(0, '#2a1450'); body.addColorStop(0.7, '#0d0620'); body.addColorStop(1, '#05020c');
    ctx.fillStyle = body;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) { // wobbly edge
      const ang = i / 48 * TAU, wob = 1 + Math.sin(ang * 5 + t * 6) * 0.03;
      ctx.lineTo(Math.cos(ang) * r * wob, Math.sin(ang) * r * wob);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#b98cff'; ctx.lineWidth = r * 0.07; ctx.stroke();
    // Tiny stars inside the void
    ctx.fillStyle = 'rgba(230,214,255,0.8)';
    for (let i = 0; i < 5; i++) {
      const ang = i * 2.4 + t * 0.3, d = r * (0.3 + (i % 3) * 0.18);
      ctx.fillRect(Math.cos(ang) * d, Math.sin(ang) * d + r * 0.2, r * 0.05, r * 0.05);
    }
    const f = P.face, blink = (Math.sin(t * 1.3) > 0.985) ? 0.15 : 1;
    for (const s of [-1, 1]) {
      const ex = f * r * 0.22 + s * r * 0.3, ey = -r * 0.2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.2, r * 0.26 * blink, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a0b33';
      ctx.beginPath(); ctx.ellipse(ex + P.lookX * r * 0.08, ey + P.lookY * r * 0.08, r * 0.1, r * 0.13 * blink, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; circle(ctx, ex + P.lookX * r * 0.08 - r * 0.04, ey - r * 0.06, r * 0.035); ctx.fill();
    }
    const m = P.mouth;
    const mx = f * r * 0.25, my = r * 0.28;
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath(); ctx.ellipse(mx, my, r * (0.16 + m * 0.18), r * (0.05 + m * 0.3), 0, 0, TAU); ctx.fill();
    if (m > 0.2) {
      ctx.fillStyle = '#05020c';
      ctx.beginPath(); ctx.ellipse(mx, my + r * 0.04, r * (0.1 + m * 0.14), r * (0.02 + m * 0.22), 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(mx + s * r * 0.12, my - r * (0.04 + m * 0.26)); ctx.lineTo(mx + s * r * 0.04, my - r * (0.04 + m * 0.26)); ctx.lineTo(mx + s * r * 0.08, my - r * (m * 0.12)); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  };
})();
