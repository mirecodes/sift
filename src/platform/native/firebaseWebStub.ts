// Stands in for the Firebase JS SDK, which `@capacitor-firebase/messaging` imports for its browser
// implementation. Sift uses that plugin only inside the native apps (the web has no push, Step 6.6), so the
// browser implementation never runs and the SDK is not installed (vite.config.ts aliases it here).
const unavailable = (): never => {
  throw new Error('Firebase web messaging is not part of Sift');
};

export const getMessaging = unavailable;
export const getToken = unavailable;
export const deleteToken = unavailable;
export const onMessage = unavailable;
export const isSupported = async () => false;
