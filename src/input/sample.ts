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
  private latched = false;
  constructor(private readonly sources: InputSource[]) {}

  /** Combines every source. Touch and keyboard are equal citizens (FR-029). */
  sample(): RunInput {
    let crouch = false;
    let rotate: -1 | 0 | 1 = 0;
    let attack = false;
    for (const s of this.sources) {
      const i = s.read();
      crouch = crouch || i.crouch;
      if (i.rotate !== 0) rotate = i.rotate;
      attack = attack || i.attack;
    }
    // Attack is edge-triggered: holding the button must not machine-gun it.
    const attackEdge = attack && !this.latched;
    this.latched = attack;
    return { crouch, rotate, attack: attackEdge };
  }

  destroy(): void {
    for (const s of this.sources) s.destroy();
  }
}
