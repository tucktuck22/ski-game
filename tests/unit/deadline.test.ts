import { describe, it, expect } from 'vitest';
import {
  deadlineState,
  canStartOfficialRun,
  canCommit,
  formatRemaining,
  COMMIT_GRACE_MS,
} from '../../src/state/deadline.js';

const DEADLINE = '2026-09-10T23:00:00Z';
const at = (iso: string): number => Date.parse(iso);

describe('deadline (FR-043, FR-044)', () => {
  it('is open before the deadline', () => {
    const d = deadlineState(DEADLINE, null, at('2026-09-09T12:00:00Z'), null);
    expect(d.final).toBe(false);
    expect(canStartOfficialRun(d)).toBe(true);
    expect(canCommit(d)).toBe(true);
  });

  it('refuses a NEW official run once the deadline passes (FR-043)', () => {
    const d = deadlineState(DEADLINE, null, at('2026-09-10T23:00:01Z'), null);
    expect(d.final).toBe(true);
    expect(canStartOfficialRun(d)).toBe(false);
  });

  it('lets a run started before the deadline finish and commit after it (FR-044)', () => {
    const d = deadlineState(DEADLINE, null, at('2026-09-10T23:02:00Z'), '2026-09-10T22:58:00Z');
    expect(d.final).toBe(true);
    expect(canStartOfficialRun(d)).toBe(false);
    expect(canCommit(d)).toBe(true);
  });

  it('closes the grace window so it cannot be used to play on indefinitely', () => {
    const justPast = at('2026-09-10T23:00:00Z') + COMMIT_GRACE_MS + 1000;
    const d = deadlineState(DEADLINE, null, justPast, '2026-09-10T22:58:00Z');
    expect(canCommit(d)).toBe(false);
  });

  it('gives no grace to a run that started after the deadline', () => {
    const d = deadlineState(DEADLINE, null, at('2026-09-10T23:02:00Z'), '2026-09-10T23:01:00Z');
    expect(canCommit(d)).toBe(false);
  });

  it('respects an explicit finalizedAt even before the clock says so', () => {
    const d = deadlineState(DEADLINE, '2026-09-05T00:00:00Z', at('2026-09-01T00:00:00Z'), null);
    expect(d.final).toBe(true);
  });

  it('formats the time remaining for the board', () => {
    expect(formatRemaining(0)).toBe('FINAL');
    expect(formatRemaining(3 * 86_400_000 + 4 * 3_600_000)).toBe('3d 4h left');
    expect(formatRemaining(2 * 3_600_000 + 30 * 60_000)).toBe('2h 30m left');
    expect(formatRemaining(45 * 60_000)).toBe('45m left');
  });
});
