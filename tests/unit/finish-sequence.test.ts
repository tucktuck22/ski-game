import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseFinish } from '../../src/data/load.js';
import { FinishSequence, groundY, isNewPress, withRunout } from '../../src/render/finish.js';
import { FULL_MOTION, type MotionSettings } from '../../src/render/reducedMotion.js';
import { CAMERA_X_OFFSET } from '../../src/render/stage.js';
import { terrainYAt } from '../../src/sim/terrain.js';
import type { Course, RunState } from '../../src/sim/types.js';
import { official, tuning, warmup } from '../sim/fixtures.js';
import { ride, type Pilot } from '../sim/pilots.js';

/** specs/009-finish-line-crowd/contracts/finish-sequence.md, F3 to F5 and F9 to F11. */
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = parseFinish(JSON.parse(readFileSync(join(root, 'data/finish.json'), 'utf8')));
const REDUCED: MotionSettings = { ...FULL_MOTION, shake: false, flashes: false, parallax: false };
const COURSES: [string, Course][] = [
  ['official', official],
  ['warm-up', warmup],
];
const PILOTS: Pilot[] = ['tuck', 'stay-low', 'low-line'];

const sequence = (course: Course): FinishSequence =>
  new FinishSequence(withRunout(course, cfg), cfg, tuning.gravity, CAMERA_X_OFFSET);

/** Runs a sequence from `final` to its end, returning every skier state seen. */
function play(
  course: Course,
  final: RunState,
  motion = FULL_MOTION,
): { seq: FinishSequence; seen: RunState[] } {
  const seq = sequence(course);
  seq.start(final, motion);
  const seen: RunState[] = [];
  while (!seq.done) {
    seq.advance();
    seen.push({ ...seq.skier()! });
  }
  return { seq, seen };
}

const slopeAngleAt = (course: Course, x: number): number => {
  const shown = withRunout(course, cfg);
  return Math.atan2(groundY(shown, x + 0.5, cfg) - groundY(shown, x - 0.5, cfg), 1);
};

describe('F3: from every measuring pilot, the skier comes to a stop on the snow', () => {
  for (const [name, course] of COURSES) {
    for (const pilot of PILOTS) {
      it(`${pilot} on the ${name} course`, () => {
        const final = ride(course, pilot, 1).state;
        expect(final.outcome, 'the pilot must finish for this to mean anything').toBe('finished');
        const { seq, seen } = play(course, final);
        let stoppedAt = -1;
        seen.forEach((s, i) => {
          for (const v of [s.x, s.y, s.vx, s.vy, s.ox, s.oy]) expect(Number.isFinite(v)).toBe(true);
          expect(s.y, `${name} ${pilot} tick ${i} below the snow`).toBeLessThanOrEqual(
            groundY(withRunout(course, cfg), s.x, cfg) + 0.01,
          );
          if (stoppedAt < 0 && s.vx === 0 && s.grounded) stoppedAt = i + 1;
        });
        expect(stoppedAt, `${name} ${pilot} never stopped`).toBeGreaterThan(0);
        // In the open snow the crowd leaves for him (FR-275).
        const rest = seen[seen.length - 1]!.x - course.length;
        expect(rest).toBeGreaterThanOrEqual(cfg.crowdGapFrom);
        expect(rest).toBeLessThanOrEqual(cfg.crowdGapTo);
        expect(seq.holdTicks - stoppedAt, 'the stop must be seen').toBeGreaterThanOrEqual(60);
      });
    }
  }
});

describe('F4: however he crosses, he lands clean', () => {
  const L = official.length;
  const base = ride(official, 'tuck', 1).state;
  const cases: [string, RunState][] = [
    [
      'on the shelf that ends at the line',
      {
        ...base,
        x: L,
        y: terrainYAt(official.terrain, L) - 50,
        vx: 7,
        vy: 4.2,
        grounded: true,
        ledge: official.ledges.length - 1,
      },
    ],
    [
      'in the air, two radians into a spin',
      (() => {
        const a = Math.atan2(0.6, 1) + 2;
        return {
          ...base,
          x: L,
          y: terrainYAt(official.terrain, L) - 40,
          vx: 6,
          vy: -2,
          grounded: false,
          ledge: -1,
          ox: Math.cos(a),
          oy: Math.sin(a),
        };
      })(),
    ],
  ];
  for (const [label, final] of cases) {
    it(label, () => {
      const seq = sequence(official);
      seq.start(final, FULL_MOTION);
      let landedAt = -1;
      for (let t = 1; !seq.done; t++) {
        seq.advance();
        const s = seq.skier()!;
        expect(s.y).toBeLessThanOrEqual(groundY(withRunout(official, cfg), s.x, cfg) + 0.01);
        if (landedAt < 0 && s.grounded) landedAt = t;
        // Settled on the ground's slope once the settle is over, and from then on.
        if (landedAt > 0 && t >= Math.max(landedAt, 8)) {
          const diff = Math.atan2(
            Math.sin(Math.atan2(s.oy, s.ox) - slopeAngleAt(official, s.x)),
            Math.cos(Math.atan2(s.oy, s.ox) - slopeAngleAt(official, s.x)),
          );
          expect(Math.abs(diff), `tick ${t}`).toBeLessThan(0.01);
        }
      }
      expect(landedAt, 'he must come down').toBeGreaterThan(0);
      expect(seq.phase).toBe('stopped');
      const rest = seq.skier()!.x - official.length;
      expect(rest, 'he stops in the open snow').toBeGreaterThanOrEqual(cfg.crowdGapFrom);
      expect(rest, 'he stops in the open snow').toBeLessThanOrEqual(cfg.crowdGapTo);
    });
  }
});

describe('F5: only a new press skips', () => {
  it('ignores a held key, honours a fresh one and a tap', () => {
    expect(isNewPress({ type: 'keydown', repeat: true })).toBe(false);
    expect(isNewPress({ type: 'keydown', repeat: false })).toBe(true);
    expect(isNewPress({ type: 'pointerdown' })).toBe(true);
    expect(isNewPress({ type: 'keyup', repeat: false })).toBe(false);
  });

  it('ends the hold on the next tick', () => {
    const seq = sequence(warmup);
    seq.start(ride(warmup, 'tuck', 1).state, FULL_MOTION);
    seq.advance();
    expect(seq.done).toBe(false);
    seq.skip();
    expect(seq.done).toBe(true);
  });
});

describe('F9 and F10: the beat', () => {
  it('holds as long as the wipeout, and shorter under reduced motion, with no spray', () => {
    const final = ride(warmup, 'tuck', 1).state;
    expect(play(warmup, final).seen.length).toBe(cfg.holdTicks);
    const reduced = play(warmup, final, REDUCED);
    expect(reduced.seen.length).toBe(cfg.reducedHoldTicks);
    const seq = sequence(warmup);
    seq.start(final, REDUCED);
    for (let t = 0; t < 20; t++) {
      seq.advance();
      expect(seq.sprayParticles().length).toBe(0);
    }
  });

  it('moves only when advanced', () => {
    const seq = sequence(warmup);
    seq.start(ride(warmup, 'tuck', 1).state, FULL_MOTION);
    seq.advance();
    const a = { ...seq.skier()! };
    // Drawing reads; it never advances.
    seq.skier();
    seq.cameraX();
    seq.sprayParticles();
    expect(seq.skier()).toEqual(a);
    expect(seq.elapsed).toBe(1);
  });
});

describe('F11: the camera never jumps during the hold', () => {
  for (const [name, course] of COURSES) {
    for (const pilot of PILOTS) {
      it(`${pilot} on the ${name} course`, () => {
        const final = ride(course, pilot, 1).state;
        const seq = sequence(course);
        seq.start(final, FULL_MOTION);
        // Continuous with the run's own camera on the crossing tick.
        let prevCam = final.x - CAMERA_X_OFFSET;
        let prevX = final.x;
        expect(Math.abs(seq.cameraX() - prevCam)).toBeLessThan(1e-9);
        while (!seq.done) {
          seq.advance();
          const s = seq.skier()!;
          expect(Math.abs(seq.cameraX() - prevCam)).toBeLessThanOrEqual(Math.abs(s.x - prevX) + 1);
          prevCam = seq.cameraX();
          prevX = s.x;
        }
      });
    }
  }
});
