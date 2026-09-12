/** Keyboard input. Fully remappable (FR-030). */
import type { RunInput } from '../sim/types.js';
import type { InputSource } from './sample.js';

export interface KeyBindings {
  crouch: string[];
  rotateLeft: string[];
  rotateRight: string[];
}

export const DEFAULT_BINDINGS: KeyBindings = {
  crouch: ['Space', 'ArrowDown', 'KeyS'],
  rotateLeft: ['ArrowLeft', 'KeyA'],
  rotateRight: ['ArrowRight', 'KeyD'],
};

import { safeLocal } from '../state/safeStorage.js';

const STORAGE_KEY = 'shredpocalypse-bindings';

/** Bindings are a per-device convenience, never run state (FR-021). */
export function loadBindings(): KeyBindings {
  const raw = safeLocal.get(STORAGE_KEY);
  if (raw === null) return DEFAULT_BINDINGS;
  try {
    return { ...DEFAULT_BINDINGS, ...(JSON.parse(raw) as Partial<KeyBindings>) };
  } catch {
    // Corrupt JSON is not the same failure as denied storage; defaults either way.
    return DEFAULT_BINDINGS;
  }
}

/*
 * `saveBindings` was here and is gone (feature 005, FR-206).
 *
 * It was written for feature 001's FR-030 — "keyboard controls MUST be fully
 * remappable" — and nothing ever called it, so no player could ever rebind
 * anything. FR-030 is struck; the function goes with it rather than staying as
 * machinery that implies a feature which does not exist. That is the precedent
 * FR-065 set when the abandonment counter was removed, and the lesson this
 * repository already paid for once: `abandoned_official_runs` was kept "just in
 * case" and then read by a leaderboard column that showed a permanent zero for
 * the life of the deployment.
 *
 * `loadBindings` stays because it is called, and because it is what keeps the
 * defaults in one place.
 */

export function keyboardSource(bindings: KeyBindings = loadBindings()): InputSource {
  const held = new Set<string>();
  const down = (e: KeyboardEvent): void => {
    held.add(e.code);
    // Space and arrows scroll the page otherwise, which is fatal mid-run.
    if (Object.values(bindings).flat().includes(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent): void => {
    held.delete(e.code);
  };
  const blur = (): void => held.clear();

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);

  const any = (codes: string[]): boolean => codes.some((c) => held.has(c));

  return {
    read: (): RunInput => ({
      crouch: any(bindings.crouch),
      rotate: any(bindings.rotateLeft) ? -1 : any(bindings.rotateRight) ? 1 : 0,
    }),
    destroy() {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    },
  };
}
