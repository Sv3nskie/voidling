"""Cut the game art out of Graphics/Final full.ai and write it to voidling/assets/.

Every object on the artboard is found automatically (separate shapes on a transparent
background), rendered sharp from the vector file, recolored where needed so it matches the
game's palettes, and saved as WebP with the names the game uses (see voidling/assets/README.md).
Also writes voidling/assets/settings.json (where each island's walkable edge is, variant pools).

Usage: python tools/import-art.py [--sheet out.png]
Needs: pymupdf, pillow, numpy, scipy.
Which object is what is decided by its position on the artboard (ROLES below). If you move
things around in Illustrator, run with --sheet to see the numbered objects and update ROLES.
"""
import json, sys
from pathlib import Path
import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'Graphics' / 'Final full.ai'
OUT = ROOT / 'voidling' / 'assets' / 'ai'  # owned by this script: cleared and rewritten each run

# Object centers on the artboard (points) -> role. Found with --sheet.
ROLES = [
    ((3658, 243), 'planet_v1'), ((4005, 200), 'planet_v2'), ((4339, 240), 'planet_v3'),
    ((3771, 498), 'planet_v4'), ((4065, 446), 'planet_v5'),
    ((1861, 624), 'island:a'), ((1115, 1270), 'island:b'), ((2328, 1002), 'island:c'),
    ((638, 1816), 'island:d'), ((1236, 1802), 'island:e'), ((1960, 1696), 'island:f'),
    ((1657, 962), 'deco:cactus'), ((927, 980), 'deco:grass'), ((1194, 973), 'deco:bush'), ((1675, 1220), 'deco:rock'),
    ((2764, 1912), 'ufo_v1'), ((2796, 2086), 'ufo_v2'), ((2809, 2276), 'ufo_v3'),
    ((4305, 1672), 'gun:blaster'), ((4473, 2538), 'gun:spread'),
    # Spare guns (for future weapons, not exported yet): pink pistol (3975, 1416), alien claw
    # (4956, 1414), purple alien rifle (5397, 1712), bell ray gun (4941, 2178), blue and orange
    # ray gun (3796, 2347), orange minigun (5609, 2331)
]

# Game palettes (dark, mid, light) for the cap (grass) and the rock, plus a gem color.
# Same colors as V.ISLAND_PALS and the zone palettes in tower.js.
PALS = {
    'moss':     dict(cap=['#2f7a4a', '#7ee08a', '#dcffcc'], rock=['#24101e', '#6b3e44', '#b07468'], gem='#5fe3ff'),
    'ember':    dict(cap=['#9a3426', '#ff9a6a', '#ffdcbc'], rock=['#260c16', '#7a3634', '#c4705c'], gem='#ff4f7a'),
    'lavender': dict(cap=['#5a3a9a', '#c8a2ff', '#f2e6ff'], rock=['#22102a', '#6a3c5c', '#aa7092'], gem='#5fe3ff'),
    'frost':    dict(cap=['#28689a', '#8ff0ff', '#eafeff'], rock=['#14123a', '#3e3e7a', '#7c7cba'], gem='#b98cff'),
    'asteroid': dict(cap=['#4a4068', '#9a90b8', '#e2dcf4'], rock=['#1a1428', '#4a4262', '#877ea2'], gem='#5fe3ff'),
    'storm':    dict(cap=['#8a1e5a', '#ff6fb0', '#ffd2e8'], rock=['#100822', '#3a2a5a', '#705c98'], gem='#ff4f7a'),
}
# Which palettes each zone's islands use (zone 1 = canyon ... zone 5 = starfield)
ZONE_PALS = [['moss', 'ember'], ['lavender', 'moss'], ['asteroid', 'frost'], ['storm', 'asteroid'], ['lavender', 'frost', 'storm']]

# Hand-checked walkable tops where the measurement needs help: (surface, left, right), or None
# to leave an island out. b's grass dips a little on the left but is one surface; f has two
# levels, so you would float over its lower ledge.
FIT = {'b': (0.345, 0.03, 0.98), 'f': None}

SIZES = {'island': 640, 'deco': 200, 'planet': 300, 'ufo': 280, 'gun': 300}  # output width in px


def hex_rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float) / 255


def gradient(t, stops):
    """Map t in 0..1 through the color stops (evenly spaced)."""
    cols = np.array([hex_rgb(s) for s in stops])
    pos = np.linspace(0, 1, len(cols))
    return np.stack([np.interp(t, pos, cols[:, c]) for c in range(3)], -1)


def rgb_to_hs(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = (mx == r) & m; gg = (mx == g) & m & ~rr; bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = (b - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    return h / 6, s


def recolor(img, pal, keep=0.18):
    """Gradient-map the grass, rock and gems of an island to a game palette, keeping its shading."""
    a = np.asarray(img, float) / 255
    rgb, alpha = a[..., :3], a[..., 3]
    h, s = rgb_to_hs(rgb)
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    vis = alpha > 0.05
    cap = vis & (h > 0.11) & (h < 0.47) & (s > 0.28)
    gem = vis & (h >= 0.47) & (h < 0.74) & (s > 0.35)
    rock = vis & ~cap & ~gem
    out = rgb.copy()
    for mask, stops in ((cap, pal['cap']), (rock, pal['rock']), (gem, ['#101040', pal['gem'], '#ffffff'])):
        if mask.sum() < 20: continue
        lo, hi = np.percentile(lum[mask], [3, 97])
        t = np.clip((lum - lo) / max(hi - lo, 1e-3), 0, 1)
        out[mask] = gradient(t[mask], stops)
    out = out * (1 - keep) + rgb * keep  # a little of the original painting shows through
    return Image.fromarray((np.dstack([out, alpha]) * 255).round().astype(np.uint8), 'RGBA')


def walkable(img):
    """Where an island can be walked on: the top of its grass cap, measured per column. Returns
    (surface, left, right): the cap's typical height (0..1 down the image) and the widest run of
    columns where the cap top is at that height (0..1 across). The game fits that flat run onto
    the platform, so the rounded rims hang over the edges and spikes sit on real grass."""
    a = np.asarray(img, float) / 255
    h_, s_ = rgb_to_hs(a[..., :3])
    cap = (a[..., 3] > 0.3) & (h_ > 0.11) & (h_ < 0.47) & (s_ > 0.28)
    H, W = cap.shape
    cap = ndimage.binary_opening(cap, structure=np.ones((1, max(3, W // 30))))  # ignore thin grass blades
    has = cap.any(0)
    top = np.where(has, cap.argmax(0), H) / H
    surface = float(np.median(top[has]))
    flat = has & (np.abs(top - surface) < 0.08)
    flat = ndimage.binary_closing(flat, iterations=max(1, W // 60))  # bridge small gaps (a grass tuft)
    runs, n = ndimage.label(flat)
    if not n: return surface, 0.0, 1.0
    best = max(range(1, n + 1), key=lambda k: (runs == k).sum())
    cols = np.where(runs == best)[0]
    return surface, cols[0] / W, (cols[-1] + 1) / W


def background(img):
    """Push a planet into the distance: muted, darker, hazy violet, a little soft."""
    a = np.asarray(img, float) / 255
    rgb, al = a[..., :3], a[..., 3]
    lum = (rgb @ np.array([0.299, 0.587, 0.114]))[..., None]
    rgb = rgb * 0.5 + lum * 0.5                      # less saturated
    rgb = rgb * 0.62 * 0.62 + hex_rgb('#4a2a7a') * 0.38  # darker, sunk into the violet haze
    out = Image.fromarray((np.dstack([rgb, al * 0.92]) * 255).round().astype(np.uint8), 'RGBA')
    return out.filter(ImageFilter.GaussianBlur(1.4))


def main():
    doc = pymupdf.open(str(SRC))
    page = doc[0]
    pix = page.get_pixmap(matrix=pymupdf.Matrix(1, 1), alpha=True)
    full = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 4)
    lab, n = ndimage.label(ndimage.binary_dilation(full[..., 3] > 10, iterations=10))
    objs = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if (lab[sl] == i + 1).sum() < 1500: continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        objs.append(dict(id=i + 1, box=(x0, y0, x1, y1), c=((x0 + x1) / 2, (y0 + y1) / 2)))

    if '--sheet' in sys.argv:  # numbered overview of every object with its center
        out = Path(sys.argv[sys.argv.index('--sheet') + 1])
        im = Image.fromarray(full.copy())
        d = ImageDraw.Draw(im)
        for k, o in enumerate(objs):
            d.rectangle(o['box'], outline=(255, 200, 0, 255), width=3)
            d.text((o['box'][0], o['box'][1] - 14), f"{k} {o['c'][0]:.0f},{o['c'][1]:.0f}", fill=(255, 255, 0, 255))
        im.save(out)
        print('sheet:', out)
        return

    def render(o, width):
        x0, y0, x1, y1 = o['box']
        k = width / (x1 - x0)
        pad = 4
        clip = pymupdf.Rect(x0 - pad, y0 - pad, x1 + pad, y1 + pad)
        p = page.get_pixmap(matrix=pymupdf.Matrix(k, k), clip=clip, alpha=True)
        img = Image.frombytes('RGBA', (p.width, p.height), p.samples)
        # keep only this object's pixels (a neighbor's edge could sit inside the box)
        m = (lab[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad] == o['id']).astype(np.uint8) * 255
        m = Image.fromarray(m).resize(img.size, Image.NEAREST)
        img.putalpha(Image.fromarray(np.minimum(np.asarray(img)[..., 3], np.asarray(m))))
        return img.crop(img.getbbox())

    def nearest(c):
        return min(objs, key=lambda o: (o['c'][0] - c[0]) ** 2 + (o['c'][1] - c[1]) ** 2)

    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.iterdir(): f.unlink()  # this folder is generated; your own art lives next to it
    settings = {}
    save = lambda img, name: img.save(OUT / f'{name}.webp', 'WEBP', quality=88, method=6)
    islands, decos = {}, {}
    for c, role in ROLES:
        o = nearest(c)
        kind = role.split(':')[0].split('_')[0]
        img = render(o, SIZES[kind])
        if role.startswith('island:'): islands[role[7:]] = img
        elif role.startswith('deco:'): decos[role[5:]] = img
        elif role.startswith('gun:'):
            save(img.transpose(Image.FLIP_LEFT_RIGHT), 'gun_' + role[4:])  # drawn facing left; the game wants right
        elif role.startswith('planet'): save(background(img), role)  # scenery, not something to grab
        else: save(img, role)

    # Islands need a flat walkable top across at least half their width; others (a two-level
    # island) would leave you floating over a lower ledge, so they're left out
    fits = {}
    for key, img in islands.items():
        surf, left, right = walkable(img)
        if key in FIT: surf, left, right = FIT[key] or (surf, 0, 0)
        print(f'island {key}: walkable top at {surf:.2f}, flat from {left:.2f} to {right:.2f}')
        if right - left >= 0.5: fits[key] = [round(surf, 3), round(left, 3), round(right, 3)]
        else: print(f'  island {key} left out: its top is not flat enough to stand on')
    for pname, pal in PALS.items():
        for key in fits:
            name = f'island_{pname}_{key}'
            save(recolor(islands[key], pal), name)
            settings[name] = {'surface': fits[key][0], 'span': fits[key][1:]}
        for key, img in decos.items():
            save(recolor(img, pal, keep=0.25), f'deco_{key}_{pname}')
    for z, pals in enumerate(ZONE_PALS):
        settings[f'platform_zone{z + 1}'] = {'variants': [f'island_{p}_*' for p in pals]}
        kinds = ['grass', 'bush', 'rock'] + (['cactus'] if z == 0 else [])  # cacti only in the canyon
        settings[f'deco_zone{z + 1}'] = {'variants': [f'deco_{k}_{p}' for p in pals for k in kinds]}
    # Decoration sizes relative to the default 15 units tall
    settings.update({'deco_cactus': {'scale': 1.75}, 'deco_bush': {'scale': 1.05}, 'deco_grass': {'scale': 1.0}, 'deco_rock': {'scale': 0.75}})
    settings['ufo'] = {'scale': 1.05}
    settings['planet'] = {'scale': 0.85}
    (OUT / 'settings.json').write_text(json.dumps(settings, indent=1) + '\n')
    print(f'{len(objs)} objects -> {len(list(OUT.glob("*.webp")))} images in {OUT}')


if __name__ == '__main__':
    main()
