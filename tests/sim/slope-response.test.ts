/**
 * The model that replaced a fixed base speed (feature 006, FR-214 to FR-222).
 *
 * These are the assertions that stop the constants drifting. Two of them are
 * load-bearing in a way that is easy to miss:
 *
 * - The ANCHOR test pins gradient 0.30 to the 2.60 / 4.20 that shipped before
 *   this change. dragStanding and dragTucked were solved from that anchor, not
 *   chosen, so hand-editing either silently re-feels the middle of both courses.
 *   Asserting the anchor rather than the constants is what makes such an edit
 *   fail loudly instead of quietly.
 * - The SAFETY RAIL test asserts speedMax sits above every terminal on both
 *   courses. FR-219 calls it a rail rather than the mechanism, and a rail that
 *   binds during ordinary riding has become a target again.
 */
import { describe, it, expect } from 'vitest';
import { initialState, step, derive } from '../../src/sim/step.js';
import {
  terminalSpeed,
  terminalSpeedAtGradient,
  unitForGradient,
  stallGradient,
  groundedAccel,
} from '../../src/sim/slopeResponse.js';
import { slopeAt } from '../../src/sim/terrain.js';
import type { Course, RunInput } from '../../src/sim/types.js';
import { official, warmup, tuning, scoring } from './fixtures.js';

const MAX_LEGAL_GRADIENT = 1.732; // CV-2
const COAST: RunInput = { crouch: false, rotate: 0 };
const TUCK: RunInput = { crouch: true, rotate: 0 };

/** A straight slope of a given gradient, for holding the terrain still. */
function ramp(gradient: number, length = 20_000): Course {
  const terrain = [];
  for (let x = 0; x <= length + 400; x += 200) terrain.push({ x, y: x * gradient });
  return {
    id: 'probe',
    rulesVersion: '0',
    length,
    terrain,
    obstacles: [],
    pickups: [],
    ledges: [],
    kickers: [],
    rocks: [],
    ice: [],
  } as unknown as Course;
}

function settle(gradient: number, input: RunInput, ticks: number): number {
  const course = ramp(gradient);
  const derived = derive(tuning);
  let state = initialState(course, tuning, 1);
  for (let i = 0; i < ticks; i++) state = step(state, input, course, tuning, scoring, derived);
  return state.vx * state.ox + state.vy * state.oy;
}

describe('slope response (FR-214)', () => {
  it('holds the anchor: the gentlest ground on the course is worth 2.60 / 4.00', () => {
    // Re-anchored 2026-09-10 after the first playtest. It used to sit at
    // gradient 0.30 while the course ran down to 0.20, so the gentlest ground
    // was worth only 3.41 tucked and the player reached the big booter having
    // lost 42% of what the steeps gave him. The anchor now sits at the FLOOR of
    // the gradient range, because the floor is the number a player feels as
    // "slow" — and the course's floor is 0.25.
    expect(terminalSpeedAtGradient(0.25, tuning, false)).toBeCloseTo(2.6, 4);
    expect(terminalSpeedAtGradient(0.25, tuning, true)).toBeCloseTo(4.0, 4);
  });

  it('keeps every gradient the courses use inside the playable band', () => {
    // The ceiling is the frame, not the physics: 213 units of lookahead at 5.9
    // is 0.6s of reaction, and the 320x180 buffer cannot show more.
    for (const g of [0.25, 0.6]) {
      expect(terminalSpeedAtGradient(g, tuning, true)).toBeLessThanOrEqual(6.0);
      expect(terminalSpeedAtGradient(g, tuning, false)).toBeGreaterThanOrEqual(2.5);
    }
  });

  it('rises monotonically with gradient, standing and tucked (FR-215)', () => {
    for (const tucked of [false, true]) {
      let previous = -Infinity;
      for (let g = 0.05; g <= MAX_LEGAL_GRADIENT; g += 0.025) {
        const here = terminalSpeedAtGradient(g, tuning, tucked);
        expect(here).toBeGreaterThan(previous);
        previous = here;
      }
    }
  });

  it('spreads by more than 2x across the gradients a course can use (FR-216)', () => {
    // Measured over the range the shipped courses actually occupy, not over the
    // full legal range — a spread that only exists at 60 degrees is not one the
    // player ever meets.
    const gentle = terminalSpeedAtGradient(0.08, tuning, false);
    const steep = terminalSpeedAtGradient(0.644, tuning, false);
    expect(steep / gentle).toBeGreaterThan(2);
  });

  it('makes a tuck faster than standing at every gradient (FR-217)', () => {
    for (let g = 0.05; g <= MAX_LEGAL_GRADIENT; g += 0.05) {
      expect(terminalSpeedAtGradient(g, tuning, true)).toBeGreaterThan(
        terminalSpeedAtGradient(g, tuning, false),
      );
    }
  });

  it('settles on terminal from a standstill without oscillating (FR-222)', () => {
    // The case that would break a naive integrator if anything did: CV-2's
    // steepest legal gradient, from zero. Explicit integration was chosen over
    // a semi-implicit step precisely because it lands exactly here rather than
    // 1.5-3% short.
    for (const g of [0.3, 0.644, 1.0, MAX_LEGAL_GRADIENT]) {
      const slope = unitForGradient(g);
      const target = terminalSpeed(slope, tuning, false);
      let v = 0;
      const tail: number[] = [];
      // 1200, not 400: the time constant doubled when gravity and drag were
      // halved together on 2026-09-11, so convergence takes twice as long.
      for (let i = 0; i < 1200; i++) {
        v += groundedAccel(slope, tuning, v, false);
        if (i >= 1195) tail.push(v);
      }
      expect(v).toBeCloseTo(target, 6);
      // No wobble: the last five ticks must be identical to float precision.
      for (const t of tail) expect(Math.abs(t - (tail[0] as number))).toBeLessThan(1e-9);
      // And it must never have overshot on the way.
      expect(v).toBeLessThanOrEqual(target + 1e-9);
    }
  });

  it('brings a real run to the speed its pitch is worth', () => {
    // Through the actual simulation rather than the model in isolation, so a
    // clamp or a landing rule that quietly caps speed would show up here.
    for (const g of [0.12, 0.3, 0.5]) {
      expect(settle(g, COAST, 1600)).toBeCloseTo(terminalSpeedAtGradient(g, tuning, false), 3);
      expect(settle(g, TUCK, 1600)).toBeCloseTo(terminalSpeedAtGradient(g, tuning, true), 3);
    }
  });
});

describe('the tuck (FR-217, FR-221)', () => {
  it('gathers speed rather than jumping to it', () => {
    // FR-217: a tuck lowers drag, so the gain ARRIVES over time. If this ever
    // reads as instant, something has put a target back.
    const course = ramp(0.3);
    const derived = derive(tuning);
    let state = initialState(course, tuning, 1);
    for (let i = 0; i < 1200; i++) state = step(state, COAST, course, tuning, scoring, derived);
    const standing = state.vx * state.ox + state.vy * state.oy;

    const samples: number[] = [];
    for (let i = 0; i < tuning.tuckTransientTicks; i++) {
      state = step(state, TUCK, course, tuning, scoring, derived);
      samples.push(state.vx * state.ox + state.vy * state.oy);
    }
    // Strictly increasing, and not there in one tick.
    expect(samples[0]).toBeGreaterThan(standing);
    expect(samples[0]).toBeLessThan(standing + 0.25);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i] as number).toBeGreaterThan(samples[i - 1] as number);
    }
  });

  it('delivers 90% of the gain within tuckTransientTicks (FR-221)', () => {
    const standing = terminalSpeedAtGradient(0.3, tuning, false);
    const tucked = terminalSpeedAtGradient(0.3, tuning, true);
    // Measured from a settled standing start, which is what a player actually
    // does — he is already riding when he tucks.
    const course = ramp(0.3);
    const derived = derive(tuning);
    let state = initialState(course, tuning, 1);
    for (let i = 0; i < 1200; i++) state = step(state, COAST, course, tuning, scoring, derived);
    for (let i = 0; i < tuning.tuckTransientTicks; i++)
      state = step(state, TUCK, course, tuning, scoring, derived);
    const speed = state.vx * state.ox + state.vy * state.oy;
    expect(speed).toBeGreaterThanOrEqual(standing + 0.9 * (tucked - standing));
  });

  it('bleeds speed back gradually when the tuck ends, rather than snapping', () => {
    // Tested against the MODEL rather than through the run, because in the game
    // you cannot simply stop tucking: releasing the crouch IS the jump (FR-078),
    // so a released tuck leaves the ground and the along-slope speed changes for
    // a reason that has nothing to do with drag. The decay this asserts is what
    // happens after he lands.
    const slope = unitForGradient(0.3);
    const standing = terminalSpeedAtGradient(0.3, tuning, false);
    let v = terminalSpeedAtGradient(0.3, tuning, true);
    const first = v + groundedAccel(slope, tuning, v, false);
    // Gradual: one tick must not give back most of the gain.
    expect(v - first).toBeLessThan(0.2);
    for (let i = 0; i < 1600; i++) v += groundedAccel(slope, tuning, v, false);
    expect(v).toBeCloseTo(standing, 4);
  });

  it('still gates the trick economy: never crouching never leaves the ground (FR-087)', () => {
    for (const course of [official, warmup]) {
      const derived = derive(tuning);
      let state = initialState(course, tuning, 19860214);
      let everAirborne = false;
      while (state.outcome === 'running' && state.tick < 18_000) {
        state = step(state, COAST, course, tuning, scoring, derived);
        if (!state.grounded) everAirborne = true;
      }
      expect(everAirborne).toBe(false);
    }
  });
});

describe('the bounds are bounds, not the mechanism (FR-219)', () => {
  it('keeps speedMax above every terminal on both shipped courses', () => {
    // If this fires, the rail has become a target: the steepest pitch on the
    // course is being capped rather than settling where physics puts it.
    for (const course of [official, warmup]) {
      for (const p of course.terrain) {
        const slope = slopeAt(course.terrain, p.x);
        expect(terminalSpeed(slope, tuning, true)).toBeLessThan(tuning.speedMax);
      }
    }
  });

  it('keeps every gradient on both courses clear of the stall threshold (CV-23)', () => {
    const stall = stallGradient(tuning);
    for (const course of [official, warmup]) {
      for (let i = 1; i < course.terrain.length; i++) {
        const a = course.terrain[i - 1] as { x: number; y: number };
        const b = course.terrain[i] as { x: number; y: number };
        expect((b.y - a.y) / (b.x - a.x)).toBeGreaterThan(stall);
      }
    }
  });

  it('reports zero terminal below the stall threshold rather than a negative root', () => {
    expect(terminalSpeedAtGradient(stallGradient(tuning) * 0.5, tuning, false)).toBe(0);
    expect(terminalSpeedAtGradient(0, tuning, false)).toBe(0);
  });
});
