/** Keyboard input. Fully remappable (FR-030). */
import type { RunInput } from '../sim/types.js';
import type { InputSource } from './sample.js';

export interface KeyBindings {
  crouch: string[];
  rotateLeft: string[];
  rotateRight: string[];
  attack: string[];
}

export const DEFAULT_BINDINGS: KeyBindings = {
  crouch: ['Space', 'ArrowDown', 'KeyS'],
  rotateLeft: ['ArrowLeft', 'KeyA'],
  rotateRight: ['ArrowRight', 'KeyD'],
  attack: ['ShiftLeft', 'ArrowUp', 'KeyW'],
};

const STORAGE_KEY = 'shredpocalypse-bindings';

/** Bindings are a per-device convenience, never run state (FR-021). */
export function loadBindings(): KeyBindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_BINDINGS, ...(JSON.parse(raw) as Partial<KeyBindings>) };
  } catch {
    /* a private window or blocked storage is fine: fall back to defaults */
  }
  return DEFAULT_BINDINGS;
}

export function saveBindings(b: KeyBindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    /* non-fatal */
  }
}

export function keyboardSource(bindings: KeyBindings = loadBindings()): InputSource {
  const held = new Set<string>();
  const down = (e: KeyboardEvent): void => {
    held.add(e.code);
    // Space and arrows scroll the page otherwise, which is fatal mid-run.
    if (Object.values(bindings).flat().includes(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent): void => { held.delete(e.code); };
  const blur = (): void => held.clear();

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);

  const any = (codes: string[]): boolean => codes.some((c) => held.has(c));

  return {
    read: (): RunInput => ({
      crouch: any(bindings.crouch),
      rotate: any(bindings.rotateLeft) ? -1 : any(bindings.rotateRight) ? 1 : 0,
      attack: any(bindings.attack),
    }),
    destroy() {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    },
  };
}
