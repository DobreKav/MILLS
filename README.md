# Mills — Nine Men's Morris 🎮

A **premium full-HD browser game** of Mills (Nine Men's Morris / Мелница), playable in the browser and as a native Android app via Apache Capacitor.

[![Play Store](https://img.shields.io/badge/Google_Play-Internal_Testing-green?logo=google-play)](https://play.google.com/store/apps/details?id=com.mills.ninemenmorris)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)]()
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Browser-lightgrey)]()

---

## 📱 Download & Test

> **Internal Testers** — accept invite then install via Google Play:  
> https://play.google.com/store/apps/details?id=com.mills.ninemenmorris

---

## ✨ Features

| Feature | Status |
|---|---|
| 🆚 Play vs AI (minimax + alpha-beta) | ✅ |
| 👥 Local two-player (same device) | ✅ |
| 🌐 **Online multiplayer** (auto-matchmaking) | ✅ v1.0 |
| 💡 Hint system (rewarded ad) | ✅ |
| 📺 AdMob ads (banner + interstitial + rewarded) | ✅ |
| 🏆 Google Play Games sign-in | ✅ |
| 🎨 Premium wood/stone board with animations | ✅ |
| 📱 Full-HD, responsive (720p–4K) | ✅ |

---

## 🌐 Online Multiplayer

Online multiplayer uses **Firebase Realtime Database** for automatic matchmaking — no room codes needed. Players are matched the moment two are online simultaneously.

- Authentication: Firebase Anonymous Auth + Google Play Games identity
- Realtime sync: Firebase Realtime Database (europe-west1)
- Players are identified by their **Google Play Games gamer name**

---

## 🎮 Game Rules (Nine Men's Morris)

- 2 players, each starts with **9 pieces**
- **Phase 1 – Placement**: alternate placing pieces on 24 intersections
- **Phase 2 – Movement**: slide pieces to adjacent positions  
- **Phase 3 – Flying**: when a player has only 3 pieces, they may move anywhere
- **Mill** = 3 in a row → remove one opponent piece
- **Win**: reduce opponent to 2 pieces, or block all their moves

---

## 🏗️ Architecture

```
mills/
├── index.html          # Entry point
├── css/style.css       # All styles + CSS custom properties
├── js/
│   ├── main.js         # Boot, resize, game loop
│   ├── game.js         # Core game logic (state machine)
│   ├── ai.js           # AI — minimax + alpha-beta pruning
│   ├── renderer.js     # Canvas rendering + particle effects
│   ├── ui.js           # Menus, HUD, transitions
│   └── online.js       # Firebase multiplayer + matchmaking
├── assets/             # Images, fonts, sound effects
├── android/            # Capacitor Android project
└── scripts/build.js    # Build script (copies to www/)
```

**Stack:** Vanilla HTML5 + CSS + JavaScript — no frameworks. Canvas rendering for the board, DOM for UI overlays.

---

## 🚀 Build & Run

### Browser
```bash
npx serve .
# or open index.html directly
```

### Android (debug)
```bash
npm run build
npx cap sync android
cd android
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
.\gradlew.bat assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Android (release — Play Store)
```bash
npm run build
npx cap sync android
cd android
.\gradlew.bat bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

> **Note:** Requires `android/keystore.properties` with your signing credentials (not committed — see `.gitignore`).

---

## 🔧 Firebase Setup (for online multiplayer)

1. Create a Firebase project at https://console.firebase.google.com
2. Add a **Web app** → copy the config
3. Enable **Realtime Database** (europe-west1) → Test mode
4. Enable **Authentication → Anonymous**
5. Replace `FIREBASE_CONFIG` values in `js/online.js`

---

## 📋 Changelog

### v1.0.0 — May 2026
- 🌐 **Online multiplayer** with automatic matchmaking via Firebase
- 🏆 Google Play Games sign-in integration
- 💡 Hint button with rewarded AdMob ad
- 📺 AdMob: banner + interstitial (every 3rd game) + rewarded
- 🎨 Premium board design with particle effects on mill formation
- 📱 Capacitor Android app — target SDK 34, min SDK 24

---

## 📄 Privacy Policy

https://dobrekav.github.io/MILLS/privacy_policy.html

---

## 📦 Package

- **App ID:** `com.mills.ninemenmorris`
- **Version:** 1.0.0 (versionCode 1)
- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 34 (Android 14)
