import { test, expect } from '@playwright/test';
import { fixture, mockPostgrest, startOfficialAttempt, DRAFT_ID, ENTRY_ID } from './postgrest.js';

/**
 * SC-081 — THE FEATURE'S ACCEPTANCE DEMONSTRATION.
 *
 *   "A player who wipes out on his first attempt can still finish first in the
 *    draft. Demonstrated end to end, not argued."
 *
 * This is the one criterion that proves the feature does what it claims. Under
 * the old rule a face-plant on the official run WAS your score and the draft was
 * over: you took whatever bed was left. The whole reason three attempts exist is
 * that one bad run should not decide where somebody sleeps.
 *
 * Attempt 1 is a wipeout worth 300, supplied as fixture data because it stands
 * for a run taken on a previous day. Everything after it is real: the player
 * takes his second attempt through the actual UI, the score is computed by the
 * simulation, it posts through the real outbox, and the board ranks him through
 * the real reduction. Nothing about the outcome is fabricated.
 */
test.describe('a wipeout on attempt 1 does not end the draft (SC-081, FR-238)', () => {
  test('he takes another attempt and finishes first', async ({ page }) => {
    const f = fixture();
    // Yesterday: he caught an edge on his first attempt and scored 300.
    f.entry['official_attempts_used'] = 1;
    f.scores = [
      {
        entry_id: ENTRY_ID,
        draft_id: DRAFT_ID,
        attempt_no: 1,
        score: 300,
        outcome: 'wiped_out',
        commit_at: '2026-09-01T10:00:00Z',
      },
    ];
    await mockPostgrest(page, f);

    await page.goto(`/?draft=${DRAFT_ID}`);
    await page.locator('#drop-in').click();
    await page.locator('button[data-claim]').first().click();

    // Under the old rule this screen would have been the end of it. It is not:
    // the wipeout cost one attempt of three.
    await expect(page.locator('#official')).toBeEnabled();
    await expect(page.locator('#official')).toContainText('2 left');
    await expect(page.locator('table')).toContainText('WIPED OUT');

    // A real second attempt, scored by the simulation.
    await startOfficialAttempt(page);
    await page.locator('#go').click();
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 90_000 });
    await page.locator('#done').click();

    const posted = f.posts.find((p) => p['attempt_no'] === 2);
    expect(posted, 'the second attempt should have posted').toBeDefined();
    const second = posted!['score'] as number;
    expect(
      second,
      'the second attempt must beat the wipeout for this to mean anything',
    ).toBeGreaterThan(300);

    /**
     * A RIVAL WHO BEATS THE WIPEOUT BUT LOSES TO THE BEST.
     *
     * Without him "PICKS FIRST" would be trivially true — there would be nobody
     * else on the board. Placed strictly between the two scores, and computed
     * from the simulation's actual number rather than hardcoded, so it keeps
     * meaning the same thing if the physics move:
     *
     *   stuck with attempt 1 (300) -> Sam's score beats him -> he picks SECOND
     *   best of three (that score) -> he picks FIRST
     *
     * That gap is the feature, measured.
     */
    const rivalScore = Math.floor((300 + second) / 2);
    f.rivals.push({
      id: '44444444-4444-4444-4444-444444444444',
      draft_id: DRAFT_ID,
      name: 'Sam',
      origin: 'organizer',
      claimed_at: '2026-09-01T09:00:00Z',
      practice_runs_used: 3,
      official_attempts_used: 3,
      official_run_started_at: null,
      removed_at: null,
      removed_score: null,
    });
    f.scores.push({
      entry_id: '44444444-4444-4444-4444-444444444444',
      draft_id: DRAFT_ID,
      attempt_no: 1,
      score: rivalScore,
      outcome: 'finished',
      commit_at: '2026-09-01T09:30:00Z',
    });

    // Reflect the write back, as a real PostgREST would, and reload the board.
    f.scores.push({
      entry_id: ENTRY_ID,
      draft_id: DRAFT_ID,
      attempt_no: 2,
      score: second,
      outcome: posted!['outcome'],
      commit_at: '2026-09-02T10:00:00Z',
    });
    f.entry['official_attempts_used'] = 2;
    await page.reload();
    await page.locator('#drop-in').click();

    // FR-232: the board carries the BEST of the two, whichever that turned out
    // to be — asserted against the simulation's real number rather than a
    // number this test chose.
    const best = Math.max(300, second);
    await expect(page.locator('table')).toContainText(best.toLocaleString());

    // SC-081 itself: top of the board, having wiped out on attempt one — and
    // ahead of a rival who WOULD have beaten the wipeout. Under the old one-run
    // rule this player finishes second and takes whichever bed is left.
    await expect(page.locator('table')).toContainText('PICKS FIRST');
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toContainText('Tucker');
    await expect(firstRow).toContainText(best.toLocaleString());
    // Sam is on the board and below him, which is what makes "first" mean something.
    await expect(page.locator('table')).toContainText('Sam');
    await expect(page.locator('table tbody tr').nth(1)).toContainText('Sam');

    // And one attempt is still in hand.
    await expect(page.locator('#official')).toContainText('1 left');
  });
});
