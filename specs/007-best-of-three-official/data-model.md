# Data Model: Three Attempts, Best One Counts

**Phase 1** for [plan.md](./plan.md). Deltas to feature 001's
[data-model.md](../001-shredpocalypse-bed-draft/data-model.md). Entities not named here
are unchanged.

## Entities

### Official attempt

One of three chances at the official course. **Comes into existence when the player
starts it, which is also the moment it is spent.** Ends either with a committed score
(finish or wipeout) or with nothing at all (abandonment).

| Field           | Type                         | Rules                                                                       |
| --------------- | ---------------------------- | --------------------------------------------------------------------------- |
| `attempt_no`    | int, 1–3                     | Allocated server-side before gameplay. `CHECK (attempt_no between 1 and 3)` |
| `score`         | int ≥ 0                      | Client-reported (ADR-0004). Absent entirely for an abandoned attempt        |
| `outcome`       | `finished` \| `wiped_out`    | Unchanged from feature 001                                                  |
| `commit_at`     | timestamptz, server-assigned | Never client-set (FR-037). Carries the FR-236 tiebreak for the best attempt |
| `rules_version` | text                         | Copied from the draft at insert; frozen comparison (FR-023)                 |

An abandoned attempt has **no row**. It is visible only as a gap: the counter advanced
and no score arrived. This is deliberate — see Derived values below for why the gap is
not ambiguous.

### Roster entry (changed)

| Field                     | Change                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `official_status`         | **Replaced.** A binary `unused`/`committed` cannot express "one attempt spent, two left"                                               |
| `official_attempts_used`  | **New.** int 0–3, `CHECK (between 0 and 3)`. The authority on how many remain (FR-235). Client-written, like `practice_runs_used` (R2) |
| `official_run_started_at` | **Retained, unchanged.** Already marks a run as begun so abandonment survives a killed tab. This is the primitive FR-234 needs         |
| `practice_runs_used`      | Unchanged, 0–3 (FR-244)                                                                                                                |
| `abandoned_official_runs` | Still unread. Left in place by FR-065's withdrawal; this feature does not revive or drop it                                            |

### Committed score (changed)

| Constraint             | Before                        | After                                     | Why                                                |
| ---------------------- | ----------------------------- | ----------------------------------------- | -------------------------------------------------- |
| Uniqueness             | `UNIQUE (draft_id, entry_id)` | `UNIQUE (draft_id, entry_id, attempt_no)` | Caps attempts **and** keeps retry idempotency (R1) |
| Attempt bound          | —                             | `CHECK (attempt_no between 1 and 3)`      | The three-attempt rule, in the schema              |
| Client UPDATE / DELETE | Not granted                   | **Still not granted**                     | FR-237. The absence is the feature                 |

## Derived values

Never stored. Computed from the attempt set each time the snapshot is read.

| Value              | Rule                                                                                                                   | Requirement |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------- |
| Leaderboard score  | Highest `score` among the entry's attempts                                                                             | FR-232      |
| Tiebreak timestamp | `commit_at` **of that best attempt**; on an internal tie, the earlier of the tied attempts                             | FR-236      |
| Attempts remaining | `3 - official_attempts_used`                                                                                           | FR-231      |
| Finished           | `official_attempts_used = 3`, or the deadline has passed                                                               | FR-239      |
| Forfeit            | No attempt row at all at the deadline — whether he never started or abandoned all three. The two are not distinguished | FR-242      |

**Why the abandonment gap is unambiguous**: the counter is advanced when the run starts
and never decremented, so `official_attempts_used` minus the number of score rows is
exactly the number of attempts abandoned. Nothing needs to record an
abandonment as an event, which is what feature 001's orphaned `abandonment.ts` tried to
do and never wired up.

## State transitions

```text
                    attempts_used = 0
                    ┌──────────────┐
                    │  NOT STARTED │
                    └──────┬───────┘
                           │  startOfficialAttempt()  ← counter advances HERE (FR-234)
                           │  best-effort: a failed write does not stop the run (R2)
                           ▼
                    ┌──────────────┐
                    │  IN PROGRESS │
                    └──┬────────┬──┘
      finish / wipeout │        │ session ends (tab closed, phone dies)
                       ▼        ▼
              ┌────────────┐  ┌────────────┐
              │ COMMITTED  │  │ ABANDONED  │   spent, no row, scores nothing
              │ score row  │  └─────┬──────┘
              └─────┬──────┘        │
                    └───────┬───────┘
                            ▼
              attempts_used < 3 ? back to NOT STARTED
                              : FINISHED
```

The single most important property of this diagram: **the counter advances on the
downward edge into IN PROGRESS, not on either edge out of it.** That is what makes
abandonment cost an attempt without needing to detect the abandonment, which is
impossible to do reliably when the tab is killed — the reason
`official_run_started_at` was inverted this way in `0001_init.sql` in the first place.

## Migration

`supabase/migrations/0005_best_of_three.sql`, additive, safe standalone (R7). Backfills
rather than assuming an empty table: existing `official_status = 'committed'` becomes
`official_attempts_used = 1`, and existing score rows become `attempt_no = 1`. Feature
001's T039 round-trip test ("schema migrations round-trip without corrupting committed
scores", FR-050) applies to this migration and is in scope.
