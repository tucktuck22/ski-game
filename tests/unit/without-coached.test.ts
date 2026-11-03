/**
 * FR-197: free play never rides the coached opening.
 *
 * The badges were already gated on run kind; this covers the terrain. Free play
 * on the warm-up is served `withoutCoached(warmup)`, which must start exactly
 * where the coached section ends and carry every warm-up feature after it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Course, Scoring, Tuning } from '../../src/sim/types.js';
import { COACHED_SPAN, withoutCoached } from '../../src/course/withoutCoached.js';
import { CUES } from '../../src/render/coachingCue.js';
import { assertCourseValid } from '../../src/course/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = <T>(p: string): T => JSON.parse(readFileSync(join(root, p), 'utf8')) as T;
const warmup = read<Course>('data/courses/warmup.json');
const tuning = read<Tuning>('data/tuning.json');
const scoring = read<Scoring>('data/scoring.json');

describe('withoutCoached', () => {
  it('COACHED_SPAN sits after every coaching cue, on a terrain point', () => {
    for (const cue of CUES) expect(cue.to).toBeLessThanOrEqual(COACHED_SPAN);
    expect(warmup.terrain.some((p) => p.x === COACHED_SPAN)).toBe(true);
  });

  it('drops every coached object and keeps every warm-up one', () => {
    const free = withoutCoached(warmup);
    const coachedCount = (xs: { x: number }[]): number =>
      xs.filter((o) => o.x < COACHED_SPAN).length;
    expect(free.obstacles.length).toBe(warmup.obstacles.length - coachedCount(warmup.obstacles));
    expect(free.kickers.length).toBe(warmup.kickers.length - coachedCount(warmup.kickers));
    expect(free.pickups.length).toBe(warmup.pickups.length - coachedCount(warmup.pickups));
    expect(free.ledges.length).toBe(warmup.ledges.length);
    expect(free.rocks.length).toBe(warmup.rocks.length);
    expect(free.ice.length).toBe(warmup.ice.length);
  });

  it('starts at the origin and is ridden on the warm-up proper, not the lesson pitch', () => {
    const free = withoutCoached(warmup);
    expect(free.terrain[0]).toEqual({ x: 0, y: 0 });
    expect(free.length).toBe(warmup.length - COACHED_SPAN);
    const [a, b] = free.terrain;
    const opening = (b!.y - a!.y) / (b!.x - a!.x);
    expect(opening, 'free play opens on coached-gentle ground').toBeGreaterThanOrEqual(0.25);
  });

  it('passes every course rule on its own', () => {
    expect(() => assertCourseValid(withoutCoached(warmup), tuning, scoring)).not.toThrow();
  });

  it('leaves the warm-up itself untouched (practice still gets the lesson)', () => {
    const before = JSON.stringify(warmup);
    withoutCoached(warmup);
    expect(JSON.stringify(warmup)).toBe(before);
  });
});
