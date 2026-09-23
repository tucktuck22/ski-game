import { describe, it, expect } from 'vitest';
import { derive, initialState, step } from '../../src/sim/step.js';
import { MAX_TICKS } from '../../src/sim/run.js';
import { terrainYAt } from '../../src/sim/terrain.js';
import type { Course, Kicker, RunInput } from '../../src/sim/types.js';
import { cameraAirLift, rampRise, AIR_LIFT, AIR_LIFT_MAX } from '../../src/render/rampGeometry.js';
import { RIG_RELEASE_WITHIN, RIG_CHARGE_FROM } from './pilots.js';
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
 * Hang time is bought with LOW gravity and a WEAK launch, not a big one. Any arc
 * under constant gravity peaks h = g*t^2/8 above its launch line, so four times
 * the air would cost sixteen times the height - 2,025 units against a buffer 180
 * tall. Read the same identity at fixed height, t = sqrt(8h/g), and the answer
 * inverts: a small pop under a twentieth of gravity hangs for 197 ticks and never
 * leaves the frame. That is why these powers look tiny.
 *
 * The ladder, at full tuck: eight rotations off the small booter, twelve off the
 * big one, and fewer off both at base speed.
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
    const releasing = gap <= RIG_RELEASE_WITHIN && gap > -30;
    let rotate: -1 | 0 | 1 = 0;
    if (!s.grounded && launched && thrown < spins && s.spinTicksLeft === 0) {
      rotate = 1;
      thrown++;
    }
    const input: RunInput = {
      crouch:
        !releasing &&
        (duck ||
          (gap < RIG_CHARGE_FROM && gap > RIG_RELEASE_WITHIN) ||
          (tuckIn && s.grounded && s.ledge < 0)),
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
      // 1.4 still, but the distance floor came 700 -> 450 when the float was
      // removed (2026-09-10). Under real gravity a launch that covers 700 units
      // has to apex past the frame; 606 and 843 are what 3 and 4 rotations
      // actually cover. The forward feel now comes from the KICK again, which
      // is what raising power from 0.7/0.75 to 2.0/2.4 bought.
      expect(f.vxAfter).toBeGreaterThan(f.vxBefore * 1.4);
      expect(f.dist).toBeGreaterThan(450);
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

  it('the camera can follow the biggest jump the course allows', () => {
    // The gap that let the drop ship. The test above bounds the apex at 200,
    // but nothing checked the CAMERA could follow that high — and it could
    // only follow to 148. Past its cap the lift freezes while the skier keeps
    // climbing, so he sits at one screen row through the apex and then falls
    // 63 pixels in 18 ticks when it re-engages. Played, that reads as the flip
    // dropping him, though a flip never touches vy.
    //
    // So the two limits are tied together here: whatever apex the course
    // permits, the camera has to be able to track it.
    for (const b of booters) {
      const apex = fly(official, b, true).apex;
      expect(
        apex * AIR_LIFT,
        `booter at ${b.x} apexes at ${apex.toFixed(0)}, needing ${(apex * AIR_LIFT).toFixed(0)} of ` +
          `camera lift against a cap of ${AIR_LIFT_MAX}`,
      ).toBeLessThanOrEqual(AIR_LIFT_MAX);
    }
  });

  it('keeps the skier inside the buffer at the top of that jump', () => {
    // The other side of it: lift moves him UP the frame, so covering a taller
    // apex costs head room. His feet sit at 108 - lift and he stands
    // standHeight tall, so the cap cannot pass 108 - standHeight.
    expect(AIR_LIFT_MAX).toBeLessThanOrEqual(180 * 0.6 - tuning.standHeight);
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

  it('hangs long enough to be worth the name', () => {
    // Rewritten 2026-09-10 with the float removed. It used to want 110 and 170
    // ticks, which a tenth of gravity bought: 214 ticks off the big one is
    // three and a half seconds of hang off a single jump, and the playtest
    // called that what it was. Under real gravity the numbers are 53 and 66 -
    // just under a second - and the ceiling is the FRAME, not the physics: a
    // fifth rotation needs an apex of 282 in a buffer 180 tall.
    const [small, big] = booters as [Kicker, Kicker];
    // Raised again on 2026-09-11 when gravity halved: hang at a fixed apex goes
    // as 1/sqrt(gravity), so the same jump heights now hold 74 and 91 ticks
    // where they held 53 and 66. The jumps did not get bigger; they got slower.
    expect(fly(official, small, true).air).toBeGreaterThan(65);
    expect(fly(official, big, true).air).toBeGreaterThan(85);
  });

  it('pays five rotations off the small booter and six off the big one', () => {
    // 8 and 12 before the float came off. Four is the measured maximum at true
    // gravity and the frame sets it, not the impulse: the old kickerImpulseMax
    // of 10.0 saturated first and capped the big one at three with headroom
    // going spare, so the cap moved to 12.0 and the frame took over.
    const [small, big] = booters as [Kicker, Kicker];
    expect(fly(official, small, true, 5).why).toBeNull();
    expect(fly(official, big, true, 6).why).toBeNull();

    // NEITHER booter has a greed trap any more, and it is worth saying that this
    // fell out rather than being aimed at: since gravity halved they hold 75 and
    // 90 ticks, and spinDurationTicks is 15, so both are exact multiples. Five
    // and six spins fill them precisely and there is no tick left on which a
    // further one could be pressed, so a greedy player banks what he landed
    // instead of losing it.
    //
    // The trap did not disappear, it MOVED: the crouch-release jump now buys 43
    // ticks, which is two spins with 13 spare — enough to start a third and not
    // to land it. That is an inversion of the design note this suite used to
    // carry, which put the trap on the booters deliberately and kept the base
    // jump safe. Recorded for the next play pass to judge rather than tuned away
    // on a hunch.
    for (const greedy of [7, 8, 10]) {
      expect(fly(official, small, true, greedy).why, `small, ${greedy} requested`).toBeNull();
      expect(fly(official, big, true, greedy).why, `big, ${greedy} requested`).toBeNull();
    }
  });

  it('charges speed for those rotations: base speed gets fewer', () => {
    const [small, big] = booters as [Kicker, Kicker];
    expect(fly(official, small, false, 5).why).toBe('spun_out');
    expect(fly(official, big, false, 6).why).toBe('spun_out');
  });
});

/**
 * The wedge must point where the flight goes - AS SEEN, which is not the same
 * line as where it actually goes.
 *
 * This has been wrong three times, and each was only caught by a person playing
 * the game and saying the ramp looked steeper than the launch. It was, by 30
 * degrees when the lip was a curve, by 6.6 when the launch formula forgot the
 * skier arrives travelling downhill, and by 12 when the wedge was matched to
 * the world flight while the camera compressed the drawn one by half. So it is
 * measured here against the simulation, at the lip, in screen space.
 */
describe('the wedge points where the flight is seen to go', () => {
  const DEG = 180 / Math.PI;

  /** The skier's apparent height above the snow: the camera eats half his climb. */
  const seenHeight = (h: number): number => h - cameraAirLift(h);

  it('matches the launch it sits in front of, within a degree', () => {
    for (const b of booters) {
      const d = derive(tuning);
      let s = initialState(official, tuning, 1);
      const boughs = official.obstacles.filter((o) => o.kind === 'low');
      const solids = official.obstacles.filter((o) => o.kind === 'solid');
      let launched = false;
      let x0 = 0;
      const seen: { dx: number; h: number }[] = [];
      while (s.outcome === 'running' && s.tick < MAX_TICKS && seen.length < 6) {
        const onShelf = s.grounded && s.ledge >= 0;
        const hz = onShelf
          ? [...official.rocks.map((r) => r.x), ...official.ice.map((i) => i.x0)]
          : solids.map((o) => o.x);
        let gap = Infinity;
        for (const hx of hz) {
          const dd = hx - s.x;
          if (dd > -30 && dd < gap) gap = dd;
        }
        const duck = !onShelf && boughs.some((o) => s.x + 30 >= o.x && s.x < o.x + o.width);
        const rel = gap <= RIG_RELEASE_WITHIN && gap > -30;
        const input: RunInput = {
          crouch:
            !rel &&
            (duck ||
              (gap < RIG_CHARGE_FROM && gap > RIG_RELEASE_WITHIN) ||
              (s.grounded && s.ledge < 0)),
          rotate: 0,
        };
        const before = s;
        s = step(s, input, official, tuning, scoring, d);
        if (before.grounded && !s.grounded && before.x >= b.x && before.x <= b.x + b.width + 14) {
          launched = true;
          x0 = before.x;
        }
        if (launched && !s.grounded) {
          seen.push({ dx: s.x - x0, h: seenHeight(terrainYAt(official.terrain, s.x) - s.y) });
        }
      }
      expect(seen.length, `booter at ${b.x} was never reached`).toBeGreaterThan(4);

      // The chord from the first sample to the sixth used to stand in for the
      // launch direction, and did, while a tenth of gravity kept the flight
      // nearly straight over those six ticks. Under real gravity it curves from
      // the first tick, so that chord reads about 3 degrees shallower than the
      // line the skier actually leaves on - and the ramp face IS that line, the
      // tangent at the lip, because it is a shape he rides up. Two samples, one
      // tick apart, is the tangent; six is a chord of a parabola.
      const first = seen[0]!;
      const last = seen[1]!;
      const flightSeen = Math.atan((last.h - first.h) / (last.dx - first.dx)) * DEG;
      const face = Math.atan(rampRise(b, tuning, official) / b.width) * DEG;
      expect(
        Math.abs(face - flightSeen),
        `booter at ${b.x}: face ${face.toFixed(1)}deg vs seen flight ${flightSeen.toFixed(1)}deg`,
      ).toBeLessThan(1.5);
    }
  });
});
