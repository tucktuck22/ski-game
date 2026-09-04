-- Organizer actions, as functions rather than table grants (FR-006, FR-007, FR-074).
--
-- THE PROBLEM THIS SOLVES. 0002_policies.sql deliberately denies the client
-- roles everything an organizer needs: no update grant on `draft` at all, no
-- update on roster_entry's `removed_at`/`removed_score`, and no delete on
-- committed_score. Those denials are correct and load-bearing -- they are what
-- makes FR-018's immutability hold against the player holding the anon key.
--
-- But the organizer holds that same anon key. The player bundle carries no
-- service role and this project has no server to put one behind, so three of
-- the four organizer controls were denied at the database and the app's own
-- comment ("these run through the service role") described a path that did not
-- exist. Verified against Postgres 16: REMOVE, deadline and RESET each came
-- back "permission denied", and because the client throws on error the failure
-- reached the global unhandledrejection handler and replaced the whole page.
--
-- THE SHAPE OF THE FIX. Each action is a `security definer` function that takes
-- the organizer secret and runs as the schema owner. Anon may invoke them; only
-- a caller who already holds the secret gets anything done. The table grants
-- stay exactly as restrictive as they were, so nothing a player can reach has
-- widened -- what changes is that there is now a door with a lock on it, rather
-- than no door.
--
-- WHAT THIS IS NOT. Secrecy, not authentication, exactly as FR-006 and
-- src/state/links.ts already say: anyone who obtains the organizer URL has
-- every organizer power. ADR-0004 already accepts unverified scores, so a
-- stronger claim here would be theatre. What this does add is that a player
-- holding only the player link cannot perform an organizer action, which is
-- what FR-006 asks for and what the table grants alone could not express.

-- The gate. Deliberately NOT granted to any client role: the action functions
-- below run as the owner and call it internally, so there is no reason to
-- expose a bare "is this the secret?" oracle.
create or replace function organizer_ok(p_draft uuid, p_secret text)
returns void
language plpgsql
security definer
-- Pinned so a caller cannot shadow a referenced object with a temp table and
-- have this function resolve to it while running as the owner.
set search_path = public, pg_temp
as $$
begin
  if p_secret is null or p_secret = '' or not exists (
    select 1 from draft where id = p_draft and organizer_secret = p_secret
  ) then
    -- Same error class the table grants raise, so the client's existing
    -- classification treats a bad secret as permanent rather than retrying it.
    raise exception 'not the organizer for this draft'
      using errcode = 'insufficient_privilege';
  end if;
end $$;

revoke all on function organizer_ok(uuid, text) from public;

-- FR-004: the organizer sets the deadline. Applying one already in the past
-- finalises the draft immediately, which the UI confirms before calling this.
create or replace function organizer_set_deadline(p_draft uuid, p_secret text, p_deadline timestamptz)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform organizer_ok(p_draft, p_secret);
  update draft set deadline = p_deadline where id = p_draft;
end $$;

-- FR-007, FR-074: removal is recorded and left visible, never a silent delete.
-- The score is carried in rather than read here, because what the organizer
-- confirmed discarding is what must be recorded as discarded.
create or replace function organizer_remove_entry(p_draft uuid, p_secret text, p_entry uuid, p_score int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform organizer_ok(p_draft, p_secret);
  update roster_entry
     set removed_at = now(), removed_score = p_score
   where id = p_entry and draft_id = p_draft;
end $$;

-- Destructive and irreversible; the UI confirms before calling it. Scoped to
-- the one draft, so a database holding more than one cannot be cleared by
-- resetting whichever draft the organizer happened to be looking at.
create or replace function organizer_reset_draft(p_draft uuid, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform organizer_ok(p_draft, p_secret);
  delete from committed_score where draft_id = p_draft;
  update roster_entry
     set claimed_at = null,
         practice_runs_used = 0,
         abandoned_official_runs = 0,
         official_status = 'unused',
         official_run_started_at = null
   where draft_id = p_draft;
end $$;

-- Invocable with the anon key, effective only with the secret.
revoke all on function organizer_set_deadline(uuid, text, timestamptz) from public;
revoke all on function organizer_remove_entry(uuid, text, uuid, int) from public;
revoke all on function organizer_reset_draft(uuid, text) from public;

grant execute on function organizer_set_deadline(uuid, text, timestamptz) to anon, authenticated;
grant execute on function organizer_remove_entry(uuid, text, uuid, int) to anon, authenticated;
grant execute on function organizer_reset_draft(uuid, text) to anon, authenticated;
