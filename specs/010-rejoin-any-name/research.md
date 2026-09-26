# Research: Rejoin Any Name

All decisions below were made against the code as of `29ab3bc`. The Technical Context in `plan.md` has no open unknowns. This file records the choices and what was rejected.

## R1. Root cause of the lockout

**Finding**: Two mechanisms combine.

1. `src/main.ts:488` and `:504` store the device's identity with `safeSession`, which is backed by `sessionStorage`. `sessionStorage` is cleared when the tab or browser closes, so FR-010 has only ever held within one session.
2. `renderRoster()` (`src/main.ts:405`) lists only entries where `!e.claimed`. The player's own row keeps `claimed_at` set in shared storage, so their name is hidden from them.

`claimEntry()` in both backends also refuses a name that is already claimed (`supabase.ts:227` `.is('claimed_at', null)`, `localDraft.ts:97`). So even if the roster showed the name, selecting it would fail with "Someone else just claimed that name."

**Consequence**: Fixing only (1) would help someone returning on the same device and nobody else. All three have to go.

## R2. Where the device remembers its selection

**Decision**: `safeLocal` (`localStorage`, already exported by `src/state/safeStorage.ts:68`), under the key `pick:<draftId>`.

**Rationale**: It survives the browser closing (FR-305), it is already wrapped for private mode and blocked storage, and it is scoped to this origin and draft. The new key name means a stale `claim:<draftId>` in `sessionStorage` is simply ignored: there's nothing to migrate, because `sessionStorage` never outlives a session anyway.

**Alternatives rejected**:
- *Keep `sessionStorage`*. That is the defect.
- *IndexedDB*. Asynchronous, and more machinery than one string needs.
- *A cookie*. It would be sent to the static host on every request, for no benefit.

## R3. What happens to `roster_entry.claimed_at` in the database

**Decision**: Leave the column in the schema. The client stops reading and writing it. No migration is shipped. A comment in `supabase/setup.sql` and `0001_init.sql`'s column list marks it retired by feature 010.

**Rationale**:
- **Principle VII.** Every operator step is a deliverable under test, and setup is where this project has spent almost all of its defect budget. A client-only change needs no SQL pasted into anyone's project.
- **Deploy-order safety.** GitHub Pages deploys the client automatically; migrations are pasted by hand. With the column left in place, old and new clients both work against either state of the database, in any order.
- **Principle II.** No schema change means no migration round-trip obligation and no risk to a live draft's scores.
- **Harmless leftovers.** `organizer_reset_draft` still nulls it, and the invariants test still checks that it is null after a reset. Both remain true and cost nothing.

**Alternatives rejected**:
- *Drop the column in migration 0006.* It is cleaner at rest, but it adds a manual operator step, a round-trip test, and a grant change in `0002_policies`/`setup.sql`. It also breaks any still-cached old client mid-draft: its `claimEntry` PATCH would fail, and it would strand the player exactly as today. It can be done later as a pure cleanup once no old client can be in the field. Logged as a follow-up, not part of this feature.

## R4. Reconciling identity against shared storage (FR-091)

**Decision**: Keep `reconcileIdentity()`, but its test becomes "does this entry still exist and is it not removed". The `claimed` check goes.

**Rationale**: FR-091's purpose was that the device must not trust its own memory over shared storage. That still applies to removal (FR-306). A release no longer exists, so there is nothing else to reconcile.

## R5. Backing out ("NOT YOU?")

**Decision**: Always rendered on the player screen. Mid-run is excluded automatically, because `render()` returns early while a run owns the screen. It makes no backend call and shows no confirmation dialog. It calls `forgetIdentity()`, which clears `pick:<draftId>` and the per-player commit banner.

**Rationale**: Backing out now changes nothing outside this device, so there is nothing to confirm and nothing that can fail over the network. The old confirmation said "Anyone can claim that name after you do". That's no longer true and would be misleading. A mistaken back-out is undone by tapping the name again.

**Alternatives rejected**: *Keep a confirm dialog.* It guards an action that costs one tap to reverse.

## R6. The run-start guard, now that two devices can share a name

**Finding**: Official attempts are counted in shared storage and spent when a run starts (`startOfficialAttempt`, FR-234). Practice counts are written per completed run. Two devices on one name therefore share one allowance; neither can multiply it (FR-307). This is not new: it already held for a player on two devices under FR-011.

**Known gap, accepted**: `recordPracticeRun(entryId, used)` writes an absolute count from the client's view. If two devices on the same name finish practice runs concurrently, the count can come out one low, which grants one extra practice run. Practice has no bearing on the bed order, and the honor system already accepts larger holes. Not fixed here; recorded in the plan.

## R7. What replaces "CLAIMED" / "UNCLAIMED" on the boards

**Decision**:
- **Leaderboard** (`statusOf`, `src/ui/leaderboard.ts:79`): an entry with no practice runs and no official attempts reads `NOT STARTED`. The branch returning `CLAIMED` goes the same way. Every other status is unchanged.
- **Organizer table** (`src/ui/organizer.ts:63`): the State column shows `COMMITTED <score>` or `NO SCORE YET`. The RELEASE button is removed (FR-309).

**Rationale**: FR-308 forbids any claimed/unclaimed presentation. FR-055 (no status by colour alone) is still met, because every state has a word.

## R8. The selection control's name in markup

**Decision**: Rename `data-claim` to `data-pick` across `src/main.ts` and every test that clicks it (about 25 call sites, all `button[data-claim]`).

**Rationale**: The user asked for the concept to be gone. A selector named "claim" would keep it alive in every test for the next reader. The change is mechanical and every call site is found by one grep.

## R9. Where the new behavior is proven (Principle VI)

**Decision**: Two layers, both run in CI.
1. **`tests/e2e-shared/rejoin.spec.ts`** (runs under `npm run test:shared` in the `smoke` job). This is the reported bug, reproduced faithfully. The mocked PostgREST fixture holds state across page loads, so the test can:
   - seed an entry whose `claimed_at` is already set (a claim from an earlier session), then open a fresh browser context and assert the name is offered and selectable, with its counts intact;
   - assert that selecting a name sends no `roster_entry` PATCH at all.
2. **`tests/e2e-build/pick-name.spec.ts`** (runs under `npm run test:build` against the built artifact at `/ski-game/`, local backend). It covers same-device resume across a reload, NOT YOU? after a committed score, back-out leaving the name listed, and no CLAIMED/UNCLAIMED text anywhere.

**Stated gap**: `test:shared` runs against the Vite dev server, not the built artifact. The cross-session-with-persisted-counts case is therefore proven on dev and only partly on the build, because the local backend's counts do not survive a reload. This is the same gap `attempts-are-spent` already carries.

`tests/e2e/claim-identity.spec.ts` is deleted. Every test in it asserts behavior this feature removes: organizer release, "frees the name", the claim-permanence lock. That suite is not run by CI anyway (constitution open deviation 2).

## R10. Governing-spec amendments (Principle I)

Feature 001's spec is amended in the same change set:
- **FR-008**: "claim exactly one unclaimed roster name… claimed names MUST be shown as claimed" → players select any roster name. Creating an entry selects it for its creator.
- **FR-012**: withdrawn (there are no races without claims).
- **FR-021**: "Run counts, claims, and committed scores" → "Run counts and committed scores".
- **FR-091**: narrowed to removal.
- **FR-092**: superseded by 010 FR-303/FR-304.
- **Honor-system assumption** (line 366): reworded.
- The two Q&A entries at lines 34–47 each get a one-line "Superseded by feature 010" note. The history stays readable.

ADR-0010 lists "release a claim" as one of four organizer actions. It gets a status note rather than a rewrite.
