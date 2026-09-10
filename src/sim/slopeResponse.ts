/**
 * How the mountain sets your speed.
 *
 * Feature 006. Grounded speed used to be a target you accelerated toward —
 * `baseSpeed` standing, `tuckSpeedMax` tucked — with a slope term added and
 * then clamped away again. Measured across the whole legal gradient range, from
 * 1.1 degrees to 24.2, speed moved from 2.601 to 2.616. The mountain was drawn
 * with a shape and simulated without one.
 *
 * It is now the textbook model: gravity along the slope, opposed by snow
 * friction and by air drag that rises with the square of speed. Speed settles
 * where those balance, so a pitch is worth whatever it is worth and nothing has
 * to be capped to keep it sane.
 *
 * THE TUCK IS THE REAL MECHANISM HERE. It lowers drag rather than raising a
 * target, because that is what a tuck is: you do not push harder, you make
 * yourself smaller and the air does less to stop you.
 *
 * WHY THIS NEEDS NO TRIGONOMETRY. `slopeAt` already returns the exact unit
 * downhill vector, so `uy` IS sin(theta) and `ux` IS cos(theta), computed once
 * via sqrtDet and already deterministic. The model is therefore addition,
 * subtraction and multiplication over numbers the simulation already holds —
 * inside the constitution's rule that simulation code may not call
 * implementation-approximated functions. Written in angles instead it would
 * have needed Math.sin and been rejected by lint. That is not a coding
 * convention to remember; those are the only values available.
 */
import type { SlopeUnit } from './terrain.js';
import type { Tuning } from './types.js';
import { sqrtDet } from './math.js';

/**
 * Acceleration along the slope this tick, before any clamp.
 *
 * Positive downhill. Goes negative where friction and drag together exceed what
 * gravity is supplying, which is how a player bleeds speed onto a flat without
 * anything having to decide that he should.
 */
export function groundedAccel(
  slope: SlopeUnit,
  tuning: Tuning,
  speed: number,
  tucked: boolean,
): number {
  const drag = tucked ? tuning.dragTucked : tuning.dragStanding;
  return tuning.gravity * (slope.uy - tuning.slopeFriction * slope.ux) - drag * speed * speed;
}

/**
 * The speed this slope is worth: where gravity, friction and drag balance.
 *
 * NOT used by the simulation, which simply integrates and arrives here on its
 * own. It exists for the course validator and the ramp renderer, both of which
 * have to answer "how fast will a player be going HERE" from data alone —
 * questions that used to be answered by reading `baseSpeed` and `tuckSpeedMax`
 * off the tuning file, back when those were the same everywhere.
 *
 * Returns 0 for a slope too shallow to overcome friction. CV-19 exists so that
 * case cannot be authored into a course.
 */
export function terminalSpeed(slope: SlopeUnit, tuning: Tuning, tucked: boolean): number {
  const drag = tucked ? tuning.dragTucked : tuning.dragStanding;
  const net = tuning.gravity * (slope.uy - tuning.slopeFriction * slope.ux);
  if (net <= 0) return 0;
  return sqrtDet(net / drag);
}

/** The same, from a gradient rather than a unit vector. */
export function terminalSpeedAtGradient(gradient: number, tuning: Tuning, tucked: boolean): number {
  return terminalSpeed(unitForGradient(gradient), tuning, tucked);
}

/** Unit downhill vector for a gradient, built exactly as `slopeAt` builds it. */
export function unitForGradient(gradient: number): SlopeUnit {
  const len = sqrtDet(1 + gradient * gradient);
  if (len === 0) return { ux: 1, uy: 0 };
  return { ux: 1 / len, uy: gradient / len };
}

/**
 * The gradient at which gravity exactly cancels friction. At or below it the
 * skier comes to a stop and no input can recover — there is no brake and no
 * pedal in this game, so it is a permanent strand rather than a slow section.
 *
 * CV-19 refuses any terrain segment at or under this, with margin.
 */
export function stallGradient(tuning: Tuning): number {
  // tan(theta) = friction at the balance point, and gradient IS the tangent.
  return tuning.slopeFriction;
}
