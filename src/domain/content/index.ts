import { baselinePack } from './baseline';
import { ContentRegistry } from './registry';

/** The app's one content registry. Remote packs merge into it from Step 5.8. */
export const content = new ContentRegistry(baselinePack);
