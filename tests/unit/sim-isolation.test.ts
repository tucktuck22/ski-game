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

/**
 * FR-164 and SC-055: this feature draws a new character and changes nothing the
 * simulation can see.
 *
 * The guarantee is structural rather than testimonial - `RunState` gains no
 * field, so the state hash cannot change, so the three-engine determinism gate
 * compares the same bytes it compared before. These assertions exist because
 * that argument is only as good as the thing it asserts about, and the
 * three-engine gate is slow and runs against a build. This runs in
 * milliseconds on every commit and fails the moment somebody adds a field for
 * presentation - the one catastrophic way to get feature 004 wrong.
 */
describe('the simulation cannot observe the renderer (FR-164)', () => {
  const files = tsFilesIn(SIM_DIR);

  it.each(files.map((f) => [f.slice(f.indexOf('src/')), f]))(
    '%s imports nothing from src/render',
    (_label, file) => {
      const source = readFileSync(file, 'utf8');
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] as string);
      const reaching = imports.filter((p) => p.includes('render'));
      expect(reaching, `${_label} reaches into render: ${reaching.join(', ')}`).toEqual([]);
    },
  );

  it('RunState carries exactly the fields it carried before feature 004', () => {
    // A snapshot of the interface, not of a value. Feature 004 adds poses,
    // lean buckets and a landing absorb, and NONE of them may appear here:
    // a field added for presentation would put presentation inside the thing
    // FR-026's reproducibility is computed over. Changing this list is a
    // deliberate act that has to be justified against Principle V.
    const source = readFileSync(join(SIM_DIR, 'types.ts'), 'utf8');
    const body = source.slice(source.indexOf('export interface RunState {'));
    const fields = [...body.slice(0, body.indexOf('\n}')).matchAll(/^ {2}(\w+)[?]?:/gm)].map(
      (m) => m[1] as string,
    );
    expect(new Set(fields)).toEqual(
      new Set([
        'tick',
        'x',
        'y',
        'vx',
        'vy',
        'ox',
        'oy',
        'rotationAccum',
        'spinTicksLeft',
        'spinDir',
        'spinFromOx',
        'spinFromOy',
        'rotateHeld',
        'grounded',
        'ledge',
        'crouchHeld',
        'crouchCharge',
        'crouchProfile',
        'landingGraceTicks',
        'crumbleTicks',
        'score',
        'maxX',
        'progress',
        'scoreMultiplier',
        'pickupsTaken',
        'iceBroken',
        'outcome',
        'wipeoutReason',
      ]),
    );
  });

  it('no tuning value moved (FR-161)', () => {
    // Feature 004 is a rendering change. The absorb duration and the lean
    // hysteresis are render-layer constants, deliberately NOT tuning entries:
    // the simulation never reads them, and putting them here would imply they
    // could change the game.
    const tuning = JSON.parse(
      readFileSync(join(__dirname, '../../data/tuning.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(tuning['standHeight']).toBe(16);
    expect(tuning['crouchHeight']).toBe(9);
    for (const key of Object.keys(tuning)) {
      expect(key).not.toMatch(/absorb|pose|sprite|lean/i);
    }
  });
});
