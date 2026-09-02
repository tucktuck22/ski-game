import { describe, it, expect } from 'vitest';
import { derive, initialState, step } from '../../src/sim/step.js';
import { MAX_TICKS } from '../../src/sim/run.js';
import type { RunInput, RunState } from '../../src/sim/types.js';
import { official, warmup, scoring, tuning } from './fixtures.js';

/**
 * FR-062 and Principle II: no input sequence may crash, hang, or soft-lock.
 *
 * This is a pure-function fuzz of step(), which is only possible because the
 * simulation imports nothing from the DOM, storage, or the clock. It runs
 * headless in milliseconds where a browser-driven equivalent would take hours.
 */
const finiteFields = (s: RunState): number[] => [
  s.x,
  s.y,
  s.vx,
  s.vy,
  s.ox,
  s.oy,
  s.rotationAccum,
  s.crouchProfile,
  s.score,
  s.maxX,
];

function fuzzOne(course: typeof official, seed: number): { state: RunState; ticks: number } {
  let r = seed >>> 0;
  const next = (): number => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r / 4294967296;
  };
  const derived = derive(tuning);
  let state = initialState(course, tuning, seed);
  let ticks = 0;
  let crouch = false;

  while (state.outcome === 'running' && ticks < MAX_TICKS) {
    if (next() < 0.15) crouch = !crouch;
    const rv = next();
    const input: RunInput = {
      crouch,
      rotate: rv < 0.2 ? -1 : rv > 0.8 ? 1 : 0,
      attack: next() < 0.1,
    };
    state = step(state, input, course, tuning, scoring, derived);
    ticks++;

    for (const v of finiteFields(state)) {
      if (!Number.isFinite(v)) {
        throw new Error(
          `non-finite state at tick ${state.tick}, seed ${seed}: ${JSON.stringify({
            x: state.x,
            y: state.y,
            vx: state.vx,
            vy: state.vy,
            ox: state.ox,
            oy: state.oy,
          })}`,
        );
      }
    }
  }
  return { state, ticks };
}

describe('monkey fuzz (FR-062)', () => {
  it('survives 3000 randomised runs on the official course with no throw and no non-finite state', () => {
    const outcomes = { finished: 0, wiped_out: 0, running: 0 };
    for (let seed = 1; seed <= 3000; seed++) {
      const { state, ticks } = fuzzOne(official, seed);
      expect(ticks).toBeLessThanOrEqual(MAX_TICKS);
      outcomes[state.outcome]++;
    }
    // Every run must terminate. A run still 'running' at the ceiling would be a
    // soft-lock: the skier stopped making progress but never resolved.
    expect(outcomes.running).toBe(0);
    // Sanity that the fuzz is exercising both paths rather than one.
    expect(outcomes.wiped_out).toBeGreaterThan(0);
  });

  it('survives 1000 randomised runs on the warm-up course', () => {
    for (let seed = 5000; seed < 6000; seed++) {
      const { state } = fuzzOne(warmup, seed);
      expect(state.outcome).not.toBe('running');
    }
  });

  it('never lets speed fall below base or exceed the tuck cap while grounded (FR-077)', () => {
    const derived = derive(tuning);
    for (let seed = 1; seed <= 200; seed++) {
      let r = seed >>> 0;
      const next = (): number => {
        r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
        return r / 4294967296;
      };
      let state = initialState(official, tuning, seed);
      let crouch = false;
      while (state.outcome === 'running' && state.tick < 2000) {
        if (next() < 0.2) crouch = !crouch;
        state = step(
          state,
          { crouch, rotate: 0, attack: false },
          official,
          tuning,
          scoring,
          derived,
        );
        if (state.grounded) {
          const speed = state.vx * state.ox + state.vy * state.oy;
          // There is no brake: FR-077 says the player cannot choose to go slower.
          expect(speed).toBeGreaterThanOrEqual(tuning.baseSpeed - 1e-9);
          expect(speed).toBeLessThanOrEqual(tuning.tuckSpeedMax + 1e-9);
        }
      }
    }
  });

  it('never awards a score for a pickup twice', () => {
    const derived = derive(tuning);
    let state = initialState(official, tuning, 42);
    let crouch = false;
    let r = 42;
    while (state.outcome === 'running' && state.tick < 6000) {
      r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
      if (r / 4294967296 < 0.15) crouch = !crouch;
      state = step(state, { crouch, rotate: 0, attack: true }, official, tuning, scoring, derived);
      for (const b of state.pickupsTaken) expect(b === 0 || b === 1).toBe(true);
    }
  });
});
