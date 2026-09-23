/**
 * The coached section, ridden (FR-186 → FR-193, and FR-192 above all).
 *
 * FR-192 is the single most important geometric constraint in this feature, and
 * the reason is FR-192a: a wipeout inside the coached section spends a practice
 * run like any other, so a player can burn all three inside the teaching half
 * and then meet the scored course cold. Nothing forgives that, which is why the
 * geometry has to be right rather than merely validated.
 *
 * WHAT FR-192 ACTUALLY REQUIRES, as amended. Research R3 measured that no legal
 * clearance lets a passive player under the rope — CV-3 pins it strictly between
 * `crouchHeight` 9 and `standHeight` 16 by construction, so a standing skier is
 * always too tall. The amendment the plan forced records the consequence
 * honestly: **the rope is allowed to bite.** What FR-192 forbids is a DEAD END —
 * an object placed so that failing to act on its badge makes the rest of the
 * section unreachable to a player who does act.
 *
 * So the two halves are asserted separately, and the second is the one that
 * would otherwise be left as prose:
 *
 *   1. A player who performs the instructed verb gets through, every time.
 *   2. The rope, and only the rope, is what stops a player who performs none.
 *      Nothing earlier stops him, and nothing later is unreachable.
 */
import { describe, it, expect } from 'vitest';
import { ride } from './pilots.js';
import { tuning, warmup } from './fixtures.js';

/** Where the coached section ends and the warm-up course proper begins. */
const COACH_SPAN = 3200;

const lows = warmup.obstacles.filter((o) => o.kind === 'low');
const coachedRope = lows.find((o) => o.x < COACH_SPAN);
const coachedObjects = [
  ...warmup.obstacles.filter((o) => o.x < COACH_SPAN).map((o) => ({ x: o.x, what: o.kind })),
  ...warmup.kickers.filter((k) => k.x < COACH_SPAN).map((k) => ({ x: k.x, what: 'kicker' })),
].sort((a, b) => a.x - b.x);

describe('the coached section is shaped the way FR-186 to FR-193 require', () => {
  it('FR-188: presents exactly four coached objects, in order', () => {
    expect(coachedObjects.map((o) => o.what)).toEqual(['low', 'solid', 'kicker', 'kicker']);
  });

  it('FR-186: the coached section and the warm-up are one continuous course', () => {
    // Not two courses, not a mode. The player loads nothing between the halves
    // because there is nothing to load: it is all one terrain array.
    expect(warmup.terrain[0]?.x).toBe(0);
    expect(warmup.length).toBeGreaterThan(COACH_SPAN);
    expect(warmup.obstacles.some((o) => o.x > COACH_SPAN)).toBe(true);
  });

  it('FR-187: the coached terrain is materially gentler than the warm-up that follows', () => {
    const gradientAt = (x: number): number => {
      const t = warmup.terrain;
      for (let i = 1; i < t.length; i++) {
        const a = t[i - 1] as { x: number; y: number };
        const b = t[i] as { x: number; y: number };
        if (x >= a.x && x < b.x) return (b.y - a.y) / (b.x - a.x);
      }
      return 0;
    };
    const coached = gradientAt(400);
    const afterJoin = gradientAt(COACH_SPAN + 400);
    // "Materially", not "slightly": the whole premise is that he has time to
    // read, and feature 006 made gradient the thing that decides that.
    expect(coached).toBeLessThan(afterJoin / 3);
    // And still legal — CV-23's stall floor, which is the binding rule here.
    expect(coached).toBeGreaterThan(tuning.slopeFriction * 3);
  });

  it('FR-192: CV-3 leaves the rope no clearance a standing player fits under (R3)', () => {
    // Recorded as a test rather than as prose in research, because it is the
    // measurement the FR-192 amendment rests on. If CV-3's bounds ever move,
    // this is where the amendment stops being necessary.
    expect(coachedRope).toBeDefined();
    const clearance = (coachedRope as { clearance: number }).clearance;
    expect(clearance).toBeGreaterThan(tuning.crouchHeight);
    expect(clearance).toBeLessThan(tuning.standHeight);
    // ...and it is authored at the most forgiving legal value available.
    expect(clearance).toBe(tuning.standHeight - 1);
  });
});

describe('FR-192: the coached section is not a dead end', () => {
  it('a player who performs the instructed verb rides the whole section and beyond', () => {
    // 'stay-low' ducks what must be ducked and releases to clear what must be
    // jumped — which is precisely the set of verbs the four badges name.
    const { state } = ride(warmup, 'stay-low', 1);
    expect(
      state.maxX,
      'a competent player did not reach the warm-up course; the coached section is a trap',
    ).toBeGreaterThan(COACH_SPAN);
    expect(state.outcome).toBe('finished');
  });

  it('and so does one who rides it tucked throughout', () => {
    const { state } = ride(warmup, 'tuck', 1);
    expect(state.maxX).toBeGreaterThan(COACH_SPAN);
    expect(state.outcome).toBe('finished');
  });

  it('a passive player is stopped by the rope and by nothing before it (R3)', () => {
    // The accepted consequence, asserted rather than assumed. If this ever
    // fails by stopping EARLIER than the rope, something has been placed where
    // a player who does nothing cannot even reach the first lesson — which is
    // the dead end FR-192 actually forbids.
    const { state } = ride(warmup, 'passive', 1);
    const ropeX = (coachedRope as { x: number }).x;
    expect(state.outcome).toBe('wiped_out');
    expect(
      state.maxX,
      'a passive player was stopped before he even reached the first lesson',
    ).toBeGreaterThanOrEqual(ropeX);
    expect(
      state.maxX,
      'a passive player survived the rope; R3 and the FR-192 amendment are stale',
    ).toBeLessThan((coachedObjects[1] as { x: number }).x);
  });
});

describe('FR-193: the booter teaches rotation, at the speed this pitch actually gives', () => {
  it('buys enough air for the rotation its badge asks for', () => {
    const booter = warmup.kickers.filter((k) => k.x < COACH_SPAN).at(-1);
    expect(booter).toBeDefined();
    const k = booter as { x: number; width: number; power: number; launchAngle?: number };

    // Terminal speed a tucked player carries at the coached gradient, from the
    // same model the simulation uses.
    const g = 0.05;
    const len = Math.sqrt(1 + g * g);
    const net = tuning.gravity * (g / len - tuning.slopeFriction / len);
    const tucked = Math.sqrt(net / tuning.dragTucked);

    const impulse = Math.min(k.power * tucked, tuning.kickerImpulseMax);
    const up = impulse * Math.sin(((k.launchAngle ?? 90) * Math.PI) / 180);
    const airTicks = (2 * up) / tuning.gravity;

    // A rotation costs spinDurationTicks. The lesson that NAMES rotation for
    // the first time in the product must not be a timing test, so it gets room
    // for several, not room for one.
    expect(
      airTicks,
      'the coached booter does not buy enough air to land the flip its badge asks for',
    ).toBeGreaterThan(tuning.spinDurationTicks * 3);
    // And it stays inside the frame the camera can follow.
    expect((up * up * 0.5) / tuning.gravity).toBeLessThan(184);
  });
});
