import { test, expect } from '@playwright/test';
import { dropIn } from './helpers.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * FR-173. The same highest-risk line the music feature had, in a new place.
 *
 * `src/render/sprites.ts` builds every sheet URL from `import.meta.env.BASE_URL`,
 * which is `/` in dev and `/ski-game/` in the production build. A sheet requested
 * from the wrong base 404s in production while working perfectly on a dev server -
 * and, exactly as with audio, produces NO VISIBLE SYMPTOM, because FR-172 requires
 * the run to carry on without it. The game would simply render the primitive
 * fallback forever and nobody would know why.
 *
 * That is the whole reason this file exists and the whole reason it must run against
 * the built artifact. `playwright.config.ts` drives the dev server at `/`, where
 * every base-path defect is invisible by construction.
 */

const SHEET = /\/sprites\/.*\.png(\?|$)/;

/**
 * Whether the art has actually been committed.
 *
 * The 200 assertion below cannot mean anything until it has, and asserting it
 * anyway would leave a red gate that people learn to ignore - which is worse
 * than no gate, because a permanently failing check hides the day it starts
 * failing for a real reason.
 *
 * This is a STATED GAP and it closes itself: the moment T002 exports
 * public/sprites/skier.png, the build copies it to dist/ and the assertion
 * turns itself on with nobody having to remember. Blocked on T001-T003 in
 * specs/004-skier-sprite-animation/tasks.md.
 */
const ART_COMMITTED = existsSync(
  fileURLToPath(new URL('../../dist/sprites/skier.png', import.meta.url)),
);

test.describe('sprite sheets resolve at the production base path', () => {
  test('the skier sheet is requested from under /ski-game/ and returns 200', async ({ page }) => {
    test.skip(
      !ART_COMMITTED,
      'skier.png is not in the build yet (tasks T001-T003). This turns itself on ' +
        'the moment the art is committed.',
    );
    const responses: { url: string; status: number }[] = [];
    page.on('response', (r) => {
      if (SHEET.test(r.url())) responses.push({ url: r.url(), status: r.status() });
    });

    await page.goto('./');
    await expect(page.locator('h1.title-wordmark')).toContainText('SHREDPOCALYPSE');

    // Nothing is fetched before the gesture. Feature 003's SC-051 requires the
    // title screen to be DRAWN rather than downloaded, and an earlier build of
    // this feature broke it by starting the sheet load at module scope - so the
    // request deliberately waits for DROP IN, the same discipline FR-140 imposes
    // on audio.
    expect(responses, 'a sheet was fetched on the title screen').toEqual([]);

    await dropIn(page, './');
    await expect
      .poll(() => responses.length, { timeout: 15_000, message: 'no sprite sheet was requested' })
      .toBeGreaterThan(0);

    const skier = responses.find((r) => r.url.includes('skier'));
    expect(skier, 'the skier sheet was never requested').toBeDefined();

    // The assertion that catches the defect. A relative or absolute path stored
    // in the manifest would produce `/sprites/skier.png` here and 404.
    expect(skier?.url).toContain('/ski-game/sprites/skier.png');
    expect(skier?.status, `404 here means the base path is wrong: ${skier?.url}`).toBe(200);
  });

  test('no sheet is ever requested from the bare root', async ({ page }) => {
    const bare: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (SHEET.test(url.pathname) && !url.pathname.startsWith('/ski-game/')) bare.push(r.url());
    });

    await page.goto('./');
    await page.locator('#drop-in').click();
    await page.waitForTimeout(2_000);

    expect(bare, `sheets requested outside the base path: ${bare.join(', ')}`).toEqual([]);
  });
});
