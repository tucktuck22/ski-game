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

-- Your two links. Replace YOUR-SITE with wherever the game is deployed
-- (for GitHub Pages that is https://tucktuck22.github.io/ski-game).
--
-- Share the PLAYER link. Keep the ORGANIZER one to yourself - anyone who has
-- it can change the deadline, remove entries, and reset the whole draft.
select
  'https://YOUR-SITE/?draft=' || id                                   as player_link,
  'https://YOUR-SITE/?draft=' || id || '&organizer=' || organizer_secret as organizer_link,
  deadline
from draft
order by created_at desc
limit 1;
