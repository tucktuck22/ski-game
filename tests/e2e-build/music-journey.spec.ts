import { test, expect, type Page } from '@playwright/test';

/**
 * The eight-row scenario table in quickstart.md, walked end to end against the built
 * artifact rather than described and trusted.
 *
 * Definition of Done item 7 wants the change exercised against the built artifact at
 * its production base path, with the command and environment named. This file is that
 * exercise; `npm run test:build` is the command.
 *
 * Row 5 (the wipeout finale keeps the course piece) and the audible half of rows 2-6
 * are not here. Whether a sound is HEARD is not observable from Playwright - what is
 * observable is which source exists, which request was made, and what state the player
 * is in. G4, the gapless join, is audible only and remains T047's, unticked.
 */

const AUDIO = /\.mp3(\?|$)/;

/** Requests, so a re-fetch is visible even when the resulting playback is not. */
function trackRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (r) => {
    if (AUDIO.test(r.url())) seen.push(r.url());
  });
  return seen;
}

const front = (urls: string[]): string[] => urls.filter((u) => u.includes('look-out-below'));
const course = (urls: string[]): string[] => urls.filter((u) => u.includes('powder-rush'));

test.describe('quickstart scenario table', () => {
  test('rows 1-2: silence until a gesture, then the front-end piece from under the base', async ({
    page,
  }) => {
    const urls = trackRequests(page);
    await page.goto('./');
    await expect(page.locator('h1.title')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(urls, 'row 1: audio was fetched before any gesture').toEqual([]);

    await page.locator('body').click();
    await expect.poll(() => front(urls).length, { timeout: 15_000 }).toBe(1);
    expect(front(urls)[0]).toContain('/ski-game/audio/look-out-below.mp3');
  });

  test('row 3: the confirmation screen and back does not re-fetch the front-end piece', async ({
    page,
  }) => {
    const urls = trackRequests(page);
    await page.goto('./');
    await page.locator('button[data-claim]').first().click();
    await expect.poll(() => front(urls).length, { timeout: 15_000 }).toBe(1);

    // Board -> THIS IS THE ONE -> board. FR-139 / SC-042.
    for (let i = 0; i < 5; i++) {
      await page.locator('#official').click();
      await expect(page.locator('h2.title')).toContainText('THIS IS THE ONE');
      await page.locator('#back').click();
      await expect(page.locator('#practice')).toBeVisible();
    }
    expect(front(urls), 'row 3: the front-end piece restarted on a screen change').toHaveLength(1);
    expect(course(urls), 'row 3: the course piece played outside a run').toHaveLength(0);
  });

  test('rows 4-6: the course piece takes over for a run and the front-end piece returns', async ({
    page,
  }) => {
    const urls = trackRequests(page);
    await page.goto('./');
    await page.locator('button[data-claim]').first().click();
    await expect.poll(() => front(urls).length, { timeout: 15_000 }).toBe(1);

    await page.locator('#practice').click();
    await expect(page.locator('#screen')).toBeVisible();
    await expect.poll(() => course(urls).length, { timeout: 15_000 }).toBeGreaterThan(0);

    // Row 5: the run plays out, finale included, and reaches the results panel.
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 120_000 });

    // Row 6: back to the board. The decoded buffer is reused, so no second fetch.
    await page.locator('#done').click();
    await expect(page.locator('#practice')).toBeVisible();
    expect(front(urls), 'row 6: the front-end piece was re-fetched instead of reused').toHaveLength(
      1,
    );
  });

  test('rows 7-8: mute silences and unmute resumes, within the session', async ({ page }) => {
    const urls = trackRequests(page);
    await page.goto('./');
    await page.locator('body').click();
    await expect.poll(() => front(urls).length, { timeout: 15_000 }).toBe(1);

    await expect(page.locator('#mute')).toContainText('SOUND ON');
    await page.locator('#mute').click();
    await expect(page.locator('#mute')).toContainText('SOUND OFF');
    await page.locator('#mute').click();
    await expect(page.locator('#mute')).toContainText('SOUND ON');

    // Unmuting resumes rather than restarts: no second fetch, no second source.
    expect(front(urls), 'row 8: unmuting re-fetched the piece instead of resuming').toHaveLength(1);

    // Session-scoped by decision, not by accident. A reload forgets it - see the
    // spec's Known deviations. Asserted so the deviation stays visible if it changes.
    await page.locator('#mute').click();
    await expect(page.locator('#mute')).toContainText('SOUND OFF');
    await page.reload();
    await page.locator('body').click();
    await expect(page.locator('#mute'), 'mute unexpectedly persisted').toContainText('SOUND ON');
  });
});
