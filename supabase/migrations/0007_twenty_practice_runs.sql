-- Practice runs go from 3 to 20: players were not learning the course in three.
--
-- SAFE TO RUN ON ITS OWN against a project already holding a draft. It widens
-- one check constraint and touches no rows.
--
-- WHY THIS IS NEEDED AND NOT JUST THE CLIENT CONSTANT: 0001 capped
-- practice_runs_used at 3 in the table itself. Without this, the client offers
-- a fourth practice run, the write recording it is refused, and the counter
-- sticks at 3 - so practice silently becomes unlimited.

alter table roster_entry drop constraint if exists roster_entry_practice_runs_used_check;
alter table roster_entry
  add constraint roster_entry_practice_runs_used_check
  check (practice_runs_used between 0 and 20);
