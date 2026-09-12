/**
 * The badge that carries a coaching instruction, and the slot it lives in.
 *
 * Feature 005. A sibling of `trickBadge.ts` in look and a deliberate opposite
 * of it in lifetime, which is the whole reason it is a separate module.
 *
 * WHY THERE IS NO TIMER, AND WHY THAT IS THE POINT. `popTrickBadge` removes its
 * element after LIFETIME_MS. That suits it: a trick badge reports something
 * that has already finished, so a wall clock is the right clock. A coaching
 * badge describes an object that is still AHEAD of the player, on the
 * simulation tick. On a slow frame a timer would clear the instruction while
 * its object had not yet arrived — and that is the one failure a player cannot
 * recover from, because the cue never comes again (research R6). So this badge
 * is shown and hidden by position, and `set(null)` is the only thing that
 * clears it.
 *
 * Reduced motion is inherited rather than rebuilt: `.badge-still` and the
 * `badge-hold` keyframe already exist and already do what FR-194 asks, which is
 * to drop the movement and keep the message and its legible hold.
 */
import type { MotionSettings } from '../render/reducedMotion.js';
import type { Cue } from '../render/coachingCue.js';

export interface CoachingBadge {
  /** Shows `cue`, replacing whatever was up. `null` clears the slot. */
  set(cue: Cue | null): void;
  destroy(): void;
}

/**
 * Mounts the single coaching slot inside the existing `#badges` host.
 *
 * One slot, created once and reused, rather than an element per cue. That is
 * what makes "at most one coaching badge exists at any moment" (FR-191) a
 * property of the DOM rather than a discipline the caller has to keep — and it
 * is why a trick badge landing beside it displaces neither: they are siblings
 * in the same column, and the coaching slot is always the first child.
 */
export function mountCoachingBadge(host: HTMLElement, motion: MotionSettings): CoachingBadge {
  const slot = document.createElement('div');
  slot.className = 'coach-slot';
  // Inserted FIRST so a trick badge appended later stacks under it rather than
  // over it. L-0: the instruction outranks the applause.
  host.prepend(slot);

  let current: Cue | null = null;

  const set = (cue: Cue | null): void => {
    if (cue === current) return;
    current = cue;
    slot.replaceChildren();
    if (!cue) return;

    const el = document.createElement('div');
    el.className = motion.shake ? 'badge coach-badge' : 'badge coach-badge badge-still';
    const word = document.createElement('span');
    word.className = 'badge-word coach-word';
    word.textContent = cue.text;
    el.append(word);
    slot.append(el);
  };

  return {
    set,
    destroy: () => {
      current = null;
      slot.remove();
    },
  };
}
