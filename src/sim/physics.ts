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
import { sinDet, cosDet } from './trig.js';
import { slopeAt, terrainYAt, overheadClearanceAt } from './terrain.js';

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
  const clearance = overheadClearanceAt(course, state.x);
  if (clearance < tuning.standHeight) {
    state.crouchCharge = 0;
    return { launched: false, intoObstacle: true };
  }

  const chargeRatio = state.crouchCharge / tuning.chargeTicksToMax;
  const impulse =
    tuning.launchImpulseMin + (tuning.launchImpulseMax - tuning.launchImpulseMin) * chargeRatio;

  state.vy -= impulse; // up is -y
  state.grounded = false;
  state.crouchCharge = 0;
  state.rotationAccum = 0;
  return { launched: true, intoObstacle: false };
}

/** Grounded motion: speed toward the tuck or base target, plus slope acceleration. */
export function applyGroundedMotion(state: RunState, course: Course, tuning: Tuning): void {
  const slope = slopeAt(course.terrain, state.x);
  const speed = currentSpeed(state);

  const target = state.crouchHeld ? tuning.tuckSpeedMax : tuning.baseSpeed;
  const rate = state.crouchHeld ? tuning.tuckAccel : tuning.tuckDecel;
  let next = approach(speed, target, rate);

  // uy is the sine of the slope angle: steeper is faster, within the tuck cap.
  next += tuning.slopeAccelFactor * slope.uy;

  // FR-077: there is no brake. Speed never drops below base on a descending slope.
  next = clamp(next, tuning.baseSpeed, tuning.tuckSpeedMax);

  state.vx = next * slope.ux;
  state.vy = next * slope.uy;
  state.ox = slope.ux;
  state.oy = slope.uy;
}

/** Airborne motion: gravity, and rotation if the player is spinning. */
export function applyAirborneMotion(state: RunState, input: RunInput, tuning: Tuning): void {
  state.vy += tuning.gravity;

  if (input.rotate !== 0) {
    const delta = tuning.rotationRateMax * input.rotate;
    const c = cosDet(delta);
    const s = sinDet(delta);
    const ox = state.ox * c - state.oy * s;
    const oy = state.ox * s + state.oy * c;
    state.ox = ox;
    state.oy = oy;
    state.rotationAccum += delta < 0 ? -delta : delta;

    // Air control is deliberately weak: committing to a rotation costs you the line.
    state.vx += tuning.airControlFactor * input.rotate * 0.01;
  }
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
 */
export function resolveLanding(
  state: RunState,
  course: Course,
  tuning: Tuning,
  cosTolerance: number,
  cosToleranceForgiving: number,
): boolean {
  const groundY = terrainYAt(course.terrain, state.x);
  if (state.y < groundY) return true; // still airborne, nothing to resolve

  state.y = groundY;
  const slope = slopeAt(course.terrain, state.x);
  const alignment = state.ox * slope.ux + state.oy * slope.uy;
  const threshold = state.landingGraceTicks > 0 ? cosToleranceForgiving : cosTolerance;

  if (alignment < threshold) return false;

  state.grounded = true;
  state.ox = slope.ux;
  state.oy = slope.uy;
  state.landingGraceTicks = 15;

  // Project the airborne velocity back onto the slope and re-apply FR-077's
  // bounds. Without this the landing tick carries gravity-accumulated vy into
  // grounded state, so a long drop briefly exceeded tuckSpeedMax - which the
  // monkey fuzz caught. Landing scrubs to the slope; it does not add speed.
  const along = state.vx * slope.ux + state.vy * slope.uy;
  const settled = clamp(along, tuning.baseSpeed, tuning.tuckSpeedMax);
  state.vx = settled * slope.ux;
  state.vy = settled * slope.uy;
  return true;
}
