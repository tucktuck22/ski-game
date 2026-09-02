/**
 * Touch input.
 *
 * Three zones, all reachable one-handed on a phone, with no multi-finger
 * gesture required (FR-085). Rotation is quantised to the same -1/0/+1 the
 * keyboard produces so touch is not finer-grained than keys, which FR-029's
 * "equivalent precision" cuts both ways on.
 */
import type { RunInput } from '../sim/types.js';
import type { InputSource } from './sample.js';

export function touchSource(target: HTMLElement): InputSource {
  let crouch = false;
  let rotate: -1 | 0 | 1 = 0;
  let attack = false;
  const active = new Map<number, { zone: 'crouch' | 'attack'; startX: number }>();

  const zoneFor = (y: number): 'crouch' | 'attack' =>
    y < target.clientHeight / 3 ? 'attack' : 'crouch';

  const recompute = (): void => {
    crouch = [...active.values()].some((t) => t.zone === 'crouch');
    attack = [...active.values()].some((t) => t.zone === 'attack');
  };

  const start = (e: PointerEvent): void => {
    const rect = target.getBoundingClientRect();
    active.set(e.pointerId, { zone: zoneFor(e.clientY - rect.top), startX: e.clientX });
    recompute();
    e.preventDefault();
  };

  const move = (e: PointerEvent): void => {
    const t = active.get(e.pointerId);
    if (!t || t.zone !== 'crouch') return;
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
    read: (): RunInput => ({ crouch, rotate, attack }),
    destroy() {
      target.removeEventListener('pointerdown', start);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
    },
  };
}
