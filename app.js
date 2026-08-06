/* ==========================================================================
   photo67.com — Elad, photography portfolio
   Plain vanilla JavaScript. No framework, no build step, no storage APIs.

   Nothing here hardcodes a photograph. Everything derives from photos.json,
   so the layout is identical with 10 photographs or 1,000.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- the two tuneable settings from the design spec ---------- */
  var CONFIG = {
    metadata: 'title-date',  // 'none' | 'title-date' | 'full'
    rowHeight: 300           // 200–460, desktop justified row height
  };

  var MANIFEST = { albums: [], photos: [], portrait: null };

  /* ---------- image contract ----------
     The build pipeline writes a "widths" array onto every photo record and
     emits derived/<name>-<width>.webp for each entry. If a record has no
     widths — a photo dropped in by hand before the Action has run — we fall
     back to the original file as a single true-width candidate, so nothing
     ever renders broken. */
  /* file is a path relative to photos/, e.g. "water/dew-blade.jpg";
     derived/ mirrors that structure exactly. */
  function baseName(file) { return file.replace(/\.[^.]+$/, ''); }

  function derived(file, w) { return 'derived/' + baseName(file) + '-' + w + '.webp'; }

  function src(photo) {
    if (!photo.widths || !photo.widths.length) return 'photos/' + photo.file;
    /* default to the largest step at or below 1400 — a sensible first paint */
    var pick = photo.widths.filter(function (w) { return w <= 1400; }).pop();
    return derived(photo.file, pick || photo.widths[0]);
  }

  function srcset(photo) {
    if (!photo.widths || !photo.widths.length) {
      return 'photos/' + photo.file + ' ' + photo.w + 'w';
    }
    return photo.widths.map(function (w) {
      return derived(photo.file, w) + ' ' + w + 'w';
    }).join(', ');
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  function niceDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return MONTHS[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10) + ', ' + p[0];
  }

  /* Missing fields are skipped, never rendered empty. */
  function metaFor(p) {
    if (CONFIG.metadata === 'none') return '';
    var bits = [];
    if (p.title) bits.push(p.title);
    if (p.date) bits.push(niceDate(p.date));
    if (CONFIG.metadata === 'full' && p.camera) bits.push(p.camera);
    return bits.join('  ·  ');
  }

  function altFor(p) {
    return p.title ? p.title + ' — photograph by Elad' : 'Photograph by Elad';
  }

  var narrowMQ = window.matchMedia('(max-width: 899px)');
  function isNarrow() { return narrowMQ.matches; }

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* Every <img> gets an explicit width/height so the page never jumps,
     a srcset, and lazy loading. Attributes are set explicitly rather than
     via IDL properties so the markup is identical in every engine. */
  function makeImg(photo, sizes, alt) {
    var img = document.createElement('img');
    img.setAttribute('src', src(photo));
    img.setAttribute('srcset', srcset(photo));
    img.setAttribute('sizes', sizes);
    img.setAttribute('width', photo.w);
    img.setAttribute('height', photo.h);
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.setAttribute('alt', alt);
    return img;
  }

  /* ======================================================================
     Photo figures — justified rows, no cropping
     ====================================================================== */

  function buildFigure(photo, list, index) {
    var ar = photo.w / photo.h;
    var fig = document.createElement('figure');
    fig.style.flexGrow = String(Math.round(ar * 1000) / 1000);
    fig.style.flexBasis = isNarrow() ? '100%' : Math.round(ar * CONFIG.rowHeight) + 'px';

    var img = makeImg(photo, isNarrow() ? '100vw' : '(min-width:1400px) 45vw, 60vw', altFor(photo));
    img.addEventListener('click', function () { openLightbox(list, index); });
    fig.appendChild(img);

    var meta = metaFor(photo);
    if (meta) {
      var cap = document.createElement('figcaption');
      cap.textContent = meta;
      fig.appendChild(cap);
    }
    return fig;
  }

  function renderFeed(container, photos) {
    container.textContent = '';
    photos.forEach(function (p, i) {
      container.appendChild(buildFigure(p, photos, i));
    });
  }

  /* ======================================================================
     Views
     ====================================================================== */

  function byDateDesc(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }

  function photosIn(slug) {
    return MANIFEST.photos.filter(function (p) { return p.album === slug; });
  }

  function renderHome() {
    var sorted = MANIFEST.photos.slice().sort(byDateDesc);
    renderFeed($('[data-feed="home"]'), sorted);
  }

  function renderAlbums() {
    var wrap = $('[data-albums]');
    wrap.textContent = '';

    MANIFEST.albums.forEach(function (album) {
      var ps = photosIn(album.slug);
      /* an album whose folder is empty (or gone) simply doesn't appear */
      if (!ps.length) return;
      var cover = ps[0];

      var a = document.createElement('a');
      a.href = '/albums/' + encodeURIComponent(album.slug);

      var img = makeImg(cover, isNarrow() ? '100vw' : '33vw', album.title);

      var meta = document.createElement('div');
      meta.className = 'albums__meta';

      var t = document.createElement('span');
      t.className = 'albums__title';
      t.textContent = album.title;

      var c = document.createElement('span');
      c.className = 'label';
      c.textContent = ps.length + (ps.length === 1 ? ' photograph' : ' photographs');

      meta.appendChild(t);
      meta.appendChild(c);
      a.appendChild(img);
      a.appendChild(meta);
      wrap.appendChild(a);
    });
  }

  function renderAlbum(slug) {
    var album = MANIFEST.albums.filter(function (a) { return a.slug === slug; })[0];
    var ps = photosIn(slug);

    $('[data-album-title]').textContent = album ? album.title : 'Album';

    var summaryEl = $('[data-album-summary]');
    summaryEl.textContent = album && album.summary ? album.summary : '';
    summaryEl.hidden = !(album && album.summary);

    renderFeed($('[data-feed="album"]'), ps);
  }

  function renderAbout() {
    var slot = $('[data-portrait]');
    var pt = MANIFEST.portrait;
    if (!pt) return;                      // keep the marked placeholder
    slot.textContent = '';
    slot.appendChild(makeImg(pt, isNarrow() ? '100vw' : '40vw', 'Self-portrait of Elad'));
  }

  /* ======================================================================
     Router — real paths: /, /albums, /albums/<slug>, /about, /contact

     There is only one HTML file. Cloudflare is configured to serve it for
     any path that isn't a real file, and this router reads location.pathname
     to decide what to render. Links are intercepted so navigation never
     reloads the page, and Back/Forward still work.
     ====================================================================== */

  var SITE = 'Photo 67';

  function setTitle(part) {
    document.title = part ? part + ' — ' + SITE : SITE;
  }

  function show(view) {
    $$('[data-view]').forEach(function (s) { s.hidden = s.getAttribute('data-view') !== view; });
    $$('.nav a').forEach(function (a) {
      var on = a.getAttribute('data-nav') === view;
      var rule = $('.underline', a);
      if (on && !rule) {
        var span = document.createElement('span');
        span.className = 'underline';
        a.appendChild(span);
      } else if (!on && rule) {
        rule.remove();
      }
    });
  }

  /* "/albums/water/" and "/albums/water" are the same page */
  function currentPath() {
    var p = location.pathname.replace(/\/+$/, '');
    return p === '' ? '/' : p;
  }

  function route(keepScroll) {
    closeLightbox();
    var path = currentPath();

    if (path.indexOf('/albums/') === 0) {
      var slug = decodeURIComponent(path.slice(8));
      var album = MANIFEST.albums.filter(function (a) { return a.slug === slug; })[0];
      renderAlbum(slug);
      show('album');
      setTitle(album ? album.title : 'Album');
    } else if (path === '/albums') {
      renderAlbums();
      show('albums');
      setTitle('Albums');
    } else if (path === '/about') {
      renderAbout();
      show('about');
      setTitle('About');
    } else if (path === '/contact') {
      show('contact');
      setTitle('Contact');
    } else {
      /* unknown paths fall back to the feed rather than a dead end */
      renderHome();
      show('home');
      setTitle('');
    }
    if (!keepScroll) window.scrollTo(0, 0);
  }

  function navigate(path) {
    if (path === currentPath()) return;
    history.pushState(null, '', path);
    route();
  }

  /* Intercept in-site links. Modifier-clicks, middle-clicks, new-tab and
     external links are all left to the browser. */
  function wireLinks() {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;

      var href = a.getAttribute('href');
      if (!href || href.charAt(0) !== '/') return;   // mailto:, http://, #…

      e.preventDefault();
      navigate(href);
    });

    window.addEventListener('popstate', function () { route(); });
  }

  /* ======================================================================
     Lightbox — the main event
     ====================================================================== */

  var lb = {
    el: null, img: null, meta: null, counter: null,
    list: null, i: 0, touchX: null, touchY: null
  };

  function openLightbox(list, index) {
    lb.list = list;
    lb.i = index;
    paintLightbox();
    lb.el.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lb.el || lb.el.hidden) return;
    lb.el.hidden = true;
    lb.list = null;
    document.body.style.overflow = '';
  }

  function paintLightbox() {
    var p = lb.list[lb.i];
    /* the lightbox asks for the widest step in the srcset */
    lb.img.setAttribute('src', src(p));
    lb.img.setAttribute('srcset', srcset(p));
    lb.img.setAttribute('sizes', '100vw');
    lb.img.setAttribute('width', p.w);
    lb.img.setAttribute('height', p.h);
    lb.img.setAttribute('decoding', 'async');
    lb.img.setAttribute('alt', altFor(p));
    lb.meta.textContent = metaFor(p);
    lb.counter.textContent = (lb.i + 1) + ' / ' + lb.list.length;
  }

  function step(d) {
    if (!lb.list) return;
    var n = lb.list.length;
    lb.i = (lb.i + d + n) % n;
    paintLightbox();
  }

  function wireLightbox() {
    lb.el      = $('[data-lightbox]');
    lb.img     = $('[data-lb-img]');
    lb.meta    = $('[data-lb-meta]');
    lb.counter = $('[data-lb-counter]');

    lb.el.addEventListener('click', closeLightbox);          // tap outside closes
    lb.img.addEventListener('click', function (e) { e.stopPropagation(); });

    $('[data-lb-close]').addEventListener('click', function (e) { e.stopPropagation(); closeLightbox(); });
    $('[data-lb-prev]').addEventListener('click',  function (e) { e.stopPropagation(); step(-1); });
    $('[data-lb-next]').addEventListener('click',  function (e) { e.stopPropagation(); step(1); });

    lb.el.addEventListener('touchstart', function (e) {
      lb.touchX = e.touches[0].clientX;
      lb.touchY = e.touches[0].clientY;
    }, { passive: true });

    lb.el.addEventListener('touchend', function (e) {
      if (lb.touchX == null) return;
      var dx = e.changedTouches[0].clientX - lb.touchX;
      var dy = e.changedTouches[0].clientY - lb.touchY;
      lb.touchX = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    });

    window.addEventListener('keydown', function (e) {
      if (lb.el.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
  }

  /* ======================================================================
     Boot
     ====================================================================== */

  function reflowOnBreakpointChange() {
    /* re-render so figure flex-basis switches between one-per-row and
       justified rows; keep the reader where they were */
    var handler = function () { route(true); };
    if (narrowMQ.addEventListener) narrowMQ.addEventListener('change', handler);
    else narrowMQ.addListener(handler);
  }

  function start(manifest) {
    MANIFEST = manifest;
    wireLightbox();
    wireLinks();
    reflowOnBreakpointChange();
    route();
  }

  function fail(err) {
    var main = $('.main');
    main.textContent = '';
    var p = document.createElement('p');
    p.className = 'standfirst';
    p.textContent = 'Could not load photos.json — ' + err +
      '. If you opened this file directly from disk, run it through a local web server instead.';
    main.appendChild(p);
  }

  fetch('photos.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(start)
    .catch(function (e) { fail(e.message || String(e)); });

})();
