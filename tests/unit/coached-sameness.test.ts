/**
 * US3 and FR-186a: every practice run is the same, because nothing remembers.
 *
 * This story delivers no new capability — it protects one. Every alternative
 * design for a tutorial needed a record of who had been coached, and a record
 * that can be wrong is a way for a player to be dropped into the wrong terrain:
 * skipped on a device he has never used, or coached again on the one he has.
 * The clarification bought sameness by refusing to keep the record at all.
 *
 * So what is asserted here is an ABSENCE, which is exactly the kind of property
 * that rots silently. Nothing fails when somebody adds a "seenTutorial" flag —
 * it just works, on their device, until a player clears his browser.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cueAt, CUES } from '../../src/render/coachingCue.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const sourceFiles = (function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(ts|css)$/.test(e.name) ? [full] : [];
  });
})(join(root, 'src'));

describe('FR-186a: nothing records whether a player has been coached', () => {
  it('adds no storage key, anywhere in the source', () => {
    // The coaching feature's whole surface is two modules plus a callback. If
    // any of it reaches for persistence, it is doing something FR-186a forbids.
    for (const path of [
      join(root, 'src/render/coachingCue.ts'),
      join(root, 'src/ui/coachingBadge.ts'),
    ]) {
      const text = readFileSync(path, 'utf8');
      for (const tell of ['localStorage', 'sessionStorage', 'indexedDB', 'safeLocal', 'cookie']) {
        expect(text, `${path} reaches for ${tell}; FR-186a forbids remembering this`).not.toContain(
          tell,
        );
      }
    }
  });

  it('adds no database column and no migration', () => {
    const migrations = join(root, 'supabase/migrations');
    if (!existsSync(migrations)) return;
    for (const name of readdirSync(migrations)) {
      const sql = readFileSync(join(migrations, name), 'utf8').toLowerCase();
      for (const tell of ['coach', 'tutorial', 'onboard']) {
        expect(
          sql,
          `${name} carries a ${tell} column; FR-186a forbids remembering this`,
        ).not.toContain(tell);
      }
    }
  });

  it('no source file keys anything on having been coached', () => {
    const offenders = sourceFiles.filter((f) =>
      /seen[A-Z_]*(tutorial|coach)|hasBeenCoached|coachedBefore|tutorialDone/i.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(offenders, 'something remembers who has been coached').toEqual([]);
  });
});

describe('US3: three runs in a row are the same run', () => {
  it('the cue table is immutable, so no run can alter the next', () => {
    expect(Object.isFrozen(CUES)).toBe(true);
    for (const cue of CUES) expect(Object.isFrozen(cue)).toBe(true);
  });

  it('cueAt gives identical answers however many times it is asked', () => {
    // A cheap proxy for "the third practice run is the first one again": the
    // selection function has no memory, so sweeping it repeatedly cannot drift.
    const sweep = (): (string | null)[] => {
      const out: (string | null)[] = [];
      for (let x = 0; x < 3200; x += 7) out.push(cueAt(x)?.id ?? null);
      return out;
    };
    const first = sweep();
    for (let run = 0; run < 3; run++) expect(sweep()).toEqual(first);
  });

  it('the coached section is ordinary course data, not a mode', () => {
    // FR-186a's real guarantee. The section survives a cleared browser and a
    // switched device because it is geometry in a versioned file that every
    // client downloads, not a state anybody holds.
    const warmup = JSON.parse(
      readFileSync(join(root, 'data/courses/warmup.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(Object.keys(warmup).sort()).toEqual(
      [
        'id',
        'rulesVersion',
        'length',
        'terrain',
        'obstacles',
        'pickups',
        'ledges',
        'kickers',
        'rocks',
        'ice',
      ].sort(),
    );
    // No flag on the course saying which part is coached — if there were, every
    // validator rule would have to learn about it.
    expect(JSON.stringify(warmup)).not.toMatch(/coach|tutorial/i);
  });
});
