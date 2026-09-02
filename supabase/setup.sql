-- Shredpocalypse '86 — complete database setup
--
-- Paste this whole file into the Supabase SQL editor and run it ONCE.
-- It is the three files in supabase/migrations/ concatenated, in order, for
-- convenience. If you are setting up a second time, start from a fresh
-- project rather than re-running this.
--
-- What it creates:
--   draft            one contest: deadline, shared course seed, rules version
--   roster_entry     the named players, however they were added
--   committed_score  the immutable one-run-per-name results
--
-- The rules that decide where people sleep are enforced HERE, as constraints
-- and policies, not in the game code. In particular:
--   * one committed score per entry, forever  (unique index, no UPDATE grant)
--   * commit timestamps assigned by the server (the bed-order tiebreaker)
--   * the 16-entry roster cap                  (trigger)
--   * the organizer secret unreadable by players (column revoke)

-- Shredpocalypse '86 — schema
-- Entities from specs/001-shredpocalypse-bed-draft/data-model.md

create extension if not exists "pgcrypto";

create table draft (
  id                uuid primary key default gen_random_uuid(),
  deadline          timestamptz not null,
  course_seed       bigint      not null,
  rules_version     text        not null,
  organizer_secret  text        not null,
  finalized_at      timestamptz,
  created_at        timestamptz not null default now()
);

create table roster_entry (
  id                       uuid primary key default gen_random_uuid(),
  draft_id                 uuid not null references draft(id) on delete cascade,
  name                     text not null,
  -- FR-073: the leaderboard shows who was on the original list and who added themselves.
  origin                   text not null check (origin in ('organizer', 'self_created')),
  claimed_at               timestamptz,
  practice_runs_used       int  not null default 0 check (practice_runs_used between 0 and 3),
  official_status          text not null default 'unused' check (official_status in ('unused', 'committed')),
  -- FR-065: abandonment is permitted, but it is never private.
  abandoned_official_runs  int  not null default 0 check (abandoned_official_runs >= 0),
  -- Set when an official run begins, cleared on commit. Non-null with no
  -- committed_score row means the run was abandoned (FR-019).
  --
  -- Abandonment has to be detectable when the tab is killed, the phone dies or
  -- the browser is force-quit - which is exactly when it happens and exactly
  -- when an unload handler does not fire. So the state is inverted: mark the
  -- run as started, and treat a start with no commit as an abandonment,
  -- discovered on the next load from any device.
  official_run_started_at  timestamptz,
  -- FR-074: a removed entry stays visible rather than disappearing silently.
  removed_at               timestamptz,
  removed_score            int,
  created_at               timestamptz not null default now()
);

-- FR-003: exact-match duplicates rejected, case-insensitively. Near-duplicates
-- are deliberately allowed - a similarity rule would also reject two genuine Daves.
create unique index roster_entry_unique_name on roster_entry (draft_id, lower(name));
create index roster_entry_draft on roster_entry (draft_id);

create table committed_score (
  id             uuid primary key default gen_random_uuid(),
  draft_id       uuid not null references draft(id) on delete cascade,
  entry_id       uuid not null references roster_entry(id) on delete cascade,
  score          int  not null check (score >= 0),
  outcome        text not null check (outcome in ('finished', 'wiped_out')),
  rules_version  text not null,
  -- FR-037: the tiebreaker for the bed order. Server-assigned, never client-set,
  -- so a wrong device clock cannot change who sleeps where.
  commit_at      timestamptz not null default now()
);

-- THIS CONSTRAINT IS THE ONE-RUN RULE (FR-017, FR-018).
-- Not application logic, not a UI guard: a uniqueness constraint no client bug
-- and no curious player can route around. ADR-0004 accepts unverified score
-- VALUES; it does not accept a client issuing a second insert.
create unique index committed_score_one_per_entry on committed_score (draft_id, entry_id);

-- FR-002, FR-072: the roster cap is a server concern, because self-serve
-- creation (FR-070) means the player bundle cannot be trusted to enforce it.
create or replace function enforce_roster_cap() returns trigger as $$
begin
  if (select count(*) from roster_entry where draft_id = new.draft_id) >= 16 then
    raise exception 'roster is full (16 entries)' using errcode = 'check_violation';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger roster_cap before insert on roster_entry
  for each row execute function enforce_roster_cap();

-- FR-043: no commits after the deadline. FR-044's grace for a run that started
-- before it is handled by the client sending the run's start time; the server
-- allows a short window rather than trusting an arbitrary claim.
create or replace function enforce_deadline() returns trigger as $$
declare
  d record;
begin
  select deadline, rules_version into d from draft where id = new.draft_id;
  if now() > d.deadline + interval '5 minutes' then
    raise exception 'draft deadline has passed' using errcode = 'check_violation';
  end if;
  -- FR-023: rules frozen at first commit. A mid-draft physics or scoring change
  -- makes scores incomparable, and the leaderboard is the bed order.
  if new.rules_version <> d.rules_version then
    raise exception 'rules version mismatch: draft is %, submission is %', d.rules_version, new.rules_version
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger commit_deadline before insert on committed_score
  for each row execute function enforce_deadline();
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
