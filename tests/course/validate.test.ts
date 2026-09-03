import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateCourse } from '../../src/course/validate.js';
import { parseCourse, parseScoring, parseTuning } from '../../src/data/load.js';
import type { Course, IceSection, Kicker, Ledge, Obstacle, Rock } from '../../src/sim/types.js';

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

  it('CV-12: two ledges overlapping, so a landing has two answers', () => {
    const c = clone(warmup);
    const l = c.ledges[0] as Ledge;
    c.ledges.push({ x0: l.x0 + 20, x1: l.x1 + 20, height: l.height });
    expect(rulesFired(c)).toContain('CV-12');
  });

  it('CV-12: a ledge higher than any launch could ever reach', () => {
    const c = clone(warmup);
    (c.ledges[0] as Ledge).height = 400;
    expect(rulesFired(c)).toContain('CV-12');
  });

  it('CV-13: a ledge with no ramp before it is scenery, not a track', () => {
    const c = clone(warmup);
    c.kickers = [];
    expect(rulesFired(c)).toContain('CV-13');
  });

  it('CV-13: a ramp strong enough to throw a base-speed skier onto the shelf', () => {
    // The trap this rule exists for. The course still validates on every other
    // rule; what it has quietly done is take the cautious pilot's line away.
    const c = clone(warmup);
    (c.kickers[0] as Kicker).power = 6;
    expect(rulesFired(c)).toContain('CV-13');
  });

  it('CV-13: a ramp too weak to reach the shelf even at full tuck', () => {
    const c = clone(warmup);
    (c.kickers[0] as Kicker).power = 0.4;
    expect(rulesFired(c)).toContain('CV-13');
  });

  it('CV-14: a shelf that runs into the bough it crosses', () => {
    const c = clone(warmup);
    const l = c.ledges[0] as Ledge;
    // A bough placed under the shelf, hanging above the shelf's own surface.
    c.obstacles.push({ x: l.x0 + 100, kind: 'low', width: 40, clearance: 12 });
    l.height = 20;
    expect(rulesFired(c)).toContain('CV-14');
  });

  it("CV-15: a ramp inside a bough's safe release window", () => {
    const c = clone(warmup);
    const bough = c.obstacles.find((o) => o.kind === 'low') as Obstacle;
    c.kickers.push({ x: bough.x + bough.width + 10, width: 40, power: 1.9 });
    expect(rulesFired(c)).toContain('CV-15');
  });

  it('CV-15: a ramp built inside a deadfall log', () => {
    const c = clone(warmup);
    const log = c.obstacles.find((o) => o.kind === 'solid') as Obstacle;
    c.kickers.push({ x: log.x - 5, width: 30, power: 1.9 });
    expect(rulesFired(c)).toContain('CV-15');
  });

  it('CV-16: a rock standing on nothing', () => {
    const c = clone(warmup);
    c.rocks.push({ x: 50, width: 10, height: 8 });
    expect(rulesFired(c)).toContain('CV-16');
  });

  it('CV-17: a rock too tall for anything on the shelf to clear', () => {
    const c = clone(warmup);
    (c.rocks[0] as Rock).height = 90;
    expect(rulesFired(c)).toContain('CV-17');
  });

  it('CV-18: ice too long to escape, so the countdown is decoration', () => {
    const c = clone(warmup);
    const ice = c.ice[0] as IceSection;
    ice.x1 = ice.x0 + 400;
    expect(rulesFired(c)).toContain('CV-18');
  });

  it('CV-18: ice short enough to ride across, so the ice is decoration', () => {
    // The other half. A hazard nobody can trigger is as broken as one nobody
    // can survive, and only one of the two looks wrong in a course file.
    const c = clone(warmup);
    const ice = c.ice[0] as IceSection;
    ice.x1 = ice.x0 + 5;
    expect(rulesFired(c)).toContain('CV-18');
  });

  it('CV-19: ice that drops the player onto a log', () => {
    const c = clone(warmup);
    const ice = c.ice[0] as IceSection;
    c.obstacles.push({ x: ice.x0 + 10, kind: 'solid', width: 24, clearance: 0 });
    expect(rulesFired(c)).toContain('CV-19');
  });

  it('CV-20: a rock in the shelf landing zone, before the player can read it', () => {
    const c = clone(warmup);
    c.rocks.push({ x: (c.ledges[0] as Ledge).x0 + 20, width: 10, height: 8 });
    expect(rulesFired(c)).toContain('CV-20');
  });
});
