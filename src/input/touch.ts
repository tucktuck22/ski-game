/**
 * Touch input.
 *
 * One zone: anywhere on the screen. With the attack verb withdrawn (FR-114)
 * there is no second zone to divide the screen for, so the whole surface is the
 * tuck and a drag across it rotates - which is strictly easier one-handed than
 * the thirds it replaced (FR-085). Rotation is quantised to the same -1/0/+1
 * the keyboard produces so touch is not finer-grained than keys, which FR-029's
 * "equivalent precision" cuts both ways on.
 */
import type { RunInput } from '../sim/types.js';
import type { InputSource } from './sample.js';

export function touchSource(target: HTMLElement): InputSource {
  let crouch = false;
  let rotate: -1 | 0 | 1 = 0;
  const active = new Map<number, { startX: number }>();

  const recompute = (): void => {
    crouch = active.size > 0;
  };

  const start = (e: PointerEvent): void => {
    active.set(e.pointerId, { startX: e.clientX });
    recompute();
    e.preventDefault();
  };

  const move = (e: PointerEvent): void => {
    const t = active.get(e.pointerId);
    if (!t) return;
    const dx = e.clientX - t.startX;
    // A deliberate drag rotates; a stationary hold does not, so tucking and
    // spinning stay distinguishable with one thumb.
    rotate = dx < -18 ? -1 : dx > 18 ? 1 : 0;
  };

  const end = (e: PointerEvent): void => {
    active.delete(e.pointerId);
    if (active.size === 0) rotate = 0;
    recompute();
  };

  target.addEventListener('pointerdown', start);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);

  return {
    read: (): RunInput => ({ crouch, rotate }),
    destroy() {
      target.removeEventListener('pointerdown', start);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
    },
  };
}
