import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCamera, parseFinish } from '../../src/data/load.js';
import { cameraFor } from '../../src/render/draw.js';
import { gantryOf, withRunout } from '../../src/render/finish.js';
import { LookFollower } from '../../src/render/rampGeometry.js';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, PLAYER_LOOKAHEAD } from '../../src/render/stage.js';
import type { Course } from '../../src/sim/types.js';
import { official, warmup } from './fixtures.js';
import { ride, type Pilot } from './pilots.js';

/**
 * F6, SC-094: the finish is on screen before the player reaches it - from the
 * full view ahead every device is promised - on the game's own camera.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string): unknown => JSON.parse(readFileSync(join(root, p), 'utf8'));
const cfg = parseFinish(read('data/finish.json'));
const framing = parseCamera(read('data/camera.json'));

describe(`the finish is in view from ${PLAYER_LOOKAHEAD} units out (F6, SC-094)`, () => {
  for (const [name, course] of [
    ['official', official],
    ['warm-up', warmup],
  ] as [string, Course][]) {
    for (const pilot of ['tuck', 'stay-low', 'low-line'] as Pilot[]) {
      it(`${pilot} on the ${name} course`, () => {
        const shown = withRunout(course, cfg);
        const g = gantryOf(course, cfg);
        const f = new LookFollower(shown, framing);
        let checked = 0;
        ride(course, pilot, 1, (_b, s) => {
          const cam = cameraFor(s, shown, framing, f.advance(s));
          if (s.x < course.length - PLAYER_LOOKAHEAD) return;
          checked++;
          const at = `tick ${s.tick}, ${Math.round(course.length - s.x)} out`;
          // The banner's middle is on screen across, and the whole banner up and down.
          expect(g.x - cam.x, at).toBeLessThanOrEqual(INTERNAL_WIDTH);
          expect(g.x - cam.x, at).toBeGreaterThanOrEqual(0);
          expect(g.bannerTop - cam.y, at).toBeGreaterThanOrEqual(0);
          expect(g.bannerBottom - cam.y, at).toBeLessThanOrEqual(INTERNAL_HEIGHT);
        });
        expect(checked).toBeGreaterThan(0);
      });
    }
  }
});
