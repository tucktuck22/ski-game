import { describe, it, expect } from 'vitest';
import { runTrace, stateHash } from '../../src/sim/run.js';
import { derive, initialState, step } from '../../src/sim/step.js';
import { finalScore } from '../../src/sim/scoring.js';
import type { RunInput } from '../../src/sim/types.js';
import { official, warmup, scoring, tuning } from './fixtures.js';

/**
 * Builds a deterministic input trace from a seed. Not random at run time —
 * the same seed always produces the same trace, which is the point.
 */
export function traceFromSeed(seed: number, ticks: number): RunInput[] {
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
    trace.push({
      crouch,
      rotate: r < 0.12 ? -1 : r > 0.88 ? 1 : 0,
      attack: next() < 0.05,
    });
  }
  return trace;
}

/**
 * The minimum-skill player: base speed, crouch only to clear a low obstacle,
 * never rotate, never attack. This is the pilot SC-015 describes.
 */
function runCautious(course: typeof official, seed: number): ReturnType<typeof runTrace> {
  const derived = derive(tuning);
  let state = initialState(course, tuning, seed);
  const lows = course.obstacles.filter((o) => o.kind === 'low');
  const solids = course.obstacles.filter((o) => o.kind === 'solid');
  const DUCK_LOOKAHEAD = 30;
  const CHARGE_FROM = 90;
  const RELEASE_WITHIN = 34;

  while (state.outcome === 'running' && state.tick < 18_000) {
    const duckNow = lows.some((o) => state.x + DUCK_LOOKAHEAD >= o.x && state.x < o.x + o.width);

    // Solid obstacles are ground blocks: the only way past is over. Charging a
    // crouch on approach and releasing just before the block is the jump, which
    // is the game's core verb rather than a trick. CV-11 guarantees the charge
    // never has to happen inside a tunnel.
    const nextSolid = solids.find((o) => o.x + o.width > state.x);
    const gap = nextSolid ? nextSolid.x - state.x : Infinity;
    const chargingJump = gap < CHARGE_FROM && gap > RELEASE_WITHIN;

    const barrierAhead = course.barriers.some(
      (b, i) =>
        state.barriersBroken[i] === 0 && b.x >= state.x && b.x <= state.x + tuning.attackReach,
    );

    const input: RunInput = {
      crouch: duckNow || chargingJump,
      rotate: 0,
      attack: barrierAhead,
    };
    state = step(state, input, course, tuning, scoring, derived);
  }
  return { state, score: finalScore(state, scoring), ticks: state.tick };
}

describe('golden run (FR-026)', () => {
  it('produces an identical score and state hash on every execution', () => {
    const trace = traceFromSeed(0x5eed, 4000);
    const first = runTrace(official, tuning, scoring, 19860214, trace);
    for (let i = 0; i < 25; i++) {
      const again = runTrace(official, tuning, scoring, 19860214, trace);
      expect(again.score).toBe(first.score);
      expect(again.ticks).toBe(first.ticks);
      expect(stateHash(again.state)).toBe(stateHash(first.state));
    }
  });

  it('differs when the input trace differs', () => {
    const a = runTrace(official, tuning, scoring, 19860214, traceFromSeed(1, 4000));
    const b = runTrace(official, tuning, scoring, 19860214, traceFromSeed(2, 4000));
    expect(stateHash(a.state)).not.toBe(stateHash(b.state));
  });

  it('a cautious base-speed run finishes the official course (SC-015)', () => {
    // The player FR-035 protects: no tuck for speed, no tricks, no attacks.
    // He still has to crouch, because CV-3 makes low obstacles impassable
    // standing - "base speed and crouch-to-duck" is the floor of skill, not
    // zero input. He ducks when a tunnel is close and stands up once past it,
    // which FR-089's safe release window guarantees he can survive.
    const result = runCautious(official, 19860214);
    expect(result.state.wipeoutReason).toBe(null);
    expect(result.state.outcome).toBe('finished');
    expect(result.score).toBeGreaterThan(scoring.completionBase);
  });

  it('the warm-up course is also completable by the cautious pilot', () => {
    const result = runCautious(warmup, 20250901);
    expect(result.state.wipeoutReason).toBe(null);
    expect(result.state.outcome).toBe('finished');
  });

  it('a player who never crouches at all is stopped by a low obstacle, as designed', () => {
    // Confirms CV-3 is doing its job: ducking is required, not optional.
    const neutral: RunInput[] = Array.from({ length: 18_000 }, () => ({
      crouch: false as const,
      rotate: 0 as const,
      attack: false as const,
    }));
    const result = runTrace(official, tuning, scoring, 19860214, neutral);
    expect(result.state.outcome).toBe('wiped_out');
    expect(result.state.wipeoutReason).toBe('struck_obstacle');
  });
});
