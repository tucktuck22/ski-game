/**
 * The tuning vocabulary feature 006 changed (FR-226).
 *
 * The retired keys must be GONE, not merely unread. This repository already
 * carries the standing example of what unread data costs: the
 * `abandoned_official_runs` column, kept "just in case" and then read by a
 * leaderboard column that displayed a permanent zero for the life of the
 * deployment. A tuning key that no longer drives anything is the same trap with
 * a shorter fuse — the next person to tune the game reads `baseSpeed`, changes
 * it, plays, and finds nothing happened.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseTuning } from '../../src/data/load.js';
import { tuning } from '../sim/fixtures.js';

const raw = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../data/tuning.json'), 'utf8'),
) as Record<string, unknown>;

const RETIRED = ['baseSpeed', 'tuckSpeedMax', 'tuckAccel', 'tuckDecel', 'slopeAccelFactor'];
const ADDED = [
  'slopeFriction',
  'dragStanding',
  'dragTucked',
  'speedMin',
  'speedMax',
  'tuckTransientTicks',
];

describe('tuning keys (FR-226)', () => {
  it.each(RETIRED)('%s is deleted from tuning.json, not left unread', (key) => {
    expect(raw).not.toHaveProperty(key);
  });

  it.each(ADDED)('%s is present and finite', (key) => {
    expect(typeof raw[key]).toBe('number');
    expect(Number.isFinite(raw[key])).toBe(true);
  });

  it('no source file still reads a retired key', () => {
    // Cheap, and it is the check that would have caught the dead
    // `abandoned_official_runs` reader years earlier.
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const files = [
      'src/sim/physics.ts',
      'src/sim/step.ts',
      'src/course/validate.ts',
      'src/render/rampGeometry.ts',
      'src/data/load.ts',
      'src/sim/types.ts',
    ];
    for (const f of files) {
      const text = readFileSync(join(root, f), 'utf8');
      // Strip comments — the retired names are legitimately discussed there.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const key of RETIRED) {
        expect(code, `${f} still reads tuning.${key}`).not.toContain(`tuning.${key}`);
      }
    }
  });
});

describe('tuning relationships (FR-217, FR-219)', () => {
  it('a tuck reduces drag', () => {
    expect(tuning.dragTucked).toBeLessThan(tuning.dragStanding);
  });

  it('the bounds are ordered and positive', () => {
    expect(tuning.speedMin).toBeGreaterThan(0);
    expect(tuning.speedMin).toBeLessThan(tuning.speedMax);
  });

  it('rejects an inverted tuck, which would gate the trick economy behind going slower', () => {
    expect(() => parseTuning({ ...raw, dragTucked: raw['dragStanding'] })).toThrow(/dragTucked/);
  });

  it('rejects a zero speed floor, which would let a shallow pitch strand a player', () => {
    expect(() => parseTuning({ ...raw, speedMin: 0 })).toThrow(/speedMin/);
  });

  it('rejects inverted bounds', () => {
    expect(() => parseTuning({ ...raw, speedMin: 99 })).toThrow(/speedMin/);
  });

  it('rejects a frictionless piste', () => {
    expect(() => parseTuning({ ...raw, slopeFriction: 0 })).toThrow(/slopeFriction/);
  });
});
