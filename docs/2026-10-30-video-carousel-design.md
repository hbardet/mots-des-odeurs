# Fullscreen video carousel — design

## Intent

A single-page site presenting four editorial texts ("Ô, odeurs…" style pieces on smell and
perfume). Each piece is paired with a short video clip. The clip fills the whole screen as
an atmospheric background; the two arrows move between pieces; clicking the background opens
the piece itself.

Why it works this way: the video carries the mood, the text carries the content. Keeping the
slide purely visual makes the click into the modal feel like opening something, rather than
reading a card that was already on screen.

## Goals

- Four slides, fullscreen looping video background.
- Two arrow buttons move between slides, wrapping around (1 → 4 → 1).
- Clicking the background opens a modal with the current slide's `title`, `author`, `content`.
- Smooth, flash-free transitions between slides.
- Runs by double-clicking `index.html`. No server, no build step, no dependencies.

## Non-goals

- No slide titles, author names, or `1 / 4` counter over the video (deliberate: user chose
  purely visual).
- No autoplay timer, no swipe gestures, no thumbnails, no deep links, no routing.
- No CMS, no admin, no dynamic loading of the text.

## Anti-goals

- A page that downloads all ~79 MB of video before showing anything.
- A transition that flashes black between slides.
- Text that is unreadable or unreachable on a phone.

## Constraints

- Vanilla HTML/CSS/JS only. No frameworks, no bundler, no npm.
- Must work from `file://` — so no `fetch()` of `text.json`. The data is emitted as
  `data.js` (`const TEXTS = [...]`) and loaded with `<script src="data.js">`.
- Assets already present: `video/video1..4.mp4` and `.gif`, `text.json` (4 objects).
  The mp4s are used; the gifs are not (7–44 MB each, no progressive playback).
- Autoplay requires `muted` on every video element.

## Approaches considered

**A. One `<video>`, swap `src` per slide.** ~40 lines. Rejected: swapping `src` blanks the
element, producing a black flash between slides, and revisiting a slide re-requests the file.

**B. Four stacked `<video>` elements, lazy `src`, opacity crossfade. ← chosen**
All four elements exist in the DOM from the start with no `src` at all. Changing slide assigns
the src, and the crossfade only starts once the incoming clip has actually decoded a frame
(`readyState >= 2`, else wait for `loadeddata`/`canplay`) — the outgoing clip keeps playing
meanwhile, so you never fade out into black. Opacity animates over 600 ms.
The download cost is identical to A: a clip is only fetched the first time its slide is
visited, because an element with no `src` fetches nothing. Cost: once all four are visited the
browser holds four decoded videos in memory (~400 MB worst case on mobile), which is
acceptable for four short clips.

> Note: `preload` is `auto`, not `none`. With `preload="none"` the browser refused to fetch
even after an explicit `load()`, leaving the incoming clip at `readyState 0` forever. Laziness
comes from the absent `src`, not from the preload hint.

**C. Two-element buffer (current + preloading neighbour).** Smoothest and cheapest in memory,
but noticeably more state for a 4-slide carousel. Rejected as overkill.

## Decisions

Files: `index.html`, `style.css`, `script.js`, `data.js`. Slide *N* pairs `video/videoN.mp4`
with `TEXTS[N-1]`.

- **Crossfade**, not slide: the incoming video fades in over the outgoing one (600 ms
  `opacity` transition). The outgoing video is paused once faded out so it stops decoding.
- **Wrap-around** navigation, so neither arrow is ever a dead end.
- **Keyboard**: `ArrowLeft` / `ArrowRight` change slide, `Escape` closes the modal.
- **Arrows** sit above the video and `stopPropagation`, so clicking an arrow never opens the
  modal. Always visible, subtle hover/focus state, `aria-label` in French.
- **Modal**: a frosted-glass panel so the clip stays visible behind the text — centered,
  `max-width: 720px`, `max-height: 85vh`, `overflow-y: auto` (item 1 is ~4,000 words).
  Glass = `rgba(251,248,244,0.5)` + `backdrop-filter: blur(44px) saturate(165%)` + a 1px
  white hairline and an inset top highlight. 0.5 alpha keeps the clip clearly visible; it is
  the tunable knob if readability ever wins over effect. The scrim behind it stays light
  (`rgba(8,7,6,0.3)` + 3px blur) so the video reads through it. Serif body text, uppercase
  letter-spaced title, author in small caps. Close button, backdrop click, and `Escape`
  all close it.
- **The clip keeps playing while the modal is open.** The motion behind the glass is what
  makes the panel read as glass rather than as a flat sheet — pausing it was tried and
  removed. Cost: the backdrop blur repaints every frame, so the panel is heavier on battery
  than a static sheet.
- **Text rendering**: `content` is split on blank lines into paragraphs; consecutive lines
  beginning with `-` become a `<ul>`. This matters for item 1, which contains a bulleted
  list. Inline text is set via `textContent`, never `innerHTML`, so the French accents and
  apostrophes are never at risk of being parsed as markup.
- **Layout**: `object-fit: cover`, video fixed at `inset: 0`, `100dvh` for mobile browser
  chrome. Arrows are 56 px discs with a dark scrim, a 55 % white hairline and a white glyph
  (they invert to solid cream on hover) so they stay legible over both the near-black and the
  vivid clips. Below 640 px they shrink to 46 px and the modal becomes a full-height sheet
  whose close button is `position: sticky` so it stays reachable while a long text scrolls.
- `lang="fr"` on `<html>`.

## Left to the builder

Exact type scale, colour of the arrows/backdrop (assumed near-white on a dark scrim so the
controls stay legible over any clip), and the precise easing curve. None of these change
what gets built.
