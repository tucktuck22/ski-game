/**
 * The wipeout: a few seconds on the mountain before the results panel.
 *
 * The run used to cut to the panel on the frame it ended, which threw away the
 * one moment the player most wants to see — the crash he just caused. Holding
 * the frame costs nothing in the simulation, which has already stopped, and
 * everything here is render-only timing.
 *
 * What it must NOT delay is the commit. An official run commits the instant it
 * ends (feature 001's FR-020), and a player who closes the tab during this
 * sequence must still have his score; so the caller fires the commit
 * immediately and awaits this only to decide when to change the screen.
 */
import type { MotionSettings } from './reducedMotion.js';

/** Ticks, at the simulation's 60 Hz, so the hold is the same on any display. */
const SETTLE = 24; // the crash reads on its own before any words appear
const FADE = 48; // the words arrive slowly — this is the whole Souls idiom
const HOLD = 84; // long enough to be a beat, short enough to not be a wait
const TOTAL = SETTLE + FADE + HOLD;

/**
 * Reduced motion keeps the sequence and drops the drama: the words are there at
 * once and the beat is shorter. It is not skipped outright, because the panel
 * that follows is a different screen and cutting straight to it is the jarring
 * transition this whole thing exists to remove.
 */
const REDUCED_TOTAL = 54;

export interface Tumble {
  /** Extra rotation on the skier, in radians. */
  spin: number;
  /** How far he has slid down the slope from where he fell, in world units. */
  slide: number;
}

const STILL: Tumble = { spin: 0, slide: 0 };

export class DeathSequence {
  private ticks = 0;
  private running = false;
  private skipped = false;
  private total = TOTAL;
  private animated = true;

  start(motion: MotionSettings): void {
    if (this.running) return;
    this.running = true;
    this.ticks = 0;
    this.animated = motion.shake;
    this.total = motion.shake ? TOTAL : REDUCED_TOTAL;
  }

  /** Advanced once per simulation tick, not per frame, so the beat is fixed. */
  advance(): void {
    if (this.running && this.ticks < this.total) this.ticks += 1;
  }

  /** Cuts it short. A player on his twentieth run does not need the beat. */
  skip(): void {
    if (this.running) this.skipped = true;
  }

  get active(): boolean {
    return this.running && !this.done;
  }

  get done(): boolean {
    return !this.running || this.skipped || this.ticks >= this.total;
  }

  /**
   * How the body is lying, an eased slide-and-spin that stops rather than
   * drifting. He is dead, not sliding to the bottom of the mountain.
   */
  tumble(): Tumble {
    if (!this.running || !this.animated) return STILL;
    const u = Math.min(1, this.ticks / 48);
    const eased = 1 - (1 - u) * (1 - u);
    return { spin: 5.6 * eased, slide: 17 * eased };
  }
}

/** Total wall-clock length, for anything that needs to wait it out. */
export const deathSequenceMs = (motion: MotionSettings): number =>
  ((motion.shake ? TOTAL : REDUCED_TOTAL) * 1000) / 60;

/** When the lettering should start arriving, as a fraction of the whole. */
export const DEATH_TEXT_DELAY_MS = (SETTLE * 1000) / 60;
export const DEATH_TEXT_FADE_MS = (FADE * 1000) / 60;
