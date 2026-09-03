/**
 * Drives a full run from a seed and an input trace.
 *
 * This is the reproducibility surface. Given (course, seed, input trace, rules
 * version) it produces the identical score and the identical end state, which
 * is FR-026 and the clause of Principle V that survives ADR-0004. Replay
 * verification is not built in v1, but this is the function it would use.
 */
import type { Course, RunInput, RunState, Scoring, Tuning } from './types.js';
import { derive, initialState, step } from './step.js';
import { finalScore } from './scoring.js';

export interface RunResult {
  state: RunState;
  score: number;
  ticks: number;
}

/** Hard ceiling so a pathological trace terminates. 5 minutes at 60 Hz. */
export const MAX_TICKS = 18_000;

export function runTrace(
  course: Course,
  tuning: Tuning,
  scoring: Scoring,
  seed: number,
  trace: readonly RunInput[],
  maxTicks = MAX_TICKS,
): RunResult {
  const derived = derive(tuning);
  let state = initialState(course, tuning, seed);
  const hold: RunInput = { crouch: false, rotate: 0 };

  let i = 0;
  while (state.outcome === 'running' && state.tick < maxTicks) {
    // A trace shorter than the run holds neutral input rather than ending it:
    // abandoning a run is not a simulation state (see data-model.md).
    const input = trace[i] ?? hold;
    state = step(state, input, course, tuning, scoring, derived);
    i++;
  }

  return { state, score: finalScore(state, scoring), ticks: state.tick };
}

/**
 * A stable hash of the terminal state. Used by the golden-run test to assert
 * that three browser engines agree on more than just the score.
 *
 * FNV-1a over the state's numeric fields, with floats read as raw bits so a
 * 1-ULP divergence anywhere is caught rather than rounded away.
 */
export function stateHash(s: RunState): string {
  const f64 = new Float64Array(1);
  const u32 = new Uint32Array(f64.buffer);
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    h = Math.imul(h ^ (v & 0xff), 0x01000193) >>> 0;
    h = Math.imul(h ^ ((v >>> 8) & 0xff), 0x01000193) >>> 0;
    h = Math.imul(h ^ ((v >>> 16) & 0xff), 0x01000193) >>> 0;
    h = Math.imul(h ^ ((v >>> 24) & 0xff), 0x01000193) >>> 0;
  };
  const mixFloat = (v: number): void => {
    f64[0] = v;
    mix(u32[0] as number);
    mix(u32[1] as number);
  };

  mix(s.tick);
  for (const v of [
    s.x,
    s.y,
    s.vx,
    s.vy,
    s.ox,
    s.oy,
    s.rotationAccum,
    s.crouchProfile,
    s.maxX,
    s.progress,
    s.spinFromOx,
    s.spinFromOy,
  ])
    mixFloat(v);
  mix(s.score);
  mix(s.crouchCharge);
  mix(s.spinTicksLeft);
  mix(s.spinDir + 1);
  mix(s.rotateHeld + 1);
  mix(s.grounded ? 1 : 0);
  // The track matters: two runs at the same point at the same speed are not the
  // same run if one is on the upper shelf and the other on the piste.
  mix(s.ledge + 1);
  mix(s.outcome === 'finished' ? 1 : s.outcome === 'wiped_out' ? 2 : 0);
  for (const b of s.pickupsTaken) mix(b);
  for (const b of s.iceBroken) mix(b);
  return h.toString(16).padStart(8, '0');
}
