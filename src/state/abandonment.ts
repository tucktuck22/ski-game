/**
 * Abandonment detection.
 *
 * ADR-0002 chose to allow unlimited restarts of an abandoned official run and
 * to make the count public instead of blocking it (FR-019, FR-065). The
 * deterrent is social, not technical, which only works if the count is
 * accurate — so detection has to survive the cases where abandonment actually
 * happens: a killed tab, a dead battery, a force-quit browser.
 *
 * None of those fire an unload handler. So the state is inverted: mark the run
 * as started, and treat a start with no commit as an abandonment, discovered on
 * the next load. That is robust to every one of those cases and works across
 * devices, which an unload handler could never do.
 */

export interface AbandonmentCheck {
  /** True when a previous official run was started and never committed. */
  abandoned: boolean;
  newCount: number;
}

export function detectAbandonment(entry: {
  officialRunStartedAt: string | null;
  score: number | null;
  abandonedOfficialRuns: number;
}): AbandonmentCheck {
  const startedButNeverCommitted = entry.officialRunStartedAt !== null && entry.score === null;
  return {
    abandoned: startedButNeverCommitted,
    newCount: entry.abandonedOfficialRuns + (startedButNeverCommitted ? 1 : 0),
  };
}

/**
 * Whether a run in progress should still be considered live rather than
 * abandoned. A player who reloads mid-run within the grace window is resuming,
 * not bailing — counting that as an abandonment would punish a browser crash
 * the same as a deliberate reroll, and the counter is meant to be evidence.
 */
export const RESUME_GRACE_MS = 15_000;

export function isWithinResumeGrace(startedAt: string, now: number): boolean {
  return now - Date.parse(startedAt) < RESUME_GRACE_MS;
}
