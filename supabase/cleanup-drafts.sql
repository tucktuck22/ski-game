-- Shredpocalypse '86 — leave exactly one draft
--
-- A database holding more than one draft makes the bare site link ambiguous:
-- the app cannot tell which draft a player means, and refuses to guess rather
-- than sending eight people to the wrong board. That happens when
-- seed-draft.sql is run more than once, which is what debugging a setup problem
-- naturally leads to.
--
-- STEP 1. Look at what is there. Keep the draft with activity, if any has it.
--
--   select d.id, d.created_at,
--          count(r.id)         as roster,
--          count(r.claimed_at) as claimed,
--          (select count(*) from committed_score c where c.draft_id = d.id) as scores
--   from draft d
--   left join roster_entry r on r.draft_id = d.id
--   group by d.id, d.created_at
--   order by d.created_at;
--
-- STEP 2. Edit the one marked line below and run this file. Deleting a draft
-- cascades to its roster entries and committed scores. There is no undo.
with keep as (
  -- CHANGE ME: the draft id to keep. Nothing else belongs on this line.
  select 'PASTE-THE-ID-HERE'::uuid as id
)
delete from draft
where id <> (select d.id from draft d join keep on d.id = keep.id);

-- Two deliberate safety properties, both of which fail closed:
--   * Leaving the placeholder in place fails the ::uuid cast, and nothing is
--     deleted.
--   * An id matching no row makes the subquery NULL, so `id <> NULL` is never
--     true, and nothing is deleted.
-- This statement can only delete once it has positively matched the draft being
-- kept. Verify with the query from STEP 1, then reprint the links with
-- supabase/show-links.sql.
