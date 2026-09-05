/**
 * Which pose the skier is drawn in (FR-164, FR-165).
 *
 * This module imports nothing from the DOM and nothing that draws. It is a pure
 * read of the simulation plus a handful of render-owned latches, which is what
 * lets the whole contract in contracts/pose-selection.md be a unit test rather
 * than something only a human at a terminal vertex would ever see.
 *
 * `Readonly<RunState>` in every signature is load-bearing. The constitution's
 * Technical Standards say rendering MUST NOT mutate simulation state; typing it
 * that way makes a violation a compile error instead of a review comment.
 *
 * Nothing here is a simulation field. FR-164 forbids adding one, for the reason
 * landing.ts already records: a field added for presentation would put
 * presentation inside the thing FR-026's reproducibility is computed over.
 */
import type { RunState } from '../sim/types.js';
import type { SlopeUnit } from '../sim/terrain.js';

/**
 * The closed pose vocabulary. Closed rather than `string` so that a pose the
 * manifest lacks, or one the code never selects, is caught by the manifest's
 * required-pose validation instead of by a blank frame.
 */
export type PoseKey =
  | 'carveShallow'
  | 'carveMid'
  | 'carveSteep'
  | 'crouchShallow'
  | 'crouchMid'
  | 'crouchSteep'
  | 'launch'
  | 'air'
  | 'tuck'
  | 'spin'
  | 'absorbShallow'
  | 'absorbMid'
  | 'absorbSteep'
  | 'wipeout';

export const POSE_KEYS: readonly PoseKey[] = [
  'carveShallow',
  'carveMid',
  'carveSteep',
  'crouchShallow',
  'crouchMid',
  'crouchSteep',
  'launch',
  'air',
  'tuck',
  'spin',
  'absorbShallow',
  'absorbMid',
  'absorbSteep',
  'wipeout',
];

export type LeanBucket = 'Shallow' | 'Mid' | 'Steep';

/**
 * Lean-bucket boundaries, as SINES of the slope angle.
 *
 * research.md R1 measured both shipped courses segment by segment: the union
 * spans 11.66deg to 31.76deg, entirely downhill, and ledges add nothing because
 * a ledge is the terrain profile translated by a constant. Splitting that 20.1deg
 * band into thirds puts the boundaries at 18.36deg and 25.06deg, which bounds the
 * worst-case angular error at +/-3.35deg - under one pixel of ski discrepancy at
 * this buffer size, and half that again because the sprite is anchored at the
 * ski centre rather than the tail.
 *
 * Sines rather than degrees because `slopeAt()` already returns a unit vector
 * whose `uy` IS the sine. This is render code, so the simulation's ban on
 * implementation-approximated functions does not bind it - but there is no
 * reason to spend an `asin` per frame to get back to a number we started with.
 */
const SIN_18_36 = 0.315_04;
const SIN_25_06 = 0.423_67;

/**
 * Hysteresis half-band, in the same sine units. Roughly 0.75 degrees.
 *
 * FR-184. The terrain is piecewise linear, so slope is a STEP function of x:
 * crossing a vertex changes the angle discontinuously. A player riding a vertex
 * whose two segments straddle a boundary would alternate poses at tick rate, and
 * plain rounding cannot fix that because the value really is jumping. A switch
 * point that differs by direction of travel can, and costs one remembered value.
 */
const LEAN_HYSTERESIS = 0.012;

/**
 * How far into the crouch the pose changes, and how far back out it changes
 * again (FR-166).
 *
 * `crouchProfile` is continuous, the poses are discrete, and a player feathering
 * the control would sit exactly on a single threshold - so the entry and exit
 * points differ, for the same reason the lean buckets' do.
 */
const CROUCH_POSE_ENTER = 0.55;
const CROUCH_POSE_EXIT = 0.45;

/** Ticks the landing compression is held. See `PoseTimers`. */
export const ABSORB_TICKS = 10;

/** Ticks the launch extension is held. See `PoseTimers`. */
export const LAUNCH_TICKS = 4;

/**
 * The lean bucket the skier is currently drawn at, carried between ticks so the
 * boundary can be directional (FR-184).
 */
export class LeanState {
  private current: LeanBucket = 'Mid';

  get bucket(): LeanBucket {
    return this.current;
  }

  reset(): void {
    this.current = 'Mid';
  }

  /**
   * Updates the bucket from the slope underfoot.
   *
   * Angles outside the measured band clamp to the nearest bucket rather than
   * throwing: the band is a measurement of today's courses, not a law about all
   * future ones, and a new course with a 35deg pitch must render. The steep pose
   * on a 35deg slope is visibly imperfect and still a skier on a mountain.
   */
  update(slope: SlopeUnit): LeanBucket {
    const uy = slope.uy;

    // The boundaries move with the bucket we are already in, which is what
    // makes the switch directional: leaving a bucket costs an extra half-band,
    // staying costs nothing. Resolved in one comparison rather than by nudging
    // one step at a time - a skier crossing a vertex from a shallow runout onto
    // a steep pitch must land in the right bucket THIS tick, not two ticks
    // later having been drawn wrong in between.
    const lower =
      this.current === 'Shallow' ? SIN_18_36 + LEAN_HYSTERESIS : SIN_18_36 - LEAN_HYSTERESIS;
    const upper =
      this.current === 'Steep' ? SIN_25_06 - LEAN_HYSTERESIS : SIN_25_06 + LEAN_HYSTERESIS;

    this.current = uy < lower ? 'Shallow' : uy < upper ? 'Mid' : 'Steep';
    return this.current;
  }
}

/**
 * The render-owned latches the pose table reads: landing compression, the
 * launch extension, and the crouch pose's own hysteresis.
 *
 * Modelled directly on `LandingEffect`, including the part that matters most -
 * these advance on the SIMULATION TICK, never on the frame, so a landing lasts
 * the same wall-clock time on a 60 Hz phone and a 120 Hz desktop.
 *
 * Every transition is derived by the view from two consecutive states. No
 * simulation field was added for any of it (FR-164).
 */
export class PoseTimers {
  absorbTicks = 0;
  launchTicks = 0;
  /** Whether the crouch pose is currently latched on. See CROUCH_POSE_ENTER. */
  crouched = false;

  reset(): void {
    this.absorbTicks = 0;
    this.launchTicks = 0;
    this.crouched = false;
  }

  /**
   * Advances one simulation tick, given the states either side of it.
   *
   * Touchdown is `grounded` false -> true, the same two-state comparison
   * `LandingEffect` uses for the piste-to-shelf transition.
   */
  advance(prev: Readonly<RunState>, next: Readonly<RunState>): void {
    if (this.absorbTicks > 0) this.absorbTicks -= 1;
    if (this.launchTicks > 0) this.launchTicks -= 1;

    // Leaving the ground CANCELS an absorb rather than letting it run down.
    // FR-168: an absorb must never outlive the state it describes, which is the
    // ramp-relaunch case - touch down, get launched two ticks later, and the
    // compression would otherwise still be playing in mid-air.
    if (prev.grounded && !next.grounded) this.absorbTicks = 0;

    // A touchdown that ends the run is not a landing. Rule 1 outranks rule 5 in
    // the pose table anyway, but starting the timer here would leave it running
    // into whatever comes next.
    if (!prev.grounded && next.grounded && next.outcome !== 'wiped_out') {
      this.absorbTicks = ABSORB_TICKS;
    }

    // The launch extension: charged, grounded, and the crouch has just been let
    // go. Time-boxed so a state that stops advancing cannot hold the pose.
    if (prev.crouchHeld && !next.crouchHeld && next.crouchCharge === 0 && prev.crouchCharge > 0) {
      this.launchTicks = LAUNCH_TICKS;
    }

    this.crouched = next.crouchProfile >= (this.crouched ? CROUCH_POSE_EXIT : CROUCH_POSE_ENTER);
  }
}

const carve = (lean: LeanBucket): PoseKey => `carve${lean}` as PoseKey;
const crouch = (lean: LeanBucket): PoseKey => `crouch${lean}` as PoseKey;
const absorb = (lean: LeanBucket): PoseKey => `absorb${lean}` as PoseKey;

/**
 * State -> pose. The precedence order IS the contract
 * (contracts/pose-selection.md); several conditions are true at once in normal
 * play, and getting the order wrong is how a crashed skier ends up drawn
 * mid-carve.
 *
 * Deliberately does NOT read `MotionSettings`. Every pose here carries state,
 * and FR-174 says what reduced motion suppresses is decorative movement, never
 * a message. A motion-aware pose selector would create a path where reduced
 * motion changes what the player is TOLD, which is what rule LT-6 forbids - so
 * the setting is not available to this function at all, rather than available
 * and conventionally ignored.
 */
export function selectPose(
  state: Readonly<RunState>,
  timers: Readonly<PoseTimers>,
  lean: LeanBucket,
): PoseKey {
  // 1. The run has ended badly. Outranks everything, including absorb: FR-167
  //    says a touchdown that ends the run under FR-124 must not be drawn as a
  //    clean landing. The frame the run ends is the frame the player remembers.
  if (state.outcome === 'wiped_out') return 'wipeout';

  // 2. A spin is committed and turning - the one place, with the wipeout, that
  //    continuous rotation survives at all (FR-169).
  if (state.spinTicksLeft > 0) return 'spin';

  // 3/4. Airborne. y increases downward, so a negative vy is still rising.
  if (!state.grounded) return state.vy < 0 ? 'air' : 'tuck';

  // 5. Landing compression. Above crouch because the two look alike and mean
  //    opposite things: crouchProfile may still be non-zero from a crouch held
  //    through the air, but the absorb is what actually just happened.
  if (timers.absorbTicks > 0) return absorb(lean);

  // 6. Holding the crouch.
  if (timers.crouched) return crouch(lean);

  // 7. The launch extension. Last among the grounded cases because it is the
  //    narrowest - a couple of ticks - so anything else true right now is more
  //    informative than it is.
  if (timers.launchTicks > 0) return 'launch';

  // 8. Riding.
  return carve(lean);
}
