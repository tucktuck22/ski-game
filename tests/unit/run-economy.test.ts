import { describe, it, expect } from 'vitest';
import {
  attemptsRemaining,
  availability,
  courseFor,
  isFinished,
  PRACTICE_RUNS,
} from '../../src/state/runEconomy.js';
import type { EntryView } from '../../src/state/ordering.js';

/**
 * The allowance is a tuning value (FR-245), so these tests pass it in rather
 * than importing a constant. ATTEMPTS is what data/tuning.json ships today; the
 * cases below that matter are written against the parameter, not the number, so
 * a playtest that moves it to 2 does not silently invalidate them.
 */
const ATTEMPTS = 3;

const entry = (over: Partial<EntryView> = {}): EntryView => ({
  id: 'e',
  name: 'Dave',
  origin: 'organizer',
  claimed: true,
  practiceRunsUsed: 0,
  officialAttemptsUsed: 0,
  removed: false,
  score: null,
  commitAt: null,
  outcome: null,
  ...over,
});

describe('run economy: three practice runs, best of N official (FR-231, FR-245)', () => {
  it('gives three practice runs and the full attempt allowance', () => {
    const a = availability(entry(), false, ATTEMPTS);
    expect(a.practiceRemaining).toBe(PRACTICE_RUNS);
    expect(a.officialAttemptsRemaining).toBe(ATTEMPTS);
    expect(a.officialAvailable).toBe(true);
  });

  it('reads the allowance from the value it is given, not from a hardcoded 3 (FR-245)', () => {
    // The whole point of moving it into tuning.json: a playtest can change this
    // number without a code change or a migration (research R10).
    expect(availability(entry(), false, 2).officialAttemptsRemaining).toBe(2);
    expect(availability(entry({ officialAttemptsUsed: 2 }), false, 2).officialAvailable).toBe(
      false,
    );
    expect(availability(entry({ officialAttemptsUsed: 2 }), false, 5).officialAvailable).toBe(true);
  });

  it('counts attempts down one at a time and keeps the run available (FR-231)', () => {
    for (let used = 0; used < ATTEMPTS; used++) {
      const a = availability(entry({ officialAttemptsUsed: used }), false, ATTEMPTS);
      expect(a.officialAttemptsRemaining).toBe(ATTEMPTS - used);
      expect(a.officialAvailable).toBe(true);
    }
  });

  it('lets a player go official early, forfeiting unused practice (FR-015)', () => {
    expect(availability(entry({ practiceRunsUsed: 1 }), false, ATTEMPTS).officialAvailable).toBe(
      true,
    );
  });

  /**
   * FR-238, AND IT IS THE POINT OF THE FEATURE. A wipeout commits its score
   * immediately and irreversibly — but "irreversible" attaches to the ATTEMPT,
   * not to the player's standing. One bad run no longer ends his draft.
   */
  it('leaves the remaining attempts available after a wipeout (FR-238)', () => {
    const afterWipeout = entry({
      officialAttemptsUsed: 1,
      score: 300,
      commitAt: '2026-09-01T10:00:00Z',
      outcome: 'wiped_out',
    });
    const a = availability(afterWipeout, false, ATTEMPTS);
    expect(a.officialAvailable).toBe(true);
    expect(a.officialAttemptsRemaining).toBe(2);
    expect(a.freePlayOnly).toBe(false);
    expect(isFinished(afterWipeout, ATTEMPTS)).toBe(false);
  });

  it('offers only free play once every attempt is spent (FR-231, FR-240)', () => {
    const a = availability(
      entry({ officialAttemptsUsed: ATTEMPTS, score: 51000, commitAt: '2026-09-01T10:00:00Z' }),
      false,
      ATTEMPTS,
    );
    expect(a.officialAvailable).toBe(false);
    expect(a.freePlayOnly).toBe(true);
    expect(a.blockedReason).toContain('best score stands');
  });

  /**
   * THE ABANDONMENT CASE (FR-233). An attempt that started and never ended posts
   * no score at all, so the COUNTER is the only record it happened. Reading only
   * the score — which is what the pre-007 code did — would hand the player the
   * button back, which is the unfairness this feature exists to close.
   */
  it('spends an attempt that started and never ended (FR-233, FR-234)', () => {
    const abandonedOnce = entry({ officialAttemptsUsed: 1, score: null });
    expect(attemptsRemaining(abandonedOnce, ATTEMPTS)).toBe(2);

    const abandonedAll = entry({ officialAttemptsUsed: ATTEMPTS, score: null });
    const a = availability(abandonedAll, false, ATTEMPTS);
    expect(a.officialAvailable).toBe(false);
    // FR-242: a forfeit, same as never playing — but say which situation it is,
    // because "no score reached the board" is the one that may need the organizer.
    expect(a.blockedReason).toContain('no score reached the board');
  });

  it('refuses an official attempt after the deadline (FR-043, FR-241)', () => {
    const a = availability(entry(), true, ATTEMPTS);
    expect(a.officialAvailable).toBe(false);
    expect(a.blockedReason).toContain('FINAL');
  });

  it('never yields negative counts even if storage says something odd', () => {
    expect(availability(entry({ practiceRunsUsed: 99 }), false, ATTEMPTS).practiceRemaining).toBe(
      0,
    );
    expect(attemptsRemaining(entry({ officialAttemptsUsed: 99 }), ATTEMPTS)).toBe(0);
  });

  /**
   * FR-068 at attempt granularity (FR-244). Free play must not reach the official
   * course after the FIRST attempt commits — that would hand the player his
   * remaining attempts as rehearsed runs, which is the surprise this rule
   * protects, spent for nothing.
   */
  it('keeps the official course unreachable until every attempt is spent (FR-068, FR-244)', () => {
    expect(courseFor('practice', false)).toBe('warmup');
    expect(courseFor('free', false)).toBe('warmup');
    expect(courseFor('official', false)).toBe('official');
    expect(courseFor('free', true)).toBe('official');

    const midCompetition = entry({ officialAttemptsUsed: 1, score: 4000 });
    expect(isFinished(midCompetition, ATTEMPTS)).toBe(false);
    expect(courseFor('free', isFinished(midCompetition, ATTEMPTS))).toBe('warmup');
    expect(courseFor('practice', isFinished(midCompetition, ATTEMPTS))).toBe('warmup');
  });
});
