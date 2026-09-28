-- Feature 007 FR-246: the draft reset returns every name's official attempts.
--
-- SAFE TO RUN ON ITS OWN against a project already holding a draft. It replaces
-- one function and touches no rows. Existing grants on the function are kept,
-- because CREATE OR REPLACE preserves them.
--
-- WHY: organizer_reset_draft was written in 0003, when a name had one official
-- run tracked by official_status. 0005 replaced that with official_attempts_used
-- and never updated the reset. So RESET THE WHOLE DRAFT deleted every score and
-- zeroed practice runs but left the attempt counter where it was: the board read
-- "IN PROGRESS - 1 of 3 USED" beside names with no score, and those attempts
-- were gone for good. Found at the feature 010 play pass.
--
-- AFTER RUNNING THIS, press RESET THE WHOLE DRAFT once more. The reset that
-- already happened left the counters behind; this function does not go back
-- and fix them by itself.

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
         official_attempts_used = 0,
         abandoned_official_runs = 0,
         official_status = 'unused',
         official_run_started_at = null
   where draft_id = p_draft;
end $$;
