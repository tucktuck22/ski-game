import { test, expect } from '@playwright/test';
import { dropIn } from './helpers.js';

/**
 * FR-143 and SC-043. Music is the first thing to give up; the run is never the thing
 * that breaks.
 *
 * Constitution Principle II makes this a merge blocker rather than a nicety: a defect
 * that interrupts a run already in progress is a release blocker, and the run at stake
 * here is the one official run that decides where somebody sleeps.
 *
 * Run against the built artifact, because that is where the URLs are real.
 */

test.describe('a run survives music that cannot load', () => {
  test.beforeEach(async ({ page }) => {
    // Every audio request dies. Not a 404 - a hard failure, which is the worse case.
    await page.route(/\.mp3(\?|$)/, (route) => route.abort('failed'));
  });

  test('an official run starts, plays, ends, and commits its score in silence', async ({
    page,
  }) => {
    // An uncaught exception or an unhandled promise rejection - which is what a
    // mishandled play() or fetch would produce, and what FR-143 forbids.
    const thrown: string[] = [];
    page.on('pageerror', (e) => thrown.push(e.message));

    // Console errors, minus the browser's own network log. Chromium emits
    // "Failed to load resource: net::ERR_FAILED" for any request that fails,
    // whether or not the page handles it; it is written by the network stack, not
    // by application code, and no application code can suppress it. The player
    // never sees it. What FR-143 forbids is a failure SURFACING - an error
    // boundary, a fatal message, a broken run - and those are asserted below.
    const appErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (/Failed to load resource/.test(m.text())) return;
      appErrors.push(m.text());
    });

    await dropIn(page, './');
    await page.locator('button[data-claim]').first().click();

    await page.locator('#official').click();
    await expect(page.locator('h2.title')).toContainText('THIS IS THE ONE');
    await page.locator('#go').click();

    await expect(page.locator('#screen')).toBeVisible();
    await expect(page.locator('.hud .kind')).toContainText('THIS COUNTS');

    // The run reaches its end and the score commits, with no music at any point.
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 120_000 });
    await page.locator('#done').click();
    await expect(page.locator('table')).toBeVisible();

    // FR-143: a music failure must never surface to the player.
    await expect(page.locator('text=The game could not start')).toHaveCount(0);
    await expect(page.locator('text=Shared storage is unreachable')).toHaveCount(0);
    expect(thrown, 'a music failure threw or rejected unhandled').toEqual([]);
    expect(appErrors, 'a music failure reached the console as an application error').toEqual([]);
  });

  test('a run is not delayed waiting for music that will never arrive', async ({ page }) => {
    await dropIn(page, './');
    await page.locator('button[data-claim]').first().click();

    const started = Date.now();
    await page.locator('#practice').click();
    await expect(page.locator('#screen')).toBeVisible();
    const elapsed = Date.now() - started;

    // Generous by design: this is asserting "does not wait for the network", not a
    // frame budget. A run that blocked on a failing fetch would be far slower.
    expect(elapsed, 'the run waited on audio').toBeLessThan(5_000);
  });

  test('the mute toggle still works with no music to mute', async ({ page }) => {
    await dropIn(page, './');
    await expect(page.locator('#mute')).toContainText('SOUND ON');
    await page.locator('#mute').click();
    await expect(page.locator('#mute')).toContainText('SOUND OFF');
    await page.locator('#mute').click();
    await expect(page.locator('#mute')).toContainText('SOUND ON');
  });
});

test.describe('a run survives music that 404s', () => {
  test('a missing file is silence, not an error boundary', async ({ page }) => {
    await page.route(/\.mp3(\?|$)/, (route) => route.fulfill({ status: 404, body: '' }));
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
