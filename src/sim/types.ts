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

export type ObstacleKind = 'low' | 'solid';

export interface Obstacle {
  x: number;
  kind: ObstacleKind;
  width: number;
  /** Gap under a `low` obstacle. Must exceed crouchHeight and be under standHeight (CV-3). */
  clearance: number;
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
