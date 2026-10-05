// Builds the game from voidling/ for:
//   docs/              the website (GitHub Pages), installable as an offline web app
//   app/assets/game/   the files bundled inside the Flutter Android app
// Usage: node tools/build.mjs
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'voidling');
const TARGETS = { web: join(ROOT, 'docs'), app: join(ROOT, 'app', 'assets', 'game') };
const DESCRIPTION = 'Voidling: a 2D arcade climber. The Void is rising. Climb floating space islands, stomp aliens and find hidden power-ups.';

const listFiles = dir => readdirSync(dir, { withFileTypes: true })
  .flatMap(d => (d.isDirectory() ? listFiles(join(dir, d.name)) : [join(dir, d.name)]));

// The source page is written for the Claude artifact viewer (no <html>/<head>/<body> of its own,
// fonts from Google). Here it becomes a full standalone page that uses the bundled fonts.
const source = readFileSync(join(SRC, 'index.html'), 'utf8');
const cut = source.indexOf('</style>') + '</style>'.length;
const head = source.slice(0, cut)
  .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts/fonts.css">');
const body = source.slice(cut).trim();

// Custom art: list every file in voidling/assets/ so the game knows what to load (a static site
// can't list a folder by itself). Your own images just need the right names: see assets/README.md.
const ASSETS = join(SRC, 'assets');
mkdirSync(ASSETS, { recursive: true });
const SKIP = new Set(['readme.md', 'manifest.json', '.ds_store', 'thumbs.db', 'desktop.ini']);
const assetFiles = listFiles(ASSETS).map(f => relative(ASSETS, f).replaceAll('\\', '/'))
  .filter(f => !SKIP.has(f.split('/').pop().toLowerCase()) && !f.split('/').pop().startsWith('.')).sort();
writeFileSync(join(ASSETS, 'manifest.json'), JSON.stringify({ files: assetFiles }, null, 1) + '\n');
console.log(`assets: ${assetFiles.length ? assetFiles.join(', ') : 'none (built-in art)'}`);

// Content hash, so phones pick up a new version of the offline web app after each deploy
const hash = createHash('sha256');
for (const f of listFiles(SRC).sort()) hash.update(readFileSync(f));
const version = hash.digest('hex').slice(0, 10);

function page(target) {
  const web = target === 'web';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0b0518">
<meta name="description" content="${DESCRIPTION}">
${web ? `<meta property="og:title" content="Voidling">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:image" content="icons/icon-512.png">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
` : ''}${head}
</head>
<body>
${body}
${web ? `<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js'));</script>\n` : ''}</body>
</html>
`;
}

for (const [target, out] of Object.entries(TARGETS)) {
  // Empty the folder rather than deleting it, so a local preview server running in it keeps working
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out)) rmSync(join(out, f), { recursive: true, force: true });
  for (const dir of ['js', 'fonts', 'assets']) cpSync(join(SRC, dir), join(out, dir), { recursive: true });
  writeFileSync(join(out, 'index.html'), page(target));
  if (target === 'web') {
    mkdirSync(join(out, 'icons'));
    for (const f of ['icon-192.png', 'icon-512.png']) cpSync(join(SRC, 'icons', f), join(out, 'icons', f));
    writeFileSync(join(out, '.nojekyll'), '');
    writeFileSync(join(out, 'manifest.webmanifest'), JSON.stringify({
      name: 'Voidling',
      short_name: 'Voidling',
      description: DESCRIPTION,
      start_url: './',
      scope: './',
      display: 'fullscreen',
      orientation: 'any',
      background_color: '#0b0518',
      theme_color: '#0b0518',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    }, null, 2));
    // Offline support: cache every file on first visit, serve from cache afterwards
    const files = ['./', ...listFiles(out).map(f => relative(out, f).replaceAll('\\', '/')).filter(f => f !== '.nojekyll')];
    // Network first: online you always get the newest build (no stale game after an update);
    // offline it falls back to the cached copy
    writeFileSync(join(out, 'sw.js'), `// Generated by tools/build.mjs: keeps the game playable offline
const CACHE = 'voidling-${version}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
`);
  }
  console.log(`built ${target}: ${relative(ROOT, out)} (${listFiles(out).length} files, version ${version})`);
}
