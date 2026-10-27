import type { FilesAdapter } from './files';
import type { FullscreenAdapter } from './fullscreen';
import type { HapticsAdapter } from './haptics';
import type { LifecycleAdapter } from './lifecycle';
import type { LinksAdapter } from './links';
import type { LiveProgressAdapter } from './liveProgress';
import type { NotifyAdapter } from './notify';
import type { PushAdapter } from './push';
import type { SecureStorageAdapter } from './secureStorage';
import type { StorageAdapter } from './storage';
import type { WakeLockAdapter } from './wakelock';

/** Everything the app needs from the device (ADR-002, guidance_v2 Step 6.2): one set for web, one for native. */
export interface Platform {
  storage: StorageAdapter;
  wakeLock: WakeLockAdapter;
  fullscreen: FullscreenAdapter;
  notify: NotifyAdapter;
  haptics: HapticsAdapter;
  files: FilesAdapter;
  secure: SecureStorageAdapter;
  lifecycle: LifecycleAdapter;
  push: PushAdapter;
  links: LinksAdapter;
  liveProgress: LiveProgressAdapter;
  /** Which build this is, for the API client header (Step 5.2). */
  name: 'web' | 'ios' | 'android';
}
