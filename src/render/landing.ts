/**
 * The flash and kick that mark landing on the upper track (FR-111).
 *
 * This lives entirely in the render layer and reads nothing the simulation
 * would not otherwise expose. The transition it fires on — piste to shelf — is
 * derived by the view from two consecutive states, so no field was added to
 * RunState for it and the state hash is untouched. That matters more than it
 * looks: an effect that needed its own simulation field would put presentation
 * inside the thing FR-026's reproducibility is computed over.
 *
 * Both halves are redundant by requirement (FR-112). The shelf the player is
 * standing on is drawn under him either way, so suppressing these costs him
 * confirmation, never information — which is what lets FR-113 turn them off
 * wholesale under reduced motion without touching the score (SC-028).
 */
import { FlashLimiter, type MotionSettings } from './reducedMotion.js';

/** Ticks the effect runs for. Eight at 60 Hz — long enough to register, short
 *  enough that it is over before the next decision arrives. */
const DURATION = 8;

/** Peak whiteout opacity. Well under a full white frame: this is a lit rim on
 *  the world, not a strobe (style bible L-0, and FR-057's reason for existing). */
const PEAK_ALPHA = 0.34;

/** Peak camera displacement in world units at the 320x180 buffer scale. */
const PEAK_SHAKE = 3.5;

export interface Shake {
  x: number;
  y: number;
}

const NO_SHAKE: Shake = { x: 0, y: 0 };

export class LandingEffect {
  private ticks = 0;
  private flashing = false;
  private shaking = false;
  private readonly limiter = new FlashLimiter();

  /**
   * Fires the effect. `nowMs` goes to the flash limiter, which enforces
   * FR-057's three-per-second ceiling — a player bouncing on and off a shelf
   * must not be able to strobe himself.
   *
   * The shake is gated separately from the flash because the two are separate
   * reduced-motion settings; a player who has turned off flashing but not shake
   * still gets the kick.
   */
  trigger(nowMs: number, motion: MotionSettings): void {
    const flash = this.limiter.allow(nowMs, motion);
    if (!flash && !motion.shake) return;
    this.ticks = DURATION;
    this.flashing = flash;
    this.shaking = motion.shake;
  }

  /** Advances one simulation tick. Called from the tick, not the frame, so the
   *  effect lasts the same wall-clock time on a 60 Hz phone and a 120 Hz desktop. */
  advance(): void {
    if (this.ticks > 0) this.ticks -= 1;
  }

  /** Camera displacement for this frame, in world units. */
  shake(): Shake {
    if (this.ticks <= 0 || !this.shaking) return NO_SHAKE;
    const decay = this.ticks / DURATION;
    // Alternating sign each tick: a decaying kick rather than a slide, which is
    // what reads as impact at this buffer size.
    const sign = this.ticks % 2 === 0 ? 1 : -1;
    return { x: sign * PEAK_SHAKE * decay * 0.6, y: sign * PEAK_SHAKE * decay };
  }

  /** Whiteout opacity for this frame, 0 when nothing is running. */
  flashAlpha(): number {
    if (this.ticks <= 0 || !this.flashing) return 0;
    const decay = this.ticks / DURATION;
    return PEAK_ALPHA * decay * decay;
  }
}
