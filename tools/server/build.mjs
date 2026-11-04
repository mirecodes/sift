// npm run server:build: bundles the server core (server/edge/bundle.ts and everything it imports: shared
// rules, domain rules, the baseline content pack) into one ES module for the Supabase edge function,
// server/supabase/functions/api/sift.js. Deploy with `supabase functions deploy api` (docs/guides/BACKEND_SETUP.md).
import { build } from 'vite';

await build({
  configFile: false,
  logLevel: 'warn',
  define: { 'import.meta.env.DEV': 'false' },
  build: {
    lib: { entry: 'server/edge/bundle.ts', formats: ['es'], fileName: () => 'sift.js' },
    outDir: 'server/supabase/functions/api',
    emptyOutDir: false,
    target: 'es2022',
    minify: false,
    assetsInlineLimit: 0,
  },
});
console.log('wrote server/supabase/functions/api/sift.js');
