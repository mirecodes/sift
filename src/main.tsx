import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { runtimeConfig } from './app/runtimeConfig';
import { appStore } from './store';
import './ui/global.css';

const root = createRoot(document.getElementById('root') as HTMLElement);

// Content Studio (Step 3.4): development builds only; the branch and its chunk are dropped from production.
if (import.meta.env.DEV && window.location.pathname === '/studio/sprites') {
  // Sprite generator page (Step 3.5), driven by `npm run content:sprites`.
  void import('./screens/studio/spriteRenderer').then(({ renderAtlas }) => {
    (window as unknown as { __renderAtlas: typeof renderAtlas }).__renderAtlas = renderAtlas;
  });
} else if (import.meta.env.DEV && window.location.pathname.startsWith('/studio')) {
  void import('./screens/studio/Studio').then(({ Studio }) => root.render(<Studio />));
} else {
  const ready = appStore.getState().init();
  // `testMode.signedIn` (dev builds with the test backend): start signed in.
  if (import.meta.env.DEV && runtimeConfig.testMode.signedIn && runtimeConfig.backend.provider === 'fake')
    void ready.then(() => import('./app/devSignIn')).then(({ devSignIn }) => devSignIn(appStore));
  root.render(<App />);
}
