/**
 * Reduced motion (FR-056) and the flash limit (FR-057).
 *
 * The constitution's accessibility clause and style-bible rule T-5 both require
 * that disabling these leaves the run FULLY PLAYABLE AND SCOREABLE. That is the
 * part most easily got wrong: an effects toggle that also changed timing would
 * mean two different games, and the leaderboard decides where people sleep.
 * Nothing here touches the simulation.
 */

export interface MotionSettings {
  scanlines: boolean;
  bloom: boolean;
  shake: boolean;
  parallax: boolean;
  flashes: boolean;
}

export const FULL_MOTION: MotionSettings = {
  scanlines: true,
  bloom: true,
  shake: true,
  parallax: true,
  flashes: true,
};

export const REDUCED_MOTION: MotionSettings = {
  scanlines: false,
  bloom: false,
  shake: false,
  parallax: false,
  flashes: false,
};

const KEY = 'shredpocalypse-reduced-motion';

/** Honours the OS setting by default, and remembers an explicit override. */
export function resolveMotion(): MotionSettings {
  let explicit: string | null = null;
  try {
    explicit = localStorage.getItem(KEY);
  } catch {
    /* private window: fall through to the OS preference */
  }
  if (explicit === 'reduced') return REDUCED_MOTION;
  if (explicit === 'full') return FULL_MOTION;
  const prefersReduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return prefersReduced ? REDUCED_MOTION : FULL_MOTION;
}

export function setMotion(reduced: boolean): void {
  try {
    localStorage.setItem(KEY, reduced ? 'reduced' : 'full');
  } catch {
    /* non-fatal: the setting simply does not persist */
  }
}

/**
 * FR-057: no effect may flash more than three times per second across a large
 * portion of the screen. Enforced as a minimum interval rather than left to
 * whoever writes the next effect.
 */
export const MIN_FLASH_INTERVAL_MS = 1000 / 3;

export class FlashLimiter {
  private lastFlashAt = -Infinity;

  /** Returns true if a full-screen flash is permitted right now. */
  allow(nowMs: number, settings: MotionSettings): boolean {
    if (!settings.flashes) return false;
    if (nowMs - this.lastFlashAt < MIN_FLASH_INTERVAL_MS) return false;
    this.lastFlashAt = nowMs;
    return true;
  }
}
