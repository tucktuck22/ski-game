import { describe, it, expect } from 'vitest';
import { parseAudio } from '../../src/data/load.js';
import audioJson from '../../data/audio.json';

/**
 * FR-149 and data-model.md. A bad manifest is a build-time defect, not something the
 * game discovers at runtime and shrugs off: FR-143 says a music FAILURE degrades to
 * silence, which is a different thing from a manifest that was never coherent.
 */

const track = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'lookOutBelow',
  file: 'look-out-below.mp3',
  context: 'frontEnd',
  gain: 0.5,
  ...over,
});

const other = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'powderRush',
  file: 'powder-rush.mp3',
  context: 'course',
  gain: 0.45,
  ...over,
});

const manifest = (...tracks: unknown[]): unknown => ({ tracks });

describe('the shipped manifest', () => {
  it('is valid', () => {
    const parsed = parseAudio(audioJson);
    expect(parsed.tracks).toHaveLength(2);
  });

  it('declares exactly one track per context', () => {
    const byContext = new Map(parseAudio(audioJson).tracks.map((t) => [t.context, t]));
    expect([...byContext.keys()].sort()).toEqual(['course', 'frontEnd']);
  });

  // research.md R1: the front-end piece loops where people hear it, so its join must
  // be gapless (SC-040). The course piece is 220 s against a 76.9 s longest run, so
  // its join is unreachable and it needs no offsets.
  it('gives the front-end piece loop offsets and the course piece none', () => {
    const byContext = new Map(parseAudio(audioJson).tracks.map((t) => [t.context, t]));
    const front = byContext.get('frontEnd');
    expect(front?.loopStart).toBeGreaterThan(0);
    expect(front?.loopEnd).toBeGreaterThan(front?.loopStart as number);
    expect(byContext.get('course')?.loopStart).toBeUndefined();
  });
});

describe('a manifest that could not work is rejected at load', () => {
  it('rejects a missing tracks array', () => {
    expect(() => parseAudio({})).toThrow(/"tracks" must be an array/);
  });

  it('rejects a duplicate id', () => {
    expect(() => parseAudio(manifest(track(), track({ context: 'course' })))).toThrow(
      /duplicate track id/,
    );
  });

  // FR-138: exactly one music track audible at a time. Two tracks claiming one
  // context makes that unanswerable rather than merely wrong.
  it('rejects two tracks claiming the same context', () => {
    expect(() => parseAudio(manifest(track(), other({ context: 'frontEnd' })))).toThrow(
      /two tracks claim the "frontEnd" context/,
    );
  });

  it('rejects a missing context', () => {
    expect(() => parseAudio(manifest(track()))).toThrow(/no track declares the "course" context/);
  });

  it('rejects an unknown context', () => {
    expect(() => parseAudio(manifest(track({ context: 'menu' }), other()))).toThrow(
      /"context" must be one of/,
    );
  });

  it.each([
    ['zero', 0],
    ['negative', -0.1],
    ['above one', 1.5],
    ['not a number', 'loud'],
  ])('rejects a gain that is %s', (_label, gain) => {
    expect(() => parseAudio(manifest(track({ gain }), other()))).toThrow(/"gain" must be a number/);
  });

  it('rejects a file that is not an mp3', () => {
    expect(() => parseAudio(manifest(track({ file: 'x.wav' }), other()))).toThrow(
      /must be a filename ending \.mp3/,
    );
  });

  /**
   * The highest-value assertion in this file. A manifest carrying `/audio/x.mp3`
   * resolves in dev and 404s under the production base path `/ski-game/`, and audio
   * fails SILENTLY - there is no blank page to notice. That is the defect class
   * recorded in vite.config.ts, and this is what stops it recurring through data.
   */
  it.each(['/audio/look-out-below.mp3', 'audio/look-out-below.mp3', './look-out-below.mp3'])(
    'rejects the path %s, because the base belongs in one place only',
    (file) => {
      expect(() => parseAudio(manifest(track({ file }), other()))).toThrow(/bare filename/);
    },
  );

  it('rejects loopStart without loopEnd', () => {
    expect(() => parseAudio(manifest(track({ loopStart: 1 }), other()))).toThrow(
      /must be given together/,
    );
  });

  it('rejects loopEnd at or before loopStart', () => {
    expect(() => parseAudio(manifest(track({ loopStart: 5, loopEnd: 5 }), other()))).toThrow(
      /greater than "loopStart"/,
    );
    expect(() => parseAudio(manifest(track({ loopStart: 5, loopEnd: 1 }), other()))).toThrow(
      /greater than "loopStart"/,
    );
  });

  it('rejects a negative loopStart', () => {
    expect(() => parseAudio(manifest(track({ loopStart: -1, loopEnd: 5 }), other()))).toThrow(
      /"loopStart" must be a finite number/,
    );
  });
});
