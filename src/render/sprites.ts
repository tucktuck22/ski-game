/**
 * Sprite sheets: loading, readiness, and the blit (FR-159, FR-173, FR-178).
 *
 * This module is GENERIC on purpose. It knows about sheets, cells, base paths
 * and failure; it knows nothing about skiers, poses or run state. That seam is
 * what makes the next sprite a manifest entry plus a PNG rather than a second
 * copy of this work - see research.md R3, and note that this repository has
 * already paid once for the alternative.
 *
 * Two rules here are not stylistic:
 *
 * 1. The base path is applied HERE and nowhere else. A manifest carrying
 *    `/sprites/x.png` works in dev and 404s under the production base path,
 *    which is the defect class that reached players in this project's first
 *    deployment week. `parseSprites()` rejects any `file` containing a slash so
 *    this stays one decision in one place, exactly as trackUrl() does for music.
 *
 * 2. Nothing here scales, smooths or rotates. `stage.ts` already holds
 *    `imageSmoothingEnabled = false` on the 320x180 buffer, destinations are
 *    rounded to integers, and the source rect is the cell's exact pixels. That
 *    is FR-178, and FR-169's prohibition on continuous rotation while skiing is
 *    what makes it reachable: a grounded skier is a `drawImage` with no
 *    `ctx.rotate`, so there is no resampling step to get wrong.
 */
import type { SpriteManifest, SpriteSheet } from '../data/load.js';

/** Why a sheet is not drawable. `pending` is the only non-terminal one. */
type SheetStatus = 'pending' | 'ready' | 'failed';

interface LoadedSheet {
  readonly def: SpriteSheet;
  status: SheetStatus;
  image: CanvasImageSource | null;
  /** Total addressable cells, known only once the image's real size is. */
  cells: number;
}

/** Applied in exactly one place. See rule 1 in the module comment. */
export const sheetUrl = (base: string, sheet: SpriteSheet): string =>
  `${base}sprites/${sheet.file}`;

export class SpriteSheets {
  private readonly sheets = new Map<string, LoadedSheet>();
  private readonly base: string;

  constructor(manifest: SpriteManifest, base: string) {
    this.base = base;
    for (const def of manifest.sheets) {
      this.sheets.set(def.id, { def, status: 'pending', image: null, cells: 0 });
    }
  }

  /**
   * Begins loading every declared sheet.
   *
   * Deliberately returns nothing and awaits nothing. A run must never wait on
   * decoration (FR-172) and the caller must never be tempted to block the first
   * frame on it; until a sheet resolves, `ready()` is false and the caller draws
   * its own fallback.
   */
  load(): void {
    for (const sheet of this.sheets.values()) {
      if (sheet.status !== 'pending' || sheet.image !== null) continue;
      // Guarded so this module can be imported in a Node test environment,
      // where there is no Image and no document, without exploding on import.
      if (typeof Image === 'undefined') {
        sheet.status = 'failed';
        continue;
      }
      const img = new Image();
      img.onload = (): void => this.accept(sheet, img);
      // Any failure at all - 404, wrong base path, decode error, blocked
      // request - lands here and is terminal for this sheet. It is not an
      // exception and it must not become one: the run carries on without it.
      img.onerror = (): void => {
        sheet.status = 'failed';
      };
      img.src = sheetUrl(this.base, sheet.def);
    }
  }

  /**
   * Accepts a decoded image, but only if the manifest's cell indices actually
   * fit inside it.
   *
   * The manifest cannot validate this at parse time - it does not know the
   * image's height - so it is checked here, once, against the real dimensions.
   * A pose pointing past the end of the sheet fails the whole sheet to the
   * fallback rather than blitting whatever happens to be at those coordinates,
   * which would be garbage drawn confidently.
   */
  private accept(sheet: LoadedSheet, img: HTMLImageElement): void {
    const { cellWidth, cellHeight, columns } = sheet.def;
    const rows = Math.floor(img.naturalHeight / cellHeight);
    const perRow = Math.min(columns, Math.floor(img.naturalWidth / cellWidth));
    const cells = rows * perRow;
    for (const pose of Object.values(sheet.def.poses)) {
      for (const cell of pose.cells) {
        if (cell >= cells) {
          sheet.status = 'failed';
          return;
        }
      }
    }
    sheet.image = img;
    sheet.cells = cells;
    sheet.status = 'ready';
  }

  /** True when this sheet can be drawn from. False while loading or after failure. */
  ready(id: string): boolean {
    return this.sheets.get(id)?.status === 'ready';
  }

  /** Exposed for the build-time e2e specs, which assert the failure path is reached. */
  status(id: string): SheetStatus | 'unknown' {
    return this.sheets.get(id)?.status ?? 'unknown';
  }

  /**
   * Blits one cell of a pose, with (x, y) as the sheet's declared anchor.
   *
   * `tick` selects within a multi-cell pose using the pose's own `holdTicks`.
   * Ticks, never milliseconds: any cycling therefore lasts the same wall-clock
   * time at 60 Hz and 120 Hz.
   *
   * Returns false when nothing was drawn, so the caller can fall back rather
   * than leaving a hole where the player should be.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    id: string,
    pose: string,
    tick: number,
    x: number,
    y: number,
  ): boolean {
    const sheet = this.sheets.get(id);
    if (sheet === undefined || sheet.status !== 'ready' || sheet.image === null) return false;

    const entry = sheet.def.poses[pose];
    if (entry === undefined || entry.cells.length === 0) return false;

    const { cellWidth, cellHeight, columns, anchorX, anchorY } = sheet.def;
    const frame =
      entry.cells.length === 1 ? 0 : Math.floor(tick / (entry.holdTicks ?? 1)) % entry.cells.length;
    const cell = entry.cells[frame] as number;
    const sx = (cell % columns) * cellWidth;
    const sy = Math.floor(cell / columns) * cellHeight;

    // Integer destination. A half-pixel destination resamples even with
    // smoothing disabled, which is the LW-1 breakage FR-178 exists to prevent.
    ctx.drawImage(
      sheet.image,
      sx,
      sy,
      cellWidth,
      cellHeight,
      Math.round(x) - anchorX,
      Math.round(y) - anchorY,
      cellWidth,
      cellHeight,
    );
    return true;
  }
}
