# TV mosaic layout — design

## Intent

The site currently has one presentation: a fullscreen looping clip, two arrows, and a click
that opens the piece's text in a frosted-glass panel. The owner wants a second presentation —
a **video wall**, the way a bank of TV screens looks in an installation: ten tiles, all looping
at once, edge to edge, and a click that promotes one tile to full screen.

The mosaic is now what a visitor lands on. The carousel stays reachable, because it is the
strongest presentation of a single piece and it is already built and tuned.

Why a wall: a wall shows the *body of work* at a glance — all ten pieces at once — where the
carousel shows one mood at a time.
The two answer different questions: "what is this collection?" versus "let me sit inside one".

## Goals

- Mosaic is the default view: 10 tiles, all looping continuously, filling the whole viewport,
  arranged 4 / 4 / 2 with the two tiles of the last row centered, all tiles the same size.
- Each tile is the clip and nothing else: no caption on the wall.
- Clicking a tile promotes it to full screen and it keeps playing, with a back control.
- One control, top-left, to swap between the two presentations.
- The swap is instant: no clip reloads, the clip you are looking at never stops, playback
  positions are preserved.

## Non-goals

- No phone / narrow-window layout. Desktop only, by explicit instruction.
- No filtering, sorting, categories, or pagination on the wall.
- No new typography, no new colour system — the wall borrows the existing palette and type.
- No transcoding, no compression of the existing clips, no build step.

## Anti-goals

- A swap between presentations that goes through a black frame.
- A wall where the missing pieces are visible as holes or grey "coming soon" boxes — they are
  real tiles with real clips, marked only in the source.
- Ten tiles that play out of sync and stutter as the browser drops frames trying to decode
  them all.

## Constraints

- **Vanilla only.** No framework, no bundler, no dependency, no CDN.
- **Must run from `file://`.** No `fetch()`, no `import`, no ES modules, no `type="module"`.
  Data reaches the page as `const TEXTS = [...]` in `data.js`.
- **Autoplay needs `muted`** on every `<video>`. Confirmed by the owner: the clips carry no
  sound to preserve, so nothing is ever unmuted — no mute toggle, no audio handling at all.
- **Media pool**: `video/video1..4.mp4`, 1772 × 1180 (≈ 3:2), 12–20 s, 18–22 MB each.
  Only `video4.mp4` has an audio stream; it stays muted like the rest.
- **Media cost**: ten tiles playing at once ≈ 200 MB fetched and decoded at load. That is inherent
  to "toutes les tuiles tournent en continu" and is accepted — in mosaic mode the wall plays all
  ten, with no pause-based workaround. Browsers cap simultaneous hardware decoders and fall back
  to software decode; if the wall drops frames, that is the trade the owner chose, not a bug to
  route around.
- `text.json` (named in `data.js`'s header comment) is no longer in the repo: `data.js` is now
  the hand-edited source of truth. The header comment is updated to say so.
- `<html lang="fr">`; all user-facing strings and `aria-label`s in French.

## Approaches considered

**A. One page, one set of ten tiles, two CSS presentations, layout driven by the URL hash. ← chosen**
The ten tiles exist once in the DOM. Mosaic is a grid; carousel is the same tiles stacked
full-bleed with one `.is-active`. Swapping is a class change triggered by `hashchange`
(`#mosaique` / `#carrousel`). The toggle is a real `<a href>`, so the browser back button does
what a user expects, and because nothing is torn down, no clip stops and no playback position
is lost. Cost: the carousel's current "four stacked clips, lazy `src`, crossfade" machinery has
to be re-expressed on top of an always-loaded set — and since all ten clips must be loaded for
the wall anyway, the crossfade becomes flash-free by construction (the guard is only needed for
the very first paint).

**B. Two independent HTML pages, the toggle a plain link between them.** Simplest code to read,
and the two files stay independent. Rejected by the owner's own reasoning once the cost was
clear: leaving a page destroys its `<video>` elements, so entering the carousel re-decodes ten
clips from zero — a black frame while the first keyframe arrives, which is exactly the anti-goal
the current carousel was built to avoid.

**C. Two coexisting sections in one page** (the untouched carousel plus a separate mosaic, JS
starting and stopping one or the other). Rejected: fourteen `<video>` elements in memory, two
independent "which item is current" states to keep in sync, and reloads on every swap.

## Decisions

### Data (`data.js`)

Each entry gains two fields; nothing is renamed:

```js
{
  video: 'video/video1.mp4',   // path, explicit — index-to-filename mapping is gone
  title: '…',
  author: '…',
  summary: '…',                // NEW — one line, the caption under the tile
  content: '…'
}
```

- **Ten entries.** 1–4 are the existing pieces with a freshly written `summary` (one sentence,
  ~110 characters max — it is clamped to two lines in CSS). 5–10 are temporary: they duplicate
  clips 1–4 and copy their texts, so the wall is full and the layout is real.
- The `summary` lines are **drafts written by the builder** from each piece's `content`, taking
  the piece's own language where possible. They are editorial copy in the owner's voice and sit
  in `data.js` only — the owner rewrites any of them without touching code.
- **Temporary entries reuse real files, not shared paths.** `video/video5.mp4` … `video10.mp4`
  are byte-for-byte copies of `video1..4.mp4` (mapping 5←1, 6←2, 7←3, 8←4, 9←1, 10←2, ~120 MB
  of extra disk). The point is that the day the real clip exists, the owner overwrites
  `video/video5.mp4` and rewrites that entry's text — no path editing, no code touched.
- **Marked in the source only.** Each temporary entry carries a comment line
  `// PLACEHOLDER — remplacer le clip et le texte` above it. No runtime flag: it would have to be
  removed later, and the file comment is enough for a human.
- Tile count is `min(TEXTS.length, 10)`; the wall renders whatever `data.js` provides, so
  deleting a future extra entry degrades gracefully instead of throwing.
- The carousel walks **the same tile list**, all ten, with no special-casing of the temporary
  entries. Consequence today: the arrows revisit a piece two or three times, because those pieces
  really are duplicated in the data. That artefact disappears by itself when the six real clips
  and their texts land — so it is not worth a `real: true` flag that would then have to be removed.

### Wall layout

- `#wall`: CSS grid, `grid-template-columns: repeat(4, 1fr)`, `grid-template-rows: repeat(3, 1fr)`,
  `gap: 0`, `padding: 0`, `height: 100dvh`. The wall *is* the window: the clips reach every border.
  Tile 9 is placed `grid-column: 2`, tile 10 `grid-column: 3` — which centers the last row, and
  leaves the two corner cells of that row empty (black), by design.
- Tiles are identical in size; the media box has no ratio of its own in mosaic mode
  (`height: 100%; aspect-ratio: auto`), so the cell dictates the crop, `object-fit: cover`.
  Nothing scrolls, on any window shape.
- No caption on the wall: `.tile-caption` is `display: none` in mosaic mode, and only comes back
  over an *opened* tile (see Full screen). The title is still the tile's accessible name.
- Boot order: build the tiles, set every `src`, then call `play()` on all ten. Rejections are
  caught; a single `playAll()` is retried on the first user gesture anywhere in the document,
  for browsers that refuse autoplay until then.

### Carousel presentation (same DOM, different CSS)

- `#wall.mode-carousel` becomes `position: fixed; inset: 0`, tiles become absolutely positioned
  full-bleed, `object-fit: cover`, captions hidden, only `.is-active` at `opacity: 1`, 600 ms
  transition — the current look, unchanged.
- `#scrim` (the existing vignette) is shown in carousel mode only.
- `#prev` / `#next` are shown in carousel mode only; they already `stopPropagation`.
- Crossfade now needs no `loadeddata` wait, because every clip is already decoding; the existing
  `readyState >= 2` guard is kept only for the first paint after load.
- A click on the full-bleed clip does nothing: paging is the arrows' job.
- **Decode policy**: in carousel mode the nine non-active clips are paused, and all ten are
  resumed in one call when the wall comes back. Nothing visible ever stops in carousel mode (only
  one tile is on screen), it removes nine invisible decoders from the busiest moment, and it costs
  nothing: positions are kept, and a resumed clip paints its next frame immediately. Mosaic mode
  never pauses anything.
- **Tab order**: in carousel mode the inactive tiles get `tabindex="-1"`, `aria-hidden="true"` and
  `pointer-events: none`, so the tab stops stay the mode toggle, the two arrows and the active
  tile. In mosaic mode all ten tiles are tab stops. Both modes: the active/visible tiles are
  `<button>`s that respond to `Enter`/`Space`.

### Full screen (zoom)

- Clicking a tile **in mosaic mode** promotes that tile: `.is-open` makes it
  `position: fixed; inset: 0; z-index: 40`, its media box fills the screen and the caption
  becomes a bottom overlay on a dark gradient. The element is the *same* `<video>` — nothing is
  reloaded, `currentTime` is preserved, so the promotion looks like the tile grew.
- `#zoom-ui` is one global strip, hidden by default, containing a single **Retour** button. It
  replaces the mode toggle in the top-left corner while zoomed, and sits above the promoted tile
  (`#zoom-ui` `z-index: 50`).
- `Retour` (or `Escape`) removes `.is-open` and the tile drops back into the grid, still playing.
- **The long-form text panel is gone** (2026-11-17): no `#modal`, no *Lire le texte* button, no
  `renderBody()`. The `content` field stays in `data.js` — it is the text of the piece, not a
  UI concern — but nothing renders it today. The enlarged tile still shows its title and summary
  as a bottom band.

### Swapping presentations

- Three links in one capsule, top-left: `Plan` (`#plan`), `Mosaïque` (`#mosaique`), `Carrousel`
  (`#carrousel`). The one on screen is filled in and carries `aria-current="page"`; the other two
  sit flat and light up on hover.
- Mode is read from `location.hash` on load (empty or unknown → mosaic) and on `hashchange`.
- Switching closes any open zoom, and the capsule steps aside for the zoom's back control.
- The carousel keeps its own current index in memory across swaps (no reload, so it just stays).

### Keyboard

- `Escape`: closes the zoom and returns focus to the tile it came from.
- `ArrowLeft` / `ArrowRight`: change slide, carousel mode only.
- Tiles are real `<button>`s, so `Tab` + `Enter`/`Space` opens the zoom for free.

### Plan (third view)

- `plan.svg` is the designer's floor plan: a 5632.67 × 4921.24 drawing, white hairline strokes on
transparent, and ten pink marks (`class="cls-16 dot"`, `r="41.38"`, `#e7348b`). Each mark carries
`data-index`, the index of the piece it shows in `data.js`:

  | dot (cx, cy) | libellé | `data-index` | clip |
  |---|---|---|---|
  | 3251.1, 1331.81 | Pot de fleurs | 3 | `video/05-fleur.mp4` |
  | 3967.15, 318.67 | Pause cigarette | 2 | `video/06-fumee.mp4` |
  | 3458.56, 732.07 | Baie vitrée | 1 | `video/01-baie-vitree.mp4` |
  | 4117.17, 1954.34 | Machine à café | 4 | `video/03-cafe.mp4` |
  | 3987.06, 2480.64 | Ventilateur | 6 | `video/09-ventilateur.mp4` |
  | 1149.34, 1208.78 | Savon | 7 | `video/02-bulle.mp4` |
  | 3338.15, 2190.46 | Puit de lumière | 5 | `video/07-lumiere.mp4` |
  | 2085.23, 3075.57 | Ordinateur | 9 | `video/10-ordinateur.mp4` |
  | 807.06, 4343.41 | Flaque d'essence | 0 | `video/04-essence.mp4` |
  | 1229.7, 3327.91 | Poubelle | 8 | `video/08-poubelle.mp4` |

- Re-exporting the plan only costs re-adding those ten `data-index` attributes; nothing else in the
  drawing is touched. It is fetched at runtime (so the file stays the single source) and injected;
on `file://` the fetch fails and the drawing is shown flat, without its dots.
- The view is the drawing fitted whole (`preserveAspectRatio` default), centred on the wall's
  black ground; the plan is wider than tall, so a landscape window leaves black at the sides.
- Each mark is backed by a transparent `<circle class="dot-hit" r="260">` inserted at the end of
  the drawing together with its mark (several marks were drawn under a white piece of furniture
  and were swallowed). The `<circle>` is the control: `role="button"`, `tabindex="0"`, an
  `aria-label`, and a hover/focus state that scales the mark ×1.7 and glows it. The mark itself is
  `pointer-events: none`.
- A mark opens a card over the plan — the plan stays visible under a dimmed, slightly blurred
  ground — holding a 3:2 frame of the clip, its title and its description below, and a round
  close button. The card is a column so the frame gives way before the words on a short window.
  `Escape`, a press on the close button or a click beside the card closes it; the focus goes back
  to the mark it came from. The card's `<video>` is a single reused element whose `src` is dropped
  on close, so no decoder is left running.
- The wall's ten clips are paused while the plan is on screen.

### Kinds of view now

Three links, one per view, in a single capsule at the top left — `Plan`, `Mosaïque`, `Carrousel`.
The one on screen is filled in (`aria-current="page"`), so the capsule reads as a position rather
than as a switch. `location.hash` stays the single source of truth and the back button keeps
working. A view change closes whatever was layered above the view it leaves (the zoom belongs to
the wall, the card to the plan).

> The labels in `plan.svg` ask for **Feroniapi** (objects) and **Futura** (room names), neither of
> which ships with the site: they fall back to a system serif and grotesque. Same in any SVG
> viewer, so nothing is broken — but the drawing will only look like the designer's once the two
> fonts are added.

## Left to the builder

The hover treatment of a tile (a lift, a brightened hairline, or nothing), the easing curve, and
the gradient recipe behind the zoomed caption. None of these change what gets built.

## Revisions

- **2026-11-17** — the wall fills the viewport edge to edge (no `--pad`, no `--gap`, no `--tile-w`
  or `--caption-h` any more); tiles carry no caption; the text panel and the *Lire le texte*
  button are removed. Note the mobile trade-off: 4 columns × 3 rows at 390 px wide means clips
  98 px wide and 281 px tall, so the crop is severe on a phone (non-goal, desktop first, and no
  mobile variant is planned).
- **2026-11-17 (2)** — the content model changed: `data.js` holds one entry per clip with
  `video`, `title` and `summary` only (`author` and `content` are gone). The ten entries now
  describe the smell each clip shows (machine à café, savon, flaque d'essence, ventilateur,
  ordinateur, pause cigarettes, pot de fleurs, puits de lumière, poubelles, baie vitrée), in the
  tile order that the wall already used. The four long articles of the first version are archived
  in `docs/2026-11-15-textes-longs.md`. Since the description is the text of the piece, the
  zoom band no longer clamps it to three lines.
- **2026-11-17 (3)** — third view: the floor plan (`plan.svg`), faded in where the wall was, its
  ten pink marks opening a card with the clip. See *Plan (third view)* above for the dot table and
  the interaction.
- **2026-11-17 (4)** — the single cycling link became three links in one capsule (`Plan`,
  `Mosaïque`, `Carrousel`), the current view filled in. `10-ordinateur` was re-cut from a new
  1960 × 1080 capture of the ARCHISTORM screen (`scripts/encode-videos.sh` now reads
  `ordinateur.mp4`; the old `ordianteur.GIF` master is no longer used). Note the wall crops it:
  a cell is ~4:3 on a 16:9 screen, so the logo is cut at both ends in the mosaic and reads whole
  only once enlarged or in the plan's card.
