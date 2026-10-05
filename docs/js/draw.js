// Voidling entity drawing. All functions draw in world units (ctx already scaled by zoom).
(() => {
  const V = window.V;
  const TAU = Math.PI * 2;

  const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };

  V.drawFood = (ctx, f, t) => {
    const { x, a } = f;
    const y = f.y + Math.sin(t * 2.4 + f.phase) * a * 0.25;
    if (f.type === 'coin') {
      // A spinning gold coin: the face narrows as it turns and its thick edge shows beside it
      V.drawGlow(ctx, x, y, a * 2.2, '#ffcc4d', 0.3);
      const ang = t * 3 + f.phase, c = Math.cos(ang), fw = Math.max(0.1, Math.abs(c));
      if (V.art.has('coin')) { // your coin: its own frames spin it, a single image gets turned
        const one = V.art.frames('coin') === 1;
        V.art.draw(ctx, 'coin', x, y, { h: a * 2.1, t: t + f.phase, sx: one ? fw : 1 });
        return;
      }
      ctx.fillStyle = '#9a5a12';
      ctx.beginPath(); ctx.ellipse(x + Math.sin(ang) * a * 0.17, y, Math.max(a * fw, a * 0.16), a * 0.98, 0, 0, TAU); ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(fw, 1);
      V.gloss.draw(ctx, V.gloss.coin(), 0, 0, a, 58);
      ctx.restore();
      const gl = (t * 0.7 + f.phase * 0.53) % 2.4; // now and then a glint flashes on the rim
      if (gl < 0.4) {
        const s = a * 1.5 * Math.sin(gl / 0.4 * Math.PI);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(V.gloss.star('#fff3b8'), x - a * 0.45 * fw - s, y - a * 0.5 - s, s * 2, s * 2);
        ctx.restore();
      }
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

  // Bounce light under each alien: a contrasting tint makes the gloss read on any color
  const rimFor = color => (color === '#ff8ad8' ? '#8ff0ff' : color === '#6bf0ff' ? '#ff9ad5' : '#ffd0f0');
  // ---------- Aliens: four species with legs and arms ----------
  // Each alien is always the same species (from its seed). Legs step with the distance it has
  // walked, arms swing against the legs and go up when you come close. Spiky ones carry red
  // crystal spikes on their back (those can't be stomped).
  const SPECIES = ['blob', 'bean', 'crab', 'squid'];
  const hexMix = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - k) + parseInt(b.substr(i, 2), 16) * k).toString(16).padStart(2, '0')).join('');
  const limb = (ctx, x0, y0, cx, cy, x1, y1, w, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
  };
  const blob = (ctx, color, x, y, rx, ry) => ctx.drawImage(V.gloss.dot(color), x - rx, y - ry, rx * 2, ry * 2);
  const bodyAt = (ctx, color, cx, cy, rx, ry) => {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(rx / ry, 1);
    V.gloss.draw(ctx, V.gloss.body(color, rimFor(color)), 0, 0, ry, 60);
    ctx.restore();
  };
  const crystalSpikes = (ctx, cx, cy, rx, ry, a) => {
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * (0.85 - i * 0.175), cs = Math.cos(ang), sn = Math.sin(ang);
      const bx = cx + cs * rx * 0.9, by = cy + sn * ry * 0.9, nx = -sn * a * 0.17, ny = cs * a * 0.17;
      const tipX = bx + cs * a * 0.6, tipY = by + sn * a * 0.6;
      ctx.fillStyle = '#c4123f';
      ctx.beginPath(); ctx.moveTo(bx + nx, by + ny); ctx.lineTo(tipX, tipY); ctx.lineTo(bx - nx, by - ny); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff8aa8';
      ctx.beginPath(); ctx.moveTo(bx + nx * 0.2, by + ny * 0.2); ctx.lineTo(tipX, tipY); ctx.lineTo(bx - nx, by - ny); ctx.closePath(); ctx.fill();
    }
  };
  const faceAt = (ctx, e, cx, cy, er, gap, look, danger, t, mouthY) => {
    const n = e.eyes, blink = Math.sin(t * 1.1 + e.phase * 3) > 0.97 ? 0.15 : 1;
    for (let i = 0; i < n; i++) {
      const ex = cx + (i - (n - 1) / 2) * gap;
      if (e.xeyes) { // knocked out
        ctx.strokeStyle = '#1a0b33'; ctx.lineWidth = er * 0.45; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ex - er * 0.6, cy - er * 0.6); ctx.lineTo(ex + er * 0.6, cy + er * 0.6);
        ctx.moveTo(ex + er * 0.6, cy - er * 0.6); ctx.lineTo(ex - er * 0.6, cy + er * 0.6); ctx.stroke();
      } else eye(ctx, ex, cy, er, er * blink, look[0], look[1], danger ? '#c4002f' : '#3a1a7a');
    }
    if (mouthY === undefined) return;
    ctx.fillStyle = '#2a0b2a';
    ctx.beginPath(); ctx.ellipse(cx + er * 0.3, mouthY, er * 1.0, danger || look[2] ? er * 0.6 : er * 0.3, 0, 0, TAU); ctx.fill();
    if (look[2]) { // close to you: a mouthful of little teeth
      ctx.fillStyle = '#fff4e8';
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx + er * (0.3 + k * 0.45) - er * 0.15, mouthY - er * 0.45); ctx.lineTo(cx + er * (0.3 + k * 0.45) + er * 0.15, mouthY - er * 0.45); ctx.lineTo(cx + er * (0.3 + k * 0.45), mouthY - er * 0.1); ctx.closePath(); ctx.fill(); }
    }
  };
  const SPECIES_DRAW = {
    // Round body on stubby legs with big feet, swinging arms with round hands, antennae
    blob(ctx, e, a, c, look, t, dk, ft) {
      const rb = a * 0.8, leg = a * 0.42, bob = Math.abs(Math.sin(c)) * a * 0.06, cy = -leg - rb * 0.9 - bob;
      for (const s of [-1, 1]) {
        const sw = Math.sin(c + (s > 0 ? 0 : Math.PI)), hx = s * a * 0.3, fx = hx + sw * a * 0.24, fy = -Math.max(0, Math.cos(c + (s > 0 ? 0 : Math.PI))) * a * 0.14;
        limb(ctx, hx, cy + rb * 0.6, hx + a * 0.12, (cy + fy) / 2 + a * 0.15, fx, fy - a * 0.06, a * 0.17, s < 0 ? hexMix(dk, '#000000', 0.25) : dk);
        blob(ctx, s < 0 ? hexMix(ft, '#000000', 0.25) : ft, fx + a * 0.07, fy - a * 0.05, a * 0.2, a * 0.12);
      }
      const arm = s => {
        const ang = look[2] ? -Math.PI / 2 - s * 0.55 + Math.sin(t * 12 + s) * 0.25 : Math.PI / 2 - s * 0.55 + Math.sin(c + (s > 0 ? Math.PI : 0)) * 0.45;
        const sx = s * rb * 0.82, sy = cy + rb * 0.05, hx = sx + Math.cos(ang) * a * 0.5, hy = sy + Math.sin(ang) * a * 0.5;
        limb(ctx, sx, sy, sx + Math.cos(ang - s * 0.6) * a * 0.3, sy + Math.sin(ang - s * 0.6) * a * 0.3, hx, hy, a * 0.13, s < 0 ? hexMix(dk, '#000000', 0.25) : dk);
        blob(ctx, s < 0 ? hexMix(ft, '#000000', 0.25) : ft, hx, hy, a * 0.15, a * 0.15);
      };
      arm(-1);
      ctx.strokeStyle = dk; ctx.lineWidth = a * 0.11; ctx.lineCap = 'round';
      const sway = Math.sin(t * 6 + e.phase) * a * 0.08;
      for (const s of [-1, 1]) { // antennae with shiny bulbs
        const tx = s * a * 0.25 + sway, ty = cy - rb - a * 0.55;
        ctx.beginPath(); ctx.moveTo(s * a * 0.28, cy - rb * 0.7); ctx.quadraticCurveTo(s * a * 0.48, cy - rb - a * 0.2, tx, ty); ctx.stroke();
        V.drawGlow(ctx, tx, ty, a * 0.5, '#fff3b8', 0.7);
        blob(ctx, '#fff3b8', tx, ty, a * 0.16, a * 0.16);
      }
      bodyAt(ctx, e.color, 0, cy, rb, rb * 0.92);
      return { cx: 0, cy, rx: rb, ry: rb * 0.92, eye: [a * 0.12, cy - rb * 0.15, a * (e.eyes === 1 ? 0.3 : 0.2), a * 0.38], mouth: cy + rb * 0.42, front: () => arm(1) };
    },
    // Tall bean on long thin legs, long arms, a sprout on top
    bean(ctx, e, a, c, look, t, dk, ft) {
      const rx = a * 0.56, ry = a * 0.88, leg = a * 0.5, bob = Math.abs(Math.sin(c)) * a * 0.05, cy = -leg - ry * 0.92 - bob;
      for (const s of [-1, 1]) {
        const sw = Math.sin(c + (s > 0 ? 0 : Math.PI)), hx = s * a * 0.2, fx = hx + sw * a * 0.3, fy = -Math.max(0, Math.cos(c + (s > 0 ? 0 : Math.PI))) * a * 0.16;
        limb(ctx, hx, cy + ry * 0.7, hx + a * 0.2, (cy + fy) / 2 + a * 0.2, fx, fy - a * 0.04, a * 0.11, s < 0 ? hexMix(dk, '#000000', 0.25) : dk);
        blob(ctx, s < 0 ? hexMix(ft, '#000000', 0.25) : ft, fx + a * 0.08, fy - a * 0.04, a * 0.17, a * 0.09);
      }
      const arm = s => {
        const ang = look[2] ? -Math.PI / 2 - s * 0.35 + Math.sin(t * 10 + s * 2) * 0.3 : Math.PI / 2 - s * 0.3 + Math.sin(c + (s > 0 ? Math.PI : 0)) * 0.5;
        const sx = s * rx * 0.85, sy = cy - ry * 0.05, hx = sx + Math.cos(ang) * a * 0.7, hy = sy + Math.sin(ang) * a * 0.7;
        limb(ctx, sx, sy, sx + Math.cos(ang - s * 0.5) * a * 0.42, sy + Math.sin(ang - s * 0.5) * a * 0.42, hx, hy, a * 0.1, s < 0 ? hexMix(dk, '#000000', 0.25) : dk);
        blob(ctx, s < 0 ? hexMix(ft, '#000000', 0.25) : ft, hx, hy, a * 0.13, a * 0.13);
      };
      arm(-1);
      // sprout: two leaves on a stalk, swaying
      const sw = Math.sin(t * 4 + e.phase) * 0.25, tx = Math.sin(sw) * a * 0.35, ty = cy - ry - a * 0.32;
      limb(ctx, 0, cy - ry * 0.85, tx * 0.3, cy - ry - a * 0.1, tx, ty, a * 0.08, dk);
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(s * 0.9 + sw);
        ctx.fillStyle = s < 0 ? '#5fd37a' : '#9dff6b';
        ctx.beginPath(); ctx.ellipse(s * a * 0.16, 0, a * 0.18, a * 0.08, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      bodyAt(ctx, e.color, 0, cy, rx, ry);
      return { cx: 0, cy, rx, ry, eye: [a * 0.1, cy - ry * 0.32, a * (e.eyes === 1 ? 0.28 : 0.18), a * 0.32], mouth: cy + ry * 0.15, front: () => arm(1) };
    },
    // Wide low shell on four scuttling legs, two snapping claws, eyes on stalks
    crab(ctx, e, a, c, look, t, dk, ft) {
      const rx = a * 1.0, ry = a * 0.55, cy = -a * 0.36 - ry * 0.85 - Math.abs(Math.sin(c * 2)) * a * 0.04;
      for (const [i, hx] of [-0.75, -0.35, 0.35, 0.75].entries()) {
        const s = Math.sign(hx), ph = c * 1.6 + i * Math.PI / 2, lift = Math.max(0, Math.sin(ph)) * a * 0.12;
        const bx = hx * rx, kx = bx + s * a * 0.3, fx = bx + s * a * 0.45 + Math.cos(ph) * a * 0.12;
        ctx.strokeStyle = i % 2 ? dk : hexMix(dk, '#000000', 0.25); ctx.lineWidth = a * 0.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(bx, cy + ry * 0.4); ctx.lineTo(kx, cy - a * 0.02 - lift); ctx.lineTo(fx, -lift * 0.3); ctx.stroke();
      }
      const open = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * (look[2] ? 14 : 5) + e.phase));
      const claw = s => {
        const sx = s * rx * 0.55 + a * 0.25, sy = cy - ry * 0.2, hx = sx + a * 0.45 + (s < 0 ? -a * 0.1 : 0), hy = sy - a * (look[2] ? 0.75 : 0.45);
        limb(ctx, sx, sy, sx + a * 0.4, sy + a * 0.1, hx, hy, a * 0.12, s < 0 ? hexMix(dk, '#000000', 0.25) : dk);
        const cc = s < 0 ? hexMix(e.color, '#000000', 0.2) : e.color;
        ctx.save(); ctx.translate(hx, hy);
        for (const j of [-1, 1]) { // two pincers opening and closing
          ctx.save(); ctx.rotate(-0.4 + j * open);
          bodyAt(ctx, cc, a * 0.2, 0, a * 0.24, a * 0.1);
          ctx.restore();
        }
        ctx.restore();
      };
      claw(-1);
      for (const s of [-1, 1]) { // eye stalks
        const ex = s * a * 0.28 + a * 0.15, ey = cy - ry - a * 0.42 + Math.sin(t * 5 + s) * a * 0.04;
        limb(ctx, s * a * 0.22 + a * 0.1, cy - ry * 0.6, ex - s * a * 0.05, cy - ry - a * 0.15, ex, ey, a * 0.09, dk);
      }
      bodyAt(ctx, e.color, 0, cy, rx, ry);
      return { cx: 0, cy, rx, ry, eye: null, stalks: [cy - ry - a * 0.42, a * 0.2], mouth: cy + ry * 0.3, front: () => claw(1) };
    },
    // A dome on wiggling tentacles; the two front tentacles reach out like arms
    squid(ctx, e, a, c, look, t, dk, ft) {
      const rh = a * 0.78, cy = -a * 0.55 - rh * 0.6 - Math.abs(Math.sin(c)) * a * 0.05;
      const tent = (i, n, reach) => {
        const u = (i / (n - 1)) * 2 - 1, bx = u * rh * 0.7, w = Math.sin(t * 7 + i * 1.3 + e.phase);
        const fx = bx + u * a * 0.25 + w * a * 0.12 + reach * a * 0.5, fy = reach ? cy - a * 0.1 : -a * 0.02;
        ctx.strokeStyle = i % 2 ? dk : hexMix(dk, '#000000', 0.2); ctx.lineWidth = a * 0.16; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx, cy + rh * 0.35);
        ctx.bezierCurveTo(bx + w * a * 0.2, cy + rh * 0.8, fx - w * a * 0.25, fy - a * 0.2, fx, fy); ctx.stroke();
        blob(ctx, ft, fx, fy, a * 0.08, a * 0.08);
      };
      for (let i = 0; i < 4; i++) tent(i, 4, 0);
      bodyAt(ctx, e.color, 0, cy, rh, rh * 0.85);
      return { cx: 0, cy, rx: rh, ry: rh * 0.85, eye: [a * 0.12, cy - rh * 0.05, a * (e.eyes === 1 ? 0.32 : 0.21), a * 0.4], mouth: cy + rh * 0.45,
        front: () => { if (look[2]) for (const s of [0.2, 0.75]) tent(s * 3, 4, 1); } };
    },
  };

  V.drawWalker = (ctx, e, t, danger, P) => {
    const { x, y, a } = e;
    if (danger) dangerAura(ctx, x, y, a, t);
    ctx.save();
    ctx.translate(x, y + a * 0.85); // feet on the ground
    ctx.scale(e.dir, 1);
    ctx.scale(e.sx || 1, e.sy || 1);
    const art = e.spikes ? V.art.pick('spiky_walk', 'spiky', 'alien_walk', 'alien') : V.art.pick('alien_walk', 'alien');
    if (art) {
      V.art.draw(ctx, art, 0, 0, { h: a * 2.4, anchor: 'bottom', t: t + e.phase });
      ctx.restore();
      return;
    }
    // Eyes follow the Voidling; arms go up when it's close
    let lx = 0.6, ly = 0, near = false;
    if (P) {
      const dx = (P.x - x) * e.dir, dy = P.y - y, d = Math.hypot(dx, dy) || 1;
      lx = dx / d; ly = dy / d; near = d < 130;
    }
    const look = [lx, ly, near];
    const sp = e.species || (e.species = SPECIES[Math.floor(e.phase * 977) % SPECIES.length]);
    const c = (e.walk !== undefined ? e.walk : t * 40) / (a * 0.55) + e.phase; // step cycle
    const dk = hexMix(e.color, '#1a0830', 0.42), ft = hexMix(e.color, '#1a0830', 0.25);
    const g = SPECIES_DRAW[sp](ctx, e, a, c, look, t, dk, ft);
    if (e.spikes) crystalSpikes(ctx, g.cx, g.cy, g.rx, g.ry, a);
    if (g.eye) faceAt(ctx, e, g.eye[0], g.eye[1], g.eye[2], g.eye[3], look, danger, t, g.mouth);
    else { // crab: eyes on the stalks, mouth on the shell
      for (const s of [-1, 1]) faceAt(ctx, { eyes: 1, phase: e.phase + s, xeyes: e.xeyes }, s * a * 0.28 + a * 0.15, g.stalks[0], g.stalks[1], 0, look, danger, t);
      faceAt(ctx, { eyes: 0, phase: e.phase }, a * 0.1, g.cy, a * 0.25, 0, look, danger, t, g.mouth);
    }
    g.front();
    ctx.restore();
  };

  V.drawFlyer = (ctx, e, t, danger) => {
    const { x, y, a } = e;
    if (danger) dangerAura(ctx, x, y, a, t);
    V.drawGlow(ctx, x, y, a * 2.2, e.glow, 0.45);
    const sq = e.squish > 0 ? e.squish * 0.3 : 0;
    if (V.art.draw(ctx, 'jelly', x, y + a * 0.3, { h: a * 2.6, t: t + e.phase, sx: 1 + sq, sy: 1 - sq })) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = e.color; ctx.lineWidth = a * 0.1; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * a * 0.3, a * 0.1);
      for (let k = 1; k <= 4; k++) ctx.lineTo(i * a * 0.3 + Math.sin(t * 5 + k + i) * a * 0.15, a * 0.1 + k * a * 0.32);
      ctx.stroke();
    }
    // Translucent glossy bell: bright crown, see-through rim, a curved highlight
    const bell = ctx.createRadialGradient(-a * 0.3, -a * 0.65, a * 0.05, 0, -a * 0.2, a * 1.15);
    bell.addColorStop(0, '#ffffff'); bell.addColorStop(0.35, e.color); bell.addColorStop(1, V.mixHex(e.color, '#2a0b4a', 0.45));
    ctx.fillStyle = bell;
    ctx.globalAlpha = 0.88;
    ctx.beginPath(); ctx.arc(0, 0, a, Math.PI, 0); ctx.quadraticCurveTo(0, a * 0.35, -a, 0); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = a * 0.09;
    ctx.beginPath(); ctx.arc(0, 0, a * 0.72, Math.PI * 1.18, Math.PI * 1.45); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; circle(ctx, a * 0.55, -a * 0.45, a * 0.07); ctx.fill();
    for (const s of [-1, 1]) eye(ctx, s * a * 0.3, -a * 0.3, a * 0.19, a * 0.19, 0, 0.4, danger ? '#c4002f' : '#3a1a7a');
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
    const open = e.open;
    if (V.art.has('maw')) { // frames go from closed to wide open
      const n = V.art.frames('maw');
      V.art.draw(ctx, 'maw', hx, hy, { h: a * 2.4, rot: e.lean * 0.4 + (e.droop || 0), frame: Math.round(V.clamp(open, 0, 1) * (n - 1)) });
      return;
    }
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(e.lean * 0.4 + (e.droop || 0));
    for (const s of [-1, 1]) { // two jaws
      ctx.save();
      ctx.rotate(s * open * 0.55);
      const lip = ctx.createLinearGradient(0, s * a * 0.8, 0, s * a * 0.1);
      lip.addColorStop(0, '#a0102c'); lip.addColorStop(0.6, '#ff3352'); lip.addColorStop(1, '#ff8a9c');
      ctx.fillStyle = lip;
      ctx.beginPath(); ctx.ellipse(0, s * a * 0.25, a * 1.05, a * 0.55, 0, s < 0 ? Math.PI : 0, s < 0 ? TAU : Math.PI); ctx.fill();
      if (s < 0) { // wet shine on the upper jaw
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = a * 0.09; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(0, s * a * 0.25, a * 0.8, a * 0.38, 0, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
      }
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
    // Charging a shot: a pulsing red glow underneath, so you can see it coming
    if (e.charging) V.drawGlow(ctx, x, y + a * 0.5, a * 2.4, '#ff2050', 0.55 + 0.4 * Math.sin(t * 22));
    V.drawGlow(ctx, x, y + a * 0.6, a * 2, e.charging ? '#ff4f7a' : '#5fe3ff', 0.5);
    const tilt = V.clamp(e.vx / (a * 20), -0.3, 0.3) + (e.spin || 0);
    if (V.art.draw(ctx, V.art.choose('ufo', e.phase * 1000) || V.art.pick('saucer'), x, y, { w: a * 2.8, rot: tilt, t })) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    // Glass dome with a little pilot inside, and a reflection across the glass
    const dome = ctx.createRadialGradient(-a * 0.2, -a * 0.6, a * 0.05, 0, -a * 0.25, a * 0.6);
    dome.addColorStop(0, 'rgba(230,255,255,0.85)'); dome.addColorStop(1, 'rgba(110,200,240,0.5)');
    ctx.fillStyle = dome;
    ctx.beginPath(); ctx.ellipse(0, -a * 0.25, a * 0.55, a * 0.5, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#9dff6b';
    ctx.beginPath(); ctx.ellipse(0, -a * 0.3, a * 0.2, a * 0.18, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0b33'; circle(ctx, a * 0.06, -a * 0.33, a * 0.06); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = a * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(0, -a * 0.25, a * 0.4, a * 0.36, 0, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke();
    // Polished metal hull: bright band on top, dark underside, a hard specular streak
    const body = ctx.createLinearGradient(0, -a * 0.36, 0, a * 0.36);
    body.addColorStop(0, '#ffffff'); body.addColorStop(0.35, '#d8d2ff'); body.addColorStop(0.55, '#8c86c0'); body.addColorStop(1, '#3a3462');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, a * 1.2, a * 0.36, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a2450'; ctx.lineWidth = a * 0.05; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.ellipse(-a * 0.45, -a * 0.17, a * 0.32, a * 0.05, -0.08, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const on = Math.floor(t * 6 + i) % 2 === 0;
      ctx.fillStyle = on ? '#ff4f7a' : '#5fe3ff';
      circle(ctx, -a * 0.8 + i * a * 0.4, a * 0.05, a * 0.08); ctx.fill();
    }
    ctx.restore();
  };

  // UFO shot: a hot glossy orb with a short fading tail
  V.drawBullet = (ctx, b) => {
    V.drawGlow(ctx, b.x, b.y, b.a * 3, '#ff4f7a', 0.9);
    const t = V.G ? V.G.t : 0;
    if (V.art.draw(ctx, 'bullet_enemy', b.x, b.y, { h: b.a * 3, rot: Math.atan2(b.vy, b.vx), t })) return;
    // A hot red fireball with a flickering flame tail
    const sp = Math.hypot(b.vx, b.vy) || 1;
    V.vfx.streak(ctx, b.x, b.y, b.vx / sp, b.vy / sp, t, b.seed || (b.seed = Math.random() * 10),
      { color: '#ff3b5c', light: '#ffd0a0', len: b.a * 7, w: b.a * 1.2, wisps: 1 });
  };

  // Hostile flyer: a little void bat that swoops at you
  V.drawBat = (ctx, e, t) => {
    const { x, y, a } = e;
    const flap = Math.sin(t * 14 + e.phase);
    V.drawGlow(ctx, x, y, a * 2, '#ff2050', e.swoopT > 0 ? 0.55 : 0.25);
    if (V.art.draw(ctx, 'bat', x, y, { h: a * 2.2, t: t + e.phase, rot: e.spin || 0, flip: e.vx < 0 })) return;
    ctx.save();
    ctx.translate(x, y);
    if (e.spin) ctx.rotate(e.spin);
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
    V.gloss.draw(ctx, V.gloss.body('#3a1660', '#ff4f7a'), 0, 0, a * 0.8, 60);
    ctx.fillStyle = '#ff3d6e';
    for (const s of [-1, 1]) { circle(ctx, s * a * 0.3, -a * 0.12, a * 0.16); ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    for (const s of [-1, 1]) { circle(ctx, s * a * 0.3 - a * 0.05, -a * 0.17, a * 0.05); ctx.fill(); }
    ctx.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * a * 0.22, a * 0.3); ctx.lineTo(s * a * 0.1, a * 0.3); ctx.lineTo(s * a * 0.16, a * 0.52); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  V.drawHeart = (ctx, x, y, s, alpha = 1) => {
    const prev = ctx.globalAlpha, k = s / 48;
    ctx.globalAlpha = prev * alpha;
    if (!V.art.draw(ctx, 'heart', x, y, { h: s * 2.1, t: V.G ? V.G.t : 0 })) ctx.drawImage(V.gloss.heart(), x - 64 * k, y - 70 * k, 128 * k, 128 * k);
    ctx.globalAlpha = prev;
  };

  // Diamond: a revive. Brilliant-cut gem with a twinkle; empty = outline for HUD slots.
  V.drawDiamond = (ctx, x, y, s, t, empty = false) => {
    if (V.art.has('diamond')) {
      if (!empty) V.drawGlow(ctx, x, y, s * 3, '#9ff3ff', 0.5 + 0.2 * Math.sin(t * 4));
      V.art.draw(ctx, 'diamond', x, y, { h: s * 2.1, t, alpha: empty ? 0.22 : 1 });
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    const outline = () => {
      ctx.beginPath();
      ctx.moveTo(-s, -0.25 * s); ctx.lineTo(-0.55 * s, -0.75 * s); ctx.lineTo(0.55 * s, -0.75 * s);
      ctx.lineTo(s, -0.25 * s); ctx.lineTo(0, s);
      ctx.closePath();
    };
    if (empty) {
      outline();
      ctx.strokeStyle = 'rgba(191,246,255,0.35)'; ctx.lineWidth = Math.max(1, s * 0.12);
      ctx.stroke();
      ctx.restore();
      return;
    }
    V.drawGlow(ctx, 0, 0, s * 3.2, '#9ff3ff', 0.55 + 0.2 * Math.sin(t * 4));
    const g = ctx.createLinearGradient(0, -0.75 * s, 0, s);
    g.addColorStop(0, '#f2fdff'); g.addColorStop(0.35, '#9ff3ff'); g.addColorStop(1, '#2f8fff');
    outline();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.beginPath();
    ctx.moveTo(-s, -0.25 * s); ctx.lineTo(s, -0.25 * s);
    ctx.moveTo(-0.55 * s, -0.75 * s); ctx.lineTo(-0.3 * s, -0.25 * s); ctx.lineTo(0, -0.75 * s); ctx.lineTo(0.3 * s, -0.25 * s); ctx.lineTo(0.55 * s, -0.75 * s);
    ctx.moveTo(-0.3 * s, -0.25 * s); ctx.lineTo(0, s); ctx.lineTo(0.3 * s, -0.25 * s);
    ctx.stroke();
    const sp = (Math.sin(t * 3) + 1) / 2;
    ctx.translate(0.55 * s, -0.8 * s);
    ctx.rotate(t);
    ctx.fillStyle = `rgba(255,255,255,${0.5 + sp * 0.5})`;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s * 0.08 : s * (0.25 + sp * 0.15), a = i * Math.PI / 4;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
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
    if (V.art.draw(ctx, V.art.pick(lit ? 'beacon_lit' : 'beacon', 'beacon'), x, y, { h: 70, anchor: 'bottom', t })) return;
    ctx.fillStyle = '#2a1a40';
    ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 9, y - 14); ctx.lineTo(x + 9, y - 14); ctx.lineTo(x + 14, y); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(x - 10, y - 60, x + 10, y - 14);
    g.addColorStop(0, lit ? '#e0fdff' : '#8c7ab0');
    g.addColorStop(1, lit ? '#2aa8e0' : '#3a2a5a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - 62); ctx.lineTo(x + 11, y - 46); ctx.lineTo(x + 8, y - 16); ctx.lineTo(x - 8, y - 16); ctx.lineTo(x - 11, y - 46);
    ctx.closePath(); ctx.fill();
    // Facet shine
    ctx.fillStyle = lit ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.moveTo(x, y - 62); ctx.lineTo(x - 11, y - 46); ctx.lineTo(x - 5, y - 44); ctx.closePath(); ctx.fill();
    ctx.fillRect(x - 6, y - 40, 2, 18);
    if (lit) { // sparkles drifting up the beam
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const p = (t * 0.35 + i / 5) % 1, s = 7 * Math.sin(p * Math.PI);
        ctx.drawImage(V.gloss.star('#bff6ff'), x + Math.sin(t * 2 + i * 2.3) * 12 - s, y - 30 - p * 190 - s, s * 2, s * 2);
      }
      ctx.restore();
    }
  };

  // A strip of red crystal spikes along the top of a platform
  V.drawSpikes = (ctx, x0, x1, y, t) => {
    const n = Math.max(1, Math.floor((x1 - x0) / 9));
    const w = (x1 - x0) / n;
    V.drawGlow(ctx, (x0 + x1) / 2, y - 4, (x1 - x0) * 0.6, '#ff2050', 0.25 + 0.1 * Math.sin(t * 5));
    const f = V.art.frame('spikes', { t });
    if (f) { // your spike image, repeated along the strip
      const h = 15 * V.art.opt('spikes', 'scale', 1), tw = h * f.sw / f.sh, k = Math.max(1, Math.round((x1 - x0) / tw)), sw = (x1 - x0) / k;
      for (let i = 0; i < k; i++) ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, x0 + i * sw, y + 1 - h, sw, h);
      return;
    }
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
  // Shiny cartoon eye: white with a soft lower shade, violet iris, black pupil, two glints
  // (lx, ly = where it looks, -1..1)
  const eye = (ctx, x, y, rx, ry, lx, ly, iris = '#3a1a7a') => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,130,220,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y + ry * 0.45, rx * 0.85, ry * 0.45, 0, 0, Math.PI); ctx.fill();
    if (ry < rx * 0.3) return; // blinking
    const px = x + lx * rx * 0.38, py = y + ly * ry * 0.3;
    ctx.fillStyle = iris;
    ctx.beginPath(); ctx.ellipse(px, py, rx * 0.58, Math.min(ry, rx) * 0.62, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0418';
    ctx.beginPath(); ctx.ellipse(px, py, rx * 0.34, Math.min(ry, rx) * 0.38, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    circle(ctx, px - rx * 0.22, py - ry * 0.22, rx * 0.2); ctx.fill();
    circle(ctx, px + rx * 0.18, py + ry * 0.18, rx * 0.09); ctx.fill();
  };
  V.drawEye = eye;

  V.drawEnemy = (ctx, e, t, P) => {
    if (e.type === 'walker' || e.type === 'spiky') V.drawWalker(ctx, e, t, false, P);
    else if (e.type === 'maw') V.drawMaw(ctx, e, t, e.bite > 0.5);
    else if (e.type === 'jelly') V.drawFlyer(ctx, e, t, false);
    else if (e.type === 'bat') V.drawBat(ctx, e, t);
    else if (e.type === 'saucer') V.drawSaucer(ctx, e, t, false);
  };

  // The Voidling's death: it swells, flashes white with X eyes, then shatters (game-ui spawns
  // the shards). Your 'player_die' frames replace it.
  V.drawPlayerDeath = (ctx, d, r, t) => {
    if (V.art.draw(ctx, 'player_die', d.x, d.y + r, { h: r * 2.7, anchor: 'bottom', flip: d.face < 0, age: d.t })) return;
    if (d.t > 0.2) return;
    const k = d.t / 0.2, s = 1 + 0.3 * Math.sin(k * Math.PI * 0.5);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(Math.sin(d.t * 60) * 0.08 * k);
    ctx.scale(s, s);
    V.gloss.draw(ctx, V.gloss.voidBody(), 0, 0, r, 60);
    V.drawGlow(ctx, 0, 0, r * 1.6, '#ffffff', k * 0.9);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      const ex = d.face * r * 0.22 + sx * r * 0.3, ey = -r * 0.2, q = r * 0.13;
      ctx.beginPath(); ctx.moveTo(ex - q, ey - q); ctx.lineTo(ex + q, ey + q); ctx.moveTo(ex + q, ey - q); ctx.lineTo(ex - q, ey + q); ctx.stroke();
    }
    ctx.restore();
  };

  // Custom player art for what the Voidling is doing, with fallbacks (assets/README.md)
  const PLAYER_STATES = {
    hurt: ['hurt', 'fall'], dash: ['dash', 'run'], shoot: ['shoot'], glide: ['glide', 'fall', 'jump'],
    jump: ['jump', 'fall'], fall: ['fall', 'jump'], run: ['run'], idle: ['idle'],
  };
  const playerArt = (P, t) => {
    if (!V.art.count) return null;
    const st = P.inv > 1 ? 'hurt' : P.dashT > 0 ? 'dash' : t - (P.shotAt || -9) < 0.15 ? 'shoot'
      : !P.onGround ? (P.gliding ? 'glide' : P.vy < 0 ? 'jump' : 'fall') : Math.abs(P.vx) > 25 ? 'run' : 'idle';
    return V.art.pick(...PLAYER_STATES[st].map(s => 'player_' + s), 'player_idle', 'player');
  };

  V.drawPlayer = (ctx, P, t) => {
    const r = P.r;
    if (P.inv > 0 && Math.floor(t * 20) % 2 === 0) return;
    const spawn = V.clamp(P.spawnT === undefined ? 1 : 1 - P.spawnT / 0.4, 0, 1); // reforming after a revive
    const grow = spawn < 1 ? 0.2 + 0.8 * (1 + 2.2 * Math.pow(spawn - 1, 3) + 1.2 * Math.pow(spawn - 1, 2)) : 1;
    const art = playerArt(P, t);
    if (!art || V.art.opt(art, 'glow', true)) V.drawGlow(ctx, P.x, P.y, r * 2.5, '#8a4dff', 0.5);
    ctx.save();
    // Anchored at the feet: squash flattens onto the ground, speed stretches, running leans in
    ctx.translate(P.x, P.y + r);
    const sq = P.squash, st = P.onGround ? 0 : V.clamp(-P.vy / 1500, -0.1, 0.16);
    ctx.rotate(V.clamp(P.vx / 175, -1, 1) * 0.1);
    ctx.scale((1 + sq - st * 0.55) * grow, (1 - sq + st) * grow);
    if (art) {
      V.art.draw(ctx, art, 0, 0, { h: r * 2.7, anchor: 'bottom', flip: P.face < 0, t });
      ctx.restore();
      return;
    }
    ctx.translate(0, -r);
    V.gloss.draw(ctx, V.gloss.voidBody(), 0, 0, r, 60);
    // Stars twinkling inside the void
    for (let i = 0; i < 6; i++) {
      const ang = i * 2.4 + t * 0.3, d = r * (0.28 + (i % 3) * 0.17), tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
      const sx = Math.cos(ang) * d, sy = Math.sin(ang) * d * 0.8 + r * 0.25, s = r * (0.035 + tw * 0.035);
      ctx.fillStyle = `rgba(235,220,255,${0.45 + tw * 0.5})`;
      ctx.fillRect(sx - s, sy - s * 0.25, s * 2, s * 0.5); ctx.fillRect(sx - s * 0.25, sy - s, s * 0.5, s * 2);
    }
    const f = P.face, blink = (Math.sin(t * 1.3) > 0.985) ? 0.15 : 1;
    for (const s of [-1, 1]) eye(ctx, f * r * 0.22 + s * r * 0.3, -r * 0.2, r * 0.21, r * 0.27 * blink, P.lookX, P.lookY);
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
