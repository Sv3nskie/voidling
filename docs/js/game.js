// Voidling: climb as high as you can before the Void catches you. Part 1: state, player, combat.
(() => {
  const V = window.V;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  };
  addEventListener('resize', resize);
  resize();

  const M = V.M, HALF = V.HALF, R = 12;
  const KILL_COINS = { walker: 2, bat: 3, spiky: 4, maw: 4, saucer: 10 };
  const PH = { G: 1500, JUMP: 430, DJUMP: 370, STOMP: 480, RUN: 175, ACC_G: 2200, ACC_A: 1200, DASH: 540, DASH_T: 0.15, MAXFALL: 720, GLIDE: 170 };
  const STORY = {
    1: ['GLORP COLONY', 'A Voidling? Up here? Somebody stop it!', '#9dff6b'],
    2: ['WARDEN FLEET', 'Unknown climber entering the belt. Shoot it down.', '#ff4f7a'],
    3: ['ANCIENT SIGNAL', 'The Storm Wall. Nobody has ever climbed it. Nobody.', '#ffd86b'],
    4: ['???', 'You made it through the storm. The Star is watching you now.', '#b98cff'],
  };

  // Shared game state, read by the render/flow part (game-ui.js)
  const G = (V.G = {
    ctx, canvas, get W() { return W; }, get H() { return H; }, get dpr() { return dpr; },
    bg: new V.Background(), tower: new V.Tower(),
    P: null, cam: null, guide: null, story: null, flags: null, banner: null,
    state: 'title', t: 0, shake: 0, freeze: 0, flash: 0, paused: false, overT: 0,
    voidY: 320, voidDelay: 0, saucerT: 0, thunderT: 0, continues: 2, checkpoint: null, best: 0,
    wind: { phase: 'calm', t: 3, dir: 1, power: 0, streaks: [] },
    R, PH,
  });
  try { G.best = +localStorage.getItem('voidling.climb.best') || 0; } catch (e) { G.best = 0; }

  G.targetZoom = () => Math.min(H / 430, W / 380);
  G.view = () => ({ w: W / G.cam.zoom, h: H / G.cam.zoom });
  G.ppu = () => G.cam.zoom * dpr * 1.25;
  G.meters = y => Math.max(0, Math.floor(-y / M));
  G.say = (from, text, color = '#b98cff', delay = 0) => G.story.queue.push({ from, text, color, delay, shown: 0, hold: 0 });
  G.once = (key, fn) => { if (!G.flags[key]) { G.flags[key] = true; fn(); } };

  // Touch devices: on-screen buttons show up on the first touch (or on coarse pointers)
  G.isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
  addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
  // The HUD is laid out on a logical screen (HW x HH) that is scaled down on small phones,
  // with room kept free at the bottom for the touch buttons
  G.ui = 1; G.HW = W; G.HH = H; G.reserve = 0;

  const guideApi = {
    get P() { return G.P; }, tower: G.tower, get W() { return G.HW; }, get H() { return G.HH; },
    get reserve() { return G.reserve; }, get touch() { return G.isTouch(); },
    get voidY() { return G.voidY; }, wind: G.wind,
  };

  const freshPlayer = (x, y) => ({
    x, y, vx: 0, vy: 0, r: R, onGround: true, plat: null, coyote: 0, jumpBuf: 0, jumps: 0, airDash: true,
    dashT: 0, dashCd: 0, face: 1, inv: 0, mouth: 0, squash: 0, lookX: 1, lookY: 0, gliding: false,
    // best = highest point this run (the score); peak = highest point since the last respawn
    // (what the Void measures against); diamonds = revives, max 3
    hearts: 3, maxHearts: 5, best: 0, peak: 0, diamonds: 0, coins: 0, kills: 0, time: 0, zone: 0, trail: [], fireCd: 0,
    bag: { blaster: 0, spread: 0, rock: 0, bomb: 0 }, sel: null, // inventory and the selected item
    buffs: { shield: 0, boots: 0, wings: 0, freeze: 0 }, hooks: 0, hook: null, rescue: null,
  });

  G.newRun = () => {
    G.cam = { x: 0, y: -150, zoom: 1, vx: 0, vy: 0, focus: -R };
    G.cam.zoom = G.targetZoom();
    G.tower.reset();
    G.tower.init(G.ppu());
    G.P = freshPlayer(0, -R);
    G.P.diamonds = 1; // every run starts with one revive
    Object.assign(G, { voidY: 320, voidDelay: 4, saucerT: 12, thunderT: 4, checkpoint: null, banner: null, shake: 0, freeze: 0, flash: 0 });
    Object.assign(G, { surge: { phase: 'calm', t: 30, k: 0 }, lastBest: 0, stallT: 0, stallMul: 1, chain: 0, chainT: -9, hold: false });
    Object.assign(G.wind, { phase: 'calm', t: 3, power: 0, streaks: [] });
    G.flags = {};
    G.shots = []; G.blasts = []; G.flying = [];
    G.story = { queue: [], cur: null };
    G.guide = new V.Guide(guideApi);
    G.tower.generate(G.cam.y - 1400);
    G.say('ANCIENT SIGNAL', 'The Void swallowed the world below. It is still hungry. Climb, little one.', '#ffd86b', 1.2);
  };
  // A diamond brings you back to the last checkpoint (or the bottom if no beacon was reached
  // yet) with full hearts, keeping this run's height, stats and remaining diamonds
  G.continueRun = () => {
    const cp = G.checkpoint, old = G.P;
    let x = 0, y = -R;
    if (cp) { G.tower.restartFrom(cp, G.ppu()); x = cp.x; y = cp.y - R; }
    else { G.tower.reset(); G.tower.init(G.ppu()); }
    G.P = Object.assign(freshPlayer(x, y), {
      best: old.best, peak: G.meters(y), diamonds: old.diamonds, coins: old.coins, kills: old.kills, time: old.time,
      bag: { ...old.bag }, sel: old.sel, hooks: old.hooks, // you keep everything you carry and your hooks
      zone: cp ? cp.zone : 0, inv: 2, maxHearts: old.maxHearts, hearts: 3, spawnT: 0.4, // reforms from sparkles
    });
    G.tower.flash(x, y, 34);
    G.tower.ring(x, y, '#bff6ff', 60, 0.5, 4);
    G.tower.sparkle(x, y, '#bff6ff', 10, 30);
    Object.assign(G, { voidY: y + 500, voidDelay: 3, banner: null, shake: 0, freeze: 0, shots: [], blasts: [] });
    G.hold = true; // nothing attacks and the Void waits until you move
    Object.assign(G, { surge: { phase: 'calm', t: 18, k: 0 }, lastBest: G.P.peak, stallT: 0, stallMul: 1 });
    Object.assign(G.cam, { y: y - 100, vy: 0, focus: y });
    G.tower.generate(G.cam.y - 1400);
  };

  // ---------- Player movement ----------
  G.updatePlayer = dt => {
    const I = V.input, P = G.P, T = G.tower, r = R;
    if (P.rescue) {
      G.updateRescue(dt);
      P.inv -= dt;
      for (const tr of P.trail) tr.life -= dt;
      P.trail = P.trail.filter(tr => tr.life > 0);
      return;
    }
    const dir = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
    if (P.onGround && P.plat && P.plat.type === 'moving') P.x += P.plat.dx;
    if (P.dashT > 0) {
      P.dashT -= dt;
      P.vx = P.face * PH.DASH; P.vy = 0;
      P.trail.push({ x: P.x, y: P.y, life: 0.2 });
    } else {
      P.vx = V.approach(P.vx, dir * PH.RUN, (P.onGround ? PH.ACC_G : PH.ACC_A) * dt);
      if (dir) { P.face = dir; G.guide.event('move', dt); }
    }
    if (G.wind.power) P.vx += G.wind.dir * G.wind.power * (P.onGround ? 0.3 : 1) * dt;

    if (I.hit('jump')) P.jumpBuf = 0.13;
    P.jumpBuf -= dt; P.coyote -= dt;
    const jumpMul = P.buffs.boots > 0 ? 1.22 : 1, maxJumps = P.buffs.wings > 0 ? 3 : 2;
    if (P.jumpBuf > 0 && !P.hook) {
      if (P.coyote > 0) {
        P.vy = -PH.JUMP * jumpMul; P.coyote = 0; P.jumpBuf = 0; P.jumps = 1; P.onGround = false; P.squash = -0.25;
        T.puff(P.x, P.y + r, 2, 1, 7);
        V.sfx.jump();
      } else if (P.jumps < maxJumps) {
        P.vy = -PH.DJUMP * jumpMul; P.jumps = Math.max(P.jumps, 1) + 1; P.jumpBuf = 0; P.squash = -0.2;
        T.burst(P.x, P.y + r, 10, '#b98cff', 3, 120);
        T.ring(P.x, P.y + r * 0.6, '#c9a2ff', 30, 0.32, 3);
        V.sfx.djump();
        G.guide.event('djump');
      }
    }
    P.dashCd -= dt;
    if (I.hit('chomp') && P.dashCd <= 0 && (P.onGround || P.airDash)) {
      P.dashT = PH.DASH_T; P.dashCd = 0.3; P.mouth = 1;
      if (!P.onGround) P.airDash = false;
      if (dir) P.face = dir;
      V.sfx.dash();
      G.guide.event('dash');
    }
    let g = PH.G;
    if (I.down('jump') && P.vy < 0) g *= 0.55;
    if (P.dashT > 0) g = 0;
    P.vy = Math.min(P.vy + g * dt, PH.MAXFALL);
    P.gliding = !P.onGround && P.dashT <= 0 && I.down('jump') && P.vy > PH.GLIDE;
    if (P.gliding) { P.vy = PH.GLIDE; G.guide.event('glide', dt); }
    if (P.hook) G.hookPull(dt);

    const oldBottom = P.y + r;
    P.x += P.vx * dt; P.y += P.vy * dt;
    if (P.x < -HALF + r) { P.x = -HALF + r; P.vx = Math.max(0, P.vx); }
    if (P.x > HALF - r) { P.x = HALF - r; P.vx = Math.min(0, P.vx); }
    const was = P.onGround, fallV = P.vy;
    P.onGround = false;
    if (P.vy >= 0 && !I.down('down')) {
      for (const p of T.plats) {
        if (p.fallen || P.x + r * 0.7 < p.x || P.x - r * 0.7 > p.x + p.w) continue;
        if (oldBottom <= p.y + 2 && P.y + r >= p.y) {
          P.y = p.y - r; P.vy = 0; P.onGround = true; P.plat = p;
          if (p.type === 'crumble' && p.crumbleT < 0) p.crumbleT = 0.9;
          if (p.beacon && !p.touched) G.lightBeacon(p, true);
          if (p.shop && !p.shopUsed && G.state === 'play') G.openShop(p);
          break;
        }
      }
    }
    if (P.onGround && P.plat.spikes) {
      const s0 = P.plat.x + P.plat.spikes[0], s1 = P.plat.x + P.plat.spikes[1];
      if (P.x + r * 0.5 > s0 && P.x - r * 0.5 < s1) {
        G.hurt((s0 + s1) / 2);
        P.vy = -380; P.onGround = false;
      }
    }
    if (P.onGround) {
      P.coyote = 0.12; P.jumps = 0; P.airDash = true;
      if (!was) { // landing: squash and dust, both bigger the harder you land
        const hard = V.clamp(fallV / 650, 0, 1);
        P.squash = 0.1 + 0.24 * hard;
        T.puff(P.x, P.y + r, hard > 0.6 ? 4 : 2, 1.2, 7 + hard * 5);
      }
    }
    P.inv -= dt;
    if (P.spawnT > 0) P.spawnT -= dt;
    // Jelly spring: the squash overshoots and wobbles back instead of just fading
    P.sqv = ((P.sqv || 0) + ((P.gliding ? 0.16 : 0) - P.squash) * 420 * dt) * Math.exp(-16 * dt);
    P.squash = V.clamp(P.squash + P.sqv * dt, -0.35, 0.4);
    P.mouth = V.damp(P.mouth, 0, 5, dt);
    P.lookX = V.damp(P.lookX, P.face, 8, dt);
    P.lookY = V.damp(P.lookY, V.clamp(P.vy / 500, -1, 1), 8, dt);
    P.best = Math.max(P.best, G.meters(P.y));
    P.peak = Math.max(P.peak, G.meters(P.y));
    for (const tr of P.trail) tr.life -= dt;
    P.trail = P.trail.filter(tr => tr.life > 0);
  };

  // ---------- Combat ----------
  const bounce = v => {
    const P = G.P;
    P.vy = -v; P.jumps = 1; P.airDash = true; P.onGround = false; P.dashT = 0; P.squash = -0.25;
    G.tower.ring(P.x, P.y + P.r, '#fff3b8', 34, 0.3, 3);
  };
  G.hurt = fromX => {
    const P = G.P;
    if (P.inv > 0 || G.state !== 'play') return;
    if (G.absorbHit()) { P.vx = Math.sign(P.x - fromX || 1) * 150; P.vy = Math.min(P.vy, -200); return; }
    P.hearts--; P.inv = 1.3;
    P.vx = Math.sign(P.x - fromX || 1) * 230; P.vy = -300; P.dashT = 0; P.onGround = false;
    G.shake = 10; G.freeze = 0.08;
    G.tower.burst(P.x, P.y, 16, '#8a4dff', 4, 200);
    G.tower.ring(P.x, P.y, '#ff4f7a', 38, 0.35, 4);
    G.tower.splash(P.x, P.y, '#8a4dff', 8, 180);
    V.sfx.hurt();
    if (P.hearts <= 0) G.die('OUT OF HEARTS');
  };
  // how: 'stomp' | 'dash' | 'shot' (bullets, thrown rocks and bombs)
  const damage = (G.damage = (e, how, ex, ey) => {
    const P = G.P, T = G.tower;
    e.hp--; e.hurtT = 0.3;
    G.freeze = how === 'shot' ? 0.03 : 0.06;
    G.shake = Math.max(G.shake, 5);
    if (how !== 'shot') { P.mouth = 1; P.dashT = 0; }
    G.guide.event(how);
    if (e.hp > 0) {
      V.sfx.hit();
      T.burst(ex, ey, 8, '#ffffff', 3, 120);
      T.ring(ex, ey, '#ffffff', e.a * 1.8, 0.25, 3);
      if (e.type === 'saucer') e.vy -= 140;
      return;
    }
    e.dead = true; P.kills++;
    V.sfx.kill();
    if (how === 'stomp') V.sfx.stomp();
    T.kill(e, how, ex, ey); // its death animation (flattened, knocked flying, spiraling down...)
    T.popup(ex, ey - 24, { stomp: 'STOMP!', dash: 'CHOMP!', shot: 'POW!' }[how], '#ffd86b');
    // Kills pay coins (spent at the trader); quick kills in a row add a chain bonus
    G.chain = G.t - G.chainT < 3 ? G.chain + 1 : 1;
    G.chainT = G.t;
    const bonus = Math.min(G.chain - 1, 5), pay = (KILL_COINS[e.type] || 2) + bonus;
    P.coins += pay;
    T.popup(ex, ey - 46, bonus ? `+${pay} COINS  ·  CHAIN x${G.chain}` : `+${pay} COINS`, '#ffcc4d');
    G.flyCoins(ex, ey, pay); // the coins fly up into your coin counter
    V.sfx.coin();
    if (e.type === 'saucer' && V.chance(0.6)) T.addItem(V.chance(0.5) ? 'spread' : 'blaster', ex, ey);
    else if (V.chance(0.12)) T.addItem('heart', ex, ey - 10);
    G.once('kill', () => G.say('GLORP COLONY', 'It took out Gary! Somebody help Gary!', '#9dff6b'));
    G.guide.show('coins', 'Enemies drop coins. Spend them at the trader every 100 m.');
  });
  G.interact = () => {
    const P = G.P, T = G.tower, r = R;
    for (const e of T.enemies) {
      if (e.dead) continue;
      const ex = e.type === 'maw' ? e.hx : e.x, ey = e.type === 'maw' ? e.hy : e.y;
      if (Math.hypot(P.x - ex, P.y - ey) > r + e.a * (P.dashT > 0 ? 1.2 : 0.85)) continue;
      if (e.type === 'jelly') {
        if (P.vy > -50 && P.y < ey) {
          bounce(PH.STOMP * 1.1); e.squish = 1;
          T.burst(ex, ey, 10, e.glow, 4, 120);
          V.sfx.bounce();
          G.guide.event('jelly');
        }
        continue;
      }
      if (e.hurtT > 0) continue;
      const above = P.vy > 0 && P.y < ey - e.a * 0.25;
      const stompable = e.type !== 'spiky';
      if (P.dashT > 0) {
        damage(e, 'dash', ex, ey);
        P.airDash = true;
        if (P.jumps > 1) P.jumps = 1;
        if (!P.onGround) P.vy = -260;
      } else if (above && stompable) {
        damage(e, 'stomp', ex, ey);
        bounce(PH.STOMP);
      } else if (e.type === 'saucer') {
        // Bumping a saucer from the side or below doesn't hurt; you just bounce off it
        P.vx = Math.sign(P.x - ex || 1) * 220;
        P.vy = Math.max(P.vy, 150);
      } else {
        G.hurt(ex);
        if (above) bounce(PH.STOMP * 0.75);
      }
    }
    for (const b of T.bullets) {
      if (b.dead) continue;
      const d = Math.hypot(P.x - b.x, P.y - b.y);
      if (P.dashT > 0 && d < r * 1.8 + b.a) {
        b.dead = true;
        T.burst(b.x, b.y, 8, '#ff4f7a', 3, 100);
        T.popup(b.x, b.y - 16, 'GULP!', '#ff7fc8');
        V.sfx.eat(0.5);
      } else if (d < r * 0.8 + b.a) {
        b.dead = true;
        G.hurt(b.x);
      }
    }
    for (const it of T.items) {
      if (G.state !== 'play') break; // died earlier this frame: no pickups
      if (it.dead || Math.hypot(P.x - it.x, P.y - it.y) > r + it.a + 4) continue;
      if (it.type === 'diamond') {
        if (P.diamonds >= 3) { G.once('diamondsFull', () => T.popup(it.x, it.y - 20, 'DIAMONDS FULL (3/3)', '#9ff3ff')); continue; }
        it.dead = true;
        P.diamonds++;
        T.popup(it.x, it.y - 22, `DIAMOND ${P.diamonds}/3`, '#9ff3ff');
        T.burst(it.x, it.y, 14, '#bff6ff', 3, 160);
        T.ring(it.x, it.y, '#9ff3ff', 44, 0.45, 4);
        T.sparkle(it.x, it.y, '#bff6ff', 8, 26);
        V.sfx.heart();
        G.guide.event('diamond');
        G.guide.show('diamondGot', 'Diamond! If you die, it brings you back to your last checkpoint. You can hold 3.');
        continue;
      }
      if (V.BUFFS[it.type]) { G.tryBuff(it); continue; }
      if (it.type !== 'heart' && it.type !== 'coin') { G.tryPickup(it); continue; }
      it.dead = true;
      if (it.type === 'heart') {
        if (P.hearts < P.maxHearts) P.hearts++;
        T.popup(it.x, it.y - 10, '+1 HEART', '#ff4f7a');
        T.ring(it.x, it.y, '#ff7fa8', 30, 0.35, 3);
        T.sparkle(it.x, it.y, '#ff9ad5', 4, 14);
        V.sfx.heart();
      } else {
        P.coins++;
        G.flyCoins(it.x, it.y, 1);
        T.sparkle(it.x, it.y, '#ffe58a', 2, 8);
        V.sfx.coin();
      }
    }
  };

  // ---------- The rising Void, beacons, zones, wind ----------
  G.updateVoid = dt => {
    if (G.hold) return; // waiting for you to move after a respawn
    const P = G.P, zi = V.zoneAt(P.peak), z = V.ZONES[zi], s = G.surge;
    const frozen = P.buffs.freeze > 0;
    // Stalling makes it hungrier: no new height for ~5 s speeds it up, up to 2x
    if (P.peak > G.lastBest) { G.lastBest = P.peak; G.stallT = 0; } else G.stallT += dt;
    G.stallMul = 1 + V.clamp((G.stallT - 4) / 5, 0, 1) * 1.2;
    // Surges: a warning, then a few seconds of fast rising. More often the higher you are.
    if (G.voidDelay <= 0 && !frozen && (s.t -= dt) <= 0) {
      if (s.phase === 'calm') {
        s.phase = 'warn'; s.t = 2.5;
        V.sfx.surgeWarn();
        G.guide.show('surge', 'The Void is about to SURGE! It rises fast for a few seconds. Climb, or light a beacon to stop it.');
      } else if (s.phase === 'warn') {
        s.phase = 'surge'; s.t = V.rand(4, 5.5);
        V.sfx.surge();
        G.shake = Math.max(G.shake, 8);
        G.once('surge', () => G.say('THE VOID', 'It is getting hungrier.', '#ff4f7a'));
      } else {
        const gap = Math.max(14, 34 - zi * 5);
        s.phase = 'calm'; s.t = V.rand(gap, gap + 10);
      }
    }
    s.k = V.damp(s.k, s.phase === 'surge' ? 1 : s.phase === 'warn' ? 0.4 : 0, 4, dt);
    if (s.phase === 'surge') G.shake = Math.max(G.shake, 2.5);
    // It also gets faster the longer the run lasts: up to +40% after 5 minutes
    const ramp = 1 + Math.min(P.time / 300, 0.4);
    if (G.voidDelay > 0) G.voidDelay -= dt;
    else if (!frozen) G.voidY -= (z.void * ramp * G.stallMul + (s.phase === 'surge' ? 55 + zi * 12 : 0)) * dt;
    G.voidY = Math.min(G.voidY, -P.peak * M + 700); // never far behind your height since the last respawn
    if (!P.rescue && P.y + R * 0.5 > G.voidY) {
      if (!G.absorbHit()) {
        P.hearts--;
        G.shake = 14; G.freeze = 0.1;
        G.tower.burst(P.x, P.y, 20, '#b98cff', 4, 220);
        V.sfx.hurt();
        G.once('voidHit', () => G.say('THE VOID', 'Not yet, little one. Not yet.', '#b98cff'));
        if (P.hearts <= 0) { G.die('THE VOID GOT YOU'); return; }
      }
      rescue();
    }
  };
  // The Void spits you out onto the nearest safe island above it, so you can't get stuck
  // bouncing on it with nothing left to land on
  function rescue() {
    const P = G.P, line = G.voidY - 160;
    let best = null, bs = Infinity;
    for (const p of G.tower.plats) {
      if (p.fallen || p.type === 'crumble' || p.w < 40 || p.y > line) continue;
      const s = (line - p.y) + Math.abs(p.x + p.w / 2 - P.x) * 0.6;
      if (s < bs) { bs = s; best = p; }
    }
    P.vx = 0; P.vy = 0; P.hook = null; P.dashT = 0; P.onGround = false;
    P.inv = Math.max(P.inv, 1.8);
    G.voidY += 100;
    V.sfx.bounce();
    if (!best) { P.vy = -900; return; }
    P.rescue = { x0: P.x, y0: P.y, plat: best, rx: V.clamp(P.x - best.x, 14, best.w - 14), t: 0, dur: 0.75 };
  }
  // Called by player physics while being carried
  G.updateRescue = dt => {
    const P = G.P, s = P.rescue;
    s.t += dt;
    const k = Math.min(1, s.t / s.dur), e = k * k * (3 - 2 * k);
    const tx = s.plat.x + s.rx, ty = s.plat.y - R;
    P.x = V.lerp(s.x0, tx, e);
    P.y = V.lerp(s.y0, ty, e) - Math.sin(k * Math.PI) * 140;
    P.trail.push({ x: P.x, y: P.y, life: 0.2 });
    P.squash = -0.2;
    if (k >= 1) {
      P.rescue = null;
      P.y = ty; P.vx = 0; P.vy = 0;
      P.onGround = true; P.plat = s.plat; P.jumps = 0; P.airDash = true; P.coyote = 0.12;
      G.tower.burst(P.x, P.y + R, 12, '#b98cff', 3, 120);
    }
  };
  // Landing on a beacon's island makes it your checkpoint, gives a heart, pushes the Void back
  // and stops a surge. Only landing counts: climbing past it does not.
  G.lightBeacon = (p, touched = true) => {
    const P = G.P, cx = p.x + p.w / 2;
    const first = !p.lit;
    if (first) {
      p.lit = true;
      G.checkpoint = { x: cx, y: p.y, zone: p.zone };
      G.tower.burst(cx, p.y - 30, 20, '#5fe3ff', 4, 220);
      G.tower.ring(cx, p.y - 34, '#5fe3ff', 110, 0.7, 5);
      G.tower.sparkle(cx, p.y - 50, '#bff6ff', 10, 50);
      V.sfx.tier();
      G.once('beacon', () => G.say('ANCIENT SIGNAL', 'Beacons push the Void back for a while. Only for a while.', '#ffd86b'));
    }
    if (touched && !p.touched) {
      p.touched = true;
      if (P.hearts < P.maxHearts) P.hearts++;
      G.voidY = Math.max(G.voidY, p.y + 600);
      if (G.surge.phase !== 'calm') {
        Object.assign(G.surge, { phase: 'calm', t: V.rand(12, 18) });
        G.tower.popup(cx, p.y - 105, 'SURGE STOPPED', '#5fe3ff');
      }
      G.shake = 6;
    }
    if (first || touched) G.tower.popup(cx, p.y - 80, touched ? 'CHECKPOINT  +1 HEART' : 'CHECKPOINT SAVED', '#5fe3ff');
  };
  G.updateMeta = dt => {
    const P = G.P, w = G.wind;
    P.time += dt;
    const zi = V.zoneAt(P.peak), z = V.ZONES[zi];
    if (zi > P.zone) {
      P.zone = zi;
      G.banner = { text: z.name, sub: `ZONE ${zi + 1}`, t: 2.6 };
      G.guide.zoneFlash = 2.5;
      G.saucerT = Math.max(G.saucerT, 10); // a moment to settle in before the first saucer
      V.sfx.tier();
      if (STORY[zi]) G.say(...STORY[zi]);
    }
    if (z.saucer > 0 && !G.hold) {
      G.saucerT -= dt;
      if (G.saucerT <= 0 && !G.tower.enemies.some(e => e.type === 'saucer' && !e.dead)) { // one at a time
        G.saucerT = z.saucer * V.rand(0.8, 1.3);
        G.tower.addEnemy('saucer', V.clamp(P.x + (V.chance(0.5) ? 1 : -1) * 250, -HALF, HALF), G.cam.y - G.view().h * 0.6);
      }
    }
    if (z.wind > 0 && !G.hold) {
      w.t -= dt;
      if (w.t <= 0) {
        if (w.phase === 'calm') { w.phase = 'warn'; w.t = 1.0; w.dir = V.chance(0.5) ? 1 : -1; }
        else if (w.phase === 'warn') { w.phase = 'gust'; w.t = V.rand(1.5, 2.3); V.sfx.wind(); }
        else { w.phase = 'calm'; w.t = V.rand(2.5, 4.5); }
      }
      w.power = w.phase === 'gust' ? 750 * z.wind : 0;
    } else {
      w.phase = 'calm'; w.power = 0;
    }
    if (zi === 3) {
      G.thunderT -= dt;
      if (G.thunderT <= 0) { G.thunderT = V.rand(3, 7); G.flash = 0.18; V.sfx.thunder(); }
    }
  };
})();
