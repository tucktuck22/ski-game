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

/** Charge from this far out, and let go once inside the release window. */
const CHARGE_FROM = 90;
const RELEASE_WITHIN = 34;

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
