import { test, expect, type Page } from '@playwright/test';
import { dropIn } from './helpers.js';

/**
 * The board panel: the one carrying identity and the run buttons.
 *
 * Not `.panel` first - in a local session that is the "NOT A REAL DRAFT"
 * banner, which is exactly the sort of thing a positional selector picks up by
 * accident.
 */
const board = (page: Page): ReturnType<Page['locator']> =>
  page.locator('.panel', { hasText: 'The leaderboard IS the bed order' });

/**
 * Who this device thinks you are, and who shared storage says you are.
 *
 * FR-021 puts claims in shared storage precisely so that no device gets to
 * decide them. The session key is a convenience for FR-010 - resume without
 * re-selecting - and it had quietly become the answer instead of the hint:
 * once a name was tapped, this device believed it regardless of what the
 * database said afterwards.
 *
 * Two visible failures came out of that, and they are the same bug seen from
 * either end. The organizer's RELEASE - the spec's stated remedy for "a player
 * claims the wrong name" - changed the row and reached nobody. And the player
 * who had mis-tapped had no way back to the roster at all, so the only remedy
 * was the one that did not work.
 */
test.describe('claimed identity follows shared storage, not this device', () => {
  test('an organizer release returns the released player to selection (FR-021)', async ({
    page,
  }) => {
    await dropIn(page, '/?organizer=test-secret');
    await page.locator('#new-name').fill('Rando');
    await page.locator('#add-name').click();
    await expect(board(page)).toContainText('You are');

    const organizer = page.locator('.panel', { hasText: 'ORGANIZER' });
    await organizer.locator('tbody tr', { hasText: 'Rando' }).locator('[data-release]').click();

    // The release must reach the released player, not merely the row.
    await expect(page.locator('#new-name')).toBeVisible();
    await expect(board(page)).not.toContainText('You are Rando');
  });

  test('a released name is claimable again, and the entry survives (FR-021)', async ({ page }) => {
    await dropIn(page, '/?organizer=test-secret');
    await page.locator('#new-name').fill('Rando');
    await page.locator('#add-name').click();

    const organizer = page.locator('.panel', { hasText: 'ORGANIZER' });
    const row = organizer.locator('tbody tr', { hasText: 'Rando' });
    await row.locator('[data-release]').click();

    await expect(row).toContainText('UNCLAIMED');
    // Self-created entries are not deleted by a release - FR-073 keeps them on
    // the board, attributed - so the name is back in the pool rather than gone.
    await expect(page.locator('[data-claim]', { hasText: 'Rando' })).toBeVisible();
  });
});

/**
 * FR-011: a player must be able to re-select his name from the roster.
 *
 * There was no way back. The first name tapped became this device's identity
 * permanently, so a mis-tap could only be undone by an organizer who had to be
 * told about it first - and whose release did not work either.
 */
test.describe('a player can go back and pick again (FR-011)', () => {
  test('NOT YOU? returns to the roster and frees the name', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await dropIn(page);

    const first = page.locator('[data-claim]').first();
    const name = ((await first.textContent()) ?? '').trim();
    await first.click();
    await expect(board(page)).toContainText(`You are ${name}`);

    await page.locator('#not-me').click();

    await expect(page.locator('#new-name')).toBeVisible();
    // Released, not merely forgotten. Forgetting locally would leave the name
    // claimed by nobody: the same dead end, approached from the other side.
    await expect(page.locator('[data-claim]', { hasText: name })).toBeVisible();
  });

  test('the confirmation says the name goes back to everyone', async ({ page }) => {
    let dialogText = '';
    page.on('dialog', async (d) => {
      dialogText = d.message();
      await d.dismiss();
    });
    await dropIn(page);
    await page.locator('[data-claim]').first().click();
    await page.locator('#not-me').click();

    await expect.poll(() => dialogText).toContain('Anyone can claim that name');
    // Dismissed, so nothing changed.
    await expect(page.locator('#not-me')).toBeVisible();
  });

  test('picking again binds the new name, and the old one is free', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await dropIn(page);

    const names = await page.locator('[data-claim]').allTextContents();
    const [wrong, right] = [names[0]!.trim(), names[1]!.trim()];

    await page.locator('[data-claim]', { hasText: wrong }).click();
    await page.locator('#not-me').click();
    await page.locator('[data-claim]', { hasText: right }).click();

    await expect(board(page)).toContainText(`You are ${right}`);
    await expect(board(page)).not.toContainText(`You are ${wrong}`);
  });

  test('after the official run there is no way out: the claim is permanent', async ({ page }) => {
    await dropIn(page);
    await page.locator('[data-claim]').first().click();
    await expect(page.locator('#not-me')).toBeVisible();

    await page.locator('#official').click();
    await page.locator('#go').click();
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 90_000 });
    await page.locator('#done').click();

    // spec.md: "After an official commit, the claim is permanent and the
    // organizer must reset the draft to undo it." A score is already on the
    // board under this name; letting the player walk away from it would leave a
    // result attributed to somebody who is no longer there.
    await expect(page.locator('#not-me')).toHaveCount(0);
    await expect(board(page)).toContainText('committed');
  });
});
