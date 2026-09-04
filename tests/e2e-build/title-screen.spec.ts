import { test, expect } from '@playwright/test';

/**
 * FR-151 to FR-154 and SC-050.
 *
 * The music cannot start on page load. Every target browser blocks audio before a
 * user gesture and iOS Safari permits no exception, and FR-054 requires the same
 * thing independently. The title screen does not work around that rule — it makes the
 * gesture the rule already required into something visible and purposeful.
 *
 * So what is under test is not "does music autoplay" but "is there exactly ONE thing
 * to do, and does it do both jobs".
 */

const AUDIO = /\.mp3(\?|$)/;

test.describe('the title screen', () => {
  test('is the first thing on screen, and it is silent', async ({ page }) => {
    const audio: string[] = [];
    page.on('request', (r) => {
      if (AUDIO.test(r.url())) audio.push(r.url());
    });

    await page.goto('./');

    await expect(page.locator('h1.title-wordmark')).toContainText('SHREDPOCALYPSE');
    await expect(page.locator('#drop-in')).toBeVisible();
    // The board must not be reachable behind it.
    await expect(page.locator('button[data-claim]')).toHaveCount(0);

    await page.waitForLoadState('networkidle');
    expect(audio, 'audio was fetched before the player asked for it').toEqual([]);
  });

  test('SC-050: one action starts the music AND reaches the board', async ({ page }) => {
    const audio: string[] = [];
    page.on('request', (r) => {
      if (AUDIO.test(r.url())) audio.push(r.url());
    });

    await page.goto('./');
    await expect(page.locator('#drop-in')).toBeVisible();

    // Exactly one action. Not a click to start sound and another to enter.
    await page.locator('#drop-in').click();

    await expect(page.locator('button[data-claim]').first()).toBeVisible();
    await expect
      .poll(() => audio.filter((u) => u.includes('look-out-below')).length, {
        timeout: 15_000,
        message: 'dropping in did not start the music',
      })
      .toBe(1);
  });

  test('FR-153: entry works when the music cannot load at all', async ({ page }) => {
    await page.route(AUDIO, (route) => route.abort('failed'));

    await page.goto('./');
    const started = Date.now();
    await page.locator('#drop-in').click();
    await expect(page.locator('button[data-claim]').first()).toBeVisible();

    // Entry must not have waited on a fetch that was never going to succeed.
    expect(Date.now() - started, 'entry waited on the music').toBeLessThan(5_000);
  });

  test('FR-154: reachable and operable by keyboard', async ({ page }) => {
    await page.goto('./');
    // The control is focused on arrival, so a keyboard player has one obvious thing
    // to press rather than an unknown number of tabs to find it.
    await expect(page.locator('#drop-in')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('button[data-claim]').first()).toBeVisible();
  });

  test('the title card is drawn, not downloaded (SC-051)', async ({ page }) => {
    const media: string[] = [];
    page.on('request', (r) => {
      if (/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|otf|mp4|webm)(\?|$)/.test(r.url()))
        media.push(r.url());
    });

    await page.goto('./');
    await expect(page.locator('svg.title-scene')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // The favicon is served from the document head, not by the title screen.
    const notFavicon = media.filter((u) => !u.includes('favicon'));
    expect(notFavicon, 'the title screen pulled in a media file').toEqual([]);
  });

  test('every colour in the scene comes from the palette', async ({ page }) => {
    await page.goto('./');
    const markup = (await page.locator('svg.title-scene').innerHTML()).toLowerCase();

    // Style-bible section 1: eight tokens, and nothing outside them. Raw hex or
    // rgb() in the scene would be a colour nobody chose.
    const rawColours = markup.match(/#[0-9a-f]{3,8}\b|rgba?\(/g) ?? [];
    // The gradient mask uses #fff and #000 as mask channels, which are not colours
    // the player sees - they select which pixels the palette gradient reaches.
    const outsideMask = rawColours.filter((c) => c !== '#fff' && c !== '#000');
    expect(outsideMask, `non-palette colour in the title scene: ${outsideMask.join(', ')}`).toEqual(
      [],
    );
  });
});
