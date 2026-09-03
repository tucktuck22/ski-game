/**
 * The badge that pops when a trick lands, and the words on it.
 *
 * A landed trick used to be invisible: the score ticked up between two HUD
 * polls a tenth of a second apart, at the exact moment the player was busy
 * looking at where he was about to land. So the one mechanic with the highest
 * skill floor in the game paid out silently, and nothing on screen connected
 * the spin he had just committed to with the number that changed.
 *
 * The badge is feedback, not information: FR-128 requires the score itself to
 * remain the authority, and the HUD carries that whether or not a badge is ever
 * seen. Nothing here decides anything — it reports what the simulation already
 * did.
 */
import type { MotionSettings } from '../render/reducedMotion.js';

/**
 * Escalating, in the register the style bible asks of sound-effect lettering
 * (LT-3). Ordered by how impressed the mountain is.
 */
const WORDS = ['NICE', 'COOL', 'SICK', 'WHOA'] as const;

/**
 * Picks the word for a trick worth `units` of the base rotation bonus.
 *
 * Units rather than points, so the wording tracks what the player actually did
 * — two rotations and one rotation doubled by the upper track are both worth
 * two, and both deserve the same shout.
 */
export function trickWord(units: number): string {
  const i = Math.round(units) - 1;
  if (i <= 0) return WORDS[0];
  return WORDS[Math.min(i, WORDS.length - 1)] as string;
}

export interface TrickEvent {
  /** Points actually added to the score, multiplier already applied. */
  points: number;
  /** Whole rotations landed in the air that just ended. */
  rotations: number;
  /** The zone the trick was thrown in: 1 on the piste, 2 off the upper track. */
  multiplier: number;
}

/** How long a badge stays up. Long enough to read, short enough to not stack. */
const LIFETIME_MS = 1100;

/**
 * Appends a badge to `host` and removes it when it has finished.
 *
 * Under reduced motion the badge still appears and still says the same thing —
 * it is score feedback, and FR-056 requires the run to stay fully playable and
 * scoreable, not silent. What is dropped is the movement.
 */
export function popTrickBadge(host: HTMLElement, trick: TrickEvent, motion: MotionSettings): void {
  const units = trick.rotations * trick.multiplier;
  const el = document.createElement('div');
  el.className = motion.shake ? 'badge' : 'badge badge-still';

  const word = document.createElement('span');
  word.className = 'badge-word';
  word.textContent = trickWord(units);

  const points = document.createElement('span');
  points.className = 'badge-points';
  points.textContent = `+${trick.points.toLocaleString()}`;

  el.append(word, points);

  if (trick.multiplier > 1) {
    const mult = document.createElement('span');
    mult.className = 'badge-mult';
    mult.textContent = `${trick.multiplier}× AIR`;
    el.append(mult);
  }

  host.append(el);
  setTimeout(() => el.remove(), LIFETIME_MS);
}
