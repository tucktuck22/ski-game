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
/**
 * A rock breaking up through the surface of an upper-track shelf.
 *
 * Anchored to the shelf rather than to the piste, and therefore to whichever
 * ledge spans its x - ledges cannot overlap (CV-12), so that is never
 * ambiguous. It is the shelf's answer to deadfall: too tall to ride through,
 * short enough to launch over, and no use ducking because ducking lowers the
 * head, not the feet.
 */
export interface Rock {
  x: number;
  width: number;
  /** How far it stands proud of the shelf. Jumpable, never duckable (CV-17). */
  height: number;
}

/**
 * A stretch of an upper-track shelf that gives way underfoot.
 *
 * Standing on it starts a short countdown; when that expires the shelf drops
 * the player onto the piste below. He does not die - the piste runs at the same
 * angle as the shelf above it, so the landing is clean - he loses the upper
 * line and the scoring that comes with it.
 *
 * The countdown is the whole design. Ice that broke on contact would be a
 * punishment for having taken the high line at all; ice that gives the player a
 * beat to launch off it is a decision he can win, and CV-18 keeps every span
 * short enough that a hop actually clears it.
 */
export interface IceSection {
  x0: number;
  x1: number;
}

export interface Kicker {
  /** Left edge of the ramp. The lip is at x + width. */
  x: number;
  width: number;
  /** Multiplier on carried speed. The launch impulse is power * speed. */
  power: number;
  /**
   * Direction of the launch, in degrees above the horizontal. Omitted means 90:
   * straight up, which is what every ramp did before this existed.
   *
   * Straight up is wrong for a booter and right for a hop. A shelf ramp only
   * has to lift the skier 50 units onto a platform 96 away, so all of its
   * impulse belongs in the vertical. A booter throwing 12.5 against a forward
   * speed of 4.2 leaves the lip at 71 degrees and returns at 71 degrees - it
   * tosses him up and drops him on the same spot, which reads as a fall rather
   * than a launch however much air it technically buys. Tilting the launch
   * forward spends the same impulse on distance instead of height, and lands
   * the apex back inside a 180-tall frame as a side effect.
   */
  launchAngle?: number;
  /**
   * Gravity multiplier while airborne from this launch. Omitted means 1.
   *
   * This exists because hang time and height are the same number. For any arc
   * under constant gravity the peak stands h = g*t^2/8 above the launch line,
   * so four times the hang time costs SIXTEEN times the height - 2,025 units
   * for 225 ticks, against a buffer 180 tall. There is no camera trick that
   * fits eleven screens of air into one; zooming out far enough leaves the
   * skier a pixel and a half, which rule LW-3 does not allow.
   *
   * Scaling gravity is the only remaining lever, and it is scoped to a single
   * launch rather than applied to the whole game so that ducking a bough, a
   * shelf hop and a fall through ice all keep the weight they were tuned with.
   * A booter floats; nothing else does.
   */
  gravityScale?: number;
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
  pickups: Pickup[];
  ledges: Ledge[];
  kickers: Kicker[];
  rocks: Rock[];
  ice: IceSection[];
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
  /**
   * How long one spin takes, start to finish. A spin is a fixed animation, not
   * a rate the player steers, so this is the only number that governs rotation.
   */
  spinDurationTicks: number;
  airControlFactor: number;
  landingAngleTolerance: number;
  landingAngleToleranceForgiving: number;
  collisionSpeedThreshold: number;
  standHeight: number;
  crouchHeight: number;
  crouchTransitionTicks: number;
  safeReleaseWindowMin: number;
  /** Vertical extent of a `low` obstacle's bough, hanging below its clearance. */
  branchThickness: number;
  /** Ceiling on a kicker launch, so a tucked approach cannot fling you off-course. */
  kickerImpulseMax: number;
  /** Ticks between setting foot on crumbling ice and falling through it. */
  iceCrumbleTicks: number;
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
}

/**
 * The inputs of contracts/controls.md.
 *
 * Two, not three: the attack verb is withdrawn (FR-114) along with the barriers
 * it acted on. Crouch-and-release plus rotate is the whole control surface.
 */
export interface RunInput {
  /** Held state. The RELEASE edge is what launches (FR-078). */
  crouch: boolean;
  /** -1, 0 or +1. Airborne only. */
  rotate: -1 | 0 | 1;
}

export type Outcome = 'running' | 'finished' | 'wiped_out';

export type WipeoutReason =
  | 'launched_into_obstacle'
  | 'bad_landing'
  | 'struck_obstacle'
  /** Touched down with a spin still turning. See FR-124. */
  | 'spun_out'
  | null;

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
  /**
   * Ticks left in the spin currently turning, or 0 when none is.
   *
   * A spin is committed: once started it runs to completion and the player
   * cannot stop, reverse or shorten it. Touching down while this is non-zero
   * ends the run (FR-124). That is the whole risk the trick bonus is paid for.
   */
  spinTicksLeft: number;
  /** Direction of the spin currently turning: -1, +1, or 0 when none is. */
  spinDir: -1 | 0 | 1;
  /**
   * Orientation the spin started from, restored exactly when it completes.
   *
   * A spin is a whole turn, so it must finish facing precisely where it began -
   * otherwise every trick would leave a little rotation error behind and a
   * player who landed several would fail an alignment check for reasons he
   * could neither see nor control. Rebuilding the orientation from this each
   * tick, rather than nudging it round, means the error never accumulates in
   * the first place.
   */
  spinFromOx: number;
  spinFromOy: number;
  /**
   * Rotate input as of the previous tick, so a spin can start on the PRESS.
   *
   * Held input would chain spins back to back for as long as the player leaned
   * on the key, which turns holding it into a way to die rather than a way to
   * score. The crouch release is derived from state the same way.
   */
  rotateHeld: -1 | 0 | 1;
  /**
   * Gravity multiplier in force right now: 1 on the ground and in an ordinary
   * air, less than 1 while floating a booter launch. Held in run state rather
   * than looked up per tick because the launch that set it is long past by the
   * time it matters, and the flight must not change weight halfway down.
   */
  gravityScale: number;
  grounded: boolean;
  /** Which surface the skier is riding: -1 for the piste, else an index into course.ledges. */
  ledge: number;
  crouchHeld: boolean;
  /** Ticks the crouch has been held, capped at chargeTicksToMax. */
  crouchCharge: number;
  /** 0 = standing, 1 = fully crouched. Transitions over crouchTransitionTicks. */
  crouchProfile: number;
  landingGraceTicks: number;
  /**
   * Ticks left before the ice underfoot gives way, or 0 when not standing on
   * any. Reset the moment the player leaves the ice, so a chain of hops across
   * a long field is a legitimate way through rather than a slow death.
   */
  crumbleTicks: number;
  score: number;
  /** Furthest x reached, so progress score cannot be farmed by oscillating. */
  maxX: number;
  /**
   * Distance credited so far, with the upper track's multiplier already applied.
   *
   * Progress cannot simply be read back from maxX any more: the same ground is
   * worth twice as much when it is covered on the upper track (FR-094), so what
   * a run earned depends on where it was, not only on how far it got. Only
   * newly covered ground is ever added, which is what keeps the doubling from
   * reopening the farming hole maxX was introduced to close.
   */
  progress: number;
  /**
   * What everything scored right now is multiplied by: the upper track's 2x, or
   * 1 on the piste.
   *
   * It tracks a ZONE rather than a surface, and only changes when the skier is
   * on the ground. Leaving a shelf carries the 2x through the whole air and
   * gives it up on landing back at piste level, so a trick thrown off the upper
   * track pays double even though it finishes on ordinary snow. One field
   * drives the scoring and the on-screen indicator, so what the player is told
   * and what he is paid cannot disagree.
   */
  scoreMultiplier: number;
  pickupsTaken: Uint8Array;
  /**
   * Which ice sections have already given way.
   *
   * Ice that crumbled leaves a hole, and a hole cannot catch anybody. Without
   * this the shelf re-caught the player on the very next tick after dropping
   * him through it: he leaves the surface at exactly the surface's height, and
   * the piste descends faster than a one-unit nudge, so every "is he falling
   * past the shelf" test said no. Recording the break is both the honest model
   * and the fix.
   */
  iceBroken: Uint8Array;
  outcome: Outcome;
  wipeoutReason: WipeoutReason;
}
