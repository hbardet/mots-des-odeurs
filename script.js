/* Video wall — vanilla, no dependencies.
   TEXTS (see data.js) drives everything: tile i shows TEXTS[i].video, captions
   TEXTS[i].title / .summary. Two presentations of the same ten tiles: the mosaic
   wall (default) and the full-bleed carousel, swapped through location.hash so
   the toggle is a real link and the back button works. */

(function () {
  'use strict';

  var wall = document.getElementById('wall');
  var toggle = document.getElementById('mode-toggle');
  var prevBtn = document.getElementById('prev');
  var nextBtn = document.getElementById('next');
  var zoomUi = document.getElementById('zoom-ui');
  var zoomBack = document.getElementById('zoom-back');
  var zoomText = document.getElementById('zoom-text');
  var modal = document.getElementById('modal');
  var panel = document.getElementById('modal-panel');
  var modalClose = document.getElementById('modal-close');
  var modalTitle = document.getElementById('modal-title');
  var modalAuthor = document.getElementById('modal-author');
  var modalBody = document.getElementById('modal-body');

  var ITEM_COUNT = Math.min(TEXTS.length, 10);
  var tiles = [];
  var videos = [];

  var mode = 'mosaic'; // 'mosaic' | 'carousel'
  var index = 0;       // carousel slide
  var zoomed = -1;     // mosaic tile promoted to full screen, -1 when none

  /* ---------- helpers ---------- */

  function normalise(i) {
    return ((i % ITEM_COUNT) + ITEM_COUNT) % ITEM_COUNT;
  }

  function play(clip) {
    var attempt = clip.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(function () {});
  }

  function playAll() {
    videos.forEach(play);
  }

  /* ---------- build ---------- */

  function buildTile(i) {
    var item = TEXTS[i] || {};

    var tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.setAttribute('data-index', String(i));
    tile.setAttribute('aria-label', 'Agrandir : ' + (item.title || ''));

    var media = document.createElement('span');
    media.className = 'tile-media';

    var clip = document.createElement('video');
    clip.className = 'clip';
    clip.muted = true;
    clip.defaultMuted = true;
    clip.playsInline = true;
    clip.loop = true;
    clip.autoplay = true;
    clip.preload = 'auto';
    clip.setAttribute('muted', '');
    clip.setAttribute('playsinline', '');
    clip.setAttribute('loop', '');
    clip.setAttribute('autoplay', '');
    clip.setAttribute('preload', 'auto');
    if (item.video) clip.setAttribute('src', item.video);

    media.appendChild(clip);

    var caption = document.createElement('span');
    caption.className = 'tile-caption';

    var title = document.createElement('span');
    title.className = 'tile-title';
    title.textContent = item.title || '';

    var summary = document.createElement('span');
    summary.className = 'tile-summary';
    summary.textContent = item.summary || '';

    caption.appendChild(title);
    caption.appendChild(summary);

    tile.appendChild(media);
    tile.appendChild(caption);

    wall.appendChild(tile);
    tiles.push(tile);
    videos.push(clip);
  }

  for (var i = 0; i < ITEM_COUNT; i++) buildTile(i);

  /* ---------- presentations ---------- */

  function modeFromHash() {
    return location.hash === '#carrousel' ? 'carousel' : 'mosaic';
  }

  function showSlide(i) {
    if (!ITEM_COUNT) return;
    index = normalise(i);

    tiles.forEach(function (tile, n) {
      var active = n === index;
      tile.classList.toggle('is-active', active);

      if (mode === 'carousel') {
        if (active) {
          tile.removeAttribute('aria-hidden');
          tile.setAttribute('tabindex', '0');
        } else {
          tile.setAttribute('aria-hidden', 'true');
          tile.setAttribute('tabindex', '-1');
        }
      }

      // Only the visible slide decodes: ten simultaneous decoders on one GPU
      // is what makes the crossfade stutter.
      if (active) play(videos[n]);
      else videos[n].pause();
    });

    // The slide that just left the stage is aria-hidden and see-through: the
    // caret has to travel with the picture, or the next Tab resumes from a
    // ghost nobody can see.
    if (mode === 'carousel' && wall.contains(document.activeElement)) {
      if (document.activeElement !== tiles[index]) tiles[index].focus();
    }
  }

  function setMode(next) {
    // A change of presentation closes whatever was layered above the wall: a
    // zoom or a text panel belongs to the presentation it was opened from, and
    // the back button can change the hash under it.
    if (next !== mode) {
      closeText();
      closeZoom();
    }

    mode = next;
    // The class lives on <body> so the scrim, the arrows and the toggle — all
    // siblings of the wall — can be told about the presentation too.
    document.body.classList.toggle('mode-mosaic', next === 'mosaic');
    document.body.classList.toggle('mode-carousel', next === 'carousel');

    var toCarousel = next === 'mosaic';
    toggle.setAttribute('href', toCarousel ? '#carrousel' : '#mosaique');
    toggle.textContent = toCarousel ? 'Carrousel' : 'Mosaïque';
    toggle.setAttribute(
      'aria-label',
      toCarousel ? 'Passer en mode carrousel' : 'Passer en mode mosaïque'
    );

    // What a tile does depends on the presentation: on the wall it enlarges the
    // clip, in the carousel it does nothing at all, so it is neither announced
    // nor reachable as a control there.
    tiles.forEach(function (tile, n) {
      var title = (TEXTS[n] && TEXTS[n].title) || '';
      tile.disabled = next === 'carousel';
      tile.setAttribute(
        'aria-label',
        next === 'carousel' ? title : 'Agrandir : ' + title
      );
    });
    wall.setAttribute(
      'aria-label',
      next === 'carousel' ? 'Récits, un à la fois' : 'Mosaïque des récits'
    );

    if (next === 'carousel') {
      showSlide(index);
      return;
    }

    // Back on the wall: everything plays, everything is reachable again.
    tiles.forEach(function (tile) {
      tile.removeAttribute('aria-hidden');
      tile.setAttribute('tabindex', '0');
    });
    playAll();
  }

  /* ---------- full screen ---------- */

  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function prefersStill() {
    return !!(motionQuery && motionQuery.matches);
  }

  // The tile grows out of the spot it holds on the wall instead of appearing
  // whole: the box it came from is replayed as a transform, committed, then
  // released, and the browser animates between the two.
  function morph(tile, from, apply) {
    apply();
    if (prefersStill() || !from || !from.width) return;

    var to = tile.getBoundingClientRect();
    if (!to.width || !to.height) return;

    var scaleX = from.width / to.width;
    var scaleY = from.height / to.height;
    if (Math.abs(scaleX - 1) < 0.01 && Math.abs(scaleY - 1) < 0.01) return;

    tile.style.transition = 'none';
    tile.style.transformOrigin = 'top left';
    tile.style.transform =
      'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px)' +
      ' scale(' + scaleX + ',' + scaleY + ')';

    // Read the box back so the starting frame is committed before it is
    // released, otherwise both styles land in the same paint.
    void tile.offsetWidth;

    tile.style.transition = '';
    tile.style.transform = '';
  }

  function openZoom(i) {
    if (mode !== 'mosaic' || !tiles[i]) return;
    var tile = tiles[i];
    var from = tile.getBoundingClientRect();

    morph(tile, from, function () {
      zoomed = i;
      tile.classList.add('is-open');
      // The nine covered tiles still paint behind the enlarged one; they have to
      // leave the tab order too, or nine presses of Tab vanish into a wall the
      // visitor cannot see.
      tiles.forEach(function (other, n) {
        if (n === i) return;
        other.setAttribute('aria-hidden', 'true');
        other.setAttribute('tabindex', '-1');
      });
      zoomUi.hidden = false;
    });

    zoomBack.focus();
  }

  function closeZoom() {
    if (zoomed < 0) return;
    var tile = tiles[zoomed];
    var from = tile.getBoundingClientRect();

    morph(tile, from, function () {
      tile.classList.remove('is-open');
      zoomUi.hidden = true;
      zoomed = -1;
      tiles.forEach(function (t) {
        t.removeAttribute('aria-hidden');
        t.setAttribute('tabindex', '0');
      });
    });

    tile.focus();
  }

  /* ---------- text rendering ---------- */

  function renderBody(content) {
    modalBody.textContent = '';

    String(content || '')
      .split(/\n\s*\n/)
      .forEach(function (block) {
        var lines = block.split('\n').filter(function (line) {
          return line.trim() !== '';
        });
        if (!lines.length) return;

        var prose = [];
        var bullets = [];

        lines.forEach(function (line) {
          if (/^\s*[-–—•]\s+/.test(line)) {
            bullets.push(line.replace(/^\s*[-–—•]\s+/, '').trim());
          } else {
            prose.push(line.trim());
          }
        });

        if (prose.length) {
          var p = document.createElement('p');
          p.textContent = prose.join('\n');
          modalBody.appendChild(p);
        }

        if (bullets.length) {
          var ul = document.createElement('ul');
          bullets.forEach(function (text) {
            var li = document.createElement('li');
            li.textContent = text;
            ul.appendChild(li);
          });
          modalBody.appendChild(ul);
        }
      });
  }

  /* ---------- modal ---------- */

  function openText(i) {
    var item = TEXTS[i];
    if (!item) return;

    modalTitle.textContent = item.title || '';
    modalAuthor.textContent = item.author || '';
    renderBody(item.content);

    // The clip keeps running behind the glass on purpose — the motion is
    // what makes the panel read as glass rather than as a flat sheet.

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    panel.scrollTop = 0;
    modalClose.focus();
  }

  function closeText() {
    if (!modal.classList.contains('is-open')) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    if (mode === 'mosaic' && zoomed >= 0) zoomText.focus();
    else if (tiles[index]) tiles[index].focus();
  }

  /* ---------- wiring ---------- */

  wall.addEventListener('click', function (e) {
    if (zoomed >= 0) return; // the wall is covered; nothing under it is clickable

    // The carousel answers to the arrows only: a click on the full-bleed clip
    // used to open the text panel, which turned a stray click into a page.
    if (mode !== 'mosaic') return;

    var target = e.target;
    var tile = target && target.closest ? target.closest('.tile') : null;
    if (!tile) return;

    var n = parseInt(tile.getAttribute('data-index'), 10);
    if (!isNaN(n)) openZoom(n);
  });

  prevBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    showSlide(index - 1);
  });

  nextBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    showSlide(index + 1);
  });

  zoomBack.addEventListener('click', function (e) {
    e.stopPropagation();
    closeZoom();
  });

  zoomText.addEventListener('click', function (e) {
    e.stopPropagation();
    if (zoomed >= 0) openText(zoomed);
  });

  modalClose.addEventListener('click', function (e) {
    e.stopPropagation();
    closeText();
  });

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeText();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (modal.classList.contains('is-open')) {
        e.preventDefault();
        closeText();
      } else if (zoomed >= 0) {
        e.preventDefault();
        closeZoom();
      }
      return;
    }

    if (mode !== 'carousel') return;
    if (modal.classList.contains('is-open')) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      showSlide(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      showSlide(index + 1);
    }
  });

  window.addEventListener('hashchange', function () {
    setMode(modeFromHash());
  });

  /* ---------- boot ---------- */

  if (!ITEM_COUNT) {
    console.error('Aucun récit : vérifiez data.js.');
  } else {
    setMode(modeFromHash());
    // Some browsers withhold autoplay until the first gesture of the session.
    document.addEventListener('pointerdown', function () {
      if (mode === 'mosaic') playAll();
    }, { once: true });
  }
})();
