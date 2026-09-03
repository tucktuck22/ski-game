import { describe, it, expect } from 'vitest';
import { derive, initialState, step } from '../../src/sim/step.js';
import { TAU } from '../../src/sim/trig.js';
import type { RunInput } from '../../src/sim/types.js';
import { official, scoring, tuning } from './fixtures.js';

/**
 * AC-3 of contracts/tuning-data.md: a full rotation must be achievable from a
 * full-charge launch and NOT from a zero-charge one.
 *
 * The criterion was written when the contract was and never had a test, which
 * is how `rotationRateMax` sat at a value that made it false: 0.115 rad/tick
 * over the ~45 ticks a maximum launch buys is 5.2 radians — four fifths of a
 * turn, so the trick bonus was unreachable by anyone, on any line, ever. Raising
 * the rate is only half the fix; this is the other half.
 */
function launchAndSpin(chargeTicks: number, spinTicks = 400): { rotation: number; score: number } {
  const derived = derive(tuning);
  let s = initialState(official, tuning, 1);

  // Settle onto the slope first, so the launch happens from a known state.
  for (let i = 0; i < 30; i++) {
    s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
  }
  // Charge.
  for (let i = 0; i < chargeTicks; i++) {
    s = step(s, { crouch: true, rotate: 0 }, official, tuning, scoring, derived);
  }
  // Release, then hold the spin for the whole air.
  let peak = 0;
  for (let i = 0; i < spinTicks && s.outcome === 'running'; i++) {
    const input: RunInput = { crouch: false, rotate: 1 };
    s = step(s, input, official, tuning, scoring, derived);
    if (s.rotationAccum > peak) peak = s.rotationAccum;
    if (s.grounded && i > 2) break;
  }
  return { rotation: peak, score: s.score };
}

describe('rotation (AC-3)', () => {
  it('a full-charge launch buys enough air for a complete rotation', () => {
    const { rotation } = launchAndSpin(tuning.chargeTicksToMax);
    expect(rotation).toBeGreaterThan(TAU);
  });

  it('a zero-charge launch does not', () => {
    // The other half of AC-3. Without it, "make rotation faster" has no ceiling
    // and the trick bonus stops being something a launch has to pay for.
    const { rotation } = launchAndSpin(1);
    expect(rotation).toBeLessThan(TAU);
  });

  it('the rate is high enough that a full turn is not a frame-perfect coincidence', () => {
    // Margin, not just the threshold: a full-charge launch should clear one
    // rotation comfortably, or the bonus is technically reachable and
    // practically not — which is where this started.
    const { rotation } = launchAndSpin(tuning.chargeTicksToMax);
    expect(rotation).toBeGreaterThan(TAU * 1.15);
  });
});
