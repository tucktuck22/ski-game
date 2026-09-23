import { test, expect } from '@playwright/test';
import {
  fixture,
  mockPostgrest,
  startOfficialAttempt,
  takeOfficialRun,
  DRAFT_ID,
} from './postgrest.js';

/**
 * The two player-facing promises this feature makes outside the rules
 * themselves: the count is legible on a phone, and a bad connection never
 * stops a run.
 */

/**
 * SC-087. The viewport is the narrowest of the three reference devices in the
 * constitution — iPhone SE 3rd-gen class at 375 x 667 CSS px — so passing here
 * passes on the Pixel 6a and Galaxy A54 above it.
 *
 * WORTH KNOWING: every other Playwright project in this repository runs
 * `devices['Desktop Chrome']`, on a product whose platform baseline is the
 * evergreen mobile web. This is the first assertion in the suite at phone
 * width. The wider gap is not this feature's to close, but a regression here
 * would otherwise be invisible until someone opened the game on a phone.
 */
test.describe('the attempt count is legible on the smallest reference phone (SC-087)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('attempts remaining and best score are on the first screen, unscrolled', async ({
    page,
  }) => {
    const f = fixture();
    await mockPostgrest(page, f);

    // Claim through the UI rather than pre-seeding claimed_at: the app reads
    // `claim:<draft>` from session storage to know which entry is THIS device's
    // (main.ts:894), so a row claimed by nobody in particular shows no player
    // panel at all.
    await takeOfficialRun(page);

    const official = page.locator('#official');
    await expect(official).toContainText('2 left');
    await expect(page.locator('.confirmed, .pending')).toBeVisible();

    // Actually inside the viewport, not merely present in the DOM — "without
    // scrolling" is the half of SC-087 a visibility check alone misses.
    const box = await official.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);

    // No horizontal overflow at phone width either.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
  });
});

/**
 * FR-234 / research R2. An earlier design made the attempt write a precondition
 * of starting, which would have made this the first network round-trip in the
 * product to gate gameplay — no connection, no run. The organizer's trust ruling
 * removed it, and this is the assertion that keeps it removed.
 */
test.describe('a bad connection never stops a run (FR-234, research R2)', () => {
  test('the run starts even when the attempt write cannot get out', async ({ page }) => {
    const f = fixture();
    await mockPostgrest(page, f);
    await page.goto(`/?draft=${DRAFT_ID}`);
    await page.locator('#drop-in').click();
    await page.locator('button[data-claim]').first().click();
    // Wait for the claim to settle first — otherwise the abort below catches the
    // claim's own PATCH and the player panel never appears, which would make
    // this test fail for a reason that has nothing to do with what it asserts.
    await expect(page.locator('#official')).toBeEnabled();

    // Every roster_entry write now fails. Under a fail-closed design the player
    // would be stuck on the menu with an error; he must get his run instead.
    await page.route('**/rest/v1/roster_entry*', async (route) => {
      if (route.request().method() === 'PATCH') return route.abort('failed');
      return route.fallback();
    });

    await startOfficialAttempt(page);
    await page.locator('#go').click();

    // The run is under way: the canvas is up and the HUD says this one counts.
    await expect(page.locator('#screen')).toBeVisible();
    await expect(page.locator('.kind')).toContainText('THIS COUNTS');
  });
});
