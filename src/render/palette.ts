/**
 * The nine colours of assets/style-bible.md section 1. Nothing outside this set
 * appears in any asset (rule P-1..P-6).
 *
 * This file is in src/render, not src/sim: colour never touches the simulation.
 */
export type Rgb = readonly [number, number, number];

export const PALETTE = {
  ink: [0x0b, 0x06, 0x16],
  purple: [0x2b, 0x10, 0x55],
  magenta: [0xff, 0x2d, 0x95],
  cyan: [0x22, 0xe8, 0xf5],
  blue: [0x43, 0x61, 0xff],
  orange: [0xfc, 0x60, 0x08],
  yellow: [0xff, 0xd2, 0x3f],
  snow: [0xf2, 0xf0, 0xff],
  /**
   * Skin. The ninth colour, and the only one added since ratification.
   *
   * Feature 004's Q1: the supplied skier art carries a skin tone that was not
   * among the eight, and the maintainer chose to admit exactly one token rather
   * than quantise the face away or open the palette to a shading ramp. A ramp
   * would have been a rule about how many tones is too many, which nobody can
   * enforce at review; a ninth named colour either appears in a file or does
   * not, so `tests/unit/palette.test.ts` can keep asserting the set exhaustively.
   *
   * The value is SAMPLED from the supplied sheet rather than invented (FR-179) -
   * the mean of its warm face pixels. See docs/adr/0010-a-ninth-colour.md.
   *
   * Rule P-6 confines it to player sprites: never a ground, never text, never a
   * terrain edge, never a hazard.
   */
  skin: [0xec, 0xb2, 0x91],
} as const satisfies Record<string, Rgb>;

export type PaletteToken = keyof typeof PALETTE;

/** Pairings rule P-2 permits for text. Anything else is a style-review rejection. */
export const TEXT_PAIRINGS: ReadonlyArray<readonly [PaletteToken, PaletteToken]> = [
  ['snow', 'ink'],
  ['snow', 'purple'],
  ['yellow', 'ink'],
  ['yellow', 'purple'],
  ['cyan', 'ink'],
];

const srgbToLinear = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG 2.1 contrast ratio. Used to enforce rule P-2 in CI. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Brettel/Viénot-style CVD approximation in linear RGB. Good enough to catch a
 * palette that collapses two roles into one perceived colour, which is all we
 * ask of it — rule P-5 requires a shape difference regardless, so this is a
 * second line of defence rather than the only one.
 */
export function simulateCvd(rgb: Rgb, kind: 'protanopia' | 'deuteranopia' | 'tritanopia'): Rgb {
  const [r, g, b] = rgb.map(srgbToLinear) as [number, number, number];
  let out: [number, number, number];
  switch (kind) {
    case 'protanopia':
      out = [0.567 * r + 0.433 * g, 0.558 * r + 0.442 * g, 0.242 * g + 0.758 * b];
      break;
    case 'deuteranopia':
      out = [0.625 * r + 0.375 * g, 0.7 * r + 0.3 * g, 0.3 * g + 0.7 * b];
      break;
    case 'tritanopia':
      out = [0.95 * r + 0.05 * g, 0.433 * g + 0.567 * b, 0.475 * g + 0.525 * b];
      break;
  }
  const linearToSrgb = (c: number): number => {
    const clamped = c < 0 ? 0 : c > 1 ? 1 : c;
    const s = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(s * 255);
  };
  return [linearToSrgb(out[0]), linearToSrgb(out[1]), linearToSrgb(out[2])];
}

/** Pixi wants 0xRRGGBB. */
export const hex = (t: PaletteToken): number =>
  (PALETTE[t][0] << 16) | (PALETTE[t][1] << 8) | PALETTE[t][2];
