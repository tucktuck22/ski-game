import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    // determinism.html is a test harness, not shipped: it is served in dev,
    // where Playwright drives it, and left out of the production bundle.
    rollupOptions: { input: { main: 'index.html' } },
  },
  server: { port: 5173 },
});
