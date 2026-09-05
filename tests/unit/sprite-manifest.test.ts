import { describe, it, expect } from 'vitest';

import { parseSprites } from '../../src/data/load.js';
import { POSE_KEYS } from '../../src/render/skierPose.js';
import spritesJson from '../../data/sprites.json';

/**
 * FR-160, FR-165, FR-173 and contracts/sprite-manifest.md.
 *
 * A bad manifest is a build-time defect rather than a runtime fallback, which is
 * parseAudio()'s stance applied identically. The bare-filename rule is the one
 * that earns its place: a path here works in dev and 404s under the production
 * base path, and unlike a blank page a missing sprite fails SILENTLY, because
 * FR-172 requires the run to carry on without it.
 */

const sheet = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'thing',
  file: 'thing.png',
  cellWidth: 16,
  cellHeight: 16,
  columns: 4,
  anchorX: 8,
  anchorY: 15,
  poses: { idle: { cells: [0] } },
  ...over,
});

const parse = (sheets: unknown[]): unknown => parseSprites({ sheets });

describe('the shipped manifest', () => {
  it('parses', () => {
    expect(() => parseSprites(spritesJson)).not.toThrow();
  });

  it('declares a skier sheet carrying every pose the renderer can select', () => {
    const manifest = parseSprites(spritesJson);
    const skier = manifest.sheets.find((s) => s.id === 'skier');
    expect(skier).toBeDefined();
    for (const pose of POSE_KEYS) {
      expect(Object.keys(skier!.poses), `missing pose "${pose}"`).toContain(pose);
    }
  });

  it('anchors the skier inside its own cell', () => {
    const skier = parseSprites(spritesJson).sheets.find((s) => s.id === 'skier')!;
    expect(skier.anchorX).toBeLessThanOrEqual(skier.cellWidth);
    expect(skier.anchorY).toBeLessThanOrEqual(skier.cellHeight);
  });
});

describe('structure', () => {
  it('rejects an empty or missing sheet list', () => {
    expect(() => parseSprites({})).toThrow(/non-empty array/);
    expect(() => parseSprites({ sheets: [] })).toThrow(/non-empty array/);
  });

  it('rejects duplicate sheet ids', () => {
    expect(() => parse([sheet(), sheet()])).toThrow(/duplicate sheet id/);
  });

  it('requires an id', () => {
    expect(() => parse([sheet({ id: '' })])).toThrow(/"id" must be a string/);
  });
});

describe('the bare-filename rule (FR-173)', () => {
  it('rejects a path, and says why', () => {
    expect(() => parse([sheet({ file: '/sprites/thing.png' })])).toThrow(
      /must be a bare filename, not a path/,
    );
    expect(() => parse([sheet({ file: 'sub/thing.png' })])).toThrow(/bare filename/);
  });

  it('requires a .png', () => {
    // research R2: sheets are indexed PNG, which is what makes the nine-colour
    // rule structural rather than a promise.
    expect(() => parse([sheet({ file: 'thing.webp' })])).toThrow(/ending \.png/);
  });
});

describe('cell geometry is exact and integral (FR-178)', () => {
  it.each(['cellWidth', 'cellHeight', 'columns'])('rejects a non-integer %s', (key) => {
    expect(() => parse([sheet({ [key]: 16.5 })])).toThrow(/positive integer/);
    expect(() => parse([sheet({ [key]: 0 })])).toThrow(/positive integer/);
  });

  it('rejects a fractional anchor, which would put the sprite on a half-pixel', () => {
    expect(() => parse([sheet({ anchorX: 8.5 })])).toThrow(/integer within the cell/);
    expect(() => parse([sheet({ anchorY: 2.25 })])).toThrow(/integer within the cell/);
  });

  it('rejects an anchor outside its own cell', () => {
    expect(() => parse([sheet({ anchorX: 99 })])).toThrow(/within the cell/);
  });
});

describe('poses', () => {
  it('rejects a pose with no cells', () => {
    expect(() => parse([sheet({ poses: { idle: { cells: [] } } })])).toThrow(/at least one cell/);
  });

  it('rejects an empty pose map', () => {
    expect(() => parse([sheet({ poses: {} })])).toThrow(/must not be empty/);
  });

  it('rejects a negative or fractional cell index', () => {
    expect(() => parse([sheet({ poses: { idle: { cells: [-1] } } })])).toThrow(/integer >= 0/);
    expect(() => parse([sheet({ poses: { idle: { cells: [1.5] } } })])).toThrow(/integer >= 0/);
  });

  it('rejects millisecond-shaped hold values', () => {
    // holdTicks is simulation ticks, never milliseconds, so cycling lasts the
    // same wall-clock time at 60 Hz and 120 Hz.
    expect(() => parse([sheet({ poses: { idle: { cells: [0], holdTicks: 0 } } })])).toThrow(
      /positive integer/,
    );
    expect(() => parse([sheet({ poses: { idle: { cells: [0], holdTicks: 16.7 } } })])).toThrow(
      /positive integer/,
    );
  });

  it('keeps holdTicks when given and omits it when not', () => {
    const withHold = parse([sheet({ poses: { idle: { cells: [0, 1], holdTicks: 6 } } })]) as {
      sheets: Array<{ poses: Record<string, { holdTicks?: number }> }>;
    };
    expect(withHold.sheets[0]!.poses['idle']!.holdTicks).toBe(6);
    const without = parse([sheet()]) as {
      sheets: Array<{ poses: Record<string, { holdTicks?: number }> }>;
    };
    expect(without.sheets[0]!.poses['idle']!.holdTicks).toBeUndefined();
  });
});

describe('the skier sheet is held to the pose vocabulary (FR-165)', () => {
  it('names the missing pose rather than failing vaguely', () => {
    expect(() => parse([sheet({ id: 'skier', poses: { carveMid: { cells: [0] } } })])).toThrow(
      /sheet "skier" is missing required pose/,
    );
  });

  it('does not impose the skier vocabulary on other sheets', () => {
    // The manifest exists to make the NEXT sprite cheap. A tree sheet must not
    // have to declare a crouch pose.
    expect(() => parse([sheet({ id: 'tree' })])).not.toThrow();
  });
});
