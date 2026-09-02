import { describe, it, expect } from 'vitest';
import {
  FlashLimiter,
  FULL_MOTION,
  REDUCED_MOTION,
  MIN_FLASH_INTERVAL_MS,
} from '../../src/render/reducedMotion.js';

describe('flash limiting (FR-057)', () => {
  it('permits at most three full-screen flashes per second', () => {
    const l = new FlashLimiter();
    let allowed = 0;
    // 60 attempts across one second - one per frame at 60fps.
    for (let i = 0; i < 60; i++) if (l.allow(i * (1000 / 60), FULL_MOTION)) allowed++;
    expect(allowed).toBeLessThanOrEqual(3);
  });

  it('permits none at all under reduced motion', () => {
    const l = new FlashLimiter();
    for (let i = 0; i < 60; i++) expect(l.allow(i * 1000, REDUCED_MOTION)).toBe(false);
  });

  it('uses an interval that actually corresponds to three per second', () => {
    expect(MIN_FLASH_INTERVAL_MS).toBeCloseTo(333.33, 1);
  });
});

describe('reduced motion leaves the game playable (FR-056)', () => {
  it('disables every effect and nothing else', () => {
    // The settings object carries only presentation flags. If a timing or
    // scoring value ever appeared here, reduced motion would become a second
    // game - and the leaderboard decides where people sleep.
    expect(Object.keys(REDUCED_MOTION).sort()).toEqual([
      'bloom',
      'flashes',
      'parallax',
      'scanlines',
      'shake',
    ]);
    expect(Object.values(REDUCED_MOTION).every((v) => v === false)).toBe(true);
    expect(Object.values(FULL_MOTION).every((v) => v === true)).toBe(true);
  });
});
