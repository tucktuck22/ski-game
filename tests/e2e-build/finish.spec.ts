import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { dropIn } from './helpers.js';

/**
 * The finish, on the built artifact (feature 009, contract E1, Principle VI).
 *
 * No other test reaches a finish: the wipeout tests rely on the crash that
 * doing nothing produces, and a finish takes forty seconds of skilled input.
 * So this drives a real practice run along a measuring pilot's recorded line
 * (tools/record-trace.ts), one simulation tick at a time on Playwright's clock,
 * reading the game's tick through the automation-only seam in main.ts. The
 * simulation is deterministic and ignores its seed today, so the same inputs on
 * the same ticks reach the line exactly as the pilot did.
 *
 * IF THE REPLAY FAILS TO REACH THE LINE, THAT IS A FINDING, NOT FLAKE: either the
 * trace is stale (regenerate it) or the build's simulation no longer matches the
 * one the pilots ride, which is worse. Never skip this test.
 */

interface Trace {
  course: string;
  outcome: string;
  ticks: number;
  score: number;
  rows: [number, 0 | 1, -1 | 0 | 1][];
}

const here = dirname(fileURLToPath(import.meta.url));
const trace = JSON.parse(readFileSync(join(here, 'fixtures/warmup-tuck.json'), 'utf8')) as Trace;

/** Input for the step that produces tick i+1, indexed by i. */
const inputs: { crouch: boolean; rotate: number }[] = trace.rows.flatMap(([n, c, r]) =>
  Array.from({ length: n }, () => ({ crouch: c === 1, rotate: r })),
);

const tickOf = (page: Page): Promise<number | null> =>
  page.evaluate(() => (window as unknown as { __shredRunTick: number | null }).__shredRunTick);

/** One display frame at 60 Hz. Never runs more than one simulation tick. */
const FRAME_MS = 16;

test('E1: a finished run holds on the mountain, lettered, then wipes to the results', async ({
  page,
}) => {
  test.setTimeout(300_000);
  expect(trace.outcome, 'the recorded ride must itself finish').toBe('finished');

  await page.clock.install();
  await dropIn(page, './');
  await page.locator('button[data-claim]').first().click();
  await expect(page.locator('#practice')).toBeVisible();

  // Stop time before the run exists, so every tick is taken by hand.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
  await page.locator('#practice').click();
  await expect(page.locator('#screen')).toBeVisible();

  let crouch = false;
  let rotate = 0;
  const hold = async (want: { crouch: boolean; rotate: number }): Promise<void> => {
    if (want.crouch !== crouch) {
      await (want.crouch ? page.keyboard.down('Space') : page.keyboard.up('Space'));
      crouch = want.crouch;
    }
    if (want.rotate !== rotate) {
      if (rotate === -1) await page.keyboard.up('ArrowLeft');
      if (rotate === 1) await page.keyboard.up('ArrowRight');
      if (want.rotate === -1) await page.keyboard.down('ArrowLeft');
      if (want.rotate === 1) await page.keyboard.down('ArrowRight');
      rotate = want.rotate;
    }
  };

  let tick = (await tickOf(page)) ?? 0;
  for (let frames = 0; tick < trace.ticks; frames++) {
    expect(frames, `stalled at tick ${tick}`).toBeLessThan(trace.ticks * 2);
    await hold(inputs[tick] ?? inputs[inputs.length - 1]!);
    await page.clock.runFor(FRAME_MS);
    const t = await tickOf(page);
    expect(t, 'the run ended before the recorded line did').not.toBeNull();
    tick = t!;
    // A wipeout means the replay diverged from the pilot. Say where.
    if (await page.locator('.you-died').count()) {
      throw new Error(`the replay wiped out at tick ${tick}; the pilot finished at ${trace.ticks}`);
    }
  }

  // Across the line, with tuck still held (the pilot's last stretch is crouched).
  expect(crouch, 'the pilot should cross holding tuck, which is the case FR-268 guards').toBe(true);
  await page.clock.runFor(FRAME_MS * 2);
  const finished = page.locator('.finished');
  await expect(finished).toBeVisible();
  await expect(finished).toContainText('FINISH!');

  // FR-268: the held key's repeats are not a skip. Playwright sends a repeat for
  // a key that is already down.
  await page.keyboard.down('Space');
  await page.clock.runFor(1000);
  await expect(finished, 'a held key skipped the finish').toBeVisible();
  await expect(page.locator('.panel.wipe-in')).toHaveCount(0);

  // FR-266: the hold ends by itself, no longer than the wipeout's 2.6 s.
  await page.clock.runFor(2000);
  const panel = page.locator('.panel.wipe-in');
  await expect(panel, 'the results did not arrive by the panel wipe (FN-4)').toBeVisible();
  await expect(panel.locator('h2')).toHaveText('FINISHED');
  await expect(panel).toContainText(trace.score.toLocaleString('en-US'));
  await page.keyboard.up('Space');
});
