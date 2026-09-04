import { test, expect } from '@playwright/test';
import { dropIn } from './helpers.js';

/** User Story 3 — the organizer sets up the draft and keeps a separate link. */
test.describe('US3: organizer', () => {
  test('organizer controls are unreachable from the player link (FR-006)', async ({ page }) => {
    await dropIn(page);
    await expect(page.locator('#reset')).toHaveCount(0);
    await expect(page.locator('#save-deadline')).toHaveCount(0);
    await expect(page.locator('[data-remove]')).toHaveCount(0);
  });

  test('organizer controls appear on the organizer link', async ({ page }) => {
    await dropIn(page, '/?organizer=test-secret');
    await expect(page.locator('#reset')).toBeVisible();
    await expect(page.locator('#save-deadline')).toBeVisible();
    await expect(page.locator('[data-remove]').first()).toBeVisible();
  });

  test('the reset warning says there is no undo', async ({ page }) => {
    await dropIn(page, '/?organizer=test-secret');
    await expect(page.locator('.panel').last()).toContainText('destroys every committed score');
    await expect(page.locator('.panel').last()).toContainText('no undo');
  });

  test('removing a committed entry names the score being discarded (FR-074)', async ({ page }) => {
    // Commit a score first.
    await dropIn(page, '/?organizer=test-secret');
    await page.locator('button[data-claim]').first().click();
    await page.locator('#official').click();
    await page.locator('#go').click();
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 90_000 });
    await page.locator('#done').click();

    let dialogText = '';
    page.on('dialog', async (d) => {
      dialogText = d.message();
      await d.dismiss();
    });
    await page.locator('[data-remove]').first().click();
    await expect.poll(() => dialogText).toContain('DISCARD their committed score');
    await expect.poll(() => dialogText).toContain('cannot be undone');
  });

  test('shows who added each entry so a stranger stands out (FR-073)', async ({ page }) => {
    await dropIn(page, '/?organizer=test-secret');
    await page.locator('#new-name').fill('Rando');
    await page.locator('#add-name').click();
    await expect(page.locator('.panel').last()).toContainText('themselves');
  });
});
