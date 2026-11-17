# TV Mosaic Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a video-wall presentation to the site — ten tiles, all looping, 4 / 4 / 2 with the last row centered, a caption under each, click-to-fullscreen with a back control, and a top-left link to swap to the existing carousel.

**Architecture:** One page, one set of ten tile elements built from `data.js`. The mosaic is a CSS grid; the carousel is the same tiles stacked full-bleed with one `.is-active`. The presentation is driven by `location.hash` (`#mosaique` / `#carrousel`), so the toggle is a real `<a href>` and the back button works, with no reload and no clip teardown.

**Tech Stack:** Vanilla HTML / CSS / JS. No build, no dependency, runs by double-clicking `index.html` (`file://`).

**Spec:** `docs/2026-11-15-tv-mosaic-design.md`

## Global Constraints

- Vanilla only: no framework, no bundler, no npm dependency, no CDN, no `type="module"`.
- Must work from `file://`: no `fetch()`, no `import`. All data arrives via `<script src="data.js">` as `const TEXTS`.
- Every `<video>` is `muted playsinline loop autoplay preload="auto"`. Nothing is ever unmuted: the clips carry no sound worth preserving.
- `<html lang="fr">`. Every user-facing string and `aria-label` is French.
- Inline text is written with `textContent`, never `innerHTML`.
- Desktop only. No phone layout, no responsive breakpoint for the wall.
- No git repository in this project: **there are no commit steps in this plan.** If version control is wanted, `git init` first and commit at each task boundary.
- Media: `video/video1..4.mp4` are 1772 × 1180 (≈ 3:2), 12–20 s, 18–22 MB. `video/video5..10.mp4` will be byte copies.
- Manual verification is the test harness: open `file:///Users/hugo/Project/julieSite/index.html` in a browser. Data-shape checks run through `node`.

## Review Focus

1. **A clip file missing or renamed while its entry still points at it.** Expected: the other nine tiles keep playing, that one tile stays dark but keeps its caption, nothing throws. Never a blank page.
2. **One entry with a short or absent `summary`.** Expected: the wall's rows stay aligned; a shorter caption never pulls its row out of line.
3. **`TEXTS.length` not exactly 10** (clips not copied yet, or an 11th added later). Expected: the wall renders what exists, no crash; the centered-last-row rule simply does not apply.
4. **An unknown or stale hash** (`#carousel`, `#Mosaique`, a typo, a hash from an old bookmark). Expected: falls back to the mosaic, never a blank screen.
5. **The browser back button while the text panel is open over a zoomed tile.** Expected: the map/presentation stays coherent — no panel stranded over a grid it does not belong to.

---

### Task 1: Ten entries in `data.js`, and the six copied clips

**Files:**
- Modify: `data.js` (whole array)
- Create: `video/video5.mp4`, `video/video6.mp4`, `video/video7.mp4`, `video/video8.mp4`, `video/video9.mp4`, `video/video10.mp4`

**Interfaces:**
- Consumes: nothing.
- Produces: `TEXTS`, an array of exactly 10 objects with the shape
  `{ video: string, title: string, author: string, summary: string, content: string }`.
  Entry *i* is the tile at index *i−1*. Layout of the array: 1–4 are the real pieces in their
  current order; 5–10 are temporary duplicates — 5←1, 6←2, 7←3, 8←4, 9←1, 10←2 (both clip and
  text), so tile *n* for *n ≥ 5* is a copy of tile *n−4* (and 9, 10 copy 1, 2 again).

- [ ] **Step 1: Copy the clips**

```bash
cd /Users/hugo/Project/julieSite
cp video/video1.mp4 video/video5.mp4
cp video/video2.mp4 video/video6.mp4
cp video/video3.mp4 video/video7.mp4
cp video/video4.mp4 video/video8.mp4
cp video/video1.mp4 video/video9.mp4
cp video/video2.mp4 video/video10.mp4
```

- [ ] **Step 2: Rewrite `data.js`**

Update the header comment to say `data.js` is now the source of truth (the `text.json` it
mentions is gone). Add `video` as the first key of every entry and `summary` between `author`
and `content`; leave each `content` byte-identical. On the six temporary entries, put a comment
line directly above the object: `// PLACEHOLDER — remplacer le clip et le texte`. Use these four
summaries verbatim for entries 1–4, and repeat them on the duplicates:

1. `L'odeur d'essence de mon enfance, et ce qu'elle m'a appris sur l'huile d'olive.`
2. `Soleil, sel, sable et immortelle : le parfum d'une peau qui garde la journée.`
3. `Les pelages mouillés de mes chiens, entre terre sèche, cuir vieilli et herbe fraîche.`
4. `Tubéreuse, lotus, iris, mimosa : ce que les fleurs racontent quand on ferme les yeux.`

`video` values are `'video/video1.mp4'` … `'video/video10.mp4'`, in order.

- [ ] **Step 3: Verify the shape**

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('data.js','utf8');const T=eval(s.slice(s.indexOf('['),s.lastIndexOf(']')+1));const ok=T.length===10&&T.every(t=>t.video&&t.title&&t.author&&t.summary&&t.content)&&T.every(t=>t.summary.length<=110)&&T.every(t=>fs.existsSync(t.video));console.log(T.length,ok)"
```

Expected: `10 true`

---

### Task 2: The page shell and the ten tiles, built from the data

**Files:**
- Modify: `index.html` (body only)
- Modify: `script.js` (replaces the hardcoded `SOURCES`/`clips` boot with a builder)
- Modify: `style.css` (only the rule that lets a `.clip` sit inside a tile)

**Interfaces:**
- Consumes: `TEXTS` from Task 1.
- Produces: in `script.js`, inside the existing IIFE —
  `var tiles = []` (ten `<button class="tile">` elements), `var videos = []` (the ten `<video>`),
  `function playAll()` (calls `.play()` on every video, swallowing the rejection),
  and the click behaviour difference by mode is wired in Task 4, not here.
  DOM ids produced: `#wall`, `#scrim`, `#mode-toggle`, `#zoom-ui`, `#zoom-back`, `#zoom-text`,
  `#prev`, `#next`, `#modal` (unchanged), `#modal-close`, `#modal-title`, `#modal-author`,
  `#modal-body`.

- [ ] **Step 1: Replace the body of `index.html`**

```html
<div id="wall" class="mode-mosaic" aria-label="Mosaïque des récits"></div>
<div id="scrim" aria-hidden="true"></div>

<a id="mode-toggle" href="#carrousel">Carrousel</a>

<button id="prev" type="button" aria-label="Séquence précédente">
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 4 7 12l8 8"/></svg>
</button>
<button id="next" type="button" aria-label="Séquence suivante">
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 4l8 8-8 8"/></svg>
</button>

<div id="zoom-ui" hidden>
  <button id="zoom-back" type="button" aria-label="Revenir à la mosaïque">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 4 7 12l8 8"/></svg>
  </button>
  <button id="zoom-text" type="button">Lire le texte</button>
</div>

<div id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-hidden="true">
  <div id="modal-panel">
    <button id="modal-close" type="button" aria-label="Fermer">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <h2 id="modal-title"></h2>
    <p id="modal-author"></p>
    <div id="modal-body"></div>
  </div>
</div>
```

The `#stage` div and its four `.clip` children go away entirely.

- [ ] **Step 2: Build the tiles in `script.js`**

Replace the `SOURCES` array and the `stage`/`clips` lookups with:

```js
var wall = document.getElementById('wall');
var toggle = document.getElementById('mode-toggle');
var zoomUi = document.getElementById('zoom-ui');
var zoomBack = document.getElementById('zoom-back');
var zoomText = document.getElementById('zoom-text');

var ITEM_COUNT = Math.min(TEXTS.length, 10);
var tiles = [];
var videos = [];
```

and a builder that, for each `i` in `0 … ITEM_COUNT-1`, appends a `<button class="tile" type="button" data-index="i" aria-label="Agrandir : " + TEXTS[i].title>` containing
`<span class="tile-media"><video class="clip" muted playsinline loop autoplay preload="auto" src=TEXTS[i].video></span>` and
`<span class="tile-caption"><span class="tile-title">title</span><span class="tile-summary">summary</span></span>`.
All text via `textContent`. Push the button into `tiles` and the video into `videos`.

While you are in there, delete the machinery this plan replaces: the `SOURCES` array is gone,
`#stage` no longer exists, and the old `reveal()`, `waitFor()`, `show()`, the `stage` click
handler and the document `keydown` handler all have to go so the page boots without a
`null` reference. `normalise()` stays — Task 4 reuses it. Navigation, zoom and keyboard come
back in Tasks 4–6; until then the page only builds and plays.

- [ ] **Step 3: Start playback**

`playAll()` maps over `videos` and calls `.play()`, guarding with
`if (attempt && typeof attempt.catch === 'function') attempt.catch(function () {})`.
Call it once after building, and once from a one-shot `document.addEventListener('pointerdown', …, { once: true })` for browsers that withhold autoplay until a gesture.

Keep `renderBody()` verbatim. `openModal()` and `closeModal()` also stay, but strip their two
references to the deleted carousel state (`TEXTS[index]` stays for now; the
`if (visible >= 0) play(clips[visible]);` line goes) so the page stays bootable. Task 4 turns them
into `openText(i)` / `closeText()`.

- [ ] **Step 4: Let a clip fill its tile**

In `style.css`, keep `.clip` at `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover`, set its `opacity: 1`, and drop the `#stage` rule and the `.clip.is-active` rule (tile opacity takes over in Task 4). Add `.tile-media { display: block; position: relative; }` so each clip is boxed by its own tile — the rest of the tile styling arrives in Task 3.

- [ ] **Step 5: Verify**

Open `file:///Users/hugo/Project/julieSite/index.html`. Expected: ten tiles in the DOM
(`document.querySelectorAll('.tile').length === 10` in the console), each with its clip inside its
own box, all ten playing, laid out as one column for now. Expected: no console error, and none
about a missing `stage`.

---

### Task 3: The wall — 4 / 4 / 2 grid with captions

**Files:**
- Modify: `style.css`

**Interfaces:**
- Consumes: `.tile`, `.tile-media`, `.tile-caption`, `.tile-title`, `.tile-summary` from Task 2.
- Produces: `--gap: clamp(10px, 1.2vw, 20px)` and `--pad: clamp(16px, 2vw, 34px)` on `:root`,
  reused by the carousel in Task 4. The mode class on `#wall` is `mode-mosaic` when this task is
  done.

- [ ] **Step 1: Grid and tiles**

```css
#wall.mode-mosaic {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--gap);
  padding: var(--pad);
  min-height: 100dvh;
  align-content: start;
}
#wall.mode-mosaic .tile { grid-column: span 3; }
#wall.mode-mosaic .tile:nth-child(9) { grid-column: 4 / span 3; }
#wall.mode-mosaic .tile:nth-child(10) { grid-column: 7 / span 3; }
```

- [ ] **Step 2: Tile interior**

`.tile` reset: `appearance: none; border: 0; padding: 0; background: none; color: inherit;
font: inherit; text-align: left; cursor: pointer; display: block;`
`.tile-media { position: relative; display: block; aspect-ratio: 3 / 2; overflow: hidden; background: #14120f; }`
`.tile-caption { display: block; padding-top: 10px; }`
`.tile-title { display: block; font-size: 11.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; line-height: 1.35; }`
`.tile-summary { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 4px; font-size: 12.5px; line-height: 1.45; color: var(--ink-soft); }`
Give `.tile-title` a `min-height` of two lines so a one-line title never pulls its row out of line.

- [ ] **Step 3: Verify**

Reload. Expected: four tiles on the first two rows, two tiles centered on the third, all ten
identical in size, each with its title and one-line summary underneath, the whole wall visible
without scrolling at a 16:9-ish window. Narrow the window until it is tall: expected, the wall
scrolls instead of cropping a caption.

Then comment out entries 9 and 10 in `data.js` and reload: expected, eight tiles render, two full
rows, no crash, no centred last row, and the console is still clean. Restore the two entries.

---

### Task 4: Swapping presentations through the URL hash

**Files:**
- Modify: `script.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: `tiles`, `videos`, `playAll()`, `wall`, `toggle` from Task 2; `--gap`/`--pad` from Task 3.
- Produces: `var mode = 'mosaic'|'carousel'`, `function setMode(next)`,
  `function modeFromHash()`, `var index = 0` (carousel slide), `function showSlide(i)`,
  `function openText(i)`, `function closeText()`.

- [ ] **Step 1: Mode plumbing**

`modeFromHash()` returns `'carousel'` if `location.hash === '#carrousel'`, else `'mosaic'`.
`setMode(next)`: set `mode = next`; `wall.className = 'mode-' + next`; `toggle.setAttribute('href', next === 'mosaic' ? '#carrousel' : '#mosaique')`; `toggle.textContent = next === 'mosaic' ? 'Carrousel' : 'Mosaïque'`; `toggle.setAttribute('aria-label', …)` in French with the same two words; then the per-mode bookkeeping below.
Wire `window.addEventListener('hashchange', function () { setMode(modeFromHash()); })` and call
`setMode(modeFromHash())` at boot. `#mosaique`, empty, and any unknown hash all land on mosaic.

- [ ] **Step 2: Decode policy and tab order**

On entering carousel: `videos.forEach(function (v, n) { if (n !== index) v.pause(); })`, every tile except `index` gets `tabindex="-1"` and `aria-hidden="true"`, tile `index` gets `tabindex="0"` and no `aria-hidden`. On entering mosaic: `playAll()`, every tile gets `tabindex="0"` and `aria-hidden` removed. Then `showSlide(index)` so the right clip is the visible one.

- [ ] **Step 3: Carousel presentation**

```css
#wall.mode-carousel { position: fixed; inset: 0; z-index: 0; overflow: hidden; }
#wall.mode-carousel .tile {
  position: fixed; inset: 0; grid-column: auto;
  opacity: 0; pointer-events: none;
  transition: opacity var(--fade) var(--ease);
}
#wall.mode-carousel .tile.is-active { opacity: 1; pointer-events: auto; }
#wall.mode-carousel .tile-media { position: absolute; inset: 0; aspect-ratio: auto; }
#wall.mode-carousel .tile-caption { display: none; }
.mode-mosaic #scrim, .mode-mosaic #prev, .mode-mosaic #next { display: none; }
#scrim { z-index: 1; }
```

`showSlide(i)` sets `index` to `normalise(i)`, toggles `.is-active` on `tiles` (and the
`tabindex`/`aria-hidden` bookkeeping from Step 2), and calls `.play()` on the active video. The
other nine stay paused. Keep the existing crossfade: it now lives on the tile's opacity, so
nothing needs to wait for `loadeddata` after the first paint.

- [ ] **Step 4: Re-point the text panel at an explicit index**

Turn `openModal()` into `openText(i)` — it reads `TEXTS[i]` instead of `TEXTS[index]`, and opens
for any valid `i`, so the same call serves the carousel and a zoomed tile. Turn `closeModal()`
into `closeText()`, whose focus return is settled in Task 6 (leave it pointing at `nextBtn` for
now), and which resumes the active clip it had paused, if any. Keep `renderBody()` verbatim.

- [ ] **Step 5: Click behaviour per mode**

`#wall` gets one delegated listener: in carousel mode it calls `openText(index)`; in mosaic mode,
if the click target is inside a `.tile`, it calls `openZoom(i)` (Task 5) and otherwise does nothing.
`#prev`/`#next` keep their `stopPropagation` and call `showSlide(index ∓ 1)`; they are inert in
mosaic mode because they are `display: none`.

- [ ] **Step 6: Verify**

Reload: mosaic, toggle reads « Carrousel ». Click it: the URL gains `#carrousel`, one clip fills
the screen, arrows appear, no black frame (`document.querySelectorAll('.tile.is-active').length === 1`
and nine videos paused). Press the browser back button: mosaic returns, all ten play again.
Paste `#nimportequoi` in the URL bar: mosaic. Tab through the carousel: the mode link, the two
arrows and the active tile only. Click the active tile in carousel mode: the glass panel opens on
that piece's title and text.

---

### Task 5: Full screen on click

**Files:**
- Modify: `script.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: `tiles`, `videos`, `zoomUi`, `zoomBack`, `zoomText`, `mode`, `openText(i)`.
- Produces: `var zoomed = -1`, `function openZoom(i)`, `function closeZoom()`.

- [ ] **Step 1: Open and close**

`openZoom(i)`: if `mode !== 'mosaic'` return; `zoomed = i`; `tiles[i].classList.add('is-open')`;
remove `hidden` from `zoomUi`; `zoomBack.focus()`. `closeZoom()`: if `zoomed < 0` return;
remove `.is-open` from `tiles[zoomed]`; `tiles[zoomed].focus()` afterwards; hide `zoomUi`;
`zoomed = -1`. The `<video>` element is never touched — same element, same `currentTime`.

- [ ] **Step 2: Style the promoted tile**

```css
.tile.is-open { position: fixed; inset: 0; z-index: 40; margin: 0; grid-column: auto; opacity: 1; }
.tile.is-open .tile-media { position: absolute; inset: 0; aspect-ratio: auto; }
.tile.is-open .tile-caption {
  position: absolute; left: 0; right: 0; bottom: 0; padding: clamp(70px, 12vw, 140px) clamp(20px, 4vw, 56px) clamp(24px, 4vw, 40px);
  background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0));
}
#zoom-ui {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  display: flex; align-items: center; gap: 12px;
  padding: clamp(14px, 2vw, 24px) clamp(16px, 2vw, 30px);
}
#zoom-ui[hidden] { display: none; }
#zoom-back, #zoom-text { /* same disc / pill treatment as the existing arrows and mode toggle */ }
.mode-mosaic:has(.tile.is-open) #mode-toggle { display: none; }
```

`#mode-toggle` is hidden while a tile is open because `#zoom-back` takes its corner.

- [ ] **Step 3: Verify**

Click tile 3: it grows to fill the screen, keeps playing from where it was, its caption overlays
the bottom, a round retour button sits top-left. Click retour: back in the grid, same position in
the clip. Click a tile, then press the browser back button: nothing breaks (the zoom stays open;
the hash only drives the presentation). `Escape` does not close the zoom yet — that lands in
Task 6.

---

### Task 6: Layering, the text panel, and the keyboard

**Files:**
- Modify: `script.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: everything from Tasks 2–5, plus the existing `renderBody()`, `#modal`, `#modal-panel`.
- Produces: final behaviour. No new exported names.

- [ ] **Step 1: Raise the panel above the zoom**

`#modal { z-index: 60 }` (it is 10 today). `#zoom-ui` stays 50, `.tile.is-open` 40. Keep the
existing panel internals exactly as they are.

- [ ] **Step 2: Wire the zoom's text button**

`zoomText` calls `openText(zoomed)`. `openText(i)` was already re-pointed at an explicit index in
Task 4; what is left here is the focus return: `closeText()` returns focus to `zoomText` when a
zoom is open, and to the active tile otherwise.

- [ ] **Step 3: Keyboard**

One `keydown` listener: `Escape` closes the topmost layer — `closeText()` if the panel is open,
else `closeZoom()` if a zoom is open, else nothing. `ArrowLeft`/`ArrowRight` call
`showSlide(index ∓ 1)` **only** when `mode === 'carousel'` and no panel is open. Drop the old
`Enter`/`Space` branch on `document.body` (tiles are buttons now).

- [ ] **Step 4: Verify — the full pass**

From `file:///Users/hugo/Project/julieSite/index.html`, check in order: ten tiles playing and
looping; captions correct and aligned; last row centered; tile 4 opens full screen and stays
silent; « Lire le texte » opens the glass panel **over** the zoomed clip; `Escape` closes the panel
first, then the zoom (never the reverse); toggle to carousel, arrows move slides and wrap around;
the back button returns to the mosaic with all ten playing; an unknown hash lands on the mosaic.
Read the console: expected, no errors and no warnings about autoplay.

Three failure inputs to try on purpose, because no task's tests reach them:

- Rename `video/video3.mp4` to `video/video3.old.mp4` and reload: the other nine tiles play, tile 3
  stays dark under a readable caption, the console may log a media error but the page never
  blanks and nothing throws. Rename it back.
- Open a tile, press « Lire le texte », then press the browser back button (or edit the hash by
  hand): the presentation and the panel must not disagree — no glass panel left floating over a
  grid after the zoom is gone. Whichever way you fix it, close both layers.
- Hold a finger on the arrow keys while the wall is displayed: nothing moves and nothing scrolls
  unexpectedly — the arrows are carousel-only.
