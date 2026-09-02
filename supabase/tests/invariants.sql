-- Storage invariant tests.
--
-- These run against a REAL Postgres in CI (.github/workflows/ci.yml), because
-- the rules that decide where eight people sleep are enforced by constraints
-- and policies rather than by game code — and a constraint nobody has ever
-- tripped is not evidence of anything.
--
-- Each block asserts an invariant by deliberately violating it and requiring
-- the violation to be rejected. A block that does NOT raise means the
-- invariant is gone, so it raises instead and fails the build.
--
-- Run locally against a scratch database:
--   psql -d shred -v ON_ERROR_STOP=1 -f supabase/setup.sql
--   psql -d shred -v ON_ERROR_STOP=1 -f supabase/tests/invariants.sql

\set ON_ERROR_STOP on

insert into draft (id, deadline, course_seed, rules_version, organizer_secret)
values ('11111111-1111-1111-1111-111111111111', now() + interval '7 days', 19860214, '1.0.0', 'topsecret');
insert into roster_entry (id, draft_id, name, origin)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Dave', 'organizer');
insert into roster_entry (id, draft_id, name, origin)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Sam', 'organizer');

-- FR-003: duplicate names rejected case-insensitively.
do $$ begin
  begin
    insert into roster_entry (draft_id, name, origin)
    values ('11111111-1111-1111-1111-111111111111', 'dave', 'self_created');
    raise exception 'FR-003 VIOLATED: a duplicate name differing only in case was accepted';
  exception when unique_violation then raise notice 'PASS FR-003: duplicate name rejected';
  end;
end $$;

-- FR-017: the first official commit succeeds.
insert into committed_score (draft_id, entry_id, score, outcome, rules_version)
values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222', 51000, 'finished', '1.0.0');

-- FR-017/FR-018: THE ONE-RUN RULE. A second commit for the same entry must be
-- impossible. This is the single most important assertion in the project.
do $$ begin
  begin
    insert into committed_score (draft_id, entry_id, score, outcome, rules_version)
    values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222', 99999, 'finished', '1.0.0');
    raise exception 'FR-018 VIOLATED: a second official score was accepted for the same name';
  exception when unique_violation then raise notice 'PASS FR-018: second commit rejected';
  end;
end $$;

-- FR-037: commit_at is assigned by the server. It is the bed-order tiebreaker,
-- so a player with a wrong or manipulated device clock must not influence it.
do $$
declare n int;
begin
  select count(*) into n from committed_score
   where commit_at is null or commit_at < now() - interval '5 minutes';
  if n > 0 then raise exception 'FR-037 VIOLATED: commit_at was not server-assigned'; end if;
  raise notice 'PASS FR-037: commit_at server-assigned';
end $$;

-- FR-023: rules frozen. A submission under a different rules version is not
-- comparable with the others, and the leaderboard is the bed order.
do $$ begin
  begin
    insert into committed_score (draft_id, entry_id, score, outcome, rules_version)
    values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333', 4000, 'finished', '9.9.9');
    raise exception 'FR-023 VIOLATED: a score under a different rules version was accepted';
  exception when check_violation then raise notice 'PASS FR-023: rules mismatch rejected';
  end;
end $$;

-- FR-002/FR-072: the 16-entry cap, enforced server-side because self-serve
-- creation means the client cannot be trusted to enforce it.
insert into roster_entry (draft_id, name, origin)
select '11111111-1111-1111-1111-111111111111', 'Filler' || g, 'self_created' from generate_series(1,14) g;
do $$ begin
  begin
    insert into roster_entry (draft_id, name, origin)
    values ('11111111-1111-1111-1111-111111111111', 'SeventeenthGuy', 'self_created');
    raise exception 'FR-002 VIOLATED: a 17th roster entry was accepted';
  exception when check_violation then raise notice 'PASS FR-002: roster cap held at 16';
  end;
end $$;

-- FR-043: no commits after the deadline.
update draft set deadline = now() - interval '1 hour' where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  begin
    insert into committed_score (draft_id, entry_id, score, outcome, rules_version)
    values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333', 4000, 'finished', '1.0.0');
    raise exception 'FR-043 VIOLATED: a score was accepted after the deadline';
  exception when check_violation then raise notice 'PASS FR-043: post-deadline commit rejected';
  end;
end $$;
update draft set deadline = now() + interval '7 days' where id = '11111111-1111-1111-1111-111111111111';

-- ---------------------------------------------------------------------------
-- As anon: what a player holding the link can actually do.
-- ---------------------------------------------------------------------------
set role anon;

-- FR-006: the organizer secret gates removal, deadline changes and reset. A
-- player who could read it would have every organizer power.
do $$ begin
  begin
    perform organizer_secret from draft;
    raise exception 'FR-006 VIOLATED: a player can read the organizer secret';
  exception when insufficient_privilege then raise notice 'PASS FR-006: organizer secret not readable';
  end;
end $$;

-- ...but the rest of the draft must still be readable, or the game cannot load.
do $$
declare v text;
begin
  select rules_version into v from draft limit 1;
  if v is null then raise exception 'BROKEN: a player cannot read the draft at all'; end if;
  raise notice 'PASS: draft readable by players';
end $$;

-- FR-018: a committed score is immutable from outside. No update policy, no
-- delete policy, and no grant either.
do $$ begin
  begin
    update committed_score set score = 999999;
    raise exception 'FR-018 VIOLATED: a player can rewrite a committed score';
  exception when insufficient_privilege then raise notice 'PASS FR-018: score not updatable';
  end;
end $$;

do $$ begin
  begin
    delete from committed_score;
    raise exception 'FR-018 VIOLATED: a player can delete a committed score';
  exception when insufficient_privilege then raise notice 'PASS FR-018: score not deletable';
  end;
end $$;

-- FR-075: a wrong name on a committed result is fixed by removal, not by
-- relabelling it - which would let the board say something that did not happen.
do $$ begin
  begin
    update roster_entry set name = 'NotDave' where name = 'Dave';
    raise exception 'FR-075 VIOLATED: a player can rename an entry';
  exception when insufficient_privilege then raise notice 'PASS FR-075: rename refused';
  end;
end $$;

-- ...but a player must be able to move his own run counters, or the run economy
-- cannot work at all.
update roster_entry set practice_runs_used = 2 where name = 'Sam';
do $$
declare n int;
begin
  select practice_runs_used into n from roster_entry where name = 'Sam';
  if n <> 2 then raise exception 'BROKEN: a player cannot record his own practice run'; end if;
  raise notice 'PASS: player can record his own run';
end $$;

reset role;
\echo 'ALL STORAGE INVARIANTS HELD'
