# Contract: Shared Storage — attempts delta

**Governs**: FR-231 to FR-244. **Amends**
[feature 001's storage-api.md](../../001-shredpocalypse-bed-draft/contracts/storage-api.md),
which remains in force for everything not named here.

Operations are described by their observable contract, not their SQL. What matters is
which invariants the **database** enforces, because the client is public and — per
[ADR-0004](../../../docs/adr/0004-accept-client-reported-scores.md) — untrusted for
values while still bound by rules.

## Invariants enforced server-side

| Invariant                                              | Enforcement                                                                         | Requirement    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------- |
| ~~One committed score per entry, forever~~             | **SUPERSEDED** by the two rows below                                                | ~~FR-017~~     |
| At most three scored attempts per entry, forever       | `UNIQUE (draft_id, entry_id, attempt_no)` + `CHECK (attempt_no between 1 and 3)`    | FR-231, FR-237 |
| A committed attempt is never amended or erased         | No UPDATE and no DELETE grant to any client role, unchanged from feature 001        | FR-237         |
| At most three attempts _started_, decrement impossible | Counter written only by `start_official_attempt()`; direct UPDATE revoked from anon | FR-233, FR-235 |
| An attempt is spent before gameplay, not after         | The dispenser is a precondition of starting, and it advances the counter            | FR-234         |
| Commit timestamps not client-set                       | `commit_at` default `now()`, excluded from the insert grant — unchanged             | FR-037, FR-236 |
| No attempt started after the deadline                  | The dispenser refuses; the existing insert trigger still refuses late commits       | FR-241         |

The first row is the change this feature is really making. Feature 001's contract called
`UNIQUE (draft_id, entry_id)` "the one-run rule"; it is now the three-attempt rule, and
it is still a uniqueness constraint rather than application logic for the same reason.

## Player operations

| Operation                                           | Contract                                                                                                                      | Failure modes                                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `startOfficialAttempt(entryId)` **new**             | Allocates and spends the next attempt. Returns its number, 1–3. **Must succeed before gameplay begins**                       | Already used three → rejected, naming it. Deadline passed → rejected. Offline → **rejected, and the attempt MUST NOT start**; the player keeps it (see below)      |
| `commitAttempt(entryId, attemptNo, score, outcome)` | Inserts one immutable attempt row                                                                                             | Duplicate `(entry, attempt_no)` → rejected as already recorded; this is the retry-after-lost-response case and is a **correct** outcome. Offline → queued (FR-046) |
| ~~`markOfficialRunEnded(id)`~~                      | **REMOVED.** Its job — recording that the run is spent even when the commit does not land — moves _earlier_, to the dispenser | —                                                                                                                                                                  |
| `listDraft()`                                       | Roster now carries attempts used and the **best** attempt's score and timestamp                                               | Offline → last cached snapshot, marked stale                                                                                                                       |
| `incrementPractice(id)`                             | Unchanged (FR-244)                                                                                                            | Abandoned practice never calls this (FR-066)                                                                                                                       |

### Why `startOfficialAttempt` fails closed

Every other write in this system fails **open** so that a bad network cannot cost a
player his run — `markOfficialRunEnded` is explicitly "best effort by design"
(`src/main.ts:754`), because the score is already safe in the outbox and losing it to
bookkeeping would be worse.

The dispenser inverts that, deliberately. If it could fail open, a player with no
connection would get unlimited attempts, which is the loophole this feature exists to
close. So the attempt does not start, and the player is told he has **not** lost it —
that second half is required, because his instinct on a failed start will be to assume
he has been charged.

This is the one place where the feature makes the offline experience worse, and it is
the price of the rule being real. Recorded here rather than discovered in play.

## Commit durability

Unchanged from feature 001 except for the queue key.

1. Attempt allocated and spent **before** the run starts. This is new, and it is the
   only network round-trip that gates gameplay.
2. Run ends. Score computed locally from the simulation's terminal state.
3. Write to the IndexedDB outbox first, then attempt the server.
4. **The queue key is `(entryId, attemptNo)`, not `entryId`.** Feature 001's fixed
   `` `${entryId}-official` `` key would have a second attempt overwrite a first that
   was still queued, destroying a score that may have been the player's best. See
   [research R3](../research.md#r3--the-outbox-key-collides-across-attempts).
5. UI shows **pending**. It must not claim a leaderboard place (FR-047).
6. Retry with exponential backoff, capped at 60 s, until confirmed or rejected. A
   `rejected` from the per-attempt unique index means "already recorded" and is
   terminal, exactly as a duplicate is today.

## What the leaderboard reads

The board never reads a stored "current score". It reduces the attempt set:

- **score** — the highest among the entry's attempts
- **tiebreak timestamp** — the `commit_at` of _that_ attempt, never the most recent
  (FR-236)
- **attempts used** — from the counter, not from the number of rows, so an abandoned
  attempt still counts against the player

A player with attempts remaining MUST NOT be presented as final (FR-239), and none of
this may be carried by colour alone (FR-055).
