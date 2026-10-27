import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The iOS and Android shells around the same web build (guidance_v2 Step 6.1, docs/guides/MOBILE_SETUP.md).
 * `npm run mobile:sync` builds the web app into `dist/` and copies it into both projects.
 */
const config: CapacitorConfig = {
  appId: 'com.mirecodes.sift',
  appName: 'Sift',
  webDir: 'dist',
  backgroundColor: '#080808',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 600, launchAutoHide: true, backgroundColor: '#080808', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#080808', overlaysWebView: true },
    // No banner while the app is open: the in-app chime plays instead.
    LocalNotifications: { smallIcon: 'ic_stat_sift', iconColor: '#080808', presentationOptions: [] },
    FirebaseMessaging: { presentationOptions: [] },
    CapacitorSQLite: { iosDatabaseLocation: 'Library/CapacitorDatabase', androidIsEncryption: false },
  },
};

export default config;
