import { describe, it, expect } from 'vitest';
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

  it('has exactly the eight tokens the style bible declares', () => {
    expect(Object.keys(PALETTE).sort()).toEqual(
      ['blue', 'cyan', 'ink', 'magenta', 'orange', 'purple', 'snow', 'yellow'].sort(),
    );
  });
});
