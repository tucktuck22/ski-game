import { describe, it, expect } from 'vitest';
import { computeStandings, pickLabel, type EntryView } from '../../src/state/ordering.js';

const entry = (over: Partial<EntryView> & { id: string; name: string }): EntryView => ({
  origin: 'organizer',
  claimed: true,
  practiceRunsUsed: 3,
  abandonedOfficialRuns: 0,
  removed: false,
  score: null,
  commitAt: null,
  outcome: null,
  ...over,
});

describe('bed-pick ordering', () => {
  it('ranks by score descending', () => {
    const s = computeStandings([
      entry({ id: 'a', name: 'Dave', score: 51000, commitAt: '2026-09-01T10:00:00Z', outcome: 'finished' }),
      entry({ id: 'b', name: 'Sam', score: 63000, commitAt: '2026-09-01T11:00:00Z', outcome: 'finished' }),
    ], false);
    expect(s.ranked.map((e) => e.name)).toEqual(['Sam', 'Dave']);
    expect(s.ranked[0]!.rank).toBe(1);
  });

  it('breaks ties by earlier commit time (FR-037)', () => {
    const s = computeStandings([
      entry({ id: 'a', name: 'Late', score: 50000, commitAt: '2026-09-01T12:00:00Z', outcome: 'finished' }),
      entry({ id: 'b', name: 'Early', score: 50000, commitAt: '2026-09-01T09:00:00Z', outcome: 'finished' }),
    ], false);
    expect(s.ranked.map((e) => e.name)).toEqual(['Early', 'Late']);
    expect(s.ranked.every((e) => !e.unresolvedTie)).toBe(true);
  });

  it('flags a tie that survives the timestamp as unresolved rather than guessing (FR-038)', () => {
    const t = '2026-09-01T09:00:00Z';
    const s = computeStandings([
      entry({ id: 'a', name: 'Dave', score: 50000, commitAt: t, outcome: 'finished' }),
      entry({ id: 'b', name: 'Sam', score: 50000, commitAt: t, outcome: 'finished' }),
    ], true);
    expect(s.ranked.every((e) => e.unresolvedTie)).toBe(true);
  });

  it('puts every uncommitted entry below every score, unordered, with no rank (FR-045)', () => {
    const s = computeStandings([
      entry({ id: 'a', name: 'Zach' }),
      entry({ id: 'b', name: 'Sam', score: 40000, commitAt: '2026-09-01T09:00:00Z', outcome: 'wiped_out' }),
      entry({ id: 'c', name: 'Al' }),
    ], true);
    expect(s.ranked.map((e) => e.name)).toEqual(['Sam']);
    expect(s.forfeits.map((e) => e.name).sort()).toEqual(['Al', 'Zach']);
    // The critical assertion: no order is implied among forfeits.
    expect(s.forfeits.every((e) => e.rank === null)).toBe(true);
    expect(s.forfeits.every((e) => e.forfeit)).toBe(true);
  });

  it('a wiped-out finisher still outranks anyone who never played', () => {
    const s = computeStandings([
      entry({ id: 'a', name: 'Crashed', score: 1200, commitAt: '2026-09-01T09:00:00Z', outcome: 'wiped_out' }),
      entry({ id: 'b', name: 'NoShow' }),
    ], true);
    expect(s.ranked[0]!.name).toBe('Crashed');
    expect(s.forfeits[0]!.name).toBe('NoShow');
  });

  it('excludes organizer-removed entries from both groups (FR-074)', () => {
    const s = computeStandings([
      entry({ id: 'a', name: 'NotOnTrip', score: 90000, commitAt: '2026-09-01T09:00:00Z', outcome: 'finished', removed: true }),
      entry({ id: 'b', name: 'Sam', score: 40000, commitAt: '2026-09-01T10:00:00Z', outcome: 'finished' }),
    ], true);
    expect(s.ranked.map((e) => e.name)).toEqual(['Sam']);
    expect(s.forfeits).toHaveLength(0);
  });

  it('labels rank 1 as picking first (FR-041)', () => {
    const s = computeStandings([
      entry({ id: 'a', name: 'Sam', score: 60000, commitAt: '2026-09-01T09:00:00Z', outcome: 'finished' }),
      entry({ id: 'b', name: 'Dave', score: 50000, commitAt: '2026-09-01T10:00:00Z', outcome: 'finished' }),
      entry({ id: 'c', name: 'Al' }),
    ], true);
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
