import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateCourse } from '../../src/course/validate.js';
import { parseCourse, parseScoring, parseTuning } from '../../src/data/load.js';
import type { Course, Obstacle } from '../../src/sim/types.js';

const read = (p: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const tuning = parseTuning(read('data/tuning.json'));
const scoring = parseScoring(read('data/scoring.json'));
const warmup = parseCourse(read('data/courses/warmup.json'));
const official = parseCourse(read('data/courses/official.json'));

describe('shipped courses', () => {
  it('warm-up passes every validator rule', () => {
    expect(validateCourse(warmup, tuning, scoring)).toEqual([]);
  });

  it('official passes every validator rule', () => {
    expect(validateCourse(official, tuning, scoring)).toEqual([]);
  });

  it('warm-up and official are distinct terrain (FR-028)', () => {
    expect(warmup.terrain).not.toEqual(official.terrain);
    expect(warmup.id).not.toBe(official.id);
  });
});

// Each rule gets a fixture that violates it. A validator whose rules have never
// fired is not evidence of anything.
const clone = (c: Course): Course => JSON.parse(JSON.stringify(c)) as Course;
const rulesFired = (c: Course): string[] => [
  ...new Set(validateCourse(c, tuning, scoring).map((v) => v.rule)),
];

describe('validator rules fire on deliberately broken courses', () => {
  it('CV-1: non-increasing terrain x', () => {
    const c = clone(warmup);
    c.terrain[3] = { x: (c.terrain[1] as { x: number }).x, y: 10 };
    expect(rulesFired(c)).toContain('CV-1');
  });

  it('CV-1: terrain ending before the finish line', () => {
    const c = clone(warmup);
    c.length = 99999;
    expect(rulesFired(c)).toContain('CV-1');
  });

  it('CV-2: a segment too steep for the contact solver', () => {
    const c = clone(warmup);
    c.terrain[5] = { x: (c.terrain[5] as { x: number }).x, y: 99999 };
    expect(rulesFired(c)).toContain('CV-2');
  });

  it('CV-3: a low obstacle no crouch can fit under', () => {
    const c = clone(warmup);
    (c.obstacles.find((o) => o.kind === 'low') as Obstacle).clearance = 2;
    expect(rulesFired(c)).toContain('CV-3');
  });

  it('CV-3: a low obstacle that never forces a crouch', () => {
    const c = clone(warmup);
    (c.obstacles.find((o) => o.kind === 'low') as Obstacle).clearance = 40;
    expect(rulesFired(c)).toContain('CV-3');
  });

  it('CV-4: a low obstacle with no safe release window - the rule this validator exists for', () => {
    const c = clone(warmup);
    const first = c.obstacles.find((o) => o.kind === 'low') as Obstacle;
    // A second tunnel 30 units later leaves nowhere to stand up. FR-088 makes
    // releasing under it fatal, so this course would be unfinishable for anyone
    // who ducks - and it is completely invisible to review.
    c.obstacles.push({ x: first.x + first.width + 30, kind: 'low', width: 200, clearance: 12 });
    expect(rulesFired(c)).toContain('CV-4');
  });

  it('CV-5: low obstacles packed closer than the release window', () => {
    const c = clone(warmup);
    const first = c.obstacles.find((o) => o.kind === 'low') as Obstacle;
    c.obstacles.push({ x: first.x + first.width + 20, kind: 'low', width: 40, clearance: 12 });
    expect(rulesFired(c)).toContain('CV-5');
  });

  it('CV-6: a barrier that costs nothing to bypass', () => {
    const c = clone(warmup);
    c.barriers.push({ x: 500, width: 30, bypassCostTicks: 0 });
    expect(rulesFired(c)).toContain('CV-6');
  });

  it('CV-7: a solid obstacle overlapping a low one leaves no survivable line', () => {
    const c = clone(warmup);
    const first = c.obstacles.find((o) => o.kind === 'low') as Obstacle;
    c.obstacles.push({ x: first.x + 10, kind: 'solid', width: 20, clearance: 0 });
    expect(rulesFired(c)).toContain('CV-7');
  });

  it('CV-8: completion base that does not dominate the bonus pool (FR-034)', () => {
    const weak = { ...scoring, completionBase: 10 };
    expect(validateCourse(official, tuning, weak).map((v) => v.rule)).toContain('CV-8');
  });

  it('CV-9: a pickup below the surface', () => {
    const c = clone(warmup);
    c.pickups.push({ x: 400, y: 25, value: 'small' });
    expect(rulesFired(c)).toContain('CV-9');
  });

  it('CV-9: a pickup beyond any possible launch', () => {
    const c = clone(warmup);
    c.pickups.push({ x: 400, y: -500, value: 'large' });
    expect(rulesFired(c)).toContain('CV-9');
  });
});
