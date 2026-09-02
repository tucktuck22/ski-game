import { describe, it, expect } from 'vitest';
import { availability, courseFor, PRACTICE_RUNS } from '../../src/state/runEconomy.js';
import type { EntryView } from '../../src/state/ordering.js';

const entry = (over: Partial<EntryView> = {}): EntryView => ({
  id: 'e', name: 'Dave', origin: 'organizer', claimed: true,
  practiceRunsUsed: 0, abandonedOfficialRuns: 0, removed: false,
  score: null, commitAt: null, outcome: null, ...over,
});

describe('run economy (FR-013 to FR-020)', () => {
  it('gives exactly three practice runs and one official', () => {
    const a = availability(entry(), false);
    expect(a.practiceRemaining).toBe(PRACTICE_RUNS);
    expect(a.officialAvailable).toBe(true);
  });

  it('lets a player go official early, forfeiting unused practice (FR-015)', () => {
    expect(availability(entry({ practiceRunsUsed: 1 }), false).officialAvailable).toBe(true);
  });

  it('offers only free play once the official run is committed (FR-018, FR-020)', () => {
    const a = availability(entry({ score: 51000, commitAt: '2026-09-01T10:00:00Z' }), false);
    expect(a.officialAvailable).toBe(false);
    expect(a.freePlayOnly).toBe(true);
    expect(a.blockedReason).toContain('committed');
  });

  it('refuses an official run after the deadline (FR-043)', () => {
    const a = availability(entry(), true);
    expect(a.officialAvailable).toBe(false);
    expect(a.blockedReason).toContain('FINAL');
  });

  it('never yields negative practice runs even if storage says something odd', () => {
    expect(availability(entry({ practiceRunsUsed: 99 }), false).practiceRemaining).toBe(0);
  });

  it('keeps the official course unreachable until the official run (FR-068)', () => {
    expect(courseFor('practice', false)).toBe('warmup');
    expect(courseFor('free', false)).toBe('warmup');
    expect(courseFor('official', false)).toBe('official');
    // Only after committing does free play get the official course.
    expect(courseFor('free', true)).toBe('official');
  });
});
