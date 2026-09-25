/**
 * The word that arrives when a run crosses the line (feature 009, FR-265).
 *
 * The finish's sibling of youDied.ts, and deliberately not its twin. The wipeout
 * borrows a death screen's slow serif (LT-7, confined to those two words); a
 * finish is a shout, so FINISH! is the game's own sound-effect lettering (LT-3):
 * `yellow` on an `ink` band with a hard `magenta` drop, arriving with a pop.
 *
 * Drawn over the canvas rather than into it, for the reason youDied.ts gives:
 * at 320x180 the buffer cannot hold letters this size without eating the
 * frame (L-0), and the gantry and the crowd must stay visible behind it.
 */
import type { MotionSettings } from '../render/reducedMotion.js';

/** Puts the lettering over the running canvas. Removed when the run is torn down. */
export function showFinished(root: ParentNode, motion: MotionSettings): void {
  const wrap = root.querySelector('.game-wrap');
  if (!wrap || wrap.querySelector('.finished')) return;

  const el = document.createElement('div');
  el.className = motion.shake ? 'finished' : 'finished finished-still';
  el.setAttribute('role', 'status');

  const band = document.createElement('div');
  band.className = 'finished-band';

  const text = document.createElement('span');
  text.className = 'finished-text';
  text.textContent = 'FINISH!';

  band.append(text);
  el.append(band);
  wrap.append(el);
}
