-- FR-050 / Principle II: a schema migration must not corrupt committed scores.
--
-- Feature 001 wrote this obligation down as its T039 and never checked it, because
-- until feature 007 there had been no schema change to check it against. This is
-- that change, so the test stops being deferrable.
--
-- Run against a database carrying migrations 0001-0004 ONLY, with data already in
-- it — NOT against setup.sql, which is already migrated. The point is to prove
-- 0005 is safe to paste into a project that has been running a draft, which is
-- exactly how the README tells organizers to apply 0003 and 0004.
--
--   createdb roundtrip
--   for f in 0001_init 0002_policies 0003_organizer 0004_rules_freeze; do
--     psql -d roundtrip -v ON_ERROR_STOP=1 -f supabase/migrations/$f.sql
--   done
--   psql -d roundtrip -v ON_ERROR_STOP=1 -f supabase/tests/migration-roundtrip.sql

\set ON_ERROR_STOP on

-- A draft mid-flight under the OLD rules: one player committed, one has not.
insert into draft (id, deadline, course_seed, rules_version, organizer_secret)
values ('aaaaaaaa-0000-0000-0000-000000000001', now() + interval '7 days', 1986, '2.0.0', 's');
insert into roster_entry (id, draft_id, name, origin, official_status)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Dave', 'organizer', 'committed');
insert into roster_entry (id, draft_id, name, origin)
values ('bbbbbbbb-0000-0000-0000-000000000002',
        'aaaaaaaa-0000-0000-0000-000000000001', 'Sam', 'organizer');
insert into committed_score (draft_id, entry_id, score, outcome, rules_version)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001', 51234, 'finished', '2.0.0');

\echo '--- applying 0005 to a live pre-feature draft ---'
\i supabase/migrations/0005_best_of_three.sql

do $$
declare
  s   int;
  a   int;
  u   int;
begin
  -- The score itself is the thing that must not move. It decides where somebody sleeps.
  select score, attempt_no into s, a from committed_score;
  if s is distinct from 51234 then
    raise exception 'FR-050 VIOLATED: a committed score changed across the migration (% )', s;
  end if;
  if a is distinct from 1 then
    raise exception 'FR-050 VIOLATED: an existing score did not backfill to attempt 1 (%)', a;
  end if;
  raise notice 'PASS FR-050: the committed score survived, as attempt 1';

  -- A player who had committed under the old rules has spent exactly one attempt,
  -- not all of them: he gets the two the new rules give him.
  select official_attempts_used into u from roster_entry where name = 'Dave';
  if u <> 1 then
    raise exception 'FR-231 VIOLATED: a previously-committed player converted to % attempts used', u;
  end if;
  select official_attempts_used into u from roster_entry where name = 'Sam';
  if u <> 0 then
    raise exception 'FR-231 VIOLATED: a player who never ran converted to % attempts used', u;
  end if;
  raise notice 'PASS FR-231: old committed -> 1 attempt used, never-ran -> 0';

  -- And the point of the whole feature: he can still take the rest.
  insert into committed_score (draft_id, entry_id, attempt_no, score, outcome, rules_version)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          'bbbbbbbb-0000-0000-0000-000000000001', 2, 61000, 'finished', '2.0.0');
  select count(*) into u from committed_score;
  if u <> 2 then raise exception 'FR-231 VIOLATED: a second attempt did not land'; end if;
  raise notice 'PASS FR-231: a migrated player can take his remaining attempts';
end $$;

\echo 'MIGRATION ROUND-TRIP HELD'
