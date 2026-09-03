/**
 * Storage that cannot take the app down.
 *
 * Accessing sessionStorage/localStorage THROWS - not returns null - when site
 * data is blocked: a sandboxed frame, strict privacy settings, some private
 * modes, an extension. main.ts read sessionStorage unguarded at module top
 * level, so in any of those contexts the whole app failed to initialise and
 * rendered a blank page with nothing on screen to explain it.
 *
 * Everything stored through here is a per-device convenience (FR-021 forbids
 * device-local storage from being authoritative), so losing it is always
 * survivable. Failing to start is not.
 */
export interface SafeStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** False when the browser denied access — useful for telling the player why. */
  readonly available: boolean;
}

function wrap(pick: () => Storage): SafeStorage {
  let store: Storage | null = null;
  let available = false;
  try {
    store = pick();
    // Presence is not enough: Safari with site data blocked exposes the object
    // and throws only on use, so probe with a real write.
    const probe = '__shred_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    available = true;
  } catch {
    store = null;
    available = false;
  }

  return {
    available,
    get(key) {
      if (!store) return null;
      try {
        return store.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      if (!store) return;
      try {
        store.setItem(key, value);
      } catch {
        /* quota or denial: the value is a convenience, never state that matters */
      }
    },
    remove(key) {
      if (!store) return;
      try {
        store.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export const safeSession: SafeStorage = wrap(() => sessionStorage);
export const safeLocal: SafeStorage = wrap(() => localStorage);
