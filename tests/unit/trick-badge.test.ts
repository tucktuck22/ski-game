import { describe, it, expect } from 'vitest';
import { trickWord } from '../../src/ui/trickBadge.js';

/**
 * FR-128: the badge escalates with what the player actually did.
 *
 * The words are keyed on UNITS of the base rotation bonus rather than on
 * rotations, so one rotation doubled by the upper track shouts as loudly as two
 * rotations on the piste — they are worth the same, and a badge that said
 * otherwise would be telling the player his best line was his quieter one.
 */
describe('trick wording', () => {
  it('escalates with the size of the trick', () => {
    expect(trickWord(1)).toBe('NICE');
    expect(trickWord(2)).toBe('COOL');
    expect(trickWord(3)).toBe('SICK');
    expect(trickWord(4)).toBe('WHOA');
  });

  it('gives one rotation off the upper track the same shout as two on the piste', () => {
    expect(trickWord(1 * 2)).toBe(trickWord(2 * 1));
  });

  it('tops out rather than running off the end of the list', () => {
    for (const units of [5, 9, 40]) expect(trickWord(units)).toBe('WHOA');
  });

  it('never returns nothing for a degenerate value', () => {
    for (const units of [0, -1, 0.4]) expect(trickWord(units)).toBe('NICE');
  });
});
