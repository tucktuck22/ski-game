/**
 * The two words that arrive after a wipeout.
 *
 * A deliberate borrowing of a modern death screen's staging — wide-tracked
 * capitals on a band across the middle of the frame, arriving slowly and
 * sitting there — rendered in this game's own palette and idiom rather than in
 * that game's. Style bible rule LT-7 records what is borrowed and what is not,
 * and O-1 is the reason for the distinction: the staging is a convention, the
 * colours and lettering are ours.
 *
 * It is drawn over the canvas rather than into it. At 320x180 the buffer cannot
 * hold letters this wide without them eating the frame, and the words need to
 * be legible in a way the pixel grid would fight (rule L-0).
 */
import type { MotionSettings } from '../render/reducedMotion.js';
import { DEATH_TEXT_DELAY_MS, DEATH_TEXT_FADE_MS } from '../render/death.js';

/**
 * Puts the lettering over the running canvas.
 *
 * The element is appended to the game wrapper rather than replacing anything,
 * so the mountain, the skier and the wipeout underneath it all keep playing.
 * It is removed when the caller tears the run down.
 */
export function showYouDied(root: ParentNode, motion: MotionSettings): void {
  const wrap = root.querySelector('.game-wrap');
  if (!wrap || wrap.querySelector('.you-died')) return;

  const el = document.createElement('div');
  el.className = motion.shake ? 'you-died' : 'you-died you-died-still';
  el.setAttribute('role', 'status');

  const band = document.createElement('div');
  band.className = 'you-died-band';

  const text = document.createElement('span');
  text.className = 'you-died-text';
  text.textContent = 'YOU DIED';

  band.append(text);
  el.append(band);

  // The timings come from the sequence that is driving the canvas underneath,
  // so the words and the body settle together instead of on two clocks.
  el.style.setProperty('--death-delay', `${DEATH_TEXT_DELAY_MS}ms`);
  el.style.setProperty('--death-fade', `${DEATH_TEXT_FADE_MS}ms`);

  wrap.append(el);
}
