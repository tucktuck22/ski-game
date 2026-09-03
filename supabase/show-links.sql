-- Shredpocalypse '86 — reprint the links for the draft you already have
--
-- Safe to run any number of times. It reads; it never writes.
-- Use this instead of re-running seed-draft.sql, which would create a second
-- draft and make the bare site link ambiguous.
--
-- Share the PLAYER link. Keep the ORGANIZER one to yourself - anyone who has
-- it can change the deadline, remove entries, and reset the whole draft.
with site as (
  -- CHANGE ME only if the game is deployed somewhere else. No trailing slash.
  select 'https://tucktuck22.github.io/ski-game' as base
)
select
  site.base || '/'                                                        as bare_link,
  site.base || '/?draft=' || d.id                                         as player_link,
  site.base || '/?draft=' || d.id || '&organizer=' || d.organizer_secret   as organizer_link,
  d.deadline
from draft d, site
order by d.created_at desc;
