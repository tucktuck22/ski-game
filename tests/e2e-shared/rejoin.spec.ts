import { test, expect, type Page } from '@playwright/test';
import { fixture, mockPostgrest, DRAFT_ID, ENTRY_ID, type Fixture } from './postgrest.js';

/**
 * A player can always get back to his own name (feature 010, FR-300/FR-301).
 *
 * The reported bug, in the maintainer's words:
 *
 *   "I can't come back in a subsequent session once I've already claimed myself
 *    once."
 *
 * A pick used to be an exclusive claim written to shared storage, while the
 * device remembered it only in session storage. Close the tab and the device
 * forgot him, but the roster still hid the name as claimed, and claiming it
 * again was refused. He was locked out of his own entry until an organizer
 * released it.
 *
 * These specs run against the wire format rather than the local backend because
 * that is where the lock lived: a `claimed_at` left on the row by an earlier
 * session. Every fixture here carries one.
 */

const EARLIER_SESSION = '2026-09-25T20:00:00Z';

function claimedEarlier(over: Partial<Fixture['entry']> = {}): Fixture {
  const base = fixture();
  return fixture({ entry: { ...base.entry, claimed_at: EARLIER_SESSION, ...over } });
}

async function pickTucker(page: Page): Promise<void> {
  await page.goto(`/?draft=${DRAFT_ID}`);
  await page.locator('#drop-in').click();
  const tucker = page.locator('button[data-pick]', { hasText: 'Tucker' });
  await expect(tucker).toBeVisible();
  await tucker.click();
  await expect(page.locator('#practice')).toBeVisible();
}

test.describe('a name picked in an earlier session can be picked again', () => {
  test('the name is on the roster and keeps its practice count (FR-300, FR-301)', async ({
    page,
  }) => {
    const f = claimedEarlier({ practice_runs_used: 2 });
    await mockPostgrest(page, f);

    await pickTucker(page);

    await expect(page.locator('#practice')).toContainText('1 left');
  });

  test('a committed score and the attempts it spent come with the name (FR-302)', async ({
    page,
  }) => {
    const f = claimedEarlier({ official_attempts_used: 1 });
    f.scores.push({
      entry_id: ENTRY_ID,
      draft_id: DRAFT_ID,
      attempt_no: 1,
      score: 41234,
      outcome: 'finished',
      commit_at: EARLIER_SESSION,
    });
    await mockPostgrest(page, f);

    await pickTucker(page);

    await expect(page.locator('#official')).toContainText('2 left');
    await expect(page.locator('body')).toContainText('41,234');
  });

  /**
   * Picking and backing out are this device's business alone. A write here
   * would be the claim coming back under another name.
   */
  test('picking and backing out write nothing to the roster', async ({ page }) => {
    const f = claimedEarlier();
    page.on('dialog', (d) => void d.accept());
    await mockPostgrest(page, f);

    await pickTucker(page);
    await page.locator('#not-me').click();
    await expect(page.locator('#new-name')).toBeVisible();

    expect(f.patches).toEqual([]);
  });

  /**
   * FR-307: the name's runs travel with it. A second browser picking the same
   * name later is exactly the "come back on another device" case, and must not
   * be handed back the attempt the first one spent.
   */
  test('an attempt spent in one browser is still spent in the next (FR-307)', async ({
    browser,
  }) => {
    const f = claimedEarlier();

    const first = await browser.newContext();
    const a = await first.newPage();
    await mockPostgrest(a, f);
    await pickTucker(a);
    await a.locator('#official').click();
    await a.locator('#go').click();
    // Spent at the start of the run (FR-234). Walk away mid-run.
    await expect.poll(() => f.patches).toContainEqual({ official_attempts_used: 1 });
    await first.close();

    const second = await browser.newContext();
    const b = await second.newPage();
    await mockPostgrest(b, f);
    await pickTucker(b);

    await expect(b.locator('#official')).toContainText('2 left');
    await second.close();
  });
});
