import { describe, it, expect } from 'vitest';
import { LandingEffect } from '../../src/render/landing.js';
import {
  FULL_MOTION,
  REDUCED_MOTION,
  MIN_FLASH_INTERVAL_MS,
} from '../../src/render/reducedMotion.js';

/**
 * FR-111 to FR-113: the flash and kick on landing on the upper track.
 *
 * The two properties worth testing are the ones a player could be harmed by
 * getting wrong. Reduced motion must silence both halves completely (FR-113,
 * and feature 001's FR-056), and the flash must not be able to strobe however
 * often the transition fires — a player bouncing on and off a shelf is exactly
 * the case feature 001's FR-057 ceiling exists for.
 */
describe('landing effect (FR-111 to FR-113)', () => {
  it('flashes and kicks on a landing', () => {
    const e = new LandingEffect();
    e.trigger(0, FULL_MOTION);
    expect(e.flashAlpha()).toBeGreaterThan(0);
    const s = e.shake();
    expect(s.x === 0 && s.y === 0).toBe(false);
  });

  it('does neither when reduced motion is on (FR-113)', () => {
    const e = new LandingEffect();
    e.trigger(0, REDUCED_MOTION);
    expect(e.flashAlpha()).toBe(0);
    expect(e.shake()).toEqual({ x: 0, y: 0 });
  });

  it('still kicks for a player who disabled flashing but not shake', () => {
    // The two are separate settings in feature 001, so they are gated
    // separately here rather than behind one flag.
    const e = new LandingEffect();
    e.trigger(0, { ...FULL_MOTION, flashes: false });
    expect(e.flashAlpha()).toBe(0);
    expect(e.shake().y === 0).toBe(false);
  });

  it('refuses to flash again inside the flash interval (FR-057)', () => {
    const e = new LandingEffect();
    e.trigger(0, FULL_MOTION);
    expect(e.flashAlpha()).toBeGreaterThan(0);
    // A second landing a few milliseconds later — a player dropping off one
    // shelf straight onto the next.
    e.trigger(20, FULL_MOTION);
    expect(e.flashAlpha()).toBe(0);
    // Past the ceiling, it is allowed again.
    e.trigger(MIN_FLASH_INTERVAL_MS + 1, FULL_MOTION);
    expect(e.flashAlpha()).toBeGreaterThan(0);
  });

  it('decays to nothing and stays there', () => {
    const e = new LandingEffect();
    e.trigger(0, FULL_MOTION);
    for (let i = 0; i < 60; i++) e.advance();
    expect(e.flashAlpha()).toBe(0);
    expect(e.shake()).toEqual({ x: 0, y: 0 });
  });

  it('is inert until something actually lands', () => {
    const e = new LandingEffect();
    expect(e.flashAlpha()).toBe(0);
    expect(e.shake()).toEqual({ x: 0, y: 0 });
  });
});
