# Sift

A Pomodoro-style focus timer with collectible rewards. Focus, earn an animal, watch your floating island grow.

```bash
npm install
npm run dev        # local dev server
npm test           # Vitest unit tests
npm run build      # typecheck + production build
npm run e2e        # Playwright smoke test (builds its own bundle; needs `npx playwright install chromium` once)
```

Data stays on the device unless a backend is configured and you sign in (`config/app.yaml` → `backend`; setup: `docs/guides/BACKEND_SETUP.md`). Server code: `server/` (`npm run server:sql`, `server:build`, `server:check`).

Documentation lives in `docs/` (map: `docs/README.md`): rules in `docs/reference/`, how-tos in `docs/guides/` (adding animals and skins, connecting the backend, building the apps), status in `docs/status/`, history in `docs/logs/`. Rules for the coding agent: `CLAUDE.md`.
