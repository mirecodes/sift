import { createWebStorage } from './storage/web';
import { createWebWakeLock } from './wakelock/web';
import { createWebFullscreen } from './fullscreen/web';
import { createWebNotify } from './notify/web';
import { createWebHaptics } from './haptics/web';
import { createWebFiles } from './files/web';
import { createWebSecureStorage } from './secureStorage/web';
import { createWebLifecycle } from './lifecycle/web';
import { createWebPush } from './push/web';
import { createWebLinks } from './links/web';
import { createNativePlatform } from './native';
import { nativePlatform } from './native/detect';
import type { Platform } from './types';

function createWebPlatform(): Platform {
  return {
    storage: createWebStorage(),
    wakeLock: createWebWakeLock(),
    fullscreen: createWebFullscreen(),
    notify: createWebNotify(),
    haptics: createWebHaptics(),
    files: createWebFiles(),
    secure: createWebSecureStorage(),
    lifecycle: createWebLifecycle(),
    push: createWebPush(),
    links: createWebLinks(),
    liveProgress: { update() {} },
    name: 'web',
  };
}

/** Web implementations in a browser; Capacitor ones inside the iOS and Android apps (ADR-002, Step 6.2). */
const native = nativePlatform();
export const platform: Platform = native ? createNativePlatform(native) : createWebPlatform();

export type { Platform } from './types';
export type { StorageAdapter } from './storage';
export type { WakeLockAdapter } from './wakelock';
export type { FullscreenAdapter } from './fullscreen';
export type { NotifyAdapter, ScheduledAlert, Sound } from './notify';
export type { HapticsAdapter } from './haptics';
export type { FilesAdapter } from './files';
export type { PushAdapter } from './push';
export type { LinksAdapter } from './links';
export type { LiveProgressAdapter, LiveProgressView } from './liveProgress';
