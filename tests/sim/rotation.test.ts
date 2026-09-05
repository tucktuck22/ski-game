import { describe, it, expect } from 'vitest';
import { derive, initialState, step } from '../../src/sim/step.js';
import { TAU } from '../../src/sim/trig.js';
import type { RunState } from '../../src/sim/types.js';
import { official, scoring, tuning } from './fixtures.js';

/**
 * FR-124: rotation is a committed animation, not a rate the player steers.
 *
 * One press starts one whole turn. It runs for exactly `spinDurationTicks` and
 * cannot be stopped, reversed or shortened, and touching down before it
 * finishes ends the run. So the question the player answers is binary — is
 * there time? — where the old free-rotation model asked him to judge a
 * continuous angle at 320x180 at speed, and the correct answer was usually
 * "don't".
 */

interface Attempt {
  state: RunState;
  airTicks: number;
}

/**
 * Settle, charge for `chargeTicks`, release, then press rotate once after
 * `delay` ticks of air. Returns when the skier next touches down.
 */
function attempt(chargeTicks: number, delay: number, dir: 1 | -1 = 1): Attempt {
  const derived = derive(tuning);
  let s = initialState(official, tuning, 1);
  const go = (crouch: boolean, rotate: -1 | 0 | 1): void => {
    s = step(s, { crouch, rotate }, official, tuning, scoring, derived);
  };

  for (let i = 0; i < 30; i++) go(false, 0);
  for (let i = 0; i < chargeTicks; i++) go(true, 0);
  go(false, 0); // the release IS the launch (FR-078)

  let airTicks = 1;
  let pressed = false;
  while (s.outcome === 'running' && airTicks < 400) {
    const press = !pressed && airTicks >= delay;
    go(false, press ? dir : 0);
    if (press) pressed = true;
    if (s.grounded) break;
    airTicks++;
  }
  return { state: s, airTicks };
}

describe('the committed spin (FR-124)', () => {
  it('scores exactly one rotation, never a fraction and never two', () => {
    const { state } = attempt(tuning.chargeTicksToMax, 1);
    expect(state.outcome).toBe('running');
    expect(state.score).toBe(scoring.trickPerRotation);
  });

  it('ends the run when the skier touches down mid-turn', () => {
    // The bargain. A spin started too late to finish is not a partial trick and
    // not a scruffy landing — it is the run.
    const { state } = attempt(1, 12);
    expect(state.outcome).toBe('wiped_out');
    expect(state.wipeoutReason).toBe('spun_out');
  });

  it('finishes facing exactly where it started, in both directions', () => {
    // A whole turn that ended a fraction off would leave every trick with a
    // little rotation error, and a player who landed several would fail an
    // alignment check for reasons he could neither see nor control.
    for (const dir of [1, -1] as const) {
      const derived = derive(tuning);
      let s = initialState(official, tuning, 1);
      for (let i = 0; i < 30; i++) {
        s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
      }
      for (let i = 0; i < tuning.chargeTicksToMax; i++) {
        s = step(s, { crouch: true, rotate: 0 }, official, tuning, scoring, derived);
      }
      s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
      const before = { ox: s.ox, oy: s.oy };

      s = step(s, { crouch: false, rotate: dir }, official, tuning, scoring, derived);
      expect(s.spinTicksLeft).toBeGreaterThan(0);
      while (s.spinTicksLeft > 0 && s.outcome === 'running') {
        s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
      }
      expect(s.ox).toBe(before.ox);
      expect(s.oy).toBe(before.oy);
      expect(s.rotationAccum).toBe(TAU);
    }
  });

  it('takes exactly the tuned number of ticks', () => {
    const derived = derive(tuning);
    let s = initialState(official, tuning, 1);
    for (let i = 0; i < 30; i++) {
      s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
    }
    for (let i = 0; i < tuning.chargeTicksToMax; i++) {
      s = step(s, { crouch: true, rotate: 0 }, official, tuning, scoring, derived);
    }
    s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);

    s = step(s, { crouch: false, rotate: 1 }, official, tuning, scoring, derived);
    let ticks = 1;
    while (s.spinTicksLeft > 0) {
      s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
      ticks++;
    }
    expect(ticks).toBe(tuning.spinDurationTicks);
  });

  it('does not chain while the key is held', () => {
    // Held input would restart a spin the instant one finished, so the last one
    // is always incomplete on landing and holding the key becomes a way to die.
    const derived = derive(tuning);
    let s = initialState(official, tuning, 1);
    for (let i = 0; i < 30; i++) {
      s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
    }
    for (let i = 0; i < tuning.chargeTicksToMax; i++) {
      s = step(s, { crouch: true, rotate: 0 }, official, tuning, scoring, derived);
    }
    s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);

    // Hold it down for the whole flight.
    while (s.outcome === 'running' && !s.grounded) {
      s = step(s, { crouch: false, rotate: 1 }, official, tuning, scoring, derived);
    }
    expect(s.outcome).toBe('running');
    expect(s.score).toBe(scoring.trickPerRotation);
  });

  it('lets a big launch bank two, and has no air left for a third', () => {
    // The skill ceiling of a CROUCH release, which is deliberately modest: the
    // base jump was halved (launchImpulseMax 7.2 -> 5.0) so it could no longer
    // put a skier on a shelf without a ramp. Thirty ticks of air is exactly two
    // spins. A third cannot be started at all now rather than being started and
    // punished - the greed trap lives on the ramps and booters, where the air is
    // long enough to tempt someone into it.
    const derived = derive(tuning);
    const fly = (maxSpins: number): RunState => {
      let s = initialState(official, tuning, 1);
      const go = (c: boolean, r: -1 | 0 | 1): void => {
        s = step(s, { crouch: c, rotate: r }, official, tuning, scoring, derived);
      };
      for (let i = 0; i < 30; i++) go(false, 0);
      for (let i = 0; i < tuning.chargeTicksToMax; i++) go(true, 0);
      go(false, 0);
      let started = 0;
      while (s.outcome === 'running' && !s.grounded) {
        const press = started < maxSpins && s.spinTicksLeft === 0 && s.rotateHeld === 0;
        go(false, press ? 1 : 0);
        if (press) started++;
      }
      return s;
    };

    const disciplined = fly(2);
    expect(disciplined.outcome).toBe('running');
    expect(disciplined.score).toBe(2 * scoring.trickPerRotation);

    // A third never gets off the ground: the second spin completes on the last
    // tick of the air, so there is no moment at which a third could be pressed.
    // He banks the two he landed rather than losing them.
    const greedy = fly(3);
    expect(greedy.outcome).toBe('running');
    expect(greedy.score).toBe(2 * scoring.trickPerRotation);
  });

  it('cannot be started from the ground', () => {
    const derived = derive(tuning);
    let s = initialState(official, tuning, 1);
    for (let i = 0; i < 40; i++) {
      s = step(s, { crouch: false, rotate: 1 }, official, tuning, scoring, derived);
      expect(s.spinTicksLeft).toBe(0);
    }
    expect(s.rotationAccum).toBe(0);
  });
});

/**
 * AC-3 of contracts/tuning-data.md, restated for the committed model.
 *
 * The original criterion — a full rotation is achievable from a full-charge
 * launch and NOT from a zero-charge one — was written when rotation was a rate,
 * and it no longer describes anything true: a quarter-second spin fits inside
 * the ~21 ticks a zero-charge launch buys, so the smallest jump in the game can
 * land a trick if the player commits at once.
 *
 * What survives is the intent: a trick must be paid for. It is now paid for in
 * risk and in timing rather than in charge. A big launch is forgiving about
 * WHEN the spin starts; a small one gives a window of a few ticks and kills
 * anyone who misses it.
 */
describe('a trick is paid for in timing (AC-3, restated)', () => {
  it('a full-charge launch is forgiving about when the spin starts', () => {
    // Fifteen ticks of latitude, down from thirty: halving the base jump halved
    // the air it buys, so the window narrowed with it. It is still an order
    // wider than the zero-charge launch's, which is what AC-3 is about.
    for (const delay of [1, 5, 10, 15]) {
      const { state } = attempt(tuning.chargeTicksToMax, delay);
      expect(state.outcome, `delay ${delay}`).toBe('running');
      expect(state.score, `delay ${delay}`).toBe(scoring.trickPerRotation);
    }
  });

  it('a zero-charge launch is not', () => {
    const early = attempt(1, 1);
    expect(early.state.outcome).toBe('running');
    expect(early.state.score).toBe(scoring.trickPerRotation);

    const late = attempt(1, 8);
    expect(late.state.outcome).toBe('wiped_out');
    expect(late.state.wipeoutReason).toBe('spun_out');
  });
});
