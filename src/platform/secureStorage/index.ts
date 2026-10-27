/**
 * Small secrets (auth tokens): browser storage on the web, Keychain / Android Keystore on native
 * (Step 5.4, Phase 6). Never the IndexedDB save.
 */
export interface SecureStorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
