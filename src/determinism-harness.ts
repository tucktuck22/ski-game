/**
 * Browser-side determinism harness. Loaded only by determinism.html.
 *
 * Runs the real simulation over a fixed seed and input trace and publishes the
 * score and state hash to the DOM. tests/e2e/determinism.spec.ts reads it in
 * Chromium, Firefox and WebKit and requires all three to match a committed
 * golden value.
 *
 * Three engines agreeing is the proof. The argument that + - * / are correctly
 * rounded is only the reason to expect it.
 */
import { runTrace, stateHash } from './sim/run.js';
import { parseCourse, parseScoring, parseTuning } from './data/load.js';
import type { RunInput } from './sim/types.js';

import tuningJson from '../data/tuning.json';
import scoringJson from '../data/scoring.json';
import officialJson from '../data/courses/official.json';

/** Must stay identical to traceFromSeed() in tests/sim/golden.test.ts. */
function traceFromSeed(seed: number, ticks: number): RunInput[] {
  let s = seed >>> 0;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const trace: RunInput[] = [];
  let crouch = false;
  for (let i = 0; i < ticks; i++) {
    if (next() < 0.06) crouch = !crouch;
    const r = next();
    trace.push({ crouch, rotate: r < 0.12 ? -1 : r > 0.88 ? 1 : 0 });
  }
  return trace;
}

const tuning = parseTuning(tuningJson);
const scoring = parseScoring(scoringJson);
const course = parseCourse(officialJson);

const results = [0x5eed, 0x1986, 0xbeef].map((seed) => {
  const r = runTrace(course, tuning, scoring, 19860214, traceFromSeed(seed, 4000));
  return { seed: seed.toString(16), score: r.score, ticks: r.ticks, hash: stateHash(r.state) };
});

const el = document.getElementById('result');
if (el) el.textContent = JSON.stringify(results);
(window as unknown as { __determinism: typeof results }).__determinism = results;
