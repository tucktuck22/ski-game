import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  /**
   * Absolute base for the production build, matching the GitHub Pages project
   * path.
   *
   * This was `'./'`, and relative asset paths resolve against the CURRENT URL:
   * at https://owner.github.io/ski-game (no trailing slash) `./assets/main.js`
   * becomes /assets/main.js, one directory too high, so every asset 404s and
   * the page renders blank with no error anyone would notice. With the trailing
   * slash it worked, which is what made it hard to spot.
   *
   * An absolute base resolves identically either way. Dev stays at '/' so the
   * dev server and Playwright keep working from the root.
   */
  base: command === 'build' ? '/ski-game/' : '/',
  build: {
    target: 'es2022',
    sourcemap: true,
    // determinism.html is a test harness, not shipped: it is served in dev,
    // where Playwright drives it, and left out of the production bundle.
    rollupOptions: { input: { main: 'index.html' } },
  },
  server: { port: 5173 },
}));
