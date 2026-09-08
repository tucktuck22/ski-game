import { describe, it, expect } from 'vitest';
import {
  availability,
  courseFor,
  hasCommitted,
  PRACTICE_RUNS,
} from '../../src/state/runEconomy.js';
import type { EntryView } from '../../src/state/ordering.js';

const entry = (over: Partial<EntryView> = {}): EntryView => ({
  id: 'e',
  name: 'Dave',
  origin: 'organizer',
  claimed: true,
  practiceRunsUsed: 0,
  officialStatus: 'unused',
  removed: false,
  score: null,
  commitAt: null,
  outcome: null,
  ...over,
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

  /**
   * THE REGRESSION. An official run that ended but whose score never reached
   * the board — queued behind a dead connection, or refused outright — used to
   * leave `score` null, and availability() read nothing else. So the run looked
   * untaken: OFFICIAL RUN came back live and the player could take it again,
   * which is FR-018 defeated by a failed insert.
   */
  it('spends the official run at run end, not when the score row appears (FR-017, FR-018)', () => {
    const a = availability(entry({ officialStatus: 'committed', score: null }), false);
    expect(a.officialAvailable).toBe(false);
    expect(a.practiceRemaining).toBe(0);
    expect(a.freePlayOnly).toBe(true);
    // And it says which of the two situations this is, because only one of them
    // needs the organizer.
    expect(a.blockedReason).toContain('not reached the board');
  });

  it('sends free play to the official course as soon as the run is spent (FR-068)', () => {
    expect(hasCommitted(entry({ officialStatus: 'committed', score: null }))).toBe(true);
    expect(hasCommitted(entry({ score: 51000 }))).toBe(true);
    expect(hasCommitted(entry())).toBe(false);
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
