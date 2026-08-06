/* ==========================================================================
   build-manifest.mjs

   Runs in GitHub Actions every time Elad adds or removes a photograph.

   Albums come from folders. A photograph at photos/night-shots/roof.jpg
   belongs to an album called "Night Shots" — no JSON editing required to
   create one. Drop a folder in, and the album exists.

   For each image under photos/ it:
     - generates derived/<same path>/<name>-{480,900,1400,2000,native}.webp
     - reads EXIF for the date taken and the camera
     - writes the record into photos.json

   It never overwrites anything a human typed. Titles, album display titles,
   summaries, and any date or camera already in photos.json are left alone;
   only empty fields get filled in. Records whose image file has gone are
   dropped, along with their derivatives.

   Run locally with:  node scripts/build-manifest.mjs
   ========================================================================== */

import { readFile, writeFile, readdir, mkdir, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';

const ROOT     = process.cwd();
const PHOTOS   = path.join(ROOT, 'photos');
const DERIVED  = path.join(ROOT, 'derived');
const MANIFEST = path.join(ROOT, 'photos.json');

const WIDTHS = [480, 900, 1400, 2000];
const CAP = 2560;   // largest derivative ever generated
const EXT = /\.(jpe?g|png|webp|tiff?)$/i;

/* Photographs live in git forever, so an oversized upload is permanent. Stop
   at 4MB — a 2560px JPEG is 1-2MB, so nothing exported correctly comes close. */
const MAX_BYTES = 4 * 1024 * 1024;

/* Files we can't read. HEIC matters most: it's what an iPhone shoots by
   default, and silently skipping it would mean a photo that uploads fine and
   then never appears on the site. */
const UNREADABLE = /\.(heic|heif|raw|dng|cr2|cr3|nef|arw|orf|rw2|raf|psd|ai)$/i;

/* ---------- helpers ---------- */

const stripExt = (f) => f.replace(EXT, '');

/* "night-shots" -> "Night Shots"; "jaffa_and_the_sea" -> "Jaffa And The Sea" */
function prettify(slug) {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isoDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt) ? '' : dt.toISOString().slice(0, 10);
}

/* Cameras shout: Nikon writes Make "NIKON CORPORATION", Model "NIKON D7200".
   Title-case the words that are pure letters, leave model numbers alone —
   "NIKON D7200" becomes "Nikon D7200", "EOS 5D" stays "EOS 5D". */
function tidyName(s) {
  return s.split(/\s+/).map((word) => {
    if (!/^[A-Za-z]+$/.test(word)) return word;            // has digits: D7200
    if (word !== word.toUpperCase()) return word;          // already mixed: iPhone
    if (word.length <= 3) return word;                     // initialism: EOS, GR
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

function cameraString(exif) {
  if (!exif) return '';
  const bits = [];

  let body = tidyName((exif.Model || '').trim());
  const make = tidyName((exif.Make || '').trim().split(/\s+/)[0]);
  if (body && make && !body.toLowerCase().startsWith(make.toLowerCase())) {
    body = make + ' ' + body;
  }
  if (body) bits.push(body);

  if (exif.FocalLength) bits.push(Math.round(exif.FocalLength) + 'mm');
  if (exif.FNumber)     bits.push('f/' + (Math.round(exif.FNumber * 10) / 10));
  if (exif.ExposureTime) {
    const t = exif.ExposureTime;
    bits.push(t >= 1 ? t + 's' : '1/' + Math.round(1 / t) + 's');
  }
  const iso = exif.ISO || exif.ISOSpeedRatings;
  if (iso) bits.push('ISO ' + iso);

  return bits.join('  ·  ');
}

function byDateDesc(a, b) {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return a.file.localeCompare(b.file);
}

/* Every file under photos/, as a path relative to photos/, split into what we
   can use and what needs Elad's attention. */
async function walk(dir, prefix = '') {
  const images = [], unreadable = [], ignored = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const sub = await walk(path.join(dir, entry.name), rel);
      images.push(...sub.images);
      unreadable.push(...sub.unreadable);
      ignored.push(...sub.ignored);
    } else if (EXT.test(entry.name))        images.push(rel);
    else if (UNREADABLE.test(entry.name))   unreadable.push(rel);
    else                                    ignored.push(rel);
  }
  return { images, unreadable, ignored };
}

/* A message Elad can act on, not a stack trace. */
function refuse(lines) {
  console.error('\n' + '─'.repeat(64));
  lines.forEach((l) => console.error(l));
  console.error('─'.repeat(64));
  console.error('\nThe website has NOT changed — it is still showing what it showed before.');
  console.error('Fix the files above, upload again, and this will go green.\n');
  process.exit(1);
}

async function allWebp(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await allWebp(path.join(dir, entry.name), rel));
    else if (entry.name.endsWith('.webp')) out.push(rel);
  }
  return out;
}

/* ---------- main ---------- */

async function main() {
  if (!existsSync(PHOTOS)) {
    console.error('No photos/ directory — nothing to do.');
    process.exit(0);
  }

  let manifest;
  try {
    manifest = existsSync(MANIFEST)
      ? JSON.parse(await readFile(MANIFEST, 'utf8'))
      : { albums: [], photos: [], portrait: null };
  } catch (e) {
    console.error('\nphotos.json is not valid JSON, so I stopped rather than overwrite it.');
    console.error('Fix the syntax error below and commit again — the live site is untouched.\n');
    console.error('  ' + e.message + '\n');
    process.exit(1);
  }

  const existing = new Map(manifest.photos.map((p) => [p.file, p]));
  const found = await walk(PHOTOS);
  const files = found.images.sort();

  /* --- guard 1: file types we can't read --- */
  if (found.unreadable.length) {
    refuse([
      "These files aren't a kind the website can use:",
      '',
      ...found.unreadable.map((f) => '   ' + f),
      '',
      'If they came from an iPhone they are probably HEIC. Open each one in',
      'Lightroom or Snapseed and export it as a JPEG, then upload that instead.',
      '(Or on the iPhone: Settings > Camera > Formats > Most Compatible, which',
      'makes the camera shoot JPEG from now on.)'
    ]);
  }

  /* --- guard 2: files too big to keep forever --- */
  const heavy = [];
  for (const rel of files) {
    const { size } = await stat(path.join(PHOTOS, rel));
    if (size > MAX_BYTES) heavy.push({ rel, mb: (size / 1024 / 1024).toFixed(1) });
  }
  if (heavy.length) {
    refuse([
      `These photographs are too big (the limit is ${MAX_BYTES / 1024 / 1024}MB each):`,
      '',
      ...heavy.map((h) => `   ${h.rel}  —  ${h.mb}MB`),
      '',
      'Every photograph you upload is kept forever, so big files pile up and',
      'never go away. Export again at about 2560 pixels on the long edge and',
      'they will come out around 1-2MB, looking exactly the same on screen.',
      '',
      'HOW-TO-ADD-PHOTOS.md has the export steps for Lightroom and Snapseed.'
    ]);
  }

  if (found.ignored.length) {
    console.warn(`Ignoring ${found.ignored.length} non-image file(s): ${found.ignored.join(', ')}`);
  }
  if (!files.length) console.warn('photos/ is empty.');

  const out = [];
  const seenAlbums = new Set();
  let built = 0;

  for (const rel of files) {
    const src = path.join(PHOTOS, rel);
    const prev = existing.get(rel) || {};

    const dir = path.posix.dirname(rel);
    const album = dir === '.' ? '' : dir;          // root-level photos: home feed only
    if (album) seenAlbums.add(album);

    const meta = await sharp(src).metadata();
    const swap = meta.orientation && meta.orientation >= 5;   // honour EXIF rotation
    const w = swap ? meta.height : meta.width;
    const h = swap ? meta.width : meta.height;

    /* --- derivatives: standard steps, then the native width capped at CAP.
       A D7200 frame is 6000px wide; nobody needs a 6000px webp, and the
       lightbox is happy at 2560. --- */
    const top = Math.min(w, CAP);
    const widths = WIDTHS.filter((x) => x < top);
    widths.push(top);

    for (const target of widths) {
      const dest = path.join(DERIVED, `${stripExt(rel)}-${target}.webp`);
      if (existsSync(dest)) continue;
      await mkdir(path.dirname(dest), { recursive: true });
      await sharp(src)
        .rotate()
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(dest);
      built++;
    }

    let exif = null;
    try {
      exif = await exifr.parse(src, ['Make', 'Model', 'FocalLength', 'FNumber',
                                     'ExposureTime', 'ISO', 'ISOSpeedRatings',
                                     'DateTimeOriginal', 'CreateDate']);
    } catch { /* no EXIF is fine */ }

    out.push({
      id:     prev.id     || stripExt(rel).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      album,
      file:   rel,
      w, h,
      widths,
      title:  prev.title  ?? '',
      date:   prev.date   || isoDate(exif?.DateTimeOriginal || exif?.CreateDate) || '',
      camera: prev.camera || cameraString(exif) || ''
    });
  }

  /* --- albums: folders create them, humans may rename them --- */
  const albums = manifest.albums || [];
  const known = new Set(albums.map((a) => a.slug));
  const added = [];
  for (const slug of [...seenAlbums].sort()) {
    if (known.has(slug)) continue;
    albums.push({ slug, title: prettify(slug), summary: '' });
    added.push(slug);
  }
  /* Records for folders that no longer exist are kept, not deleted — they hold
     titles and summaries someone wrote. The site hides albums with no photos. */

  /* --- sweep derivatives whose source photo is gone --- */
  const live = new Set(out.flatMap((p) => p.widths.map((x) => `${stripExt(p.file)}-${x}.webp`)));
  let swept = 0;
  for (const f of await allWebp(DERIVED)) {
    if (!live.has(f)) { await unlink(path.join(DERIVED, f)); swept++; }
  }

  out.sort(byDateDesc);
  manifest.albums = albums;
  manifest.photos = out;
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`${out.length} photographs · ${albums.length} albums · ${built} derivatives built · ${swept} swept`);
  if (added.length) console.log(`New albums from folders: ${added.join(', ')}`);

  const loose = out.filter((p) => !p.album).map((p) => p.file);
  if (loose.length) {
    console.log(`\nNot in any album — these show on the home page only:\n  ${loose.join('\n  ')}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
