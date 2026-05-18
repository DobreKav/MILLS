package com.mills.ninemenmorris;

import android.os.Build;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import androidx.annotation.NonNull;
import androidx.coordinatorlayout.widget.CoordinatorLayout;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import java.util.Arrays;

public class MainActivity extends BridgeActivity {

    private static final String TEST_BANNER_ID       = "ca-app-pub-3940256099942544/6300978111";
    private static final String TEST_INTERSTITIAL_ID = "ca-app-pub-3940256099942544/1033173712";
    // Physical test device hash (from logcat "Use RequestConfiguration..." message)
    private static final String TEST_DEVICE_ID       = "8A68A10FE669909D6CF3103FDD4A7204";

    private InterstitialAd mInterstitialAd;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
        initAdMob();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController ctrl = getWindow().getInsetsController();
            if (ctrl != null) {
                ctrl.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                ctrl.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            //noinspection deprecation
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }
    }

    private void initAdMob() {
        // Register this device as a test device so test ads display on real hardware
        MobileAds.setRequestConfiguration(new RequestConfiguration.Builder()
            .setTestDeviceIds(Arrays.asList(TEST_DEVICE_ID))
            .build());

        // Expose JS bridge immediately — before async initialize completes
        getBridge().getWebView().addJavascriptInterface(new AdsJsBridge(), "MillsAds");

        MobileAds.initialize(this, initializationStatus -> runOnUiThread(() -> {
            setupBanner();
            loadInterstitial();
        }));
    }

    // ── Adaptive full-width banner ─────────────────────────
    private void setupBanner() {
        AdView adView = new AdView(this);
        adView.setAdSize(getAdaptiveBannerSize());
        adView.setAdUnitId(TEST_BANNER_ID);

        CoordinatorLayout.LayoutParams params = new CoordinatorLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        params.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;

        CoordinatorLayout root = (CoordinatorLayout) getBridge().getWebView().getParent();
        root.addView(adView, params);
        adView.loadAd(new AdRequest.Builder().build());
    }

    private AdSize getAdaptiveBannerSize() {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        int widthDp = Math.round(dm.widthPixels / dm.density);
        return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(this, widthDp);
    }

    // ── Interstitial ───────────────────────────────────────
    private void loadInterstitial() {
        InterstitialAd.load(this, TEST_INTERSTITIAL_ID,
            new AdRequest.Builder().build(),
            new InterstitialAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull InterstitialAd ad) {
                    mInterstitialAd = ad;
                    ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override
                        public void onAdDismissedFullScreenContent() {
                            mInterstitialAd = null;
                            loadInterstitial(); // pre-load next ad
                        }
                    });
                }
                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError err) {
                    mInterstitialAd = null;
                }
            });
    }

    private void showInterstitialInternal() {
        runOnUiThread(() -> {
            if (mInterstitialAd != null) {
                mInterstitialAd.show(this);
            }
        });
    }

    // ── JS ↔ Java bridge ──────────────────────────────────
    private class AdsJsBridge {
        @JavascriptInterface
        public void showInterstitial() {
            showInterstitialInternal();
        }
    }
}
