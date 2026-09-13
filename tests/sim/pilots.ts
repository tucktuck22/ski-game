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
/**
 * `passive` is feature 005's addition and it is not a skill level.
 *
 * It presses nothing, ever - the player who reads no badge and touches no
 * control. FR-192 and the "ignores every badge" edge case are both statements
 * about him, so he has to exist as a pilot rather than as an assumption.
 */
export type Pilot = 'tuck' | 'stay-low' | 'passive';

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

/** The speed these windows were originally calibrated against. */
const PILOT_SPEED = 5.5;

/**
 * The jump window, in TICKS. It used to be in units, and that was a bug.
 *
 * A launch is a race against arrival: the pilot must already be `standHeight`
 * high when the obstacle gets to him, and that is a question about TIME. The
 * old constants answered it in distance — `CLIMB_TICKS * PILOT_SPEED + 24` — so
 * they silently encoded a speed of 5.5, exactly as they had previously encoded
 * a gravity (see CLIMB_TICKS above, which was fixed for the same reason).
 *
 * Feature 006 made that assumption untenable and feature 005 made it visible.
 * Speed is now whatever the pitch is worth, from 1.05 on the coached section to
 * 5.9 on the steeps — a 5.6x range. At 79 units the pilot released 14 ticks out
 * at 5.5 and 49 ticks out at 1.6, against a min-charge hang of 30 ticks: he
 * landed a full 30 units short of the deadfall and rode into it standing. Three
 * separate pilots in this repository had the same bug and all three failed on
 * the same object, which is what a shared wrong assumption looks like.
 *
 * A human does not release at a fixed distance. He releases when the thing is
 * about to arrive, which is what these now say.
 *
 * The numbers are derived from the old ones at the speed they were calibrated
 * at, so a pilot riding at 5.5 behaves exactly as before and every other pilot
 * behaves correctly for the first time.
 */
export const RELEASE_TICKS = CLIMB_TICKS + 24 / PILOT_SPEED;

/**
 * How far out he starts charging, as a distance ahead of the release point.
 *
 * This one stays in UNITS, and deliberately. The old pair held the charge
 * window at a constant 85 units — so its DURATION already scaled with speed,
 * which is the right behaviour and is what decides how hard the pilot jumps
 * (`chargeTicksToMax` is 45, and at 5.5 an 85-unit window is only 15 ticks of
 * it). Converting this one to ticks as well would have quietly re-tuned how
 * hard every pilot in the suite jumps on every course, which is a much larger
 * change than the bug being fixed and not one this feature is entitled to make.
 *
 * So only the release point moves. The charge window is carried over exactly.
 */
const CHARGE_AHEAD = 85;

/**
 * The ORIGINAL fixed-distance window, kept for the booter measurement rig only.
 *
 * `tests/sim/booters.test.ts` is not a pilot that has to survive a course; it is
 * an instrument that measures how much air the official course's booters buy and
 * how many rotations fit in it. Its findings — 74 and 90 ticks, five and six
 * rotations, "no tick left on which a further one could be pressed" — were taken
 * with this approach, and by the rig's own admission they have zero margin.
 *
 * Moving the rig's approach changes what it measures. Doing so shifts the speed
 * at the lip by 0.2% and flips the five-rotation reading, with the booters, the
 * tuning and the official course all byte-identical. That is a change to the
 * instrument reported as a change in the product, so the instrument is held
 * still: the speed-aware window below fixes the pilots that have to RIDE
 * courses, and the rig keeps the calibration its baseline was taken at.
 *
 * The rig only ever runs on the official course, whose speed band is the one
 * these were calibrated for, so the bug they carry cannot bite there.
 */
export const RIG_RELEASE_WITHIN = Math.ceil(CLIMB_TICKS * PILOT_SPEED + 24);
export const RIG_CHARGE_FROM = RIG_RELEASE_WITHIN + CHARGE_AHEAD;

/**
 * The release point as a distance, for a pilot whose HORIZONTAL speed is `vx`.
 *
 * It must be vx and not `currentSpeed`. The gap these are compared against is
 * measured along x, so the conversion from ticks to units is x per tick and
 * nothing else. `currentSpeed` projects the whole velocity onto the slope, so
 * it grows with vy the moment the pilot leaves the ground — and an approach
 * flown off a previous feature then inflates its own release distance faster
 * than the gap closes, so the pilot sails past the release point without ever
 * having been inside it. Measured on the official course: speed read 3.9 rising
 * to 6.8 across one flight, the window grew 55 -> 97 units, and the pilot met
 * the deadfall at x=4640 with a crouch charge of exactly zero.
 *
 * Floored well below any legal terminal speed so a stalled sample cannot
 * produce a zero-width window and freeze the pilot mid-approach.
 */
export const releaseWithin = (vx: number): number => RELEASE_TICKS * Math.max(vx, 0.5);
export const chargeFrom = (vx: number): number => releaseWithin(vx) + CHARGE_AHEAD;

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
    const release = releaseWithin(s.vx);
    const charging = gap < chargeFrom(s.vx) && gap > release;
    const releasing = gap <= release && gap > -30;

    const input: RunInput = {
      crouch:
        pilot === 'passive'
          ? false
          : !releasing && (duck || charging || (pilot === 'tuck' && s.grounded && s.ledge < 0)),
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
