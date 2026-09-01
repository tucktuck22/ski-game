import { describe, it, expect } from 'vitest';
import { sqrtDet, approach, angleDelta, clamp, mag2 } from '../../src/sim/math.js';
import { makeRng, nextU32, nextFloat, cloneRng } from '../../src/sim/rng.js';

describe('sqrtDet', () => {
  it('matches Math.sqrt to full double precision across many magnitudes', () => {
    const cases = [1, 2, 3, 4, 1e-8, 0.5, 123.456, 65536, 1e12, 9.87e-30, 4.2e30];
    for (const x of cases) {
      expect(sqrtDet(x)).toBeCloseTo(Math.sqrt(x), 12);
      // Exact equality is what we actually want, and what we get:
      expect(sqrtDet(x)).toBe(Math.sqrt(x));
    }
  });

  it('handles the degenerate inputs without NaN', () => {
    expect(sqrtDet(0)).toBe(0);
    expect(sqrtDet(-1)).toBe(0);
    expect(sqrtDet(NaN)).toBe(0);
    expect(sqrtDet(Infinity)).toBe(Infinity);
  });

  it('is bit-identical when called repeatedly', () => {
    const a = sqrtDet(7.3);
    for (let i = 0; i < 100; i++) expect(sqrtDet(7.3)).toBe(a);
  });
});

describe('helpers', () => {
  it('approach never overshoots in either direction', () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(10, 0, 3)).toBe(7);
    expect(approach(1, 0, 3)).toBe(0);
  });
  it('angleDelta returns the short way round', () => {
    const tau = 6.283185307179586;
    expect(angleDelta(0.1, tau - 0.1, tau)).toBeCloseTo(0.2, 10);
    expect(angleDelta(tau - 0.1, 0.1, tau)).toBeCloseTo(-0.2, 10);
  });
  it('clamp and mag2 behave', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(mag2(3, 4)).toBe(25);
  });
});

describe('rng', () => {
  it('produces an identical stream from the same seed', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    for (let i = 0; i < 1000; i++) expect(nextU32(a)).toBe(nextU32(b));
  });

  it('produces different streams from different seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const sa = Array.from({ length: 50 }, () => nextU32(a));
    const sb = Array.from({ length: 50 }, () => nextU32(b));
    expect(sa).not.toEqual(sb);
  });

  it('stays inside [0,1) and is resumable from a clone', () => {
    const r = makeRng(99);
    for (let i = 0; i < 500; i++) {
      const v = nextFloat(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const snapshot = cloneRng(r);
    const first = [nextU32(r), nextU32(r), nextU32(r)];
    const again = [nextU32(snapshot), nextU32(snapshot), nextU32(snapshot)];
    expect(again).toEqual(first);
  });
});

describe('sqrtDet exactness sweep', () => {
  it('agrees with a correctly-rounded sqrt across 200k random magnitudes', () => {
    // The two-product correction in nearestRoot exists because of this test.
    // A naive `c * c` comparison failed it on ~17% of inputs.
    let mismatches = 0;
    let seed = 0x2f6e2b1;
    const rand = (): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 200_000; i++) {
      const x = rand() * 10 ** (Math.floor(rand() * 40) - 20);
      if (sqrtDet(x) !== Math.sqrt(x)) mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});
