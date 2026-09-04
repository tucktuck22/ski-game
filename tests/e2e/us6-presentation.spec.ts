import { test, expect } from '@playwright/test';
import { dropIn } from './helpers.js';

/** User Story 6 — the 1986 layer, without losing legibility or accessibility. */
test.describe('US6: presentation and accessibility', () => {
  test('no audio plays before a deliberate gesture (FR-054)', async ({ page }) => {
    await dropIn(page);
    // No AudioContext may exist before the player touches anything.
    const beforeGesture = await page.evaluate(
      () => (window as unknown as { __ac?: number }).__ac ?? 0,
    );
    expect(beforeGesture).toBe(0);
    await expect(page.locator('#mute')).toBeVisible();
  });

  test('a persistent mute toggle is available and reversible (FR-054)', async ({ page }) => {
    await dropIn(page);
    await expect(page.locator('#mute')).toContainText('SOUND ON');
    await page.locator('#mute').click();
    await expect(page.locator('#mute')).toContainText('SOUND OFF');
    await page.locator('#mute').click();
    await expect(page.locator('#mute')).toContainText('SOUND ON');
  });

  test('reduced motion is toggleable and the run stays fully playable (FR-056)', async ({
    page,
  }) => {
    await dropIn(page);
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
    await dropIn(page);
    await page.locator('#motion').click();
    await page.reload();
    // The title screen is shown again after a reload, so drop in a second time to
    // reach the board where the toggle lives (FR-151).
    await page.locator('#drop-in').click();
    await expect(page.locator('#motion')).toContainText('REDUCED MOTION');
  });

  test('a wipeout shows a randomised insult in text, not only in audio (FR-058, FR-059)', async ({
    page,
  }) => {
    await dropIn(page);
    await page.locator('button[data-claim]').first().click();
    await page.locator('#practice').click();
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 90_000 });
    const headline = await page.locator('.sfx').textContent();
    if (headline?.includes('WIPEOUT')) {
      // The outcome is carried by visible text, so muting loses nothing.
      await expect(page.locator('.subtitle')).not.toBeEmpty();
    }
  });

  test('a wipeout holds the mountain before it shows the results (FR-131)', async ({ page }) => {
    // A player who never crouches is stopped by the first bough — the case
    // tests/sim/golden.test.ts pins down — so this needs no input at all to
    // produce a death.
    await dropIn(page);
    await page.locator('button[data-claim]').first().click();
    await page.locator('#practice').click();
    await expect(page.locator('#screen')).toBeVisible();

    const died = page.locator('.you-died');
    await expect(died).toBeVisible({ timeout: 90_000 });

    // The whole point: the run is over and the mountain is still on screen.
    // Before FR-131 this frame did not exist — the results panel replaced the
    // canvas on the tick the run ended.
    await expect(page.locator('#screen')).toBeVisible();
    await expect(died).toContainText('YOU DIED');
    await expect(page.locator('.panel')).toHaveCount(0);

    // And it does end, rather than stranding the player on his own corpse.
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 15_000 });
  });

  test('a wipeout can be skipped by anyone who has seen it before', async ({ page }) => {
    await dropIn(page);
    await page.locator('button[data-claim]').first().click();
    await page.locator('#practice').click();
    await expect(page.locator('.you-died')).toBeVisible({ timeout: 90_000 });
    await page.keyboard.press('Enter');
    await expect(page.locator('.sfx')).toBeVisible({ timeout: 3_000 });
  });

  test('the deadline is shown so nobody has to guess how long is left', async ({ page }) => {
    await dropIn(page);
    await expect(page.locator('.row').first()).toContainText(/left|FINAL/);
  });
});
