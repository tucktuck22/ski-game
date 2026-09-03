/**
 * Input sampling.
 *
 * Sampled once per SIMULATION tick, not per animation frame. contracts/controls.md
 * is explicit about why: per-frame sampling would let a 120 Hz desktop register
 * finer timing than a 60 Hz phone, and FR-088 makes release timing the core
 * skill — so that would hand desktop players a real advantage and break SC-006.
 */
import type { RunInput } from '../sim/types.js';

export interface InputSource {
  /** Current held state. Edges are derived by the sampler, not the source. */
  read(): RunInput;
  destroy(): void;
}

export class InputSampler {
  constructor(private readonly sources: InputSource[]) {}

  /**
   * Combines every source. Touch and keyboard are equal citizens (FR-029).
   *
   * Both remaining verbs are held states, so the sampler no longer latches
   * anything: the one edge the game cares about is the crouch RELEASE, and
   * resolveCrouch derives that from the simulation's own previous tick rather
   * than from here.
   */
  sample(): RunInput {
    let crouch = false;
    let rotate: -1 | 0 | 1 = 0;
    for (const s of this.sources) {
      const i = s.read();
      crouch = crouch || i.crouch;
      if (i.rotate !== 0) rotate = i.rotate;
    }
    return { crouch, rotate };
  }

  destroy(): void {
    for (const s of this.sources) s.destroy();
  }
}
