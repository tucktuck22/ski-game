import { describe, it, expect } from 'vitest';
import {
  bestAttempt,
  computeStandings,
  pickLabel,
  type EntryView,
} from '../../src/state/ordering.js';

const entry = (over: Partial<EntryView> & { id: string; name: string }): EntryView => ({
  origin: 'organizer',
  claimed: true,
  practiceRunsUsed: 3,
  officialAttemptsUsed: 0,
  removed: false,
  score: null,
  commitAt: null,
  outcome: null,
  ...over,
});

describe('bed-pick ordering', () => {
  it('ranks by score descending', () => {
    const s = computeStandings(
      [
        entry({
          id: 'a',
          name: 'Dave',
          score: 51000,
          commitAt: '2026-09-01T10:00:00Z',
          outcome: 'finished',
        }),
        entry({
          id: 'b',
          name: 'Sam',
          score: 63000,
          commitAt: '2026-09-01T11:00:00Z',
          outcome: 'finished',
        }),
      ],
      false,
    );
    expect(s.ranked.map((e) => e.name)).toEqual(['Sam', 'Dave']);
    expect(s.ranked[0]!.rank).toBe(1);
  });

  it('breaks ties by earlier commit time (FR-037)', () => {
    const s = computeStandings(
      [
        entry({
          id: 'a',
          name: 'Late',
          score: 50000,
          commitAt: '2026-09-01T12:00:00Z',
          outcome: 'finished',
        }),
        entry({
          id: 'b',
          name: 'Early',
          score: 50000,
          commitAt: '2026-09-01T09:00:00Z',
          outcome: 'finished',
        }),
      ],
      false,
    );
    expect(s.ranked.map((e) => e.name)).toEqual(['Early', 'Late']);
    expect(s.ranked.every((e) => !e.unresolvedTie)).toBe(true);
  });

  it('flags a tie that survives the timestamp as unresolved rather than guessing (FR-038)', () => {
    const t = '2026-09-01T09:00:00Z';
    const s = computeStandings(
      [
        entry({ id: 'a', name: 'Dave', score: 50000, commitAt: t, outcome: 'finished' }),
        entry({ id: 'b', name: 'Sam', score: 50000, commitAt: t, outcome: 'finished' }),
      ],
      true,
    );
    expect(s.ranked.every((e) => e.unresolvedTie)).toBe(true);
  });

  it('puts every uncommitted entry below every score, unordered, with no rank (FR-045)', () => {
    const s = computeStandings(
      [
        entry({ id: 'a', name: 'Zach' }),
        entry({
          id: 'b',
          name: 'Sam',
          score: 40000,
          commitAt: '2026-09-01T09:00:00Z',
          outcome: 'wiped_out',
        }),
        entry({ id: 'c', name: 'Al' }),
      ],
      true,
    );
    expect(s.ranked.map((e) => e.name)).toEqual(['Sam']);
    expect(s.forfeits.map((e) => e.name).sort()).toEqual(['Al', 'Zach']);
    // The critical assertion: no order is implied among forfeits.
    expect(s.forfeits.every((e) => e.rank === null)).toBe(true);
    expect(s.forfeits.every((e) => e.forfeit)).toBe(true);
  });

  it('a wiped-out finisher still outranks anyone who never played', () => {
    const s = computeStandings(
      [
        entry({
          id: 'a',
          name: 'Crashed',
          score: 1200,
          commitAt: '2026-09-01T09:00:00Z',
          outcome: 'wiped_out',
        }),
        entry({ id: 'b', name: 'NoShow' }),
      ],
      true,
    );
    expect(s.ranked[0]!.name).toBe('Crashed');
    expect(s.forfeits[0]!.name).toBe('NoShow');
  });

  it('excludes organizer-removed entries from both groups (FR-074)', () => {
    const s = computeStandings(
      [
        entry({
          id: 'a',
          name: 'NotOnTrip',
          score: 90000,
          commitAt: '2026-09-01T09:00:00Z',
          outcome: 'finished',
          removed: true,
        }),
        entry({
          id: 'b',
          name: 'Sam',
          score: 40000,
          commitAt: '2026-09-01T10:00:00Z',
          outcome: 'finished',
        }),
      ],
      true,
    );
    expect(s.ranked.map((e) => e.name)).toEqual(['Sam']);
    expect(s.forfeits).toHaveLength(0);
  });

  it('labels rank 1 as picking first (FR-041)', () => {
    const s = computeStandings(
      [
        entry({
          id: 'a',
          name: 'Sam',
          score: 60000,
          commitAt: '2026-09-01T09:00:00Z',
          outcome: 'finished',
        }),
        entry({
          id: 'b',
          name: 'Dave',
          score: 50000,
          commitAt: '2026-09-01T10:00:00Z',
          outcome: 'finished',
        }),
        entry({ id: 'c', name: 'Al' }),
      ],
      true,
    );
    expect(pickLabel(s.ranked[0]!, true)).toBe('PICKS FIRST');
    expect(pickLabel(s.ranked[1]!, true)).toBe('PICK 2');
    expect(pickLabel(s.forfeits[0]!, true)).toContain('coin flip');
  });

  it('does not call anyone a forfeit before the deadline', () => {
    // Seven people who simply have not played yet are not forfeits, and a board
    // they check daily should not say they are.
    const s = computeStandings([entry({ id: 'a', name: 'Zach' })], false);
    expect(pickLabel(s.forfeits[0]!, false)).toBe('NO SCORE YET');
    expect(pickLabel(s.forfeits[0]!, true)).toContain('FORFEIT');
  });
});

/**
 * DEFECT 2 (research R4). The Supabase client used to build its score lookup with
 * `new Map(rows.map((r) => [r.entry_id, r]))`, which keeps the LAST value per key.
 * Exact while an entry had one score; silently the wrong bed order the moment it
 * can have three — and since the query carried no ORDER BY, not even consistently
 * wrong, which is worse because it would not reproduce.
 */
describe('the best attempt is what counts (FR-232, FR-236, SC-086)', () => {
  const at = (attemptNo: number, score: number, commitAt: string) => ({
    attemptNo,
    score,
    commitAt,
    outcome: 'finished' as const,
  });

  it('returns null when no attempt has posted', () => {
    expect(bestAttempt([])).toBeNull();
  });

  it('picks the highest score regardless of the order rows arrive in (FR-232)', () => {
    const attempts = [
      at(1, 4000, '2026-09-01T10:00:00Z'),
      at(2, 2500, '2026-09-01T11:00:00Z'),
      at(3, 6100, '2026-09-01T12:00:00Z'),
    ];
    // Every permutation, because row order from the database is unspecified.
    const orderings = [
      attempts,
      [...attempts].reverse(),
      [attempts[1]!, attempts[2]!, attempts[0]!],
      [attempts[2]!, attempts[0]!, attempts[1]!],
    ];
    for (const rows of orderings) {
      expect(bestAttempt(rows)?.score).toBe(6100);
    }
  });

  it('a later, lower attempt never displaces a higher earlier one (FR-232)', () => {
    const best = bestAttempt([
      at(1, 6100, '2026-09-01T10:00:00Z'),
      at(2, 300, '2026-09-01T12:00:00Z'),
    ]);
    expect(best?.score).toBe(6100);
    expect(best?.attemptNo).toBe(1);
  });

  /**
   * FR-236, and SC-086 states the property it protects: a player must never be
   * ranked lower for having used an attempt he was entitled to.
   *
   * Carrying the LATEST attempt's timestamp would do exactly that — set a
   * winning mark on attempt one, take attempt two out of curiosity, and lose a
   * tiebreak already won.
   */
  it('carries the BEST attempt timestamp, not the most recent (FR-236, SC-086)', () => {
    const best = bestAttempt([
      at(1, 6100, '2026-09-01T10:00:00Z'),
      at(2, 2500, '2026-09-01T23:00:00Z'),
    ]);
    expect(best?.commitAt).toBe('2026-09-01T10:00:00Z');
  });

  it('resolves a player tying with himself to the earlier attempt (FR-236)', () => {
    const best = bestAttempt([
      at(2, 4000, '2026-09-01T12:00:00Z'),
      at(1, 4000, '2026-09-01T10:00:00Z'),
    ]);
    expect(best?.attemptNo).toBe(1);
    expect(best?.commitAt).toBe('2026-09-01T10:00:00Z');
  });

  it('does not disadvantage a player in a head-to-head tiebreak for taking an extra attempt (SC-086)', () => {
    // Both peak at 4,000. Dave got there first and then used a third attempt he
    // was entitled to; Sam stopped. Dave must still win the tiebreak.
    const dave = bestAttempt([
      at(1, 4000, '2026-09-01T10:00:00Z'),
      at(2, 1200, '2026-09-01T20:00:00Z'),
    ])!;
    const sam = bestAttempt([at(1, 4000, '2026-09-01T11:00:00Z')])!;
    const standings = computeStandings(
      [
        entry({
          id: 'd',
          name: 'Dave',
          score: dave.score,
          commitAt: dave.commitAt,
          officialAttemptsUsed: 2,
        }),
        entry({
          id: 's',
          name: 'Sam',
          score: sam.score,
          commitAt: sam.commitAt,
          officialAttemptsUsed: 1,
        }),
      ],
      true,
    );
    expect(standings.ranked.map((r) => r.name)).toEqual(['Dave', 'Sam']);
    expect(standings.ranked[0]?.unresolvedTie).toBe(false);
  });
});
