import { describe, it, expect } from 'vitest';
import { derive, initialState, step } from '../../src/sim/step.js';
import { MAX_TICKS } from '../../src/sim/run.js';
import { terrainYAt } from '../../src/sim/terrain.js';
import type { RunInput } from '../../src/sim/types.js';
import { official, tuning, scoring } from './fixtures.js';

/**
 * What a crouch release is FOR, and what it must not be.
 *
 * It is the small jump: enough to clear a log lying on the piste, and nothing
 * more. It shipped at launchImpulseMax 7.2, which apexed at 81 against shelves
 * standing 50 and 55 - so the upper track could be entered anywhere on the
 * mountain with no ramp at all, and CV-13's whole argument about the high line
 * being earned by carrying speed was decoration. Nothing caught it, because
 * every rule in the validator asks whether a shelf CAN be reached and none asks
 * whether it can be reached the wrong way.
 *
 * These are the three bounds that keep it a small jump. They are asserted
 * against the real apex rather than the constant, so a later change to gravity
 * cannot quietly re-open the hole.
 */
const apexOf = (impulse: number): number => (impulse * impulse) / (2 * tuning.gravity);

describe('the base jump (FR-078)', () => {
  it('clears a log on the piste, with room', () => {
    // A solid obstacle's top sits at standHeight above the snow.
    expect(apexOf(tuning.launchImpulseMax)).toBeGreaterThan(tuning.standHeight * 2);
  });

  it('cannot reach the lowest shelf on the course', () => {
    const lowest = Math.min(...official.ledges.map((l) => l.height));
    expect(apexOf(tuning.launchImpulseMax)).toBeLessThan(lowest);
  });

  it('is weaker than every ramp on the course', () => {
    const rampApex = (k: (typeof official.kickers)[number]): number => {
      const impulse = Math.min(k.power * tuning.tuckSpeedMax, tuning.kickerImpulseMax);
      const up = impulse * Math.sin(((k.launchAngle ?? 90) * Math.PI) / 180);
      return (up * up) / (2 * tuning.gravity * (k.gravityScale ?? 1));
    };
    const base = apexOf(tuning.launchImpulseMax);
    // Weaker than the smallest thing built on the mountain, whatever that is:
    // 39 against 56 for the gentlest booter and 100 for a shelf ramp. A crouch
    // release is for clearing a log, not for rivalling a ramp.
    expect(base).toBeLessThan(Math.min(...official.kickers.map(rampApex)));
  });

  it('never puts a skier on the upper track, however he times it', () => {
    // Proven by riding rather than by arithmetic: charge to the ceiling and let
    // go, over and over, the whole way down. If a crouch release could reach a
    // shelf anywhere on the course, this finds it.
    const d = derive(tuning);
    let s = initialState(official, tuning, 1);
    let charge = 0;
    let highestAir = 0;
    while (s.outcome === 'running' && s.tick < MAX_TICKS) {
      // Never release under a bough: FR-088 makes that fatal, and this test is
      // about height, not about the timing rule.
      const overhead = official.obstacles.some(
        (o) => o.kind === 'low' && s.x + 40 >= o.x && s.x < o.x + o.width + 40,
      );
      charge = s.grounded && !overhead ? charge + 1 : 0;
      const release = charge > tuning.chargeTicksToMax;
      if (release) charge = 0;
      const input: RunInput = { crouch: !release && s.grounded && !overhead, rotate: 0 };
      s = step(s, input, official, tuning, scoring, d);
      if (!s.grounded) {
        const h = terrainYAt(official.terrain, s.x) - s.y;
        if (h > highestAir) highestAir = h;
      }
      expect(s.ledge).toBeLessThan(0);
    }
    expect(highestAir).toBeLessThan(Math.min(...official.ledges.map((l) => l.height)));
  });
});
