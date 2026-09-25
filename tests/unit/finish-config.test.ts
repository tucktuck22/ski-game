import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseFinish } from '../../src/data/load.js';
import { official, tuning, warmup } from '../sim/fixtures.js';

/** data/finish.json - specs/009-finish-line-crowd/contracts/finish-data.md, D1 and D2. */
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const shipped = JSON.parse(readFileSync(join(root, 'data/finish.json'), 'utf8')) as Record<
  string,
  unknown
>;

describe('data/finish.json (D1)', () => {
  it('parses, with the values research R1 to R7 settled on', () => {
    expect(parseFinish(shipped)).toEqual({
      holdTicks: 156,
      reducedHoldTicks: 54,
      runoutEase: 160,
      stopDistance: 200,
      stopWithinTicks: 90,
      frameLead: 60,
      frameFollow: 240,
      gantryHeight: 100,
      bannerWidth: 60,
      crowdFrom: -120,
      crowdTo: 420,
      crowdSpacing: 9,
    });
  });

  const keys = Object.keys(parseFinish(shipped));
  for (const key of keys) {
    it(`refuses a missing "${key}", naming it`, () => {
      const { [key]: _gone, ...rest } = shipped;
      expect(() => parseFinish(rest)).toThrow(`finish.json: "${key}" must be a number`);
    });
  }

  for (const key of keys.filter((k) => k !== 'crowdFrom')) {
    it(`refuses a negative "${key}"`, () => {
      expect(() => parseFinish({ ...shipped, [key]: -1 })).toThrow(`"${key}" must not be negative`);
    });
  }

  for (const key of ['holdTicks', 'reducedHoldTicks', 'stopWithinTicks']) {
    it(`refuses a zero or fractional "${key}"`, () => {
      expect(() => parseFinish({ ...shipped, [key]: 0 })).toThrow(
        `"${key}" must be a whole number`,
      );
      expect(() => parseFinish({ ...shipped, [key]: 1.5 })).toThrow(
        `"${key}" must be a whole number`,
      );
    });
  }

  it('refuses a crowd that ends before it starts', () => {
    expect(() => parseFinish({ ...shipped, crowdFrom: 10, crowdTo: 10 })).toThrow(
      '"crowdFrom" must be less',
    );
  });

  it('refuses a zero crowd spacing', () => {
    expect(() => parseFinish({ ...shipped, crowdSpacing: 0 })).toThrow(
      '"crowdSpacing" must be above zero',
    );
  });
});

describe('the gantry clears everything that can cross under it (D2)', () => {
  it('stands taller than the highest shelf on either course plus a standing skier', () => {
    const cfg = parseFinish(shipped);
    const tallest = Math.max(...[...official.ledges, ...warmup.ledges].map((l) => l.height));
    expect(cfg.gantryHeight).toBeGreaterThan(tallest + tuning.standHeight);
  });
});
