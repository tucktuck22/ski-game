import { test, expect, type Page } from '@playwright/test';

/**
 * FR-144 and SC-046: music playback must not affect the simulation.
 *
 * `tests/e2e/determinism.spec.ts` proves cross-engine agreement, but it drives
 * `determinism.html`, a harness that never loads `main.ts` and therefore never loads
 * any music at all. It cannot see this. This file runs the real application three
 * times under three audio conditions and requires the same run to come out the same.
 *
 * Constitution Principle V is why the bar is identity rather than similarity: the
 * leaderboard is the bed order, so a score that moves because someone had sound on is
 * a score that decides where a person sleeps for the wrong reason.
 */

interface RunResult {
  outcome: string;
  score: string;
}

/**
 * One practice run on the warm-up course, with no input. The course seed is fixed in
 * local mode, so the run is a pure function of the build.
 */
async function practiceRun(page: Page): Promise<RunResult> {
  await page.goto('./');
  await page.locator('button[data-claim]').first().click();
  await page.locator('#practice').click();
  await expect(page.locator('#screen')).toBeVisible();

  const headline = page.locator('.sfx');
  await expect(headline).toBeVisible({ timeout: 120_000 });

  return {
    outcome: (await headline.textContent())?.trim() ?? '',
    // The score sits alone in the yellow paragraph of the results panel.
    score:
      (await page.locator('.panel p[style*="var(--yellow)"]').first().textContent())?.trim() ?? '',
  };
}

test.describe('the simulation does not hear the music', () => {
  test('the same run scores identically with music playing, muted, and unavailable', async ({
    browser,
  }) => {
    // 1. Music playing. A click arms audio before the run starts.
    const playing = await browser.newPage();
    await playing.goto('./');
    await playing.locator('body').click();
    const withMusic = await practiceRun(playing);
    await playing.close();

    // 2. Music muted. Same gesture, then the toggle.
    const muted = await browser.newPage();
    await muted.goto('./');
    await muted.locator('body').click();
    await muted.locator('#mute').click();
    await expect(muted.locator('#mute')).toContainText('SOUND OFF');
    const whenMuted = await practiceRun(muted);
    await muted.close();

    // 3. Music unavailable. Every request dies.
    const blocked = await browser.newPage();
    await blocked.route(/\.mp3(\?|$)/, (route) => route.abort('failed'));
    const whenBlocked = await practiceRun(blocked);
    await blocked.close();

    expect(withMusic.score, 'the run produced no score').not.toBe('');
    expect(whenMuted, 'muting changed the run').toEqual(withMusic);
    expect(whenBlocked, 'a failed music load changed the run').toEqual(withMusic);
  });
});
