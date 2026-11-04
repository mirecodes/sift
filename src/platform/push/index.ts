/**
 * Push notifications (guidance_v2 Step 6.6): APNs / FCM through Firebase Cloud Messaging on native.
 * On the web there is no push: social events wait in the Inbox.
 */
export interface PushAdapter {
  readonly available: boolean;
  /**
   * Asks for permission (only after the user's first social action, never at launch) and returns this
   * device's push token, or `null` when denied, unavailable or not configured.
   */
  register(): Promise<string | null>;
  /** The token without asking, when permission was already granted; otherwise `null`. */
  token(): Promise<string | null>;
  /** A tapped push opens its link (Step 6.5). Returns an unsubscribe function. */
  onOpen(cb: (url: string) => void): () => void;
}
