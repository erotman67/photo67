# Elad — photography portfolio

Plain HTML, CSS and vanilla JavaScript. No framework, no build step, no npm
dependencies, no browser storage. Built from the Claude Design handoff spec.

## Preview it

Double-click **`preview.bat`**. It starts a small local server and opens
<http://localhost:8080/>. Close the window to stop it.

You can't just double-click `index.html` — the browser blocks a `file://` page
from reading `photos.json`, so the feed would come up empty.

## Files

| File | What it is |
|---|---|
| `index.html` | Page shell. Fixed layout + the editable copy blocks. |
| `styles.css` | All styling. Palette and type from the design spec. |
| `app.js` | Router, justified-row maths, lightbox. |
| `photos.json` | **The manifest.** Every photograph and album lives here. |
| `photos/<album>/` | The originals Elad uploads. **Folders are albums.** |
| `derived/` | Generated webp, mirroring `photos/`. Never edit by hand. |
| `scripts/build-manifest.mjs` | The resize + EXIF + manifest builder. |
| `.github/workflows/` | The Action that runs it on every upload. |
| `HOW-TO-ADD-PHOTOS.md` | Elad's guide. Written for him, not for developers. |
| `serve.ps1`, `preview.bat` | Local preview only. Not part of the site. |

## The pipeline

Push anything to `photos/` and the Action resizes it, reads its EXIF, rewrites
`photos.json` and commits the result — which is what triggers the Pages deploy.

**Albums come from folders.** `photos/night-shots/roof.jpg` creates an album
with slug `night-shots` and the display title "Night Shots". Renaming it to
something better is a one-line edit in `photos.json`, and the rename survives
every subsequent rebuild. A photo sitting at the root of `photos/` belongs to no
album and appears on the home feed only.

Nothing a human typed is ever overwritten: titles, album display titles,
summaries, dates and camera strings are all preserved, and only empty fields
get filled from EXIF. Album records are kept even when their folder disappears,
since they hold human-written text — the site hides albums with no photos.

Three guards stop the build before it writes anything, each with a message
written for Elad rather than a developer — and in every case the live site keeps
serving the last good version:

- **Unreadable file type** (HEIC, RAW, PSD…). This one matters: an iPhone shoots
  HEIC by default, and silently skipping it would mean a photo that uploads
  fine and then never appears.
- **Anything over 4MB.** Git keeps every upload forever, so oversized files are
  permanent. A correctly exported 2560px JPEG lands at 1–2MB.
- **Invalid `photos.json`** — a bad edit can't blank the site. Deleting a photograph
sweeps its derivatives on the next run. Re-running changes nothing, so it's safe
to trigger by hand from the Actions tab.

To run it locally: `npm install sharp exifr && node scripts/build-manifest.mjs`

## Changing things

**Photographs and albums** — edit `photos.json`. Nothing in the layout is
hardcoded; it works the same with 10 photographs or 1,000.

```json
{ "id": "p22", "album": "water", "file": "new-photo.jpg",
  "w": 2048, "h": 1366, "title": "", "date": "2026-08-01", "camera": "" }
```

`w` and `h` are the real pixel dimensions — they reserve space so the page
doesn't jump while images load. Newest `date` sorts to the top of Home.
`title`, `camera` and the album `summary` can all be left empty; they're
skipped rather than rendered blank.

**Words on the page** — edit the elements marked `data-editable` in
`index.html`: the Home standfirst, the About paragraph, the Contact paragraph
and the email address. Everything else in that file is fixed layout.

**Two settings** — top of `app.js`:

- `metadata`: `'none'` · `'title-date'` (default) · `'full'` (adds the camera line)
- `rowHeight`: 200–460, the desktop justified row height (default 300)

## Still to do before launch

- Three photographs arrived with black letterbox bars baked in —
  `wasp.jpg`, `grass-spike.jpg`, `blade-dark.jpg` (all 945×2048). Re-export
  from the originals; the layout picks up the corrected shape from
  `photos.json` with no other change.
- Titles and dates in `photos.json` are placeholders for Elad to replace.
- The About portrait is a marked placeholder. Add the file to `photos/`, then
  set `"portrait": { "file": "...", "w": 0, "h": 0 }` in `photos.json`.
- The contact address is `info@photo67.com`, forwarded to Elad via Cloudflare
  Email Routing. Nothing to host — it's forwarding only, not a mailbox.
- Camera strings are all empty — these files carry no EXIF. Photographs
  uploaded straight from the camera will fill in automatically.
