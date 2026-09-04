import { describe, it, expect } from 'vitest';
import { derive, initialState, step } from '../../src/sim/step.js';
import { MAX_TICKS } from '../../src/sim/run.js';
import { terrainYAt } from '../../src/sim/terrain.js';
import type { Course, Kicker, RunInput } from '../../src/sim/types.js';
import { official, tuning, scoring } from './fixtures.js';

/**
 * A booter throws the skier FORWARD, and the whole feel of one lives in that.
 *
 * The first cut threw straight up: 12.5 of impulse against a forward speed of
 * 4.2 leaves the lip at 71 degrees and lands at 71 degrees, which reads as
 * being tossed and dropped rather than launched, however much air it buys. It
 * also spent everything on height, which is the one currency this game cannot
 * show - the buffer is 180 tall, and the snow was out of frame for 85% of the
 * flight. Both faults are asserted against here, because both were shipped.
 *
 * The ladder, at full tuck:  small booter a triple, big booter a quad.
 */

const booters = official.kickers
  .filter((k) => (k.launchAngle ?? 90) < 90)
  .sort((a, b) => a.power - b.power);

interface Flight {
  air: number;
  apex: number;
  dist: number;
  vxBefore: number;
  vxAfter: number;
  outcome: string;
  why: string | null;
}

function fly(course: Course, k: Kicker, tuckIn: boolean, spins = 0): Flight {
  const d = derive(tuning);
  let s = initialState(course, tuning, 1);
  const boughs = course.obstacles.filter((o) => o.kind === 'low');
  const solids = course.obstacles.filter((o) => o.kind === 'solid');
  let air = 0;
  let apex = 0;
  let x0 = 0;
  let vxBefore = 0;
  let vxAfter = 0;
  let launched = false;
  let thrown = 0;
  while (s.outcome === 'running' && s.tick < MAX_TICKS) {
    const onShelf = s.grounded && s.ledge >= 0;
    const hz = onShelf
      ? [...course.rocks.map((r) => r.x), ...course.ice.map((i) => i.x0)]
      : solids.map((o) => o.x);
    let gap = Infinity;
    for (const hx of hz) {
      const dd = hx - s.x;
      if (dd > -30 && dd < gap) gap = dd;
    }
    const duck = !onShelf && boughs.some((o) => s.x + 30 >= o.x && s.x < o.x + o.width);
    const releasing = gap <= 34 && gap > -30;
    let rotate: -1 | 0 | 1 = 0;
    if (!s.grounded && launched && thrown < spins && s.spinTicksLeft === 0) {
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
    if (before.grounded && !s.grounded && before.x >= k.x && before.x <= k.x + k.width + 14) {
      launched = true;
      x0 = before.x;
      vxBefore = before.vx;
      vxAfter = s.vx;
      air = 0;
      apex = 0;
      thrown = 0;
    }
    if (launched && !s.grounded) {
      air++;
      const h = terrainYAt(course.terrain, s.x) - s.y;
      if (h > apex) apex = h;
    }
    if (launched && s.grounded && air > 0) break;
  }
  return {
    air,
    apex,
    dist: s.x - x0,
    vxBefore,
    vxAfter,
    outcome: s.outcome,
    why: s.wipeoutReason,
  };
}

describe('the booters (FR-078, Principle III feel criteria)', () => {
  it('there are two, both angled forward rather than straight up', () => {
    expect(booters).toHaveLength(2);
    for (const b of booters) {
      expect(b.launchAngle).toBeLessThan(75);
      expect(b.launchAngle).toBeGreaterThan(40);
    }
  });

  it('throws the skier forward: he leaves the lip faster than he reached it', () => {
    // The failure this guards is a launch that is all vertical. Forward speed is
    // never damped in flight, so if it does not arrive AT the lip it never comes.
    for (const b of booters) {
      const f = fly(official, b, true);
      expect(f.vxAfter).toBeGreaterThan(f.vxBefore * 1.7);
      expect(f.dist).toBeGreaterThan(380);
    }
  });

  it('keeps that forward speed the whole way down', () => {
    for (const b of booters) {
      const f = fly(official, b, true);
      // Distance over air time is the average forward speed across the flight.
      expect(f.dist / f.air).toBeGreaterThan(f.vxAfter * 0.9);
    }
  });

  it('stays inside a frame that is 180 tall', () => {
    // The camera lifts the skier up the buffer as he climbs, which keeps the
    // snow in shot to about 145 units above it. Past roughly 200 the ground is
    // gone for most of the flight and the jump stops reading as a jump at all -
    // it reads as a fall, which is exactly how the first cut was reported.
    for (const b of booters) {
      expect(fly(official, b, true).apex).toBeLessThan(200);
    }
  });

  it('lands on the angle it took off from', () => {
    // Orientation does not track velocity in the air, so the runway under a
    // booter has to hold the takeoff's grade the whole way out.
    // The helper stops at the landing, so the run is still 'running' there. A
    // clean landing is the absence of a wipeout, not the end of the course.
    for (const b of booters) {
      expect(fly(official, b, true).why).toBeNull();
      expect(fly(official, b, false).why).toBeNull();
    }
  });

  it('pays a triple on the small booter and a quad on the big one', () => {
    const [small, big] = booters as [Kicker, Kicker];
    expect(fly(official, small, true, 3).why).toBeNull();
    expect(fly(official, small, true, 4).why).toBe('spun_out');
    expect(fly(official, big, true, 4).why).toBeNull();
    expect(fly(official, big, true, 5).why).toBe('spun_out');
  });

  it('charges speed for those rotations: base speed gets neither', () => {
    for (const b of booters) {
      expect(fly(official, b, false, 3).why).toBe('spun_out');
    }
  });
});
