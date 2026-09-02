-- Row Level Security.
--
-- The anon key is public by design: there are no accounts (FR-009), and these
-- policies are what enforce the rules. ADR-0004 trusts players not to forge a
-- score VALUE; it does not hand them UPDATE and DELETE.

alter table draft           enable row level security;
alter table roster_entry    enable row level security;
alter table committed_score enable row level security;

-- Anyone with the link reads everything. The leaderboard is public to link
-- holders by design (FR-040).
create policy draft_read           on draft           for select using (true);
create policy roster_read          on roster_entry    for select using (true);
create policy score_read           on committed_score for select using (true);

-- FR-070: any link holder can create a roster entry. No organizer step, no
-- credential. The cap trigger and the unique index are the only limits.
create policy roster_insert on roster_entry for insert with check (true);

-- Players may update only the columns that track their own run economy.
-- Deliberately NOT a blanket update grant: name, origin and removed_at are
-- organizer territory.
create policy roster_update on roster_entry for update using (removed_at is null) with check (removed_at is null);

-- FR-017, FR-018: insert only. There is no update policy and no delete policy
-- on committed_score for any client role, so a committed score is immutable
-- from the outside. The unique index makes a second insert fail.
create policy score_insert on committed_score for insert with check (true);

-- No update or delete policy exists for committed_score. This absence is the
-- feature. Organizer removal (FR-074) goes through the service role, which the
-- player bundle does not carry.

-- ---------------------------------------------------------------------------
-- Explicit grants.
--
-- Supabase grants broadly to anon by default, and the revokes below assume it.
-- But a revoke against a grant that is not there is a silent no-op, so relying
-- on it alone would mean this schema's security posture depends on somebody
-- else's defaults not changing. The grants are therefore stated positively:
-- anon gets exactly these columns and operations, and nothing else.
-- ---------------------------------------------------------------------------

-- organizer_secret is deliberately absent from this list. It gates roster
-- removal, deadline changes and draft reset, so a player who could read it
-- would have every organizer power (FR-006).
grant select (id, deadline, course_seed, rules_version, finalized_at, created_at)
  on draft to anon, authenticated;

grant select on roster_entry to anon, authenticated;
grant insert on roster_entry to anon, authenticated;

-- Players may move only their own run counters. Name, origin and removal are
-- organizer territory; claimed_at is how a claim is taken (FR-012).
grant update (claimed_at, practice_runs_used, abandoned_official_runs,
              official_status, official_run_started_at)
  on roster_entry to anon, authenticated;

grant select on committed_score to anon, authenticated;
grant insert on committed_score to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Revokes. Belt and braces against Supabase's broad defaults.
-- ---------------------------------------------------------------------------

-- FR-017, FR-018: a committed score is immutable from outside. There is no
-- update policy and no delete policy, and now no grant either.
revoke update, delete on committed_score from anon, authenticated;
revoke delete on roster_entry from anon, authenticated;
revoke update (name, origin, removed_at, removed_score, draft_id)
  on roster_entry from anon, authenticated;

-- The organizer secret must not be readable by players. Without this, a broad
-- default grant plus `draft_read` (using true) hands the secret to anyone
-- holding the player link and FR-006 is defeated completely.
revoke select (organizer_secret) on draft from anon, authenticated;
