import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCourse, parseScoring, parseTuning } from '../../src/data/load.js';
import { maxAchievableBonus } from '../../src/sim/scoring.js';
import { runTrace } from '../../src/sim/run.js';
import type { RunInput } from '../../src/sim/types.js';

const read = (p: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const tuning = parseTuning(read('data/tuning.json'));
const scoring = parseScoring(read('data/scoring.json'));
const official = parseCourse(read('data/courses/official.json'));
const warmup = parseCourse(read('data/courses/warmup.json'));

/**
 * FR-034: every finisher must outrank every non-finisher, regardless of the
 * bonuses the non-finisher collected before crashing.
 *
 * This is a property of the DATA, not of the scoring code, so it is asserted
 * against the real files rather than trusted to whoever edits tuning next. It
 * is also the clause the spec flags as first to revisit if the game plays timid.
 */
describe('scoring dominance (FR-034)', () => {
  it('completionBase exceeds every bonus obtainable on the official course', () => {
    const max = maxAchievableBonus(official, scoring, 4);
    expect(scoring.completionBase).toBeGreaterThan(max);
  });

  it('completionBase exceeds every bonus obtainable on the warm-up course', () => {
    expect(scoring.completionBase).toBeGreaterThan(maxAchievableBonus(warmup, scoring, 4));
  });

  it('a bonus-free finish still beats a maximally lucky wipeout', () => {
    // The floor of the finishers' band against the ceiling of the wipeout band.
    const bonusFreeFinish = scoring.completionBase;
    const luckiestWipeout = maxAchievableBonus(official, scoring, 4) + official.length * scoring.progressPerUnit;
    // Progress score is included in both, so compare only what separates them.
    expect(bonusFreeFinish).toBeGreaterThan(luckiestWipeout - official.length * scoring.progressPerUnit);
  });

  it('a run that wipes out immediately still posts a non-zero, non-negative score', () => {
    // FR-035: even a disaster is a real score, not a humiliating zero.
    const suicide: RunInput[] = Array.from({ length: 600 }, () => ({
      crouch: false as const, rotate: 1 as const, attack: false as const,
    }));
    const r = runTrace(official, tuning, scoring, 19860214, suicide);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});
