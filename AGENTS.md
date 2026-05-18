# Mills (Nine Men's Morris) — Agent Instructions

## Project Overview

A **full HD, premium-quality** browser game of Mills (Nine Men's Morris / Мелница) built in vanilla HTML5 + JavaScript, with an Android port via **Apache Cordova** or **Capacitor**.  
Target resolution: **1920×1080** (16:9), responsive down to 720p. No frameworks — pure HTML/CSS/JS.

## Architecture

```
mills/
├── index.html          # Entry point; references all assets
├── css/
│   └── style.css       # All visual styles; CSS custom properties for theming
├── js/
│   ├── main.js         # Boot, resize handler, game-loop entry
│   ├── game.js         # Core Mills game logic (state machine)
│   ├── ai.js           # AI opponent (minimax / alpha-beta)
│   ├── renderer.js     # Canvas or DOM rendering layer
│   └── ui.js           # Menus, modals, transitions, HUD
├── assets/
│   ├── img/            # Board textures, piece sprites, backgrounds (PNG/WebP)
│   ├── fonts/          # Premium typefaces (WOFF2)
│   └── sfx/            # Sound effects and ambient music (OGG/MP3)
├── android/            # Cordova/Capacitor Android project (generated)
└── .github/
    └── instructions/
        ├── ui.instructions.md
        └── android.instructions.md
```

## Game Rules (Mills / Nine Men's Morris)

- 2 players (or vs AI); each starts with 9 pieces.
- **Phase 1 – Placement**: alternate placing pieces on 24 intersections.
- **Phase 2 – Movement**: slide pieces to adjacent positions.
- **Phase 3 – Flying**: when a player has only 3 pieces, they may move anywhere.
- **Mill** = 3 pieces in a row → remove one opponent piece (not from a mill unless no other option).
- Win: opponent reduced to 2 pieces, or blocked (cannot move).

## Build & Run

```bash
# Serve locally (no build step required)
npx serve .           # or use VS Code Live Server extension

# Android (Cordova)
npm install -g cordova
cordova platform add android
cordova run android

# Android (Capacitor — preferred for new setup)
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync
npx cap open android   # opens Android Studio
```

## Conventions

- **No external JS libraries** (except optionally Howler.js for audio).
- **Canvas rendering** preferred for the game board; DOM for UI overlays.
- CSS custom properties (`--color-primary`, `--board-texture`, etc.) for all theming — never hard-code colors outside `:root`.
- All measurements in `vmin`/`vmax` or relative to a root `gameScale` variable so the layout scales cleanly from 720p to 4K.
- **Banner slot**: A fixed `<div id="banner-ad">` is reserved at the **bottom** of `index.html` with `height: 90px` (standard leaderboard). Never place game UI inside it. AdMob banner goes here on Android.
- Asset naming: `snake_case` for files, `PascalCase` for JS classes.
- `game.js` must remain UI-agnostic — it exposes a `GameState` object; `renderer.js` reads from it.

## Premium UI/UX Targets

See [.github/instructions/ui.instructions.md](.github/instructions/ui.instructions.md) for full UI/UX guidelines.

**Non-negotiables:**
- 60 fps smooth animations (CSS `will-change`, `requestAnimationFrame`).
- Particle effects on mill formation and piece capture.
- Ambient wood/stone textures with subtle depth (drop shadows, inner glows).
- All transitions ≥ 300 ms ease-in-out; no abrupt state changes.

## Android Guidelines

See [.github/instructions/android.instructions.md](.github/instructions/android.instructions.md).

Key points:
- Target SDK 34; min SDK 24 (Android 7).
- AdMob banner ID goes in `android/app/src/main/res/values/strings.xml`.
- Hardware back-button should pause the game, not exit.
