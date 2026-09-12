import { derive, initialState, step } from '../../src/sim/step.js';
import { MAX_TICKS } from '../../src/sim/run.js';
import type { Course, RunInput, RunState } from '../../src/sim/types.js';
import { scoring, tuning } from './fixtures.js';

/**
 * Two pilots, played by rule, sharing every skill except one decision.
 *
 * They live here rather than in a test file because more than one test needs
 * them and they had already drifted apart once: when the upper track grew
 * hazards of its own, one copy learned about rocks and the other did not, and
 * the difference read as a simulation bug rather than as a stale pilot.
 *
 * Both duck boughs, jump deadfall, jump rocks and hop crumbling ice — that is
 * the floor of competent play. The ONLY difference between them is whether they
 * hold a tuck on the open piste, which is the single decision the whole
 * two-track design hangs on.
 */
export type Pilot = 'tuck' | 'stay-low';

export interface Ride {
  state: RunState;
  ticksOnShelf: number;
  shelvesRidden: number;
  fellThroughIce: number;
  largePickups: number;
}

/**
 * Charge from this far out, and let go once inside the release window.
 *
 * DERIVED, not chosen. These were 90 and 34 and they silently encoded a
 * gravity: a launch climbs at `impulse` per tick, and halving gravity on
 * 2026-09-11 halved the impulse with it (to hold the apex), so every jump now
 * reaches the same height more SLOWLY. Releasing 34 units out put the pilot
 * 14.6 up at a log that needs 16 and he rode straight into it — on a course the
 * validator passes, which a person clears simply by letting go earlier.
 *
 * So the release point is solved from the physics instead. Time to climb
 * standHeight is the smaller root of `impulse*t - gravity*t^2/2 = standHeight`,
 * and the pilot must already be that high when the log arrives.
 */
const CLIMB_TICKS = (() => {
  const a = tuning.gravity / 2;
  const b = tuning.launchImpulseMin;
  const disc = b * b - 4 * a * tuning.standHeight;
  // A launch that cannot clear a standing skier at all would be a tuning bug,
  // not a pilot one; fall back to something finite so the failure reads clearly.
  return disc <= 0 ? 40 : (b - Math.sqrt(disc)) / (2 * a);
})();

/** A generous ride speed, so the window is wide enough at tuck pace too. */
const PILOT_SPEED = 5.5;

export const RELEASE_WITHIN = Math.ceil(CLIMB_TICKS * PILOT_SPEED + 24);
export const CHARGE_FROM = RELEASE_WITHIN + 85;

export function ride(course: Course, pilot: Pilot, seed: number): Ride {
  const derived = derive(tuning);
  let s = initialState(course, tuning, seed);

  const boughs = course.obstacles.filter((o) => o.kind === 'low');
  const deadfall = course.obstacles.filter((o) => o.kind === 'solid');

  let ticksOnShelf = 0;
  let fellThroughIce = 0;
  const shelves = new Set<number>();

  while (s.outcome === 'running' && s.tick < MAX_TICKS) {
    const onShelf = s.grounded && s.ledge >= 0;

    // Everything this pilot has to launch over, on whichever surface he is on.
    // Rocks and ice belong to the shelf, deadfall to the piste, so which list
    // applies is decided by where his feet are — the same way the collisions are.
    const hazards = onShelf
      ? [
          ...course.rocks.map((r) => r.x),
          // Ice is cleared by hopping it, so the thing to aim at is its leading
          // edge rather than its middle.
          ...course.ice.map((i) => i.x0),
        ]
      : deadfall.map((o) => o.x);

    let gap = Infinity;
    for (const hx of hazards) {
      const d = hx - s.x;
      if (d > -30 && d < gap) gap = d;
    }

    const duck = !onShelf && boughs.some((o) => s.x + 30 >= o.x && s.x < o.x + o.width);
    // Charge on approach, then let go at the lip: the release IS the jump
    // (FR-078), so a pilot who simply stays crouched rides into the obstacle.
    const charging = gap < CHARGE_FROM && gap > RELEASE_WITHIN;
    const releasing = gap <= RELEASE_WITHIN && gap > -30;

    const input: RunInput = {
      crouch: !releasing && (duck || charging || (pilot === 'tuck' && s.grounded && s.ledge < 0)),
      rotate: 0,
    };

    const before = s;
    s = step(s, input, course, tuning, scoring, derived);

    if (s.ledge >= 0) {
      ticksOnShelf++;
      shelves.add(s.ledge);
    }
    if (before.ledge >= 0 && s.ledge < 0 && !s.grounded) {
      // Either the shelf ran out or the ice gave way; only the second changes
      // the broken-ice record.
      for (let i = 0; i < s.iceBroken.length; i++) {
        if (s.iceBroken[i] === 1 && before.iceBroken[i] === 0) fellThroughIce++;
      }
    }
  }

  const largePickups = course.pickups.filter(
    (p, i) => s.pickupsTaken[i] === 1 && p.value === 'large',
  ).length;

  return { state: s, ticksOnShelf, shelvesRidden: shelves.size, fellThroughIce, largePickups };
}
