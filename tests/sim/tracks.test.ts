import { describe, it, expect } from 'vitest';
import { derive, initialState, step } from '../../src/sim/step.js';
import { finalScore } from '../../src/sim/scoring.js';
import type { Course, RunInput } from '../../src/sim/types.js';
import { official, warmup, scoring, tuning } from './fixtures.js';

/**
 * The upper track has to be a CHOICE, and this is where that is proved.
 *
 * CV-13 checks the arithmetic of it against the data — a ramp's apex at base
 * speed against the shelf height — but arithmetic on the tuning file is not the
 * same claim as "two pilots actually ride two different lines and both get
 * down". Only the simulation can say that, so it is asserted here against the
 * shipped courses rather than against a fixture.
 *
 * If a future tuning change makes ramps stronger, the cautious pilot starts
 * being thrown onto a shelf he never asked for and the second test fails. If it
 * makes them weaker, the upper track quietly becomes scenery and the first one
 * does. Both directions are caught.
 */
type Pilot = 'tuck' | 'stay-low';

interface Ride {
  outcome: string;
  wipeoutReason: string | null;
  ticksOnShelf: number;
  shelvesRidden: number;
  largePickups: number;
  score: number;
}

/**
 * One pilot, played by rule rather than by trace.
 *
 * Both pilots duck the boughs and jump the deadfall — that is the floor of
 * skill FR-035 describes. The ONLY difference between them is
 * whether they hold a tuck on the open piste, which is the single decision the
 * whole two-track design hangs on.
 */
function ride(course: Course, pilot: Pilot, seed: number): Ride {
  const derived = derive(tuning);
  let s = initialState(course, tuning, seed);
  const boughs = course.obstacles.filter((o) => o.kind === 'low');
  const deadfall = course.obstacles.filter((o) => o.kind === 'solid');

  let ticksOnShelf = 0;
  const shelves = new Set<number>();

  while (s.outcome === 'running' && s.tick < 18_000) {
    const duck = boughs.some((o) => s.x + 30 >= o.x && s.x < o.x + o.width);
    const next = deadfall.find((o) => o.x + o.width > s.x);
    const gap = next ? next.x - s.x : Infinity;
    // Charge on approach, then let go at the lip: the release IS the jump
    // (FR-078), so a pilot who simply stays crouched rides into the log.
    const charging = gap < 90 && gap > 34;
    const releasing = gap <= 34 && gap > -30;
    const input: RunInput = {
      crouch: !releasing && (duck || charging || (pilot === 'tuck' && s.grounded && s.ledge < 0)),
      rotate: 0,
    };
    s = step(s, input, course, tuning, scoring, derived);
    if (s.ledge >= 0) {
      ticksOnShelf++;
      shelves.add(s.ledge);
    }
  }

  const largePickups = course.pickups.filter(
    (p, i) => s.pickupsTaken[i] === 1 && p.value === 'large',
  ).length;

  return {
    outcome: s.outcome,
    wipeoutReason: s.wipeoutReason,
    ticksOnShelf,
    shelvesRidden: shelves.size,
    largePickups,
    score: finalScore(s, scoring),
  };
}

describe('the upper track is a choice, not a toll gate', () => {
  it('a pilot who never tucks rides the whole official course on the piste', () => {
    // The cautious pilot of SC-015 and FR-035. He must finish, and he must
    // never find himself on a shelf he did not earn.
    const r = ride(official, 'stay-low', 19860214);
    expect(r.wipeoutReason).toBe(null);
    expect(r.outcome).toBe('finished');
    expect(r.ticksOnShelf).toBe(0);
  });

  it('a pilot who carries speed into the ramps rides every shelf and finishes', () => {
    const r = ride(official, 'tuck', 19860214);
    expect(r.wipeoutReason).toBe(null);
    expect(r.outcome).toBe('finished');
    expect(r.shelvesRidden).toBe(official.ledges.length);
  });

  it('the upper line pays materially better than the lower one', () => {
    // Without this the fork is a graphic, not a decision. The gap is what the
    // player is actually choosing between when he decides whether to tuck.
    const low = ride(official, 'stay-low', 19860214);
    const high = ride(official, 'tuck', 19860214);
    expect(high.largePickups).toBeGreaterThan(low.largePickups);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('both lines get down the warm-up course too', () => {
    for (const pilot of ['stay-low', 'tuck'] as const) {
      const r = ride(warmup, pilot, 20250901);
      expect(r.outcome).toBe('finished');
    }
  });
});
