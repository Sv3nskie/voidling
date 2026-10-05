// Voidling tower: an endless vertical shaft of floating platforms, generated zone by zone
(() => {
  const V = window.V;
  const HALF = (V.HALF = 340); // half width of the climbable shaft
  const TOWER_SEED = 20261004;  // change this to build a different tower (for everyone)
  const BEACON_DEPTH = 90, BEACON_W = 170;
  // Diamonds and trading posts are extras layered on top of the level, with their own seed
  const EXTRAS_SEED = TOWER_SEED * 3 + 101, EXTRAS_LAG = 450;
  const M = (V.M = 10);        // world units per meter

  // Difficulty per zone. gap = vertical distance between platforms, w = platform width.
  V.ZONES = [
    { at: 0, name: 'THE CANYON', gap: [60, 92], w: [130, 200], moving: 0, crumble: 0, spike: 0, walker: 0.4, spiky: 0, maw: 0, bat: 0.05, jelly: 0, saucer: 0, wind: 0, void: 18 },
    { at: 100, name: 'FLOATING ISLES', gap: [70, 112], w: [100, 165], moving: 0.1, crumble: 0.22, spike: 0.15, walker: 0.4, spiky: 0.3, maw: 0.12, bat: 0.2, jelly: 0.14, saucer: 0, wind: 0, void: 28 },
    { at: 300, name: 'ASTEROID BELT', gap: [80, 125], w: [80, 140], moving: 0.35, crumble: 0.2, spike: 0.25, walker: 0.35, spiky: 0.4, maw: 0.15, bat: 0.3, jelly: 0.2, saucer: 24, wind: 0, void: 36 },
    { at: 600, name: 'THE STORM WALL', gap: [95, 140], w: [46, 82], moving: 0.25, crumble: 0.45, spike: 0.35, walker: 0.25, spiky: 0.55, maw: 0.1, bat: 0.4, jelly: 0.3, saucer: 17, wind: 1, void: 44 },
    { at: 900, name: 'THE STARFIELD', gap: [85, 130], w: [70, 130], moving: 0.35, crumble: 0.3, spike: 0.3, walker: 0.3, spiky: 0.45, maw: 0.15, bat: 0.35, jelly: 0.25, saucer: 20, wind: 0.45, void: 50 },
  ];
  V.zoneAt = m => {
    let i = 0;
    while (i + 1 < V.ZONES.length && m >= V.ZONES[i + 1].at) i++;
    return i;
  };

  const P_ = V.ISLAND_PALS; // lavender, moss, frost, ember
  const ASTEROID = { rockTop: '#5a5070', rockBot: '#221c34', top: '#9a90b8', topHi: '#d0c8e8', gem: '#5fe3ff' };
  const STORM = { rockTop: '#3a2a5a', rockBot: '#120a24', top: '#ff6fb0', topHi: '#ffc0dc', gem: '#ff4f7a' };
  const ZONE_PALS = [[P_[1], P_[3]], [P_[0], P_[1]], [ASTEROID, P_[2]], [STORM, ASTEROID], [P_[0], P_[2], STORM]];
  const ALIEN_COLORS = ['#9dff6b', '#ffd23f', '#ff8ad8', '#6bf0ff'];
  const JELLIES = [{ color: '#8ff0ff', glow: '#5fe3ff' }, { color: '#ff9ad5', glow: '#ff7fc8' }];
  // Soft nebula puff used to hide secret ledges
  const CLOUD = document.createElement('canvas');
  CLOUD.width = CLOUD.height = 128;
  {
    const g = CLOUD.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(46,18,80,0.95)');
    gr.addColorStop(0.6, 'rgba(40,14,70,0.7)');
    gr.addColorStop(1, 'rgba(30,10,55,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  // The shaded body of an island's 3D slab: its sprite with the grassy cap painted one flat,
  // slightly darker grass color (the lit top surface, smooth when the copies stack up) and the
  // rock darkened down its sides. Made once per sprite.
  const slab = spr => {
    if (spr.slab) return spr.slab;
    const c = document.createElement('canvas');
    c.width = spr.canvas.width; c.height = spr.canvas.height;
    const g = c.getContext('2d'), k = c.height / spr.sh, capH = spr.capH;
    g.drawImage(spr.canvas, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = V.mixHex(spr.cap, '#1a0830', 0.24);
    g.fillRect(0, 0, c.width, (spr.oy + capH * 0.7) * k);
    const rock = g.createLinearGradient(0, (spr.oy + capH * 0.7) * k, 0, c.height);
    rock.addColorStop(0, 'rgba(22,8,44,0.55)');
    rock.addColorStop(1, 'rgba(14,4,30,0.72)');
    g.fillStyle = rock;
    g.fillRect(0, (spr.oy + capH * 0.7) * k, c.width, c.height);
    return (spr.slab = c);
  };

  V.Tower = class {
    constructor() { this.reset(); }
    reset() {
      this.plats = []; this.enemies = []; this.items = []; this.bullets = []; this.clouds = [];
      this.particles = []; this.popups = [];
      this.seed = 1; this.genY = 0; this.last = null; this.zoneMade = 0; this.rows = 0;
      this.rowLog = []; this.xZone = -1; this.xseed = 500000;
    }
    // ---------- Fixed seed: every player climbs the exact same tower ----------
    // Each zone restarts the generator from its own seed, so a continue from a beacon
    // rebuilds the same platforms you saw before.
    reseed(zone) {
      this.rng = V.rng(TOWER_SEED + zone * 7777);
      this.seed = 1 + zone * 1000;
      this.bag = [];
      if (this.building) V.random = this.rng;
    }
    seeded(fn) {
      const prev = V.random;
      this.building = true;
      V.random = this.rng;
      try { return fn(); } finally { V.random = prev; this.building = false; }
    }
    init(ppu) {
      this.ppu = ppu;
      this.reseed(0);
      this.seeded(() => {
        this.addPlat(-HALF - 80, 0, HALF * 2 + 160, 'solid', { depth: 170, pal: P_[1], zone: 0 });
        this.addItem('rock', 90, -12); // something to throw right away
      });
      this.last = { cx: 0, y: 0, w: 160 };
      this.genY = 0;
    }
    // Continue from a beacon: wipe everything and rebuild upward from it
    restartFrom(cp, ppu) {
      this.reset();
      this.ppu = ppu;
      this.reseed(cp.zone);
      const p = this.seeded(() => this.addPlat(cp.x - BEACON_W / 2, cp.y, BEACON_W, 'solid', { beacon: true, zone: cp.zone, depth: BEACON_DEPTH }));
      p.lit = true; p.touched = true;
      this.rowLog.push({ p, cx: cp.x, w: BEACON_W, y: cp.y, zi: cp.zone, jelly: false });
      this.last = { cx: cp.x, y: cp.y, w: BEACON_W };
      this.genY = cp.y;
      this.zoneMade = cp.zone;
      this.rows = 1000; // past the early-game rows, same as the first time through
      return p;
    }

    // ---------- Generation ----------
    // o.depth = rock depth (chunky by default); o.amp = moving range
    addPlat(x, y, w, type, o = {}) {
      const depth = o.depth || this.rockDepth(w);
      const pal = o.pal || V.pick(ZONE_PALS[o.zone || 0]);
      const amp = type === 'moving' ? o.amp : 0;
      const p = {
        x, y, w, depth, type, baseX: x, amp, speed: 0, phase: V.random() * 6.28, dx: 0,
        sx0: x - amp, sx1: x + w + amp, // horizontal space it ever covers
        crumbleT: -1, fallen: false, fallY: 0, fallV: 0, respawnT: 0, spikes: null,
        beacon: !!o.beacon, lit: false, zone: o.zone || 0, extra: !!o.extra,
        spr: V.makeIslandSprite(w, depth, (o.extra ? this.xseed++ : this.seed++) * 7919, pal, this.ppu),
        cracks: null,
      };
      if (type === 'moving') p.speed = V.rand(0.8, 1.5);
      if (type === 'crumble') {
        const rnd = V.rng(p.phase * 1000);
        p.cracks = [];
        for (let i = 0; i < 3; i++) {
          let cx = w * (0.2 + i * 0.3 + (rnd() - 0.5) * 0.1), cy = 0;
          const line = [[cx, cy]];
          for (let k = 0; k < 4; k++) { cx += (rnd() - 0.5) * w * 0.15; cy += depth * 0.15; line.push([cx, cy]); }
          p.cracks.push(line);
        }
      }
      this.plats.push(p);
      return p;
    }
    addEnemy(type, x, y, o = {}) {
      const e = { type, x, y, hp: 1, dead: false, phase: V.random() * 6.28, dir: V.chance(0.5) ? 1 : -1, hurtT: 0 };
      if (type === 'walker' || type === 'spiky') {
        Object.assign(e, { a: 13, plat: o.plat, speed: V.rand(35, 60), color: type === 'spiky' ? '#ff9a5a' : V.pick(ALIEN_COLORS), eyes: V.pick([1, 2, 3]), spikes: type === 'spiky', turnT: V.rand(1, 3) });
        e.y = o.plat.y - e.a * 0.85;
      } else if (type === 'maw') {
        Object.assign(e, { a: 16, plat: o.plat, island: o.plat, hp: 1, lean: 0, open: 0.2, bite: 0, hx: x, hy: y - 42 });
      } else if (type === 'jelly') {
        const st = V.pick(JELLIES);
        Object.assign(e, { a: 15, baseX: x, baseY: y, color: st.color, glow: st.glow, squish: 0 });
      } else if (type === 'bat') {
        Object.assign(e, { a: 13, baseX: x, baseY: y, vx: 0, vy: 0, swoopT: 0, restT: V.rand(0.5, 2) });
      } else if (type === 'saucer') {
        // One hit kills it; its first shot comes 3.5 s after it appears
        Object.assign(e, { a: 20, hp: 1, vx: 0, vy: 0, fireT: 3.5, life: V.rand(13, 16), t: 0, shots: 0, charging: false });
      }
      this.enemies.push(e);
      return e;
    }
    addItem(type, x, y) {
      const a = { heart: 9, coin: 6, rock: 9, bomb: 10, diamond: 12 }[type] ?? 14;
      this.items.push({ type, x, y, a, phase: V.random() * 6.28 });
    }
    coinArc(x0, y0, x1, y1) {
      const n = 5, top = Math.min(y0, y1) - 70;
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / (n + 1);
        const y = V.lerp(y0, y1, t) - 30 - Math.sin(t * Math.PI) * (V.lerp(y0, y1, t) - top) * 0.6;
        this.addItem('coin', V.lerp(x0, x1, t), y);
      }
    }

    // Is this point inside an island's rock? Shots stop there (you can still jump up through).
    solidAt(x, y) {
      for (const p of this.plats) {
        if (!p.fallen && x >= p.x && x <= p.x + p.w && y >= p.y - 2 && y <= p.y + p.depth * 0.7) return p;
      }
      return null;
    }
    // Space check so islands never overlap: how deep a platform covering x0..x1 with its top
    // at y may hang before crowding the platform below (leaving standing room), and whether
    // a platform above already hangs down into its standing room.
    // The level generator never sees the extras (opts.extras), so they can't move an island.
    room(x0, x1, y, opts = {}) {
      let maxD = Infinity, clear = true;
      const minZone = opts.zone ?? this.zoneMade;
      for (const q of this.plats) {
        // Earlier zones are ignored so a continue from a beacon rebuilds the exact same zone
        if (q.zone < minZone || (q.extra && !opts.extras) || q.sx0 > x1 + 14 || q.sx1 < x0 - 14) continue;
        if (q.y > y) maxD = Math.min(maxD, q.y - y - (q.beacon ? 84 : 52));
        else if (q.y + q.depth > y - 52) clear = false;
      }
      return { maxD, clear };
    }

    generate(topY) {
      if (this.genY > topY) this.seeded(() => { while (this.genY > topY) this.row(); });
      this.extras();
    }
    // Islands always get a chunky rock body, like the reference art
    rockDepth(w) { return w * V.rand(0.42, 0.6); }

    // Find a spot within jumping reach where an island fits with its full rock body. If none
    // fits, lift it a little (still reachable), then shrink the whole island evenly. The rock
    // is never flattened.
    place(prev, w, depth, gap, maxGap, edgeReach, amp) {
      let last = null;
      for (let attempt = 0; attempt < 7; attempt++) {
        const y = prev.y - Math.min(gap + attempt * 16, Math.max(gap, maxGap));
        const lo = -HALF + w / 2 + 10 + amp, hi = HALF - w / 2 - 10 - amp;
        const reach = (w + prev.w) / 2 + edgeReach; // center-to-center, so edges stay within a jump
        for (let i = 0; i < 12; i++) {
          const cx = V.clamp(prev.cx + V.rand(-1, 1) * reach, lo, hi);
          const s = this.room(cx - w / 2 - amp, cx + w / 2 + amp, y);
          last = { cx, y, w, depth };
          if (s.clear && s.maxD >= depth) return last;
        }
        if (attempt >= 2) { w *= 0.88; depth *= 0.88; }
      }
      this.misfits = (this.misfits || 0) + 1;
      return last;
    }

    row() {
      const prev = this.last;
      const zi = V.zoneAt(-prev.y / M), z = V.ZONES[zi];
      // A beacon platform opens every new zone
      if (zi > this.zoneMade) {
        const spot = this.place(prev, BEACON_W, BEACON_DEPTH, 80, 150, 90, 0);
        this.zoneMade = zi;
        this.reseed(zi);
        const b = this.addPlat(spot.cx - BEACON_W / 2, spot.y, BEACON_W, 'solid', { beacon: true, zone: zi, depth: BEACON_DEPTH });
        this.rowLog.push({ p: b, cx: spot.cx, w: BEACON_W, y: spot.y, zi, jelly: false });
        this.last = { cx: spot.cx, y: spot.y, w: BEACON_W };
        this.genY = spot.y;
        return;
      }
      const jelly = prev.y < -400 && V.chance(z.jelly);
      const gap = jelly ? V.rand(170, 215) : V.rand(z.gap[0], z.gap[1]);
      let type = 'solid';
      if (!jelly) { if (V.chance(z.moving)) type = 'moving'; else if (V.chance(z.crumble)) type = 'crumble'; }
      const amp = type === 'moving' ? V.rand(50, 110) : 0;
      const w0 = V.rand(z.w[0], z.w[1]);
      const spot = this.place(prev, w0, this.rockDepth(w0), gap, jelly ? gap : 150, jelly ? 20 : 110, amp);
      const { cx, y, w } = spot;
      const p = this.addPlat(cx - w / 2, y, w, type, { zone: zi, amp, depth: spot.depth });
      this.rowLog.push({ p, cx, w, y, zi, jelly });
      if (jelly) this.addEnemy('jelly', (prev.cx + cx) / 2, (prev.y + y) / 2);
      this.decorate(p, z, false);
      if (++this.rows === 9) this.addItem('blaster', cx, y - 30); // first gun comes early
      else if (this.rows > 4 && V.chance(0.2)) this.secret(cx, w, y, zi);
      if (V.chance(0.35)) this.coinArc(prev.cx, prev.y, cx, y);
      // Optional side island for variety (never needed to progress); skipped if it would crowd
      if (!jelly && V.chance(0.45)) {
        const bw = V.rand(z.w[0], z.w[1]) * 0.85, bd = this.rockDepth(bw);
        for (let i = 0; i < 4; i++) {
          const bx = V.rand(-HALF + 10, HALF - 10 - bw), by = y + V.rand(-40, 30);
          const s = this.room(bx, bx + bw, by);
          if (!s.clear || s.maxD < bd) continue;
          this.decorate(this.addPlat(bx, by, bw, 'solid', { zone: zi, depth: bd }), z, true);
          break;
        }
      }
      if (V.chance(z.bat)) this.addEnemy('bat', V.rand(-HALF + 60, HALF - 60), y + (prev.y - y) * 0.5);
      this.last = { cx, y, w };
      this.genY = y;
    }
    // A power-up in a hard-to-reach spot: a small ledge far off the main path, hidden in a
    // cloud (needs jump + double jump + air dash), or floating high above the platform.
    secret(cx, w, y, zi) {
      if (!this.bag.length) this.bag = V.buffBag(zi);
      const buff = this.bag.pop(), lw = 58;
      const gap = V.rand(170, 215), ly = y - V.rand(20, 70);
      const right = cx + w / 2 + gap, left = cx - w / 2 - gap - lw;
      const options = [];
      if (right + lw <= HALF - 4) options.push(right);
      if (left >= -HALF + 4) options.push(left);
      const lx = options.length ? V.pick(options) : null;
      const ld = this.rockDepth(lw) * 1.3; // a stubby rock pillar
      const s = lx === null ? null : this.room(lx - 20, lx + lw + 20, ly);
      if (s && s.clear && s.maxD >= ld) {
        this.addPlat(lx, ly, lw, 'solid', { zone: zi, depth: ld });
        this.addItem(buff, lx + lw / 2, ly - 28);
        const blobs = [];
        for (let i = 0; i < 7; i++) blobs.push([V.rand(-55, 55), V.rand(-45, 30), V.rand(45, 75)]);
        this.clouds.push({ x: lx + lw / 2, y: ly - 20, blobs });
      } else {
        this.addItem(buff, V.clamp(cx + V.rand(-w / 2, w / 2), -HALF + 24, HALF - 24), y - V.rand(150, 178));
      }
    }

    // ---------- Extras: diamonds and trading posts, layered on top of the level ----------
    // They use their own random numbers, are added to a row only once the rows above it exist,
    // and the level generator never looks at them. So the islands, enemies and items stay
    // exactly where they were before these features existed.
    extras() {
      while (this.rowLog.length && this.rowLog[0].y > this.genY + EXTRAS_LAG) {
        const r = this.rowLog.shift();
        if (r.zi !== this.xZone) { // each zone starts its extras fresh (same after a continue)
          this.xZone = r.zi;
          this.xrng = V.rng(EXTRAS_SEED + r.zi * 911);
          this.diamondDue = V.ZONES[r.zi].at + 30 + this.xrng() * 25;
          this.shopDue = V.ZONES[r.zi].at + 100;
        }
        const prev = V.random;
        V.random = this.xrng;
        try { this.extra(r); } finally { V.random = prev; }
      }
    }
    extra(r) {
      const m = -r.y / M, p = r.p;
      // Trading post: shares the beacon island at 100, 300, 600 and 900 m; otherwise the first
      // solid island at or after each 100 m mark (its enemies and spikes are cleared away)
      const nextZone = V.ZONES[r.zi + 1] ? V.ZONES[r.zi + 1].at : Infinity;
      if (p.beacon) p.shop = V.ZONES[r.zi].at / 100;
      else if (!r.jelly && this.shopDue < nextZone && m >= this.shopDue) {
        // On this island if it's solid and wide enough, else on a small market island added
        // beside it within easy jumping distance; else the next row tries again
        const host = p.type === 'solid' && r.w >= 60 ? p : this.marketIsland(r);
        if (host) {
          host.shop = this.shopDue / 100;
          this.shopDue += 100;
          host.spikes = null;
          for (const e of this.enemies) if (e.plat === host) e.dead = true;
        }
      }
      if (!p.beacon && !p.shop && m >= this.diamondDue && this.placeDiamond(r)) this.diamondDue = m + V.rand(70, 110);
    }
    marketIsland(r) {
      const lw = 96, ld = this.rockDepth(lw);
      for (let i = 0; i < 6; i++) {
        const gap = V.rand(40, 95), ly = r.y - V.rand(-15, 45);
        const lx = i % 2 ? r.cx + r.w / 2 + r.p.amp + gap : r.cx - r.w / 2 - r.p.amp - gap - lw;
        if (lx < -HALF + 4 || lx + lw > HALF - 4) continue;
        const s = this.room(lx - 10, lx + lw + 10, ly, { zone: r.zi, extras: true });
        if (s.clear && s.maxD >= ld) return this.addPlat(lx, ly, lw, 'solid', { zone: r.zi, depth: ld, extra: true });
      }
      return null;
    }
    // A diamond goes right over a spike strip, high above the island (needs a full double
    // jump), or on a small hidden ledge off to the side. Returns false to try the next row.
    placeDiamond(r) {
      const p = r.p, roll = V.random();
      if (p.spikes && roll < 0.6) { this.addItem('diamond', p.x + (p.spikes[0] + p.spikes[1]) / 2, p.y - 40); return true; }
      if (roll < 0.55) {
        const x = V.clamp(r.cx + V.rand(-r.w / 2, r.w / 2), -HALF + 24, HALF - 24), y = r.y - V.rand(150, 175);
        if (!this.solidAt(x, y) && !this.solidAt(x, y + 14)) { this.addItem('diamond', x, y); return true; }
      }
      const lw = 58, gap = V.rand(170, 215), ly = r.y - V.rand(20, 70);
      const right = r.cx + r.w / 2 + gap, left = r.cx - r.w / 2 - gap - lw;
      const options = [];
      if (right + lw <= HALF - 4) options.push(right);
      if (left >= -HALF + 4) options.push(left);
      const lx = options.length ? V.pick(options) : null, ld = this.rockDepth(lw) * 1.3;
      const s = lx === null ? null : this.room(lx - 20, lx + lw + 20, ly, { zone: r.zi, extras: true });
      if (!s || !s.clear || s.maxD < ld) return false;
      this.addPlat(lx, ly, lw, 'solid', { zone: r.zi, depth: ld, extra: true });
      this.addItem('diamond', lx + lw / 2, ly - 28);
      const blobs = [];
      for (let i = 0; i < 7; i++) blobs.push([V.rand(-55, 55), V.rand(-45, 30), V.rand(45, 75)]);
      this.clouds.push({ x: lx + lw / 2, y: ly - 20, blobs });
      return true;
    }
    decorate(p, z, branch) {
      const room = p.w >= 90 && p.type !== 'moving';
      if (room && V.chance(z.spike)) {
        const sw = p.w * V.rand(0.25, 0.38);
        p.spikes = V.chance(0.5) ? [6, 6 + sw] : [p.w - 6 - sw, p.w - 6];
      }
      if (room && p.type === 'solid') {
        const roll = V.random();
        if (roll < z.maw && p.w >= 110) this.addEnemy('maw', p.x + p.w * V.rand(0.3, 0.7), p.y, { plat: p });
        else if (roll < z.maw + z.walker) this.addEnemy(V.chance(z.spiky) ? 'spiky' : 'walker', p.x + p.w * 0.5, p.y, { plat: p });
      }
      if (V.chance(0.3)) {
        const n = Math.max(2, Math.floor(p.w / 30));
        for (let i = 0; i < n; i++) this.addItem('coin', p.x + (i + 0.5) * p.w / n, p.y - 22);
      }
      if (V.chance(branch ? 0.08 : 0.035)) this.addItem('heart', p.x + p.w / 2, p.y - 26);
      // Things to throw and shoot
      const zi = V.ZONES.indexOf(z), spot = () => p.x + p.w * V.rand(0.2, 0.8);
      if (V.chance(0.2)) this.addItem('rock', spot(), p.y - 12);
      else if (zi >= 2 && V.chance(0.06)) this.addItem('bomb', spot(), p.y - 13);
      if (zi >= 1 && V.chance(branch ? 0.1 : 0.05)) this.addItem(zi >= 2 && V.chance(0.5) ? 'spread' : 'blaster', p.x + p.w / 2, p.y - 32);
    }

    cull(voidY) {
      const gone = y => y > voidY + 160;
      this.plats = this.plats.filter(p => !gone(p.y));
      this.enemies = this.enemies.filter(e => !e.dead && !gone(e.y) && !(e.plat && gone(e.plat.y)));
      this.items = this.items.filter(i => !i.dead && !gone(i.y));
      this.clouds = this.clouds.filter(c => !gone(c.y));
    }

    // ---------- Simulation ----------
    // frozen: right after a respawn nothing moves or attacks until you do
    update(dt, t, P, frozen = false) {
      for (const p of this.plats) {
        if (p.type === 'moving') {
          const nx = p.baseX + Math.sin(t * p.speed + p.phase) * p.amp;
          p.dx = nx - p.x;
          p.x = nx;
        } else if (p.type === 'crumble') {
          if (p.crumbleT > 0) {
            p.crumbleT -= dt;
            if (p.crumbleT <= 0) {
              p.fallen = true; p.fallV = 0; p.fallY = 0; p.respawnT = 3;
              this.burst(p.x + p.w / 2, p.y + 8, 14, p.spr ? '#8a6a7a' : '#ffffff', 5, 160);
              V.sfx.crumble();
            }
          }
          if (p.fallen) {
            p.fallV += 900 * dt;
            p.fallY += p.fallV * dt;
            p.respawnT -= dt;
            if (p.respawnT <= 0) { p.fallen = false; p.fallY = 0; p.crumbleT = -1; }
          }
        }
      }
      for (const e of frozen ? [] : this.enemies) {
        if (e.dead) continue;
        e.hurtT -= dt;
        if (e.type === 'walker' || e.type === 'spiky') {
          const pl = e.plat;
          e.turnT -= dt;
          if (e.turnT <= 0) { e.turnT = V.rand(1.5, 4); if (V.chance(0.4)) e.dir *= -1; }
          e.x += e.dir * e.speed * dt;
          if (e.x < pl.x + e.a) { e.x = pl.x + e.a; e.dir = 1; }
          else if (e.x > pl.x + pl.w - e.a) { e.x = pl.x + pl.w - e.a; e.dir = -1; }
          e.y = pl.y - e.a * 0.85;
        } else if (e.type === 'maw') {
          const restY = e.plat.y - e.a * 2.6;
          const dx = P.x - e.x, dy = P.y - restY;
          const hungry = Math.hypot(dx, dy) < 95;
          e.bite = V.damp(e.bite, hungry ? 1 : 0, 6, dt);
          e.lean = V.damp(e.lean, hungry ? V.clamp(dx / 50, -1.5, 1.5) : Math.sin(t * 0.8 + e.phase) * 0.3, 5, dt);
          e.open = hungry ? 0.5 + 0.5 * Math.abs(Math.sin(t * 7)) : 0.25 + 0.15 * Math.sin(t * 2 + e.phase);
          e.hx = e.x + e.lean * e.a * 0.9;
          e.hy = restY + Math.sin(t * 1.5 + e.phase) * 2 + V.clamp(dy, -e.a, e.a * 1.2) * 0.5 * e.bite;
          e.y = e.hy;
        } else if (e.type === 'jelly') {
          e.x = e.baseX + Math.sin(t * 0.8 + e.phase) * 14;
          e.y = e.baseY + Math.sin(t * 1.6 + e.phase) * 8 + e.squish * 10;
          e.squish = V.damp(e.squish, 0, 6, dt);
        } else if (e.type === 'bat') {
          const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
          if (e.swoopT > 0) {
            e.swoopT -= dt;
            e.vx = V.damp(e.vx, dx / d * 190, 4, dt);
            e.vy = V.damp(e.vy, dy / d * 190, 4, dt);
            if (e.swoopT <= 0) e.restT = V.rand(1.5, 2.5);
          } else {
            e.restT -= dt;
            const hx = e.baseX + Math.sin(t * 0.9 + e.phase) * 80, hy = e.baseY + Math.sin(t * 2 + e.phase) * 10;
            e.vx = V.damp(e.vx, (hx - e.x) * 2, 3, dt);
            e.vy = V.damp(e.vy, (hy - e.y) * 2, 3, dt);
            if (e.restT <= 0 && d < 170) e.swoopT = 1.1;
          }
          e.x += e.vx * dt; e.y += e.vy * dt;
        } else if (e.type === 'saucer') {
          // Drifts down to hover within double-jump reach and glows red before each shot.
          // It never climbs: once you are above it you are safe and it flies off sideways.
          // It also leaves after 3 shots.
          e.t += dt; e.life -= dt;
          if (!e.passed && P.y < e.y - 30) e.passed = true;
          const leaving = (e.leaving = e.passed || e.life <= 0 || e.shots >= 3);
          const tx = leaving ? e.x + (e.x > 0 ? 1 : -1) * 600 : P.x + Math.sin(e.t * 0.7) * 90;
          const ty = leaving ? e.y + 30 : Math.max(e.y, P.y - 130); // y grows downward: never up
          const sp = leaving ? 170 : 95;
          const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
          e.vx = V.damp(e.vx, dx / d * Math.min(sp, d * 1.5), 1.6, dt);
          e.vy = Math.max(0, V.damp(e.vy, dy / d * Math.min(sp, d * 1.5), 1.6, dt));
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (!leaving) {
            e.fireT -= dt;
            if (e.fireT <= 0.7 && !e.charging) { e.charging = true; V.sfx.charge(); }
            if (e.fireT <= 0) {
              e.fireT = V.rand(2.6, 3.4); e.charging = false; e.shots++;
              const bx = P.x - e.x, by = P.y - e.y, bd = Math.hypot(bx, by) || 1;
              this.bullets.push({ x: e.x, y: e.y + 8, vx: bx / bd * 165, vy: by / bd * 165, a: 5, life: 5 });
              V.sfx.zap();
            }
          } else {
            e.charging = false;
          }
          if (e.life < -8 || Math.abs(e.x) > HALF + 300 || e.y > P.y + 1200) e.dead = true;
        }
      }
      for (const b of this.bullets) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (this.solidAt(b.x, b.y)) { b.dead = true; this.burst(b.x, b.y, 5, '#ff4f7a', 3, 60); } // islands are cover
      }
      this.bullets = this.bullets.filter(b => b.life > 0 && !b.dead);
      const fr = Math.exp(-5 * dt);
      for (const p of this.particles) {
        p.vx *= fr; p.vy = p.vy * fr + (p.g || 0) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= dt;
      }
      this.particles = this.particles.filter(p => p.life > 0);
      for (const u of this.popups) { u.y -= 30 * dt; u.life -= dt; }
      this.popups = this.popups.filter(u => u.life > 0);
    }
    burst(x, y, n, color, size, speed, g = 0, life = 0.6) {
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * 6.283, sp = speed * V.rand(0.3, 1);
        this.particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g, life: life * V.rand(0.6, 1.2), max: life, size: size * V.rand(0.5, 1.2), color });
      }
      if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
    }
    popup(x, y, text, color) { this.popups.push({ x, y, text, color, life: 0.9 }); }

    // ---------- Rendering (world space) ----------
    draw(ctx, t, box, P) {
      const vis = (x, y, m) => x + m > box.x0 && x - m < box.x1 && y + m > box.y0 && y - m < box.y1;
      // 3D depth: every island is a thick slab. Darker copies of its sprite are stacked toward
      // the middle of the screen, so you see the top of islands below you, the underside of
      // islands above you and the inner side of islands near the edges. All slabs go first,
      // so no slab ever covers another island's face.
      if (V.settings.depth) {
        const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
        for (const p of this.plats) {
          if (p.fallen || !vis(p.x + p.w / 2, p.y + p.depth / 2, p.w + 40)) continue;
          const dx = V.clamp((cx - p.x - p.w / 2) * 0.03, -11, 11), dy = V.clamp((cy - p.y) * 0.045, -11, 11);
          const n = Math.min(3, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3)); // ≤ 3 copies: cheap on phones
          const back = slab(p.spr), ox = p.crumbleT > 0 ? Math.sin(t * 70) * (1 + (1 - p.crumbleT / 0.9) * 3) : 0;
          for (let i = n; i >= 1; i--) ctx.drawImage(back, p.x - p.spr.ox + ox + dx * i / n, p.y - p.spr.oy + p.fallY + dy * i / n, p.spr.sw, p.spr.sh);
        }
      }
      for (const p of this.plats) {
        if (!vis(p.x + p.w / 2, p.y + p.depth / 2, p.w + 40) || p.fallY > 500) continue;
        // Crumbling platforms shake harder the closer they are to breaking
        const ox = p.crumbleT > 0 ? Math.sin(t * 70) * (1 + (1 - p.crumbleT / 0.9) * 3) : 0, oy = p.fallY;
        ctx.globalAlpha = p.fallen ? Math.max(0, 1 - p.fallY / 300) : 1;
        if (p.type === 'moving') {
          V.drawGlow(ctx, p.x + 14, p.y + p.depth * 0.45, 20, '#5fe3ff', 0.6 + 0.3 * Math.sin(t * 20));
          V.drawGlow(ctx, p.x + p.w - 14, p.y + p.depth * 0.45, 20, '#5fe3ff', 0.6 + 0.3 * Math.sin(t * 20 + 1));
        }
        ctx.drawImage(p.spr.canvas, p.x - p.spr.ox + ox, p.y - p.spr.oy + oy, p.spr.sw, p.spr.sh);
        if (p.cracks) {
          ctx.strokeStyle = 'rgba(20,5,30,0.85)'; ctx.lineWidth = 2;
          for (const line of p.cracks) {
            ctx.beginPath();
            line.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p.x + x + ox, p.y + y + oy));
            ctx.stroke();
          }
        }
        if (p.spikes) V.drawSpikes(ctx, p.x + p.spikes[0], p.x + p.spikes[1], p.y + oy - 2, t);
        if (p.beacon) V.drawBeacon(ctx, p.x + p.w / 2, p.y + oy - 2, p.lit, t);
        // Trading post stall: beside the beacon crystal, or in the middle; scaled to fit the island
        if (p.shop) V.drawShop(ctx, p.beacon ? p.x + p.w - 40 : p.x + p.w / 2, p.y + oy - 2, t, p.shopUsed,
          p.beacon ? 0.72 : V.clamp((p.w - 10) / 80, 0.6, 1));
        ctx.globalAlpha = 1;
      }
      for (const it of this.items) {
        if (!vis(it.x, it.y, 30)) continue;
        const bob = Math.sin(t * 3 + it.phase) * 3;
        if (it.type === 'heart') {
          V.drawGlow(ctx, it.x, it.y + bob, 26, '#ff4f7a', 0.5);
          V.drawHeart(ctx, it.x, it.y + bob, it.a);
        } else if (it.type === 'diamond') {
          V.drawDiamond(ctx, it.x, it.y + bob, 12, t);
        } else if (V.BUFFS[it.type]) {
          V.drawBuff(ctx, it, t);
        } else if (it.type !== 'coin') {
          V.drawPickup(ctx, it, t);
        } else {
          V.drawFood(ctx, { type: 'coin', x: it.x, y: it.y, a: it.a, phase: it.phase }, t);
        }
      }
      for (const e of this.enemies) {
        if (e.dead || !vis(e.x, e.y, 60)) continue;
        if (e.hurtT > 0 && Math.floor(t * 30) % 2) continue;
        if (e.type === 'walker' || e.type === 'spiky') V.drawWalker(ctx, e, t, false);
        else if (e.type === 'maw') V.drawMaw(ctx, e, t, e.bite > 0.5);
        else if (e.type === 'jelly') V.drawFlyer(ctx, e, t, false);
        else if (e.type === 'bat') V.drawBat(ctx, e, t);
        else if (e.type === 'saucer') V.drawSaucer(ctx, e, t, false);
      }
      for (const b of this.bullets) if (vis(b.x, b.y, 20)) V.drawBullet(ctx, b);
      // Secret clouds clear up as you get close
      for (const c of this.clouds) {
        if (!vis(c.x, c.y, 140)) continue;
        const d = P ? Math.hypot(P.x - c.x, P.y - c.y) : 999;
        ctx.globalAlpha = V.clamp((d - 70) / 130, 0.08, 0.92);
        for (const [ox, oy, r] of c.blobs) ctx.drawImage(CLOUD, c.x + ox - r, c.y + oy - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
      for (const p of this.particles) {
        ctx.globalAlpha = V.clamp(p.life / p.max, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }
  };
})();
