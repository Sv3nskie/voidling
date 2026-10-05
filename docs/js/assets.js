// Voidling custom art: images dropped into assets/ replace the built-in drawings.
// tools/build.mjs writes assets/manifest.json (the list of files); see assets/README.md for names.
//   name.png                one image
//   name_1.png, name_2.png  animation frames, played in number order
//   name_strip8.png         8 frames side by side in one image
// assets/settings.json can tune each art: { "player": { "scale": 1.2, "y": -2, "fps": 12 } }
// ("player" applies to player_run, player_jump, ... unless they have their own entry)
(() => {
  const V = window.V;
  const sets = new Map(); // name -> { frames: [{ img, sx, sy, sw, sh }], name }
  const pools = new Map(); // name -> { count, list } (variant lists, rebuilt when art changes)
  let settings = {};
  const IMG = /\.(png|webp|jpe?g|gif|svg|avif)$/i;

  const loadImage = src => new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });

  // Settings lookup: exact name first, then shorter prefixes (player_run → player)
  const opt = (name, key, def) => {
    for (let n = name; n; n = n.includes('_') ? n.slice(0, n.lastIndexOf('_')) : '') {
      const s = settings[n];
      if (s && s[key] !== undefined) return s[key];
    }
    return def;
  };

  const art = (V.art = {
    count: 0,
    has: name => sets.has(name),
    pick: (...names) => names.find(n => n && sets.has(n)) || null,
    frames: name => (sets.get(name) || { frames: [] }).frames.length,
    opt,
    // The frame to show: looping by time t, or once (age since it started, holds the last frame)
    frame(name, { t = 0, age, frame } = {}) {
      const s = sets.get(name);
      if (!s) return null;
      const n = s.frames.length, fps = opt(name, 'fps', 10);
      let i = frame !== undefined ? frame : age !== undefined ? Math.floor(age * fps) : Math.floor(t * fps);
      i = age !== undefined || frame !== undefined ? Math.max(0, Math.min(n - 1, i)) : ((i % n) + n) % n;
      return s.frames[i];
    },
    // Variants: several designs for one thing. Either files named name_v1, name_v2 … or a pool
    // in settings.json: { "name": { "variants": ["island_moss_*", "island_ember_*"] } }.
    // pool(name) lists the art names; choose(name, seed) picks one, the same one for the same seed.
    pool(name) {
      if (!name) return [];
      const hit = pools.get(name);
      if (hit && hit.count === sets.size) return hit.list;
      const s = settings[name];
      let list;
      if (s && s.variants) {
        const keys = [...sets.keys()].sort();
        list = s.variants.flatMap(v => {
          const re = new RegExp('^' + v.toLowerCase().split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
          return keys.filter(k => re.test(k));
        });
      } else {
        list = [...sets.keys()].filter(k => k.startsWith(name + '_v') && /^\d+$/.test(k.slice(name.length + 2)))
          .sort((a, b) => a.slice(name.length + 2) - b.slice(name.length + 2));
        if (!list.length && sets.has(name)) list = [name];
      }
      pools.set(name, { count: sets.size, list });
      return list;
    },
    choose(name, seed = 0) {
      const p = art.pool(name);
      return p.length ? p[Math.abs(Math.floor(seed)) % p.length] : null;
    },
    // Duration of a one-shot animation in seconds
    duration: name => (sets.has(name) ? art.frames(name) / opt(name, 'fps', 10) : 0),
    // Draw art `name` at x, y. Size: h = height (or w = width) in world units, before the
    // art's own "scale" setting. anchor: 'center' (default) or 'bottom' (x, y = feet).
    // Also: rot, flip (mirror), sx / sy (squash), alpha, t / age / frame (animation).
    draw(ctx, name, x, y, o = {}) {
      const f = art.frame(name, o);
      if (!f) return false;
      const k = opt(name, 'scale', 1);
      let H = o.h !== undefined ? o.h * k : (o.w * k * f.sh) / f.sw, W = (H * f.sw) / f.sh;
      if (!(H > 0 && W > 0)) return false;
      ctx.save();
      ctx.translate(x + opt(name, 'x', 0), y + opt(name, 'y', 0));
      if (o.rot) ctx.rotate(o.rot);
      if (o.flip) ctx.scale(-1, 1);
      if (o.sx || o.sy) ctx.scale(o.sx || 1, o.sy || 1);
      if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
      ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -W / 2, o.anchor === 'bottom' ? -H : -H / 2, W, H);
      ctx.restore();
      return true;
    },
  });

  async function load() {
    let files;
    try {
      const r = await fetch('assets/manifest.json', { cache: 'no-cache' });
      if (!r.ok) return;
      files = (await r.json()).files || [];
    } catch (e) { return; } // no custom art: the built-in drawings are used
    // Every settings.json is read, deepest folder first, so yours in assets/ has the last word
    const configs = files.filter(f => f.split('/').pop().toLowerCase() === 'settings.json')
      .sort((a, b) => b.split('/').length - a.split('/').length);
    for (const f of configs) {
      try {
        const s = await (await fetch('assets/' + f, { cache: 'no-cache' })).json();
        for (const [k, v] of Object.entries(s)) settings[k.toLowerCase()] = Object.assign(settings[k.toLowerCase()] || {}, v);
      } catch (e) { console.warn(`assets/${f} is not valid JSON`, e); }
    }
    const groups = new Map();
    for (const file of files) {
      if (!IMG.test(file)) continue;
      const base = file.split('/').pop().replace(IMG, '').toLowerCase().replace(/[\s-]+/g, '_'); // subfolders are just for you
      let m = base.match(/^(.*)_strip(\d+)$/);
      if (m) { groups.set(m[1], [{ file, strip: +m[2], n: 0 }]); continue; }
      m = base.match(/^(.*)_(\d+)$/);
      const name = m ? m[1] : base, n = m ? +m[2] : 0;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push({ file, n });
    }
    await Promise.all([...groups].map(async ([name, list]) => {
      list.sort((a, b) => a.n - b.n);
      const imgs = await Promise.all(list.map(e => loadImage('assets/' + encodeURIComponent(e.file).replace(/%2F/g, '/'))));
      const frames = [];
      list.forEach((e, i) => {
        const img = imgs[i];
        if (!img) { console.warn('Could not load assets/' + e.file); return; }
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (e.strip) for (let k = 0; k < e.strip; k++) frames.push({ img, sx: (w / e.strip) * k, sy: 0, sw: w / e.strip, sh: h });
        else frames.push({ img, sx: 0, sy: 0, sw: w, sh: h });
      });
      if (frames.length) sets.set(name, { frames, name });
    }));
    art.count = sets.size;
    if (sets.size) console.info(`Voidling: custom art loaded for ${[...sets.keys()].sort().join(', ')}`);
  }
  art.loading = load();
})();
