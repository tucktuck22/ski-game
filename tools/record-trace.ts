/**
 * Records a measuring pilot's inputs so the built game can be driven along the
 * same line (feature 009, research R8; tests/e2e-build/finish.spec.ts).
 *
 *   npx vite-node tools/record-trace.ts
 *
 * Writes tests/e2e-build/fixtures/warmup-tuck.json: run-length encoded rows of
 * [ticks, crouch (0|1), rotate (-1|0|1)], one row per stretch of identical
 * input, plus the ride's outcome, tick count and score for the test to check
 * against. Regenerate whenever the warm-up course, tuning or the pilots change;
 * the test fails loudly on a stale trace rather than passing on one.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoring, warmup } from '../tests/sim/fixtures.js';
import { ride } from '../tests/sim/pilots.js';
import { finalScore } from '../src/sim/scoring.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows: [number, 0 | 1, -1 | 0 | 1][] = [];
const out = ride(warmup, 'tuck', 1, (_b, _a, input) => {
  const crouch = input.crouch ? 1 : 0;
  const last = rows[rows.length - 1];
  if (last && last[1] === crouch && last[2] === input.rotate) last[0] += 1;
  else rows.push([1, crouch, input.rotate]);
});

const trace = {
  course: warmup.id,
  rulesVersion: warmup.rulesVersion,
  pilot: 'tuck',
  outcome: out.state.outcome,
  ticks: out.state.tick,
  score: finalScore(out.state, scoring),
  rows,
};
const path = join(root, 'tests/e2e-build/fixtures/warmup-tuck.json');
writeFileSync(path, JSON.stringify(trace) + '\n');
console.log(
  `${path}: ${rows.length} rows, ${trace.ticks} ticks, ${trace.outcome}, score ${trace.score}`,
);
