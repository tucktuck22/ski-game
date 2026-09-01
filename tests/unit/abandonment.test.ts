import { describe, it, expect } from 'vitest';
import { detectAbandonment, isWithinResumeGrace, RESUME_GRACE_MS } from '../../src/state/abandonment.js';

describe('abandonment detection (FR-019, FR-065, ADR-0002)', () => {
  it('counts a started run with no commit as abandoned', () => {
    const r = detectAbandonment({
      officialRunStartedAt: '2026-09-01T10:00:00Z', score: null, abandonedOfficialRuns: 0,
    });
    expect(r).toEqual({ abandoned: true, newCount: 1 });
  });

  it('does not count a run that committed', () => {
    const r = detectAbandonment({
      officialRunStartedAt: '2026-09-01T10:00:00Z', score: 51000, abandonedOfficialRuns: 2,
    });
    expect(r).toEqual({ abandoned: false, newCount: 2 });
  });

  it('does not count a player who never started an official run', () => {
    const r = detectAbandonment({ officialRunStartedAt: null, score: null, abandonedOfficialRuns: 0 });
    expect(r).toEqual({ abandoned: false, newCount: 0 });
  });

  it('accumulates across repeated abandonments, which ADR-0002 permits without limit', () => {
    let count = 0;
    for (let i = 0; i < 5; i++) {
      count = detectAbandonment({
        officialRunStartedAt: '2026-09-01T10:00:00Z', score: null, abandonedOfficialRuns: count,
      }).newCount;
    }
    expect(count).toBe(5);
  });

  it('treats a quick reload as a resume rather than a bail', () => {
    // Detection must not punish a browser crash the same as a deliberate
    // reroll: the counter is evidence, and evidence has to be accurate.
    const now = Date.parse('2026-09-01T10:00:05Z');
    expect(isWithinResumeGrace('2026-09-01T10:00:00Z', now)).toBe(true);
    expect(isWithinResumeGrace('2026-09-01T09:00:00Z', now)).toBe(false);
  });

  it('has a grace window short enough that it cannot be used to shop for a good start', () => {
    // A long grace would let a player restart repeatedly for free and unseen.
    expect(RESUME_GRACE_MS).toBeLessThanOrEqual(30_000);
  });
});
