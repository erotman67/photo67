# Adding photographs to photo67.com

You don't need to install anything, and you can't break the site. Everything
happens in a web browser, and every change can be undone.

---

## How it's organised

Inside **`photos`** there's a folder per album:

```
photos/
  water/     ← the album called "Water Holds Light"
  green/
  dogs/
  sea/
  table/
  car/
```

**The folder is the album.** Put a photograph in `dogs`, it's in that album.
Make a new folder, you've made a new album. Nothing else to do.

---

## Adding photographs to an album that already exists

1. Go to your repository on **github.com** and open **`photos`**, then the album
   folder you want.
2. Click **Add file → Upload files**.
3. Drag your photographs in. You can drop in twenty at once.
4. Scroll down, click the green **Commit changes** button.

That's it. Wait about a minute and refresh photo67.com — they're there, on the
home page and in that album.

### What happens in that minute

A robot wakes up and does the boring work for you:

- makes four smaller copies of each photograph, so the site loads fast on a phone
- reads the date and camera settings out of the file
- adds each photograph to the site, newest first

You'll see a small orange dot next to your upload while it's thinking, then a
green tick when it's finished.

If you see a **red ✕**, click it and read the message — it's written for you and
it says exactly which file to fix. Usually it's a photograph that's too big, or
an iPhone HEIC that needs exporting as a JPEG first. The website carries on
showing what it showed before, so nothing is broken while you sort it out.

---

## Exporting: how to get the file size down

Two rules, and the website checks both for you:

- **JPEG**, not HEIC and not RAW
- **Under 4MB** — around 2560 pixels on the long edge gets you there

If you break either rule the upload doesn't break anything. The site keeps
showing what it showed before, and you get a message telling you which file and
what to do. Fix it, upload again, done.

Straight off the D7200 both rules are broken — the camera makes 6000 × 4000
files at 8–12MB, and NEF files are RAW. So there's always an export step. Here's
how.

### On the PC — Nikon NX Studio

This is Nikon's own program, it's genuinely free, and it's built for your
camera — it opens NEF files straight off the card. Install it once:

**<https://downloadcenter.nikonimglib.com/en/products/564/NX_Studio.html>**

Pick the Windows version. No account, no licence key, no trial that runs out.

1. Open the folder from your memory card
2. Click the photograph you want (or ctrl-click several — this works on a whole
   batch at once)
3. **File → Convert Files…**
4. Set:
   - **File Format: JPEG**
   - **Image Quality: Excellent** (or High)
   - **Image Size → Long Edge: 2560** pixels
   - **Remove shooting data: leave UNTICKED** ← this is how the site knows your
     camera settings and the date. Tick it and those disappear.
5. Choose a destination folder — make a folder named after the album you want
6. **Convert**

Now upload that folder. The files will be around 1–2MB each.

### On the iPhone — Lightroom Mobile

The free version is enough for this.

1. Open the photograph, tap the **share icon** (top right)
2. Tap **Export As…**
3. Set:
   - **File Type: JPG**
   - **Dimensions → Long Edge → 2560** px
   - **Quality: 85**
   - **Include Metadata: On** ← same thing, leave it on
4. Tap the tick, then **Save to Files**

### Straight off the D7200 — this won't work

The card from your camera has 6000 × 4000 pixel files at 8–12MB each, and NEF
files are RAW. Both get refused: too big, and RAW isn't something a browser can
show.

That's not a problem, it just means the export step isn't optional. Open the card
in NX Studio, do your editing, and convert as above. The 2560px JPEG that comes
out is what goes on the site.

The good part: NX Studio converts a whole batch in one go, so a card full of
photographs is still just a few clicks.

### Straight from the iPhone Photos app — also won't work

It can't resize on export, so what comes out is HEIC or a very large JPEG, and
the site will refuse it. Use Lightroom Mobile as above.

If you want the iPhone to stop shooting HEIC altogether: **Settings → Camera →
Formats → Most Compatible**. Files are still big, so you'd still export.

### Why the limit exists

Every photograph you ever upload is kept forever, even after you delete it —
that's how the history works, and it's also why nothing can ever be truly lost.
The trade is that big files pile up permanently. A 25MB original and a 2MB
export look **exactly the same** on any screen anyone will ever use, so there's
nothing to gain from the big one.

---

## Making a new album

Easiest way: **make the folder on your computer first**, put the photographs in
it, then open **`photos`** on github.com, click **Add file → Upload files**, and
drag the whole folder in. GitHub keeps the folder, and the album appears.

The folder name becomes the album name, tidied up:

| Folder you make | Album people see |
|---|---|
| `night-shots` | Night Shots |
| `tel-aviv` | Tel Aviv |
| `the-cat` | The Cat |

Use lowercase, and dashes instead of spaces.

An album with no photographs in it doesn't show up at all, so nothing appears
half-finished.

---

## Changing an album's name

The tidied-up folder name is only a starting point. To give an album a proper
title — or add the little paragraph under it — open **`photos.json`** on
github.com and click the **pencil** icon.

Find your album near the top and change `title` and `summary`:

```json
{
  "slug": "night-shots",
  "title": "After Dark",
  "summary": "Everything I shot after the sun went down."
}
```

Don't touch `slug` — that's the folder name, and changing it breaks the link.

Then **Commit changes** at the bottom. Whatever you write here is yours; the
robot never overwrites it.

---

## Giving a photograph a caption

Same file, same pencil. Find your photograph in the `photos` list and fill in
`title`:

```json
{
  "file": "night-shots/roof.jpg",
  "title": "Rain on the window",
  "date": "2026-08-14"
}
```

Leave `title` empty if you don't want a caption — the site shows nothing rather
than an empty space. Same for `camera`.

**One rule when editing this file:** every line inside `{ }` ends with a comma
except the last one. If you get it wrong, nothing bad happens to the website —
the robot notices, refuses to continue, and the site carries on showing what it
showed before. Check the **Actions** tab and it'll tell you which line to fix.

---

## Changing the words on the site

The About paragraph, the Contact paragraph, and the line at the top of the home
page all live in **`index.html`**. Look for the parts marked `data-editable` —
those are yours to change. Leave everything else alone.

---

## Deleting a photograph

Open it in the `photos` folder, click the **bin** icon, then **Commit changes**.
The robot cleans up the leftovers by itself.

---

## If something looks wrong

Nothing is ever really lost. Every upload is saved as a separate step, so any
change can be rolled back to how it was before. Ask your dad and he can undo it.

If the site doesn't update after a few minutes, check the **Actions** tab on
github.com — that's where the robot writes down what it did.
