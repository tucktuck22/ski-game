import { test, expect } from '@playwright/test';
import { dropIn } from './helpers.js';

/**
 * User Story 1 — the MVP loop. Claim a name, practise, commit the one run that
 * counts, see the standings.
 */
test.describe('US1: claim, practise, commit', () => {
  test('a player claims a name and the roster reflects it', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await dropIn(page);
    await expect(page.locator('h1.title')).toHaveText("SHREDPOCALYPSE '86");

    // FR-041: the board says plainly what rank 1 wins.
    await expect(page.locator('.subtitle').first()).toContainText('bed order');

    await page.locator('button[data-claim]').first().click();
    await expect(page.locator('#practice')).toContainText('3 left');
    expect(errors).toEqual([]);
  });

  test('a completed practice run decrements the count and records nothing (FR-014)', async ({
    page,
  }) => {
    await dropIn(page);
    await page.locator('button[data-claim]').first().click();
    await page.locator('#practice').click();
    await expect(page.locator('#screen')).toBeVisible();

    // Practice must be labelled as not counting.
    await expect(page.locator('.hud .kind')).toContainText('DOES NOT COUNT');

    await expect(page.locator('.sfx')).toBeVisible({ timeout: 90_000 });
    await page.locator('#done').click();
    await expect(page.locator('#practice')).toContainText('2 left');

    // Nothing reached the leaderboard.
    await expect(page.locator('table')).not.toContainText('FINISHED');
  });

  test('the official run demands an explicit confirmation that says it counts once (FR-016)', async ({
    page,
  }) => {
    await dropIn(page);
    await page.locator('button[data-claim]').first().click();
    await page.locator('#official').click();

    const panel = page.locator('.panel');
    await expect(panel).toContainText('counts');
    await expect(panel).toContainText('exactly one');
    await expect(panel).toContainText('including if you wipe out');
    await expect(panel).toContainText('no retake');

    // Backing out must be possible right up to the last tap.
    await page.locator('#back').click();
    await expect(page.locator('#official')).toBeVisible();
  });

  test('an attempt commits irreversibly, and two attempts remain (FR-238)', async ({ page }) => {
    await dropIn(page);
    await page.locator('button[data-claim]').first().click();
    await page.locator('#official').click();
    await page.locator('#go').click();

    await expect(page.locator('.hud .kind')).toContainText('THIS COUNTS');
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 90_000 });
    await page.locator('#done').click();

    // FR-018 as amended by feature 007: the ATTEMPT cannot be retaken, but it
    // does not end the competition. Two remain, and that is the point of the
    // feature — one bad run no longer decides where you sleep (FR-238).
    await expect(page.locator('#official')).toBeEnabled();
    await expect(page.locator('#official')).toContainText('2 left');

    // FR-068 at attempt granularity (FR-244): free play still cannot reach the
    // official course, or the remaining two attempts would be rehearsed runs.
    await expect(page.locator('#free')).toBeDisabled();

    // The score is on the board with a pick position, and the board says plainly
    // that this is a best-so-far rather than a result (FR-239).
    await expect(page.locator('table')).toContainText(/PICKS FIRST|PICK \d/);
    await expect(page.locator('table')).toContainText('SO FAR');
  });

  test('spending every attempt ends the competition and opens free play', async ({ page }) => {
    await dropIn(page);
    await page.locator('button[data-claim]').first().click();

    for (let attempt = 1; attempt <= 3; attempt++) {
      await expect(page.locator('#official')).toContainText(`${4 - attempt} left`);
      await page.locator('#official').click();
      await page.locator('#go').click();
      await expect(page.locator('.sfx')).toBeVisible({ timeout: 90_000 });
      await page.locator('#done').click();
    }

    await expect(page.locator('#official')).toBeDisabled();
    await expect(page.locator('#practice')).toBeDisabled();
    // FR-068: only now does free play get the official course.
    await expect(page.locator('#free')).toBeEnabled();
    await expect(page.locator('#blocked-reason')).toContainText('attempts are used');
  });

  test('nobody is called a forfeit before the deadline', async ({ page }) => {
    await dropIn(page);
    await expect(page.locator('table')).toContainText('NO SCORE YET');
    await expect(page.locator('table')).not.toContainText('FORFEIT');
  });

  test('a player can add a name that is not on the roster (FR-070)', async ({ page }) => {
    await dropIn(page);
    await page.locator('#new-name').fill('Brother-in-law');
    await page.locator('#add-name').click();
    await expect(page.locator('#practice')).toBeVisible();
    await expect(page.locator('table')).toContainText('Brother-in-law');
  });

  test('a duplicate name is refused (FR-003)', async ({ page }) => {
    await dropIn(page);
    const existing = await page.locator('button[data-claim]').first().textContent();
    await page.locator('#new-name').fill(existing!.trim().toLowerCase());
    await page.locator('#add-name').click();
    await expect(page.locator('#roster-error')).toContainText('already on the roster');
  });
});
