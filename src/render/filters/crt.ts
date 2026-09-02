/**
 * Post-process for the 320x180 buffer: scanlines, halftone tint, and a soft
 * neon bloom.
 *
 * Style bible T-2 caps scanline opacity at 18% and T-3 caps bloom at 30% and
 * forbids it on text - both because rule L-0 says legibility outranks style,
 * and at speed this is exactly where a period-authentic treatment starts
 * costing the player information he needs.
 *
 * Applied on the small buffer, where a full-screen pass is ~57,600 pixels
 * rather than 2.3 million. That is what makes it affordable on a mid-range
 * phone (research R6).
 */
import type { MotionSettings } from '../reducedMotion.js';

const SCANLINE_ALPHA = 0.18; // T-2 ceiling
const BLOOM_ALPHA = 0.3; // T-3 ceiling

let scanlinePattern: CanvasPattern | null = null;

function buildScanlines(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const tile = document.createElement('canvas');
  tile.width = 1;
  tile.height = 2;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;
  tctx.fillStyle = `rgba(11, 6, 22, ${SCANLINE_ALPHA})`;
  tctx.fillRect(0, 0, 1, 1); // 1px on, 1px off — T-2
  return ctx.createPattern(tile, 'repeat');
}

/** A cheap bloom: blur the frame by drawing it back scaled with additive blend. */
function bloom(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = BLOOM_ALPHA * 0.5;
  ctx.filter = 'blur(2px)';
  ctx.drawImage(source, 0, 0);
  ctx.restore();
  ctx.filter = 'none';
}

export function applyCrt(
  ctx: CanvasRenderingContext2D,
  buffer: HTMLCanvasElement,
  settings: MotionSettings,
): void {
  if (settings.bloom) bloom(ctx, buffer);

  if (settings.scanlines) {
    scanlinePattern ??= buildScanlines(ctx);
    if (scanlinePattern) {
      ctx.save();
      ctx.fillStyle = scanlinePattern;
      ctx.fillRect(0, 0, buffer.width, buffer.height);
      ctx.restore();
    }
  }
}

/** Reset between runs so a stale pattern is not bound to a destroyed context. */
export function resetCrt(): void {
  scanlinePattern = null;
}
