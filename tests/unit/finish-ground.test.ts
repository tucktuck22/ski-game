import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseFinish } from '../../src/data/load.js';
import { groundY } from '../../src/render/finish.js';
import { terrainYAt } from '../../src/sim/terrain.js';
import { official, tuning, warmup } from '../sim/fixtures.js';

/** The ground past the line - contracts/finish-data.md, F1 and F2. */
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = parseFinish(JSON.parse(readFileSync(join(root, 'data/finish.json'), 'utf8')));
const COURSES = [
  ['official', official],
  ['warm-up', warmup],
] as const;

describe('the drawn ground (F1, F2)', () => {
  for (const [name, course] of COURSES) {
    const L = course.length;

    it(`F1: is the course's own terrain, exactly, everywhere up to the line (${name})`, () => {
      for (let x = 0; x <= L; x++) {
        expect(groundY(course, x, cfg), `${name} x=${x}`).toBe(terrainYAt(course.terrain, x));
      }
    });

    it(`F2: eases to flat past the line without a corner (${name})`, () => {
      const slope = (x: number): number =>
        groundY(course, x + 0.5, cfg) - groundY(course, x - 0.5, cfg);
      const atLine = terrainYAt(course.terrain, L) - terrainYAt(course.terrain, L - 1);
      // No step in height or slope at the line.
      expect(Math.abs(groundY(course, L + 1e-6, cfg) - groundY(course, L, cfg))).toBeLessThan(1e-4);
      expect(Math.abs(slope(L + 0.5) - atLine)).toBeLessThan(0.01);
      // Falling monotonically to nothing by runoutEase, and flat after.
      let prev = Infinity;
      for (let u = 1; u <= cfg.runoutEase; u++) {
        const s = slope(L + u);
        expect(s, `${name} u=${u}`).toBeLessThanOrEqual(prev + 1e-9);
        prev = s;
      }
      for (let u = cfg.runoutEase + 1; u < cfg.runoutEase + 600; u += 7)
        expect(Math.abs(slope(L + u)), `${name} u=${u}`).toBeLessThan(1e-9);
      // Where the last tick of a run can reach (one tick at speedMax), it barely
      // differs from the data: a
      // quarter of a pixel at most. The warm-up's data itself turns from 0.30 to
      // 0.32 at its line, which is most of that.
      for (let u = 0; u <= Math.ceil(tuning.speedMax); u++)
        expect(
          Math.abs(groundY(course, L + u, cfg) - terrainYAt(course.terrain, L + u)),
        ).toBeLessThan(0.25);
    });
  }
});
