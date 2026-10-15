import { createRoot } from 'react-dom/client';
import { App } from './app/App';
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
  void appStore.getState().init();
  root.render(<App />);
}
