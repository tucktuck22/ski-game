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

/**
 * What the upper track multiplies, and by how much.
 *
 * One number for both halves of the reward on purpose. Distance covered up
 * there and tricks thrown from up there are the same bet paying out, and two
 * separate constants would let them drift apart into two rules a player has to
 * hold in his head at once.
 */
export const UPPER_TRACK_MULTIPLIER = 2;

export const pickupValue = (s: Scoring, p: Pickup): number =>
  p.value === 'large' ? s.pickupLarge : s.pickupSmall;

/**
 * Progress score, from the distance already credited in RunState.progress.
 *
 * It used to be computed here from maxX. It cannot be any more: the upper track
 * pays double for the same ground (FR-094), so what a run earned depends on
 * where it was ridden, and only the simulation knows that. The farming
 * protection did not move with it - step() credits newly covered ground only.
 */
export const progressScore = (s: Scoring, progress: number): number =>
  Math.floor(progress * s.progressPerUnit);

/**
 * Trick score for a cleanly landed air. Partial rotations pay nothing.
 *
 * The multiplier is the one in force for the AIR, not for the ground he happens
 * to touch down on: a trick thrown off the upper track pays double even when it
 * ends on the piste, which is what makes launching off a shelf worth doing.
 */
export const trickScore = (s: Scoring, rotationAccum: number, multiplier: number): number =>
  Math.floor(rotationAccum / TAU) * s.trickPerRotation * multiplier;

/**
 * The maximum a single run could possibly earn in bonuses — every pickup and a
 * generous ceiling on tricks. Used to prove FR-034 holds.
 */
export function maxAchievableBonus(course: Course, s: Scoring, trickCeiling: number): number {
  let total = 0;
  for (const p of course.pickups) total += pickupValue(s, p);
  // Tricks are worth double off the upper track, so the ceiling is too.
  total += trickCeiling * s.trickPerRotation * UPPER_TRACK_MULTIPLIER;
  return total;
}

/** Final score for a completed run. */
export function finalScore(state: RunState, s: Scoring): number {
  const base = state.outcome === 'finished' ? s.completionBase : 0;
  return base + state.score + progressScore(s, state.progress);
}
