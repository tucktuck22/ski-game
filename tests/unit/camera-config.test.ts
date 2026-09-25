import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCamera } from '../../src/data/load.js';

/**
 * data/camera.json - how far the camera looks down the steeps (feature 008).
 *
 * These values set how many milliseconds a player gets to see a hazard, so they
 * are feel and live in data (Principle III). A data file is only as good as the
 * parser guarding it: a typo here would otherwise surface as a camera that
 * silently stopped looking down, which no player would report as a bug.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const shipped = JSON.parse(readFileSync(join(root, 'data/camera.json'), 'utf8')) as Record<
  string,
  unknown
>;

describe('data/camera.json', () => {
  it("parses, with the values research R2 and R3 measured against, and FR-261's rates", () => {
    expect(parseCamera(shipped)).toEqual({
      lookMargin: 4,
      shelfMargin: 8,
      shelfEaseIn: 120,
      lookRateAir: 1,
      lookRateGround: 3.5,
      lookRampTicks: 12,
    });
  });

  for (const key of ['lookRateAir', 'lookRateGround'] as const) {
    it(`refuses a zero "${key}", which would freeze the look-down`, () => {
      expect(() => parseCamera({ ...shipped, [key]: 0 })).toThrow(
        `camera.json: "${key}" must be positive`,
      );
    });
  }

  for (const key of [
    'lookMargin',
    'shelfMargin',
    'shelfEaseIn',
    'lookRateAir',
    'lookRateGround',
    'lookRampTicks',
  ] as const) {
    it(`refuses a missing "${key}", naming it`, () => {
      const { [key]: _gone, ...rest } = shipped;
      expect(() => parseCamera(rest)).toThrow(`camera.json: "${key}" must be a number`);
    });

    it(`refuses a non-number "${key}"`, () => {
      expect(() => parseCamera({ ...shipped, [key]: '4' })).toThrow(`"${key}" must be a number`);
    });

    it(`refuses a negative "${key}"`, () => {
      expect(() => parseCamera({ ...shipped, [key]: -1 })).toThrow(
        `camera.json: "${key}" must not be negative, got -1`,
      );
    });
  }
});
