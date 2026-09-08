/**
 * Turns a refused commit into something a person can act on.
 *
 * WHY THIS EXISTS. When the database refuses an official score the player got
 * one line of yellow text at the bottom of the panel carrying the raw Postgres
 * message — "rules version mismatch: draft is 1.0.0, submission is 1.6.0". That
 * sentence names the cause exactly and means nothing to the person reading it,
 * who is standing in a lodge wondering why his run vanished. It was reported to
 * us not as "the game said rules version mismatch" but as "the commit is not
 * working", which is how far that message travelled.
 *
 * A refusal is the one outcome here that a player cannot fix by waiting, so it
 * has to say who can fix it and how.
 */

export interface CommitFailure {
  headline: string;
  detail: string;
  /** The raw message from shared storage, kept verbatim for the organizer. */
  raw: string;
}

export function explainRejection(reason: string): CommitFailure {
  const r = reason.toLowerCase();

  if (r.includes('rules version mismatch')) {
    return {
      headline: 'THE DRAFT REFUSED THIS SCORE — IT IS NOT YOUR FAULT.',
      detail:
        'The draft is pinned to an older version of the game than the one you just ' +
        'played. Nobody can post a score until the organizer fixes it. Show him this ' +
        'screen: he needs to run supabase/migrations/0004_rules_freeze.sql in the ' +
        'Supabase SQL editor, and then you take your run again.',
      raw: reason,
    };
  }
  if (r.includes('already') || r.includes('duplicate') || r.includes('unique')) {
    return {
      headline: 'THIS NAME HAS ALREADY POSTED ITS OFFICIAL RUN.',
      detail:
        'A score for this name is already on the board and it cannot be replaced ' +
        '(FR-018). If that score is not yours, the organizer can remove the entry.',
      raw: reason,
    };
  }
  if (r.includes('deadline')) {
    return {
      headline: 'THE DEADLINE PASSED BEFORE THIS SCORE LANDED.',
      detail:
        'The board is FINAL, so this run cannot be posted. Only the organizer can ' +
        'move the deadline.',
      raw: reason,
    };
  }
  if (r.includes('permission denied') || r.includes('policy')) {
    return {
      headline: 'THE DATABASE REFUSED THE WRITE.',
      detail:
        'This is a setup problem, not a game problem. The organizer should re-run ' +
        'supabase/setup.sql, which grants what the game needs.',
      raw: reason,
    };
  }
  return {
    headline: 'THE DRAFT REFUSED THIS SCORE.',
    detail:
      'Retrying will not help — the refusal is permanent. Show the organizer the ' +
      'message below.',
    raw: reason,
  };
}
