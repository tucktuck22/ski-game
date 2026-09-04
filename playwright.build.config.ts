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
  // No trailing slash, deliberately: that is the URL shape that broke before.
  use: { baseURL: 'http://localhost:4173/ski-game', trace: 'on-first-retry' },
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
