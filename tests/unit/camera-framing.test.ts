import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cameraFor } from '../../src/render/draw.js';
import { AIR_LIFT_MAX, cameraAirLift } from '../../src/render/rampGeometry.js';
import { CAMERA_X_OFFSET, INTERNAL_HEIGHT, PLAYER_LOOKAHEAD } from '../../src/render/stage.js';
import { parseCamera } from '../../src/data/load.js';
import { initialState } from '../../src/sim/step.js';
import { terrainYAt } from '../../src/sim/terrain.js';
import type { Course, RunState } from '../../src/sim/types.js';
import { official, tuning, warmup } from '../sim/fixtures.js';
import { ride } from '../sim/pilots.js';

/**
 * The camera looks down the steeps. specs/008-reaction-time-speed/contracts/camera-framing.md.
 *
 * It used to hold the skier 60% of the way down the frame on every slope, which on
 * ground steeper than about 0.41 hid the piste the 213-unit lookahead promised: a
 * log was under the bottom edge when it was close enough to see. These pin what
 * replaced that - and, just as much, what it must not disturb: the view ahead, the
 * booters' headroom, a shelf overhead, and a camera that never jumps.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const framing = parseCamera(JSON.parse(readFileSync(join(root, 'data/camera.json'), 'utf8')));
const COURSES: [string, Course][] = [
  ['official', official],
  ['warm-up', warmup],
];

/** A skier standing on the piste at x. */
function grounded(course: Course, x: number): RunState {
  const s = initialState(course, tuning, 1);
  return { ...s, x, y: terrainYAt(course.terrain, x), grounded: true, ledge: -1 };
}

/** The shift the camera applied on top of the skier's own height. */
const shiftOf = (s: RunState, course: Course): number =>
  cameraFor(s, course, framing).y - (s.y - INTERNAL_HEIGHT * 0.6);

/** Within a shelf's reach, where the overhead cap may hold the camera back (R3). */
const nearShelf = (course: Course, x: number): boolean =>
  course.ledges.some((l) => x >= l.x0 - framing.shelfEaseIn && x < l.x1 + framing.shelfEaseIn);

const drop = (course: Course, x: number): number =>
  terrainYAt(course.terrain, x + PLAYER_LOOKAHEAD) - terrainYAt(course.terrain, x);

/** Sample x along a course in 10-unit steps, stopping short of the end. */
const along = (course: Course): number[] => {
  const xs: number[] = [];
  for (let x = 0; x + PLAYER_LOOKAHEAD < course.length; x += 10) xs.push(x);
  return xs;
};

describe('camera framing (FR-257, FR-258, FR-259)', () => {
  it('C1: the view ahead is 213 units horizontally, exactly as before', () => {
    for (const [, course] of COURSES) {
      for (const x of along(course)) {
        expect(cameraFor(grounded(course, x), course, framing).x).toBe(x - CAMERA_X_OFFSET);
      }
    }
  });

  it('C2: on gentle ground the camera is exactly where it always was', () => {
    for (const [name, course] of COURSES) {
      for (const x of along(course)) {
        if (drop(course, x) > INTERNAL_HEIGHT * 0.4 - framing.lookMargin) continue;
        const s = grounded(course, x);
        expect(cameraFor(s, course, framing).y, `${name} x=${x}`).toBe(
          s.y - INTERNAL_HEIGHT * 0.6 + cameraAirLift(terrainYAt(course.terrain, x) - s.y),
        );
      }
    }
  });

  it('C3: the whole 213 units of piste ahead are on screen, margin included', () => {
    for (const [name, course] of COURSES) {
      for (const x of along(course)) {
        if (nearShelf(course, x)) continue;
        const cam = cameraFor(grounded(course, x), course, framing);
        for (let ahead = 0; ahead <= PLAYER_LOOKAHEAD; ahead += 10) {
          const y = terrainYAt(course.terrain, x + ahead) - cam.y;
          expect(
            y,
            `${name}: piste ${ahead} ahead of x=${x} is at screen row ${y.toFixed(1)}`,
          ).toBeLessThanOrEqual(INTERNAL_HEIGHT - framing.lookMargin + 1e-9);
          expect(y).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('SC-093: on every stretch steeper than 0.41, a hazard is on screen at 213 units', () => {
    let steep = 0;
    for (const [name, course] of COURSES) {
      const t = course.terrain;
      for (let i = 1; i < t.length; i++) {
        const a = t[i - 1]!;
        const b = t[i]!;
        if ((b.y - a.y) / (b.x - a.x) <= 0.41 || b.x + PLAYER_LOOKAHEAD > course.length) continue;
        for (let x = a.x; x < b.x; x += 10) {
          if (nearShelf(course, x)) continue;
          steep++;
          const cam = cameraFor(grounded(course, x), course, framing);
          const far = terrainYAt(t, x + PLAYER_LOOKAHEAD) - cam.y;
          expect(far, `${name} x=${x}: the piste 213 ahead is off the bottom`).toBeLessThanOrEqual(
            INTERNAL_HEIGHT,
          );
        }
      }
    }
    // A test that found no steep ground would pass by never looking.
    expect(steep).toBeGreaterThan(0);
  });

  it('C4: never less than the air lift, never past the headroom ceiling', () => {
    for (const [name, course] of COURSES) {
      ride(course, 'tuck', 1, (_b, s) => {
        const shift = shiftOf(s, course);
        const lift = cameraAirLift(terrainYAt(course.terrain, s.x) - s.y);
        // 1e-9: the shift is recovered by subtracting the skier's height back out,
        // which costs the last few bits; the camera itself adds nothing.
        expect(shift, `${name} tick ${s.tick}`).toBeGreaterThanOrEqual(lift - 1e-9);
        expect(shift, `${name} tick ${s.tick}`).toBeLessThanOrEqual(AIR_LIFT_MAX + 1e-9);
      });
    }
  });

  it('C5: riding the piste beneath or towards a shelf, the shelf stays in frame', () => {
    for (const [name, course] of COURSES) {
      let checked = 0;
      ride(course, 'low-line', 1, (_b, s) => {
        if (!s.grounded || s.ledge >= 0) return;
        const cam = cameraFor(s, course, framing);
        for (const l of course.ledges) {
          if (s.x < l.x0 - framing.shelfEaseIn || s.x >= l.x1) continue;
          // The nearest part of the shelf that is on screen horizontally.
          const x = Math.min(Math.max(s.x, l.x0), l.x1);
          const top = terrainYAt(course.terrain, x) - l.height - cam.y;
          checked++;
          expect(top, `${name}: shelf top at screen row ${top.toFixed(1)}, x=${s.x.toFixed(0)}`)
            // A hair of float tolerance: the cap is exactly this far in on flat ground.
            .toBeGreaterThanOrEqual(framing.shelfMargin - 0.5);
        }
      });
      expect(checked, `${name}: the low-line ride never passed under a shelf`).toBeGreaterThan(0);
    }
  });

  it('C6: the camera never jumps - at most 4 units a tick, as before', () => {
    for (const [name, course] of COURSES) {
      for (const pilot of ['low-line', 'tuck'] as const) {
        let prev: number | null = null;
        ride(course, pilot, 1, (_b, s) => {
          const shift = shiftOf(s, course);
          if (prev !== null) {
            expect(Math.abs(shift - prev), `${name} ${pilot} tick ${s.tick}`).toBeLessThanOrEqual(
              4,
            );
          }
          prev = shift;
        });
      }
    }
  });

  it('C7: drawing only - the look-down cannot reach the simulation', () => {
    const src = readFileSync(join(root, 'src/render/rampGeometry.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\.\/sim\/step\.js'/);
    const sim = ['step.ts', 'physics.ts', 'run.ts'].map((f) =>
      readFileSync(join(root, 'src/sim', f), 'utf8'),
    );
    for (const f of sim) expect(f).not.toMatch(/render\//);
  });
});
