/**
 * The physics model. Semi-implicit (symplectic) Euler on a fixed 60 Hz tick.
 *
 * research R3 chose semi-implicit Euler because it conserves energy far better
 * than explicit Euler under gravity, costs one evaluation per tick against the
 * 2 ms budget, and — decisively — uses only +, -, * on state, so it stays
 * inside the arithmetic the determinism guarantee covers.
 *
 * Orientation is carried as a unit vector rather than an angle so that the
 * landing check is a dot product against the slope. That removes the only place
 * atan2 would otherwise have been needed.
 */
import type { Course, RunState, RunInput, Tuning } from './types.js';
import { approach, clamp } from './math.js';
import { groundedAccel } from './slopeResponse.js';
import { sinDet, cosDet, TAU } from './trig.js';
import {
  slopeAt,
  terrainYAt,
  surfaceYAt,
  onLedgeSpan,
  iceIndexAt,
  overheadClearanceAt,
} from './terrain.js';

export interface LaunchOutcome {
  launched: boolean;
  /** True when the release happened under a low obstacle: FR-088, an instant wipeout. */
  intoObstacle: boolean;
}

/**
 * Resolves the crouch input.
 *
 * Crouch does three jobs — duck, accelerate, and charge the launch — and the
 * release edge is the launch. That coupling is deliberate (FR-078) and is what
 * gates the trick economy behind the speed mechanic (FR-087): no crouch means
 * no air, which means no rotation, which means no trick bonus.
 */
export function resolveCrouch(
  state: RunState,
  input: RunInput,
  tuning: Tuning,
  course: Course,
): LaunchOutcome {
  const releasedThisTick = state.crouchHeld && !input.crouch;
  state.crouchHeld = input.crouch;

  const target = input.crouch ? 1 : 0;
  const step = 1 / tuning.crouchTransitionTicks;
  state.crouchProfile = clamp(approach(state.crouchProfile, target, step), 0, 1);

  if (!state.grounded) return { launched: false, intoObstacle: false };

  if (input.crouch) {
    state.crouchCharge = clamp(state.crouchCharge + 1, 0, tuning.chargeTicksToMax);
    return { launched: false, intoObstacle: false };
  }

  if (!releasedThisTick) {
    state.crouchCharge = 0;
    return { launched: false, intoObstacle: false };
  }

  // FR-088: releasing under a low obstacle launches into it. No clearance check,
  // no charge threshold, no suppressed jump. The timing IS the skill.
  //
  // Only on the piste. A skier riding the upper track is above every rope by
  // construction (CV-14), so the ropes below him are not his ceiling and
  // standing up there is simply standing up.
  const clearance = state.ledge < 0 ? overheadClearanceAt(course, state.x) : Infinity;
  if (clearance < tuning.standHeight) {
    state.crouchCharge = 0;
    return { launched: false, intoObstacle: true };
  }

  const chargeRatio = state.crouchCharge / tuning.chargeTicksToMax;
  const impulse =
    tuning.launchImpulseMin + (tuning.launchImpulseMax - tuning.launchImpulseMin) * chargeRatio;

  state.vy -= impulse; // up is -y
  state.grounded = false;
  state.ledge = -1;
  state.crouchCharge = 0;
  state.rotationAccum = 0;
  return { launched: true, intoObstacle: false };
}

/**
 * Applies a kicker launch if the skier crossed a ramp lip this tick.
 *
 * The impulse is proportional to carried speed, which is what makes a kicker
 * read as a ramp rather than as a second jump button: approach it in a tuck and
 * it throws you to the upper track, coast into it and it gives you a hop. No
 * per-kicker state is needed because a grounded skier's x is strictly
 * increasing - FR-077 puts a floor under speed and the piste always runs
 * downhill - so a lip can be crossed at most once.
 *
 * Called BEFORE integration, for the same reason the crouch release is: an
 * impulse applied after the position update leaves the skier still standing on
 * the ramp, and the ground contact resolved later in the same tick snaps him
 * back down and scrubs the whole launch. So the lip test looks at where this
 * tick's velocity is ABOUT to put him rather than where he already is.
 *
 * Returns true when a launch happened.
 */
export function applyKickers(state: RunState, course: Course, tuning: Tuning): boolean {
  if (!state.grounded) return false;
  // A ramp is built on the piste. Sailing over one on the upper track is not a
  // launch, it is scenery.
  if (state.ledge >= 0) return false;

  const nextX = state.x + state.vx;
  let impulse = 0;
  let angleDeg = VERTICAL_LAUNCH_DEG;
  let scale = 1;
  for (const k of course.kickers) {
    const lip = k.x + k.width;
    if (state.x >= lip || nextX < lip) continue;
    const carried = currentSpeed(state);
    const scaled = k.power * carried;
    const capped = scaled > tuning.kickerImpulseMax ? tuning.kickerImpulseMax : scaled;
    if (capped > impulse) {
      impulse = capped;
      angleDeg = k.launchAngle ?? VERTICAL_LAUNCH_DEG;
      scale = k.gravityScale ?? 1;
    }
  }
  if (impulse <= 0) return false;

  // The launch is a vector, not a number. Trig here rather than in derive()
  // because a launch happens a handful of times in a run, not sixty times a
  // second - and the deterministic tables are what make it safe to do at all.
  const rad = (angleDeg * Math.PI) / 180;
  state.vy -= impulse * sinDet(rad);
  state.vx += impulse * cosDet(rad);
  state.gravityScale = scale;
  state.grounded = false;
  state.ledge = -1;
  state.crouchCharge = 0;
  state.rotationAccum = 0;
  return true;
}

/** A ramp with no launchAngle throws straight up, as every ramp once did. */
const VERTICAL_LAUNCH_DEG = 90;

/**
 * Grounded motion: the mountain sets the speed (FR-214).
 *
 * Gravity along the slope, minus snow friction, minus air drag rising with the
 * square of speed. Speed settles at terminal velocity for whatever pitch the
 * player is on, so a steep run-in is genuinely worth more than a gentle one and
 * a kicker at the foot of it throws further.
 *
 * This replaced an accelerate-toward-a-target-then-clamp that made gradient
 * almost irrelevant: measured across the whole legal range, speed moved from
 * 2.601 to 2.616. See src/sim/slopeResponse.ts for the model and why it needs
 * no trigonometry.
 *
 * Integrated EXPLICITLY. A semi-implicit step was measured and rejected: it
 * exists to buy stability that is not needed here — the explicit form lands
 * exactly on terminal at every legal gradient including CV-2's 60-degree
 * maximum, with zero oscillation — and it costs accuracy, settling 1.5-3% below
 * terminal everywhere, which would make every speed in the game quietly wrong
 * in a way nobody could see.
 */
export function applyGroundedMotion(state: RunState, course: Course, tuning: Tuning): void {
  const slope = slopeAt(course.terrain, state.x);
  const speed = currentSpeed(state);

  // FR-219: bounds from tuning, per FR-077's "within bounds set in tuning data".
  // speedMin is a floor so nobody is ever stranded; speedMax is a safety rail
  // sitting above the steepest legal terminal, NOT the mechanism. CV-19 is what
  // actually keeps a course from stalling anybody.
  const next = clamp(
    speed + groundedAccel(slope, tuning, speed, state.crouchHeld),
    tuning.speedMin,
    tuning.speedMax,
  );

  state.vx = next * slope.ux;
  state.vy = next * slope.uy;
  state.ox = slope.ux;
  state.oy = slope.uy;
}

/**
 * Airborne motion: gravity, and the spin if one is turning.
 *
 * Rotation is a COMMITTED ANIMATION, not a rate the player steers. A press
 * starts one whole turn in the pressed direction; it then runs for exactly
 * `spinDurationTicks` and cannot be stopped, reversed or shortened, and touching
 * down before it finishes ends the run (FR-124).
 *
 * This replaced a free-rotation model where the player nudged his orientation a
 * little every tick and had to arrive at the ground within a tolerance of the
 * slope. That asked him to judge a continuous quantity he could barely see at
 * 320x180, at speed, and the answer was usually "don't rotate at all". A
 * committed spin asks one question instead - is there time? - and the player can
 * actually answer it.
 */
export function applyAirborneMotion(state: RunState, input: RunInput, tuning: Tuning): void {
  state.vy += tuning.gravity * state.gravityScale;

  // On the PRESS, and only when nothing is already turning. Holding the key
  // does not chain spins: a chain restarts the moment one finishes, so the last
  // one is always incomplete on landing and holding becomes a way to die.
  const pressed = input.rotate !== 0 && state.rotateHeld === 0;
  if (pressed && state.spinTicksLeft === 0) {
    state.spinTicksLeft = tuning.spinDurationTicks;
    state.spinDir = input.rotate;
    state.spinFromOx = state.ox;
    state.spinFromOy = state.oy;
  }

  if (state.spinTicksLeft === 0) return;

  state.spinTicksLeft -= 1;

  if (state.spinTicksLeft === 0) {
    // A whole turn ends where it began, exactly. Restored rather than rotated
    // the last step, so no drift survives the trick.
    state.ox = state.spinFromOx;
    state.oy = state.spinFromOy;
    state.rotationAccum += TAU;
    state.spinDir = 0;
    return;
  }

  // Rebuilt from the starting orientation each tick rather than nudged on from
  // the last one, so the error is bounded by one rotation instead of compounding
  // across fifteen.
  const elapsed = tuning.spinDurationTicks - state.spinTicksLeft;
  const angle = ((TAU * elapsed) / tuning.spinDurationTicks) * state.spinDir;
  const c = cosDet(angle);
  const sn = sinDet(angle);
  state.ox = state.spinFromOx * c - state.spinFromOy * sn;
  state.oy = state.spinFromOx * sn + state.spinFromOy * c;

  // Air control is deliberately weak: committing to a rotation costs you the line.
  state.vx += tuning.airControlFactor * state.spinDir * 0.01;
}

export const currentSpeed = (state: RunState): number => {
  const { vx, vy } = state;
  // Magnitude via the squared form would need a sqrt; the sign of vx tells us
  // direction and the components are already the slope-aligned velocity.
  return vx * state.ox + vy * state.oy;
};

/**
 * Resolves ground contact after integration.
 *
 * Returns true when the landing was clean. A landing is clean when the skier's
 * orientation is within tolerance of the slope — compared as a dot product,
 * because both are unit vectors (FR-079).
 *
 * Two surfaces can catch him. Ledges are ONE-WAY: they catch only a descending
 * skier who crossed the shelf between `prevY` and now, so riding up through one
 * from below is free and standing under one is not a collision. The piste
 * underneath is solid and always catches. Checking the ledges first is what
 * makes the upper track a track rather than a decoration.
 */
export type Contact = 'airborne' | 'landed' | 'misaligned';

export function resolveLanding(
  state: RunState,
  course: Course,
  tuning: Tuning,
  cosTolerance: number,
  cosToleranceForgiving: number,
  prevY: number,
): Contact {
  const slope = slopeAt(course.terrain, state.x);

  let landedOn = -2; // -2 = nothing, -1 = piste, >= 0 = ledge index
  let surfaceY = 0;

  if (state.vy > 0) {
    // Descending. Take the topmost shelf crossed this tick: with overlapping
    // ledges banned by CV-12 there is at most one, but resolving by height
    // rather than by index keeps the result independent of file ordering.
    const brokenHere = iceIndexAt(course, state.x);
    // A shelf with a hole in it is not a surface. This is also what stops the
    // tick after a break from putting the player straight back on the ice.
    const holed = brokenHere >= 0 && state.iceBroken[brokenHere] === 1;
    for (let i = 0; !holed && i < course.ledges.length; i++) {
      if (!onLedgeSpan(course, state.x, i)) continue;
      const ly = surfaceYAt(course, state.x, i);
      if (prevY > ly || state.y < ly) continue; // did not cross it going down
      if (landedOn === -2 || ly < surfaceY) {
        landedOn = i;
        surfaceY = ly;
      }
    }
  }

  if (landedOn === -2) {
    const groundY = terrainYAt(course.terrain, state.x);
    if (state.y < groundY) return 'airborne'; // nothing to resolve
    landedOn = -1;
    surfaceY = groundY;
  }

  state.y = surfaceY;
  const alignment = state.ox * slope.ux + state.oy * slope.uy;
  const threshold = state.landingGraceTicks > 0 ? cosToleranceForgiving : cosTolerance;

  if (alignment < threshold) return 'misaligned';

  state.grounded = true;
  state.ledge = landedOn;
  state.ox = slope.ux;
  state.oy = slope.uy;
  state.landingGraceTicks = 15;

  // Project the airborne velocity back onto the slope and re-apply FR-077's
  // bounds. Without this the landing tick carries gravity-accumulated vy into
  // grounded state, so a long drop briefly exceeded the ceiling - which the
  // monkey fuzz caught. Landing scrubs to the slope; it does not add speed.
  //
  // The bounds are now speedMin/speedMax rather than baseSpeed/tuckSpeedMax,
  // and that is a substantive change rather than a rename: a landing at the
  // bottom of a steep pitch used to be confiscated back to 4.2, and now keeps
  // the speed that pitch earned. It is what makes a steep run-in pay off
  // THROUGH a launch instead of only up to it.
  const along = state.vx * slope.ux + state.vy * slope.uy;
  const settled = clamp(along, tuning.speedMin, tuning.speedMax);
  state.vx = settled * slope.ux;
  state.vy = settled * slope.uy;
  return 'landed';
}
