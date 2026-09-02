/**
 * The fixed 320x180 internal buffer.
 *
 * research R6: this serves the 1986 look, the phone frame budget, and SC-006 at
 * once. The parity argument is the least obvious and the most important - a
 * fixed buffer means every device sees the SAME AMOUNT OF COURSE AHEAD. Since
 * FR-088 makes release timing the core skill, extra lookahead would be extra
 * reaction time, and a viewport-scaled renderer would have made phone-versus-
 * desktop parity a permanent tuning problem instead of a property of the code.
 */
export const INTERNAL_WIDTH = 320;
export const INTERNAL_HEIGHT = 180;

export interface Stage {
  /** Draw here. Always 320x180, whatever the display is. */
  ctx: CanvasRenderingContext2D;
  buffer: HTMLCanvasElement;
  /** Blits the buffer to the display with integer nearest-neighbour scaling. */
  present(): void;
  destroy(): void;
}

/** Applied to the buffer after drawing and before presenting. */
export type PostProcess = (ctx: CanvasRenderingContext2D, buffer: HTMLCanvasElement) => void;

export function createStage(display: HTMLCanvasElement, post?: PostProcess): Stage {
  const buffer = document.createElement('canvas');
  buffer.width = INTERNAL_WIDTH;
  buffer.height = INTERNAL_HEIGHT;
  const ctx = buffer.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2d context unavailable');
  ctx.imageSmoothingEnabled = false;

  const out = display.getContext('2d', { alpha: false });
  if (!out) throw new Error('2d context unavailable');

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const availW = display.clientWidth * dpr;
    const availH = display.clientHeight * dpr;
    // Integer scale only: a fractional scale reintroduces the blurring the
    // whole fixed-buffer approach exists to avoid (style bible LW-1).
    const scale = Math.max(1, Math.floor(Math.min(availW / INTERNAL_WIDTH, availH / INTERNAL_HEIGHT)));
    display.width = INTERNAL_WIDTH * scale;
    display.height = INTERNAL_HEIGHT * scale;
    out.imageSmoothingEnabled = false;
  };

  resize();
  window.addEventListener('resize', resize);

  return {
    ctx,
    buffer,
    present() {
      // Post-processing runs on the 320x180 buffer, never on the upscaled
      // output: a full-screen pass here is ~57,600 pixels instead of millions.
      if (post) post(ctx, buffer);
      out.imageSmoothingEnabled = false;
      out.drawImage(buffer, 0, 0, display.width, display.height);
    },
    destroy() {
      window.removeEventListener('resize', resize);
    },
  };
}
