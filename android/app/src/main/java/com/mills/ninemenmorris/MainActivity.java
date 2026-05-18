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
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import java.util.Arrays;

public class MainActivity extends BridgeActivity {

    private static final String TEST_BANNER_ID       = "ca-app-pub-3940256099942544/6300978111";
    private static final String TEST_INTERSTITIAL_ID = "ca-app-pub-3940256099942544/1033173712";
    private static final String TEST_REWARDED_ID     = "ca-app-pub-3940256099942544/5224354917";
    private static final String TEST_DEVICE_ID       = "8A68A10FE669909D6CF3103FDD4A7204";

    private InterstitialAd mInterstitialAd;
    private RewardedAd     mRewardedAd;

    // Play Games profile (populated after sign-in)
    private String pgPlayerId   = null;
    private String pgPlayerName = null;
    private boolean pgSignedIn  = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
        initPlayGames();
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

    // ── Google Play Games sign-in ──────────────────────────
    private void initPlayGames() {
        try {
            PlayGamesSdk.initialize(this);
            PlayGames.getGamesSignInClient(this)
                .isAuthenticated()
                .addOnCompleteListener(task -> {
                    boolean authenticated = task.isSuccessful() && task.getResult().isAuthenticated();
                    if (authenticated) {
                        fetchPlayGamesProfile();
                    } else {
                        // Silently attempt sign-in
                        PlayGames.getGamesSignInClient(this).signIn()
                            .addOnCompleteListener(t -> {
                                if (t.isSuccessful() && t.getResult().isAuthenticated()) {
                                    fetchPlayGamesProfile();
                                }
                            });
                    }
                });
        } catch (Exception e) {
            // Play Games not available on this device — silently ignore
        }
    }

    private void fetchPlayGamesProfile() {
        try {
            PlayGames.getPlayersClient(this).getCurrentPlayer()
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful() && task.getResult() != null) {
                        com.google.android.gms.games.Player player = task.getResult();
                        pgPlayerId   = player.getPlayerId();
                        pgPlayerName = player.getDisplayName();
                        pgSignedIn   = true;
                        // Notify JS that sign-in is ready
                        notifyJsPlayGamesReady();
                    }
                });
        } catch (Exception e) {
            // Ignore
        }
    }

    private void notifyJsPlayGamesReady() {
        runOnUiThread(() ->
            getBridge().getWebView().evaluateJavascript(
                "window.onPlayGamesReady && window.onPlayGamesReady("
                + "'" + pgPlayerId.replace("'","") + "',"
                + "'" + pgPlayerName.replace("'","\\u0027") + "')", null)
        );
    }

    // ── AdMob ──────────────────────────────────────────────
    private void initAdMob() {
        MobileAds.setRequestConfiguration(new RequestConfiguration.Builder()
            .setTestDeviceIds(Arrays.asList(TEST_DEVICE_ID))
            .build());

        getBridge().getWebView().addJavascriptInterface(new AdsJsBridge(), "MillsAds");

        MobileAds.initialize(this, initializationStatus -> runOnUiThread(() -> {
            setupBanner();
            loadInterstitial();
            loadRewarded();
        }));
    }

    // ── Banner ─────────────────────────────────────────────
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
                            loadInterstitial();
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
            if (mInterstitialAd != null) mInterstitialAd.show(this);
        });
    }

    // ── Rewarded ───────────────────────────────────────────
    private void loadRewarded() {
        RewardedAd.load(this, TEST_REWARDED_ID,
            new AdRequest.Builder().build(),
            new RewardedAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull RewardedAd ad) {
                    mRewardedAd = ad;
                    ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override
                        public void onAdDismissedFullScreenContent() {
                            mRewardedAd = null;
                            loadRewarded();
                        }
                    });
                }
                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError err) {
                    mRewardedAd = null;
                }
            });
    }

    private void showRewardedInternal() {
        runOnUiThread(() -> {
            if (mRewardedAd != null) {
                mRewardedAd.show(this, rewardItem ->
                    getBridge().getWebView().post(() ->
                        getBridge().getWebView().evaluateJavascript(
                            "window.onHintRewardEarned && window.onHintRewardEarned()", null))
                );
            } else {
                getBridge().getWebView().post(() ->
                    getBridge().getWebView().evaluateJavascript(
                        "window.onHintRewardEarned && window.onHintRewardEarned()", null)
                );
            }
        });
    }

    // ── JS ↔ Java bridge ──────────────────────────────────
    private class AdsJsBridge {
        @JavascriptInterface
        public void showInterstitial() { showInterstitialInternal(); }

        @JavascriptInterface
        public void showRewarded() { showRewardedInternal(); }

        @JavascriptInterface
        public boolean isRewardedReady() { return mRewardedAd != null; }

        // Play Games getters (called from online.js)
        @JavascriptInterface
        public boolean isPlayGamesSignedIn() { return pgSignedIn; }

        @JavascriptInterface
        public String getPlayGamesId() { return pgPlayerId != null ? pgPlayerId : ""; }

        @JavascriptInterface
        public String getPlayGamesName() { return pgPlayerName != null ? pgPlayerName : ""; }
    }
}
