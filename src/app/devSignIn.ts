import { FAKE_CODE } from '../platform/remote/fake';
import type { appStore } from '../store';

export const TEST_EMAIL = 'tester@example.com';
/** The first name can be corrected once for free, so the tester can still pick their own. */
const TEST_NAME = '테스터';

/**
 * `testMode.signedIn` (dev builds, fake backend): signs in as the test user after start-up, the same way
 * the sign-in sheet does, and gives them a name. Does nothing when an account is already signed in.
 */
export async function devSignIn(store: typeof appStore): Promise<void> {
  if (store.getState().account.status !== 'signedOut') return;
  try {
    await store.getState().requestSignInCode(TEST_EMAIL);
    await store.getState().verifySignInCode(TEST_EMAIL, FAKE_CODE);
    await store.getState().refreshSocial();
    if (store.getState().social && !store.getState().social?.me.handle) await store.getState().setHandle(TEST_NAME);
  } catch (e) {
    console.warn('Sift: test sign-in failed.', e);
  }
}
