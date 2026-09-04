import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright against the BUILT artifact, at its production base path.
 *
 * Principle VI: "every claim that a change works MUST be established against the
 * built artifact, served at its production base path, entered through the URL a
 * player actually uses." The main config drives the dev server at `/`, where
 * `import.meta.env.BASE_URL` is `/` and every base-path defect is invisible.
 *
 * The base path here is not incidental. A relative base already shipped a blank
 * page to players from this repository, and the assets this feature adds fail
 * SILENTLY when their URL is wrong - there is no blank page the second time.
 *
 * Run with: npm run test:build
 */
export default defineConfig({
  testDir: 'tests/e2e-build',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  // Trailing slash, and specs navigate with './' so they land on /ski-game/ directly
  // rather than arriving via a redirect from the root.
  //
  // STATED GAP (Principle VI: "where the environment verified differs from the
  // player's, the difference MUST be stated at review"). The bare `/ski-game` entry,
  // with no trailing slash, is NOT covered here. `vite preview` returns 404 for it;
  // GitHub Pages redirects it to `/ski-game/`. That is a difference between this
  // server and production, so the no-slash entry cannot be verified locally and this
  // suite does not pretend to. What it does verify is the thing that actually broke
  // before: that asset URLs are built against the production base rather than
  // relative to the current path.
  use: { baseURL: 'http://localhost:4173/ski-game/', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run build && npx vite preview --base /ski-game/ --port 4173 --strictPort',
    url: 'http://localhost:4173/ski-game/',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env['CI']
          ? {}
          : { launchOptions: { executablePath: '/opt/pw-browsers/chromium' } }),
      },
    },
  ],
});
