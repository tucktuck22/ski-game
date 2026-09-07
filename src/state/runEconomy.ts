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

/**
 * Whether this name's official run is spent.
 *
 * TWO SOURCES, BOTH FROM SHARED STORAGE, AND THE SECOND IS THE POINT.
 * A score on the board is the obvious one. `officialStatus` is the one that was
 * missing: it is set when the run ENDS (FR-017), so a commit still queued in the
 * outbox — or one the database refused — still closes the official run.
 *
 * Reading only the score is what produced the reported bug. The run ended, the
 * insert was refused, no score row appeared, and every screen therefore
 * concluded the official run had never happened: OFFICIAL RUN came back live and
 * the player could take it again, and again.
 */
export const hasCommitted = (entry: EntryView): boolean =>
  entry.score !== null || entry.officialStatus === 'committed';

export function availability(entry: EntryView, draftFinal: boolean): RunAvailability {
  const practiceRemaining = Math.max(0, PRACTICE_RUNS - entry.practiceRunsUsed);
  const committed = hasCommitted(entry);

  if (committed) {
    return {
      practiceRemaining: 0,
      officialAvailable: false,
      freePlayOnly: true,
      blockedReason:
        entry.score !== null
          ? 'Your official run is committed. Nothing else counts.'
          : // Ended, so it is spent (FR-017), but the score is not on the board
            // yet. Say which, because the two are not the same situation and the
            // second one may need the organizer.
            'Your official run is over. The score has not reached the board yet — see below.',
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
