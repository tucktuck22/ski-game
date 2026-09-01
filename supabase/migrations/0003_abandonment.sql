-- Abandonment tracking (FR-019, FR-065).
--
-- An abandoned run must be detected even when the tab is killed, the phone dies,
-- or the browser is force-quit - which is exactly when it happens. An unload
-- handler cannot be relied on for any of those, so detection is inverted:
-- the run is marked as STARTED in shared storage, and a start with no
-- corresponding commit is an abandonment, discovered on the next load from any
-- device. That also makes it work across devices, which an unload handler
-- never could.

alter table roster_entry
  add column official_run_started_at timestamptz;

comment on column roster_entry.official_run_started_at is
  'Set when an official run begins, cleared on commit. Non-null with no committed_score row means the run was abandoned (FR-019).';
