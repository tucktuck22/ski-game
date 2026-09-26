# Data Model: Rejoin Any Name

This feature makes no schema change (research R3). It removes one field from the client's model and moves one value from session to local storage.

## Roster entry (`EntryView`, `src/state/ordering.ts`)

| Field                  | Change      | Notes                                                                                        |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `id`                   | unchanged   |                                                                                              |
| `name`                 | unchanged   |                                                                                              |
| `origin`               | unchanged   | `organizer` \| `self_created`                                                                |
| ~~`claimed`~~          | **removed** | No reader may remain (FR-308). The TypeScript compiler finds every one.                      |
| `practiceRunsUsed`     | unchanged   | Belongs to the name, not the device (FR-307)                                                 |
| `officialAttemptsUsed` | unchanged   | Spent at run start, in shared storage (FR-234, FR-307)                                       |
| `removed`              | unchanged   | Now the only reason a device drops its selection (FR-306)                                    |
| `score`, `commitAt`, `outcome` | unchanged | Best attempt                                                                            |

**Validation**: none new. Name uniqueness and the roster cap are unchanged.

**States shown to people** (derived, `statusOf`):

```
NOT STARTED ──practice──▶ PRACTISING (n/3) ──3 used──▶ READY — NOT YET OFFICIAL
     │                          │                              │
     └──────────────── official attempt started ───────────────┘
                                 ▼
                   IN PROGRESS — k of N USED ──▶ FINISHED / WIPED OUT / NO SCORE
```

`NOT STARTED` replaces both `UNCLAIMED` and `CLAIMED`.

## Database row (`roster_entry`)

`claimed_at timestamptz` stays in the table and is **retired**: it is never written or read by the client after this feature. Existing values in a live draft are ignored. `organizer_reset_draft` continues to null it, which is harmless. Dropping it is a possible later cleanup (research R3).

## Device selection (new home)

| Property | Before                                   | After                          |
| -------- | ---------------------------------------- | ------------------------------ |
| Storage  | `sessionStorage` via `safeSession`       | `localStorage` via `safeLocal` |
| Key      | `claim:<draftId>`                        | `pick:<draftId>`               |
| Value    | entry id                                 | entry id                       |
| Lifetime | until the tab closes                     | until backed out, or the entry is removed or gone |

**Transitions**:

```
         pick name / add name
(none) ─────────────────────────▶ <entryId>
   ▲                                  │
   ├──── NOT YOU? ────────────────────┤
   └──── entry removed or missing ────┘   (reconcileIdentity, FR-306)
```

Neither transition writes to shared storage.
