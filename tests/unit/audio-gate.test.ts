import { describe, it, expect } from 'vitest';
import { armAudioOnFirstGesture, type AudioGate } from '../../src/audio/gate.js';

/**
 * The regression this file exists for.
 *
 * The gate used to unbind itself on the first gesture, whether or not that
 * gesture achieved anything. On Safari/iOS the first tap leaves the
 * AudioContext SUSPENDED, so it achieved nothing — and with the listeners gone,
 * every later tap was ignored and the game stayed silent for the whole session.
 * That is exactly what was reported from a phone.
 *
 * Chromium resumes a context created in a gesture on its own, which is why
 * every existing test passed while the deployed game was silent. The lesson is
 * in the shape of these tests: they fake a context that does NOT auto-resume.
 */

function gate(startsRunning: boolean, runsAfter = 1): AudioGate & { arms: number } {
  let arms = 0;
  return {
    get arms() {
      return arms;
    },
    arm() {
      arms++;
    },
    get running() {
      return startsRunning || arms >= runsAfter;
    },
  };
}

const tap = (target: EventTarget): boolean =>
  target.dispatchEvent(new Event('pointerdown', { bubbles: true }));

describe('the gesture gate', () => {
  it('arms nothing before a gesture (FR-054, A-3)', () => {
    const audio = gate(true);
    armAudioOnFirstGesture(new EventTarget(), audio);
    expect(audio.arms).toBe(0);
  });

  it('arms on the first gesture and stops listening once audio is running', () => {
    const target = new EventTarget();
    const audio = gate(true);
    armAudioOnFirstGesture(target, audio);

    tap(target);
    expect(audio.arms).toBe(1);

    // Running now, so the gate is done and further taps cost nothing.
    tap(target);
    tap(target);
    expect(audio.arms).toBe(1);
  });

  it('KEEPS listening when the first gesture leaves audio suspended', () => {
    const target = new EventTarget();
    // Not running until the third arm — a stand-in for a context that needs
    // more than one nudge before it will actually play.
    const audio = gate(false, 3);
    armAudioOnFirstGesture(target, audio);

    tap(target);
    expect(audio.arms, 'first tap did not arm').toBe(1);
    tap(target);
    expect(audio.arms, 'the gate unbound itself after a failed first tap').toBe(2);
    tap(target);
    expect(audio.arms).toBe(3);

    // Running at last, so now it unbinds.
    tap(target);
    expect(audio.arms).toBe(3);
  });

  it('accepts a touch or a key, not only a pointer', () => {
    for (const kind of ['pointerdown', 'touchend', 'keydown']) {
      const target = new EventTarget();
      const audio = gate(true);
      armAudioOnFirstGesture(target, audio);
      target.dispatchEvent(new Event(kind));
      expect(audio.arms, `${kind} did not arm audio`).toBe(1);
    }
  });

  it('can be detached by its caller', () => {
    const target = new EventTarget();
    const audio = gate(false, 99);
    const detach = armAudioOnFirstGesture(target, audio);
    detach();
    tap(target);
    expect(audio.arms).toBe(0);
  });

  // FR-143: a browser that will not build an AudioContext at all costs the
  // player silence and nothing else. An error escaping this listener would
  // reach the global handlers and put a fatal panel over a working game.
  it('swallows a failure to arm, and keeps listening in case the next one works', () => {
    const target = new EventTarget();
    let attempts = 0;
    const audio: AudioGate = {
      arm() {
        attempts++;
        throw new Error('AudioContext unavailable');
      },
      get running() {
        return false;
      },
    };
    armAudioOnFirstGesture(target, audio);

    expect(() => tap(target)).not.toThrow();
    expect(() => tap(target)).not.toThrow();
    expect(attempts).toBe(2);
  });
});
