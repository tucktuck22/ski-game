/**
 * Deadline handling (FR-043, FR-044).
 *
 * The comparison uses the server's clock, never the device's. FR-037 makes
 * commit time the tiebreaker for the bed order, so a player who noticed his own
 * clock was authoritative would have a way to change where he sleeps.
 */

export interface DeadlineState {
  final: boolean;
  /** A run started before the deadline may finish and commit after it (FR-044). */
  graceForRunInProgress: boolean;
  msRemaining: number;
}

/** Matches the server-side trigger's allowance in 0001_init.sql. */
export const COMMIT_GRACE_MS = 5 * 60 * 1000;

export function deadlineState(
  deadlineIso: string,
  finalizedAt: string | null,
  serverNowMs: number,
  runStartedAtIso: string | null,
): DeadlineState {
  const deadline = Date.parse(deadlineIso);
  const passed = finalizedAt !== null || serverNowMs > deadline;
  const startedBefore = runStartedAtIso !== null && Date.parse(runStartedAtIso) <= deadline;
  return {
    final: passed,
    graceForRunInProgress: passed && startedBefore && serverNowMs <= deadline + COMMIT_GRACE_MS,
    msRemaining: Math.max(0, deadline - serverNowMs),
  };
}

/** Whether an official run may START. A run in progress is governed by the grace above. */
export const canStartOfficialRun = (d: DeadlineState): boolean => !d.final;

/** Whether a commit may be ACCEPTED. */
export const canCommit = (d: DeadlineState): boolean => !d.final || d.graceForRunInProgress;

export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'FINAL';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${Math.floor((ms % 3_600_000) / 60_000)}m left`;
  return `${Math.floor(ms / 60_000)}m left`;
}
