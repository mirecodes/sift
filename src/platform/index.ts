import { createWebStorage } from './storage/web';
import { createWebWakeLock } from './wakelock/web';
import { createWebFullscreen } from './fullscreen/web';
import { createWebNotify } from './notify/web';
import { createWebHaptics } from './haptics/web';
import { createWebFiles } from './files/web';
import { createWebSecureStorage } from './secureStorage/web';
import { createWebLifecycle } from './lifecycle/web';

/** Web implementations. A native entry point swaps these for Capacitor ones (ADR-002). */
export const platform = {
  storage: createWebStorage(),
  wakeLock: createWebWakeLock(),
  fullscreen: createWebFullscreen(),
  notify: createWebNotify(),
  haptics: createWebHaptics(),
  files: createWebFiles(),
  secure: createWebSecureStorage(),
  lifecycle: createWebLifecycle(),
  /** Which build this is, for the API client header (Step 5.2). Native entry points set ios/android. */
  name: 'web' as 'web' | 'ios' | 'android',
};

export type { StorageAdapter } from './storage';
export type { WakeLockAdapter } from './wakelock';
export type { FullscreenAdapter } from './fullscreen';
export type { NotifyAdapter, Sound } from './notify';
export type { HapticsAdapter } from './haptics';
export type { FilesAdapter } from './files';
