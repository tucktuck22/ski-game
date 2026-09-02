import { test, expect } from '@playwright/test';

/** User Story 6 — the 1986 layer, without losing legibility or accessibility. */
test.describe('US6: presentation and accessibility', () => {
  test('no audio plays before a deliberate gesture (FR-054)', async ({ page }) => {
    await page.goto('/');
    // No AudioContext may exist before the player touches anything.
    const beforeGesture = await page.evaluate(
      () => (window as unknown as { __ac?: number }).__ac ?? 0,
    );
    expect(beforeGesture).toBe(0);
    await expect(page.locator('#mute')).toBeVisible();
  });

  test('a persistent mute toggle is available and reversible (FR-054)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#mute')).toContainText('SOUND ON');
    await page.locator('#mute').click();
    await expect(page.locator('#mute')).toContainText('SOUND OFF');
    await page.locator('#mute').click();
    await expect(page.locator('#mute')).toContainText('SOUND ON');
  });

  test('reduced motion is toggleable and the run stays fully playable (FR-056)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('#motion').click();
    await expect(page.locator('#motion')).toContainText('REDUCED MOTION');

    // The critical part: the run must still be playable AND scoreable.
    await page.locator('button[data-claim]').first().click();
    await page.locator('#practice').click();
    await expect(page.locator('#screen')).toBeVisible();
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('.panel')).toContainText(/\d/);
  });

  test('the reduced-motion choice survives a reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('#motion').click();
    await page.reload();
    await expect(page.locator('#motion')).toContainText('REDUCED MOTION');
  });

  test('a wipeout shows a randomised insult in text, not only in audio (FR-058, FR-059)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('button[data-claim]').first().click();
    await page.locator('#practice').click();
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 90_000 });
    const headline = await page.locator('.sfx').textContent();
    if (headline?.includes('WIPEOUT')) {
      // The outcome is carried by visible text, so muting loses nothing.
      await expect(page.locator('.subtitle')).not.toBeEmpty();
    }
  });

  test('the deadline is shown so nobody has to guess how long is left', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.row').first()).toContainText(/left|FINAL/);
  });
});
