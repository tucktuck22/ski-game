import { defineConfig, devices } from '@playwright/test';

// Browsers are preinstalled in this environment (PLAYWRIGHT_BROWSERS_PATH).
// Never run `playwright install`.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  // FR-026 / research R2: determinism is only proven if all three engines agree.
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // This environment ships a preinstalled Chromium; never run
        // `playwright install`. CI resolves browsers normally.
        ...(process.env['CI'] ? {} : { launchOptions: { executablePath: '/opt/pw-browsers/chromium' } }),
      },
    },
    // Firefox and WebKit run in CI, where all three engines are installed. The
    // three-engine agreement is what actually proves FR-026; a single engine
    // proves only that the run is repeatable on that engine.
    ...(process.env['CI']
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
});
