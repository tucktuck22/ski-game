import { test, expect } from '@playwright/test';

/**
 * FR-026 and constitution Principle II: the simulation must be bit-identical
 * across devices, because the leaderboard decides where eight people sleep.
 *
 * THIS is the proof. The Vitest golden test runs in Node on V8 alone, so it
 * only shows the run is repeatable on one engine — it cannot detect the
 * cross-engine divergence that the arithmetic restriction in src/sim exists to
 * prevent. Playwright runs this file in Chromium, Firefox AND WebKit, and each
 * must independently reproduce the same committed values.
 *
 * If this fails on one engine and passes on two, something in src/sim reached
 * an implementation-approximated function and the lint rule missed it. The
 * scores would then differ by browser, which is the exact failure Principle V
 * exists to prevent.
 */

interface Result {
  seed: string;
  score: number;
  ticks: number;
  hash: string;
}

/**
 * Golden values, produced in Node and committed. Every engine must match them.
 *
 * If a deliberate physics or tuning change moves these, that is a rules change:
 * bump rulesVersion, because scores under different rules are not comparable
 * (FR-023). Do not "just update the numbers" to make this pass.
 *
 * Last regenerated for rulesVersion 1.3.0, which put rocks and crumbling ice on
 * the upper track. The scores and tick counts are unchanged from 1.2.0 and only
 * the hashes moved, which is exactly right and worth stating: these traces are
 * random input that never gets onto a shelf, so no upper-track hazard touches
 * them — but the state they hash now carries the broken-ice record, so every
 * hash differs. A run where the scores had moved too would mean the new hazards
 * had reached the lower line.
 */
const GOLDEN: Result[] = [
  { seed: '5eed', score: 1501, ticks: 271, hash: 'c49f3182' },
  { seed: '1986', score: 467, ticks: 134, hash: 'f7f32caf' },
  { seed: 'beef', score: 235, ticks: 63, hash: 'd5f81a39' },
];

test('the simulation reproduces the golden run exactly on this engine', async ({
  page,
}, testInfo) => {
  await page.goto('/determinism.html');
  await expect(page.locator('#result')).not.toHaveText('running…', { timeout: 20_000 });

  const results = (await page.evaluate(
    () => (window as unknown as { __determinism: Result[] }).__determinism,
  )) as Result[];

  expect(results, `no results produced on ${testInfo.project.name}`).toHaveLength(GOLDEN.length);

  for (const expected of GOLDEN) {
    const actual = results.find((r) => r.seed === expected.seed);
    expect(actual, `seed ${expected.seed} missing on ${testInfo.project.name}`).toBeDefined();
    // Score and hash are asserted separately: matching scores with differing
    // hashes would mean the engines diverged somewhere that happens not to
    // affect this trace's total, which is still a determinism failure.
    expect(actual!.score, `score for seed ${expected.seed} on ${testInfo.project.name}`).toBe(
      expected.score,
    );
    expect(actual!.ticks, `tick count for seed ${expected.seed} on ${testInfo.project.name}`).toBe(
      expected.ticks,
    );
    expect(actual!.hash, `state hash for seed ${expected.seed} on ${testInfo.project.name}`).toBe(
      expected.hash,
    );
  }
});

test('the harness is actually running the simulation, not returning a cached constant', async ({
  page,
}) => {
  // A harness that silently failed and served a stale value would make the
  // test above pass forever while proving nothing.
  await page.goto('/determinism.html');
  await expect(page.locator('#result')).not.toHaveText('running…', { timeout: 20_000 });
  const results = (await page.evaluate(
    () => (window as unknown as { __determinism: Result[] }).__determinism,
  )) as Result[];

  // Different seeds must produce genuinely different runs.
  const hashes = new Set(results.map((r) => r.hash));
  expect(hashes.size).toBe(results.length);
  expect(results.every((r) => r.ticks > 0)).toBe(true);
});
