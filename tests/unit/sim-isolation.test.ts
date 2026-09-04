import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * FR-144, SC-046 and contracts/audio.md G8.
 *
 * `music-determinism.spec.ts` proves the simulation does not currently hear the
 * music. This proves it cannot start to. The determinism e2e is slow and runs against
 * a build; this runs in milliseconds on every commit and fails the moment somebody
 * reaches from `src/sim/` into anything that makes a sound.
 *
 * The constitution's stop condition is the reasoning: where a rule has no gate, the
 * missing gate is the defect. ADR-0009 notes that A-1's synthesis rule used to be
 * self-enforcing - there was no loader, so there could be no sample - and is not any
 * more. This is one of the gates that replaces it.
 */

const SIM_DIR = join(__dirname, '../../src/sim');

function tsFilesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsFilesIn(full);
    return name.endsWith('.ts') ? [full] : [];
  });
}

describe('the simulation cannot observe audio (FR-144, G8)', () => {
  const files = tsFilesIn(SIM_DIR);

  it('finds the simulation sources', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(f.indexOf('src/')), f]))(
    '%s imports nothing from src/audio',
    (_label, file) => {
      const source = readFileSync(file, 'utf8');
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] as string);
      const reaching = imports.filter((p) => p.includes('audio'));
      expect(reaching, `${_label} reaches into audio: ${reaching.join(', ')}`).toEqual([]);
    },
  );

  it.each(files.map((f) => [f.slice(f.indexOf('src/')), f]))(
    '%s names no audio API',
    (_label, file) => {
      const source = readFileSync(file, 'utf8');
      // Not exhaustive, and not meant to be: it catches the plausible mistake -
      // someone reaching for a sound where a state change belongs - not a determined
      // circumvention.
      const forbidden = ['AudioContext', 'HTMLAudioElement', 'new Audio(', 'MusicPlayer', 'Synth'];
      const found = forbidden.filter((name) => source.includes(name));
      expect(found, `${_label} names ${found.join(', ')}`).toEqual([]);
    },
  );
});
