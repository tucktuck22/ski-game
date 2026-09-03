import { describe, it, expect } from 'vitest';
import { derive, initialState, step, UPPER_TRACK_MULTIPLIER } from '../../src/sim/step.js';
import { MAX_TICKS } from '../../src/sim/run.js';
import type { RunInput, RunState } from '../../src/sim/types.js';
import { official, scoring, tuning } from './fixtures.js';

/**
 * FR-127: the multiplier is a ZONE, not a surface.
 *
 * It changes only while the skier is on the ground, which is what carries the
 * upper track's 2x through an air that starts on a shelf and finishes on the
 * piste. Without that, a trick thrown off the high line would be paid at the
 * rate of the snow it happened to land on — so the best-scoring thing to do up
 * there would be to stay on the ground, which is the opposite of the point.
 */

/** Rides to the first shelf, hopping the ice, and stops once established on it. */
function toFirstShelf(): RunState {
  const derived = derive(tuning);
  let s = initialState(official, tuning, 1);
  const boughs = official.obstacles.filter((o) => o.kind === 'low');
  const deadfall = official.obstacles.filter((o) => o.kind === 'solid');
  const ice = official.ice[0]!;
  const rock = official.rocks[0]!;

  while (s.outcome === 'running' && s.tick < MAX_TICKS) {
    const onShelf = s.grounded && s.ledge >= 0;
    if (onShelf && s.x > rock.x + 60) break;
    const targets = onShelf ? [ice.x0, rock.x] : deadfall.map((o) => o.x);
    let gap = Infinity;
    for (const t of targets) {
      const d = t - s.x;
      if (d > -30 && d < gap) gap = d;
    }
    const duck = !onShelf && boughs.some((o) => s.x + 30 >= o.x && s.x < o.x + o.width);
    const releasing = gap <= 34 && gap > -30;
    const input: RunInput = {
      crouch: !releasing && (duck || (gap < 90 && gap > 34) || (s.grounded && s.ledge < 0)),
      rotate: 0,
    };
    s = step(s, input, official, tuning, scoring, derived);
  }
  return s;
}

describe('the scoring zone (FR-127)', () => {
  it('reads 1 on the piste and 2 on the shelf', () => {
    const derived = derive(tuning);
    let s = initialState(official, tuning, 1);
    for (let i = 0; i < 20; i++) {
      s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
    }
    expect(s.ledge).toBe(-1);
    expect(s.scoreMultiplier).toBe(1);

    const onShelf = toFirstShelf();
    expect(onShelf.ledge).toBeGreaterThanOrEqual(0);
    expect(onShelf.scoreMultiplier).toBe(UPPER_TRACK_MULTIPLIER);
  });

  it('holds the 2x through an air that began on the shelf, and pays the trick at it', () => {
    // The claim. He rides off the end of the shelf, spins on the way down, and
    // lands on ordinary piste — and the trick is still worth double, because
    // the bet was placed when he left the high line, not when he landed.
    const derived = derive(tuning);
    let s = toFirstShelf();
    const shelf = official.ledges[0]!;

    let sawAirborneAtTwo = false;
    let pressed = false;
    // The award lands in one tick, so the delta ACROSS THAT TICK is the trick.
    // Comparing totals across the whole fall would also sweep in any pickup he
    // passed through on the way down, which is what the first cut of this did.
    let landingDelta = 0;
    while (s.outcome === 'running' && s.tick < MAX_TICKS) {
      // Commit the spin on the first airborne tick after the shelf runs out.
      const press = !pressed && !s.grounded && s.x >= shelf.x1;
      const before = s.score;
      s = step(s, { crouch: false, rotate: press ? 1 : 0 }, official, tuning, scoring, derived);
      if (press) pressed = true;
      if (!s.grounded && pressed) {
        expect(s.scoreMultiplier).toBe(UPPER_TRACK_MULTIPLIER);
        sawAirborneAtTwo = true;
      }
      if (pressed && s.grounded) {
        landingDelta = s.score - before;
        break;
      }
    }

    expect(pressed).toBe(true);
    expect(sawAirborneAtTwo).toBe(true);
    expect(s.outcome).toBe('running');
    // He is back on the piste...
    expect(s.ledge).toBe(-1);
    // ...and was paid at the upper track's rate anyway.
    expect(landingDelta).toBe(scoring.trickPerRotation * UPPER_TRACK_MULTIPLIER);
    // The zone only gives way once he is standing on ordinary snow again.
    expect(s.scoreMultiplier).toBe(1);
  });

  it('pays a trick thrown from the piste at the plain rate', () => {
    // The control. Without it, a multiplier stuck at 2 would satisfy everything
    // above.
    const derived = derive(tuning);
    let s = initialState(official, tuning, 1);
    for (let i = 0; i < 30; i++) {
      s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
    }
    for (let i = 0; i < tuning.chargeTicksToMax; i++) {
      s = step(s, { crouch: true, rotate: 0 }, official, tuning, scoring, derived);
    }
    s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
    s = step(s, { crouch: false, rotate: 1 }, official, tuning, scoring, derived);
    while (s.outcome === 'running' && !s.grounded) {
      s = step(s, { crouch: false, rotate: 0 }, official, tuning, scoring, derived);
    }
    expect(s.score).toBe(scoring.trickPerRotation);
  });
});
