/**
 * The two files feature 005 is not allowed to move (FR-196, FR-204).
 *
 * 005 re-skins the `low` obstacle and prepends a coached section to the WARM-UP
 * course. Neither of those may reach the physics, the feel values, the scoring
 * table, or the official course — and that is not a style preference, it is the
 * clause that lets this feature ship into a draft that is already holding
 * committed scores. A rope drawn differently must not change what a rope does.
 *
 * WHY A BYTE COMPARISON RATHER THAN A FIELD-BY-FIELD ONE. A field check has to
 * know which fields exist, so the one edit it cannot catch is a NEW key — which
 * is exactly how a feel value gets added without anyone deciding to add it.
 * Comparing against the committed blob has no such blind spot: it fails on any
 * edit at all, including whitespace, and the failure names the file.
 *
 * The comparison is against `git show HEAD:<path>` rather than a checked-in
 * digest, because a digest is a second thing to update and therefore a second
 * thing to update WRONGLY. Deliberately changing one of these files means
 * committing it, which is a reviewable diff, which is the whole point.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** The committed content of `path`, or null where git cannot answer. */
function committed(path: string): string | null {
  try {
    return execFileSync('git', ['show', `HEAD:${path}`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

const FROZEN = [
  {
    path: 'data/tuning.json',
    why:
      'the values governing feel and physics. FR-196: feature 005 may not change them, ' +
      'and a moved tuning value is a re-feel of both courses that nobody asked for.',
  },
  {
    path: 'data/courses/official.json',
    why:
      'the scored course. FR-196: feature 005 touches the WARM-UP course only. A moved ' +
      'official course invalidates every committed score on the leaderboard.',
  },
] as const;

describe('the data feature 005 must not move', () => {
  for (const { path, why } of FROZEN) {
    it(`${path} is byte-identical to its committed version`, () => {
      const head = committed(path);
      if (head === null) {
        // A shallow clone or a detached worktree with no HEAD is not a failure
        // of the product. Say so out loud rather than passing silently.
        console.warn(`tuning-frozen: cannot read HEAD:${path} from git; skipping`);
        return;
      }
      const working = readFileSync(join(root, path), 'utf8');
      expect(working, `${path} has been modified. It is frozen because it is ${why}`).toBe(head);
    });
  }
});
