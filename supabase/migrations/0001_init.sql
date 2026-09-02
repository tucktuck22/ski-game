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
