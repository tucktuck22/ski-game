/** Types shared by the simulation. Pure data — no behaviour, no I/O. */

export interface Vec2 {
  x: number;
  y: number;
}

/** Course geometry as the simulation sees it. Loading and validation live in src/course. */
export interface TerrainPoint {
  x: number;
  y: number;
}

/**
 * `low` is an overhanging bough: a ceiling with real thickness, so it can be
 * ducked under OR cleared over. `solid` is deadfall lying across the piste:
 * a block on the ground, cleared only by going over.
 *
 * The names describe the collision semantics, not the picture. What they look
 * like is src/render/draw.ts's business and the style bible's - see rule TR-2.
 */
export type ObstacleKind = 'low' | 'solid';

export interface Obstacle {
  x: number;
  kind: ObstacleKind;
  width: number;
  /** Gap under a `low` obstacle. Must exceed crouchHeight and be under standHeight (CV-3). */
  clearance: number;
}

/**
 * A shelf of snow running parallel to the piste at a constant height above it:
 * the upper track.
 *
 * Constant offset is the whole trick. Because the ledge surface is the terrain
 * profile translated up, its slope at any x is IDENTICAL to the slope of the
 * piste below - so a landing on the ledge and a landing on the piste face the
 * same tolerance check, and dropping off the end of a ledge can never present
 * an angle the player was not already riding. A free-form upper polyline would
 * have needed its own copy of every CV rule about bends.
 *
 * Ledges are one-way: you land on them from above and pass up through them from
 * below. That is the platformer idiom, and it means being underneath one is
 * never a collision.
 */
export interface Ledge {
  /** Left edge, inclusive. */
  x0: number;
  /** Right edge, exclusive - ride past it and you are airborne. */
  x1: number;
  /** Distance above the piste surface. Constant along the whole span. */
  height: number;
}

/**
 * A snow ramp. Crossing its lip while grounded launches you, scaled by the
 * speed you carried into it - no crouch required.
 *
 * This is the one launch the player does not have to set up, which is what
 * makes the upper track approachable: FR-078's crouch-release is still the
 * skill ceiling, but a kicker is the floor.
 */
export interface Kicker {
  /** Left edge of the ramp. The lip is at x + width. */
  x: number;
  width: number;
  /** Multiplier on carried speed. The launch impulse is power * speed. */
  power: number;
}

export interface Barrier {
  x: number;
  width: number;
  bypassCostTicks: number;
}

export type PickupValue = 'small' | 'large';

export interface Pickup {
  x: number;
  /** Height above the terrain surface. */
  y: number;
  value: PickupValue;
}

export interface Course {
  id: string;
  rulesVersion: string;
  length: number;
  terrain: TerrainPoint[];
  obstacles: Obstacle[];
  barriers: Barrier[];
  pickups: Pickup[];
  ledges: Ledge[];
  kickers: Kicker[];
}

/** Every value governing feel. Loaded from data/tuning.json — see contracts/tuning-data.md. */
export interface Tuning {
  baseSpeed: number;
  tuckSpeedMax: number;
  tuckAccel: number;
  tuckDecel: number;
  slopeAccelFactor: number;
  gravity: number;
  launchImpulseMin: number;
  launchImpulseMax: number;
  chargeTicksToMax: number;
  rotationRateMax: number;
  airControlFactor: number;
  landingAngleTolerance: number;
  landingAngleToleranceForgiving: number;
  collisionSpeedThreshold: number;
  standHeight: number;
  crouchHeight: number;
  crouchTransitionTicks: number;
  attackReach: number;
  attackCooldownTicks: number;
  safeReleaseWindowMin: number;
  /** Vertical extent of a `low` obstacle's bough, hanging below its clearance. */
  branchThickness: number;
  /** Ceiling on a kicker launch, so a tucked approach cannot fling you off-course. */
  kickerImpulseMax: number;
}

export interface Scoring {
  /** Must exceed the maximum achievable bonus total, so every finisher beats every
   *  non-finisher (FR-034). Asserted by tests/unit/scoring-dominance.test.ts. */
  completionBase: number;
  /** Awarded per unit of distance progressed, so a wipeout still scores something. */
  progressPerUnit: number;
  pickupSmall: number;
  pickupLarge: number;
  /** Per full rotation landed cleanly. */
  trickPerRotation: number;
  barrierBroken: number;
}

/** The three inputs of contracts/controls.md. */
export interface RunInput {
  /** Held state. The RELEASE edge is what launches (FR-078). */
  crouch: boolean;
  /** -1, 0 or +1. Airborne only. */
  rotate: -1 | 0 | 1;
  /** Edge-triggered. */
  attack: boolean;
}

export type Outcome = 'running' | 'finished' | 'wiped_out';

export type WipeoutReason =
  'launched_into_obstacle' | 'bad_landing' | 'struck_obstacle' | 'struck_barrier' | null;

export interface RunState {
  tick: number;
  /** Position. y increases downward, as on screen. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Orientation as a unit vector rather than an angle: comparing it to the slope
   *  is a dot product, which avoids needing atan2 anywhere in the simulation. */
  ox: number;
  oy: number;
  /** Total rotation this air, in radians. Converts to trick score on a clean landing. */
  rotationAccum: number;
  grounded: boolean;
  /** Which surface the skier is riding: -1 for the piste, else an index into course.ledges. */
  ledge: number;
  crouchHeld: boolean;
  /** Ticks the crouch has been held, capped at chargeTicksToMax. */
  crouchCharge: number;
  /** 0 = standing, 1 = fully crouched. Transitions over crouchTransitionTicks. */
  crouchProfile: number;
  landingGraceTicks: number;
  attackCooldown: number;
  score: number;
  /** Furthest x reached, so progress score cannot be farmed by oscillating. */
  maxX: number;
  pickupsTaken: Uint8Array;
  barriersBroken: Uint8Array;
  outcome: Outcome;
  wipeoutReason: WipeoutReason;
}
