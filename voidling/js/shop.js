// Voidling trader: a market island every 100 m. Land on it and the game pauses while you spend
// coins on hearts, protection, weapons, power-ups and diamonds.
(() => {
  const V = window.V, G = V.G;
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2;
  const offerItem = type => ({ type, x: G.P.x, y: G.P.y - 24, a: 12, phase: 0 });

  // ok() returns true, or the reason it can't be bought right now
  const ITEMS = {
    heart: { name: 'Heart', price: 15, desc: '+1 heart', ok: P => P.hearts < P.maxHearts || 'Hearts are full', give: P => { P.hearts++; } },
    shield: { name: 'Shield', price: 25, desc: 'Blocks the next 2 hits', ok: P => P.buffs.shield < 2 || 'Shield is full', give: () => G.tryBuff(offerItem('shield')) },
    diamond: { name: 'Diamond', price: 60, desc: 'Respawn at your checkpoint when you die', ok: P => P.diamonds < 3 || 'You already have 3', give: P => { P.diamonds++; } },
    blaster: { name: 'Star Blaster', price: 20, desc: '18 rapid shots', ok: () => true, give: () => G.tryPickup(offerItem('blaster')) },
    spread: { name: 'Spread Gun', price: 30, desc: '10 triple shots', ok: () => true, give: () => G.tryPickup(offerItem('spread')) },
    bomb: { name: 'Void Bomb', price: 15, desc: 'Big blast that launches you up', ok: P => !P.held || 'Your hands are full', give: () => G.tryPickup(offerItem('bomb')) },
    hook: { name: '4 Grapple Hooks', price: 20, desc: 'Pull yourself up to a platform', ok: P => P.hooks < 9 || 'Hooks are full', give: () => G.tryBuff(offerItem('hook')) },
    wings: { name: 'Wings', price: 20, desc: 'Triple jump for 25 s', ok: () => true, give: () => G.tryBuff(offerItem('wings')) },
    boots: { name: 'Super Jump', price: 20, desc: 'Jump 50% higher for 25 s', ok: () => true, give: () => G.tryBuff(offerItem('boots')) },
    freeze: { name: 'Void Freeze', price: 25, desc: 'Stops the Void for 12 s', ok: () => true, give: () => G.tryBuff(offerItem('freeze')) },
  };
  // Heart, shield and diamond are always for sale, plus 3 rotating items. Seeded by the shop
  // number, so every player sees the same offers at the same height.
  const ROTATING = ['blaster', 'spread', 'bomb', 'hook', 'wings', 'boots', 'freeze'];
  function offers(n) {
    const rnd = V.rng(4242 + n * 97), pool = ROTATING.slice(), picks = [];
    while (picks.length < 3) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return ['heart', 'shield', 'diamond', ...picks];
  }

  let shop = null; // { plat, offers, sel }

  G.openShop = plat => {
    plat.shopUsed = true;
    shop = { plat, offers: offers(plat.shop), sel: 0 };
    G.state = 'shop';
    document.body.classList.remove('playing');
    render();
    $('shop').hidden = false;
    V.sfx.pickup();
  };
  G.closeShop = () => {
    if (!shop) return;
    $('shop').hidden = true;
    shop = null;
    G.state = 'play';
    G.P.inv = Math.max(G.P.inv, 0.5);
    document.body.classList.add('playing');
  };
  function buy() {
    const P = G.P, it = ITEMS[shop.offers[shop.sel]];
    if (it.ok(P) !== true || P.coins < it.price) { V.sfx.hit(); return; }
    P.coins -= it.price;
    it.give(P);
    V.sfx.heart();
    render();
  }
  // Keyboard / gamepad: arrows or d-pad choose, Space / Enter / A buys, Esc / X / B leaves
  G.shopInput = () => {
    const I = V.input, n = shop.offers.length;
    const grid = $('shopGrid'), cols = Math.max(1, Math.round(grid.clientWidth / (grid.firstChild?.offsetWidth || grid.clientWidth)));
    let moved = false;
    if (I.hit('left')) { shop.sel = (shop.sel + n - 1) % n; moved = true; }
    if (I.hit('right')) { shop.sel = (shop.sel + 1) % n; moved = true; }
    if (I.hit('up')) { shop.sel = (shop.sel - cols + n) % n; moved = true; }
    if (I.hit('down')) { shop.sel = (shop.sel + cols) % n; moved = true; }
    if ((I.hit('jump') && !I.hit('up')) || I.hit('start')) { buy(); return; } // ↑ also counts as jump
    if (I.hit('pause') || I.hit('chomp')) { G.closeShop(); return; }
    if (moved) render();
  };
  $('shopClose').addEventListener('click', () => G.closeShop());

  // Item icons, drawn with the game's own art (glow off: it looks noisy on a transparent canvas)
  function drawIcon(ctx, key) {
    const glow = V.drawGlow;
    V.drawGlow = () => {};
    ctx.scale(2, 2);
    if (key === 'heart') V.drawHeart(ctx, 24, 26, 14);
    else if (key === 'diamond') V.drawDiamond(ctx, 24, 25, 15, 0.6);
    else if (V.BUFFS[key]) V.drawBuff(ctx, { type: key, x: 24, y: 24, phase: -Math.PI / 2 }, 0);
    else V.drawPickup(ctx, { type: key, x: 24, y: 24, phase: -Math.PI / 2 }, 0);
    V.drawGlow = glow;
  }
  function el(tag, text) { const e = document.createElement(tag); e.textContent = text; return e; }
  function render() {
    const P = G.P;
    $('shopHeight').textContent = `${shop.plat.shop * 100} m`;
    $('shopCoins').textContent = `${P.coins} coins`;
    const grid = $('shopGrid');
    grid.textContent = '';
    shop.offers.forEach((key, i) => {
      const it = ITEMS[key], ok = it.ok(P), afford = P.coins >= it.price;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'shop-item' + (i === shop.sel ? ' sel' : '') + (ok !== true || !afford ? ' off' : '');
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      drawIcon(c.getContext('2d'), key);
      b.append(c, el('strong', it.name), el('span', ok !== true ? ok : afford ? it.desc : `Need ${it.price - P.coins} more coins`), el('em', `${it.price} coins`));
      b.addEventListener('pointerdown', e => { e.preventDefault(); shop.sel = i; buy(); });
      grid.append(b);
    });
  }

  // The market stall on the shop island: striped awning, a trader alien behind the counter, a sign
  V.drawShop = (ctx, x, y, t, used, scale = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    stall(ctx, 0, 0, t, used);
    ctx.restore();
  };
  function stall(ctx, x, y, t, used) {
    V.drawGlow(ctx, x, y - 86, 34, '#ffcc4d', used ? 0.15 : 0.45 + 0.2 * Math.sin(t * 3));
    ctx.fillStyle = '#3a1f4a';
    ctx.fillRect(x - 31, y - 66, 4, 66);
    ctx.fillRect(x + 27, y - 66, 4, 66);
    // Trader
    const bob = Math.sin(t * 2.5) * 1.5;
    ctx.fillStyle = '#9dff6b';
    ctx.beginPath(); ctx.ellipse(x, y - 32 + bob, 13, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff4f7a';
    ctx.fillRect(x - 6, y - 50 + bob, 12, 8);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(x - 1, y - 54 + bob, 2, 4);
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + s * 5, y - 35 + bob, 3.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a0b33'; ctx.beginPath(); ctx.arc(x + s * 5 + 1, y - 34.5 + bob, 1.8, 0, TAU); ctx.fill();
    }
    // Counter with a little pile of coins
    ctx.fillStyle = '#6b3f4f';
    ctx.fillRect(x - 35, y - 24, 70, 24);
    ctx.fillStyle = '#c8a2ff';
    ctx.fillRect(x - 37, y - 27, 74, 5);
    ctx.fillStyle = '#ffcc4d';
    for (const [cx, cy] of [[-18, -31], [-12, -31], [-15, -35], [18, -31]]) { ctx.beginPath(); ctx.arc(x + cx, y + cy, 3, 0, TAU); ctx.fill(); }
    // Striped awning with scalloped edge
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#f4eaff' : '#ff7fc8';
      ctx.fillRect(x - 37 + i * 12.33, y - 76, 12.33, 12);
      ctx.beginPath(); ctx.arc(x - 37 + i * 12.33 + 6.17, y - 64, 6.17, 0, Math.PI); ctx.fill();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '12px "Bungee", "Arial Black", sans-serif';
    ctx.fillStyle = used ? '#7a6a98' : '#ffcc4d';
    ctx.fillText('SHOP', x, y - 86);
  };
})();
