import { test, expect } from '@playwright/test';
import {
  fixture,
  mockPostgrest,
  takeOfficialRun,
  startOfficialAttempt,
  ENTRY_ID,
  SHIPPED_RULES_VERSION,
} from './postgrest.js';

/**
 * An attempt is spent when it STARTS, whatever the score goes on to do.
 *
 * These specs descend from the original reported bug, which they still hold
 * shut:
 *
 *   "It should write an official score for that player upon end of the run, and
 *    then allow them to free play. Currently it does not write the score, and
 *    users still have the option to do their official run again."
 *
 * The half that mattered was the second: the app treated a missing score row as
 * a run that never happened, so a commit that was queued or refused handed the
 * player the button back. Feature 007 keeps that closed and moves the charge
 * EARLIER still — to the start of the run — so an attempt the player abandons
 * costs him one too (FR-233, FR-234).
 *
 * The difference from the one-run era: being spent no longer ends the
 * competition. Two attempts remain and the button stays live, which is the
 * whole point of the feature (FR-238).
 */
test.describe('an official attempt is spent at its start, whatever the commit does', () => {
  test('the attempt is charged before the run, and the score posts against it', async ({
    page,
  }) => {
    const f = fixture();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mockPostgrest(page, f);

    await takeOfficialRun(page);

    // Charged at the start (FR-234), not at the end.
    expect(f.patches).toContainEqual({ official_attempts_used: 1 });

    expect(f.posts).toHaveLength(1);
    expect(f.posts[0]).toMatchObject({
      entry_id: ENTRY_ID,
      attempt_no: 1,
      rules_version: SHIPPED_RULES_VERSION,
    });
    expect(typeof f.posts[0]?.['score']).toBe('number');
    expect(errors).toEqual([]);
  });

  /**
   * FR-238, and the reason the feature exists. One bad run used to end the
   * draft; now it costs one of three.
   */
  test('two attempts remain afterwards, and free play is still withheld', async ({ page }) => {
    const f = fixture();
    await mockPostgrest(page, f);

    await takeOfficialRun(page);

    await expect(page.locator('#official')).toBeEnabled();
    await expect(page.locator('#official')).toContainText('2 left');
    // FR-068 at attempt granularity: the official course stays out of reach in
    // free play until every attempt is spent, or the remaining two would be
    // rehearsed runs (FR-244).
    await expect(page.locator('#free')).toBeDisabled();
  });

  test('a REFUSED commit still spends the attempt, and says who can fix it', async ({ page }) => {
    const f = fixture({
      // Exactly what a draft pinned to an old rules version sends back. Code
      // 23514 is check_violation, which classifyError() treats as permanent.
      commitError: {
        code: '23514',
        message: 'rules version mismatch: draft is 1.0.0, submission is 1.6.0',
      },
    });
    await mockPostgrest(page, f, '1.0.0');

    await takeOfficialRun(page);

    // Nothing reached the board — that is the database's decision and it stands.
    expect(f.posts).toEqual([]);
    // But the attempt is spent in shared storage, so it is not handed back.
    expect(f.patches).toContainEqual({ official_attempts_used: 1 });
    await expect(page.locator('#official')).toContainText('2 left');

    // And the refusal is stated in terms someone can act on, not as a raw
    // Postgres message in the corner.
    const box = page.locator('#commit-rejected');
    await expect(box).toContainText('NOT YOUR FAULT');
    await expect(box).toContainText('organizer');
    await expect(box).toContainText('0004_rules_freeze.sql');
    await expect(box).toContainText('rules version mismatch');
  });

  test('a commit still QUEUED spends the attempt too (FR-046)', async ({ page }) => {
    const f = fixture({
      // 08006 is connection_failure: transient, so the outbox keeps it and
      // retries. The score is not lost and it is not on the board yet.
      commitError: { code: '08006', message: 'could not connect to server' },
    });
    await mockPostgrest(page, f);

    await takeOfficialRun(page);

    expect(f.posts).toEqual([]);
    expect(f.patches).toContainEqual({ official_attempts_used: 1 });
    await expect(page.locator('#official')).toContainText('2 left');
    await expect(page.locator('.pending')).toBeVisible();
  });

  /**
   * THE ABANDONMENT CASE — what feature 007 actually changes about FR-019.
   *
   * The attempt is started and the run never reaches an end state. Nothing
   * commits, and under the old rule nothing was spent either: the player could
   * restart without limit, which is the unfairness feature 001 recorded and
   * declined to fix. Now the counter has already moved.
   */
  test('starting an attempt and never finishing it still spends it (FR-233)', async ({ page }) => {
    const f = fixture();
    await mockPostgrest(page, f);

    await page.goto(`/?draft=${f.entry['draft_id'] as string}`);
    await page.locator('#drop-in').click();
    await page.locator('button[data-claim]').first().click();
    await startOfficialAttempt(page);
    await page.locator('#go').click();
    // Part-way down, and then the session simply ends.
    await page.waitForTimeout(1500);

    expect(f.patches).toContainEqual({ official_attempts_used: 1 });
    expect(f.posts).toEqual([]);
  });

  test('the count survives a reload, because shared storage holds it', async ({ page }) => {
    const f = fixture({ commitError: { code: '08006', message: 'could not connect to server' } });
    await mockPostgrest(page, f);
    await takeOfficialRun(page);

    // The mock serves whatever the entry row says, so reflect the write back —
    // which is exactly what a real PATCH would have done.
    f.entry['official_attempts_used'] = 1;
    await page.reload();
    await page.locator('#drop-in').click();

    await expect(page.locator('#official')).toContainText('2 left');
    await expect(page.locator('#free')).toBeDisabled();
  });
});
