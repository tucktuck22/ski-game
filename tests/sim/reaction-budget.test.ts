import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cameraFor } from '../../src/render/draw.js';
import { parseCamera } from '../../src/data/load.js';
import type { Course } from '../../src/sim/types.js';
import { official, warmup } from './fixtures.js';
import { ride, type Pilot } from './pilots.js';
import {
  MEASURING_PILOTS,
  kickerLipSpeeds,
  readings,
  worstPerHazard,
  type Reading,
} from './reaction.js';

/**
 * Time to see the box. specs/007-reaction-time-speed/contracts/reaction-budget.md.
 *
 * The playtest that started feature 007: "I don't have the reaction time
 * necessary to jump over boxes while crouched. If even I struggle to do this and I
 * know the map layout, I don't think it's fair for new players." Measured, the
 * worst log on the shipped course gave 315 ms between coming into view and the
 * last release that still cleared it - less than it takes a person to recognise
 * something new, before a phone's own input lag.
 *
 * The budget is 680 ms, the maintainer's choice. It is read on every measuring
 * pilot that meets a hazard, and the worst reading is the one held to it (see
 * tests/sim/reaction.ts for why no single pilot will do).
 *
 * Everything below the first block is about what must NOT move: the kickers,
 * the shelves, the booters, and every other hazard. The course changed to buy
 * this time, and the first playtest of feature 006 called the jumps the best
 * the game had felt.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const framing = parseCamera(JSON.parse(readFileSync(join(root, 'data/camera.json'), 'utf8')));
const camera = (s: Parameters<typeof cameraFor>[0], c: Course): { x: number; y: number } =>
  cameraFor(s, c, framing);

/** FR-231, the maintainer's number. */
const BUDGET_MS = 680;

const COURSES: [string, Course][] = [
  ['official', official],
  ['warm-up', warmup],
];

const all = new Map(COURSES.map(([n, c]) => [n, readings(c, camera)]));
const worst = new Map(COURSES.map(([n]) => [n, worstPerHazard(all.get(n)!)]));

/**
 * Rules 2.0.0, as shipped, measured by T001 under the 2.0.0 camera - see
 * specs/007-reaction-time-speed/baseline-2.0.0.md. Committed rather than
 * recomputed from git so the comparison is against a fixed record, not against
 * whatever was committed last.
 */
const BASELINE_LEAD_MS: Record<string, Record<string, number>> = {
  official: {
    'rope@700': 900,
    'ice@1876': 850,
    'rock@2076': 800,
    'rope@3020': 800,
    'rope@3300': 700,
    'rope@3820': 400,
    'rope@4340': 333,
    'rope@4860': 333,
    'ice@5546': 967,
    'ice@5746': 600,
    'rock@5996': 567,
    'rope@6400': 967,
    'rope@7300': 550,
    'rope@7600': 483,
    'ice@11350': 550,
    'rope@11850': 383,
  },
  'warm-up': {
    'rope@689': 2217,
    'rope@3900': 817,
    'ice@4926': 767,
    'rock@5126': 833,
  },
};
const BASELINE_LIP_SPEED: Record<string, Record<number, number>> = {
  official: { 1400: 4.371, 5200: 5.73, 7852: 5.045, 9188: 5.169, 11000: 5.188 },
  'warm-up': { 1889: 1.633, 2489: 1.633, 4600: 4.785, 5586: 4.379 },
};

const describeReading = (r: Reading): string =>
  `${r.kind} at x=${r.x}: ${Math.round(r.ms)} ms on the ${r.pilot} pilot, ` +
  `arriving at ${r.vxAtArrival.toFixed(2)} horizontally`;

describe('the reaction budget (FR-231, SC-081)', () => {
  for (const [name, course] of COURSES) {
    it(`B1: every box on the ${name} course leaves ${BUDGET_MS} ms to decide`, () => {
      const boxes = worst.get(name)!.filter((r) => r.kind === 'box');
      // Every box must have been met by someone, or it was never measured at all.
      expect(boxes.map((b) => b.x).sort((a, b) => a - b)).toEqual(
        course.obstacles
          .filter((o) => o.kind === 'solid')
          .map((o) => o.x)
          .sort((a, b) => a - b),
      );
      for (const b of boxes) {
        // B9: the failure says which box, how long, and how fast.
        expect(b.ms, describeReading(b)).toBeGreaterThanOrEqual(BUDGET_MS);
      }
    });

    it(`B3: after clearing a box, back on the snow before the next one appears (${name})`, () => {
      for (const pilot of MEASURING_PILOTS) {
        const boxes = all
          .get(name)!
          .filter((r) => r.kind === 'box' && r.pilot === pilot)
          .sort((a, b) => a.x - b.x);
        for (let i = 1; i < boxes.length; i++) {
          const prev = boxes[i - 1]!;
          const next = boxes[i]!;
          expect(
            prev.landedTick,
            `${pilot}: still airborne from the box at ${prev.x} when the box at ${next.x} came into view`,
          ).toBeLessThanOrEqual(next.seenTick);
        }
      }
    });
  }
});

describe('what must not move (FR-235 - FR-238, SC-084)', () => {
  for (const [name, course] of COURSES) {
    it(`B2: every measuring pilot finishes the ${name} course`, () => {
      for (const pilot of MEASURING_PILOTS) {
        expect(ride(course, pilot, 1).state.outcome, `${pilot} on ${name}`).toBe('finished');
      }
    });

    it(`B4: no other hazard on the ${name} course loses time it could not spare`, () => {
      // FR-237 as amended: nothing may drop below the budget, and anything that was
      // already below it may not lose more. The ice on the Cornice goes 967 -> 817
      // because the Narrows' run-out now gets the low-line pilot there sooner; that
      // is still well over the budget, which is the thing a player feels.
      const now = new Map(
        worst
          .get(name)!
          .filter((r) => r.kind !== 'box')
          .map((r) => [`${r.kind}@${r.x}`, r]),
      );
      for (const [key, before] of Object.entries(BASELINE_LEAD_MS[name]!)) {
        const r = now.get(key);
        expect(r, `${key} was met on 2.0.0 and no measuring pilot meets it now`).toBeDefined();
        expect(r!.ms, `${describeReading(r!)}; it was ${before} ms`).toBeGreaterThanOrEqual(
          Math.min(before, BUDGET_MS) - 1,
        );
      }
    });

    it(`B5: every kicker on the ${name} course is reached within 2% of its old speed`, () => {
      for (const { x, speed } of kickerLipSpeeds(course)) {
        const was = BASELINE_LIP_SPEED[name]![x];
        expect(was, `no baseline for the kicker at ${x}`).toBeDefined();
        expect(
          Math.abs(speed / was! - 1),
          `kicker at ${x}: ${speed.toFixed(3)} against ${was}`,
        ).toBeLessThanOrEqual(0.02);
      }
    });
  }

  it('B7: the upper track is still a choice - 3 shelves tucked, 0 cautious', () => {
    const shelves = (p: Pilot): number => ride(official, p, 1).shelvesRidden;
    expect(shelves('tuck')).toBe(3);
    expect(shelves('stay-low')).toBe(0);
  });

  it('B8: no ground on the official course is gentler than the 0.25 floor', () => {
    // 0.25 is the gradient feature 006 anchored the speeds to (2.60 standing,
    // 4.00 tucked) and raised the floor to after its first playtest. The shipped
    // course's gentlest segment actually came out at 0.254, because the generator
    // samples between keys; the eased approaches sit on the floor itself.
    const t = official.terrain;
    let min = Infinity;
    for (let i = 1; i < t.length; i++) {
      min = Math.min(min, (t[i]!.y - t[i - 1]!.y) / (t[i]!.x - t[i - 1]!.x));
    }
    expect(min).toBeGreaterThanOrEqual(0.25 - 1e-9);
  });
});
