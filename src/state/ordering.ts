/**
 * Derives the bed-pick order.
 *
 * This is pure and lives apart from the storage client so it can be tested
 * without a server. The rules it encodes decide where eight people sleep, so
 * they get their own unit tests rather than being verified through the UI.
 */

/**
 * One official attempt that reached an end state and posted a score.
 *
 * An ABANDONED attempt has no record at all. It is visible only as a gap:
 * `officialAttemptsUsed` advanced and no attempt arrived. That is deliberate -
 * the counter moves when the run STARTS (FR-234), so an attempt costs
 * something without anyone having to detect the abandonment, which is
 * impossible to do reliably when the tab is killed.
 */
export interface AttemptRecord {
  /** 1-based. Unique per entry, which is also what makes a commit retry safe. */
  attemptNo: number;
  score: number;
  /** ISO timestamp assigned by shared storage, never by a device (FR-037). */
  commitAt: string;
  outcome: 'finished' | 'wiped_out';
}

export interface EntryView {
  id: string;
  name: string;
  origin: 'organizer' | 'self_created';
  claimed: boolean;
  practiceRunsUsed: number;
  /**
   * How many of this name's official attempts are spent (FR-231, FR-235).
   *
   * Advanced the moment a run STARTS, not when it ends (FR-234), which is what
   * makes an abandoned attempt cost one. It replaces the old binary
   * `officialStatus`, which could say "used" but never "one spent, two left".
   *
   * Compared against `officialAttempts` from tuning, never against a literal 3:
   * the allowance is a tuning value so play can move it (FR-245).
   */
  officialAttemptsUsed: number;
  removed: boolean;
  /**
   * The BEST attempt's score, not the most recent (FR-232). Null until one
   * attempt has posted.
   */
  score: number | null;
  /**
   * The best attempt's commit time - the one that supplies the tiebreak
   * (FR-236). Deliberately NOT the latest attempt's: using that would let a
   * player lose a tiebreak he had already won by taking an attempt he was
   * entitled to.
   */
  commitAt: string | null;
  outcome: 'finished' | 'wiped_out' | null;
}

/**
 * Reduces an entry's attempts to the one that counts.
 *
 * Highest score wins; a tie between a player's own attempts resolves to the
 * EARLIER one, so the timestamp carried into the tiebreak is the moment he
 * first reached that score (FR-232, FR-236).
 *
 * This is pure and lives here rather than in the storage client so both
 * backends share one definition and it can be tested without a server. Reading
 * the rows into a Map keyed by entry - which is what the Supabase client used
 * to do - silently keeps whichever row came back LAST, and with no ORDER BY
 * that is not even consistently wrong.
 */
export function bestAttempt(attempts: readonly AttemptRecord[]): AttemptRecord | null {
  let best: AttemptRecord | null = null;
  for (const a of attempts) {
    if (best === null) {
      best = a;
      continue;
    }
    if (a.score > best.score) best = a;
    else if (a.score === best.score && a.commitAt < best.commitAt) best = a;
  }
  return best;
}

export interface RankedEntry extends EntryView {
  /** 1-based. Null for forfeits, which are deliberately unordered (FR-045). */
  rank: number | null;
  forfeit: boolean;
  /** True when score and commit time both tie: resolve by coin flip (FR-038). */
  unresolvedTie: boolean;
}

export interface Standings {
  ranked: RankedEntry[];
  /** Unordered. The system must not invent an order among these (FR-045). */
  forfeits: RankedEntry[];
  final: boolean;
}

/**
 * Ranks committed scores, then groups everyone else as forfeits.
 *
 * Ordering: score descending, then earlier commit_at first (FR-037). A tie that
 * survives both is reported as unresolved rather than broken arbitrarily
 * (FR-038) - the cabin flips a coin, the software does not guess.
 */
export function computeStandings(entries: readonly EntryView[], final: boolean): Standings {
  const live = entries.filter((e) => !e.removed);

  const committed = live
    .filter(
      (e): e is EntryView & { score: number; commitAt: string } =>
        e.score !== null && e.commitAt !== null,
    )
    .slice()
    .sort((a, b) => b.score - a.score || a.commitAt.localeCompare(b.commitAt));

  const ranked: RankedEntry[] = committed.map((e, i) => {
    const prev = committed[i - 1];
    const next = committed[i + 1];
    const tiedWith = (o: typeof e | undefined): boolean =>
      o !== undefined && o.score === e.score && o.commitAt === e.commitAt;
    return {
      ...e,
      rank: i + 1,
      forfeit: false,
      unresolvedTie: tiedWith(prev) || tiedWith(next),
    };
  });

  // FR-045: below every committed score, marked FORFEIT, as an unordered group.
  // No rank is assigned. Sorting them by name would imply an order that does
  // not exist and that the group has agreed to settle with a coin flip.
  const forfeits: RankedEntry[] = live
    .filter((e) => e.score === null || e.commitAt === null)
    .map((e) => ({ ...e, rank: null, forfeit: true, unresolvedTie: false }));

  return { ranked, forfeits, final };
}

/**
 * Human-readable placement for the leaderboard.
 *
 * Forfeit only means something once the draft is FINAL. Before the deadline an
 * entry without a score has not forfeited anything - he simply has not played
 * yet, and telling seven people they have forfeited on a board they check daily
 * is both wrong and needlessly alarming.
 */
export function pickLabel(entry: RankedEntry, final: boolean): string {
  if (entry.forfeit) return final ? 'FORFEIT — coin flip at the cabin' : 'NO SCORE YET';
  if (entry.rank === 1) return 'PICKS FIRST';
  return `PICK ${entry.rank}`;
}
