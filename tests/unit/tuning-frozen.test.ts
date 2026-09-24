/**
 * What may not move without saying so. Owned by feature 008 since 2026-09-24;
 * feature 005 wrote it (FR-196, FR-204) and its reasoning is kept below.
 *
 * TWO GUARDS, BECAUSE THE TWO FILES ARE NOW DIFFERENT KINDS OF FROZEN.
 *
 * data/tuning.json may not move at all. Feature 005 needed that because a rope
 * drawn differently must not change what a rope does. Feature 008 needs it again
 * for its own reason: FR-247 buys the player reaction time from the course's
 * shape and the camera, and explicitly NOT from drag, gravity or friction. A
 * moved tuning value is a re-feel of both courses that nobody asked for.
 *
 * The official course may move - 007 moves it - but never silently. It is the
 * scored course: the database freezes rules from the first official run, and
 * two rule sets on one leaderboard is the bed order decided on two different
 * mountains. So its geometry is fingerprinted per rulesVersion. Moving the course
 * means adding a version and its fingerprint, which is the review the change
 * needs; the test fails otherwise, naming both hashes.
 *
 * WHY A BYTE COMPARISON FOR TUNING. A field check has to know which fields exist,
 * so the one edit it cannot catch is a NEW key - which is exactly how a feel
 * value gets added without anyone deciding to add it. Comparing against the
 * committed blob has no such blind spot: it fails on any edit at all, including
 * whitespace, and the failure names the file.
 *
 * WHY A DIGEST TABLE FOR THE COURSE, when the tuning guard deliberately avoids
 * one. A comparison against HEAD only ever sees UNCOMMITTED edits: in CI, HEAD is
 * the change under test, so a course committed without a version bump sails
 * through. The table is a second thing to update, and that is the point - it
 * forces the version to move with the geometry. Never change the fingerprint of a
 * version already listed; a version that shipped is a fact about the past.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

/**
 * sha256 of the official course with `rulesVersion` removed - everything a
 * player rides. One entry per version that ever shipped; append only.
 */
const OFFICIAL_GEOMETRY: Record<string, string> = {
  // Feature 006: slope-driven speed.
  '2.0.0': '2dcab59a32e75a087c8884711164c3fc1f68f42627fdbfb27b92b3fe5f6f2980',
  // Feature 007: best of three official attempts. Run economy only; no geometry moved.
  '3.0.0': '2dcab59a32e75a087c8884711164c3fc1f68f42627fdbfb27b92b3fe5f6f2980',
  // Feature 008: the Narrows and the Last Pitch eased, one log moved.
  '3.1.0': '76625b52c2986f4f853f8f0714216b202781e8a45dedf8c0eeecde6a011bbba0',
};

/** Versions whose bump moved no geometry, and what they moved instead. */
const GEOMETRY_UNCHANGED: Record<string, string> = {
  '3.0.0': 'three official attempts, best one counts (feature 007)',
};

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>;

function geometry(course: Record<string, unknown>): string {
  const { rulesVersion: _v, ...rest } = course;
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex');
}

describe('tuning does not move (FR-247)', () => {
  const path = 'data/tuning.json';
  it(`${path} is byte-identical to its committed version`, () => {
    const head = committed(path);
    if (head === null) {
      // A shallow clone or a detached worktree with no HEAD is not a failure
      // of the product. Say so out loud rather than passing silently.
      console.warn(`tuning-frozen: cannot read HEAD:${path} from git; skipping`);
      return;
    }
    const working = readFileSync(join(root, path), 'utf8');
    expect(
      working,
      `${path} has been modified. Feature 008 buys reaction time from the course and ` +
        'the camera, not from physics (FR-247), and a moved tuning value re-feels both courses.',
    ).toBe(head);
  });
});

describe('the official course never moves without a new rules version (FR-023, FR-254)', () => {
  const official = readJson('data/courses/official.json');
  const version = official.rulesVersion as string;

  it(`its geometry is the one recorded for rules ${version}`, () => {
    const recorded = OFFICIAL_GEOMETRY[version];
    expect(
      recorded,
      `rules ${version} has no recorded geometry. If this is a new version, add it to ` +
        `OFFICIAL_GEOMETRY with fingerprint ${geometry(official)}.`,
    ).toBeDefined();
    expect(
      geometry(official),
      `the official course has moved but its rulesVersion is still ${version}. Bump the ` +
        'version in tools/gen-courses.ts and record the new geometry - a moved course under ' +
        'an old version puts two rule sets on one leaderboard.',
    ).toBe(recorded);
  });

  it('no two versions share a geometry unless one of them says why', () => {
    // A bump for a rule that is not the course (3.0.0: the run economy) keeps the
    // geometry. Any other repeat is a fingerprint pasted under the wrong version.
    const reasoned = new Set(Object.keys(GEOMETRY_UNCHANGED));
    const hashes = Object.entries(OFFICIAL_GEOMETRY)
      .filter(([v]) => !reasoned.has(v))
      .map(([, h]) => h);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('the warm-up course carries the same version, as the generator writes it', () => {
    expect(readJson('data/courses/warmup.json').rulesVersion).toBe(version);
  });
});
