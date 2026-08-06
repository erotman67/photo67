/* ==========================================================================
   prerender.mjs

   Turns template.html into a real HTML file per page:

     /                    index.html
     /albums              albums/index.html
     /albums/<slug>       albums/<slug>/index.html
     /about               about/index.html
     /contact             contact/index.html

   Each one carries its own <title>, description, canonical URL, Open Graph
   tags, and — for the photograph pages — the actual <figure> markup already
   in the HTML. So a crawler or a link preview sees the real page without
   running any JavaScript. app.js still takes over for navigation once it
   loads; it re-renders the same content into the same containers.

   Also writes sitemap.xml and robots.txt.

   Run after build-manifest.mjs:  node scripts/prerender.mjs
   ========================================================================== */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ORIGIN = 'https://photo67.com';
const SITE = 'Photo 67';
const BLURB = 'Photographs by Elad. Close-up, light, and water — Tel Aviv, Israel.';

/* must match the two settings at the top of app.js */
const METADATA = 'title-date';
const ROW_HEIGHT = 300;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

/* ---------- helpers ---------- */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const stripExt = (f) => f.replace(/\.[^.]+$/, '');

function niceDate(iso) {
  if (!iso) return '';
  const p = iso.split('-');
  return MONTHS[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10) + ', ' + p[0];
}

function metaFor(p) {
  if (METADATA === 'none') return '';
  const bits = [];
  if (p.title) bits.push(p.title);
  if (p.date) bits.push(niceDate(p.date));
  if (METADATA === 'full' && p.camera) bits.push(p.camera);
  return bits.join('  ·  ');
}

const altFor = (p) => p.title ? p.title + ' — photograph by Elad' : 'Photograph by Elad';

/* Root-relative, so /albums/water/index.html and /index.html both resolve
   the same asset. A <base> tag would have worked too, but it would make
   local preview fetch from the live site. */
function derived(file, w) { return '/derived/' + stripExt(file) + '-' + w + '.webp'; }

function srcFor(photo) {
  if (!photo.widths || !photo.widths.length) return '/photos/' + photo.file;
  const pick = photo.widths.filter((w) => w <= 1400).pop();
  return derived(photo.file, pick || photo.widths[0]);
}

function srcsetFor(photo) {
  if (!photo.widths || !photo.widths.length) {
    return '/photos/' + photo.file + ' ' + photo.w + 'w';
  }
  return photo.widths.map((w) => derived(photo.file, w) + ' ' + w + 'w').join(', ');
}

/* Desktop variant of what app.js builds. On a phone the CSS forces one per
   row anyway, so the prerendered flex-basis is harmless either way. */
function figureHTML(photo) {
  const ar = photo.w / photo.h;
  const grow = Math.round(ar * 1000) / 1000;
  const basis = Math.round(ar * ROW_HEIGHT);
  const meta = metaFor(photo);
  return `<figure style="flex-grow:${grow};flex-basis:${basis}px">`
    + `<img src="${esc(srcFor(photo))}" srcset="${esc(srcsetFor(photo))}"`
    + ` sizes="(min-width:1400px) 45vw, 60vw" width="${photo.w}" height="${photo.h}"`
    + ` loading="lazy" decoding="async" alt="${esc(altFor(photo))}">`
    + (meta ? `<figcaption>${esc(meta)}</figcaption>` : '')
    + `</figure>`;
}

function albumCardHTML(album, photos) {
  const cover = photos[0];
  const count = photos.length + (photos.length === 1 ? ' photograph' : ' photographs');
  return `<a href="/albums/${encodeURIComponent(album.slug)}">`
    + `<img src="${esc(srcFor(cover))}" srcset="${esc(srcsetFor(cover))}" sizes="33vw"`
    + ` width="${cover.w}" height="${cover.h}" loading="lazy" decoding="async"`
    + ` alt="${esc(album.title)}">`
    + `<div class="albums__meta">`
    + `<span class="albums__title">${esc(album.title)}</span>`
    + `<span class="label">${count}</span>`
    + `</div></a>`;
}

/* ---------- page assembly ---------- */

function buildPage(template, opts) {
  let html = template;

  /* head */
  html = html.replace(/<title>[^<]*<\/title>/,
    `<title>${esc(opts.title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${esc(opts.description)}">`);

  const url = ORIGIN + opts.pathname;
  /* og:image must be absolute for crawlers and chat apps */
  const image = opts.image ? ORIGIN + opts.image : null;

  const head = [
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(SITE)}">`,
    `<meta property="og:title" content="${esc(opts.title)}">`,
    `<meta property="og:description" content="${esc(opts.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : '',
    image ? `<meta property="og:image:width" content="${opts.imageW}">` : '',
    image ? `<meta property="og:image:height" content="${opts.imageH}">` : '',
    image ? `<meta property="og:image:alt" content="${esc(opts.imageAlt || '')}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`
  ].filter(Boolean).join('\n');

  html = html.replace('</head>', head + '\n</head>');

  /* show this page's section */
  html = html.replace(
    new RegExp(`(<section data-view="${opts.view}")\\s+hidden(>)`),
    '$1$2');

  /* underline the nav item, the same 1px rule app.js draws */
  if (opts.nav) {
    html = html.replace(
      new RegExp(`(data-nav="${opts.nav}">[^<]*)(</a>)`),
      '$1<span class="underline"></span>$2');
  }

  /* content */
  if (opts.feedHome) {
    html = html.replace('<div class="feed" data-feed="home"></div>',
      `<div class="feed" data-feed="home">${opts.feedHome}</div>`);
  }
  if (opts.albums) {
    html = html.replace('<div class="albums" data-albums></div>',
      `<div class="albums" data-albums>${opts.albums}</div>`);
  }
  if (opts.albumTitle != null) {
    html = html.replace(/(<h1 class="title album__title" data-album-title>)(<\/h1>)/,
      `$1${esc(opts.albumTitle)}$2`);
  }
  if (opts.albumSummary != null) {
    html = html.replace(/(data-album-summary>)(<\/p>)/,
      `$1${esc(opts.albumSummary)}$2`);
  }
  if (opts.feedAlbum) {
    html = html.replace('<div class="feed" data-feed="album"></div>',
      `<div class="feed" data-feed="album">${opts.feedAlbum}</div>`);
  }

  return html;
}

async function emit(relPath, contents) {
  const full = path.join(ROOT, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, contents, 'utf8');
  return relPath;
}

/* ---------- main ---------- */

async function main() {
  const template = await readFile(path.join(ROOT, 'template.html'), 'utf8');
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'photos.json'), 'utf8'));

  const photos = manifest.photos || [];
  const albums = (manifest.albums || []).filter(
    (a) => photos.some((p) => p.album === a.slug));

  const hero = photos[0] || null;
  const heroBits = hero ? {
    image: derived(hero.file, (hero.widths || []).filter((w) => w <= 1400).pop() || hero.w),
    imageW: Math.min(hero.w, 1400),
    imageH: Math.round(hero.h * (Math.min(hero.w, 1400) / hero.w)),
    imageAlt: altFor(hero)
  } : {};

  const written = [];
  const urls = [];

  /* home */
  written.push(await emit('index.html', buildPage(template, {
    view: 'home', nav: 'home', pathname: '/',
    title: SITE, description: BLURB,
    feedHome: photos.map(figureHTML).join(''),
    ...heroBits
  })));
  urls.push({ loc: '/', priority: '1.0' });

  /* albums index */
  written.push(await emit('albums/index.html', buildPage(template, {
    view: 'albums', nav: 'albums', pathname: '/albums',
    title: 'Albums — ' + SITE,
    description: 'Albums of photographs by Elad: ' +
      albums.map((a) => a.title).join(', ') + '.',
    albums: albums.map((a) => albumCardHTML(a, photos.filter((p) => p.album === a.slug))).join(''),
    ...heroBits
  })));
  urls.push({ loc: '/albums', priority: '0.8' });

  /* one page per album */
  for (const album of albums) {
    const ps = photos.filter((p) => p.album === album.slug);
    const cover = ps[0];
    const w = Math.min(cover.w, 1400);
    written.push(await emit(`albums/${album.slug}/index.html`, buildPage(template, {
      view: 'album', nav: 'albums', pathname: '/albums/' + album.slug,
      title: album.title + ' — ' + SITE,
      description: album.summary || `${album.title} — photographs by Elad.`,
      albumTitle: album.title,
      albumSummary: album.summary || '',
      feedAlbum: ps.map(figureHTML).join(''),
      image: srcFor(cover),
      imageW: w,
      imageH: Math.round(cover.h * (w / cover.w)),
      imageAlt: altFor(cover)
    })));
    urls.push({ loc: '/albums/' + album.slug, priority: '0.7' });
  }

  /* about + contact — copy is already in the template, only the head changes */
  written.push(await emit('about/index.html', buildPage(template, {
    view: 'about', nav: 'about', pathname: '/about',
    title: 'About — ' + SITE,
    description: "Elad is a photographer from Israel. His grandfather started him off, and still spends afternoons teaching him the craft.",
    ...heroBits
  })));
  urls.push({ loc: '/about', priority: '0.6' });

  written.push(await emit('contact/index.html', buildPage(template, {
    view: 'contact', nav: 'contact', pathname: '/contact',
    title: 'Contact — ' + SITE,
    description: 'Get in touch with Elad about prints, club submissions, or anything else.',
    ...heroBits
  })));
  urls.push({ loc: '/contact', priority: '0.5' });

  /* sitemap + robots */
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map((u) => `  <url>\n    <loc>${ORIGIN}${u.loc}</loc>\n`
        + `    <lastmod>${today}</lastmod>\n`
        + `    <priority>${u.priority}</priority>\n  </url>`).join('\n')
    + '\n</urlset>\n';
  written.push(await emit('sitemap.xml', sitemap));

  written.push(await emit('robots.txt',
    `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`));

  console.log(`Pre-rendered ${urls.length} pages + sitemap.xml + robots.txt`);
  written.forEach((f) => console.log('  ' + f));
}

main().catch((e) => { console.error(e); process.exit(1); });
