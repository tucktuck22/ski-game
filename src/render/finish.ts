/**
 * The finish: the ground past the line, the coast to a stop, and the crowd.
 * Feature 009, specs/009-finish-line-crowd.
 *
 * Everything here is drawing. The simulation ends a run on the tick the skier
 * reaches the course's length, exactly as it always has; what happens after
 * that is this file's, in the way the wipeout's tumble is death.ts's. Nothing in
 * src/sim may import it (contract F7), so nothing here can reach a run, a score
 * or the rules version (FR-264).
 */
import type { Course, RunState } from '../sim/types.js';
import type { MotionSettings } from './reducedMotion.js';
import type { FinishConfig } from '../data/load.js';
import { terrainYAt } from '../sim/terrain.js';

/** The slope of the course where it ends: the segment the line stands on. */
function slopeAtLine(course: Course): number {
  const L = course.length;
  return terrainYAt(course.terrain, L) - terrainYAt(course.terrain, L - 1);
}

/** Spacing of the run-out's points: close enough that no joint reads as a corner. */
const RUNOUT_STEP = 4;
/** How far the flat beyond the run-out is carried, past anything a camera shows. */
const FLAT_REACH = 5000;

const shownCache = new WeakMap<Course, WeakMap<FinishConfig, Course>>();

/**
 * The course as the renderer draws it: identical up to the line, then a run-out
 * that eases to flat (research R1).
 *
 * The data cannot carry the run-out. Both courses end on 0.6 ground that kinks
 * flat 200 units past the line, and flat ground in the data fails CV-23 and B8,
 * which check every segment. So the renderer and the camera draw from this copy
 * and the simulation keeps riding the original, which it only ever reads up to
 * the line. Up to the line the terrain is the course's own points, untouched -
 * exactly, not approximately (F1) - and past it the points follow a quadratic
 * with the course's slope at the line and none at `runoutEase`. On its last tick
 * the simulation can travel one tick past the line before it clamps; over that
 * stretch the two grounds differ by under 0.25 units.
 */
export function withRunout(course: Course, cfg: FinishConfig): Course {
  let byCfg = shownCache.get(course);
  if (!byCfg) shownCache.set(course, (byCfg = new WeakMap()));
  const hit = byCfg.get(cfg);
  if (hit) return hit;

  const L = course.length;
  const y0 = terrainYAt(course.terrain, L);
  const g = slopeAtLine(course);
  const E = cfg.runoutEase;
  const terrain = course.terrain.filter((p) => p.x < L);
  terrain.push({ x: L, y: y0 });
  for (let u = RUNOUT_STEP; u < E; u += RUNOUT_STEP)
    terrain.push({ x: L + u, y: y0 + g * u - (g * u * u) / (2 * E) });
  const yEnd = y0 + (g * E) / 2;
  terrain.push({ x: L + E, y: yEnd }, { x: L + E + FLAT_REACH, y: yEnd });

  const shown: Course = { ...course, terrain };
  byCfg.set(cfg, shown);
  return shown;
}

/** The drawn ground's height at x: the course's own up to the line, the run-out past it. */
export function groundY(course: Course, x: number, cfg: FinishConfig): number {
  return terrainYAt(withRunout(course, cfg).terrain, x);
}

// ---------------------------------------------------------------------------
// The gantry (FN-1)
// ---------------------------------------------------------------------------

/** The banner's depth. Drawing only: four rows of 4-unit checks, less a border. */
export const BANNER_HEIGHT = 14;

export interface Gantry {
  /** The line: the course's length. */
  x: number;
  /** The piste at the line, where the post stands. */
  footY: number;
  /** The crossbar, `gantryHeight` above the piste. */
  topY: number;
  bannerLeft: number;
  bannerRight: number;
  bannerTop: number;
  bannerBottom: number;
}

/** Where the gantry stands and hangs. Shared by the renderer and test F6. */
export function gantryOf(course: Course, cfg: FinishConfig): Gantry {
  const x = course.length;
  const footY = terrainYAt(course.terrain, x);
  const topY = footY - cfg.gantryHeight;
  return {
    x,
    footY,
    topY,
    bannerLeft: x - cfg.bannerWidth / 2,
    bannerRight: x + cfg.bannerWidth / 2,
    bannerTop: topY,
    bannerBottom: topY + BANNER_HEIGHT,
  };
}

// ---------------------------------------------------------------------------
// The finish sequence (R2, R3, R7)
// ---------------------------------------------------------------------------

export type FinishPhase = 'airborne' | 'braking' | 'stopped';

/** The fewest ticks over which an airborne skier's orientation settles (R2). */
const MIN_SETTLE_TICKS = 8;
/** However late he lands, the slide is never shorter than this: no instant stops. */
const MIN_BRAKE_TICKS = 20;
/** Below this he is drawn standing rather than braking. */
export const STANDING_SPEED = 1;

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * A skip is a NEW press: a tap, or a key going down that was not already held
 * (research R4). Browsers repeat `keydown` while a key stays held, flagged
 * `repeat`, and most players are holding the tuck key as they cross the line.
 */
export function isNewPress(e: { type: string; repeat?: boolean }): boolean {
  if (e.type === 'pointerdown') return true;
  return e.type === 'keydown' && e.repeat !== true;
}

export interface SprayParticle {
  x: number;
  y: number;
  /** Ticks left, out of SPRAY_LIFE. */
  life: number;
}

export const SPRAY_LIFE = 18;

/**
 * What happens after the line: the skier carries on, comes down if he is in the
 * air, and brakes to a stop in the finish area, while the view holds on the
 * mountain (FR-265 to FR-270).
 *
 * The simulation has stopped by then, as it has during the wipeout, so this is
 * a small integrator of its own, seeded from the final RunState and advanced
 * once per simulation tick - never per frame, so the beat is the same on every
 * display (R3). It produces a RunState-shaped skier for the renderer; nothing
 * it produces is ever fed back to the simulation.
 *
 * `course` is the course as drawn (`withRunout`), since the skier coasts over
 * the run-out.
 */
export class FinishSequence {
  private state: RunState | null = null;
  private ticks = 0;
  private total = 0;
  private skipped = false;
  private animated = true;
  private phaseNow: FinishPhase = 'stopped';
  private brake = 0;
  /** Airborne: the orientation he left the line with, and how long it settles over. */
  private angle0 = 0;
  private settleTicks = MIN_SETTLE_TICKS;
  private settled = 0;
  private particles: SprayParticle[] = [];

  constructor(
    private readonly course: Course,
    private readonly cfg: FinishConfig,
    private readonly gravity: number,
    private readonly cameraXOffset: number,
  ) {}

  start(final: RunState, motion: MotionSettings): void {
    if (this.state) return;
    this.animated = motion.shake;
    this.total = motion.shake ? this.cfg.holdTicks : this.cfg.reducedHoldTicks;
    this.ticks = 0;
    const s: RunState = { ...final };
    this.angle0 = Math.atan2(s.oy, s.ox);
    // Every shelf ends at or before the line, so a shelf rider leaves it here.
    const onGround = s.grounded && s.ledge < 0;
    if (onGround) {
      this.phaseNow = 'braking';
      this.touchDown(s);
    } else {
      this.phaseNow = 'airborne';
      s.grounded = false;
      s.ledge = -1;
      this.settleTicks = Math.max(MIN_SETTLE_TICKS, this.ticksToLand(s));
      this.settled = 0;
    }
    this.state = s;
  }

  /** How many ticks a ballistic flight from `s` takes to meet the drawn ground. */
  private ticksToLand(s: RunState): number {
    let { x, y, vy } = s;
    for (let t = 1; t <= 600; t++) {
      vy += this.gravity;
      x += s.vx;
      y += vy;
      if (y >= groundY(this.course, x, this.cfg)) return t;
    }
    return 600;
  }

  private slopeAngle(x: number): number {
    const g = groundY(this.course, x + 0.5, this.cfg) - groundY(this.course, x - 0.5, this.cfg);
    return Math.atan2(g, 1);
  }

  private touchDown(s: RunState): void {
    s.grounded = true;
    s.ledge = -1;
    s.vy = 0;
    s.y = groundY(this.course, s.x, this.cfg);
    const v = Math.max(s.vx, 0);
    // Whichever stops him sooner: within stopDistance units, or by stopWithinTicks
    // after the CROSSING. Counted from the line, not from touchdown, so time spent
    // falling past it comes out of the slide instead of the stop no one sees - the
    // cautious rider crosses the official line in the air.
    const left = Math.max(this.cfg.stopWithinTicks - this.ticks, MIN_BRAKE_TICKS);
    this.brake = Math.max((v * v) / (2 * this.cfg.stopDistance), v / left);
    if (v === 0) this.phaseNow = 'stopped';
  }

  /** One simulation tick. */
  advance(): void {
    const s = this.state;
    if (!s || this.done) return;
    this.ticks += 1;
    s.tick += 1;

    if (this.phaseNow === 'airborne') {
      s.vy += this.gravity;
      s.x += s.vx;
      s.y += s.vy;
      if (s.y >= groundY(this.course, s.x, this.cfg)) {
        this.phaseNow = 'braking';
        this.touchDown(s);
      }
    } else if (this.phaseNow === 'braking') {
      s.x += s.vx;
      s.vx = Math.max(0, s.vx - this.brake);
      s.y = groundY(this.course, s.x, this.cfg);
      if (this.animated && s.vx > STANDING_SPEED) this.spray(s);
      if (s.vx === 0) this.phaseNow = 'stopped';
    }

    // Orientation: from however he crossed the line to the ground under him,
    // linearly over the settle, and along the ground from then on (FR-270).
    this.settled = Math.min(this.settled + 1, this.settleTicks);
    const k = this.settleTicks > 0 ? this.settled / this.settleTicks : 1;
    const target = this.slopeAngle(s.x);
    const a = this.angle0 + wrap(target - this.angle0) * k;
    s.ox = Math.cos(a);
    s.oy = Math.sin(a);
    s.crouchProfile = 0;
    s.crouchHeld = false;

    for (const p of this.particles) p.life -= 1;
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private spray(s: RunState): void {
    // Deterministic: placed by the tick, never by Math.random, so the same run
    // throws the same snow.
    const h = Math.sin(s.tick * 12.9898) * 43758.5453;
    const f = h - Math.floor(h);
    this.particles.push({ x: s.x + 4 + f * 6, y: s.y - 1 - f * 4, life: SPRAY_LIFE });
    if (this.particles.length > 40) this.particles.shift();
  }

  skip(): void {
    if (this.state) this.skipped = true;
  }

  get started(): boolean {
    return this.state !== null;
  }

  get active(): boolean {
    return this.state !== null && !this.done;
  }

  get done(): boolean {
    return this.state !== null && (this.skipped || this.ticks >= this.total);
  }

  get phase(): FinishPhase {
    return this.phaseNow;
  }

  get elapsed(): number {
    return this.ticks;
  }

  get holdTicks(): number {
    return this.total;
  }

  /** The skier to draw. Null before the line. */
  skier(): RunState | null {
    return this.state;
  }

  /**
   * The camera's x during the hold (R7). Follows as in a run until the line is
   * `frameLead` inside the left edge, holds there so the gantry and the crowd
   * share the frame, and follows again rather than let the skier pass
   * `frameFollow` into it. Continuous at both switches.
   */
  cameraX(): number {
    const x = this.state ? this.state.x : this.course.length;
    const L = this.course.length;
    return Math.max(
      Math.min(x - this.cameraXOffset, L - this.cfg.frameLead),
      x - this.cfg.frameFollow,
    );
  }

  /** Snow thrown off the skis while braking. Empty under reduced motion. */
  sprayParticles(): readonly SprayParticle[] {
    return this.particles;
  }
}
