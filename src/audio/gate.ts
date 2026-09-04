/**
 * The gesture gate: nothing is audible until the player asks for it.
 *
 * FR-054 and style-bible A-3 require silence until a deliberate interaction,
 * and every browser requires the same thing independently. This is the one
 * place that rule is implemented.
 *
 * The file feature 001's T095 named and never created. It lived inline in
 * main.ts instead, which is why the defect below went unnoticed: a gate that is
 * not a unit cannot have a unit test.
 *
 * WHY IT RETRIES. A first gesture is not a guarantee that audio works. Safari
 * on iOS hands back a SUSPENDED AudioContext even when it was constructed
 * inside the gesture handler, so the graph builds, nothing throws, and nothing
 * is ever heard. The original gate unbound itself on the first gesture whether
 * or not that gesture achieved anything - so on iOS the first tap silently
 * failed and every tap after it was ignored. It stays bound until audio is
 * genuinely running.
 */

/** Gestures that count. `touchend` is belt and braces for the platform at fault. */
const GESTURES = ['pointerdown', 'touchend', 'keydown'] as const;

export interface AudioGate {
  /** Create the audio graph if needed, and resume it if it is not running. */
  arm(): void;
  /** True only once audio can actually be heard, not merely once it was set up. */
  readonly running: boolean;
}

/**
 * Binds the gate. Returns a detach function, so a caller can tear it down
 * without having to remember which events were used.
 */
export function armAudioOnFirstGesture(on: EventTarget, audio: AudioGate): () => void {
  const detach = (): void => {
    for (const g of GESTURES) on.removeEventListener(g, handler);
  };
  const handler = (): void => {
    // FR-143: audio is the first thing to give up. A browser that refuses to
    // build an AudioContext at all must cost the player nothing but silence,
    // so a throw here is swallowed rather than left to reach the page.
    try {
      audio.arm();
    } catch {
      return;
    }
    // Only stop listening once it worked. Unbinding here unconditionally is
    // what left iOS silent for a whole session after one failed tap.
    if (audio.running) detach();
  };
  for (const g of GESTURES) on.addEventListener(g, handler);
  return detach;
}
