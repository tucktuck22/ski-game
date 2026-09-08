-- FR-023, done as written: the rules freeze AT THE FIRST COMMIT.
--
-- THE BUG THIS FIXES. FR-023 says "Course layout, physics, and scoring rules
-- MUST be frozen from the moment the first official run commits." The trigger
-- froze them at the moment the draft was SEEDED, by comparing every submission
-- against the rules_version typed into seed-draft.sql. Those are not the same
-- moment, and the gap between them is the whole development of the game:
-- data/courses/official.json went 1.0.0 -> 1.6.0 over six days, so a draft
-- seeded on day one refused 100% of official runs from day two onwards.
--
-- The player saw it as the thing this was reported as: the run ends, the score
-- is not on the board, and the OFFICIAL RUN button is live again. The reason
-- was one line of yellow text at the bottom of the panel reading "rules version
-- mismatch: draft is 1.0.0, submission is 1.6.0".
--
-- supabase/fix-rules-version.sql exists to repair exactly this by hand, which
-- means the failure was known and the remedy was a SQL file somebody had to
-- know about, find, and run. A draft with no committed scores has nothing to
-- freeze and nothing to protect; refusing every commit into it is not FR-023
-- being enforced, it is FR-023 never getting started.
--
-- WHAT CHANGES. Nothing, once a draft has one score. The mismatch check is
-- untouched for every commit after the first, which is the case FR-023 is
-- actually about: a physics change landing mid-draft makes the remaining scores
-- incomparable with the ones already on the board, and it is still refused.
-- What changes is that the FIRST commit sets the version rather than being
-- measured against a guess made before anyone played.
--
-- WHY IT IS SAFE TO TAKE THE VERSION FROM THE CLIENT. ADR-0004 already accepts
-- unverified score VALUES from the same client on the same request. A client
-- that would lie about its rules version can lie about the score it is pinning
-- to it, so this concedes nothing that was being defended. The freeze is what
-- has teeth, and the freeze is unchanged.

-- security definer: the freeze writes to `draft`, and 0002_policies.sql grants
-- the client roles no update on that table at all - correctly, since that grant
-- is what stops a player moving his own deadline. The function runs as the
-- schema owner so the write is possible without widening anything a player can
-- reach directly.
create or replace function enforce_deadline() returns trigger
language plpgsql
security definer
-- Pinned, for the same reason 0003_organizer.sql pins it: a caller must not be
-- able to shadow a referenced object with a temp table and have this resolve to
-- it while running as the owner.
set search_path = public, pg_temp
as $$
declare
  d record;
begin
  -- FOR UPDATE serialises two players committing in the same instant. Without
  -- it both could see an empty board, both take the "first commit" branch, and
  -- the second could freeze a different version than the first - which is the
  -- one thing this trigger exists to prevent.
  select deadline, rules_version into d from draft where id = new.draft_id for update;
  if not found then
    raise exception 'no such draft: %', new.draft_id using errcode = 'foreign_key_violation';
  end if;

  -- FR-043: no commits after the deadline. FR-044's grace for a run that started
  -- before it is the five minutes below.
  if now() > d.deadline + interval '5 minutes' then
    raise exception 'draft deadline has passed' using errcode = 'check_violation';
  end if;

  if exists (select 1 from committed_score where draft_id = new.draft_id) then
    -- The rules are frozen. A mid-draft physics or scoring change makes scores
    -- incomparable, and the leaderboard is the bed order.
    if new.rules_version <> d.rules_version then
      raise exception 'rules version mismatch: draft is %, submission is %', d.rules_version, new.rules_version
        using errcode = 'check_violation';
    end if;
  else
    -- This IS the moment FR-023 names. Freeze here.
    update draft set rules_version = new.rules_version where id = new.draft_id;
  end if;

  return new;
end;
$$;
