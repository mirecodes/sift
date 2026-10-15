import { version } from '../../package.json';

/** The running app version: content with a higher `minClientVersion` stays hidden (Step 3.1). */
export const APP_VERSION: string = version;
