import { test, expect, type Page } from '@playwright/test';
import { dropIn } from './helpers.js';

/**
 * Picking a name, backing out of it, and coming back to it (feature 010).
 *
 * A pick is this device's choice and nothing else's. There is no claim to take
 * or release, so backing out is instant, has nothing to confirm, and can happen
 * at any time outside a run - including after the name has a score.
 *
 * Against the built artifact at its production base path, local backend. The
 * wire-level half (a claim left over from an earlier session, counts carried
 * between browsers) lives in tests/e2e-shared/rejoin.spec.ts.
 */

/** The panel carrying identity and the run buttons, not the local-mode banner. */
const board = (page: Page): ReturnType<Page['locator']> =>
  page.locator('.panel', { hasText: 'The leaderboard IS the bed order' });

const picks = (page: Page): ReturnType<Page['locator']> => page.locator('button[data-pick]');

async function pickFirst(page: Page): Promise<string> {
  const first = picks(page).first();
  const name = ((await first.textContent()) ?? '').trim();
  await first.click();
  await expect(board(page)).toContainText(`You are ${name}`);
  return name;
}

test.describe('backing out of a name (US2)', () => {
  test('NOT YOU? returns to the roster at once, with no dialog (FR-304)', async ({ page }) => {
    page.on('dialog', () => {
      throw new Error('backing out must not ask for confirmation');
    });
    await dropIn(page, './');
    const name = await pickFirst(page);

    await page.locator('#not-me').click();

    await expect(page.locator('#new-name')).toBeVisible();
    await expect(picks(page).filter({ hasText: name })).toBeVisible();
  });

  test('picking again binds the new name', async ({ page }) => {
    await dropIn(page, './');
    const names = (await picks(page).allTextContents()).map((n) => n.trim());
    const [wrong, right] = [names[0]!, names[1]!];

    await picks(page).filter({ hasText: wrong }).click();
    await page.locator('#not-me').click();
    await picks(page).filter({ hasText: right }).click();

    await expect(board(page)).toContainText(`You are ${right}`);
    await expect(board(page)).not.toContainText(`You are ${wrong}`);
  });

  /**
   * FR-303. This used to be the one moment a player could NOT back out: the
   * claim became permanent at the first commit. With no claim, walking away from
   * a name leaves its score exactly where it is, so there is nothing to protect.
   */
  test('backing out is allowed after a committed attempt, and the name keeps it (FR-303)', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await dropIn(page, './');
    const name = await pickFirst(page);

    await page.locator('#official').click();
    await page.locator('#go').click();
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 90_000 });
    await page.locator('#done').click();

    await expect(page.locator('#not-me')).toBeVisible();
    await page.locator('#not-me').click();
    await expect(picks(page).filter({ hasText: name })).toBeVisible();

    await picks(page).filter({ hasText: name }).click();
    await expect(page.locator('#official')).toContainText('2 left');
  });

  test('no board or panel calls a name claimed, and there is no RELEASE (FR-308, FR-309)', async ({
    page,
  }) => {
    await dropIn(page, './?organizer=test-secret');
    await expect(page.locator('.panel', { hasText: 'ORGANIZER' })).toBeVisible();

    await expect(page.locator('body')).not.toContainText(/\bUN?CLAIMED\b/);
    await expect(page.locator('[data-release]')).toHaveCount(0);
  });
});
