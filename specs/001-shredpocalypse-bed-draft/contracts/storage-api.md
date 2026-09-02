# Contract: Shared Storage

**Backend**: Supabase (Postgres + RLS + Realtime) | **Governs**: FR-002 to FR-021,
FR-037, FR-042 to FR-050, FR-070 to FR-075

Operations are described by their observable contract, not their SQL. What matters
is which invariants are enforced by the *database* rather than by the client,
because the client is public and — per
[ADR-0004](../../../docs/adr/0004-accept-client-reported-scores.md) — untrusted for
values while still being bound by rules.

## Invariants enforced server-side

These hold regardless of what any client sends. Each is a schema constraint or a
policy, never application code.

| Invariant | Enforcement | Requirement |
|---|---|---|
| One committed score per entry, forever | `UNIQUE (draft_id, entry_id)`; no UPDATE or DELETE grant to any client role | FR-017, FR-018 |
| Roster names unique per draft, case-insensitive | `UNIQUE (draft_id, lower(name))` | FR-003 |
| At most 16 entries | `BEFORE INSERT` trigger | FR-002, FR-072 |
| Commit timestamps not client-set | `commit_at timestamptz DEFAULT now()`, column excluded from the insert grant | FR-037 |
| No commits after the deadline | Policy checks `now() <= draft.deadline` | FR-043 |
| Organizer actions unavailable from the player link | Policy requires the organizer secret, which is not in the player bundle | FR-006, FR-074 |
| Rules version pinned at commit | Insert copies `draft.rules_version`; mismatched commits rejected | FR-023 |

## Player operations

| Operation | Contract | Failure modes |
|---|---|---|
| `listDraft()` | Returns roster with claim state, run counts, abandonment counts, committed scores, deadline, finalized flag | Offline → serve last cached snapshot, marked stale |
| `createEntry(name)` | Creates and claims in one action (FR-008). Returns the entry | Name taken → rejected, name shown as taken. Cap reached → rejected naming the cap (FR-072) |
| `claimEntry(id)` | Binds an unclaimed entry to this player | Already claimed → rejected; first confirmed write wins (FR-012) |
| `incrementPractice(id)` | Records a *completed* practice run | Abandoned runs never call this (FR-066) |
| `incrementAbandoned(id)` | Records an abandoned official run | Public counter (FR-065) |
| `commitOfficial(id, score, outcome)` | The one irreversible write | Duplicate → rejected, "already committed". Past deadline → rejected. Offline → queued in outbox (FR-046) |

## Organizer operations

Available only with the organizer secret.

| Operation | Contract | Notes |
|---|---|---|
| `setDeadline(t)` | Changes the deadline | Warns before applying an elapsed time (FR-004) |
| `releaseClaim(id)` | Unbinds a claim on an uncommitted entry | FR-006 |
| `removeEntry(id)` | Removes an entry | Uncommitted: unrestricted (FR-007). Committed: requires confirmation naming the score, is recorded, and the entry stays visible as removed (FR-074) |
| `resetDraft()` | Destroys all committed scores | The only way to undo a finalized draft |

Renaming an entry with a committed score is **not** an operation. A wrong name on a
result is corrected by removal (FR-075).

## Commit durability

The one irreversible action gets the strongest handling in the system.

1. Run ends. Score computed locally from the simulation's terminal state.
2. Write to the **IndexedDB outbox** first, then attempt the server.
3. UI shows **pending**. It must not claim a leaderboard place (FR-047).
4. Retry with exponential backoff — 1 s, 2 s, 4 s, capped at 60 s — until the
   server confirms or rejects. The outbox survives reload and browser restart
   (FR-048).
5. On confirmation, clear the outbox entry and show the rank.
6. On rejection for duplicate, clear the outbox and show that the entry is already
   committed. **Do not retry** — a duplicate rejection is a correct outcome, not a
   transient failure.

The outbox is a transport buffer for a write already made. **Reading run counts,
claims, or scores from it is a defect** — that would make device-local storage
authoritative, which FR-021 forbids and which is the exact shortcut that would let
a player switch devices for a fresh official run.

## Propagation

Realtime subscription on the draft. A committed score must reach other viewers
within 10 seconds (FR-042). Polling fallback at 15 s where the subscription cannot
be established.
