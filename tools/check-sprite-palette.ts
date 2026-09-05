/**
 * Asserts a sprite sheet cannot contain a colour outside the style bible
 * (FR-162, SC-059).
 *
 * The trick, and the whole reason this file is forty lines instead of two
 * hundred, is research.md R2: sheets ship as 8-bit INDEXED PNG. Indexed colour
 * stores the image as indices into an embedded palette table, so a tenth colour
 * is not merely absent from the pixels - it is unrepresentable in the file.
 * Checking the palette therefore means reading a table of at most 256 entries
 * rather than inflating and unfiltering every scanline, which is why this needs
 * no zlib, no dependency, and no pixel walk.
 *
 * `assertColourType3` is not a formality. If somebody re-exports as RGBA one
 * day, the file has no PLTE chunk at all, and a checker that only looked for
 * PLTE entries could pass vacuously on an image full of arbitrary colour. That
 * is the failure mode this whole approach exists to rule out, so it fails loud.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface SpritePngReport {
  ok: boolean;
  errors: string[];
  /** Palette entries as `#rrggbb`, in index order. Empty when the file is unreadable. */
  palette: string[];
  colourType: number;
  bitDepth: number;
}

const hex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

/**
 * Reads the chunk stream far enough to answer the question, and no further.
 *
 * PNG layout: an 8-byte signature, then chunks of `length(4) type(4) data(length)
 * crc(4)`. IHDR is always first; PLTE and tRNS both precede IDAT. We stop at
 * IDAT because everything we need has been seen by then.
 */
export function checkSpritePng(buf: Uint8Array, allowed: readonly string[]): SpritePngReport {
  const errors: string[] = [];
  const report = (msg: string): void => void errors.push(msg);

  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) {
      return { ok: false, errors: ['not a PNG file'], palette: [], colourType: -1, bitDepth: -1 };
    }
  }

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 8;
  let colourType = -1;
  let bitDepth = -1;
  let palette: string[] = [];
  let transparency: number[] | null = null;
  let sawIhdr = false;

  while (offset + 8 <= buf.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      buf[offset + 4]!,
      buf[offset + 5]!,
      buf[offset + 6]!,
      buf[offset + 7]!,
    );
    const data = offset + 8;
    if (data + length > buf.byteLength) {
      report(`chunk "${type}" runs past the end of the file`);
      break;
    }

    if (type === 'IHDR') {
      sawIhdr = true;
      bitDepth = buf[data + 8] as number;
      colourType = buf[data + 9] as number;
      if (buf[data + 12] !== 0) report('interlaced PNGs are not accepted');
    } else if (type === 'PLTE') {
      if (length % 3 !== 0) report('PLTE length is not a multiple of 3');
      palette = [];
      for (let p = 0; p + 2 < length; p += 3) {
        palette.push(
          hex(buf[data + p] as number, buf[data + p + 1] as number, buf[data + p + 2] as number),
        );
      }
    } else if (type === 'tRNS') {
      transparency = Array.from(buf.subarray(data, data + length));
    } else if (type === 'IDAT' || type === 'IEND') {
      break;
    }

    offset = data + length + 4;
  }

  if (!sawIhdr) report('no IHDR chunk');

  // The structural guarantee. Everything below only means anything if this holds.
  if (colourType !== 3)
    report(
      `colour type is ${colourType}, must be 3 (8-bit indexed). Indexed colour is what ` +
        'makes a tenth colour unrepresentable rather than merely absent (research R2)',
    );
  if (bitDepth > 8) report(`bit depth is ${bitDepth}, must be 8 or less`);
  if (colourType === 3 && palette.length === 0) report('indexed PNG with no PLTE chunk');

  const allowedSet = new Set(allowed.map((c) => c.toLowerCase()));
  palette.forEach((entry, i) => {
    // A fully transparent entry is exempt, and only a fully transparent one.
    // Its RGB is never composited, so it cannot put an undeclared colour on
    // screen - and every sheet needs one such slot for the space around the
    // sprite. Checking tRNS rather than assuming a position keeps this true
    // however a future sheet orders its table.
    if (transparency !== null && transparency[i] === 0) return;
    if (!allowedSet.has(entry)) {
      report(
        `palette entry ${i} is ${entry}, which is not one of the ${allowed.length} declared colours`,
      );
    }
  });

  // A partially transparent index would put a colour on screen that is in the
  // table but not the colour the table says, which defeats the point.
  if (transparency !== null) {
    transparency.forEach((alpha, i) => {
      if (alpha !== 0 && alpha !== 255) {
        report(
          `tRNS entry ${i} has alpha ${alpha}; only fully transparent or fully opaque is accepted`,
        );
      }
    });
  }

  return { ok: errors.length === 0, errors, palette, colourType, bitDepth };
}
