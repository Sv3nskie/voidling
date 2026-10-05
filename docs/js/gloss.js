// Voidling gloss kit: shiny, candy-like sprites (shaded body, bounce light from below, sharp
// specular highlight, dark outline). Each one is rendered once into a small canvas and reused,
// so the shine costs one drawImage per frame and stays fast on phones.
(() => {
  const V = window.V, TAU = Math.PI * 2;
  const cache = new Map();
  const make = (key, w, h, draw) => {
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'));
    cache.set(key, c);
    return c;
  };
  const mix = (a, b, k) => V.mixHex(a, b, k);
  const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
  const hex6 = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#ffffff'); // sprite colors must be #rrggbb

  // Specular highlight: a soft white oval plus a sharp hot spot and a tiny second glint
  function shine(g, x, y, R, rot = -0.5, k = 1) {
    const sp = g.createRadialGradient(x, y, 0, x, y, R);
    sp.addColorStop(0, `rgba(255,255,255,${0.9 * k})`);
    sp.addColorStop(0.45, `rgba(255,255,255,${0.32 * k})`);
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sp;
    g.beginPath(); g.ellipse(x, y, R, R * 0.62, rot, 0, TAU); g.fill();
    g.fillStyle = `rgba(255,255,255,${k})`;
    g.beginPath(); g.ellipse(x - R * 0.15, y - R * 0.08, R * 0.3, R * 0.17, rot, 0, TAU); g.fill();
  }

  const G = (V.gloss = {
    // Round jelly body, radius 60 in a 136 px canvas (center 68,68)
    body: (color, rim = '#ff9ad5') => make(`body${color}${rim}`, 136, 136, g => {
      color = hex6(color); rim = hex6(rim);
      const R = 60;
      g.translate(68, 68);
      const base = g.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.05, 0, 0, R * 1.05);
      base.addColorStop(0, mix(color, '#ffffff', 0.55));
      base.addColorStop(0.38, color);
      base.addColorStop(1, mix(color, '#1a0830', 0.5));
      g.fillStyle = base;
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      g.save(); g.clip();
      const bounce = g.createRadialGradient(R * 0.2, R * 1.15, R * 0.1, R * 0.2, R * 1.15, R * 0.95);
      bounce.addColorStop(0, alpha(rim, 0.75)); bounce.addColorStop(1, alpha(rim, 0));
      g.fillStyle = bounce;
      g.fillRect(-R, -R, R * 2, R * 2);
      g.restore();
      g.strokeStyle = mix(color, '#12051f', 0.62); g.lineWidth = 3.5;
      g.beginPath(); g.arc(0, 0, R - 1.5, 0, TAU); g.stroke();
      shine(g, -R * 0.34, -R * 0.48, R * 0.42);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(R * 0.48, -R * 0.2, R * 0.065, 0, TAU); g.fill();
    }),

    // The Voidling: polished obsidian with a violet rim light
    voidBody: () => make('void', 136, 136, g => {
      const R = 60;
      g.translate(68, 68);
      const base = g.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.05, 0, 0, R);
      base.addColorStop(0, '#4a2a86'); base.addColorStop(0.45, '#170a33'); base.addColorStop(1, '#06020e');
      g.fillStyle = base;
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      g.save(); g.clip();
      const rimL = g.createRadialGradient(R * 0.35, R * 0.9, R * 0.3, R * 0.35, R * 0.9, R * 0.95);
      rimL.addColorStop(0, 'rgba(255,127,200,0.55)'); rimL.addColorStop(1, 'rgba(255,127,200,0)');
      g.fillStyle = rimL; g.fillRect(-R, -R, R * 2, R * 2);
      g.restore();
      g.strokeStyle = '#c9a2ff'; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, R - 2, 0, TAU); g.stroke();
      shine(g, -R * 0.32, -R * 0.5, R * 0.4, -0.55, 0.85);
    }),

    // Gold coin face, radius 58 in a 128 px canvas: bevelled rim, embossed star, shine
    coin: () => make('coin', 128, 128, g => {
      const R = 58;
      g.translate(64, 64);
      const rimG = g.createLinearGradient(-R, -R, R, R);
      rimG.addColorStop(0, '#fff4b8'); rimG.addColorStop(0.5, '#f0b030'); rimG.addColorStop(1, '#9a5a12');
      g.fillStyle = rimG;
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      const face = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R * 0.82);
      face.addColorStop(0, '#fff2a8'); face.addColorStop(0.5, '#ffcc3d'); face.addColorStop(1, '#d88a1c');
      g.fillStyle = face;
      g.beginPath(); g.arc(0, 0, R * 0.8, 0, TAU); g.fill();
      const star = (dx, dy, color) => {
        g.fillStyle = color;
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? R * 0.2 : R * 0.48, a = i * TAU / 10 - Math.PI / 2;
          g.lineTo(dx + Math.cos(a) * r, dy + Math.sin(a) * r);
        }
        g.closePath(); g.fill();
      };
      star(3, 4, '#a8621a');
      star(0, 0, '#fff0a0');
      g.strokeStyle = '#7a4210'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, R - 1.5, 0, TAU); g.stroke();
      shine(g, -R * 0.38, -R * 0.45, R * 0.36, -0.7, 0.9);
    }),

    // Heart, drawn for size s = 48 around (64, 70) in a 128 px canvas
    heart: (color = '#ff4f7a') => make(`heart${color}`, 128, 128, g => {
      const s = 48;
      g.translate(64, 70);
      const path = () => {
        g.beginPath();
        g.moveTo(0, s * 0.9);
        g.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.7, -s * 1.1, 0, -s * 0.4);
        g.bezierCurveTo(s * 0.7, -s * 1.1, s * 1.4, -s * 0.1, 0, s * 0.9);
      };
      const body = g.createRadialGradient(-s * 0.4, -s * 0.45, s * 0.05, 0, 0, s * 1.2);
      body.addColorStop(0, mix(color, '#ffffff', 0.55)); body.addColorStop(0.4, color); body.addColorStop(1, mix(color, '#3a0618', 0.55));
      path(); g.fillStyle = body; g.fill();
      g.save(); path(); g.clip();
      const bounce = g.createRadialGradient(s * 0.3, s * 0.9, s * 0.1, s * 0.3, s * 0.9, s * 0.9);
      bounce.addColorStop(0, 'rgba(255,170,210,0.7)'); bounce.addColorStop(1, 'rgba(255,170,210,0)');
      g.fillStyle = bounce; g.fillRect(-s * 1.5, -s * 1.2, s * 3, s * 2.4);
      g.restore();
      path(); g.strokeStyle = mix(color, '#2a0414', 0.6); g.lineWidth = 3.5; g.stroke();
      shine(g, -s * 0.48, -s * 0.48, s * 0.36, -0.7, 0.95);
    }),

    // Glossy droplet for particles and splashes (32 px)
    dot: color => make(`dot${color}`, 32, 32, g => {
      color = hex6(color);
      const d = g.createRadialGradient(12, 11, 1, 16, 16, 15);
      d.addColorStop(0, mix(color, '#ffffff', 0.7)); d.addColorStop(0.45, color); d.addColorStop(1, mix(color, '#1a0830', 0.45));
      g.fillStyle = d;
      g.beginPath(); g.arc(16, 16, 14.5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.ellipse(11, 10, 4, 2.6, -0.6, 0, TAU); g.fill();
    }),

    // Soft dust puff (64 px)
    puff: () => make('puff', 64, 64, g => {
      const d = g.createRadialGradient(28, 26, 2, 32, 32, 31);
      d.addColorStop(0, 'rgba(250,240,255,0.95)'); d.addColorStop(0.55, 'rgba(220,200,250,0.6)'); d.addColorStop(1, 'rgba(200,170,240,0)');
      g.fillStyle = d;
      g.fillRect(0, 0, 64, 64);
    }),

    // Dark violet smoke puff (64 px)
    smoke: () => make('smoke', 64, 64, g => {
      const d = g.createRadialGradient(28, 26, 2, 32, 32, 31);
      d.addColorStop(0, 'rgba(90,60,120,0.9)'); d.addColorStop(0.6, 'rgba(50,28,80,0.55)'); d.addColorStop(1, 'rgba(30,14,50,0)');
      g.fillStyle = d;
      g.fillRect(0, 0, 64, 64);
    }),

    // Four-point twinkle (64 px)
    star: color => make(`star${color}`, 64, 64, g => {
      color = hex6(color);
      g.translate(32, 32);
      const halo = g.createRadialGradient(0, 0, 0, 0, 0, 30);
      halo.addColorStop(0, alpha(color, 0.65)); halo.addColorStop(1, alpha(color, 0));
      g.fillStyle = halo; g.fillRect(-32, -32, 64, 64);
      g.fillStyle = '#ffffff';
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 4 : 30, a = i * Math.PI / 4;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath(); g.fill();
    }),

    // Glass bubble around pickups, radius 56 in a 128 px canvas
    bubble: (color = '#e6d6ff') => make(`bubble${color}`, 128, 128, g => {
      color = hex6(color);
      const R = 56;
      g.translate(64, 64);
      const inner = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
      inner.addColorStop(0, alpha(color, 0.06)); inner.addColorStop(0.75, alpha(color, 0.14)); inner.addColorStop(1, alpha(color, 0.5));
      g.fillStyle = inner;
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      g.strokeStyle = alpha(color, 0.85); g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, R - 1.5, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0, R * 0.78, Math.PI * 1.12, Math.PI * 1.42); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(R * 0.42, R * 0.5, R * 0.07, 0, TAU); g.fill();
    }),
  });

  // Draw a gloss sprite centered at x, y with radius r (sprite radius rIn px)
  G.draw = (ctx, c, x, y, r, rIn) => {
    const k = r / rIn;
    ctx.drawImage(c, x - c.width / 2 * k, y - c.height / 2 * k, c.width * k, c.height * k);
  };
})();
