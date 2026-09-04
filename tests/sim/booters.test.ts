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
 *   base speed, small booter    a double
 *   base speed, big booter      a triple
 *   full tuck, small booter     a quad
 *   full tuck, big booter       a quint
 *
 * The big booter is worth exactly one more rotation than the small one at every
 * speed, which is the whole reason there are two of them. It buys that with a
 * stronger launch AND a steeper knuckle behind the lip - the ground falling away
 * is worth as much as the ramp, and neither alone gets there.
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
    const over =
      !s.grounded && throwOver.some((k) => airFrom >= k.x && airFrom <= k.x + k.width + 10);
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

  it('buys enough air at full tuck for a quad, with margin', () => {
    // Four spins is 60 ticks. A launch that only just covers its advertised
    // trick is a ceiling pretending to be one: the player who hesitates for a
    // quarter of a second dies, and cannot see why.
    const r = run(official, 0, true);
    for (const b of booters) {
      expect(r.airOff(b.x)).toBeGreaterThanOrEqual(4 * tuning.spinDurationTicks + 4);
    }
  });

  it('lands a quad at full tuck, and pays for it', () => {
    const plain = run(official, 0, true).state;
    const tricked = run(official, 4, true).state;
    expect(tricked.outcome).toBe('finished');
    expect(tricked.score).toBeGreaterThan(plain.score);
  });

  it('gives the quint to the big booter alone', () => {
    expect(run(official, 5, true, booters[1]!.x).state.outcome).toBe('finished');
    expect(run(official, 5, true, booters[0]!.x).state.wipeoutReason).toBe('spun_out');
  });

  it('caps out: nothing on the course holds a sixth rotation', () => {
    for (const b of booters) {
      expect(run(official, 6, true, b.x).state.wipeoutReason).toBe('spun_out');
    }
  });

  it('charges base speed a rotation on each booter: speed buys air', () => {
    expect(run(official, 2, false, booters[0]!.x).state.outcome).toBe('finished');
    expect(run(official, 3, false, booters[0]!.x).state.wipeoutReason).toBe('spun_out');
    expect(run(official, 3, false, booters[1]!.x).state.outcome).toBe('finished');
    expect(run(official, 4, false, booters[1]!.x).state.wipeoutReason).toBe('spun_out');
  });

  it('lands inside the angle tolerance the player cannot correct for', () => {
    // Orientation does not track velocity in the air, so a knuckle that tilts
    // the ground away by more than landingAngleTolerance is an unavoidable
    // wipeout. Proven by landing them, not by trusting the terrain programme.
    for (const b of booters) {
      expect(run(official, 0, true, b.x).state.outcome).toBe('finished');
      expect(run(official, 0, false, b.x).state.outcome).toBe('finished');
    }
  });
});
