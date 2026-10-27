/// <reference types="vitest/config" />
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { formatContentJson, isWritableContentPath } from './tools/content-build/format';

/**
 * Content Studio saves (Step 3.4): `POST /__studio/save { path, data }` writes one item file under
 * `content/`. Dev server only (`apply: 'serve'`); never part of a build.
 */
function studioSave(): Plugin {
  return {
    name: 'sift-studio-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__studio/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const { path, data } = JSON.parse(body) as { path: string; data: unknown };
            if (!isWritableContentPath(path)) throw new Error(`Not a content item file: ${path}`);
            writeFileSync(join(server.config.root, 'content', path), formatContentJson(data));
            res.end('saved');
          } catch (e) {
            res.statusCode = 400;
            res.end(e instanceof Error ? e.message : String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), studioSave()],
  test: {
    environment: 'node',
    // Terrain sweeps over hundreds of seeds take several seconds on slow CI machines.
    testTimeout: 30_000,
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
