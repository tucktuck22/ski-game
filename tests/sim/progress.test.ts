import { describe, it, expect } from 'vitest';
import { derive, initialState, step, UPPER_TRACK_MULTIPLIER } from '../../src/sim/step.js';
import { MAX_TICKS } from '../../src/sim/run.js';
import { ride } from './pilots.js';
import { official, scoring, tuning, warmup } from './fixtures.js';

/**
 * FR-094: the upper track pays double for the same ground, and only for ground
 * the player has not already covered.
 *
 * The second half is the one that needs defending. Feature 001 computes
 * progress from the furthest point reached specifically so that a player cannot
 * farm it by skiing back and forth; a rate multiplier applied per unit
 * travelled would have quietly undone that. The bound asserted here —
 * `maxX <= progress <= 2 * maxX` — is that protection restated for a world with
 * two tracks in it, and it holds for any input whatsoever, not just for the
 * pilots below.
 */
const boundsHold = (progress: number, maxX: number): boolean =>
  progress >= maxX - 1e-9 && progress <= UPPER_TRACK_MULTIPLIER * maxX + 1e-9;

describe('progress accrual (FR-094)', () => {
  it('a pilot who never leaves the piste is credited exactly the ground he covered', () => {
    // The control. Without it, a doubled rate that fired everywhere would still
    // satisfy every other assertion in this file.
    const { state } = ride(official, 'stay-low', 1);
    expect(state.outcome).toBe('finished');
    expect(state.progress).toBeCloseTo(state.maxX, 6);
  });

  it('a pilot who rides the shelves is credited more than the ground he covered', () => {
    const { state } = ride(official, 'tuck', 1);
    expect(state.outcome).toBe('finished');
    expect(state.progress).toBeGreaterThan(state.maxX);
  });

  it('and never more than double it, however the shelves were ridden (SC-027)', () => {
    for (const pilot of ['tuck', 'stay-low'] as const) {
      for (const course of [official, warmup]) {
        const { state } = ride(course, pilot, 1);
        expect(boundsHold(state.progress, state.maxX)).toBe(true);
      }
    }
  });

  it('holds the bound under 400 randomised runs, not just the scripted ones', () => {
    // The scripted pilots above only ever travel forward. This is the one that
    // would catch a multiplier credited per tick rather than per new unit of
    // ground — the shape of the farming bug FR-094 exists to prevent.
    const derived = derive(tuning);
    for (let seed = 1; seed <= 400; seed++) {
      let r = seed >>> 0;
      const next = (): number => {
        r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
        return r / 4294967296;
      };
      let s = initialState(official, tuning, seed);
      let crouch = false;
      while (s.outcome === 'running' && s.tick < MAX_TICKS) {
        if (next() < 0.15) crouch = !crouch;
        const rv = next();
        s = step(
          s,
          { crouch, rotate: rv < 0.2 ? -1 : rv > 0.8 ? 1 : 0 },
          official,
          tuning,
          scoring,
          derived,
        );
        if (!boundsHold(s.progress, s.maxX)) {
          throw new Error(
            `progress ${s.progress} out of bounds for maxX ${s.maxX} at tick ${s.tick}, seed ${seed}`,
          );
        }
      }
    }
  });
});
