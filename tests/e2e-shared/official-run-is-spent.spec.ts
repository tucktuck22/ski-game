import { test, expect } from '@playwright/test';
import { fixture, mockPostgrest, takeOfficialRun, ENTRY_ID } from './postgrest.js';

/**
 * The reported bug, from both ends.
 *
 * "It should write an official score for that player upon end of the run, and
 * then allow them to free play. Currently it does not write the score, and
 * users still have the option to do their official run again."
 *
 * Two separate defects produced that one sentence:
 *   1. the database refused every insert (rules frozen at seed rather than at
 *      first commit — supabase/migrations/0004_rules_freeze.sql), and
 *   2. the app treated a missing score row as a run that never happened, so it
 *      offered the official run again — FR-018 undone by a failed request.
 *
 * The second is what these specs hold shut. Whatever the database does with the
 * score, a run that reached a finish or a wipeout is spent (FR-017).
 */
test.describe('an official run that has ended is spent, whatever the score does', () => {
  test('a confirmed commit posts the score and leaves only free play', async ({ page }) => {
    const f = fixture();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mockPostgrest(page, f);

    await takeOfficialRun(page);

    expect(f.posts).toHaveLength(1);
    expect(f.posts[0]).toMatchObject({ entry_id: ENTRY_ID, rules_version: '1.6.0' });
    expect(typeof f.posts[0]?.['score']).toBe('number');

    await expect(page.locator('#official')).toBeDisabled();
    await expect(page.locator('#practice')).toBeDisabled();
    await expect(page.locator('#free')).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('a REFUSED commit still spends the run, and says who can fix it', async ({ page }) => {
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
    // But the run is spent in shared storage, so there is no second go at it.
    expect(f.patches).toContainEqual({ official_status: 'committed' });
    await expect(page.locator('#official')).toBeDisabled();
    await expect(page.locator('#practice')).toBeDisabled();
    await expect(page.locator('#free')).toBeEnabled();

    // And the refusal is stated in terms someone can act on, not as a raw
    // Postgres message in the corner.
    const box = page.locator('#commit-rejected');
    await expect(box).toContainText('NOT YOUR FAULT');
    await expect(box).toContainText('organizer');
    await expect(box).toContainText('0004_rules_freeze.sql');
    await expect(box).toContainText('rules version mismatch');
  });

  test('a commit still QUEUED spends the run too (FR-046, FR-018)', async ({ page }) => {
    const f = fixture({
      // 08006 is connection_failure: transient, so the outbox keeps it and
      // retries. The score is not lost and it is not on the board yet.
      commitError: { code: '08006', message: 'could not connect to server' },
    });
    await mockPostgrest(page, f);

    await takeOfficialRun(page);

    expect(f.posts).toEqual([]);
    expect(f.patches).toContainEqual({ official_status: 'committed' });
    await expect(page.locator('#official')).toBeDisabled();
    await expect(page.locator('#free')).toBeEnabled();
    // The two states are not the same and the screen must not conflate them:
    // this one resolves itself, the refused one does not.
    await expect(page.locator('#blocked-reason')).toContainText('not reached the board');
    await expect(page.locator('.pending')).toBeVisible();
  });

  test('the run stays spent across a reload, because shared storage says so', async ({ page }) => {
    const f = fixture({ commitError: { code: '08006', message: 'could not connect to server' } });
    await mockPostgrest(page, f);
    await takeOfficialRun(page);

    await page.reload();
    await page.locator('#drop-in').click();

    await expect(page.locator('#official')).toBeDisabled();
    await expect(page.locator('#free')).toBeEnabled();
  });
});
