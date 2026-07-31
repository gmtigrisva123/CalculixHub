/// <reference types="node" />
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the CalculixHub iOS app.
 *
 * The native app is a WKWebView around the same React bundle the website
 * serves, so every screen, the IRT engine and the item bank are shared with the
 * web build rather than reimplemented.
 *
 * One consequence drives most of what follows: inside the WebView the page is
 * served from capacitor://localhost, not from your domain. Relative /api/*
 * requests would resolve against that scheme and fail, so the app has to call
 * the backend by absolute URL. See src/lib/apiBase.ts.
 */
const config: CapacitorConfig = {
  appId: 'com.calculixhub.app',
  appName: 'CalculixHub',

  // Vite's build output. `npx cap sync` copies this into the native project.
  webDir: 'dist',

  ios: {
    // Matches --color-paper-50, so the gap behind a rubber-band scroll is the
    // app's own background rather than white.
    backgroundColor: '#faf7f1',

    // The app owns the area behind the status bar; MobileHeader already pads
    // itself with env(safe-area-inset-top) to sit clear of the notch.
    contentInset: 'never',

    // Scroll bouncing is the platform norm and the pull-to-refresh affordance
    // depends on it.
    scrollEnabled: true,
  },

  server: {
    /**
     * https rather than the capacitor:// default.
     *
     * The app persists learner progress in localStorage. Storage is keyed by
     * origin, so changing the scheme later would orphan every existing user's
     * stats -- worth pinning deliberately rather than inheriting.
     */
    iosScheme: 'https',
  },

  plugins: {
    /**
     * Local notifications back the streak reminders in Settings.
     *
     * These are scheduled on-device. Remote push would need an Apple Developer
     * account and APNs credentials, which this project does not yet have.
     */
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#c8842a',
    },
  },
};

export default config;
