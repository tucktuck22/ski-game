import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright against the SHARED-STORAGE build, with PostgREST mocked.
 *
 * WHY THIS CONFIG EXISTS. Every other suite runs the app in local mode, because
 * local mode needs no database — and local mode is the one configuration real
 * players never use. `LocalDraftStore.submitCommit()` cannot fail, so no
 * existing test could ever see what happens when a commit is refused or left
 * queued. That gap is precisely where the reported bug lived: the official run
 * ended, the score never reached the board, and the OFFICIAL RUN button came
 * back live for another go.
 *
 * The Supabase config below is fake and deliberately shaped to pass
 * `resolveConfig()`; the specs intercept `**\/rest/v1/**` and answer as
 * PostgREST would, including the failures. Nothing here touches a real project.
 *
 * Run with: npm run test:shared
 */
export default defineConfig({
  testDir: 'tests/e2e-shared',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: 'http://localhost:5174', trace: 'on-first-retry' },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: {
      // A syntactically real project URL and a real-shaped anon JWT (role:
      // anon, signature nonsense). Both are required for the app to select
      // DraftStore over LocalDraftStore, and neither is reachable — every
      // request is answered by the route handlers in the specs.
      VITE_SUPABASE_URL: 'https://abcdefghijkl.supabase.co',
      VITE_SUPABASE_ANON_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxLCJleHAiOjk5OTk5OTk5OTl9.not-a-signature',
    },
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
