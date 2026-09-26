# Contract: Draft store (player and organizer surface)

The store interface is implemented twice: `DraftStore` (`src/state/supabase.ts`) and `LocalDraftStore` (`src/state/localDraft.ts`). Both MUST change identically.

## Removed

| Member                                                   | Was                                                        | Why removed                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `claimEntry(id): Promise<{ok:true}\|{ok:false,reason}>`  | PATCH `claimed_at = now()` where `claimed_at is null`       | Selecting a name is device-local (FR-301). There is nothing to write.        |
| `releaseClaim(id): Promise<void>`                        | PATCH `claimed_at = null`                                  | Nothing to release (FR-309). Also removed from `OrganizerActions`.           |
| `seedOrganizerEntry` setting `claimed:false`             | local mode only                                            | The field no longer exists.                                                  |

## Changed

| Member                                    | Change                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `createEntry(name)`                       | Stops sending `claimed_at` in the INSERT. The caller still adopts the returned id as this device's pick. |
| `snapshot()` → `EntryView`                | No `claimed` field. `select('*')` still returns `claimed_at`; the mapping ignores it.                     |
| `resetDraft()` (local)                    | Stops setting `claimed`.                                                                                  |

## Unchanged (and relied on)

- `startOfficialAttempt`, `recordPracticeRun`, `submitCommit`: keyed by entry id, counted in shared storage. This is what keeps FR-307 true when several devices select the same name.
- `removeEntry`: the organizer's remedy for an unwanted score or entry. It is also the only thing that ends a device's selection from outside (FR-306).

## Wire-level guarantee (asserted in `tests/e2e-shared/rejoin.spec.ts`)

Selecting a roster name and backing out MUST send **no** request to `roster_entry`, whether PATCH, POST or RPC.
