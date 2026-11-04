/** App lifecycle (Step 5.6, Phase 6): resume is when the app becomes visible again or the network returns. */
export interface LifecycleAdapter {
  /** Calls `cb` when the app comes back to the foreground or online. Returns an unsubscribe function. */
  onResume(cb: () => void): () => void;
}
