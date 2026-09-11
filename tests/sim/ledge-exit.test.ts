import { describe, it, expect } from 'vitest';
import { derive, initialState, step } from '../../src/sim/step.js';
import { terminalSpeed } from '../../src/sim/slopeResponse.js';
import { slopeAt, surfaceYAt } from '../../src/sim/terrain.js';
import { PLAYER_LOOKAHEAD } from '../../src/render/stage.js';
import type { Course, RunState } from '../../src/sim/types.js';
import { official, scoring, tuning, warmup } from './fixtures.js';

/**
 * Riding off the end of a shelf, measured rather than bounded.
 *
 * CV-24 is the rule; this is the measurement it stands in for. The rule uses a
 * closed form with a margin on top, deliberately, because duplicating the
 * flight solver in the validator would be a second copy of the physics to drift
 * from the first. That leaves exactly one thing unproven: that the closed form
 * is still an OVER-estimate of the real flight. This file proves it by flying
 * the real one.
 *
 * The defect it exists for: a playtester rode off the Cornice, spun, and landed
 * into a bough that had not been on screen when he committed at the lip. The
 * shelf exit is the best air in the run and the course should be inviting it,
 * so the promise is stronger than "he does not hit anything" - it is that he is
 * back on his skis, with clear snow ahead, before the next obstacle is even
 * drawn.
 */

const derived = derive(tuning);

/**
 * Where on the shelf to start the run-up.
 *
 * Behind the lip, but past every rock and ice band the shelf carries: those are
 * the upper track's own tests and upper-hazards.test.ts already flies them. A
 * run-up that starts inside a rock reports a rock, not an exit.
 */
function runUpFrom(course: Course, li: number): number {
  const l = course.ledges[li]!;
  let x = l.x1 - 260;
  for (const r of course.rocks) if (r.x + r.width > x && r.x < l.x1) x = r.x + r.width + 8;
  for (const b of course.ice) if (b.x1 > x && b.x0 < l.x1) x = b.x1 + 8;
  return x < l.x0 ? l.x0 : x;
}

/** Places a skier on the shelf, carrying `entry` speed, tucked and fully charged. */
function onShelf(course: Course, li: number, entry: number): RunState {
  const x = runUpFrom(course, li);
  const slope = slopeAt(course.terrain, x);
  const s = initialState(course, tuning, 1);
  s.x = x;
  s.ledge = li;
  s.y = surfaceYAt(course, x, li);
  s.vx = entry * slope.ux;
  s.vy = entry * slope.uy;
  s.ox = slope.ux;
  s.oy = slope.uy;
  s.crouchProfile = 1;
  s.crouchHeld = true;
  s.crouchCharge = tuning.chargeTicksToMax;
  return s;
}

interface Exit {
  landX: number;
  airTicks: number;
  outcome: RunState['outcome'];
}

/**
 * Rides to the lip and off it. `jump` releases the charged crouch just short of
 * the end - a release AT the lip does nothing, because step 3b has already put
 * him in the air and resolveCrouch only fires from the ground.
 */
function rideOff(course: Course, li: number, entry: number, jump: boolean): Exit {
  const l = course.ledges[li]!;
  let s = onShelf(course, li, entry);
  let airTicks = 0;
  for (let t = 0; t < 900 && s.outcome === 'running'; t++) {
    const crouch = !(jump && s.x >= l.x1 - 4 && s.x < l.x1);
    s = step(s, { crouch, rotate: 0 }, course, tuning, scoring, derived);
    if (s.x >= l.x1) {
      airTicks++;
      if (s.grounded) break;
    }
  }
  return { landX: s.x, airTicks, outcome: s.outcome };
}

describe.each([
  ['warm-up', warmup],
  ['official', official],
])('%s: every shelf exit lands on open snow', (_name, course: Course) => {
  // speedMax is unreachable on any shelf the course actually builds, which is
  // the point of testing it: the promise has to hold for the fastest skier the
  // simulation permits, not only for the one the terrain produces.
  const entries = [undefined, tuning.speedMax];

  course.ledges.forEach((l, li) => {
    // CV-12 permits a shelf to run to x1 = length exactly, and the last one on
    // the official course does: the two tracks resolve AT the line rather than
    // petering out short of it. There is no exit to protect - crossing the line
    // ends the run - so there is nothing here to test.
    if (l.x1 >= course.length) return;

    for (const entry of entries) {
      for (const jump of [false, true]) {
        const label =
          `shelf ${l.x0}-${l.x1}, ${jump ? 'jumping the lip' : 'riding off'}, ` +
          `${entry === undefined ? 'at terminal' : 'at speedMax'}`;

        it(label, () => {
          const speed =
            entry ?? terminalSpeed(slopeAt(course.terrain, runUpFrom(course, li)), tuning, true);
          const exit = rideOff(course, li, speed, jump);

          // He survives the drop. A shelf is a constant offset above a piste of
          // the same angle, so this can only fail if something is standing in
          // the flight.
          expect(exit.outcome).toBe('running');

          // The flight is inside the bound CV-24 certifies it against. If this
          // fails, the validator is passing courses it should be refusing.
          const impulse = tuning.launchImpulseMax;
          const bound =
            l.x1 +
            ((impulse + Math.sqrt(impulse * impulse + 2 * tuning.gravity * l.height)) /
              tuning.gravity) *
              terminalSpeed(slopeAt(course.terrain, l.x1), tuning, true) *
              1.3;
          if (entry === undefined) expect(exit.landX).toBeLessThanOrEqual(bound);

          // And the next obstacle is not merely un-struck: it is still off the
          // right-hand edge of the screen when his skis touch down.
          const next = course.obstacles.find((o) => o.x + o.width > l.x1);
          if (next && next.x < course.length) {
            expect(next.x - PLAYER_LOOKAHEAD).toBeGreaterThan(exit.landX);
          }
        });
      }
    }
  });
});
