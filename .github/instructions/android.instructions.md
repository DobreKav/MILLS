---
applyTo: "android/**,capacitor.config.*,cordova/**"
description: "Android build and AdMob guidelines for the Mills game — apply when working on the Android port, Capacitor/Cordova config, or in-app advertising."
---

# Android Guidelines — Mills Game

## Toolchain

| Tool | Version |
|---|---|
| Capacitor | 5.x (preferred) |
| Android Studio | Hedgehog or newer |
| Target SDK | 34 |
| Min SDK | 24 (Android 7.0) |
| Compile SDK | 34 |
| Gradle | 8.x |

## Project Init (Capacitor)

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Mills" "com.yourdomain.mills" --web-dir "."
npx cap add android
npx cap sync          # run after every HTML/JS/CSS change
npx cap open android  # opens Android Studio
```

`capacitor.config.json` must set:
```json
{
  "webDir": ".",
  "backgroundColor": "#0d0d0d",
  "android": {
    "allowMixedContent": false,
    "captureInput": true,
    "webContentsDebuggingEnabled": false
  }
}
```

## AdMob Banner

1. Add dependency in `android/app/build.gradle`:
   ```gradle
   implementation 'com.google.android.gms:play-services-ads:23.0.0'
   ```
2. Add App ID in `android/app/src/main/res/values/strings.xml`:
   ```xml
   <string name="admob_app_id">ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX</string>
   ```
3. In `AndroidManifest.xml`:
   ```xml
   <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
              android:value="@string/admob_app_id"/>
   ```
4. The HTML `#banner-ad` div (90 px tall, bottom-fixed) is the visual placeholder. The native AdMob banner overlays it. Use `@capacitor-community/admob` plugin to initialize and show it.
5. Test with test ad unit IDs during development — **never ship with test IDs**.

## Hardware Back Button

In `js/main.js`, listen for Capacitor's `backButton` event:
```js
import { App } from '@capacitor/app';
App.addListener('backButton', ({ canGoBack }) => {
  GameState.pause();  // pause, show pause modal
});
```

## Screen Orientation

Lock to landscape in `android/app/src/main/AndroidManifest.xml`:
```xml
android:screenOrientation="sensorLandscape"
```

## Performance Notes

- Enable hardware acceleration: `android:hardwareAccelerated="true"` on `<application>`.
- Use `requestAnimationFrame` in `js/main.js` — avoid `setInterval` for the game loop.
- Compress all textures as WebP with quality 85 before `cap sync`.
- Keep total asset bundle under 20 MB for fast installs.

## Release Checklist

- [ ] Replace all test AdMob IDs with production IDs.
- [ ] Set `webContentsDebuggingEnabled: false` in `capacitor.config.json`.
- [ ] Run `npx cap sync` after final asset changes.
- [ ] Sign APK/AAB with a release keystore (`keytool -genkey ...`).
- [ ] Test on a physical device at 1080p and 720p.
