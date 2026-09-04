import type { Page } from '@playwright/test';

/**
 * Enter the game from the title screen.
 *
 * FR-151: the title screen is the first thing on a cold load, and DROP IN is the
 * gesture that starts the music. Every journey through the app therefore begins
 * here, so it lives in one place rather than being repeated in each spec.
 *
 * `path` is the entry URL. Specs against the dev server pass '/'; specs against the
 * built artifact pass './', which resolves under the production base path.
 */
export async function dropIn(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await page.locator('#drop-in').click();
}
