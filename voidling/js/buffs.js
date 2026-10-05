// Voidling power-ups: shield, super jump, wings, grapple hook, void freeze, heart container
(() => {
  const V = window.V, G = V.G;
  const TAU = Math.PI * 2;
  const FONT_D = '"Bungee", "Arial Black", sans-serif';
  const FONT_B = '"Fredoka", "Trebuchet MS", sans-serif';
  // w = how often it shows up in secret spots
  const BUFFS = (V.BUFFS = {
    shield: { name: 'SHIELD', color: '#5fe3ff', w: 25, text: 'Blocks the next 2 hits' },
    boots: { name: 'SUPER JUMP', color: '#7dffb0', w: 20, time: 25, text: 'Jump 50% higher' },
    wings: { name: 'WINGS', color: '#f4eaff', w: 15, time: 25, text: 'Triple jump' },
    hook: { name: 'GRAPPLE HOOK', color: '#ffcc4d', w: 20, text: '+4 hooks: press G or right-click' },
    freeze: { name: 'VOID FREEZE', color: '#9fe8ff', w: 12, time: 12, text: 'The Void stops rising' },
    heartUp: { name: 'HEART CONTAINER', color: '#ff4f7a', w: 8, text: '+1 max heart, fully healed' },
  });
  const HOOK_RANGE = 300, HOOK_PULL = 720;

  // A shuffled bag of power-ups per zone, so every type shows up. Called by the tower
  // generator while it is seeded, so every player finds the same power-ups in the same spots.
  V.buffBag = zi => {
    const bag = ['shield', 'shield', 'boots', 'wings', 'hook', 'hook', 'freeze'];
    if (zi >= 1) bag.push('heartUp');
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(V.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  };

  G.tryBuff = it => {
    const P = G.P, b = BUFFS[it.type];
    it.dead = true;
    if (it.type === 'shield') P.buffs.shield = 2;
    else if (it.type === 'hook') P.hooks = Math.min(9, P.hooks + 4);
    else if (it.type === 'heartUp') { P.maxHearts = Math.min(8, P.maxHearts + 1); P.hearts = P.maxHearts; }
    else P.buffs[it.type] = b.time;
    V.sfx.heart();
    G.shake = Math.max(G.shake, 4);
    G.tower.burst(it.x, it.y, 24, b.color, 4, 200);
    G.tower.popup(it.x, it.y - 34, b.name, b.color);
    G.tower.popup(it.x, it.y - 14, b.text, '#f4eaff');
    G.guide.event('buff');
    if (it.type === 'hook') G.guide.show('hookTip', 'Grapple hook! Press [G] to pull yourself up to the best platform above you.');
  };

  // A shield soaks up a hit before it costs a heart
  G.absorbHit = () => {
    const P = G.P;
    if (P.buffs.shield <= 0) return false;
    P.buffs.shield--;
    P.inv = 1.0;
    G.shake = Math.max(G.shake, 8);
    G.tower.burst(P.x, P.y, 20, '#5fe3ff', 4, 220);
    G.tower.popup(P.x, P.y - 30, P.buffs.shield ? 'SHIELD HIT' : 'SHIELD BROKEN', '#5fe3ff');
    V.sfx.shatter();
    return true;
  };

  // ---------- Grapple hook ----------
  G.canvas.addEventListener('contextmenu', e => e.preventDefault());
  G.canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 2) return;
    G.aim.mode = 'mouse'; G.aim.sx = e.clientX; G.aim.sy = e.clientY;
    V.input.press('rclick');
  });
  addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 2) V.input.release('rclick'); });

  function hookDir(mouse) {
    const P = G.P;
    let dx, dy;
    if (mouse) {
      const cam = G.cam, z = cam.zoom;
      dx = (G.aim.sx - G.W / 2) / z + cam.x - P.x;
      dy = (G.aim.sy - G.H / 2) / z + cam.y - P.y;
    } else if (V.pad.aiming) { dx = V.pad.ax; dy = V.pad.ay; }
    else if (V.input.down('up')) { dx = 0; dy = -1; }
    else {
      const tg = hookTarget();
      if (tg) { dx = tg[0] - P.x; dy = tg[1] - P.y; } else { dx = P.face * 0.55; dy = -0.83; }
    }
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
  }
  // Without a mouse: hook the best platform above you in range, preferring higher ones and
  // the side you face
  function hookTarget() {
    const P = G.P;
    let best = null, bs = Infinity;
    for (const p of G.tower.plats) {
      if (p.fallen || p.y > P.y - 60) continue;
      const x = V.clamp(P.x, p.x + 10, p.x + p.w - 10), y = p.y + 4;
      const d = Math.hypot(x - P.x, y - P.y);
      if (d > HOOK_RANGE - 10) continue;
      const s = d - (P.y - y) * 0.5 + ((x - P.x) * P.face < -20 ? 40 : 0);
      if (s < bs) { bs = s; best = [x, y]; }
    }
    return best;
  }
  function fireHook() {
    const P = G.P, I = V.input;
    if (P.hooks <= 0) { G.tower.popup(P.x, P.y - 30, 'NO HOOKS', '#b9a6d9'); return; }
    const [dx, dy] = hookDir(I.hit('rclick') || G.aim.mode === 'mouse');
    let hit = null;
    for (let d = 20; d <= HOOK_RANGE && !hit; d += 8) {
      const x = P.x + dx * d, y = P.y + dy * d;
      if (x < -V.HALF || x > V.HALF) break;
      for (const p of G.tower.plats) {
        if (!p.fallen && x >= p.x && x <= p.x + p.w && y >= p.y - 4 && y <= p.y + p.depth * 0.6) { hit = { x, y, plat: p, t: 0 }; break; }
      }
    }
    if (!hit) {
      G.hookMiss = { x: P.x + dx * HOOK_RANGE, y: P.y + dy * HOOK_RANGE, t: 0.15 };
      V.sfx.hit();
      return;
    }
    P.hooks--;
    P.hook = hit;
    P.onGround = false; P.dashT = 0;
    V.sfx.throw();
    G.guide.event('hook');
  }
  // Called by the player physics while hooked: pull straight toward the anchor
  G.hookPull = dt => {
    const P = G.P, h = P.hook;
    h.t += dt;
    const dx = h.x - P.x, dy = h.y - P.y, d = Math.hypot(dx, dy);
    if (d < 22 || h.t > 0.75 || h.plat.fallen) {
      P.hook = null;
      P.vy = Math.min(P.vy, -380); P.vx *= 0.5;
      P.jumps = 1; P.airDash = true;
      return;
    }
    P.vx = dx / d * HOOK_PULL; P.vy = dy / d * HOOK_PULL;
  };

  G.updateBuffs = dt => {
    const P = G.P, I = V.input;
    for (const k of ['boots', 'wings', 'freeze']) P.buffs[k] = Math.max(0, P.buffs[k] - dt);
    if (!P.hook && (I.hit('hook') || I.hit('rclick') || I.hit('thook'))) fireHook();
    if (G.hookMiss && (G.hookMiss.t -= dt) <= 0) G.hookMiss = null;
  };

  // ---------- Drawing ----------
  function icon(ctx, type, s, t) {
    ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = BUFFS[type].color; ctx.fillStyle = BUFFS[type].color;
    ctx.beginPath();
    if (type === 'shield') {
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 - Math.PI / 2; ctx.lineTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55); }
      ctx.closePath(); ctx.stroke();
    } else if (type === 'boots') {
      for (const oy of [0.05, 0.4]) { ctx.moveTo(-s * 0.4, s * oy); ctx.lineTo(0, s * (oy - 0.4)); ctx.lineTo(s * 0.4, s * oy); }
      ctx.stroke();
    } else if (type === 'wings') {
      for (const sx of [-1, 1]) { ctx.moveTo(0, s * 0.2); ctx.quadraticCurveTo(sx * s * 0.7, -s * 0.6, sx * s * 0.6, s * 0.25); ctx.quadraticCurveTo(sx * s * 0.3, s * 0.05, 0, s * 0.2); }
      ctx.fill();
    } else if (type === 'hook') {
      ctx.moveTo(0, -s * 0.55); ctx.lineTo(0, s * 0.1); ctx.arc(-s * 0.25, s * 0.1, s * 0.25, 0, Math.PI * 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -s * 0.55, s * 0.1, 0, TAU); ctx.fill();
    } else if (type === 'freeze') {
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + t * 0.5; ctx.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55); ctx.lineTo(-Math.cos(a) * s * 0.55, -Math.sin(a) * s * 0.55); }
      ctx.stroke();
    } else {
      V.drawHeart(ctx, 0, 0, s * 0.45);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s * 0.25, -s * 0.6, s * 0.1, s * 0.34); ctx.fillRect(s * 0.13, -s * 0.48, s * 0.34, s * 0.1);
    }
  }
  V.drawBuff = (ctx, it, t) => {
    const b = BUFFS[it.type], s = 14;
    const x = it.x, y = it.y + Math.sin(t * 2.5 + it.phase) * 4;
    V.drawGlow(ctx, x, y, 46, b.color, 0.5 + 0.2 * Math.sin(t * 4));
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(11,5,24,0.85)';
    ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
    ctx.strokeStyle = b.color; ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 12;
    ctx.beginPath(); ctx.arc(0, 0, s + 4, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    icon(ctx, it.type, s, t);
    ctx.restore();
  };
  // Shield bubble, wing/boot sparkles and the hook rope, drawn around the player
  G.drawBuffFx = ctx => {
    const P = G.P, t = G.t;
    if (G.state === 'dead') return;
    if (P.buffs.shield > 0) {
      V.drawGlow(ctx, P.x, P.y, P.r * 2.6, '#5fe3ff', 0.35);
      ctx.strokeStyle = `rgba(95,227,255,${0.55 + 0.25 * Math.sin(t * 6)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P.x, P.y, P.r * 1.6, 0, TAU); ctx.stroke();
    }
    if (P.buffs.boots > 0 && Math.random() < 0.4) G.tower.burst(P.x, P.y + P.r, 1, '#7dffb0', 3, 30);
    if (P.buffs.wings > 0) {
      ctx.save(); ctx.translate(P.x, P.y); ctx.globalAlpha = 0.8;
      icon(ctx, 'wings', P.r * 2.2 + Math.sin(t * 12) * 2, t);
      ctx.restore();
    }
    const rope = P.hook || G.hookMiss;
    if (rope) {
      ctx.strokeStyle = '#ffcc4d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(rope.x, rope.y); ctx.stroke();
      ctx.fillStyle = '#ffe58a';
      ctx.beginPath(); ctx.arc(rope.x, rope.y, 4, 0, TAU); ctx.fill();
    }
  };
  // Active power-ups listed under the hearts
  G.drawBuffHud = ctx => {
    const P = G.P, rows = [];
    if (P.buffs.shield > 0) rows.push(['shield', `SHIELD ×${P.buffs.shield}`]);
    if (P.buffs.boots > 0) rows.push(['boots', `SUPER JUMP ${Math.ceil(P.buffs.boots)}s`]);
    if (P.buffs.wings > 0) rows.push(['wings', `WINGS ${Math.ceil(P.buffs.wings)}s`]);
    if (P.buffs.freeze > 0) rows.push(['freeze', `VOID FROZEN ${Math.ceil(P.buffs.freeze)}s`]);
    if (P.hooks > 0) rows.push(['hook', G.isTouch() ? `HOOK ×${P.hooks}` : `HOOK ×${P.hooks}  ·  G / right-click`]);
    let y = 130; // below the hearts and diamond slots
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const [type, text] of rows) {
      ctx.font = `11px ${FONT_D}`;
      const w = ctx.measureText(text).width + 44;
      ctx.fillStyle = 'rgba(11,5,24,0.75)';
      ctx.beginPath(); ctx.roundRect(18, y, w, 26, 13); ctx.fill();
      ctx.strokeStyle = BUFFS[type].color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.translate(34, y + 13); icon(ctx, type, 13, G.t); ctx.restore();
      ctx.fillStyle = BUFFS[type].color;
      ctx.fillText(text, 50, y + 14);
      y += 32;
    }
    G.hudLeftBottom = y; // story messages stay below this when they would overlap
    ctx.font = `500 11px ${FONT_B}`;
  };
})();
