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
    G.tower.burst(P.x, P.y, 50, '#8a4dff', 5, 300, 0, 1.2);
    G.shake = 18;
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
      $('bestOver').textContent = (isBest ? 'New best height!' : `Best: ${G.best} m`) + '  ·  Collect diamonds to respawn at your last checkpoint';
      $('over').hidden = false;
      $('againBtn').focus();
    }, 900);
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
  function drawHud() {
    const P = G.P, W = G.HW, H = G.HH, t = G.t, pad = 18;
    label('HEIGHT', pad, pad);
    ctx.shadowColor = 'rgba(255,204,77,0.6)'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffcc4d'; ctx.font = `34px ${FONT_D}`;
    ctx.fillText(`${G.meters(P.y)} m`, pad, pad + 14);
    ctx.shadowBlur = 0;
    for (let i = 0; i < P.maxHearts; i++) V.drawHeart(ctx, pad + 11 + i * 26, pad + 70, 10, i < P.hearts ? 1 : 0.18);
    for (let i = 0; i < 3; i++) V.drawDiamond(ctx, pad + 11 + i * 26, pad + 95, 9, t, i >= P.diamonds); // revives
    G.drawHeldHud(ctx);
    G.drawBuffHud(ctx);

    const rx = W - pad - (G.isTouch() ? 54 / G.ui : 0); // leave room for the touch pause button
    label('BEST', rx, pad, 'right');
    ctx.fillStyle = '#f4eaff'; ctx.font = `20px ${FONT_D}`;
    ctx.fillText(`${Math.max(G.best, P.best)} m`, rx, pad + 14);
    // Coins buy things at the trader: big gold count with a coin icon, kills underneath
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffcc4d'; ctx.font = `18px ${FONT_D}`;
    const coinText = String(P.coins);
    ctx.fillText(coinText, rx, pad + 40);
    V.drawFood(ctx, { type: 'coin', x: rx - ctx.measureText(coinText).width - 13, y: pad + 50, a: 8, phase: 0 }, t);
    label(`KILLS ${P.kills}`, rx, pad + 64, 'right');

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
    if (G.banner) {
      const b = G.banner;
      ctx.globalAlpha = V.clamp(Math.min(b.t * 2, (2.6 - b.t) * 4), 0, 1);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#5fe3ff'; ctx.font = `16px ${FONT_D}`;
      ctx.fillText(b.sub, W / 2, H * 0.3 - 40);
      ctx.shadowColor = '#b98cff'; ctx.shadowBlur = 24;
      ctx.fillStyle = '#f4eaff'; ctx.font = `${Math.min(60, W / 12)}px ${FONT_D}`;
      ctx.fillText(b.text, W / 2, H * 0.3);
      ctx.shadowBlur = 0;
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
    const z = cam.zoom, sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z + sx), dpr * (H / 2 - cam.y * z + sy));
    const box = { x0: cam.x - v.w / 2, x1: cam.x + v.w / 2, y0: cam.y - v.h / 2, y1: cam.y + v.h / 2 };
    drawShaftEdges(box);
    G.tower.draw(ctx, t, box, P);
    G.drawShots(ctx);
    if (G.state === 'play') drawLandingShadow();
    for (const tr of P.trail) {
      ctx.globalAlpha = (tr.life / 0.2) * 0.4;
      ctx.fillStyle = '#8a4dff';
      ctx.beginPath(); ctx.arc(tr.x, tr.y, G.R * 0.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    G.drawBuffFx(ctx);
    if (G.state !== 'dead' && G.state !== 'reviving') { V.drawPlayer(ctx, P, t); G.drawHeld(ctx); }
    V.drawVoid(ctx, G.voidY, box.x0, box.x1, box.y1, t, P.buffs.freeze > 0, G.surge.k);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `16px ${FONT_D}`;
    for (const u of G.tower.popups) {
      ctx.globalAlpha = V.clamp(u.life * 2, 0, 1);
      ctx.fillStyle = u.color;
      ctx.fillText(u.text, (u.x - cam.x) * z + W / 2, (u.y - cam.y) * z + H / 2);
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
    if (G.paused) {
      ctx.fillStyle = 'rgba(11,5,24,0.5)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f4eaff'; ctx.font = `48px ${FONT_D}`; ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2);
      ctx.font = `500 18px ${FONT_B}`;
      ctx.fillText(G.isTouch() ? 'Tap to resume' : 'Press P to resume', W / 2, H / 2 + 44);
    }
  }

  // ---------- Loop & flow ----------
  function step(dt) {
    if (G.state === 'shop') return; // the world waits while you shop
    if (G.state === 'play') {
      if (G.freeze > 0) { G.freeze -= dt; return; } // hit-stop
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
    if (G.state === 'reviving' && (G.revive.t += dt) > 2.4) cont(); // diamond revive: back to the checkpoint
    G.tower.update(dt, G.t, G.P);
    updateCamera(dt);
    G.shake = Math.max(0, G.shake - dt * 30);
    G.flash = Math.max(0, G.flash - dt);
    updateStory(dt);
    if (G.banner && (G.banner.t -= dt) <= 0) G.banner = null;
    updateWind(dt);
    G.overT += dt;
  }
  G.step = step; // lets tests drive the game loop frame by frame
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    V.pollPad();
    const I = V.input;
    if (I.hit('mute')) V.audio.toggleMute();
    if (G.state === 'play' && I.hit('pause')) G.paused = !G.paused;
    if (G.state === 'title' && I.hit('start')) start();
    if (G.state === 'shop') G.shopInput();
    if (G.state === 'dead' && G.overT > 1.6 && I.hit('start')) start();
    if (!G.paused) { G.t += dt; step(dt); }
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

  function start() {
    G.measureTouch();
    V.audio.init();
    $('title').hidden = true;
    $('over').hidden = true;
    G.newRun();
    G.state = 'play'; G.paused = false;
    document.body.classList.add('playing');
  }
  function cont() {
    V.audio.init();
    $('over').hidden = true;
    G.continueRun();
    G.state = 'play'; G.paused = false;
    document.body.classList.add('playing');
  }
  // Pause: the touch button, the Android back button (via G.pause from the app), or P / Esc;
  // a tap anywhere resumes
  G.pause = () => { if (G.state === 'play') G.paused = true; };
  // Android back button: closes the shop, or pauses a running game; otherwise the app may exit
  G.back = () => {
    if (G.state === 'shop') { G.closeShop(); return 'handled'; }
    if (G.state === 'play' && !G.paused) { G.paused = true; return 'handled'; }
    return 'exit';
  };
  $('pauseBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (G.state === 'play') G.paused = !G.paused; });
  G.canvas.addEventListener('pointerdown', () => { if (G.paused) G.paused = false; });
  $('playBtn').addEventListener('click', start);
  $('againBtn').addEventListener('click', start);
  document.querySelectorAll('#touch button').forEach(b => {
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
    if (G.best > 0) $('bestTitle').textContent = `Best height: ${G.best} m`;
    $('versionTag').textContent = 'v' + V.VERSION;
    G.newRun();
    G.state = 'title';
    requestAnimationFrame(frame);
  };
  if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
  else boot(window.claude?.hot?.data ?? {});
})();
