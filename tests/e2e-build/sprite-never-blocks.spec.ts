import { test, expect } from '@playwright/test';
import { dropIn } from './helpers.js';

/**
 * FR-172 and SC-056. The sprite sheet is decoration; the run is not.
 *
 * This is the direct sibling of music-never-blocks.spec.ts, and it exists for the
 * same reason that one does: Principle VI requires every failure state a player can
 * reach to be produced DELIBERATELY in a test, because a failure path that has never
 * been executed is untested however carefully it was written.
 *
 * The failure being produced here is the exact class that reached players in this
 * project's first deployment week - an asset resolved against the wrong base path,
 * failing silently. Silently is the operative word: unlike a blank page, a sheet
 * that never loads produces no symptom at all if the fallback works, which is
 * precisely why it needs a test rather than a glance.
 *
 * Run against the built artifact, because that is where the URLs are real.
 */

test.describe('a run survives a sprite sheet that cannot load', () => {
  test.beforeEach(async ({ page }) => {
    // Every sprite request dies. Not a 404 - a hard failure, the worse case.
    await page.route(/\/sprites\/.*\.png(\?|$)/, (route) => route.abort('failed'));
  });

  test('a practice run starts, plays and ends with no sheet at all', async ({ page }) => {
    const thrown: string[] = [];
    page.on('pageerror', (e) => thrown.push(e.message));

    // Console errors minus the browser's own network log, for the reason
    // music-never-blocks.spec.ts records: Chromium writes ERR_FAILED for any
    // failed request whether or not the page handles it, from the network stack
    // rather than from application code, and no application code can suppress it.
    const appErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (/Failed to load resource/.test(m.text())) return;
      appErrors.push(m.text());
    });

    await dropIn(page, './');
    await page.locator('button[data-claim]').first().click();
    await page.locator('#practice').click();

    await expect(page.locator('#screen')).toBeVisible();
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 120_000 });

    // FR-172: the failure must never surface to the player.
    await expect(page.locator('text=The game could not start')).toHaveCount(0);
    expect(thrown, 'a missing sprite sheet threw or rejected unhandled').toEqual([]);
    expect(appErrors, 'a missing sprite sheet reached the console as an error').toEqual([]);
  });

  test('an official run still commits its score (SC-056)', async ({ page }) => {
    await dropIn(page, './');
    await page.locator('button[data-claim]').first().click();
    await page.locator('#official').click();
    await expect(page.locator('h2.title')).toContainText('THIS IS THE ONE');
    await page.locator('#go').click();

    await expect(page.locator('#screen')).toBeVisible();
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 120_000 });
    await page.locator('#done').click();

    // The standings are the point. A run that cannot be scored because a
    // picture is missing would be the worst defect this feature could ship.
    await expect(page.locator('table')).toBeVisible();
  });

  test('the run is not delayed waiting for a sheet that will never arrive', async ({ page }) => {
    await dropIn(page, './');
    await page.locator('button[data-claim]').first().click();

    const started = Date.now();
    await page.locator('#practice').click();
    await expect(page.locator('#screen')).toBeVisible();
    const elapsed = Date.now() - started;

    // Asserting "does not wait on the network", not a frame budget. Generous
    // on purpose; a run that blocked on a failing image load would be far slower.
    expect(elapsed, 'the run waited on a sprite sheet').toBeLessThan(5_000);
  });

  test('a 404 is the fallback renderer, not an error boundary', async ({ page }) => {
    await page.unroute(/\/sprites\/.*\.png(\?|$)/);
    await page.route(/\/sprites\/.*\.png(\?|$)/, (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
    const thrown: string[] = [];
    page.on('pageerror', (e) => thrown.push(e.message));

    await dropIn(page, './');
    await page.locator('button[data-claim]').first().click();
    await page.locator('#practice').click();
    await expect(page.locator('#screen')).toBeVisible();
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 120_000 });

    expect(thrown).toEqual([]);
  });
});
