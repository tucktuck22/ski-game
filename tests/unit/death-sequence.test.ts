import { describe, it, expect } from 'vitest';
import { DeathSequence, deathSequenceMs } from '../../src/render/death.js';
import { FULL_MOTION, REDUCED_MOTION } from '../../src/render/reducedMotion.js';

/**
 * FR-131: the wipeout holds the frame before the results panel.
 *
 * What must not go wrong is the sequence never ending. The caller awaits it
 * before changing the screen, so a sequence that failed to finish would leave
 * the player stuck looking at his own corpse with no way forward — worse than
 * the instant cut it replaced.
 */
describe('the wipeout sequence (FR-131)', () => {
  it('is inert until a run actually ends', () => {
    const d = new DeathSequence();
    expect(d.active).toBe(false);
    expect(d.done).toBe(true); // nothing to wait for
    expect(d.tumble()).toEqual({ spin: 0, slide: 0 });
  });

  it('runs for a few seconds and then finishes', () => {
    const d = new DeathSequence();
    d.start(FULL_MOTION);
    expect(d.active).toBe(true);
    for (let i = 0; i < 10_000; i++) {
      if (d.done) break;
      d.advance();
    }
    expect(d.done).toBe(true);
    expect(d.active).toBe(false);
  });

  it('holds long enough to be a beat, and not so long it is a wait', () => {
    const ms = deathSequenceMs(FULL_MOTION);
    expect(ms).toBeGreaterThan(1500);
    expect(ms).toBeLessThan(4000);
  });

  it('carries the body a little way and then stops it', () => {
    // He is dead, not sliding to the bottom of the mountain.
    const d = new DeathSequence();
    d.start(FULL_MOTION);
    for (let i = 0; i < 40; i++) d.advance();
    const mid = d.tumble();
    expect(mid.slide).toBeGreaterThan(0);
    expect(mid.spin).toBeGreaterThan(0);

    for (let i = 0; i < 200; i++) d.advance();
    const end = d.tumble();
    expect(end.slide).toBeCloseTo(17, 5);
    expect(end.spin).toBeCloseTo(5.6, 5);
  });

  it('ends immediately when the player skips it', () => {
    const d = new DeathSequence();
    d.start(FULL_MOTION);
    d.advance();
    expect(d.done).toBe(false);
    d.skip();
    expect(d.done).toBe(true);
  });

  it('keeps the beat under reduced motion but drops the movement', () => {
    // Cutting straight to the panel is the jarring transition this exists to
    // remove, so reduced motion shortens the hold rather than skipping it.
    const d = new DeathSequence();
    d.start(REDUCED_MOTION);
    expect(d.done).toBe(false);
    for (let i = 0; i < 40; i++) d.advance();
    expect(d.tumble()).toEqual({ spin: 0, slide: 0 });

    expect(deathSequenceMs(REDUCED_MOTION)).toBeLessThan(deathSequenceMs(FULL_MOTION));
    expect(deathSequenceMs(REDUCED_MOTION)).toBeGreaterThan(0);
  });

  it('cannot be restarted midway and stretched out', () => {
    const d = new DeathSequence();
    d.start(FULL_MOTION);
    for (let i = 0; i < 50; i++) d.advance();
    d.start(FULL_MOTION);
    const before = d.tumble();
    expect(before.slide).toBeGreaterThan(0);
  });
});
