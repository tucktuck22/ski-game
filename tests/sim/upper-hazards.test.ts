import { describe, it, expect } from 'vitest';
import { derive, initialState, step } from '../../src/sim/step.js';
import { MAX_TICKS } from '../../src/sim/run.js';
import type { RunInput, RunState } from '../../src/sim/types.js';
import { finalScore } from '../../src/sim/scoring.js';
import { ride } from './pilots.js';
import { official, scoring, tuning } from './fixtures.js';

/**
 * The upper track's own hazards: crumbling ice (FR-116) and rocks (FR-117).
 *
 * These exist to make the high line a gamble rather than a strictly better
 * road, so the properties that matter are the ones that decide what taking it
 * costs. Falling through ice must cost the LINE and not the RUN; a rock must
 * cost the run if it is ignored; and neither may reach a player on the piste
 * below, who did not choose the upper track and cannot see what is on it.
 */

/**
 * Rides to the first shelf, then obeys the flags for what to do about what is
 * on it. Deliberately not the shared pilot from `pilots.ts`: that one plays
 * every hazard correctly, and half of what needs asserting here is what happens
 * to a player who does not.
 */
function rideFirstShelf(opts: { hopIce: boolean; jumpRock: boolean }): RunState {
  const derived = derive(tuning);
  let s = initialState(official, tuning, 1);
  const boughs = official.obstacles.filter((o) => o.kind === 'low');
  const deadfall = official.obstacles.filter((o) => o.kind === 'solid');
  const firstIce = official.ice[0]!;
  const firstRock = official.rocks[0]!;

  while (s.outcome === 'running' && s.tick < MAX_TICKS && s.x < firstRock.x + 240) {
    const onShelf = s.grounded && s.ledge >= 0;
    const targets: number[] = [];
    if (onShelf) {
      if (opts.hopIce) targets.push(firstIce.x0);
      if (opts.jumpRock) targets.push(firstRock.x);
    } else {
      for (const o of deadfall) targets.push(o.x);
    }

    let gap = Infinity;
    for (const t of targets) {
      const d = t - s.x;
      if (d > -30 && d < gap) gap = d;
    }
    const duck = !onShelf && boughs.some((o) => s.x + 30 >= o.x && s.x < o.x + o.width);
    const charging = gap < 90 && gap > 34;
    const releasing = gap <= 34 && gap > -30;

    const input: RunInput = {
      crouch: !releasing && (duck || charging || (s.grounded && s.ledge < 0)),
      rotate: 0,
    };
    s = step(s, input, official, tuning, scoring, derived);
  }
  return s;
}

describe('crumbling ice (FR-116)', () => {
  it('drops a player who stands on it, and does not end his run', () => {
    // The whole point of the hazard. Falling through is a cost, not a death:
    // he loses the upper line and its scoring and carries on down the piste.
    const s = rideFirstShelf({ hopIce: false, jumpRock: false });
    expect(s.outcome).toBe('running');
    expect(s.wipeoutReason).toBe(null);
    expect(s.iceBroken[0]).toBe(1);
    expect(s.ledge).toBe(-1);
  });

  it('lets a player who launches off it keep the shelf', () => {
    // The decision the countdown exists to offer. If this fails, the countdown
    // is decoration and the ice is just a toll.
    const s = rideFirstShelf({ hopIce: true, jumpRock: true });
    expect(s.iceBroken[0]).toBe(0);
    expect(s.wipeoutReason).toBe(null);
  });

  it('leaves a hole that cannot catch anyone again', () => {
    // Ice that re-formed under the player would have been the easy bug here:
    // he leaves the surface at exactly the surface's height, so a landing test
    // that only asks "did you cross it going down" says yes on the very next
    // tick and stands him back up on the ice he just fell through.
    const s = rideFirstShelf({ hopIce: false, jumpRock: false });
    expect(s.iceBroken[0]).toBe(1);

    const derived = derive(tuning);
    let t = s;
    const ice = official.ice[0]!;
    let caught = false;
    while (t.outcome === 'running' && t.x < ice.x1 + 200) {
      t = step(t, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
      if (t.grounded && t.ledge >= 0 && t.x >= ice.x0 && t.x < ice.x1) caught = true;
    }
    expect(caught).toBe(false);
  });
});

describe('the high line is a bet, not a bonus (SC-032)', () => {
  it('playing the shelf badly scores worse than never leaving the piste', () => {
    // The claim that makes the upper track a decision. It was FALSE through
    // three revisions of this feature: the shelf carried no hazard of its own,
    // so reaching it was pure upside and the only question was whether a player
    // could. FR-116 to FR-123 are what put something at stake up there.
    const careful = ride(official, 'stay-low', 19860214);
    const reckless = rideFirstShelf({ hopIce: true, jumpRock: false });
    expect(careful.state.outcome).toBe('finished');
    expect(reckless.outcome).toBe('wiped_out');
    expect(finalScore(reckless, scoring)).toBeLessThan(finalScore(careful.state, scoring));
  });
});

describe('rocks on the shelf (FR-117)', () => {
  it('end the run of a player who rides into one', () => {
    const s = rideFirstShelf({ hopIce: true, jumpRock: false });
    expect(s.outcome).toBe('wiped_out');
    expect(s.wipeoutReason).toBe('struck_obstacle');
  });

  it('are cleared by launching over them', () => {
    const s = rideFirstShelf({ hopIce: true, jumpRock: true });
    expect(s.outcome).toBe('running');
    expect(s.wipeoutReason).toBe(null);
    expect(s.x).toBeGreaterThan(official.rocks[0]!.x + 100);
  });

  it('never touch a player on the piste underneath them', () => {
    // A shelf is a one-way platform, so a player below it passes through the
    // shelf itself; anything standing ON the shelf has to behave the same way
    // or the lower line inherits hazards it can neither see nor answer.
    const derived = derive(tuning);
    let s = initialState(official, tuning, 1);
    const boughs = official.obstacles.filter((o) => o.kind === 'low');
    const deadfall = official.obstacles.filter((o) => o.kind === 'solid');
    const rockXs = new Set(official.rocks.map((r) => r.x));
    let passedUnder = 0;

    while (s.outcome === 'running' && s.tick < MAX_TICKS) {
      const next = deadfall.find((o) => o.x + o.width > s.x);
      const gap = next ? next.x - s.x : Infinity;
      const duck = boughs.some((o) => s.x + 30 >= o.x && s.x < o.x + o.width);
      const releasing = gap <= 34 && gap > -30;
      s = step(
        s,
        { crouch: !releasing && (duck || (gap < 90 && gap > 34)), rotate: 0 },
        official,
        tuning,
        scoring,
        derived,
      );
      for (const rx of rockXs) {
        if (s.ledge < 0 && Math.abs(s.x - rx) < 2) passedUnder++;
      }
    }
    // He got all the way down, never on a shelf, having been directly beneath
    // rocks along the way.
    expect(s.outcome).toBe('finished');
    expect(passedUnder).toBeGreaterThan(0);
  });
});
