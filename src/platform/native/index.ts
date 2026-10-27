import { createWebFiles } from '../files/web';
import { createWebNotify } from '../notify/web';
import { createSqliteStorage } from '../storage/sqlite';
import type { Platform } from '../types';
import { openCapacitorSqlite } from './sqliteDriver';

type Plugins = typeof import('./plugins');
let loaded: Promise<Plugins> | null = null;
/** The plugin chunk, loaded on first use. */
const plugins = (): Promise<Plugins> => (loaded ??= import('./plugins'));

/** Fire and forget: a missing permission or an unconfigured service never breaks the app. */
const quietly = (work: () => Promise<unknown>): void => void work().catch(() => undefined);

/** Subscribes to a Capacitor event, returning a synchronous unsubscribe. */
function listen(add: (p: Plugins) => Promise<{ remove(): Promise<void> }>): () => void {
  const handle = plugins().then(add);
  handle.catch(() => undefined);
  return () => quietly(async () => (await handle).remove());
}

/** Local notification ids of the timer alerts (Step 6.3). */
const ALERT_ID = { focusEnd: 1, breakEnd: 2 } as const;
const ALERT_CHANNELS = [
  { id: 'timer', name: 'Timer', description: 'The end of a focus or break', importance: 4 as const, sound: 'default' },
  { id: 'timer_silent', name: 'Timer (silent)', description: 'The end of a focus or break, without sound', importance: 3 as const },
];

/** Capacitor implementations of every adapter (guidance_v2 Step 6.2; docs/guides/MOBILE_SETUP.md). */
export function createNativePlatform(name: 'ios' | 'android'): Platform {
  const web = createWebNotify();
  let channels: Promise<void> | null = null;
  let scheduling: Promise<void> = Promise.resolve();
  let live: Promise<void> = Promise.resolve();
  let launchRead = false;
  const webFiles = createWebFiles();

  return {
    name,
    // A SQLite file in the app's private storage: the OS never clears it like WebView storage.
    storage: createSqliteStorage(async () => openCapacitorSqlite(await plugins())),
    wakeLock: {
      request: async () => quietly(async () => (await plugins()).KeepAwake.keepAwake()),
      release: async () => quietly(async () => (await plugins()).KeepAwake.allowSleep()),
    },
    // Focus hides the status bar (iOS and Android); the web Fullscreen API does not exist in the WebView.
    fullscreen: {
      enter: async () => quietly(async () => (await plugins()).StatusBar.hide()),
      exit: async () => quietly(async () => (await plugins()).StatusBar.show()),
    },
    notify: {
      unlock: web.unlock,
      play: web.play,
      schedule(alerts) {
        // Serialized: a quick stop-and-start must not leave the older schedule behind.
        scheduling = scheduling.then(async () => {
          const { LocalNotifications } = await plugins();
          await LocalNotifications.cancel({ notifications: Object.values(ALERT_ID).map((id) => ({ id })) });
          if (!alerts.length) return;
          let { display } = await LocalNotifications.checkPermissions();
          // Asked at the first Focus start: the end alert is what the permission is for.
          if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await LocalNotifications.requestPermissions());
          if (display !== 'granted') return;
          if (name === 'android') await (channels ??= Promise.all(ALERT_CHANNELS.map((c) => LocalNotifications.createChannel(c))).then(() => undefined));
          await LocalNotifications.schedule({
            notifications: alerts.map((a) => ({
              id: ALERT_ID[a.kind],
              title: a.title,
              body: a.body,
              schedule: { at: new Date(a.at), allowWhileIdle: true },
              channelId: a.sound ? 'timer' : 'timer_silent',
              ...(a.sound && { sound: 'default' }),
            })),
          });
        }).catch(() => undefined);
      },
    },
    haptics: {
      impact: (strength) => quietly(async () => {
        const { Haptics, ImpactStyle } = await plugins();
        await Haptics.impact({ style: strength === 'light' ? ImpactStyle.Light : ImpactStyle.Medium });
      }),
    },
    files: {
      // Native: write to the cache folder, then hand the file to the share sheet (save to Files, AirDrop, mail).
      async save(fileName, text) {
        const { Filesystem, Directory, Encoding, Share } = await plugins();
        const { uri } = await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: fileName, files: [uri] }).catch(() => undefined); // cancelled
      },
      // The WebView's file input opens the system document picker on both platforms.
      open: webFiles.open,
    },
    // Keychain (iOS) / Android Keystore.
    secure: {
      get: async (key) => (await plugins()).SecureStorage.getItem(key),
      set: async (key, value) => (await plugins()).SecureStorage.setItem(key, value),
      remove: async (key) => (await plugins()).SecureStorage.removeItem(key),
    },
    lifecycle: {
      onResume(cb) {
        const off = listen((p) => p.App.addListener('resume', cb));
        window.addEventListener('online', cb);
        return () => {
          off();
          window.removeEventListener('online', cb);
        };
      },
    },
    push: {
      available: true,
      async register() {
        try {
          const { FirebaseMessaging } = await plugins();
          let { receive } = await FirebaseMessaging.checkPermissions();
          if (receive === 'prompt' || receive === 'prompt-with-rationale') ({ receive } = await FirebaseMessaging.requestPermissions());
          if (receive !== 'granted') return null;
          return (await FirebaseMessaging.getToken()).token || null;
        } catch {
          return null; // Firebase not configured yet (docs/guides/MOBILE_SETUP.md §Push)
        }
      },
      async token() {
        try {
          const { FirebaseMessaging } = await plugins();
          if ((await FirebaseMessaging.checkPermissions()).receive !== 'granted') return null;
          return (await FirebaseMessaging.getToken()).token || null;
        } catch {
          return null;
        }
      },
      onOpen(cb) {
        return listen((p) =>
          p.FirebaseMessaging.addListener('notificationActionPerformed', (e) => {
            const url = (e.notification.data as { url?: unknown } | undefined)?.url;
            if (typeof url === 'string' && url) cb(url);
          }),
        );
      },
    },
    links: {
      onOpen(cb) {
        if (!launchRead) {
          launchRead = true;
          quietly(async () => {
            const launch = await (await plugins()).App.getLaunchUrl();
            if (launch?.url) cb(launch.url);
          });
        }
        return listen((p) => p.App.addListener('appUrlOpen', (e) => cb(e.url)));
      },
    },
    liveProgress: {
      update(view) {
        // In order: a phase change right after another must leave the newer state showing.
        live = live
          .then(async () => {
            const { SiftLiveProgress } = await plugins();
            await (view ? SiftLiveProgress.update(view) : SiftLiveProgress.end());
          })
          .catch(() => undefined);
      },
    },
  };
}
