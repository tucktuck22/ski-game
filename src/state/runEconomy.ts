/**
 * The run economy: three practice runs, and a best-of-N official competition.
 *
 * Every count here comes from shared storage (FR-021). Nothing on this device
 * decides whether a run happened — that is what would hand a player a fresh
 * official run by switching devices, which US2 exists to prevent.
 */
import type { EntryView } from './ordering.js';

export const PRACTICE_RUNS = 3;

/**
 * NOTE ON WHERE THE TWO ALLOWANCES LIVE.
 *
 * PRACTICE_RUNS is a constant here; the official allowance is `officialAttempts`
 * in data/tuning.json and is passed in. That asymmetry is deliberate and
 * recorded (research R10): feature 007 moved the official allowance into data
 * because Principle III requires it and because the playtest is expected to move
 * it, while FR-244 holds the practice allowance unchanged and moving it would
 * reach into feature 001. It wants a follow-up change of its own.
 */

export type RunKind = 'practice' | 'official' | 'free';

export interface RunAvailability {
  practiceRemaining: number;
  /** How many official attempts are left, 0..officialAttempts (FR-231). */
  officialAttemptsRemaining: number;
  officialAvailable: boolean;
  freePlayOnly: boolean;
  /** Why the official run is unavailable, for the UI to say plainly. */
  blockedReason: string | null;
}

/**
 * Whether this name's official competition is over.
 *
 * Two ways in, and the second is the one that was missing before feature 007's
 * ancestor bug: a score on the board is the obvious one, but the attempt
 * COUNTER is what closes a run whose commit is still queued in the outbox or
 * was refused by the database. Reading only the score is what produced the
 * reported bug - the run ended, the insert failed, no score row appeared, and
 * every screen concluded the run had never happened.
 *
 * Under best-of-N the counter carries even more: an ABANDONED attempt posts no
 * score at all (FR-233), so the counter is the only record it happened.
 */
export const isFinished = (entry: EntryView, officialAttempts: number): boolean =>
  entry.officialAttemptsUsed >= officialAttempts;

export const attemptsRemaining = (entry: EntryView, officialAttempts: number): number =>
  Math.max(0, officialAttempts - entry.officialAttemptsUsed);

export function availability(
  entry: EntryView,
  draftFinal: boolean,
  officialAttempts: number,
): RunAvailability {
  const practiceRemaining = Math.max(0, PRACTICE_RUNS - entry.practiceRunsUsed);
  const remaining = attemptsRemaining(entry, officialAttempts);

  if (remaining === 0) {
    return {
      practiceRemaining: 0,
      officialAttemptsRemaining: 0,
      officialAvailable: false,
      freePlayOnly: true,
      blockedReason:
        entry.score !== null
          ? `All ${officialAttempts} official attempts are used. Your best score stands.`
          : // Every attempt spent and nothing on the board: either all of them
            // were abandoned (FR-242 - a forfeit, same as never playing) or a
            // commit has not landed yet. Say so rather than implying a score.
            `All ${officialAttempts} official attempts are used, and no score reached the board.`,
    };
  }
  if (draftFinal) {
    return {
      practiceRemaining,
      officialAttemptsRemaining: remaining,
      officialAvailable: false,
      freePlayOnly: true,
      blockedReason: 'The deadline has passed. The leaderboard is FINAL.',
    };
  }
  // FR-015: a player may go official early. Unused practice is simply forfeited.
  // FR-240: so are unused attempts, at the deadline, with no ceremony - taking
  // another can never lower his standing, so there is nothing to protect him from.
  return {
    practiceRemaining,
    officialAttemptsRemaining: remaining,
    officialAvailable: true,
    freePlayOnly: false,
    blockedReason: null,
  };
}

/**
 * Which course a run uses.
 *
 * FR-068, restated at attempt granularity (FR-244): the official course stays
 * unreachable in practice and free play until the player's official attempts are
 * DONE - not until his first one commits. Letting free play onto it after
 * attempt one would hand him the remaining two as rehearsed runs.
 */
export function courseFor(kind: RunKind, finished: boolean): 'warmup' | 'official' {
  if (kind === 'official') return 'official';
  if (kind === 'free' && finished) return 'official';
  return 'warmup';
}
