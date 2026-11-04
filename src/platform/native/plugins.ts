// Every Capacitor plugin Sift uses, in one chunk that only native builds ever load (`native/index.ts`
// imports it lazily), so the web bundle stays free of them.
import { registerPlugin } from '@capacitor/core';

export { App } from '@capacitor/app';
export { Haptics, ImpactStyle } from '@capacitor/haptics';
export { LocalNotifications } from '@capacitor/local-notifications';
export { StatusBar } from '@capacitor/status-bar';
export { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
export { Share } from '@capacitor/share';
export { KeepAwake } from '@capacitor-community/keep-awake';
export { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
export { FirebaseMessaging } from '@capacitor-firebase/messaging';
export { SecureStorage } from '@aparajita/capacitor-secure-storage';

/** Sift's own plugin (ios/App/App/LiveProgressPlugin.swift, android/.../LiveProgressPlugin.java). */
export interface SiftLiveProgressPlugin {
  update(options: { phase: 'focus' | 'break'; startedAt: number; endsAt: number; title: string; detail: string; overTitle: string }): Promise<void>;
  end(): Promise<void>;
}
export const SiftLiveProgress = registerPlugin<SiftLiveProgressPlugin>('SiftLiveProgress');
