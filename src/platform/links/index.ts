/**
 * Incoming deep links (guidance_v2 Step 6.5): the page URL on the web, universal links / app links on
 * native. Parsing is shared (`shared/rules/links.ts`).
 */
export interface LinksAdapter {
  /** Calls `cb` with the link the app was opened with (once) and with every later one. Returns unsubscribe. */
  onOpen(cb: (url: string) => void): () => void;
}
