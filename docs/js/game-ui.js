// Voidling: climb as high as you can before the Void catches you. Part 2: camera, drawing, HUD, flow.
(() => {
  const V = window.V, G = V.G, ctx = G.ctx;
  const $ = id => document.getElementById(id);
  const FONT_D = '"Bungee", "Arial Black", sans-serif';
  const FONT_B = '"Fredoka", "Trebuchet MS", sans-serif';
  const HALF = V.HALF, M = V.M;
  const DEATH_LINES = [
    'The canyon floor still remembers you.',
    'The Floating Isles watched you fall.',
    'Lost somewhere in the asteroid belt.',
    'The Storm Wall wins again.',
    'So close to the Star.',
  ];

  G.die = reason => {
    const P = G.P;
    document.body.classList.remove('playing');
    G.releaseTouch();
    // Death: a moment of slow motion while the Voidling swells and flashes, then it shatters
    G.deathFx = { x: P.x, y: P.y, face: P.face, t: 0, shattered: false };
    G.slow = 0.55;
    G.shake = 12;
    V.sfx.boom();
    // A diamond saves you automatically: short revive moment, then back to the last checkpoint
    if (P.diamonds > 0) {
      P.diamonds--;
      G.state = 'reviving'; G.overT = 0; G.paused = false;
      G.revive = { reason, t: 0, to: G.checkpoint ? G.meters(G.checkpoint.y) : 0, left: P.diamonds };
      G.tower.burst(P.x, P.y, 30, '#bff6ff', 4, 260, 0, 1.2);
      setTimeout(() => V.sfx.tier(), 350);
      return;
    }
    G.state = 'dead'; G.overT = 0;
    const isBest = P.best > G.best;
    if (isBest) { G.best = P.best; try { localStorage.setItem('voidling.climb.best', String(G.best)); } catch (e) { /* storage blocked */ } }
    setTimeout(() => {
      const s = Math.floor(P.time), zi = V.zoneAt(P.best);
      $('overTitle').textContent = reason;
      $('overLine').textContent = `${DEATH_LINES[zi]} No diamonds left, so you start again from the bottom.`;
      $('oHeight').textContent = P.best + ' m';
      $('oZone').textContent = V.ZONES[zi].name;
      $('oKills').textContent = P.kills;
      $('oCoins').textContent = P.coins;
      $('oTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      $('bestOver').textContent = isBest ? 'New best height!' : `Best height: ${G.best} m`;
      if (G.state === 'dead') G.menu.show('over');
    }, 1100);
  };

  // The revive moment: "DIAMOND USED", the diamonds you have left, and where you go back to
  function drawRevive() {
    const r = G.revive, W = G.HW, H = G.HH, t = G.t;
    const a = V.clamp(r.t * 3, 0, 1);
    ctx.fillStyle = `rgba(11,5,24,${0.55 * a})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd6e0'; ctx.font = `22px ${FONT_D}`;
    ctx.fillText(r.reason, W / 2, H * 0.3);
    // The used diamond shatters in the middle, the ones left stay lit
    const used = V.clamp(r.t / 0.6, 0, 1);
    if (used < 1) V.drawDiamond(ctx, W / 2, H * 0.43, 34 * (1 + used * 0.4), t);
    else for (let i = 0; i < 6; i++) {
      const ang = i * Math.PI / 3 + 0.4, d = 30 + (r.t - 0.6) * 160;
      ctx.fillStyle = `rgba(191,246,255,${Math.max(0, 1 - (r.t - 0.6))})`;
      ctx.fillRect(W / 2 + Math.cos(ang) * d - 4, H * 0.43 + Math.sin(ang) * d - 4, 8, 8);
    }
    ctx.shadowColor = '#5fe3ff'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#bff6ff'; ctx.font = `${Math.min(46, W / 14)}px ${FONT_D}`;
    ctx.fillText('DIAMOND USED', W / 2, H * 0.56);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f4eaff'; ctx.font = `600 20px ${FONT_B}`;
    ctx.fillText(r.to > 0 ? `Back to your checkpoint at ${r.to} m` : 'Back to the bottom (no checkpoint yet)', W / 2, H * 0.63);
    for (let i = 0; i < 3; i++) V.drawDiamond(ctx, W / 2 + (i - 1) * 40, H * 0.72, 12, t, i >= r.left);
    ctx.fillStyle = '#b9a6d9'; ctx.font = `500 15px ${FONT_B}`;
    ctx.fillText(r.left ? `${r.left} diamond${r.left > 1 ? 's' : ''} left` : 'No diamonds left. Next time it counts.', W / 2, H * 0.78);
    ctx.globalAlpha = 1;
  }

  // Critically damped spring (like Unity's SmoothDamp): eases in and out, never jerks
  function smooth(cur, target, vel, time, dt) {
    const w = 2 / time, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = cur - target, temp = (vel + w * change) * dt;
    return [target + (change + temp) * e, (vel - w * temp) * e];
  }
  // Platformer camera: holds steady through normal jumps, glides to each new landing height,
  // and only follows freely when you go far up or drop down
  function updateCamera(dt) {
    const cam = G.cam, P = G.P;
    cam.zoom = V.damp(cam.zoom, G.targetZoom(), 3, dt);
    const v = G.view(), ox = cam.x, oy = cam.y;
    if (P.onGround || P.rescue) cam.focus = P.y;
    else if (P.y < cam.focus - v.h * 0.22) cam.focus = P.y + v.h * 0.22;
    else if (P.y > cam.focus + v.h * 0.06) cam.focus = P.y - v.h * 0.06;
    // Look further down when falling fast, and follow tighter when moving fast. Both ease in
    // and out so landing never snaps the view.
    const fall = V.clamp((P.vy - 250) / 450, 0, 1) * v.h * 0.18;
    const fast = Math.abs(P.vy) > 300 || P.rescue || P.hook;
    cam.lead = V.damp(cam.lead || 0, fall, 4, dt);
    cam.st = V.damp(cam.st || 0.3, fast ? 0.12 : 0.3, 5, dt);
    const tx = v.w >= HALF * 2 + 40 ? 0 : V.clamp(P.x, -HALF - 20 + v.w / 2, HALF + 20 - v.w / 2);
    const ty = cam.focus - v.h * 0.12 + cam.lead;
    [cam.x, cam.vx] = smooth(cam.x, tx, cam.vx || 0, 0.18, dt);
    [cam.y, cam.vy] = smooth(cam.y, ty, cam.vy || 0, cam.st, dt);
    G.bg.scroll((cam.x - ox) * cam.zoom, (cam.y - oy) * cam.zoom);
  }
  G.updateCamera = updateCamera;
  function updateStory(dt) {
    const st = G.story;
    if (!st.cur && st.queue.length) st.cur = st.queue.shift();
    const s = st.cur;
    if (!s) return;
    if (s.delay > 0) { s.delay -= dt; return; }
    if (s.shown < s.text.length) s.shown += dt * 40;
    else if ((s.hold += dt) > 4) st.cur = null;
  }
  function updateWind(dt) {
    const w = G.wind, W = G.W, H = G.H;
    const want = w.phase === 'gust' ? 40 : w.phase === 'warn' ? 6 : 0;
    if (w.streaks.length < want) w.streaks.push({ x: w.dir > 0 ? -60 : W + 60, y: Math.random() * H, len: V.rand(40, 130), sp: V.rand(700, 1200) });
    for (const s of w.streaks) s.x += s.sp * w.dir * dt;
    w.streaks = w.streaks.filter(s => s.x > -220 && s.x < W + 220);
  }

  // ---------- World-space extras ----------
  function drawShaftEdges(box) {
    ctx.fillStyle = 'rgba(8,3,18,0.55)';
    if (box.x0 < -HALF) ctx.fillRect(box.x0, box.y0, -HALF - box.x0, box.y1 - box.y0);
    if (box.x1 > HALF) ctx.fillRect(HALF, box.y0, box.x1 - HALF, box.y1 - box.y0);
    ctx.strokeStyle = 'rgba(185,140,255,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.lineDashOffset = -G.t * 20;
    for (const x of [-HALF, HALF]) { ctx.beginPath(); ctx.moveTo(x, box.y0); ctx.lineTo(x, box.y1); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  // Falling guide: predicts your fall from your current speed and the keys you hold, as a
  // dotted path ending in a cyan ring on the island you'll land on, or a red X if you'd miss
  G.fallGuide = null;
  function drawFallGuide() {
    const P = G.P, I = V.input, PH = G.PH, R = G.R;
    G.fallGuide = null;
    if (P.onGround || P.vy < 120 || P.rescue || P.hook || G.hold) return;
    const dir = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
    let x = P.x, y = P.y, vx = P.vx, vy = P.vy, land = null;
    const path = [];
    for (let i = 0; i < 150 && !land; i++) {
      const dt = 1 / 60, oy = y;
      vx = V.approach(vx, dir * PH.RUN, PH.ACC_A * dt);
      vy = Math.min(vy + PH.G * dt, P.gliding ? PH.GLIDE : PH.MAXFALL);
      x = V.clamp(x + vx * dt, -HALF + R, HALF - R); y += vy * dt;
      for (const p of G.tower.plats) {
        if (!p.fallen && x + R * 0.7 >= p.x && x - R * 0.7 <= p.x + p.w && oy + R <= p.y + 2 && y + R >= p.y) { land = { x, y: p.y }; break; }
      }
      if (i % 5 === 0) path.push([x, y]);
      if (y > G.voidY) break;
    }
    ctx.fillStyle = land ? '#9ff3ff' : '#ff6f8f';
    path.forEach(([px, py], i) => {
      ctx.globalAlpha = 0.65 * (1 - i / (path.length + 4));
      ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    const t = G.t;
    if (land) {
      ctx.strokeStyle = '#5fe3ff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(land.x, land.y, 16 + Math.sin(t * 8) * 2, 5, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (path.length) {
      const [ex, ey] = path[path.length - 1];
      ctx.strokeStyle = '#ff4f7a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ex - 8, ey - 8); ctx.lineTo(ex + 8, ey + 8); ctx.moveTo(ex + 8, ey - 8); ctx.lineTo(ex - 8, ey + 8); ctx.stroke();
    }
    G.fallGuide = { land };
  }
  // While falling: arrows along the bottom of the screen for islands below it, with distance
  function drawBelowMarkers(W, H) {
    const P = G.P, cam = G.cam, z = cam.zoom, ui = G.ui;
    if (!G.fallGuide || G.state !== 'play') return;
    const bottomY = cam.y + G.H / z / 2; // world y of the screen bottom
    const land = G.fallGuide.land;
    if (land && land.y <= bottomY) return; // you can already see where you'll land
    const screenX = p => V.clamp(((p.x + p.w / 2 - cam.x) * z + G.W / 2) / ui, 30, W - 30);
    const below = [];
    G.tower.plats
      .filter(p => !p.fallen && p.y > bottomY && p.y - P.y < 1000)
      .map(p => ({ p, d: p.y - P.y + Math.abs(p.x + p.w / 2 - P.x) * 0.5 }))
      .sort((a, b) => a.d - b.d)
      .forEach(c => { if (below.length < 4 && below.every(b => Math.abs(screenX(b.p) - screenX(c.p)) > 56)) below.push(c); });
    const y = H - (W < 760 ? 178 : 128) - G.reserve; // just above the tip line
    below.forEach(({ p }, i) => {
      const sx = screenX(p);
      ctx.globalAlpha = i === 0 ? 0.95 : 0.55;
      ctx.fillStyle = p.type === 'solid' ? '#5fe3ff' : '#ffb066'; // orange: crumbling or moving
      ctx.beginPath(); ctx.moveTo(sx - 10, y); ctx.lineTo(sx + 10, y); ctx.lineTo(sx, y + 12); ctx.closePath(); ctx.fill();
      ctx.font = `11px ${FONT_D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${Math.round((p.y - P.y) / M)} m`, sx, y - 3);
    });
    ctx.globalAlpha = 1;
    if (!G.fallGuide.land && !below.length) {
      ctx.fillStyle = `rgba(255,79,122,${0.7 + 0.3 * Math.sin(G.t * 10)})`;
      ctx.font = `16px ${FONT_D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('NO PLATFORM BELOW: STEER!', W / 2, y);
    } else if (!land) {
      ctx.fillStyle = `rgba(255,79,122,${0.7 + 0.3 * Math.sin(G.t * 10)})`;
      ctx.font = `14px ${FONT_D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('YOU WILL MISS: STEER TOWARD AN ARROW', W / 2, y - 34);
    }
  }
  // Shadow + dotted drop line on the platform below you
  function drawLandingShadow() {
    const P = G.P, r = G.R;
    if (P.onGround) return;
    let top = Infinity;
    for (const p of G.tower.plats) {
      if (p.fallen || P.x < p.x || P.x > p.x + p.w || p.y < P.y + r * 0.9) continue;
      if (p.y < top) top = p.y;
    }
    if (top - P.y > G.view().h) return;
    const k = V.clamp(1 - (top - P.y - r) / 250, 0.2, 1);
    ctx.fillStyle = `rgba(10,0,25,${0.5 * k})`;
    ctx.beginPath(); ctx.ellipse(P.x, top, r * (0.5 + 0.5 * k), r * 0.22 * (0.5 + 0.5 * k), 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(230,214,255,${0.35 * k})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(P.x, P.y + r * 1.2); ctx.lineTo(P.x, top - 3); ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---------- HUD ----------
  function label(text, x, y, align = 'left', color = '#b9a6d9') {
    ctx.textAlign = align; ctx.textBaseline = 'top';
    ctx.fillStyle = color; ctx.font = `600 12px ${FONT_B}`;
    ctx.fillText(text, x, y);
  }
  // Coins fly from where you got them up into the coin counter (HUD coordinates)
  G.flying = [];
  G.flyCoins = (wx, wy, value) => {
    const cam = G.cam, z = cam.zoom, n = Math.min(value, 6);
    const sx = ((wx - cam.x) * z + G.W / 2) / G.ui, sy = ((wy - cam.y) * z + G.H / 2) / G.ui;
    for (let i = 0; i < n; i++) G.flying.push({ sx, sy, t: -i * 0.07, v: value / n, bx: V.rand(-50, 50), by: V.rand(-90, -40) });
  };
  G.coinBump = 0;
  function updateHudFx(dt) {
    for (const f of G.flying) {
      f.t += dt;
      if (f.t >= 0.6) { f.done = true; G.coinBump = 1; }
    }
    G.flying = G.flying.filter(f => !f.done);
    G.coinBump = Math.max(0, G.coinBump - dt * 5);
    for (const h of G.heartFx) h.t += dt;
    G.heartFx = G.heartFx.filter(h => h.t < 0.5);
  }
  // Hearts: they beat, a lost one bursts, a new one pops in
  G.heartFx = []; let shownHearts = null;
  function drawHearts(P, pad, t) {
    if (shownHearts === null || G.state === 'reviving') shownHearts = P.hearts;
    if (P.hearts < shownHearts) for (let i = P.hearts; i < shownHearts; i++) G.heartFx.push({ i, t: 0, lost: true });
    if (P.hearts > shownHearts) for (let i = shownHearts; i < P.hearts; i++) G.heartFx.push({ i, t: 0, lost: false });
    shownHearts = P.hearts;
    const low = P.hearts <= 1;
    for (let i = 0; i < P.maxHearts; i++) {
      const x = pad + 11 + i * 26, y = pad + 70, full = i < P.hearts;
      let s = 10;
      if (full) s *= low ? 1 + 0.18 * Math.max(0, Math.sin(t * 9)) : 1 + 0.05 * Math.max(0, Math.sin(t * 3 - i * 0.5));
      const gain = G.heartFx.find(h => h.i === i && !h.lost);
      if (gain) s *= gain.t < 0.12 ? gain.t / 0.12 * 1.4 : 1.4 - Math.min(1, (gain.t - 0.12) / 0.2) * 0.4;
      V.drawHeart(ctx, x, y, s, full ? 1 : 0.18);
    }
    for (const h of G.heartFx) if (h.lost) {
      const k = h.t / 0.5;
      ctx.globalAlpha = 1 - k;
      V.drawHeart(ctx, pad + 11 + h.i * 26, pad + 70 - k * 8, 10 * (1 + k * 1.1), 1);
      ctx.globalAlpha = 1;
    }
  }

  function drawHud() {
    const P = G.P, W = G.HW, H = G.HH, t = G.t, pad = 18;
    label('HEIGHT', pad, pad);
    ctx.shadowColor = 'rgba(255,204,77,0.6)'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffcc4d'; ctx.font = `34px ${FONT_D}`;
    ctx.fillText(`${G.meters(P.y)} m`, pad, pad + 14);
    ctx.shadowBlur = 0;
    drawHearts(P, pad, t);
    for (let i = 0; i < 3; i++) V.drawDiamond(ctx, pad + 11 + i * 26, pad + 95, 9, t, i >= P.diamonds); // revives
    G.drawHeldHud(ctx);
    G.drawBuffHud(ctx);
    drawBelowMarkers(W, H);

    const rx = W - pad - (G.isTouch() ? 54 / G.ui : 0); // leave room for the touch pause button
    label('BEST', rx, pad, 'right');
    ctx.fillStyle = '#f4eaff'; ctx.font = `20px ${FONT_D}`;
    ctx.fillText(`${Math.max(G.best, P.best)} m`, rx, pad + 14);
    // Coins buy things at the trader: big gold count with a coin icon, kills underneath.
    // The count goes up as each flying coin lands, with a little bump.
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffcc4d'; ctx.font = `18px ${FONT_D}`;
    const coinText = String(Math.round(P.coins - G.flying.reduce((s, f) => s + f.v, 0)));
    const bump = 1 + G.coinBump * 0.35, coinW = ctx.measureText(coinText).width;
    ctx.save();
    ctx.translate(rx - coinW / 2, pad + 50); ctx.scale(bump, bump);
    ctx.textAlign = 'center';
    ctx.fillText(coinText, 0, 0);
    ctx.restore();
    const cx = rx - coinW - 13, cy = pad + 50;
    V.drawFood(ctx, { type: 'coin', x: cx, y: cy, a: 8 * bump, phase: 0 }, t);
    ctx.textBaseline = 'top';
    label(`KILLS ${P.kills}`, rx, pad + 64, 'right');
    for (const f of G.flying) { // curve up to the counter, speeding up as it goes
      if (f.t < 0) continue;
      const p = Math.pow(f.t / 0.6, 1.5), q = 1 - p;
      const x = q * q * f.sx + 2 * q * p * (f.sx + f.bx) + p * p * cx, y = q * q * f.sy + 2 * q * p * (f.sy + f.by) + p * p * cy;
      V.drawFood(ctx, { type: 'coin', x, y, a: 9 - p * 2, phase: f.t * 4 }, t);
    }

    // How far below you the Void is, and whether it is surging or speeding up
    const dist = Math.max(0, Math.floor((G.voidY - P.y - G.R) / M));
    const phase = P.buffs.freeze > 0 ? 'calm' : G.surge.phase;
    const hungry = phase === 'calm' && G.stallMul > 1.25 && P.buffs.freeze <= 0;
    const col = phase !== 'calm' || dist < 12 ? '#ff4f7a' : dist < 30 || hungry ? '#ffb066' : '#b98cff';
    const txt = phase === 'surge' ? `VOID SURGE! CLIMB!  ·  ${dist} m`
      : phase === 'warn' ? `SURGE INCOMING!  ·  ${dist} m`
      : hungry ? `KEEP CLIMBING, IT SPEEDS UP  ·  ${dist} m`
      : `THE VOID IS ${dist} m BELOW`;
    ctx.font = `13px ${FONT_D}`;
    const tw = ctx.measureText(txt).width + 32, by = H - 52 - G.reserve;
    ctx.globalAlpha = phase !== 'calm' || dist < 12 ? 0.75 + 0.25 * Math.sin(t * (phase === 'warn' ? 16 : 10)) : 1;
    ctx.fillStyle = 'rgba(11,5,24,0.75)';
    ctx.beginPath(); ctx.roundRect((W - tw) / 2, by, tw, 30, 15); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, W / 2, by + 16);
    ctx.globalAlpha = 1;

    const w = G.wind;
    if (w.phase !== 'calm' && (w.phase === 'gust' || Math.floor(t * 6) % 2 === 0)) {
      const x = w.dir > 0 ? W - 90 : 90, y = H * 0.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(w.dir, 1);
      ctx.fillStyle = w.phase === 'gust' ? '#e6d6ff' : '#ffcc4d';
      ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(0, -26); ctx.lineTo(0, -10); ctx.lineTo(-40, -10); ctx.lineTo(-40, 10); ctx.lineTo(0, 10); ctx.lineTo(0, 26); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.font = `14px ${FONT_D}`; ctx.textAlign = 'center';
      ctx.fillText(w.phase === 'gust' ? 'WIND' : 'WIND INCOMING', x, y + 44);
    }

    // Right after a respawn (or the start) the world waits for you
    if (G.hold && G.state === 'play' && G.intro <= 0) {
      ctx.globalAlpha = (0.7 + 0.3 * Math.sin(t * 5)) * V.clamp(-G.intro * 3, 0, 1);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#5fe3ff'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#e0fdff'; ctx.font = `${Math.min(34, W / 16)}px ${FONT_D}`;
      ctx.fillText('MOVE TO START', W / 2, H * 0.36);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.globalAlpha = V.clamp(-G.intro * 3, 0, 1);
      ctx.fillStyle = '#b9a6d9'; ctx.font = `500 16px ${FONT_B}`;
      ctx.fillText('Nothing attacks and the Void waits until you move', W / 2, H * 0.36 + 34);
      ctx.globalAlpha = 1;
    }
    // A saucer still above the screen: red "UFO" marker at the top edge so it never surprises you
    for (const e of G.tower.enemies) {
      if (e.type !== 'saucer' || e.dead || e.leaving) continue;
      const sx = ((e.x - G.cam.x) * G.cam.zoom + G.W / 2) / G.ui, sy = ((e.y - G.cam.y) * G.cam.zoom + G.H / 2) / G.ui;
      if (sy > 0) continue;
      const x = V.clamp(sx, 40, W - 40), y = 96;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 10);
      ctx.fillStyle = '#ff4f7a';
      ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x - 11, y + 4); ctx.lineTo(x + 11, y + 4); ctx.closePath(); ctx.fill();
      ctx.font = `12px ${FONT_D}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('UFO', x, y + 8);
      ctx.globalAlpha = 1;
    }
    if (G.banner) { // zone title card: kicker between hairlines, the name, and a line that draws out
      const b = G.banner, age = 2.6 - b.t;
      ctx.globalAlpha = V.clamp(Math.min(b.t * 2, age * 4), 0, 1);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#5fe3ff'; ctx.font = `15px ${FONT_D}`;
      const sub = b.sub.split('').join(String.fromCharCode(8202)), sw = ctx.measureText(sub).width;
      ctx.fillText(sub, W / 2, H * 0.3 - 44);
      ctx.fillRect(W / 2 - sw / 2 - 52, H * 0.3 - 44, 38, 1.5);
      ctx.fillRect(W / 2 + sw / 2 + 14, H * 0.3 - 44, 38, 1.5);
      ctx.shadowColor = '#b98cff'; ctx.shadowBlur = 28;
      ctx.fillStyle = '#f4eaff'; ctx.font = `${Math.min(60, W / 12)}px ${FONT_D}`;
      ctx.fillText(b.text, W / 2, H * 0.3);
      ctx.shadowBlur = 0;
      const lw = Math.min(W * 0.5, 420) * V.clamp(age * 1.6, 0, 1);
      const lg = ctx.createLinearGradient(W / 2 - lw / 2, 0, W / 2 + lw / 2, 0);
      lg.addColorStop(0, 'rgba(185,140,255,0)'); lg.addColorStop(0.5, 'rgba(185,140,255,0.9)'); lg.addColorStop(1, 'rgba(185,140,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(W / 2 - lw / 2, H * 0.3 + 38, lw, 2);
      ctx.globalAlpha = 1;
    }
  }
  function wrapLines(text, maxW) {
    const lines = [];
    let line = '';
    for (const w of text.split(' ')) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function drawStory() {
    const s = G.story.cur, W = G.HW;
    if (!s || s.delay > 0) return;
    const bw = Math.min(520, W - 32), x = (W - bw) / 2;
    const y = Math.max(G.guide.panelBottom + 10, x < 270 ? (G.hudLeftBottom || 130) + 6 : 0);
    ctx.font = `500 16px ${FONT_B}`;
    const lines = wrapLines(s.text, bw - 36);
    const h = 46 + lines.length * 21;
    ctx.globalAlpha = s.hold > 3.4 ? Math.max(0, 1 - (s.hold - 3.4) / 0.6) : 1;
    ctx.fillStyle = 'rgba(11,5,24,0.74)';
    ctx.beginPath(); ctx.roundRect(x, y, bw, h, 14); ctx.fill();
    ctx.strokeStyle = s.color; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = s.color; ctx.font = `12px ${FONT_D}`;
    ctx.fillText('INCOMING  ·  ' + s.from, x + 18, y + 14);
    ctx.font = `500 16px ${FONT_B}`; ctx.fillStyle = '#f4eaff';
    let left = Math.floor(s.shown);
    lines.forEach((ln, i) => {
      if (left <= 0) return;
      ctx.fillText(ln.slice(0, left), x + 18, y + 36 + i * 21);
      left -= ln.length + 1;
    });
    ctx.globalAlpha = 1;
  }

  function render() {
    const P = G.P, cam = G.cam, W = G.W, H = G.H, dpr = G.dpr, t = G.t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = G.view();
    G.bg.draw(ctx, W, H, t, Math.max(0, -(cam.y + v.h / 2) / M)); // exact height, not whole meters, so it moves smoothly
    const shake = V.settings.shake ? G.shake : 0;
    const z = cam.zoom, sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z + sx), dpr * (H / 2 - cam.y * z + sy));
    const box = { x0: cam.x - v.w / 2, x1: cam.x + v.w / 2, y0: cam.y - v.h / 2, y1: cam.y + v.h / 2 };
    if (G.state !== 'title') drawShaftEdges(box); // the flyover shows the open sky
    G.tower.draw(ctx, t, box, P);
    G.drawShots(ctx);
    if (G.state === 'play') { drawLandingShadow(); drawFallGuide(); }
    for (const tr of P.trail) {
      ctx.globalAlpha = (tr.life / 0.2) * 0.4;
      ctx.fillStyle = '#8a4dff';
      ctx.beginPath(); ctx.arc(tr.x, tr.y, G.R * 0.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    G.drawBuffFx(ctx);
    if (G.state !== 'dead' && G.state !== 'reviving') {
      if (P.dashT > 0) for (let i = 0; i < 3; i++) { // electric aura while chomp-dashing
        const a = Math.random() * Math.PI * 2, d = P.r * V.rand(1.6, 2.6);
        V.vfx.lightning(ctx, P.x + Math.cos(a) * P.r * 0.6, P.y + Math.sin(a) * P.r * 0.6, P.x + Math.cos(a) * d - P.vx * 0.03, P.y + Math.sin(a) * d, '#c9a2ff', 1.2, 0.9, 0);
      }
      V.drawPlayer(ctx, P, t); G.drawHeld(ctx);
    }
    else if (G.deathFx) V.drawPlayerDeath(ctx, G.deathFx, P.r, t);
    V.drawVoid(ctx, G.voidY, box.x0, box.x1, box.y1, t, P.buffs.freeze > 0, G.surge.k);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    V.fx.world(ctx, W, H, cam, z, t); // foreground haze
    // Popups pop in with an overshoot, sit, then float off; dark outline so they read anywhere
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `17px ${FONT_D}`; ctx.lineJoin = 'round';
    for (const u of G.tower.popups) {
      const age = u.max - u.life, s = age < 0.09 ? 0.4 + age / 0.09 * 0.85 : age < 0.2 ? 1.25 - (age - 0.09) / 0.11 * 0.25 : 1;
      ctx.globalAlpha = V.clamp(u.life * 3, 0, 1);
      ctx.save();
      ctx.translate((u.x - cam.x) * z + W / 2, (u.y - cam.y) * z + H / 2);
      ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(20,6,40,0.9)'; ctx.lineWidth = 4.5;
      ctx.strokeText(u.text, 0, 0);
      ctx.fillStyle = u.color;
      ctx.fillText(u.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(230,214,255,0.35)'; ctx.lineWidth = 1.5;
    for (const s of G.wind.streaks) { ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.len * G.wind.dir, s.y); ctx.stroke(); }
    if (G.flash > 0) { ctx.fillStyle = `rgba(230,220,255,${G.flash * 2})`; ctx.fillRect(0, 0, W, H); }
    // Red pressure glow rising from the bottom of the screen while the Void surges
    const sk = G.state === 'play' ? G.surge.k : 0;
    if (sk > 0.02) {
      const pulse = 0.75 + 0.25 * Math.sin(t * (G.surge.phase === 'warn' ? 14 : 7));
      const rg = ctx.createLinearGradient(0, H, 0, H * 0.45);
      rg.addColorStop(0, `rgba(255,32,80,${0.42 * sk * pulse})`);
      rg.addColorStop(1, 'rgba(255,32,80,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
    const close = G.state === 'play' && (G.voidY - P.y) / M < 15;
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(5,2,15,0)');
    vg.addColorStop(1, close ? `rgba(110,0,50,${0.55 + 0.2 * Math.sin(t * 8)})` : 'rgba(5,2,15,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    V.fx.letterbox(ctx, W, H, G.bars);
    // HUD: scaled down on small screens, bottom kept clear for touch buttons
    G.ui = V.clamp(Math.min(W / 900, H / 640), 0.62, 1);
    G.HW = W / G.ui; G.HH = H / G.ui;
    const tb = G.touchBox; // centered HUD only needs to dodge the buttons when they leave no room between them
    G.reserve = tb ? (tb.gap > 330 ? 10 : tb.center) / G.ui : 0;
    G.reserveLeft = tb ? tb.left / G.ui : 0;
    if (G.state === 'play' || G.state === 'reviving' || G.state === 'shop') {
      ctx.setTransform(dpr * G.ui, 0, 0, dpr * G.ui, 0, 0);
      drawHud();
      if (G.state === 'reviving') drawRevive(); else { G.guide.draw(ctx); drawStory(); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    V.fx.fade(ctx, W, H, G.fade);
  }

  // ---------- Loop & flow ----------
  function step(dt) {
    if (G.state === 'shop') return; // the world waits while you shop
    if (G.state === 'play') {
      if (G.freeze > 0) { G.freeze -= dt; return; } // hit-stop
      if (G.hold) { // after a respawn: wait for the first control press
        const I = V.input;
        if (['left', 'right', 'down'].some(a => I.down(a)) || ['jump', 'chomp', 'shoot', 'click', 'hook', 'rclick', 'tshoot', 'thook'].some(a => I.hit(a))) G.hold = false;
        else G.P.inv = Math.max(G.P.inv, 0.2);
      }
      G.updatePlayer(dt);
      if (G.state === 'play') G.interact(); // nothing else happens on the frame you die
      if (G.state === 'play') G.updateWeapons(dt);
      if (G.state === 'play') G.updateBuffs(dt);
      if (G.state === 'play') G.updateVoid(dt);
      if (G.state === 'play') G.updateMeta(dt);
      G.guide.update(dt);
      G.tower.generate(G.cam.y - G.view().h * 1.5);
      G.tower.cull(G.voidY);
    }
    const d = G.deathFx;
    if (d && (G.state === 'dead' || G.state === 'reviving')) {
      d.t += dt;
      if (!d.shattered && d.t > (V.art.has('player_die') ? V.art.duration('player_die') : 0.2)) {
        d.shattered = true;
        const T = G.tower;
        T.flash(d.x, d.y, 40);
        T.nova(d.x, d.y, '#b98cff', 80, 8, '#e6d6ff', 0.5);
        T.orbit(d.x, d.y, '#8a4dff', 70, 22, -0.25, 0.5);
        T.splash(d.x, d.y, '#3a1a7a', 14, 300);
        T.splash(d.x, d.y, '#b98cff', 10, 260);
        T.burst(d.x, d.y, 30, '#8a4dff', 5, 300, 0, 1.2);
        G.shake = 18;
      }
    }
    if (G.state === 'reviving' && (G.revive.t += dt) > 2.4) cont(); // diamond revive: back to the checkpoint
    G.tower.update(dt, G.t, G.P, G.hold);
    if (G.state === 'title') updateFlyover(dt); else updateCamera(dt);
    // Cinematic bars on the title, the run-over screen, revives and zone title cards
    const bars = G.state === 'title' || G.state === 'dead' ? 0.085 : G.state === 'reviving' ? 0.075 : G.banner ? 0.055 : 0;
    G.bars = V.damp(G.bars, bars, 4, dt);
    G.fade = Math.max(0, G.fade - dt * 1.1);
    G.intro -= dt;
    G.shake = Math.max(0, G.shake - dt * 30);
    G.flash = Math.max(0, G.flash - dt);
    updateStory(dt);
    updateHudFx(dt);
    if (G.banner && (G.banner.t -= dt) <= 0) G.banner = null;
    updateWind(dt);
    G.overT += dt;
  }
  G.step = step; G.render = render; // lets tests drive the game loop frame by frame
  G.bars = 0.085; G.fade = 1; G.intro = -1;

  // Title screen: the camera cranes slowly up the tower and back down behind the menu,
  // with the world shifted right on wide screens to make room for the menu
  function updateFlyover(dt) {
    const cam = G.cam, f = G.flyover || (G.flyover = { t: 0 });
    f.t += dt;
    const ox = cam.x, oy = cam.y;
    const k = (1 - Math.cos(f.t * Math.PI * 2 / 90)) / 2; // 0 → 1 → 0 over 90 s
    cam.zoom = V.damp(cam.zoom, G.targetZoom() * 1.04, 3, dt);
    const v = G.view(), wide = G.W > G.H * 1.15;
    const tx = (wide ? -v.w * 0.17 : 0) + Math.sin(f.t * 0.12) * 30;
    const ty = -v.h * (wide ? 0.1 : 0.04) - k * 120 * M;
    [cam.x, cam.vx] = smooth(cam.x, tx, cam.vx || 0, 1.4, dt);
    [cam.y, cam.vy] = smooth(cam.y, ty, cam.vy || 0, 1.4, dt);
    G.bg.scroll((cam.x - ox) * cam.zoom, (cam.y - oy) * cam.zoom);
    G.tower.generate(cam.y - v.h * 1.5);
  }

  let last = performance.now();
  function frame(now) {
    // Below ~40 fps the frame is split into two steps, so a slow device never plays in slow motion
    const raw = Math.min(0.05, (now - last) / 1000), steps = raw > 0.026 ? 2 : 1, dt = raw / steps;
    last = now;
    V.pollPad();
    const I = V.input;
    if (I.hit('mute')) { V.audio.toggleMute(); G.menu.sync(); }
    // Menus take the keyboard / gamepad while open; the press that closes one doesn't reach the game
    if (G.menu.update()) I.endFrame();
    else if (G.state === 'play' && !G.paused && I.hit('pause')) G.setPaused(true);
    if (G.state === 'shop') G.shopInput();
    for (let i = 0; i < steps && !G.paused; i++) {
      const sdt = G.slow > 0 ? dt * 0.3 : dt; // slow motion (the moment you die)
      G.slow = Math.max(0, (G.slow || 0) - dt);
      G.t += sdt; step(sdt);
      I.endFrame(); // a press counts once, not once per step
    }
    render();
    I.endFrame();
    requestAnimationFrame(frame);
  }
  // Where the on-screen buttons really are (CSS px from the bottom), so the HUD can stay clear
  const touchEl = document.getElementById('touch');
  G.measureTouch = () => {
    if (!G.isTouch()) { G.touchBox = null; return; }
    const [l, r] = [...touchEl.querySelectorAll('.pad')].map(p => p.getBoundingClientRect());
    G.touchBox = { center: innerHeight - Math.min(l.top, r.top) + 10, left: innerHeight - l.top + 10, gap: r.left - l.right };
  };
  addEventListener('resize', () => G.measureTouch());
  addEventListener('touchstart', () => setTimeout(G.measureTouch, 50), { once: true, passive: true });

  // A new climb. From the title the camera swoops down from the flyover to the Voidling.
  G.start = () => {
    G.measureTouch();
    V.audio.init();
    G.menu.hide('title', true); G.menu.hide('over', true); G.menu.hide('pauseMenu');
    const from = G.state === 'title' ? { x: G.cam.x, y: G.cam.y } : null;
    G.newRun();
    if (from) Object.assign(G.cam, from, { vx: 0, vy: 0 });
    else G.fade = 0.8;
    G.state = 'play'; G.paused = false; G.overT = 0;
    document.body.classList.remove('paused');
    G.hold = true; G.intro = from ? 1.3 : 0.5; // the world waits until you move
    document.body.classList.add('playing');
  };
  function cont() {
    V.audio.init();
    G.continueRun();
    G.state = 'play'; G.paused = false; G.intro = -1;
    document.body.classList.add('playing');
  }
  // Back to the title screen (your best height is kept)
  G.toMenu = () => {
    const P = G.P;
    if (P && P.best > G.best) { G.best = P.best; try { localStorage.setItem('voidling.climb.best', String(G.best)); } catch (e) { /* storage blocked */ } }
    document.body.classList.remove('playing');
    G.releaseTouch();
    G.newRun();
    G.state = 'title'; G.paused = false; G.flyover = null; G.fade = 1;
    document.body.classList.remove('paused');
    G.menu.hide('pauseMenu'); G.menu.hide('over');
    G.menu.show('title');
  };
  // Pause: the touch button, the Android back button (via G.pause from the app), or P / Esc
  G.setPaused = on => {
    if (G.state !== 'play' && on) return;
    G.paused = on;
    document.body.classList.toggle('paused', on);
    if (on) { G.releaseTouch(); G.menu.show('pauseMenu'); } else G.menu.hide('pauseMenu');
  };
  G.pause = () => G.setPaused(true);
  // Android back button: closes a panel or the shop, resumes from pause, pauses a running game,
  // leaves the run-over screen; on the title it lets the app exit
  G.back = () => {
    if (G.menu.back()) return 'handled';
    if (G.state === 'shop') { G.closeShop(); return 'handled'; }
    if (G.state === 'play' && !G.paused) { G.setPaused(true); return 'handled'; }
    return G.state === 'title' ? 'exit' : 'handled';
  };
  $('pauseBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.setPaused(!G.paused); });
  // ◀ ▶ work like a slider: the side of the pad under your thumb is the direction, so you can
  // slide from one to the other without lifting (and keep running if you slide past the edge)
  const dpad = touchEl.querySelector('.pad');
  const thumbs = new Map(); // pointerId -> 'left' | 'right'
  const dirAt = x => {
    const [l, r] = [...dpad.querySelectorAll('button')].map(b => b.getBoundingClientRect());
    return x < (l.left + l.width / 2 + r.left + r.width / 2) / 2 ? 'left' : 'right';
  };
  const dpadSync = () => {
    const held = new Set(thumbs.values());
    for (const a of ['left', 'right']) {
      if (held.has(a)) V.input.press(a); else V.input.release(a);
      dpad.querySelector(`[data-act="${a}"]`).classList.toggle('on', held.has(a));
    }
  };
  dpad.addEventListener('pointerdown', e => {
    e.preventDefault(); V.audio.init();
    try { dpad.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    thumbs.set(e.pointerId, dirAt(e.clientX)); dpadSync();
  });
  dpad.addEventListener('pointermove', e => {
    if (!thumbs.has(e.pointerId)) return;
    const d = dirAt(e.clientX);
    if (d !== thumbs.get(e.pointerId)) { thumbs.set(e.pointerId, d); dpadSync(); }
  });
  const dpadOff = e => { if (thumbs.delete(e.pointerId)) dpadSync(); };
  G.releaseTouch = () => { if (thumbs.size) { thumbs.clear(); dpadSync(); } }; // no stuck direction after a pause or death
  dpad.addEventListener('pointerup', dpadOff);
  dpad.addEventListener('pointercancel', dpadOff);
  document.querySelectorAll('#touch .pad.grid button').forEach(b => {
    const act = b.dataset.act;
    const on = e => { e.preventDefault(); V.audio.init(); V.input.press(act); };
    const off = e => { e.preventDefault(); V.input.release(act); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
  });

  window.claude?.hot?.snapshot?.(() => ({ best: G.best }));
  const boot = data => {
    if (data && data.best) G.best = Math.max(G.best, data.best);
    $('versionTag').textContent = 'v' + V.VERSION;
    G.newRun();
    G.state = 'title';
    G.menu.show('title');
    requestAnimationFrame(frame);
  };
  if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
  else boot(window.claude?.hot?.data ?? {});
})();
