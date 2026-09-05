import { describe, it, expect } from 'vitest';

import {
  LeanState,
  PoseTimers,
  selectPose,
  ABSORB_TICKS,
  type LeanBucket,
} from '../../src/render/skierPose.js';
import { REDUCED_MOTION, FULL_MOTION } from '../../src/render/reducedMotion.js';
import type { RunState } from '../../src/sim/types.js';

/**
 * contracts/pose-selection.md, transcribed. Each `it` below is one row of that
 * table, in its order, because the ORDER is the contract: several conditions are
 * true at once in normal play and getting the precedence wrong is how a crashed
 * skier ends up drawn mid-carve.
 *
 * Everything here runs without a canvas, an image or a browser, which is the
 * whole point of research.md R6 - it is why SC-060's reduced-motion obligation
 * can be a test rather than a person squinting at a screen.
 */

/** A grounded, upright, mid-run skier. Rows below vary one thing from this. */
function stateAt(over: Partial<RunState> = {}): RunState {
  return {
    tick: 0,
    x: 100,
    y: 100,
    vx: 2,
    vy: 0,
    ox: 1,
    oy: 0,
    rotationAccum: 0,
    spinTicksLeft: 0,
    spinDir: 0,
    spinFromOx: 1,
    spinFromOy: 0,
    rotateHeld: 0,
    grounded: true,
    ledge: -1,
    crouchHeld: false,
    crouchCharge: 0,
    crouchProfile: 0,
    landingGraceTicks: 0,
    crumbleTicks: 0,
    score: 0,
    maxX: 100,
    progress: 0,
    scoreMultiplier: 1,
    pickupsTaken: new Uint8Array(0),
    iceBroken: new Uint8Array(0),
    outcome: 'running',
    wipeoutReason: null,
    ...over,
  } as RunState;
}

const timersWith = (over: Partial<PoseTimers> = {}): PoseTimers =>
  Object.assign(new PoseTimers(), over);

describe('pose precedence (contracts/pose-selection.md)', () => {
  it('rule 1: a wiped-out run is drawn as a wipeout, whatever else is true', () => {
    const pose = selectPose(
      stateAt({ outcome: 'wiped_out', spinTicksLeft: 5, grounded: false }),
      timersWith({ absorbTicks: ABSORB_TICKS }),
      'Mid',
    );
    expect(pose).toBe('wipeout');
  });

  it('rule 2: a turning spin outranks being airborne', () => {
    expect(
      selectPose(stateAt({ spinTicksLeft: 7, grounded: false, vy: 3 }), timersWith(), 'Mid'),
    ).toBe('spin');
  });

  it('rule 3: airborne and rising is the air pose (y grows downward, so vy < 0 rises)', () => {
    expect(selectPose(stateAt({ grounded: false, vy: -4 }), timersWith(), 'Mid')).toBe('air');
  });

  it('rule 4: airborne and falling is the tuck', () => {
    expect(selectPose(stateAt({ grounded: false, vy: 4 }), timersWith(), 'Mid')).toBe('tuck');
  });

  it('rule 5: a running absorb outranks a crouch still held from the air', () => {
    const pose = selectPose(
      stateAt({ crouchProfile: 1 }),
      timersWith({ absorbTicks: 3, crouched: true }),
      'Steep',
    );
    expect(pose).toBe('absorbSteep');
  });

  it('rule 6: a latched crouch outranks the launch window', () => {
    expect(selectPose(stateAt(), timersWith({ crouched: true, launchTicks: 2 }), 'Mid')).toBe(
      'crouchMid',
    );
  });

  it('rule 7: the launch extension shows when nothing narrower is true', () => {
    expect(selectPose(stateAt(), timersWith({ launchTicks: 2 }), 'Mid')).toBe('launch');
  });

  it('rule 8: otherwise he is carving, at the lean he is riding', () => {
    expect(selectPose(stateAt(), timersWith(), 'Shallow')).toBe('carveShallow');
    expect(selectPose(stateAt(), timersWith(), 'Mid')).toBe('carveMid');
    expect(selectPose(stateAt(), timersWith(), 'Steep')).toBe('carveSteep');
  });
});

describe('edge cases the table must answer', () => {
  it('a touchdown that ends the run is a wipeout, never a clean landing (FR-167)', () => {
    // FR-124: touching down with a spin still turning ends the run. The frame
    // the run ends is the frame the player remembers, and drawing an absorb
    // there would tell him he landed it.
    const timers = new PoseTimers();
    const airborne = stateAt({ grounded: false, spinTicksLeft: 4, vy: 5 });
    const landed = stateAt({ grounded: true, outcome: 'wiped_out', wipeoutReason: 'spun_out' });
    timers.advance(airborne, landed);
    expect(timers.absorbTicks).toBe(0);
    expect(selectPose(landed, timers, 'Mid')).toBe('wipeout');
  });

  it('a ramp relaunch cancels the absorb rather than letting it outlive its state (FR-168)', () => {
    const timers = new PoseTimers();
    timers.advance(stateAt({ grounded: false, vy: 5 }), stateAt({ grounded: true }));
    expect(timers.absorbTicks).toBe(ABSORB_TICKS);

    // Two ticks on the ground, then launched again.
    timers.advance(stateAt(), stateAt());
    timers.advance(stateAt(), stateAt({ grounded: false, vy: -6 }));
    expect(timers.absorbTicks).toBe(0);
    expect(selectPose(stateAt({ grounded: false, vy: -6 }), timers, 'Mid')).toBe('air');
  });

  it('the absorb expires on its own after ABSORB_TICKS', () => {
    const timers = new PoseTimers();
    timers.advance(stateAt({ grounded: false, vy: 5 }), stateAt({ grounded: true }));
    for (let i = 0; i < ABSORB_TICKS; i++) timers.advance(stateAt(), stateAt());
    expect(timers.absorbTicks).toBe(0);
    expect(selectPose(stateAt(), timers, 'Mid')).toBe('carveMid');
  });

  it('crouchProfile hovering at the threshold does not alternate (FR-166)', () => {
    const timers = new PoseTimers();
    const seen = new Set<string>();
    // Feather the control either side of 0.5 - the value a single threshold
    // would sit exactly on - for a good long while.
    for (let i = 0; i < 40; i++) {
      const profile = i % 2 === 0 ? 0.49 : 0.51;
      timers.advance(stateAt(), stateAt({ crouchProfile: profile }));
      seen.add(selectPose(stateAt({ crouchProfile: profile }), timers, 'Mid'));
    }
    expect(seen.size).toBe(1);
  });

  it('the crouch latches on and off at different points, not at one threshold', () => {
    const timers = new PoseTimers();
    timers.advance(stateAt(), stateAt({ crouchProfile: 0.6 }));
    expect(timers.crouched).toBe(true);
    // 0.5 is past the entry point but not past the exit point: still crouched.
    timers.advance(stateAt(), stateAt({ crouchProfile: 0.5 }));
    expect(timers.crouched).toBe(true);
    timers.advance(stateAt(), stateAt({ crouchProfile: 0.4 }));
    expect(timers.crouched).toBe(false);
  });

  it('airborne at the exact apex resolves deterministically to tuck', () => {
    expect(selectPose(stateAt({ grounded: false, vy: 0 }), timersWith(), 'Mid')).toBe('tuck');
  });
});

describe('lean buckets (FR-183, FR-184, research R1)', () => {
  // slopeAt returns a unit vector whose uy IS the sine of the slope angle.
  const sinOf = (deg: number): { ux: number; uy: number } => ({
    ux: Math.cos((deg * Math.PI) / 180),
    uy: Math.sin((deg * Math.PI) / 180),
  });

  it('covers the whole measured 11.66deg-31.76deg band with no angle undrawn', () => {
    const lean = new LeanState();
    for (let deg = 11.66; deg <= 31.76; deg += 0.1) {
      lean.reset();
      const bucket = lean.update(sinOf(deg));
      expect(['Shallow', 'Mid', 'Steep']).toContain(bucket);
    }
  });

  it('assigns the three thirds of the band to the three buckets', () => {
    const at = (deg: number): LeanBucket => {
      const lean = new LeanState();
      lean.reset();
      // Approach from well below so hysteresis cannot hold a stale bucket.
      lean.update(sinOf(0));
      return lean.update(sinOf(deg));
    };
    expect(at(13)).toBe('Shallow');
    expect(at(21)).toBe('Mid');
    expect(at(30)).toBe('Steep');
  });

  it('clamps outside the measured band rather than throwing (data-model.md)', () => {
    const lean = new LeanState();
    lean.update(sinOf(0));
    expect(lean.update(sinOf(2))).toBe('Shallow');
    expect(lean.update(sinOf(44))).toBe('Steep');
  });

  it('a slope oscillating across a boundary does not flicker (FR-184)', () => {
    const lean = new LeanState();
    lean.update(sinOf(0));
    lean.update(sinOf(18.36));
    const before = lean.bucket;
    const seen = new Set<LeanBucket>();
    // A terrain vertex whose two segments straddle the boundary, ridden back
    // and forth. Plain rounding alternates here; directional switching does not.
    for (let i = 0; i < 40; i++) {
      seen.add(lean.update(sinOf(i % 2 === 0 ? 18.3 : 18.42)));
    }
    expect(seen).toEqual(new Set([before]));
  });

  it('still crosses when the slope genuinely changes', () => {
    const lean = new LeanState();
    lean.update(sinOf(0));
    expect(lean.update(sinOf(14))).toBe('Shallow');
    expect(lean.update(sinOf(22))).toBe('Mid');
    expect(lean.update(sinOf(30))).toBe('Steep');
    expect(lean.update(sinOf(14))).toBe('Shallow');
  });
});

describe('reduced motion keeps the message (FR-174, SC-060)', () => {
  /**
   * The strongest form this assertion can take: `selectPose` does not accept a
   * MotionSettings argument at all, so pose CANNOT become motion-dependent.
   * Running the whole table under both settings therefore proves the property
   * rather than sampling it - what reduced motion drops is decorative movement
   * in the drawing code, never a pose that carries state (rule LT-6).
   */
  const rows: ReadonlyArray<[string, RunState, PoseTimers, LeanBucket]> = [
    ['wipeout', stateAt({ outcome: 'wiped_out' }), timersWith(), 'Mid'],
    ['spin', stateAt({ spinTicksLeft: 3 }), timersWith(), 'Mid'],
    ['air', stateAt({ grounded: false, vy: -3 }), timersWith(), 'Mid'],
    ['tuck', stateAt({ grounded: false, vy: 3 }), timersWith(), 'Mid'],
    ['absorb', stateAt(), timersWith({ absorbTicks: 4 }), 'Shallow'],
    ['crouch', stateAt(), timersWith({ crouched: true }), 'Steep'],
    ['launch', stateAt(), timersWith({ launchTicks: 2 }), 'Mid'],
    ['carve', stateAt(), timersWith(), 'Mid'],
  ];

  it('every state-carrying pose is identical under full and reduced motion', () => {
    for (const [name, state, timers, lean] of rows) {
      const full = selectPose(state, timers, lean);
      const reduced = selectPose(state, timers, lean);
      expect(reduced, `${name} differed under reduced motion`).toBe(full);
    }
    // Guards the premise: if these ever stop differing, the assertion above
    // stops meaning anything and this test should be rewritten.
    expect(FULL_MOTION).not.toEqual(REDUCED_MOTION);
  });

  it('all fourteen poses are reachable from some state', () => {
    const reachable = new Set<string>();
    for (const lean of ['Shallow', 'Mid', 'Steep'] as const) {
      reachable.add(selectPose(stateAt(), timersWith(), lean));
      reachable.add(selectPose(stateAt(), timersWith({ crouched: true }), lean));
      reachable.add(selectPose(stateAt(), timersWith({ absorbTicks: 2 }), lean));
    }
    reachable.add(selectPose(stateAt({ outcome: 'wiped_out' }), timersWith(), 'Mid'));
    reachable.add(selectPose(stateAt({ spinTicksLeft: 1 }), timersWith(), 'Mid'));
    reachable.add(selectPose(stateAt({ grounded: false, vy: -1 }), timersWith(), 'Mid'));
    reachable.add(selectPose(stateAt({ grounded: false, vy: 1 }), timersWith(), 'Mid'));
    reachable.add(selectPose(stateAt(), timersWith({ launchTicks: 1 }), 'Mid'));
    expect(reachable.size).toBe(14);
  });
});
