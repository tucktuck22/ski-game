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
import { terrainYAt, surfaceYAt, onLedgeSpan, iceIndexAt, ledgeIndexAt } from './terrain.js';
import {
  resolveCrouch,
  applyGroundedMotion,
  applyAirborneMotion,
  applyKickers,
  resolveLanding,
} from './physics.js';
import { pickupValue, trickScore, UPPER_TRACK_MULTIPLIER } from './scoring.js';
import { makeRng, nextU32, type RngState } from './rng.js';

/** Constants derived once from tuning, so the per-tick path does no trig. */
export interface DerivedTuning {
  cosTolerance: number;
  cosToleranceForgiving: number;
}

/** Re-exported so callers of the simulation need only one import. */
export { UPPER_TRACK_MULTIPLIER } from './scoring.js';

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
    spinTicksLeft: 0,
    spinDir: 0,
    spinFromOx: 1,
    spinFromOy: 0,
    rotateHeld: 0,
    gravityScale: 1,
    grounded: true,
    ledge: -1,
    crouchHeld: false,
    crouchCharge: 0,
    crouchProfile: 0,
    landingGraceTicks: 0,
    crumbleTicks: 0,
    score: 0,
    maxX: 0,
    progress: 0,
    scoreMultiplier: 1,
    pickupsTaken: new Uint8Array(course.pickups.length),
    iceBroken: new Uint8Array(course.ice.length),
    outcome: 'running',
    wipeoutReason: null,
  };
}

export function cloneState(s: RunState): RunState {
  return { ...s, pickupsTaken: s.pickupsTaken.slice(), iceBroken: s.iceBroken.slice() };
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
  if (s.x > s.maxX) {
    // FR-094: ground covered in the upper track's zone is worth double.
    // Credited only for the stretch beyond maxX, so riding back and forth over
    // one shelf pays exactly once - the farming protection maxX exists for,
    // preserved through the multiplier rather than replaced by it. The
    // multiplier still holds last tick's value here, which is the zone the
    // ground was actually covered in.
    s.progress += (s.x - s.maxX) * s.scoreMultiplier;
    s.maxX = s.x;
  }

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
    const contact = resolveLanding(
      s,
      course,
      tuning,
      derived.cosTolerance,
      derived.cosToleranceForgiving,
      prevY,
    );
    // FR-124: a spin still turning at touchdown ends the run, and it is checked
    // before alignment so the player is told which mistake he made. He would
    // have failed the alignment test too - mid-spin he is pointing anywhere -
    // but "you ran out of air" and "you landed crooked" are different lessons.
    if (contact !== 'airborne' && s.spinTicksLeft > 0) return wipeout(s, 'spun_out');
    if (contact === 'misaligned') return wipeout(s, 'bad_landing');
    if (contact === 'landed' && s.rotationAccum > 0) {
      s.score += trickScore(scoring, s.rotationAccum, s.scoreMultiplier);
      s.rotationAccum = 0;
    }
  } else {
    s.y = surfaceYAt(course, s.x, s.ledge);
  }

  // 4b. Crumbling ice.
  //
  // Only underfoot, and only on a shelf: ice is a property of the upper track,
  // and a player flying over it has not stood on it. Leaving the ice clears the
  // countdown outright rather than pausing it, which is what makes hopping
  // across a long field a real way through instead of a stay of execution.
  const iceHere = s.grounded && s.ledge >= 0 ? iceIndexAt(course, s.x) : -1;
  if (iceHere >= 0 && s.iceBroken[iceHere] === 0) {
    if (s.crumbleTicks === 0) s.crumbleTicks = tuning.iceCrumbleTicks;
    else s.crumbleTicks -= 1;
    if (s.crumbleTicks === 0) {
      // Through it. Not a wipeout - he keeps the run and loses the line. The
      // shelf and the piste share a slope, so what he lands on below is an
      // angle he was already riding (see the Ledge doc comment).
      s.iceBroken[iceHere] = 1;
      s.grounded = false;
      s.ledge = -1;
    }
  } else {
    s.crumbleTicks = 0;
  }

  // 5. Obstacles, with real vertical extent on both axes.
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

  // 6. Pickups.
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

  // 5b. Rocks on the upper track.
  //
  // Tested by position rather than by track, so a player skimming just above a
  // shelf hits the rock standing on it exactly as a player riding the shelf
  // does. The `s.y <= ledgeY` half is what keeps it honest in the other
  // direction: a shelf is a one-way platform, so someone passing UNDER it must
  // not be stopped by something sitting on top of it.
  for (const rock of course.rocks) {
    if (s.x < rock.x || s.x >= rock.x + rock.width) continue;
    const shelf = ledgeIndexAt(course, s.x);
    if (shelf < 0) continue;
    const ledgeY = surfaceYAt(course, s.x, shelf);
    if (s.y > ledgeY) continue; // below the shelf entirely
    if (s.y <= ledgeY - rock.height) continue; // feet above the rock
    return wipeout(s, 'struck_obstacle');
  }

  // 6b. Settle the scoring zone, and remember the rotate input so the next tick
  // can see a press rather than a hold. Both last, so everything above read the
  // PREVIOUS tick's values.
  //
  // The multiplier only moves while the skier is on the ground. That is what
  // carries the upper track's 2x through an air that starts on a shelf and ends
  // on the piste, and it is why the trick award above is paid at the rate of
  // the air rather than of the snow he landed on.
  // Back on snow, back to full weight. A float belongs to one launch; carrying
  // it into the next air would make the booter a state the player is stuck in.
  if (s.grounded) s.gravityScale = 1;
  if (s.grounded) s.scoreMultiplier = s.ledge >= 0 ? UPPER_TRACK_MULTIPLIER : 1;
  s.rotateHeld = input.rotate;

  // 7. Finish.
  if (s.x >= course.length) {
    s.x = course.length;
    s.outcome = 'finished';
  }
  return s;
}
