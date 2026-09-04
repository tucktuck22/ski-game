import { describe, it, expect } from 'vitest';
import { derive, initialState, step } from '../../src/sim/step.js';
import { MAX_TICKS } from '../../src/sim/run.js';
import type { Course, RunInput } from '../../src/sim/types.js';
import { official, tuning, scoring } from './fixtures.js';

/**
 * The booters exist to sell hang time, and hang time is only worth anything if
 * it converts into rotations. That is the measurable feel criterion Principle
 * III asks a mechanic to define, so it is asserted rather than described.
 *
 * The ladder these tests pin down:
 *   at base speed          a double, and no more
 *   at full tuck           a triple off either booter
 *   at full tuck, the big booter only   a quad
 *
 * Speed buying rotations is the whole reason The Flats section exists. A launch
 * impulse is power times CARRIED speed, so coasting the flat is not a rest, it
 * is a smaller trick - and if that ever stops being true, this file fails.
 */

/** A booter is a kicker built for air, not for reaching a shelf. */
const booters = official.kickers.filter((k) => k.power > 2).sort((a, b) => a.power - b.power);

function run(course: Course, spins: number, tuckIn: boolean, only?: number) {
  const d = derive(tuning);
  let s = initialState(course, tuning, 1);
  const boughs = course.obstacles.filter((o) => o.kind === 'low');
  const solids = course.obstacles.filter((o) => o.kind === 'solid');
  const throwOver = only === undefined ? booters : booters.filter((k) => k.x === only);
  let thrown = 0;
  let air = 0;
  let airFrom = 0;
  const airs: { from: number; ticks: number }[] = [];
  while (s.outcome === 'running' && s.tick < MAX_TICKS) {
    const onShelf = s.grounded && s.ledge >= 0;
    const hazards = onShelf
      ? [...course.rocks.map((r) => r.x), ...course.ice.map((i) => i.x0)]
      : solids.map((o) => o.x);
    let gap = Infinity;
    for (const hx of hazards) {
      const dd = hx - s.x;
      if (dd > -30 && dd < gap) gap = dd;
    }
    const duck = !onShelf && boughs.some((o) => s.x + 30 >= o.x && s.x < o.x + o.width);
    const releasing = gap <= 34 && gap > -30;
    const over = throwOver.some((k) => s.x > k.x && s.x < k.x + 500);
    let rotate: -1 | 0 | 1 = 0;
    if (!s.grounded && over && thrown < spins && s.spinTicksLeft === 0) {
      rotate = 1;
      thrown++;
    }
    const input: RunInput = {
      crouch:
        !releasing && (duck || (gap < 90 && gap > 34) || (tuckIn && s.grounded && s.ledge < 0)),
      rotate,
    };
    const before = s;
    s = step(s, input, course, tuning, scoring, d);
    if (!s.grounded) {
      if (before.grounded) airFrom = before.x;
      air++;
    } else {
      if (air > 0) airs.push({ from: airFrom, ticks: air });
      air = 0;
      thrown = 0;
    }
  }
  /** Air launched from a given ramp's lip, rather than anywhere on the course. */
  const airOff = (x: number): number => {
    const lip = x + (course.kickers.find((k) => k.x === x)?.width ?? 0);
    const hits = airs.filter((a) => a.from >= x && a.from <= lip + 60);
    return hits.length ? Math.max(...hits.map((a) => a.ticks)) : 0;
  };
  return { state: s, maxAir: airs.length ? Math.max(...airs.map((a) => a.ticks)) : 0, airOff };
}

describe('the booters (FR-078, Principle III feel criteria)', () => {
  it('there are two, and the second throws further than the first', () => {
    expect(booters).toHaveLength(2);
    const r = run(official, 0, true);
    expect(r.airOff(booters[1]!.x)).toBeGreaterThan(r.airOff(booters[0]!.x));
  });

  it('buys enough air at full tuck for a triple, with margin', () => {
    // Three spins is 45 ticks. Anything under about 55 is a ceiling pretending
    // to be a trick: the player who hesitates for a quarter of a second dies.
    const r = run(official, 0, true);
    for (const b of booters) {
      expect(r.airOff(b.x)).toBeGreaterThanOrEqual(3 * tuning.spinDurationTicks + 10);
    }
  });

  it('lands a triple at full tuck, and pays for it', () => {
    const plain = run(official, 0, true).state;
    const tricked = run(official, 3, true).state;
    expect(tricked.outcome).toBe('finished');
    expect(tricked.score).toBeGreaterThan(plain.score);
  });

  it('refuses a triple at base speed: speed is what buys rotations', () => {
    expect(run(official, 2, false).state.outcome).toBe('finished');
    expect(run(official, 3, false).state.wipeoutReason).toBe('spun_out');
  });

  it('gives the quad only to the bigger booter', () => {
    expect(run(official, 4, true, booters[0]!.x).state.wipeoutReason).toBe('spun_out');
    expect(run(official, 4, true, booters[1]!.x).state.outcome).toBe('finished');
  });
});
