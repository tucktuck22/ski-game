import { test, expect, type Page } from '@playwright/test';
import { dropIn } from './helpers.js';

/**
 * The coached opening, in a real browser, against the built artifact
 * (FR-186, FR-188, FR-190b, FR-191, FR-197, Principle VI).
 *
 * WHAT ONLY THIS SUITE CAN PROVE. Most of the feature is settled in
 * milliseconds by the unit tests, which assert the cue table against the
 * generated course data. Two things are beyond them:
 *
 *   - **FR-190b.** The arrow marks must render legibly at badge size in the
 *     game's own typeface stack. A glyph that falls back to tofu is a defect no
 *     string comparison can see; it needs real fonts and a real layout engine.
 *     The remedy if this fires is a DRAWN arrow mark — never the word "arrow",
 *     which is exactly what these marks were chosen over.
 *   - **FR-197.** Whether a badge can appear in a scored run is a question about
 *     wiring, not about `cueAt`. This suite caught a coaching badge on the
 *     official course the first time it ran, against a plan that argued no
 *     branch was needed. That test is the reason the branch exists.
 *
 * HOW THE PLAYER IS DRIVEN. Off the badges themselves, not off a stopwatch. A
 * cue fires exactly one `PLAYER_LOOKAHEAD` before its object, so the badge text
 * says where the skier is more reliably than wall-clock timing does — and a
 * robot that gets down the hill on nothing but the instructions on screen is
 * the literal reading of FR-192's "completable using only the instruction on
 * screen".
 */

const LESSONS = [
  'HOLD TO CROUCH!',
  'RELEASE TO JUMP!',
  'STAY CROUCHED!',
  'SWIPE OR ← → TO FLIP!',
] as const;

const word = (page: Page) => page.locator('.coach-slot .coach-word');
const over = (page: Page) =>
  page
    .locator('.sfx')
    .isVisible()
    .catch(() => false);

async function startPractice(page: Page): Promise<void> {
  await dropIn(page, './');
  await page.locator('button[data-claim]').first().click();
  await expect(page.locator('#practice')).toBeVisible();
  await page.locator('#practice').click();
  await expect(page.locator('#screen')).toBeVisible();
}

test.describe('the coached first run', () => {
  test('FR-186/FR-190b: the first lesson is up, and its typeface has the arrows', async ({
    page,
  }) => {
    await startPractice(page);

    // Reachable with no input at all, so this assertion cannot be flaky: the
    // rope's cue fires before the rope does.
    await expect(word(page)).toHaveText(LESSONS[0], { timeout: 60_000 });

    // Measured in the badge's OWN computed font, at its own size, so this is the
    // stack the flip badge will use rather than a stand-in for it.
    const m = await word(page).evaluate((el) => {
      const style = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const w = (s: string): number => ctx.measureText(s).width;
      return { left: w('←'), right: w('→'), ref: w('M'), fontSize: style.fontSize };
    });

    expect(m.left, 'U+2190 measured zero width — it is not being rendered').toBeGreaterThan(0);
    expect(m.right, 'U+2192 measured zero width — it is not being rendered').toBeGreaterThan(0);
    // Tofu is a notdef box, narrower and squarer than a real arrow at text size.
    // An arrow that collapses well under an ordinary glyph is not being drawn.
    expect(
      m.left,
      'U+2190 is rendering as tofu; FR-190b wants a drawn mark instead',
    ).toBeGreaterThan(m.ref * 0.5);
    expect(
      m.right,
      'U+2192 is rendering as tofu; FR-190b wants a drawn mark instead',
    ).toBeGreaterThan(m.ref * 0.5);
  });

  test('FR-188/FR-191: the four lessons arrive in order, one at a time', async ({ page }) => {
    await startPractice(page);

    const seen: string[] = [];
    const stop = Date.now() + 150_000;
    let released = 0;

    // The player, playing by the badges alone.
    await page.keyboard.down('Space');
    try {
      while (Date.now() < stop && seen.length < LESSONS.length) {
        const text =
          (await word(page)
            .textContent()
            .catch(() => null)) ?? null;
        if (text && text !== seen[seen.length - 1]) {
          seen.push(text);
          // RELEASE TO JUMP: the cue fires one lookahead out, so let the charge
          // build and let go with the deadfall close. The release IS the jump.
          if (text === LESSONS[1]) {
            released = Date.now() + 1800;
          }
          // SWIPE OR arrows TO FLIP: throw the rotation once airborne.
          if (text === LESSONS[3]) {
            void page.keyboard.press('ArrowRight').catch(() => {});
          }
        }
        if (released && Date.now() >= released) {
          released = 0;
          await page.keyboard.up('Space');
          await page.waitForTimeout(250);
          await page.keyboard.down('Space');
        }
        if (await over(page)) break;
        await page.waitForTimeout(40);
      }
    } finally {
      await page.keyboard.up('Space').catch(() => {});
    }

    // Order first, so a wrong sequence reports as a wrong sequence rather than
    // as a short one.
    expect(seen, 'the coached badges did not arrive in the order FR-188 fixes').toEqual(
      LESSONS.slice(0, seen.length),
    );

    // And all four. This is FR-192 read literally — a player who acts on the
    // instruction on screen and nothing else gets through the whole section —
    // demonstrated by a robot that has no other source of information.
    //
    // IF THIS FAILS SHORT, READ IT AS A MARGIN REPORT, NOT AS FLAKE. The only
    // un-synchronised number in the loop is the 1800 ms it waits after RELEASE
    // TO JUMP before letting go; everything else is driven by the badges. A
    // failure at LESSONS[1] means the release window this section gives a player
    // is tighter than it looks, which is exactly the question the Principle VIII
    // play pass exists to answer.
    expect(seen, 'a player following only the badges did not see all four lessons').toEqual([
      ...LESSONS,
    ]);
  });

  test('FR-191: never two coaching badges at once', async ({ page }) => {
    await startPractice(page);
    await expect(word(page)).toBeVisible({ timeout: 60_000 });

    const stop = Date.now() + 60_000;
    while (Date.now() < stop) {
      expect(
        await page.locator('.coach-slot .coach-badge').count(),
        'two coaching badges were legible at the same time',
      ).toBeLessThanOrEqual(1);
      if (await over(page)) break;
      await page.waitForTimeout(50);
    }
  });

  test('FR-197: no coaching badge appears in a scored run', async ({ page }) => {
    // The test that found the defect. `cueAt` is a function of x alone and both
    // courses start at x=0, so without the run-kind branch in main.ts an
    // official run is coached through a descent that counts.
    await dropIn(page, './');
    await page.locator('button[data-claim]').first().click();
    await page.locator('#official').click();
    await expect(page.locator('h2.title')).toContainText('THIS IS THE ONE');
    await page.locator('#go').click();
    await expect(page.locator('#screen')).toBeVisible();

    const stop = Date.now() + 60_000;
    let samples = 0;
    while (Date.now() < stop) {
      expect(
        await page.locator('.coach-slot .coach-badge').count(),
        'a coaching badge appeared during an official run',
      ).toBe(0);
      samples++;
      if (await over(page)) break;
      await page.waitForTimeout(100);
    }
    // A check that never actually ran is not evidence of anything.
    expect(samples, 'the official run ended before it could be sampled').toBeGreaterThan(5);
  });
});
