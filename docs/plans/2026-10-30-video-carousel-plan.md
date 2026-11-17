# Fullscreen Video Carousel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dependency-free single-page site: fullscreen looping video background, two arrows move between four slides, clicking the background opens a modal with that slide's text.

**Architecture:** Four stacked `<video>` elements exist from load but carry no `src` until their slide is first visited. A slide change assigns `src`, `load()`, `play()`, and crossfades `opacity` over 600 ms. Text lives in `data.js` as `const TEXTS`, so everything runs from `file://`.

**Tech Stack:** Vanilla HTML / CSS / JS (no build, no deps).

**Spec:** `docs/2026-10-30-video-carousel-design.md`

## Global Constraints

- Vanilla only: no framework, no bundler, no npm dependency, no CDN.
- Must work from `file://` — no `fetch()`, no `import`, no ES modules.
- Every `<video>` is `muted playsinline loop preload="none"`; `muted` is required for autoplay.
- No slide overlay text (no title, no author, no counter) — arrows only.
- Inline text is written with `textContent`, never `innerHTML`.
- `<html lang="fr">`. All user-facing strings and `aria-label`s in French.
- Slide *N* pairs `video/videoN.mp4` with `TEXTS[N-1]`. `text.json` is the source of truth for content and is copied byte-for-byte.

## Review Focus

- A video file missing or unplayable: the page must still show the arrows and open the modal, not throw.
- `content` containing `-` list lines (item 1) must render as a list, not as a run-on paragraph.
- Revisiting a slide must not blank the video (no `src` reassignment if the slide is active, and `play()` rejection must be caught).
- Opening the modal must pause the video and closing must resume it, including after navigating slides.
- Double-clicking an arrow fast (or holding `ArrowRight`) must not leave two videos playing.

---

### Task 1: `data.js`

**Files:**
- Create: `data.js` (generated from `text.json`)

**Interfaces:**
- Produces: global `const TEXTS` — `Array<{ title: string, author: string, content: string }>`, length 4.

- [ ] **Step 1: Generate `data.js` from `text.json` byte-for-byte**

```bash
node -e "const t=require('fs').readFileSync('text.json','utf8');require('fs').writeFileSync('data.js','// Generated from text.json — edit text.json, then regenerate.\nconst TEXTS = '+t.trim()+';\n')"
```

- [ ] **Step 2: Verify**

Run: `node -e "eval(require('fs').readFileSync('data.js','utf8'));console.log(TEXTS.length,TEXTS[0].author,TEXTS[3].title)"`
Expected: `4 EMMANUELLE DECHELETTE DITES-LE AVEC DES FLEURE`

### Task 2: `index.html` + `style.css`

**Files:**
- Create: `index.html`, `style.css`

**Interfaces:**
- Produces DOM contract used by Task 3: `#stage` (holds videos), `#prev`, `#next`, `#modal` (`.is-open` class toggles visibility), `#modal-title`, `#modal-author`, `#modal-body`, `#modal-close`, `#modal-panel`.

- [ ] **Step 1: Write `index.html`** — `<header>`-less document: `#stage` containing four `<video class="clip" muted playsinline loop preload="none">` (no `src`), then `<button id="prev" aria-label="Séquence précédente">`, `<button id="next" aria-label="Séquence suivante">`, then `<div id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">` wrapping `#modal-panel` with `#modal-title` (h2), `#modal-author` (p), `#modal-body` (div), `#modal-close` (`aria-label="Fermer"`). Scripts at end of body: `data.js` then `script.js`.

- [ ] **Step 2: Write `style.css`** — `.clip { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 600ms ease; }`, `.clip.is-active { opacity: 1; }`. `.clip` sits at `z-index: 0`; scrim overlay `linear-gradient` for legibility at `z-index: 1`; arrows at `z-index: 2`; modal at `z-index: 10`, `display: none` → `#modal.is-open { display: flex; }`. Panel `max-width: 720px; max-height: 85vh; overflow-y: auto`. Use `100dvh` on `#stage`. Under `640px`: arrows shrink; panel becomes a near-full-height sheet.

- [ ] **Step 3: Verify in browser**

Run: open `index.html` (double-click or `open index.html`).
Expected: black page with two visible arrows and no console errors; `TEXTS` defined.

### Task 3: `script.js`

**Files:**
- Create: `script.js`

**Interfaces:**
- Consumes: `TEXTS` (Task 1), DOM ids (Task 2).

- [ ] **Step 1: Implement state and slide change**

`const SOURCES = ['video/video1.mp4', 'video/video2.mp4', 'video/video3.mp4', 'video/video4.mp4'];`
`let index = 0; let modalOpen = false;`

`function show(i)` — normalise `i` with `((i % 4) + 4) % 4`; if `i === index` and that clip already has a src, return early; else set `index`, and for each clip: if `n === index` assign `src` if `!clip.src`, `clip.classList.add('is-active')`, and `if (!modalOpen) clip.play().catch(() => {})`; else `clip.classList.remove('is-active')` and `setTimeout(() => { if (!clip.classList.contains('is-active')) clip.pause(); }, 620)` so the fade-out completes before pausing.

- [ ] **Step 2: Wire arrows, keyboard, and modal**

`prev.onclick` / `next.onclick` → `show(index - 1)` / `show(index + 1)`, both `stopPropagation`. `keydown`: `ArrowLeft`/`ArrowRight` → arrows, `Escape` → `closeModal()`.

`openModal()`: `modalOpen = true`, fill `#modal-title` / `#modal-author` via `textContent`, render `#modal-body` from `TEXTS[index].content`, pause the active clip, add `.is-open`, focus `#modal-close`.
`closeModal()`: `modalOpen = false`, remove `.is-open`, `clips[index].play().catch(() => {})`, focus `#next`.

- [ ] **Step 3: Implement `renderBody(content)`**

Split on `/\n\s*\n/`. For each block, split into lines; split `lines` into leading `-` lines and the rest. Set `p.textContent = rest.join(' ')` with `white-space: pre-line` when rest exists, and for `-` lines build `ul > li` via `textContent`. Append in order.

- [ ] **Step 4: Wire background click**

`stage` (and the scrim) `onclick` → `openModal()`; arrows and modal already `stopPropagation`.

- [ ] **Step 5: Verify**

Run: open `index.html`. Check: video plays muted on load; arrows crossfade; `ArrowRight` wraps 4 → 1; click background opens modal with correct title/author/body and bullets; `Escape` and backdrop close it and the video resumes; no console errors.

### Task 4: Cross-check content mapping

- [ ] **Step 1:** For each slide 1–4, open the modal and confirm its title equals `TEXTS[n-1].title` and its video is `videoN.mp4`. Expected: all four match.
