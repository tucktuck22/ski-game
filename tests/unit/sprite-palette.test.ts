import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { checkSpritePng } from '../../tools/check-sprite-palette.js';
import { parseSprites } from '../../src/data/load.js';
import { PALETTE } from '../../src/render/palette.js';
import spritesJson from '../../data/sprites.json';

/**
 * FR-162 and SC-059: every pixel of every sprite sheet is one of the declared
 * colours or fully transparent, verified automatically rather than by
 * inspection, and a tenth colour fails the build.
 *
 * The guarantee is structural, not statistical (research.md R2). Sheets ship as
 * 8-bit indexed PNG, so a colour outside the table is unrepresentable in the
 * file rather than merely absent from the pixels we happened to look at. That
 * is why this runs in milliseconds with no image decoding and no dependency.
 *
 * This scans the DIRECTORY rather than a list, so the next sprite inherits the
 * gate by existing instead of by somebody remembering to register it.
 */

const SPRITE_DIR = join(__dirname, '../../public/sprites');

const declaredColours = Object.values(PALETTE).map(
  ([r, g, b]) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`,
);

/**
 * Sheets the manifest declares whose art has not been committed yet.
 *
 * This is a STATED GAP, not an escape hatch, and it is written to close itself:
 * the test below fails both when a listed file is missing from the repository
 * for no reason AND when a listed file finally arrives, so nobody can leave an
 * entry here after the art lands. Principle VI requires the difference between
 * what was verified and what ships to be stated rather than implied.
 *
 * Empty, as intended - skier.png landed and the entry was removed, which is
 * exactly what the third test below forces. Leave it empty unless a future
 * sheet is declared before its art exists.
 */
const AWAITING_ART: readonly string[] = [];

const presentPngs = (): string[] =>
  existsSync(SPRITE_DIR) ? readdirSync(SPRITE_DIR).filter((f) => f.endsWith('.png')) : [];

describe('sprite sheets conform to the style-bible palette', () => {
  const files = presentPngs();

  it.runIf(files.length > 0).each(files)('%s uses only declared colours', (file) => {
    const report = checkSpritePng(readFileSync(join(SPRITE_DIR, file)), declaredColours);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('every sheet the manifest declares is either present or a stated gap', () => {
    const declared = parseSprites(spritesJson).sheets.map((s) => s.file);
    const present = new Set(presentPngs());
    const missing = declared.filter((f) => !present.has(f) && !AWAITING_ART.includes(f));
    expect(
      missing,
      `declared in data/sprites.json but not in public/sprites/, and not listed as a ` +
        `stated gap: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('AWAITING_ART names only art that is genuinely still missing', () => {
    // Self-closing. The moment the art is committed this fails and tells the
    // committer to delete the entry, so the gap cannot quietly become permanent.
    const present = new Set(presentPngs());
    const stale = AWAITING_ART.filter((f) => present.has(f));
    expect(
      stale,
      `these files now exist, so remove them from AWAITING_ART in this test and let ` +
        `the palette check apply to them: ${stale.join(', ')}`,
    ).toEqual([]);
  });
});

describe('the checker itself rejects what it is supposed to reject', () => {
  // Principle VI: a failure path that has never been executed is untested
  // however carefully it was written. These build the malformed bytes on
  // purpose rather than trusting the reader that the branches work.

  const chunk = (type: string, data: number[]): number[] => {
    const len = data.length;
    return [
      (len >>> 24) & 255,
      (len >>> 16) & 255,
      (len >>> 8) & 255,
      len & 255,
      ...[...type].map((c) => c.charCodeAt(0)),
      ...data,
      0,
      0,
      0,
      0,
    ];
  };

  const png = (colourType: number, palette: number[][], bitDepth = 8): Uint8Array =>
    new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...chunk('IHDR', [0, 0, 0, 16, 0, 0, 0, 16, bitDepth, colourType, 0, 0, 0]),
      ...(palette.length > 0 ? chunk('PLTE', palette.flat()) : []),
      ...chunk('IEND', []),
    ]);

  const magenta = [0xff, 0x2d, 0x95];

  it('accepts an indexed sheet whose palette is all declared colours', () => {
    expect(checkSpritePng(png(3, [magenta]), declaredColours).ok).toBe(true);
  });

  it('exempts a fully transparent palette entry, and only a fully transparent one', () => {
    // Every sheet needs one slot for the space around the sprite. Its RGB is
    // never composited, so it cannot put an undeclared colour on screen - but an
    // OPAQUE undeclared entry still must fail, which is the pair asserted here.
    const withTrns = (colourType: number, palette: number[][], trns: number[]): Uint8Array =>
      new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        ...chunk('IHDR', [0, 0, 0, 16, 0, 0, 0, 16, 8, colourType, 0, 0, 0]),
        ...chunk('PLTE', palette.flat()),
        ...chunk('tRNS', trns),
        ...chunk('IEND', []),
      ]);
    const opaqueBad = withTrns(3, [magenta, [0, 0, 0]], [255, 255]);
    expect(checkSpritePng(opaqueBad, declaredColours).ok).toBe(false);
    const transparentSlot = withTrns(3, [magenta, [0, 0, 0]], [255, 0]);
    expect(checkSpritePng(transparentSlot, declaredColours).errors).toEqual([]);
  });

  it('rejects a colour outside the declared set, and names it', () => {
    const report = checkSpritePng(png(3, [magenta, [0x12, 0x34, 0x56]]), declaredColours);
    expect(report.ok).toBe(false);
    expect(report.errors.join(' ')).toMatch(/#123456/);
  });

  it('rejects a truecolour PNG rather than passing vacuously', () => {
    // The failure mode the whole approach exists to rule out: re-export as
    // RGBA, the file has no PLTE at all, and a checker looking only at palette
    // entries would find nothing wrong with an image full of arbitrary colour.
    const report = checkSpritePng(png(6, []), declaredColours);
    expect(report.ok).toBe(false);
    expect(report.errors.join(' ')).toMatch(/colour type is 6, must be 3/);
  });

  it('rejects an indexed PNG with no palette', () => {
    expect(checkSpritePng(png(3, []), declaredColours).errors.join(' ')).toMatch(/no PLTE/);
  });

  it('rejects something that is not a PNG', () => {
    expect(checkSpritePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), declaredColours).ok).toBe(
      false,
    );
  });
});

describe('the shipped sheet is reproducible from its retained source', () => {
  /**
   * Principle VII: anything a human is told to run is part of the product and
   * carries the same burden of proof as code — executed verbatim in CI, with CI
   * asserting on the OUTPUT rather than on the exit status.
   *
   * `tools/build-sprite-sheet.mjs` is that instruction. This runs it for real
   * and compares bytes, which proves three things at once: the retained source
   * is complete enough to rebuild from (the constitution's asset-management
   * clause), the tool is deterministic, and the committed sheet is actually what
   * the tool produces rather than something hand-edited afterwards and drifted.
   */
  it('rebuilding from assets/sprites/skier.source.png reproduces it byte for byte', () => {
    const shipped = join(SPRITE_DIR, 'skier.png');
    if (!existsSync(shipped)) return; // covered by the stated-gap tests above
    const scratch = join(tmpdir(), `skier-rebuild-${process.pid}.png`);
    execFileSync(
      process.execPath,
      [join(__dirname, '../../tools/build-sprite-sheet.mjs'), '--out', scratch],
      { stdio: 'pipe' },
    );
    try {
      expect(
        readFileSync(scratch).equals(readFileSync(shipped)),
        'public/sprites/skier.png is not what tools/build-sprite-sheet.mjs produces — ' +
          'either the source changed without a rebuild, or the sheet was edited by hand',
      ).toBe(true);
    } finally {
      rmSync(scratch, { force: true });
    }
  });
});
