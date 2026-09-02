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
import { terrainYAt } from './terrain.js';
import {
  resolveCrouch,
  applyGroundedMotion,
  applyAirborneMotion,
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
  s.tick += 1;
  if (s.landingGraceTicks > 0) s.landingGraceTicks -= 1;
  if (s.attackCooldown > 0) s.attackCooldown -= 1;

  // 1. Crouch, and the release edge that launches.
  const launch = resolveCrouch(s, input, tuning, course);
  if (launch.intoObstacle) return wipeout(s, 'launched_into_obstacle');

  // 2. Motion.
  if (s.grounded) applyGroundedMotion(s, course, tuning);
  else applyAirborneMotion(s, input, tuning);

  // 3. Integrate (semi-implicit: velocity was updated first).
  s.x += s.vx;
  s.y += s.vy;
  if (s.x > s.maxX) s.maxX = s.x;

  // 4. Ground contact.
  if (!s.grounded || launch.launched) {
    const landedCleanly = resolveLanding(
      s,
      course,
      tuning,
      derived.cosTolerance,
      derived.cosToleranceForgiving,
    );
    if (!landedCleanly) return wipeout(s, 'bad_landing');
    if (s.grounded && s.rotationAccum > 0) {
      s.score += trickScore(scoring, s.rotationAccum);
      s.rotationAccum = 0;
    }
  } else {
    s.y = terrainYAt(course.terrain, s.x);
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
    if (s.grounded && s.x >= b.x && s.x < b.x + b.width) return wipeout(s, 'struck_barrier');
  }

  // 6. Obstacles, with real vertical extent.
  //
  // y increases downward, the skier's feet are at s.y and his head at
  // s.y - height. A `low` obstacle is a ceiling whose underside sits `clearance`
  // above the ground: you pass by ducking under it, and jumping into it hits it.
  // A `solid` obstacle is a block standing on the ground: you pass by going over.
  // Testing only the x-range - as this did first - meant a skier flying well
  // above a solid obstacle still collided, which left nothing jumpable.
  const height = tuning.standHeight - (tuning.standHeight - tuning.crouchHeight) * s.crouchProfile;
  const groundHere = terrainYAt(course.terrain, s.x);
  for (const o of course.obstacles) {
    if (s.x < o.x || s.x >= o.x + o.width) continue;
    if (o.kind === 'low') {
      const ceilingUnderside = groundHere - o.clearance;
      if (s.y - height > ceilingUnderside) continue; // head below the ceiling
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
