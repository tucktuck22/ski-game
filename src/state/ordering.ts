/**
 * Derives the bed-pick order.
 *
 * This is pure and lives apart from the storage client so it can be tested
 * without a server. The rules it encodes decide where eight people sleep, so
 * they get their own unit tests rather than being verified through the UI.
 */

export interface EntryView {
  id: string;
  name: string;
  origin: 'organizer' | 'self_created';
  claimed: boolean;
  practiceRunsUsed: number;
  abandonedOfficialRuns: number;
  removed: boolean;
  score: number | null;
  /** ISO timestamp assigned by shared storage, never by a device (FR-037). */
  commitAt: string | null;
  outcome: 'finished' | 'wiped_out' | null;
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
    .filter((e): e is EntryView & { score: number; commitAt: string } =>
      e.score !== null && e.commitAt !== null)
    .slice()
    .sort((a, b) => (b.score - a.score) || a.commitAt.localeCompare(b.commitAt));

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

/** Human-readable placement for the leaderboard, including the bed-pick framing. */
export function pickLabel(entry: RankedEntry): string {
  if (entry.forfeit) return 'FORFEIT — coin flip at the cabin';
  if (entry.rank === 1) return 'PICKS FIRST';
  return `PICK ${entry.rank}`;
}
