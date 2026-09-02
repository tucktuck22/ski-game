/**
 * The run economy: three practice runs, one official run.
 *
 * Every count here comes from shared storage (FR-021). Nothing on this device
 * decides whether a run happened — that is what would hand a player a fresh
 * official run by switching devices, which US2 exists to prevent.
 */
import type { EntryView } from './ordering.js';

export const PRACTICE_RUNS = 3;

export type RunKind = 'practice' | 'official' | 'free';

export interface RunAvailability {
  practiceRemaining: number;
  officialAvailable: boolean;
  freePlayOnly: boolean;
  /** Why the official run is unavailable, for the UI to say plainly. */
  blockedReason: string | null;
}

export function availability(entry: EntryView, draftFinal: boolean): RunAvailability {
  const practiceRemaining = Math.max(0, PRACTICE_RUNS - entry.practiceRunsUsed);
  const committed = entry.score !== null;

  if (committed) {
    return {
      practiceRemaining: 0,
      officialAvailable: false,
      freePlayOnly: true,
      blockedReason: 'Your official run is committed. Nothing else counts.',
    };
  }
  if (draftFinal) {
    return {
      practiceRemaining,
      officialAvailable: false,
      freePlayOnly: true,
      blockedReason: 'The deadline has passed. The leaderboard is FINAL.',
    };
  }
  // FR-015: a player may go official early. Unused practice is simply forfeited.
  return { practiceRemaining, officialAvailable: true, freePlayOnly: false, blockedReason: null };
}

/** Which course a run uses. FR-068: the official course is unreachable before commit. */
export function courseFor(kind: RunKind, committed: boolean): 'warmup' | 'official' {
  if (kind === 'official') return 'official';
  if (kind === 'free' && committed) return 'official';
  return 'warmup';
}
