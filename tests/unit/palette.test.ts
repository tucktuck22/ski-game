import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PALETTE, TEXT_PAIRINGS, contrastRatio, simulateCvd } from '../../src/render/palette.js';

// Style bible rules P-2 and P-5, and FR-055/FR-060.
describe('palette (style bible section 1)', () => {
  it('P-2: every permitted text pairing meets WCAG AA for normal text', () => {
    for (const [fg, bg] of TEXT_PAIRINGS) {
      const ratio = contrastRatio(PALETTE[fg], PALETTE[bg]);
      expect(ratio, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('P-4/P-5: player magenta and hazard orange stay distinguishable under all three CVD types', () => {
    // P-5 makes this redundant by requiring a shape difference too, but a palette
    // that fails here would push the whole burden onto shape, which is fragile.
    for (const kind of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
      const a = simulateCvd(PALETTE.magenta, kind);
      const b = simulateCvd(PALETTE.orange, kind);
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      expect(distance, `magenta vs orange under ${kind}`).toBeGreaterThan(40);
    }
  });

  it('P-4/P-6: the skin token stays distinguishable from hazard orange under all three CVD types', () => {
    // FR-182. Skin sits on the player, and orange means hazard. A skin tone that
    // collapsed into orange would reintroduce by the back door exactly the
    // confusion P-4 exists to prevent - so it is held to the same threshold as
    // the magenta/orange pair, which it clears by a wide margin.
    for (const kind of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
      const a = simulateCvd(PALETTE.skin, kind);
      const b = simulateCvd(PALETTE.orange, kind);
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      expect(distance, `skin vs orange under ${kind}`).toBeGreaterThan(40);
    }
  });

  it('has exactly the nine tokens the style bible declares', () => {
    // Exhaustive on purpose, and TIGHTENED rather than loosened when the palette
    // went from eight to nine (feature 004, ADR-0010). This assertion is what
    // makes "nothing outside this set" a fact rather than an intention, and it
    // is the reason a ninth NAMED colour was chosen over a shading ramp.
    expect(Object.keys(PALETTE).sort()).toEqual(
      ['blue', 'cyan', 'ink', 'magenta', 'orange', 'purple', 'skin', 'snow', 'yellow'].sort(),
    );
  });
});

describe('the ink scrim token cannot drift from the ink it is made of', () => {
  // --ink-rgb exists so the title screen can build a partial scrim from the ink
  // colour. Two spellings of one colour is exactly the kind of thing that drifts
  // silently: a redefined --ink with a stale --ink-rgb would tint every scrim on
  // the title card and nothing would fail.
  it('--ink-rgb is the same colour as --ink', () => {
    const css = readFileSync(join(__dirname, '../../src/ui/style.css'), 'utf8');
    const ink = /--ink:\s*#([0-9a-f]{6})/i.exec(css)?.[1];
    const rgb = /--ink-rgb:\s*(\d+)\s+(\d+)\s+(\d+)/.exec(css);
    expect(ink, '--ink not found in style.css').toBeDefined();
    expect(rgb, '--ink-rgb not found in style.css').not.toBeNull();
    const asHex = [1, 2, 3]
      .map((i) =>
        Number((rgb as RegExpExecArray)[i])
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
    expect(asHex).toBe((ink as string).toLowerCase());
  });
});
