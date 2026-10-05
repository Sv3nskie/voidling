// Voidling weapons: things to pick up and throw, guns to shoot, aiming and projectiles
(() => {
  const V = window.V, G = V.G;
  const TAU = Math.PI * 2;
  const GUNS = {
    blaster: { name: 'STAR BLASTER', ammo: 18, cd: 0.14, recoil: 200, color: '#ffd86b' },
    spread: { name: 'SPREAD GUN', ammo: 10, cd: 0.32, recoil: 260, color: '#ff7fc8' },
  };
  const THROWN = { rock: { name: 'ROCK' }, bomb: { name: 'VOID BOMB' } };
  V.GUNS = GUNS;
  const THROW_SPEED = 560, THROW_G = 1100, BOMB_R = 90;
  const FONT_D = '"Bungee", "Arial Black", sans-serif';
  const FONT_B = '"Fredoka", "Trebuchet MS", sans-serif';

  G.aim = { mode: 'key', sx: 0, sy: 0 };
  G.shots = [];
  G.blasts = [];

  // ---------- Aiming: mouse, keyboard or touch auto-aim ----------
  G.canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    G.aim.mode = 'mouse'; G.aim.sx = e.clientX; G.aim.sy = e.clientY;
  });
  G.canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    G.aim.mode = 'mouse'; G.aim.sx = e.clientX; G.aim.sy = e.clientY;
    V.input.press('click');
  });
  addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) V.input.release('click'); });

  const enemyPos = e => (e.type === 'maw' ? [e.hx, e.hy] : [e.x, e.y]);
  const norm = (dx, dy) => { const d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };

  // Auto-aim: the nearest enemy in range, preferring the side you face
  G.autoTarget = () => {
    const P = G.P;
    let best = null, bs = Infinity;
    for (const e of G.tower.enemies) {
      if (e.dead || e.type === 'jelly') continue;
      const [ex, ey] = enemyPos(e), dx = ex - P.x, dy = ey - P.y, d = Math.hypot(dx, dy);
      if (d > 440) continue;
      const s = d + (dx * P.face < -10 ? 160 : 0) + (dy > 60 ? 60 : 0);
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  };
  // Throw direction that lands on (dx, dy) from the hand, low arc; null if out of range
  function lob(dx, dy) {
    const v2 = THROW_SPEED * THROW_SPEED, g = THROW_G, x = Math.abs(dx), h = -dy;
    const disc = v2 * v2 - g * (g * x * x + 2 * h * v2);
    if (disc < 0 || x < 4) return null;
    const ang = Math.atan((v2 - Math.sqrt(disc)) / (g * x));
    return [Math.sign(dx) * Math.cos(ang), -Math.sin(ang)];
  }
  // mode: 'mouse' aims at the cursor; anything else is keyboard / gamepad / touch:
  // right stick > held ↑/↓ > auto-aim target > straight ahead
  function aimDir(mode) {
    const P = G.P, I = V.input, thrown = P.held && THROWN[P.held.type];
    if (mode === 'mouse') {
      const cam = G.cam, z = cam.zoom;
      return norm((G.aim.sx - G.W / 2) / z + cam.x - P.x, (G.aim.sy - G.H / 2) / z + cam.y - P.y);
    }
    if (V.pad.aiming) return [V.pad.ax, V.pad.ay];
    if (I.down('down') && !P.onGround) return [0, 1];
    if (I.down('up')) return thrown ? norm(P.face * 0.3, -0.95) : [0, -1];
    const target = G.autoTarget();
    if (target) {
      const [ex, ey] = enemyPos(target);
      if (!thrown) return norm(ex - P.x, ey - P.y);
      const arc = lob(ex - P.x, ey - (P.y - 18));
      if (arc) return arc;
      return norm(ex - P.x, Math.min(ey - P.y, 0) - Math.abs(ex - P.x));
    }
    return thrown ? [P.face * 0.82, -0.57] : [P.face, 0];
  }

  // ---------- Firing and throwing ----------
  G.updateWeapons = dt => {
    const P = G.P, I = V.input;
    P.fireCd -= dt;
    const src = I.down('click') ? 'mouse' : I.down('shoot') || I.down('tshoot') ? 'key' : null;
    if (src) G.aim.mode = src;
    if (V.pad.aiming) G.aim.mode = 'key';
    if (src && P.held && P.fireCd <= 0) {
      const gun = GUNS[P.held.type];
      if (gun) fireGun(gun, aimDir(src));
      else if (I.hit('click') || I.hit('shoot') || I.hit('tshoot')) throwHeld(aimDir(src));
    }
    updateShots(dt);
  };
  function fireGun(gun, [dx, dy]) {
    const P = G.P, base = Math.atan2(dy, dx);
    for (const off of P.held.type === 'spread' ? [-0.22, 0, 0.22] : [0]) {
      const a = base + off;
      G.shots.push({ kind: 'bolt', x: P.x + Math.cos(a) * 16, y: P.y + Math.sin(a) * 16, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, a: 5, life: 0.8, color: gun.color });
    }
    P.fireCd = gun.cd;
    if (Math.abs(dx) > 0.3) P.face = Math.sign(dx);
    // Shooting straight down in the air kicks you upward
    if (dy > 0.7 && !P.onGround) { P.vy = Math.min(P.vy, -gun.recoil); G.guide.event('recoil'); }
    P.mouth = 0.6;
    (P.held.type === 'spread' ? V.sfx.spread : V.sfx.shoot)();
    G.tower.burst(P.x + dx * 18, P.y + dy * 18, 4, gun.color, 3, 90);
    G.guide.event('shoot');
    if (--P.held.ammo <= 0) { G.tower.popup(P.x, P.y - 34, 'OUT OF AMMO', '#b9a6d9'); P.held = null; }
  }
  function throwHeld([dx, dy]) {
    const P = G.P, type = P.held.type;
    G.shots.push({ kind: type, x: P.x, y: P.y - 18, vx: dx * THROW_SPEED + P.vx * 0.3, vy: dy * THROW_SPEED + Math.min(0, P.vy) * 0.2, a: type === 'bomb' ? 9 : 8, life: type === 'bomb' ? 1.4 : 3, spin: 0 });
    P.held = null; P.fireCd = 0.25;
    if (Math.abs(dx) > 0.2) P.face = Math.sign(dx);
    V.sfx.throw();
    G.guide.event('throw');
  }
  function shatter(s) {
    s.dead = true;
    G.tower.burst(s.x, s.y, 10, '#b9a0d8', 3, 140);
    V.sfx.shatter();
  }
  function explode(s) {
    s.dead = true;
    const T = G.tower, P = G.P;
    G.blasts.push({ x: s.x, y: s.y, r: BOMB_R, t: 0 });
    T.burst(s.x, s.y, 30, '#ff7fc8', 5, 320);
    T.burst(s.x, s.y, 20, '#ffd86b', 4, 260);
    G.shake = Math.max(G.shake, 14);
    V.sfx.boom();
    for (const e of T.enemies) {
      if (e.dead || e.type === 'jelly') continue;
      const [ex, ey] = enemyPos(e);
      if (Math.hypot(ex - s.x, ey - s.y) > BOMB_R + e.a) continue;
      for (let i = 0; i < 2 && !e.dead; i++) { e.hurtT = 0; G.damage(e, 'shot', ex, ey); }
    }
    for (const b of T.bullets) if (Math.hypot(b.x - s.x, b.y - s.y) < BOMB_R) b.dead = true;
    // The blast never hurts you, it launches you: a bomb jump
    const dx = P.x - s.x, dy = P.y - s.y, d = Math.hypot(dx, dy);
    if (d < 120) {
      const k = 1 - d / 120;
      if (P.y < s.y + 30) P.vy = Math.min(P.vy, -460 - 420 * k);
      P.vx += (dx / (d || 1)) * 320 * k;
      P.onGround = false; P.jumps = 1; P.airDash = true;
      G.guide.event('bombjump');
    }
  }
  function updateShots(dt) {
    const T = G.tower;
    for (const s of G.shots) {
      if (s.dead) continue;
      const oy = s.y;
      if (s.kind !== 'bolt') s.vy += THROW_G * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.life -= dt; s.spin += dt * 10;
      if (s.x < -V.HALF || s.x > V.HALF) {
        if (s.kind === 'bolt') { s.dead = true; continue; }
        s.vx *= -0.6; s.x = V.clamp(s.x, -V.HALF, V.HALF);
      }
      for (const e of T.enemies) {
        if (e.dead || e.type === 'jelly' || e.hurtT > 0) continue;
        const [ex, ey] = enemyPos(e);
        if (Math.hypot(s.x - ex, s.y - ey) > s.a + e.a * 0.9) continue;
        if (s.kind === 'bomb') explode(s);
        else { G.damage(e, 'shot', ex, ey); s.kind === 'rock' ? shatter(s) : (s.dead = true); }
        break;
      }
      if (s.dead) continue;
      for (const b of T.bullets) {
        if (b.dead || Math.hypot(s.x - b.x, s.y - b.y) > s.a + b.a + 2) continue;
        b.dead = true;
        T.burst(b.x, b.y, 6, '#ff4f7a', 3, 80);
        if (s.kind === 'bolt') s.dead = true;
      }
      if (s.dead) continue;
      if (s.kind !== 'bolt' && s.vy > 0) {
        for (const p of T.plats) {
          if (p.fallen || s.x < p.x || s.x > p.x + p.w || oy > p.y || s.y < p.y) continue;
          s.y = p.y;
          s.kind === 'bomb' ? explode(s) : shatter(s);
          break;
        }
      }
      if (!s.dead && s.life <= 0) s.kind === 'bomb' ? explode(s) : s.kind === 'rock' ? shatter(s) : (s.dead = true);
    }
    G.shots = G.shots.filter(s => !s.dead);
    for (const b of G.blasts) b.t += dt;
    G.blasts = G.blasts.filter(b => b.t < 0.45);
  }

  // Walking over an item picks it up. Guns always fit; rocks and bombs need empty hands.
  G.tryPickup = it => {
    const P = G.P, T = G.tower, gun = GUNS[it.type];
    if (!gun && P.held) return false;
    if (gun && P.held && P.held.type === it.type) P.held.ammo += gun.ammo;
    else {
      if (P.held && THROWN[P.held.type]) T.addItem(P.held.type, it.x, it.y);
      P.held = { type: it.type, ammo: gun ? gun.ammo : 1 };
    }
    it.dead = true;
    V.sfx.pickup();
    T.popup(it.x, it.y - 20, gun ? gun.name : THROWN[it.type].name, gun ? gun.color : '#e6d6ff');
    G.guide.event('pickup');
    return true;
  };

  // ---------- Drawing ----------
  function drawRock(ctx, x, y, s, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = '#6b4f8f';
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.3); ctx.lineTo(-s * 0.6, -s * 0.8); ctx.lineTo(s * 0.4, -s); ctx.lineTo(s, -s * 0.1); ctx.lineTo(s * 0.6, s * 0.8); ctx.lineTo(-s * 0.4, s * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c8b0e8';
    ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.8); ctx.lineTo(s * 0.4, -s); ctx.lineTo(0, -s * 0.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5fe3ff';
    ctx.fillRect(s * 0.1, s * 0.1, s * 0.3, s * 0.3);
    ctx.restore();
  }
  function drawBomb(ctx, x, y, s, t) {
    ctx.fillStyle = '#1a0b33';
    ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ff7fc8'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ff7fc8';
    ctx.fillRect(x - s * 0.45, y - s * 0.15, s * 0.25, s * 0.3);
    ctx.fillRect(x + s * 0.2, y - s * 0.15, s * 0.25, s * 0.3);
    const spark = Math.floor(t * 8) % 2 ? '#ff4f7a' : '#ffd86b';
    V.drawGlow(ctx, x + s * 0.55, y - s * 0.95, s * 0.9, spark.length === 7 ? spark : '#ffd86b', 0.9);
    ctx.fillStyle = spark;
    ctx.beginPath(); ctx.arc(x + s * 0.55, y - s * 0.95, s * 0.22, 0, TAU); ctx.fill();
  }
  function drawGun(ctx, x, y, ang, flip, type) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1, flip);
    ctx.fillStyle = '#7a76a8'; ctx.fillRect(-7, 0, 5, 8);
    ctx.fillStyle = '#e6e0ff'; ctx.fillRect(-8, -3, 18, 6);
    ctx.fillStyle = GUNS[type].color; ctx.fillRect(9, -4, 4, 8);
    if (type === 'spread') { ctx.fillRect(4, -7, 7, 3); ctx.fillRect(4, 4, 7, 3); }
    ctx.restore();
  }
  V.drawPickup = (ctx, it, t) => {
    const x = it.x, y = it.y + Math.sin(t * 3 + it.phase) * 3;
    if (it.type === 'rock') {
      V.drawGlow(ctx, x, y, 20, '#e6d6ff', 0.35);
      drawRock(ctx, x, y, 8, 0);
    } else if (it.type === 'bomb') {
      V.drawGlow(ctx, x, y, 24, '#ff7fc8', 0.5);
      drawBomb(ctx, x, y, 9, t);
    } else {
      const g = GUNS[it.type];
      V.drawGlow(ctx, x, y, 36, g.color, 0.45 + 0.15 * Math.sin(t * 4));
      ctx.fillStyle = 'rgba(230,214,255,0.12)';
      ctx.strokeStyle = 'rgba(230,214,255,0.75)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill(); ctx.stroke();
      drawGun(ctx, x - 2, y, 0, 1, it.type);
    }
  };
  // What the Voidling is holding, plus a dotted arc showing where a throw will land and a
  // lock-on marker on the auto-aim target
  G.drawHeld = ctx => {
    const P = G.P;
    if (!P.held || G.state === 'dead') return;
    const [dx, dy] = aimDir(G.aim.mode);
    const target = G.aim.mode !== 'mouse' && !V.pad.aiming && !V.input.down('up') && !(V.input.down('down') && !P.onGround) ? G.autoTarget() : null;
    if (target) {
      const [ex, ey] = enemyPos(target), r = target.a + 9, spin = G.t * 2;
      ctx.strokeStyle = '#ffd86b'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        const a = spin + i * Math.PI / 2;
        ctx.beginPath(); ctx.arc(ex, ey, r, a, a + 0.8); ctx.stroke();
      }
      ctx.fillStyle = '#ffd86b';
      ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, TAU); ctx.fill();
    }
    if (GUNS[P.held.type]) {
      drawGun(ctx, P.x + dx * 14, P.y + dy * 14 + 3, Math.atan2(dy, dx), dx < 0 ? -1 : 1, P.held.type);
      return;
    }
    const hy = P.y - P.r * 1.75 + Math.sin(G.t * 4) * 1.5;
    if (P.held.type === 'rock') drawRock(ctx, P.x, hy, 8, 0);
    else drawBomb(ctx, P.x, hy, 9, G.t);
    let x = P.x, y = P.y - 18, vx = dx * THROW_SPEED + P.vx * 0.3, vy = dy * THROW_SPEED + Math.min(0, P.vy) * 0.2;
    ctx.fillStyle = '#e6d6ff';
    for (let i = 0; i < 24; i++) {
      for (let k = 0; k < 2; k++) { vy += THROW_G * 0.02; x += vx * 0.02; y += vy * 0.02; }
      ctx.globalAlpha = 0.7 * (1 - i / 24);
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  G.drawShots = ctx => {
    for (const s of G.shots) {
      if (s.kind === 'bolt') {
        V.drawGlow(ctx, s.x, s.y, 14, s.color, 0.8);
        ctx.strokeStyle = '#fff8e0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02); ctx.stroke();
      } else if (s.kind === 'rock') {
        drawRock(ctx, s.x, s.y, 8, s.spin);
      } else {
        V.drawGlow(ctx, s.x, s.y, 26, '#ff7fc8', 0.5 + 0.3 * Math.sin(G.t * 30));
        drawBomb(ctx, s.x, s.y, 9, G.t);
      }
    }
    for (const b of G.blasts) {
      const k = b.t / 0.45;
      V.drawGlow(ctx, b.x, b.y, b.r * (0.6 + k), '#ff7fc8', 1 - k);
      ctx.strokeStyle = `rgba(255,216,107,${1 - k})`;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.3 + k * 0.9), 0, TAU); ctx.stroke();
    }
  };
  // Bottom-left card: what you hold and how many shots are left
  G.drawHeldHud = ctx => {
    const P = G.P;
    if (!P.held) return;
    const W = G.HW, H = G.HH, gun = GUNS[P.held.type];
    const x = 18, y = (W < 760 ? H - 100 : H - 58) - Math.max(G.reserve, G.reserveLeft || 0), w = 236, h = 40;
    ctx.fillStyle = 'rgba(11,5,24,0.8)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = gun ? gun.color : '#e6d6ff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save();
    ctx.translate(x + 24, y + h / 2); ctx.scale(1.4, 1.4);
    if (gun) drawGun(ctx, 0, 0, 0, 1, P.held.type);
    else if (P.held.type === 'rock') drawRock(ctx, 0, 0, 8, 0);
    else drawBomb(ctx, 0, 0, 8, G.t);
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = gun ? gun.color : '#f4eaff'; ctx.font = `12px ${FONT_D}`;
    ctx.fillText(gun ? `${gun.name}  ×${P.held.ammo}` : THROWN[P.held.type].name, x + 50, y + 7);
    ctx.fillStyle = '#b9a6d9'; ctx.font = `500 12px ${FONT_B}`;
    ctx.fillText(G.isTouch() ? (gun ? 'SHOOT auto-aims' : 'SHOOT auto-aims the throw')
      : gun ? 'J auto-aims · hold ↑/↓ to aim' : 'J auto-aims the throw · or click', x + 50, y + 22);
  };
})();
