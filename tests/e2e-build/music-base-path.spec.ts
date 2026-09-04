import { test, expect } from '@playwright/test';
import { dropIn } from './helpers.js';

/**
 * FR-146 and research.md R5. The single highest-risk line in this feature.
 *
 * `src/audio/music.ts` builds every audio URL from `import.meta.env.BASE_URL`, which
 * is `/` in dev and `/ski-game/` in the production build. Nothing else in `src/` reads
 * that value, so this feature is the first chance to reintroduce the base-path defect
 * that already shipped a blank page to players once.
 *
 * It would be worse this time. Audio that 404s produces no visible symptom at all -
 * the game plays perfectly, in silence, and nobody knows why. That is what this file
 * exists to catch, and it can only catch it against the built artifact.
 */

const AUDIO = /\.mp3(\?|$)/;

test.describe('the shipped music resolves at the production base path', () => {
  test('both pieces return 200 from under /ski-game/', async ({ page }) => {
    const responses: { url: string; status: number }[] = [];
    page.on('response', (r) => {
      if (AUDIO.test(r.url())) responses.push({ url: r.url(), status: r.status() });
    });

    await page.goto('./');
    await expect(page.locator('h1.title-wordmark')).toContainText('SHREDPOCALYPSE');

    // FR-140: nothing is fetched before a deliberate gesture. The title screen is
    // where that gesture is asked for, so it must still be silent here.
    expect(responses).toEqual([]);

    await page.locator('#drop-in').click();
    await expect
      .poll(() => responses.length, { timeout: 15_000, message: 'no audio was requested' })
      .toBeGreaterThan(0);

    const front = responses.find((r) => r.url.includes('look-out-below'));
    expect(front, 'the front-end piece was never requested').toBeDefined();
    expect(front?.url).toContain('/ski-game/audio/look-out-below.mp3');
    expect(front?.status, `404 here means the base path is wrong: ${front?.url}`).toBe(200);
  });

  test('the course piece resolves too, once a run starts', async ({ page }) => {
    const responses: { url: string; status: number }[] = [];
    page.on('response', (r) => {
      if (AUDIO.test(r.url())) responses.push({ url: r.url(), status: r.status() });
    });

    await dropIn(page, './');
    await page.locator('button[data-claim]').first().click();
    await page.locator('#practice').click();
    await expect(page.locator('#screen')).toBeVisible();

    await expect
      .poll(() => responses.filter((r) => r.url.includes('powder-rush')).length, {
        timeout: 15_000,
        message: 'the course piece was never requested',
      })
      .toBeGreaterThan(0);

    for (const r of responses.filter((x) => x.url.includes('powder-rush'))) {
      expect(r.url).toContain('/ski-game/audio/powder-rush.mp3');
      // A range request answers 206; both are fine, a 404 is not.
      expect([200, 206], `wrong base path: ${r.url}`).toContain(r.status);
    }
  });

  test('no audio is part of the initial payload (FR-146)', async ({ page }) => {
    const beforeGesture: string[] = [];
    page.on('request', (r) => {
      if (AUDIO.test(r.url())) beforeGesture.push(r.url());
    });

    // Deliberately no drop-in: this asserts what happens BEFORE the gesture.
    await page.goto('./');
    await expect(page.locator('#drop-in')).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(
      beforeGesture,
      'audio was fetched before any gesture, so it is in the initial payload',
    ).toEqual([]);
  });
});
