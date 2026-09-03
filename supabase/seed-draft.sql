-- Shredpocalypse '86 — create your draft
--
-- Run this AFTER setup.sql. It creates one draft and its roster, then prints
-- the two links you need.
--
-- EDIT THE TWO LINES MARKED "CHANGE ME" BELOW, then run the whole file.

begin;

insert into draft (deadline, course_seed, rules_version, organizer_secret)
values (
  -- CHANGE ME: your deadline, in UTC. After this the board freezes as FINAL
  -- and anyone who has not posted a score drops to the coin-flip group.
  '2026-09-10 23:00:00+00',

  19860214,   -- shared course seed: every official run faces this same mountain
  '1.0.0',    -- must match rulesVersion in data/courses/official.json
  encode(gen_random_bytes(16), 'hex')
);

insert into roster_entry (draft_id, name, origin)
select
  (select id from draft order by created_at desc limit 1),
  name,
  'organizer'
from unnest(array[
  -- CHANGE ME: the people on the trip. Anyone missing can add themselves
  -- later from the player link, so this does not have to be complete.
  'Tucker', 'Dave', 'Sam', 'Al', 'Zach', 'Marty', 'Rob', 'Cheeks'
]) as name;

commit;

-- Your two links.
--
-- The site address is the ONLY editable value, and it is on its own line below.
-- Everything after it — the "/?draft=" and the id — is built for you. An
-- earlier version of this file asked you to substitute a placeholder inside the
-- link string itself, and substituting it swallowed the "?draft=" part, which
-- produces a 404 rather than the game.
--
-- Share the PLAYER link. Keep the ORGANIZER one to yourself - anyone who has
-- it can change the deadline, remove entries, and reset the whole draft.
with site as (
  -- CHANGE ME only if the game is deployed somewhere else. No trailing slash.
  select 'https://tucktuck22.github.io/ski-game' as base
)
select
  site.base || '/?draft=' || d.id                                          as player_link,
  site.base || '/?draft=' || d.id || '&organizer=' || d.organizer_secret   as organizer_link,
  d.deadline
from draft d, site
order by d.created_at desc
limit 1;
