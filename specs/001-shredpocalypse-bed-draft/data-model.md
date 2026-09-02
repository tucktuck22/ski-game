# Phase 1 Data Model: Shredpocalypse '86

**Date**: 2026-09-01 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Two disjoint families of state, and keeping them disjoint is the design.

**Shared state** lives in Postgres, is authoritative, and decides the bed order.
**Simulation state** lives in memory for the duration of a run, is pure and
deterministic, and never touches the network. The only bridge between them is a
single committed score.

---

## Shared state

### Draft

The contest. Exactly one exists in v1 (FR-001, assumptions).

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | Primary key |
| `deadline` | timestamptz | Set and changeable by the organizer (FR-004). Compared against `now()` server-side, never a device clock (FR-037) |
| `course_seed` | bigint | Shared by every run. Source of all randomness (FR-024) |
| `rules_version` | text | Course, physics, and scoring version. Frozen at first commit (FR-023) |
| `organizer_secret` | text | Gates organizer actions. Absent from the player bundle (FR-006) |
| `finalized_at` | timestamptz, null | Set when the deadline passes; leaderboard reads FINAL (FR-043) |

**Transitions**: `open` → `finalized`. One-way. Reopening requires a reset, which
destroys all committed scores.

### RosterEntry

A named participant. May be created by the organizer or by any player-link holder
(FR-070).

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | Primary key |
| `draft_id` | uuid | → Draft |
| `name` | text | `UNIQUE (draft_id, lower(name))` (FR-003). Exact-match rejection only; near-duplicates are the organizer's problem (Edge Cases) |
| `origin` | enum | `organizer` \| `self_created`. Displayed on the leaderboard (FR-073) |
| `claimed_at` | timestamptz, null | First claim wins; later claims rejected (FR-012) |
| `practice_runs_used` | int | 0–3. Only completed runs increment it (FR-066) |
| `official_status` | enum | `unused` \| `committed` |
| `abandoned_official_runs` | int | Public count, shown on the leaderboard (FR-065) |
| `removed_at` | timestamptz, null | Organizer removal. Entry stays visible, marked removed (FR-074) |

**Cap**: at most 16 entries per draft, enforced by trigger, not by the client
(FR-002, FR-072).

**Transitions**:

```
created ──claim──> claimed ──official run ends──> committed
   │                  │                                │
   │                  └──abandon──> claimed            │
   │                     (counter++, official unused)  │
   └────────────────── removed <───────────────────────┘
                    (organizer only; committed removal
                     requires confirmation, FR-074)
```

`committed` is terminal for the player. Only the organizer can leave it, and only
by removal — never by rename (FR-075).

### CommittedScore

Immutable. The row that decides where somebody sleeps.

| Field | Type | Rules |
|---|---|---|
| `id` | uuid | Primary key |
| `draft_id` | uuid | → Draft |
| `entry_id` | uuid | → RosterEntry. `UNIQUE (draft_id, entry_id)` — this constraint *is* the one-run rule (FR-017, FR-018) |
| `score` | int | Base + trick + pickup total (FR-033) |
| `outcome` | enum | `finished` \| `wiped_out` |
| `commit_at` | timestamptz | `DEFAULT now()`, not client-writable. The tiebreaker (FR-037) |
| `rules_version` | text | Copied from Draft at commit (FR-023) |

No UPDATE or DELETE grant exists for any client role. Correction happens by
organizer removal of the parent entry, which is recorded and visible.

### Ordering

The bed order is derived, never stored:

1. Entries with a committed score, by `score` descending.
2. Ties by `commit_at` ascending — earlier commit ranks higher (FR-037).
3. Ties surviving that are displayed as unresolved and flagged for coin flip
   (FR-038).
4. Everyone else below, marked FORFEIT, as an **unordered group** carrying the
   coin-flip instruction. The system must not invent an order among them (FR-045).

---

## Simulation state

Held in memory for one run. Fully described by the fields below plus the seed and
the input sequence — which is what makes FR-026 provable and, later, replay
verification buildable without redesign.

### RunState

| Field | Type | Notes |
|---|---|---|
| `tick` | int | 60 Hz counter. The only clock the simulation has |
| `pos` | `{x, y}` float64 | Restricted to `+ - * /` (research R2) |
| `vel` | `{x, y}` float64 | |
| `angle` | float64 | Orientation, radians via lookup table |
| `angularVel` | float64 | Capped by tuning |
| `grounded` | bool | Contact with the terrain profile |
| `crouchCharge` | float64 | Accumulates while crouched; drives launch impulse (FR-078) |
| `rotationAccum` | float64 | Total rotation this air; converts to trick bonus on clean landing (FR-079) |
| `score` | int | Running total |
| `pickupsTaken` | uint32 bitset | Index into course pickups; prevents double-collection |
| `barriersBroken` | uint32 bitset | Index into course barriers |
| `outcome` | enum | `running` \| `finished` \| `wiped_out` |

**Transitions**: `running` → `finished` (finish line crossed) or `wiped_out`
(landing outside angle tolerance, collision above threshold, or release under a low
obstacle per FR-088). Both are terminal and both commit on an official run
(FR-017).

`abandoned` is deliberately **not** a simulation state. A run that ends without
reaching a terminal state simply never produces a score — that is what makes FR-019
work, and modelling it would imply the simulation knows something it cannot.

### RunInput

| Field | Type | Notes |
|---|---|---|
| `crouch` | bool | Held state. Release is the edge that launches |
| `rotate` | int | −1, 0, or +1 |
| `attack` | bool | Edge-triggered, cooldown from tuning |

Three inputs, matching FR-085's one-handed requirement. An input trace is an array
of these, one per tick — the second half of what reproduces a run exactly.

---

## Data files

Versioned, human-readable, loadable without recompile (FR-036). Schemas in
[contracts/course-data.md](contracts/course-data.md) and
[contracts/tuning-data.md](contracts/tuning-data.md).

| File | Contents | Governs |
|---|---|---|
| `data/courses/official.json` | Terrain profile, obstacles, barriers, pickups | FR-022, FR-068 |
| `data/courses/warmup.json` | Same schema, different terrain | FR-028, FR-067 |
| `data/tuning.json` | Every feel parameter with value and tolerance | FR-083 |
| `data/scoring.json` | Base, trick, and pickup values | FR-033, FR-034 |
| `data/insults.json` | Wipeout lines | FR-059 |

## Validation rules carried from the spec

- Roster name unique per draft, case-insensitive, exact match only (FR-003)
- At most 16 entries, enforced server-side (FR-002, FR-072)
- One committed score per entry, enforced by unique constraint (FR-018)
- `commit_at` server-assigned (FR-037)
- Commits rejected after `deadline`, except runs started before it (FR-043, FR-044)
- Completion bonus must exceed the maximum achievable bonus total, so every
  finisher outranks every non-finisher (FR-034) — a property of `scoring.json`,
  asserted by a test rather than assumed
- Every low obstacle followed by a safe release window (FR-089), asserted by the
  course validator (SC-016)
