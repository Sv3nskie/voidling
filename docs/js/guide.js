// Voidling guide: zone progress tracker and step-by-step tips
(() => {
  const V = window.V;
  const FONT_D = '"Bungee", "Arial Black", sans-serif';
  const FONT_B = '"Fredoka", "Trebuchet MS", sans-serif';

  // Taught in order; a step also moves on by itself after `wait` seconds
  const TUTORIAL = [
    { text: 'Move with [←] [→] or [A] [D]', done: g => g.count('move') > 0.6 },
    { text: 'Press [SPACE] to jump. Press it again in the air to double jump', done: g => g.count('djump') > 0 },
    { text: 'Jump ON an alien to defeat it and bounce up high', done: g => g.count('stomp') > 0, wait: 30 },
    { text: 'Press [X] to chomp-dash. It hits enemies and works once in the air', done: g => g.count('dash') > 0 },
    { text: 'Hold [SPACE] while falling to float down slowly', done: g => g.count('glide') > 0.5, wait: 25 },
  ];

  V.Guide = class {
    constructor(api) {
      this.api = api;
      this.counts = {};
      this.step = 0;
      this.stepT = 0;
      this.tip = null;
      this.seen = {};
      this.panelBottom = 0;
      this.zoneFlash = 0;
    }
    count(name) { return this.counts[name] || 0; }
    event(name, amount = 1) { this.counts[name] = this.count(name) + amount; }
    show(key, text) {
      if (this.seen[key] || this.tip) return;
      this.seen[key] = true;
      this.tip = { text, t: 6 };
    }

    update(dt) {
      const { P, tower } = this.api;
      this.zoneFlash = Math.max(0, this.zoneFlash - dt);
      this.stepT += dt;
      while (this.step < TUTORIAL.length) {
        const s = TUTORIAL[this.step];
        if (!s.done(this) && !(s.wait && this.stepT > s.wait)) break;
        this.step++;
        this.stepT = 0;
      }
      if (this.tip && (this.tip.t -= dt) <= 0) this.tip = null;
      if (this.tip) return;
      const near = (x, y, rx = 260, ry = 220) => Math.abs(x - P.x) < rx && Math.abs(y - P.y) < ry;
      const voidDist = (this.api.voidY - P.y) / V.M;
      if (voidDist < 18) this.show('void', 'The Void is rising! Keep climbing. Touching it costs a heart.');
      else if (P.hearts === 1) this.show('lastHeart', 'Last heart! Defeated enemies sometimes drop hearts.');
      for (const e of tower.enemies) {
        if (e.dead || !near(e.x, e.y)) continue;
        if (e.type === 'spiky') this.show('spiky', 'Spiky aliens hurt if you jump on them. Chomp-dash them from the side!');
        else if (e.type === 'jelly') this.show('jelly', 'Space jellies are bounce pads. Land on one to launch up high!');
        else if (e.type === 'maw') this.show('maw', 'Carnivorous plants bite when you get close. Stomp, dash, shoot or throw a rock at them!');
        else if (e.type === 'bat') this.show('bat', 'Void bats swoop at you. Jump on them or chomp-dash them.');
        else if (e.type === 'saucer') this.show('saucer', 'UFO! It glows red before it shoots. Jump on it, dash into it or shoot it: one hit takes it down.');
        if (this.tip) return;
      }
      for (const p of tower.plats) {
        if (!near(p.x + p.w / 2, p.y)) continue;
        if (p.type === 'crumble') this.show('crumble', 'Cracked platforms crumble right after you land. Keep moving!');
        else if (p.spikes) this.show('spikes', 'Red crystal spikes hurt. Don\'t land on them.');
        else if (p.shop && !p.shopUsed && !this.seen.shop) this.show('shop', 'A trader! Land on this island to spend your coins.');
        else if (p.beacon && !p.lit) this.show('beacon', 'Beacons are checkpoints. Land on one for +1 heart, and it pushes the Void back down.');
        else if (p.type === 'moving') this.show('moving', 'Moving platforms carry you along. Time your jump.');
        if (this.tip) return;
      }
      if (this.api.wind.phase !== 'calm') this.show('wind', 'Wind gust! It pushes you sideways, especially in the air.');
      if (this.tip) return;
      if (P.held && V.GUNS[P.held.type] && !this.api.touch) this.show('recoil', 'In the air, hold [↓] and press [SHIFT] to shoot down and boost yourself up!');
      if (this.tip) return;
      for (const it of tower.items) {
        if (it.dead || !near(it.x, it.y)) continue;
        if (it.type === 'diamond') this.show('diamond', 'A diamond! Grab it: if you die, it brings you back to your last checkpoint.');
        else if (it.type === 'rock') this.show('rock', 'Walk over a rock to pick it up, then press [SHIFT] to throw. It auto-aims at the nearest enemy.');
        else if (it.type === 'bomb') this.show('bomb', 'Void bomb! The blast launches you too. Throw it near your feet for a huge jump.');
        else if (V.GUNS[it.type]) this.show('gun', 'A gun! Grab it, then hold [SHIFT] to shoot. It auto-aims at the nearest enemy.');
        else if (V.BUFFS[it.type]) this.show('buff', 'A power-up! They hide in hard-to-reach spots. Grab it if you can.');
        if (this.tip) return;
      }
      if (tower.clouds.some(c => near(c.x, c.y, 380, 260))) this.show('secret', 'That dark cloud by the edge hides a secret power-up. Jump, double jump and air-dash to reach it!');
    }

    // ---------- Drawing (screen space) ----------
    draw(ctx) {
      const { W, H } = this.api;
      this.drawTracker(ctx, W);
      let tipText = this.tip ? this.tip.text : this.step < TUTORIAL.length ? TUTORIAL[this.step].text : null;
      // On phones, name the on-screen buttons instead of keyboard keys
      if (tipText && this.api.touch) {
        tipText = tipText.replace('[←] [→] or [A] [D]', '[◀] [▶]').replace(/\[SPACE\]/g, '[JUMP]')
          .replace(/\[X\]/g, '[CHOMP]').replace(/\[SHIFT\]/g, '[SHOOT]').replace(/\[G\]/g, '[HOOK]');
      }
      if (tipText) this.drawTip(ctx, tipText, W, H, this.tip ? '#ffcc4d' : '#5fe3ff');
    }
    drawTracker(ctx, W) {
      const { P } = this.api;
      const m = Math.max(0, -P.y / V.M);
      const zi = V.zoneAt(m), z = V.ZONES[zi], next = V.ZONES[zi + 1];
      // Top center, between the height readout (left) and best height (right) when it fits
      const topW = Math.min(400, W - 340), top = topW >= 260;
      const bw = top ? topW : Math.min(400, W - 32), x = (W - bw) / 2, y = top ? 14 : 150, h = 66;
      this.panelBottom = y + h;
      const flash = this.zoneFlash > 0;
      ctx.fillStyle = flash ? 'rgba(20,50,60,0.85)' : 'rgba(11,5,24,0.74)';
      ctx.beginPath(); ctx.roundRect(x, y, bw, h, 14); ctx.fill();
      ctx.strokeStyle = flash ? '#5fe3ff' : 'rgba(185,140,255,0.6)';
      ctx.lineWidth = flash ? 2.5 : 1.5;
      ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = flash ? '#5fe3ff' : '#b98cff';
      ctx.font = `12px ${FONT_D}`;
      ctx.fillText(`ZONE ${zi + 1} / ${V.ZONES.length}`, x + 16, y + 10);
      ctx.fillStyle = '#f4eaff';
      ctx.font = `17px ${FONT_D}`;
      ctx.fillText(z.name, x + 16, y + 26, bw - 32);
      ctx.textAlign = 'right';
      ctx.font = `600 13px ${FONT_B}`;
      ctx.fillStyle = '#b9a6d9';
      ctx.fillText(next ? (bw < 360 ? `next: ${next.at} m` : `next zone at ${next.at} m`) : 'endless', x + bw - 16, y + 12);
      ctx.textAlign = 'left';
      const prog = next ? V.clamp((m - z.at) / (next.at - z.at), 0, 1) : (m % 100) / 100;
      ctx.fillStyle = 'rgba(185,140,255,0.2)';
      ctx.beginPath(); ctx.roundRect(x + 16, y + h - 14, bw - 32, 6, 3); ctx.fill();
      ctx.fillStyle = '#5fe3ff';
      if (prog > 0.01) { ctx.beginPath(); ctx.roundRect(x + 16, y + h - 14, (bw - 32) * prog, 6, 3); ctx.fill(); }
    }
    drawTip(ctx, text, W, H, accent) {
      const parts = text.split(/(\[[^\]]+\])/).filter(Boolean);
      const bodyFont = `500 17px ${FONT_B}`, keyFont = `600 14px ${FONT_B}`;
      const widths = parts.map(p => {
        ctx.font = p.startsWith('[') ? keyFont : bodyFont;
        return p.startsWith('[') ? ctx.measureText(p.slice(1, -1)).width + 18 : ctx.measureText(p).width;
      });
      const total = widths.reduce((a, b) => a + b, 0);
      const scale = Math.min(1, (W - 64) / total);
      const bw = total * scale + 40, bh = 44, x = (W - bw) / 2, y = H - (W < 760 ? 160 : 110) - this.api.reserve;
      ctx.fillStyle = 'rgba(11,5,24,0.82)';
      ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 22); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save();
      ctx.translate(x + 20, y + bh / 2);
      ctx.scale(scale, scale);
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      let cx = 0;
      parts.forEach((p, i) => {
        if (p.startsWith('[')) {
          ctx.fillStyle = 'rgba(255,204,77,0.18)';
          ctx.strokeStyle = '#ffcc4d'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.roundRect(cx + 3, -13, widths[i] - 6, 26, 6); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffe58a'; ctx.font = keyFont;
          ctx.fillText(p.slice(1, -1), cx + 12, 1);
        } else {
          ctx.fillStyle = '#f4eaff'; ctx.font = bodyFont;
          ctx.fillText(p, cx, 1);
        }
        cx += widths[i];
      });
      ctx.restore();
    }
  };
})();
