/* Video wall — vanilla, no dependencies.
   TEXTS (see data.js) drives everything: tile i shows TEXTS[i].video and is
   labelled with TEXTS[i].title. Three views of the same ten pieces, swapped
   through location.hash so the three links at the top are real links and the
   back button works:
   the mosaic wall (default), the full-bleed carousel, and the plan — the flat's
   floor plan, whose ten pink dots open a card over it (plan.svg carries the
   mapping: data-index on each dot is a TEXTS index). */

(function () {
  'use strict';

  var wall = document.getElementById('wall');
  var modesNav = document.getElementById('modes');
  var modeLinks = modesNav ? modesNav.querySelectorAll('a[data-view]') : [];
  var prevBtn = document.getElementById('prev');
  var nextBtn = document.getElementById('next');
  var zoomUi = document.getElementById('zoom-ui');
  var zoomBack = document.getElementById('zoom-back');

  var planHost = document.getElementById('plan');
  var card = document.getElementById('plan-card');
  var cardTitle = document.getElementById('plan-card-title');
  var cardSummary = document.getElementById('plan-card-summary');
  var cardVideo = document.getElementById('plan-card-video');
  var cardClose = document.getElementById('plan-card-close');

  var ITEM_COUNT = Math.min(TEXTS.length, 10);
  var tiles = [];
  var videos = [];

  var mode = 'mosaic'; // 'mosaic' | 'carousel' | 'plan'
  var index = 0;       // carousel slide
  var zoomed = -1;     // mosaic tile promoted to full screen, -1 when none
  var cardOpen = -1;   // plan dot whose clip is in the card, -1 when none
  var cardOrigin = null; // the dot to hand the focus back to
  var planWired = false;
  var SVG_NS = 'http://www.w3.org/2000/svg';

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
    if (location.hash === '#carrousel') return 'carousel';
    if (location.hash === '#plan') return 'plan';
    return 'mosaic';
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
    // A change of view closes whatever was layered above the view it is
    // leaving: the zoom belongs to the wall, the card to the plan, and the back
    // button can change the hash under them.
    if (next !== mode) {
      closePlanCard();
      closeZoom();
    }

    mode = next;
    // The class lives on <body> so the scrim, the arrows, the views and the
    // plan — all siblings of the wall — can be told about the view too.
    document.body.classList.toggle('mode-mosaic', next === 'mosaic');
    document.body.classList.toggle('mode-carousel', next === 'carousel');
    document.body.classList.toggle('mode-plan', next === 'plan');

    // Three links, one per view: the one on screen is filled in and marked as
    // the current page, so the bar reads as a position rather than a switch.
    Array.prototype.forEach.call(modeLinks, function (link) {
      var current = link.getAttribute('data-view') === next;
      link.classList.toggle('is-current', current);
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    // What a tile does depends on the view: on the wall it enlarges the clip,
    // in the carousel it does nothing at all, so it is neither announced nor
    // reachable as a control there.
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

    // Out of the carousel: everything is reachable again.
    tiles.forEach(function (tile) {
      tile.removeAttribute('aria-hidden');
      tile.setAttribute('tabindex', '0');
    });

    if (next === 'plan') {
      // The wall is hidden: its ten decoders have no business running unseen.
      videos.forEach(function (clip) { clip.pause(); });
      loadPlan();
      return;
    }

    // Back on the wall: everything plays.
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

  /* ---------- plan ---------- */

  // plan.svg is the drawing the designer maintains: its ten pink dots carry the
  // data-index of the piece they show. It is fetched rather than inlined so the
  // file stays the single source — re-exporting it only costs re-adding the ten
  // attributes.
  function loadPlan() {
    if (planWired || !planHost) return;
    planWired = true;

    fetch('plan.svg')
      .then(function (response) {
        if (!response.ok) throw new Error('plan.svg ' + response.status);
        return response.text();
      })
      .then(function (markup) {
        planHost.innerHTML = markup.replace(/^\s*<\?xml[^>]*\?>/, '');
        wirePlan();
      })
      .catch(function () {
        // file:// or a missing asset: at least show the drawing, flat.
        planHost.innerHTML =
          '<img class="plan-img" src="plan.svg" alt="Plan des dix odeurs">';
      });
  }

  function wirePlan() {
    var art = planHost.querySelector('svg');
    var dots = planHost.querySelectorAll('.dot');

    Array.prototype.forEach.call(dots, function (dot) {
      var n = parseInt(dot.getAttribute('data-index'), 10);
      if (isNaN(n) || !TEXTS[n]) return;

      // The mark itself is four tenths of a percent of the drawing: far too
      // small to hit. A transparent circle underneath takes the pointer and
      // the Tab stop, and the mark answers through the sibling selector.
      var hit = document.createElementNS(SVG_NS, 'circle');
      hit.setAttribute('class', 'dot-hit');
      hit.setAttribute('cx', dot.getAttribute('cx'));
      hit.setAttribute('cy', dot.getAttribute('cy'));
      // Wide enough to tap on a phone, narrow enough not to reach a neighbour
      // (the two closest marks are 860 units apart).
      hit.setAttribute('r', '260');
      hit.setAttribute('role', 'button');
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('data-index', String(n));
      hit.setAttribute('aria-label', 'Ouvrir : ' + (TEXTS[n].title || ''));

      // Moved to the end of the drawing: several marks were drawn underneath a
      // white piece of furniture, which swallowed them.
      if (art) {
        art.appendChild(hit);
        art.appendChild(dot);
      } else {
        dot.parentNode.insertBefore(hit, dot);
      }
    });

    planHost.setAttribute(
      'aria-label',
      'Plan du logement — un point rose par odeur'
    );
  }

  function dotIndex(target) {
    var el = target && target.closest ? target.closest('[data-index]') : null;
    if (!el || !planHost.contains(el)) return -1;
    var n = parseInt(el.getAttribute('data-index'), 10);
    return isNaN(n) ? -1 : n;
  }

  function openPlanCard(i, origin) {
    if (mode !== 'plan' || !card) return;
    var item = TEXTS[i];
    if (!item) return;

    cardOpen = i;
    // Handed back on close: the transparent circle is the only focusable of the
    // pair, whatever the press landed on.
    cardOrigin = planHost.querySelector('.dot-hit[data-index="' + i + '"]') || origin || null;
    cardTitle.textContent = item.title || '';
    cardSummary.textContent = item.summary || '';
    card.hidden = false;

    if (item.video) {
      cardVideo.setAttribute('src', item.video);
      cardVideo.load();
      play(cardVideo);
    }

    // The plan dims but stays visible behind the card: it leaves the tab order
    // so the focus cannot wander into a drawing under a dialog.
    planHost.inert = true;
    cardClose.focus();
  }

  function closePlanCard() {
    if (cardOpen < 0) {
      if (card) card.hidden = true;
      return;
    }

    cardOpen = -1;
    card.hidden = true;
    cardVideo.pause();
    // Dropping the source frees the decoder instead of keeping a paused clip
    // alive for a card nobody is looking at.
    cardVideo.removeAttribute('src');
    cardVideo.load();

    planHost.inert = false;
    if (cardOrigin && cardOrigin.focus) cardOrigin.focus();
    cardOrigin = null;
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

  planHost.addEventListener('click', function (e) {
    var n = dotIndex(e.target);
    if (n < 0) return;
    openPlanCard(n, e.target.closest('[data-index]'));
  });

  planHost.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var n = dotIndex(e.target);
    if (n < 0) return;
    e.preventDefault();
    openPlanCard(n, e.target.closest('[data-index]'));
  });

  cardClose.addEventListener('click', function (e) {
    e.stopPropagation();
    closePlanCard();
  });

  // A click on the dimmed plan, around the card, closes it.
  card.addEventListener('click', function (e) {
    if (e.target === card) closePlanCard();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (cardOpen >= 0) {
        e.preventDefault();
        closePlanCard();
      } else if (zoomed >= 0) {
        e.preventDefault();
        closeZoom();
      }
      return;
    }

    if (mode !== 'carousel') return;

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
