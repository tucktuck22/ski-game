-- Shredpocalypse '86 — realign an existing draft's rules_version
--
-- SYMPTOM: every official run is refused. The player takes his one run, the
-- screen says the score was not committed, and the leaderboard stays empty.
-- The reason, if you look, is "rules version mismatch: draft is X, submission
-- is Y".
--
-- CAUSE: FR-023 freezes the rules at the draft, and the commit_deadline trigger
-- enforces it by comparing every submission's rules_version against the one
-- stored on the draft row. seed-draft.sql wrote that value once. Any later
-- change to the simulation bumps rulesVersion in data/courses/official.json,
-- and a draft seeded before the bump is still holding the old number — so the
-- trigger correctly refuses a score the client is correctly sending.
--
-- Drafts seeded before this file existed carry '1.0.0' while the shipped game
-- sends '1.5.0'. That combination rejects 100% of official commits.
--
-- WHEN TO RUN THIS: the draft has no committed scores yet and you want the
-- version realigned so play can start. That is the only safe case, and the
-- guard below enforces it — see the note at the bottom for why.
--
-- HOW TO RUN IT: paste the whole file into the Supabase SQL editor and run it.
-- There is nothing to edit. An earlier version made you fill in the version
-- by hand and refused to run until you had, which turned a fix into a puzzle
-- at exactly the moment somebody was trying to unblock a draft.
--
-- Run supabase/setup.sql and seed-draft.sql first if you have not. This file
-- fixes an existing draft; it does not create one.

begin;

do $$
declare
  -- The version the shipped build sends. Kept in step with
  -- data/courses/official.json by tests/contract/storage.test.ts, which is
  -- what stops this file becoming the stale thing it exists to repair.
  target   text := '1.5.0';
  d        record;
  n_scores integer;
begin
  select count(*) into n_scores from draft;
  if n_scores <> 1 then
    raise exception
      'Expected exactly one draft, found %. Run supabase/cleanup-drafts.sql first, or '
      'edit this file to name the draft id you mean.', n_scores;
  end if;

  select id, rules_version into d from draft limit 1;

  select count(*) into n_scores from committed_score where draft_id = d.id;
  if n_scores > 0 then
    -- FR-023 exists precisely to stop this. Scores posted under one set of
    -- physics are not comparable with scores posted under another, and this
    -- leaderboard decides where real people sleep. Moving the version now
    -- would silently mix the two on one board.
    raise exception
      'This draft already has % committed score(s) under rules_version %. Changing it '
      'now would put scores from two different rule sets on one leaderboard, which is '
      'the thing FR-023 forbids. Either leave it alone and ship the matching build, or '
      'reset the draft deliberately and start over.', n_scores, d.rules_version;
  end if;

  if d.rules_version = target then
    raise notice 'Draft % is already at %. Nothing to do.', d.id, target;
    return;
  end if;

  update draft set rules_version = target where id = d.id;
  raise notice 'Draft % moved from % to %. Official runs will now commit.',
    d.id, d.rules_version, target;
end $$;

commit;

-- Confirm it took, and check it against what the build sends.
select id, rules_version, deadline from draft;

-- WHY THE VERSION IS BAKED IN RATHER THAN ASKED FOR
--
-- Because the alternative is a file that tells you to go and look something up
-- and then fails if you do not — which is the same class of mistake as the
-- comment in seed-draft.sql that said "must match" and was wrong for five
-- releases. A value a test keeps honest beats an instruction a human has to
-- follow.
--
-- WHY THERE IS NO AUTOMATIC VERSION OF THIS
--
-- The client could send whatever the draft happens to hold and never mismatch,
-- but then FR-023 would enforce nothing: a mid-draft physics change would
-- quietly rescore the mountain under everyone who had already played. The
-- mismatch is the check working. This file is for the one case the check gets
-- wrong — a draft seeded before the game was finished, with nothing yet staked
-- on it.
