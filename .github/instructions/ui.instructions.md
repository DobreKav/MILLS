---
applyTo: "css/**,js/ui.js,js/renderer.js,index.html"
description: "Premium UI/UX guidelines for the Mills game — apply when editing visuals, animations, layouts, or the game board renderer."
---

# Premium UI/UX Guidelines — Mills Game

## Visual Identity

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#0d0d0d` | Page background |
| `--color-surface` | `#1a1208` | Board panel background |
| `--color-primary` | `#c8922a` | Gold accent (buttons, highlights) |
| `--color-primary-dark` | `#8b5e10` | Hover states |
| `--color-text` | `#f0e6d3` | Primary text |
| `--color-text-muted` | `#9b8c7a` | Secondary text |
| `--color-player1` | `#e8d5a3` | Light wood / cream pieces |
| `--color-player2` | `#2c1a0e` | Dark walnut pieces |
| `--color-mill-glow` | `#ffcc00` | Mill formation highlight |
| `--shadow-deep` | `0 8px 32px rgba(0,0,0,0.8)` | Cards, modals |

All tokens must live in `css/style.css` under `:root`. Never hard-code these values elsewhere.

## Layout — Full HD (1920×1080)

- Root element `#game-container`: `width: 100vw; height: 100vh; max-width: 1920px; max-height: 1080px; margin: auto;`
- Board canvas: square, `80vmin × 80vmin`, centered vertically, left of center.
- Right sidebar (HUD): `20vw` wide — player scores, turn indicator, phase label.
- **Bottom banner slot** `#banner-ad`: `position: fixed; bottom: 0; left: 0; right: 0; height: 90px; z-index: 100;` — reserved for AdMob / display ads. Game canvas must never overlap it; account for this `90px` offset in `main.js` resize logic.

## Board Aesthetics

- Use a **wood-grain texture** PNG for the board background (`assets/img/board_wood.png`), repeated with subtle brightness variation.
- Board lines: warm off-white (`#d4b896`), `2px` stroke, slight glow (`filter: drop-shadow(0 0 3px #c8922a55)`).
- Intersection dots: `6px` radius circle, same color as lines.
- **Piece style**: radial-gradient sphere illusion — light source top-left. Player 1 uses `#f5e6c8 → #c4a46b`, Player 2 uses `#4a2e14 → #1a0d04`. Add `box-shadow: inset -3px -3px 8px rgba(0,0,0,0.5), 3px 3px 8px rgba(0,0,0,0.7)`.
- Selected piece: pulsing gold ring `animation: selectedPulse 1s ease-in-out infinite`.
- Valid move hints: translucent green dot `rgba(80,200,80,0.4)` at each legal intersection.

## Animations & Transitions

- Piece placement: `transform: scale(0) → scale(1)` over `250ms cubic-bezier(0.34,1.56,0.64,1)` (spring pop).
- Piece move: CSS `transition: left 300ms ease, top 300ms ease` on absolute-positioned piece elements, or interpolated canvas draw per frame.
- Mill formation: 500 ms golden flash + particle burst (8–12 sparks radiating from line center).
- Piece removal: `transform: scale(1) → scale(0)` + `opacity: 1 → 0` over `350ms`, then dust-particle dissolve.
- Screen transitions (menu → game): full-screen crossfade `400ms`.
- All UI button hovers: `transform: translateY(-2px); box-shadow` change, `200ms ease`.

## Typography

- **Heading font**: `'Cinzel'` or `'Trajan Pro'` (serif, regal). Load via `@font-face` from `assets/fonts/`.
- **Body / HUD font**: `'Raleway'` or `'Montserrat'` — clean, modern, high legibility.
- Minimum font size: `14px` (scaled via `clamp()`).
- Never use system default sans-serif for visible game text.

## Sound Design Hooks

- `ui.js` must call `SoundManager.play('place')`, `SoundManager.play('move')`, `SoundManager.play('mill')`, `SoundManager.play('capture')`, `SoundManager.play('win')` at the appropriate game events.
- All sounds load lazily after first user gesture (autoplay policy).
- Master volume slider in settings panel stored in `localStorage`.

## Accessibility

- Focus-visible ring on all interactive elements.
- `aria-live` region for screen-reader game-state announcements.
- Minimum contrast ratio 4.5:1 for text against backgrounds.

## Anti-patterns

- No `alert()`, `confirm()`, or `prompt()` — use styled modal overlays.
- No `px` for board element sizes — always `vmin`/`vmax` or `%`.
- No inline `style=""` for colors or fonts — always use CSS classes / custom properties.
- Never block the main thread with synchronous asset loading.
