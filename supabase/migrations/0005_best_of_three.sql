-- FR-231, FR-233, FR-237, FR-245: three attempts on the official course, best
-- one counts, and starting one spends it.
--
-- SAFE TO RUN ON ITS OWN against a project already holding a draft. The README
-- documents organizers pasting single migrations (0003 and 0004 both went out
-- that way), so this backfills rather than assuming an empty table.
--
-- WHAT CHANGES, AND WHY EACH ONE:
--
--   1. roster_entry.official_attempts_used replaces the binary official_status.
--      A boolean can say "used" but never "one spent, two left".
--
--   2. committed_score.attempt_no, with UNIQUE (draft_id, entry_id, attempt_no)
--      replacing UNIQUE (draft_id, entry_id).
--
--      THE OLD INDEX WAS DOING TWO JOBS AND ONLY ONE OF THEM WAS WRITTEN DOWN.
--      The stated job was the one-run rule. The unstated one is IDEMPOTENCY:
--      the client retries a commit until the server confirms it, and has no way
--      to tell a retry from a new submission. When an insert succeeds and its
--      response is lost, the retry collides, is classified as permanently
--      rejected, and is dropped - which is the correct outcome. Drop that index
--      without replacing it and the same retry posts a PHANTOM attempt, quietly
--      spending one of the player's three. Keying on the attempt keeps the
--      collision exactly where it was.
--
--   3. The CHECK on attempt_no is a SANITY RAIL, NOT THE ALLOWANCE.
--      The allowance is officialAttempts in data/tuning.json (FR-245). If this
--      constraint said "between 1 and 3", then re-tuning that file to 2 or 5
--      would produce a value the client obeys and the database vetoes, surfacing
--      to the player as a constraint violation he reads as a bug. A tuning value
--      the schema can overrule is not a tuning value. The cap lives on the
--      client, which the organizer's honour-system ruling already made the right
--      place for it. See specs/007-best-of-three-official/research.md R1 and R10.

alter table roster_entry
  add column if not exists official_attempts_used int not null default 0
    check (official_attempts_used >= 0);

-- Backfill: an entry that had committed under the old rules has spent one.
update roster_entry
   set official_attempts_used = 1
 where official_status = 'committed'
   and official_attempts_used = 0;

alter table committed_score
  add column if not exists attempt_no int not null default 1
    check (attempt_no between 1 and 9);

drop index if exists committed_score_one_per_entry;

-- THIS CONSTRAINT IS THE THREE-ATTEMPT RULE'S IDEMPOTENCY HALF (FR-237).
-- Not application logic, not a UI guard: a uniqueness constraint no client bug
-- and no dropped response can route around. ADR-0004 accepts unverified score
-- VALUES; it does not accept one attempt being recorded twice.
create unique index committed_score_one_per_attempt
  on committed_score (draft_id, entry_id, attempt_no);

-- FR-235: the client writes this counter, so it must be in the COLUMN-LEVEL
-- grant. 0002_policies.sql grants named columns rather than the table, so a new
-- column is unwritable until it appears here - and the failure is silent: every
-- attempt would look free because the PATCH is refused with nobody watching.
--
-- Deliberately NOT a security-definer function and NOT revoked. The organizer
-- ruled the attempt count honour-system on 2026-09-14 ("we should not build this
-- with cheaters in mind"), consistent with ADR-0004 already accepting whatever
-- score the client reports. See research R2.
grant update (official_attempts_used) on roster_entry to anon, authenticated;

-- official_status is left in place, unread, rather than dropped from a live
-- draft - the same treatment abandoned_official_runs got when FR-065 was
-- withdrawn. Dropping a column an older deployed bundle still selects would
-- break it mid-draft for no gain.
comment on column roster_entry.official_status is
  'SUPERSEDED by official_attempts_used (feature 007, FR-231). Retained unread so
   an older cached bundle does not break; safe to drop once none is in use.';
