import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseFinish } from '../../src/data/load.js';
import {
  crowdLayout,
  crowdPose,
  FEET_BURIED,
  groundY,
  withRunout,
} from '../../src/render/finish.js';
import { FULL_MOTION, type MotionSettings } from '../../src/render/reducedMotion.js';
import { official, warmup } from '../sim/fixtures.js';

/** The crowd - contracts/finish-data.md F8, and F9's crowd half. */
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = parseFinish(JSON.parse(readFileSync(join(root, 'data/finish.json'), 'utf8')));
const REDUCED: MotionSettings = { ...FULL_MOTION, shake: false, flashes: false, parallax: false };

describe('the crowd (F8)', () => {
  for (const [name, course] of [
    ['official', official],
    ['warm-up', warmup],
  ] as const) {
    const shown = withRunout(course, cfg);
    const crowd = crowdLayout(shown, cfg);

    it(`stands behind the snow edge, feet buried, on the ${name} course`, () => {
      expect(crowd.length).toBeGreaterThan(40);
      for (const f of crowd) {
        for (const x of [f.x, f.x + f.width])
          expect(
            f.footY - groundY(shown, x, cfg),
            `figure at ${f.x.toFixed(0)}`,
          ).toBeGreaterThanOrEqual(FEET_BURIED - 1e-9);
        // Shorter than the player's 16, so it reads as further away (FN-2) -
        // allowing the back row its riser.
        expect(f.height).toBeLessThanOrEqual(f.row === 1 ? 17 : 14);
      }
    });

    it(`leaves open snow where the skier stops, on the ${name} course`, () => {
      const L = course.length;
      for (const f of crowd)
        expect(
          f.x + f.width < L + cfg.crowdGapFrom || f.x > L + cfg.crowdGapTo,
          `figure at ${f.x.toFixed(0)} stands in the stopping gap`,
        ).toBe(true);
    });

    it(`is the same crowd every time on the ${name} course`, () => {
      expect(crowdLayout(shown, cfg)).toEqual(crowd);
    });
  }

  it('draws in ink, cyan and yellow only: no skin, no orange, no magenta', () => {
    const src = readFileSync(join(root, 'src/render/draw.ts'), 'utf8');
    const body = src.slice(
      src.indexOf('function drawCrowd('),
      src.indexOf('/** Snow thrown off the skis'),
    );
    expect(body.length).toBeGreaterThan(100);
    const tokens = new Set([...body.matchAll(/css\('(\w+)'\)/g)].map((m) => m[1]));
    expect([...tokens].sort()).toEqual(['cyan', 'ink']);
    // Flag colours come from the layout, which offers only these two.
    for (const f of crowdLayout(withRunout(official, cfg), cfg))
      if (f.flag) expect(['yellow', 'cyan']).toContain(f.flag);
  });
});

describe('the celebration (FN-3, F9)', () => {
  const crowd = crowdLayout(withRunout(official, cfg), cfg);

  it('is idle before the line: arms down, sway slow enough', () => {
    for (const f of crowd.slice(0, 10))
      for (let t = 0; t < 120; t++) {
        const p = crowdPose(f, t, null, FULL_MOTION);
        expect(p.armsUp).toBe(false);
        expect(p.lift).toBe(0);
        expect(Math.abs(p.sway)).toBeLessThanOrEqual(0.8);
      }
  });

  it('celebrates from the crossing: arms up, hops no higher than 3 units', () => {
    let hopped = 0;
    for (const f of crowd)
      for (let u = 0; u < 120; u++) {
        const p = crowdPose(f, 1000 + u, u, FULL_MOTION);
        expect(p.armsUp).toBe(true);
        expect(p.lift).toBeLessThanOrEqual(3);
        if (p.lift > 1) hopped++;
      }
    expect(hopped).toBeGreaterThan(0);
  });

  it('under reduced motion, arms up and nothing moves', () => {
    for (const f of crowd)
      for (const since of [null, 0, 30, 90]) {
        for (let t = 0; t < 60; t++) {
          const p = crowdPose(f, t, since, REDUCED);
          expect(p.lift).toBe(0);
          expect(p.sway).toBe(0);
          expect(p.hatUp).toBeNull();
          expect(p.armsUp).toBe(since !== null);
        }
      }
  });
});
