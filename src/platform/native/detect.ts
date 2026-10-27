/**
 * The native shell this page runs in, or `null` in a browser. Capacitor's bridge defines
 * `window.Capacitor` before the app loads, so no plugin code is needed to ask.
 */
export function nativePlatform(): 'ios' | 'android' | null {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?(): boolean; getPlatform?(): string } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const name = cap.getPlatform?.();
  return name === 'ios' || name === 'android' ? name : null;
}
