/**
 * The picture and the collision must not disagree (FR-200, style bible TR-2).
 *
 * TR-2's contract is one sentence — "the shape the player sees IS the shape he
 * has to get under" — and it is the only clause in this feature whose violation
 * is invisible in review and fatal in play. A rope drawn one pixel below its
 * collision floor teaches the player a duck he does not need; one drawn above it
 * kills him for a gap he could see. Neither shows up in a screenshot.
 *
 * So this asserts the geometry directly rather than trusting the drawing code to
 * have been careful: every mark the routine emits is captured through a
 * recording context, and the extremes are compared against the slab the
 * simulation computes in `step.ts`.
 *
 * The clearances swept are the whole legal range CV-3 permits — strictly between
 * `crouchHeight` 9 and `standHeight` 16 — plus the two values actually authored
 * in the shipped courses.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { drawBoundaryRope } from '../../src/render/draw.js';
import { PALETTE, type PaletteToken } from '../../src/render/palette.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const THICKNESS = 18; // tuning.branchThickness, frozen by FR-196

/** One point the routine actually put ink on, and the colour it used. */
interface Mark {
  x: number;
  y: number;
}

interface Marks {
  points: Mark[];
  colours: string[];
}

/**
 * A context that records instead of rasterising.
 *
 * The one subtlety worth stating: a STROKE is centred on its path and reaches
 * half a pen either side of it, while a FILL stops at the path. Measuring both
 * the same way under-reports a stroked silhouette by exactly the amount that
 * makes a rope look like it clears the slab when it does not — so the path is
 * accumulated and only expanded by the pen when `stroke()` is the call that
 * ends it.
 *
 * Only the operations `drawBoundaryRope` uses are implemented. Anything it
 * starts using later is absent rather than silently ignored, because a stub
 * that absorbs unknown calls lets a mark escape the assertion, which is the one
 * failure mode this test cannot afford.
 */
function recorder(): { ctx: CanvasRenderingContext2D; marks: Marks } {
  const marks: Marks = { points: [], colours: [] };
  let path: Mark[] = [];
  let lineWidth = 1;
  const ctx = {
    set lineWidth(v: number) {
      lineWidth = v;
    },
    get lineWidth() {
      return lineWidth;
    },
    lineCap: 'butt',
    set fillStyle(v: string) {
      marks.colours.push(v);
    },
    set strokeStyle(v: string) {
      marks.colours.push(v);
    },
    beginPath: () => {
      path = [];
    },
    closePath: () => {},
    moveTo: (x: number, y: number) => path.push({ x, y }),
    lineTo: (x: number, y: number) => path.push({ x, y }),
    stroke: () => {
      const half = lineWidth / 2;
      for (const p of path) marks.points.push({ x: p.x, y: p.y - half }, { x: p.x, y: p.y + half });
    },
    fill: () => {
      for (const p of path) marks.points.push({ x: p.x, y: p.y });
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      marks.points.push({ x, y }, { x: x + w, y }, { x, y: y + h }, { x: x + w, y: y + h });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, marks };
}

const CLEARANCES = [9.5, 10, 11, 12, 13, 14, 15, 15.5];
const WIDTHS = [24, 32, 40, 56, 80];

describe('the boundary rope fits its collision slab exactly (FR-200)', () => {
  for (const clearance of CLEARANCES) {
    for (const width of WIDTHS) {
      it(`clearance ${clearance}, width ${width}: lowest mark is the collision floor`, () => {
        // The slab exactly as src/sim/step.ts builds it.
        const ground = 120;
        const bottom = ground - clearance;
        const top = bottom - THICKNESS;

        const { ctx, marks } = recorder();
        drawBoundaryRope(ctx, 40, width, bottom, THICKNESS);

        expect(marks.points.length, 'the rope drew nothing').toBeGreaterThan(0);
        const lowest = Math.max(...marks.points.map((p) => p.y));
        const highest = Math.min(...marks.points.map((p) => p.y));

        // Clause 1: the lowest mark IS the collision floor. Not "near", not
        // "within a pixel" — the player judges his duck against this line.
        expect(lowest, 'lowest drawn mark must equal the collision floor').toBeCloseTo(bottom, 6);

        // Clause 2: nothing escapes the slab in either direction.
        expect(highest, 'a mark rose above the slab ceiling').toBeGreaterThanOrEqual(top - 1e-6);
        expect(lowest, 'a mark fell below the slab floor').toBeLessThanOrEqual(bottom + 1e-6);
      });

      it(`clearance ${clearance}, width ${width}: the killing edge is flat across the full span`, () => {
        const bottom = 120 - clearance;
        const { ctx, marks } = recorder();
        drawBoundaryRope(ctx, 40, width, bottom, THICKNESS);

        // The orange edge spans [x, x + width] at exactly `bottom`, so the
        // lowest mark is the same height at both ends of the object. A sag that
        // reached the tips would break this and nothing else would notice.
        const atFloor = marks.points.filter((p) => Math.abs(p.y - bottom) < 1e-6).map((p) => p.x);
        expect(atFloor.length, 'nothing was drawn at the collision floor').toBeGreaterThan(0);
        expect(Math.min(...atFloor), 'the killing edge does not start at the object').toBeCloseTo(
          40,
          6,
        );
        expect(Math.max(...atFloor), 'the killing edge does not reach the far end').toBeCloseTo(
          40 + width,
          6,
        );
      });
    }
  }

  it('uses only tokens from the style bible palette (FR-202)', () => {
    const { ctx, marks } = recorder();
    drawBoundaryRope(ctx, 40, 40, 106, THICKNESS);

    const legal = new Set(
      (Object.keys(PALETTE) as PaletteToken[]).map((t) => {
        const [r, g, b] = PALETTE[t];
        return `rgb(${r},${g},${b})`;
      }),
    );
    expect(marks.colours.length).toBeGreaterThan(0);
    for (const c of marks.colours) {
      expect(legal.has(c), `${c} is not a style bible palette token`).toBe(true);
    }
  });

  it('marks the killing surface in orange, and does not fill the silhouette with it (FR-203, TR-3)', () => {
    const { ctx, marks } = recorder();
    drawBoundaryRope(ctx, 40, 40, 106, THICKNESS);
    const [r, g, b] = PALETTE.orange;
    const orange = `rgb(${r},${g},${b})`;

    expect(marks.colours, 'no orange edge on the killing surface').toContain(orange);
    // One orange operation, not a wash: TR-3's rule is an edge on the surface
    // that kills, never a fill over the whole object.
    expect(
      marks.colours.filter((c) => c === orange).length,
      'orange is being used as a fill rather than as an edge',
    ).toBe(1);
  });

  it('carries the player colours the pines never use (FR-201)', () => {
    const { ctx, marks } = recorder();
    drawBoundaryRope(ctx, 40, 40, 106, THICKNESS);
    const token = (t: PaletteToken): string => {
      const [r, g, b] = PALETTE[t];
      return `rgb(${r},${g},${b})`;
    };
    // Vocabulary and geometry are argued in the contract; palette is the one
    // separation that can be asserted, so it is.
    expect(marks.colours).toContain(token('magenta'));
    expect(marks.colours).toContain(token('cyan'));
    expect(marks.colours).toContain(token('purple'));
  });

  it('is a cord with teeth, not a solid bar — the shape the pines never make', () => {
    const { ctx, marks } = recorder();
    drawBoundaryRope(ctx, 40, 80, 106, THICKNESS);
    const bottom = 106;
    const top = bottom - THICKNESS;
    // Several distinct pennant tips reach the floor, so the silhouette is
    // toothed rather than a slab. A single-rectangle "rope" would pass every
    // clause above and read as a girder.
    const tips = new Set(
      marks.points.filter((p) => Math.abs(p.y - bottom) < 1e-6).map((p) => Math.round(p.x)),
    );
    expect(tips.size, 'the rope has no teeth').toBeGreaterThan(3);
    expect(top).toBeLessThan(bottom);
  });
});

/**
 * FR-198: the bough is replaced entirely, and no course may show both idioms.
 *
 * Quickstart §8 asks for this as `grep -rn "bough" assets/style-bible.md src/`,
 * run by a human. Principle VII says an instruction a human runs is a
 * deliverable, and a grep nobody remembers to type is not one — so it is a test.
 * Two idioms for one obstacle is the failure it guards: a half-finished re-skin
 * that draws a rope on the warm-up course and a bough on the official one would
 * pass every geometric clause above.
 */
describe('the bough is gone, not merely unused (FR-198)', () => {
  const roots = ['src', 'assets/style-bible.md'];

  it('no source file or the style bible still mentions a bough', () => {
    const hits: string[] = [];
    const scan = (path: string): void => {
      const stat = statSync(path);
      if (stat.isDirectory()) {
        for (const entry of readdirSync(path)) scan(join(path, entry));
        return;
      }
      if (!/\.(ts|css|md|html)$/.test(path)) return;
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          // Word-boundary, so "bought" in a neighbouring comment is not a hit.
          if (/\bboughs?\b/i.test(line)) hits.push(`${path}:${i + 1}: ${line.trim()}`);
        });
    };
    for (const r of roots) scan(join(root, r));
    expect(hits, `a bough survives the re-skin:\n${hits.join('\n')}`).toEqual([]);
  });
});
