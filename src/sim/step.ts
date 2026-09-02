/**
 * The simulation.
 *
 * `step(state, input) -> state` is pure: no DOM, no I/O, no wall clock, no
 * unseeded randomness. That purity is what Principle II's determinism
 * requirement and Principle V's surviving reproducibility clause both rest on,
 * and it is what lets the monkey fuzz run headless at thousands of seeds.
 *
 * Given an identical course, seed, input sequence and rules version, this
 * produces an identical score (FR-026).
 */
import type { Course, RunInput, RunState, Scoring, Tuning } from './types.js';
import { cosDet } from './trig.js';
import { terrainYAt, surfaceYAt, onLedgeSpan } from './terrain.js';
import {
  resolveCrouch,
  applyGroundedMotion,
  applyAirborneMotion,
  applyKickers,
  resolveLanding,
} from './physics.js';
import { pickupValue, trickScore } from './scoring.js';
import { makeRng, nextU32, type RngState } from './rng.js';

/** Constants derived once from tuning, so the per-tick path does no trig. */
export interface DerivedTuning {
  cosTolerance: number;
  cosToleranceForgiving: number;
}

export const derive = (t: Tuning): DerivedTuning => ({
  cosTolerance: cosDet(t.landingAngleTolerance),
  cosToleranceForgiving: cosDet(t.landingAngleToleranceForgiving),
});

export function initialState(course: Course, tuning: Tuning, seed: number): RunState {
  const x = 0;
  const y = terrainYAt(course.terrain, x);
  // Seeded RNG is created even though placement is static in v1 (FR-086): it
  // exists so seeded variation can be added without changing the state shape.
  const rng: RngState = makeRng(seed);
  nextU32(rng);
  return {
    tick: 0,
    x,
    y,
    vx: tuning.baseSpeed,
    vy: 0,
    ox: 1,
    oy: 0,
    rotationAccum: 0,
    grounded: true,
    ledge: -1,
    crouchHeld: false,
    crouchCharge: 0,
    crouchProfile: 0,
    landingGraceTicks: 0,
    attackCooldown: 0,
    score: 0,
    maxX: 0,
    pickupsTaken: new Uint8Array(course.pickups.length),
    barriersBroken: new Uint8Array(course.barriers.length),
    outcome: 'running',
    wipeoutReason: null,
  };
}

export function cloneState(s: RunState): RunState {
  return {
    ...s,
    pickupsTaken: s.pickupsTaken.slice(),
    barriersBroken: s.barriersBroken.slice(),
  };
}

const wipeout = (s: RunState, reason: NonNullable<RunState['wipeoutReason']>): RunState => {
  s.outcome = 'wiped_out';
  s.wipeoutReason = reason;
  return s;
};

/**
 * Advances the simulation one 60 Hz tick. Returns a NEW state; the input state
 * is never mutated, so a caller can keep the previous state for render
 * interpolation.
 */
export function step(
  prev: RunState,
  input: RunInput,
  course: Course,
  tuning: Tuning,
  scoring: Scoring,
  derived: DerivedTuning,
): RunState {
  if (prev.outcome !== 'running') return prev;

  const s = cloneState(prev);
  const prevY = prev.y;
  s.tick += 1;
  if (s.landingGraceTicks > 0) s.landingGraceTicks -= 1;
  if (s.attackCooldown > 0) s.attackCooldown -= 1;

  // 1. Crouch, and the release edge that launches.
  const launch = resolveCrouch(s, input, tuning, course);
  if (launch.intoObstacle) return wipeout(s, 'launched_into_obstacle');

  // 2. Motion.
  if (s.grounded) applyGroundedMotion(s, course, tuning);
  else applyAirborneMotion(s, input, tuning);

  // 2b. Ramps. After motion so the launch scales with the speed actually
  // carried into the lip, and before integration so the impulse gets a tick to
  // lift him clear - see applyKickers.
  const kicked = applyKickers(s, course, tuning);

  // 3. Integrate (semi-implicit: velocity was updated first).
  s.x += s.vx;
  s.y += s.vy;
  if (s.x > s.maxX) s.maxX = s.x;

  // 3b. Ride off the end of the upper track. Nothing catches you at x1: the
  // ledge simply stops and you are in the air over the piste, holding the slope
  // you were already riding. That is why a ledge is a constant offset - the
  // piste below runs at the same angle, so the drop is always landable.
  if (s.grounded && s.ledge >= 0 && !onLedgeSpan(course, s.x, s.ledge)) {
    s.grounded = false;
    s.ledge = -1;
  }

  // 4. Ground contact.
  if (!s.grounded || launch.launched || kicked) {
    const landedCleanly = resolveLanding(
      s,
      course,
      tuning,
      derived.cosTolerance,
      derived.cosToleranceForgiving,
      prevY,
    );
    if (!landedCleanly) return wipeout(s, 'bad_landing');
    if (s.grounded && s.rotationAccum > 0) {
      s.score += trickScore(scoring, s.rotationAccum);
      s.rotationAccum = 0;
    }
  } else {
    s.y = surfaceYAt(course, s.x, s.ledge);
  }

  // 5. Attack, then barriers.
  if (input.attack && s.attackCooldown === 0) {
    s.attackCooldown = tuning.attackCooldownTicks;
    for (let i = 0; i < course.barriers.length; i++) {
      const b = course.barriers[i]!;
      if (s.barriersBroken[i] === 1) continue;
      if (b.x >= s.x && b.x <= s.x + tuning.attackReach) {
        s.barriersBroken[i] = 1;
        s.score += scoring.barrierBroken;
      }
    }
  }
  // A barrier blocks the ground line only. Going over it is the bypass FR-081
  // and CV-6 assume exists - breaking through is faster and scores, jumping it
  // costs the setup ticks. An unconditional wall would leave no "around", which
  // is what CV-6 measures against.
  for (let i = 0; i < course.barriers.length; i++) {
    const b = course.barriers[i]!;
    if (s.barriersBroken[i] === 1) continue;
    // A barrier stands on the piste. Riding the upper track carries you clean
    // over it - which is the point of the upper track, and is why breaking
    // through still has to beat the bypass on the lower line (CV-6).
    if (s.grounded && s.ledge < 0 && s.x >= b.x && s.x < b.x + b.width)
      return wipeout(s, 'struck_barrier');
  }

  // 6. Obstacles, with real vertical extent on both axes.
  //
  // y increases downward, the skier's feet are at s.y and his head at
  // s.y - height. A `low` obstacle is an overhanging bough: a slab occupying
  // [ground - clearance - branchThickness, ground - clearance]. You pass it by
  // ducking under it OR by clearing it from above, and the two ways out are the
  // reason it is a slab rather than the infinite ceiling it was first written
  // as - an infinite ceiling made every bough a wall to anyone on the upper
  // track, which is the whole reason that track exists. A `solid` obstacle is
  // deadfall lying on the ground: you pass it by going over.
  const height = tuning.standHeight - (tuning.standHeight - tuning.crouchHeight) * s.crouchProfile;
  const headY = s.y - height;
  const groundHere = terrainYAt(course.terrain, s.x);
  for (const o of course.obstacles) {
    if (s.x < o.x || s.x >= o.x + o.width) continue;
    if (o.kind === 'low') {
      const bottom = groundHere - o.clearance;
      const top = bottom - tuning.branchThickness;
      if (headY > bottom) continue; // wholly below the bough: ducked under
      if (s.y < top) continue; // wholly above it: cleared it
    } else {
      const blockTop = groundHere - tuning.standHeight;
      if (s.y <= blockTop) continue; // feet above the block
    }
    return wipeout(s, 'struck_obstacle');
  }

  // 7. Pickups.
  for (let i = 0; i < course.pickups.length; i++) {
    if (s.pickupsTaken[i] === 1) continue;
    const p = course.pickups[i]!;
    const dx = s.x - p.x;
    if (dx < -6 || dx > 6) continue;
    const surfaceY = terrainYAt(course.terrain, p.x);
    const dy = s.y - (surfaceY + p.y);
    if (dy < -8 || dy > 8) continue;
    s.pickupsTaken[i] = 1;
    s.score += pickupValue(scoring, p);
  }

  // 8. Finish.
  if (s.x >= course.length) {
    s.x = course.length;
    s.outcome = 'finished';
  }
  return s;
}
