/**
 * Score accumulation.
 *
 * The dominance property (FR-034) lives in the DATA, not here: completionBase
 * must exceed the maximum achievable bonus total so that every finisher outranks
 * every non-finisher. tests/unit/scoring-dominance.test.ts asserts it against the
 * real course files rather than trusting the tuning author.
 */
import type { Course, RunState, Scoring, Pickup } from './types.js';
import { TAU } from './trig.js';

export const pickupValue = (s: Scoring, p: Pickup): number =>
  p.value === 'large' ? s.pickupLarge : s.pickupSmall;

/** Progress score, computed from furthest x reached so it cannot be farmed. */
export const progressScore = (s: Scoring, maxX: number): number =>
  Math.floor(maxX * s.progressPerUnit);

/** Trick score for a cleanly landed air. Partial rotations pay nothing. */
export const trickScore = (s: Scoring, rotationAccum: number): number =>
  Math.floor(rotationAccum / TAU) * s.trickPerRotation;

/**
 * The maximum a single run could possibly earn in bonuses — every pickup, every
 * barrier, and a generous ceiling on tricks. Used to prove FR-034 holds.
 */
export function maxAchievableBonus(course: Course, s: Scoring, trickCeiling: number): number {
  let total = 0;
  for (const p of course.pickups) total += pickupValue(s, p);
  total += course.barriers.length * s.barrierBroken;
  total += trickCeiling * s.trickPerRotation;
  return total;
}

/** Final score for a completed run. */
export function finalScore(state: RunState, s: Scoring): number {
  const base = state.outcome === 'finished' ? s.completionBase : 0;
  return base + state.score + progressScore(s, state.maxX);
}
