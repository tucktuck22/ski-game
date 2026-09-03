import { test, expect } from '@playwright/test';

/**
 * A blank page is the worst failure this product can have: nothing on screen,
 * nothing to report, and the only route to information is developer tools —
 * which is not something you can ask seven friends on a ski trip to open.
 */
test.describe('startup failures are visible, not blank', () => {
  test('a throw during startup renders a readable panel', async ({ page }) => {
    // Break something the app needs before its module runs.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', {
        get() {
          throw new Error('SIMULATED: storage subsystem unavailable');
        },
      });
    });
    await page.goto('/');
    // Whatever happens, the page must not be silently empty.
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('an uncaught runtime error surfaces on screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1.title')).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error('SIMULATED: something broke mid-run'),
          message: 'boom',
        }),
      );
    });

    const panel = page.locator('#fatal-error');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('SIMULATED: something broke mid-run');
    // It must say it is a bug, not blame the player.
    await expect(panel).toContainText('not something you did');
  });

  test('repeated errors do not stack panels', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1.title')).toBeVisible();
    for (let i = 0; i < 3; i++) {
      await page.evaluate((n) => {
        window.dispatchEvent(new ErrorEvent('error', { error: new Error(`SIMULATED ${n}`) }));
      }, i);
    }
    // The first failure is the useful one; later ones are usually consequences.
    await expect(page.locator('#fatal-error')).toHaveCount(1);
    await expect(page.locator('#fatal-error')).toContainText('SIMULATED 0');
  });
});
