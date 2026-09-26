# Implementation Plan: Rejoin Any Name

**Branch**: `claude/exciting-hawking-ad4qz9` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-rejoin-any-name/spec.md`

## Summary

A player who picked a name and left cannot get back to it. The device forgets them when the session ends (`sessionStorage`), and the roster hides any name with `claimed_at` set. Both backends also refuse to claim it again. The maintainer's direction is to remove claiming and releasing entirely, not to relax them. Selecting a name becomes a purely device-local choice, remembered in `localStorage`. Every non-removed name is always selectable. NOT YOU? is always available and touches nothing shared. Run limits stay on the name in shared storage, which is what keeps them honest when several devices pick the same name.

This is a client-only change. The `claimed_at` column stays in the database, retired and unread, so no operator has to paste SQL and old and new clients are safe in either deploy order (research R3).

## Technical Context

**Language/Version**: TypeScript (strict), ES modules, built with Vite

**Primary Dependencies**: `@supabase/supabase-js` (shared storage client). No new dependencies.

**Storage**: Supabase Postgres, shared, unchanged schema. Browser `localStorage` via the existing `safeLocal` wrapper for the device's pick.

**Testing**: Vitest (`tests/unit`), Playwright against the built artifact (`tests/e2e-build`, `npm run test:build`), and Playwright against mocked PostgREST (`tests/e2e-shared`, `npm run test:shared`)

**Target Platform**: Evergreen mobile web (Safari iOS 16+, Chromium/Firefox Android 10+, desktop equivalents)

**Project Type**: Single-page web game with a hosted database

**Performance Goals**: None affected. No simulation, render-loop or payload change of note; the code shrinks.

**Constraints**: No schema migration (R3). No new operator step (Principle VII). Simulation untouched, so determinism is unaffected.

**Scale/Scope**: One draft of up to 16 names and about 8 players. Touches roughly 6 source files and 20 test files, most of them a one-token selector rename (R8).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle | Assessment | Status |
| --------- | ---------- | ------ |
| I. Spec-Driven Delivery | Spec 010 exists. Feature 001's FR-008/012/021/091/092 are amended in the same change set (R10). Every task will trace to FR-300–309. | PASS |
| II. Stability Before Content | No schema change, so no migration or round-trip obligation. Simulation untouched. The "run in progress" rule is preserved: `reconcileIdentity` still defers during a run, and NOT YOU? is not reachable mid-run. | PASS |
| III. Fun Is Testable | No feel parameters touched. | N/A |
| IV. 1980s Voice | Existing buttons and panels only; one control is shown more often and one is removed. No new assets. | PASS |
| V. Fair Competition | Unchanged in substance. Run allowances stay in shared storage per name, so several devices on one name cannot multiply them (FR-307). The honor system was already the stated model, and ADR-0005 still governs. One small hole is recorded: concurrent practice-run writes (R6), which has no bed-order effect. | PASS (known gap stated) |
| VI. Shipped Artifact | New behavior is proven in CI against the built artifact at `/ski-game/` (`pick-name.spec.ts`) and against the wire format (`rejoin.spec.ts`). The gap is stated: the cross-session-with-persisted-counts case runs on the dev server, because the local backend does not persist (R9). | PASS (gap stated) |
| VII. Operator Instructions | No SQL, env or README step added or changed. The comment-only edits to `setup.sql` are still executed verbatim by the existing `invariants` CI job. | PASS |
| VIII. Player Judges Fun | Not a feel change. A human completion check is in `quickstart.md`. | N/A |

**Post-design re-check**: unchanged. The design adds no complexity. It deletes two store methods, one organizer control, one dialog and one field.

## Project Structure

### Documentation (this feature)

```text
specs/010-rejoin-any-name/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R10
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── draft-store.md
│   └── ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks, not yet created
```

### Source Code (files this feature touches)

```text
src/
├── main.ts                 # roster filter, pick handler, NOT YOU?, reconcileIdentity,
│                           #   safeSession→safeLocal, key claim:→pick:, remove [data-release] wiring
├── state/
│   ├── ordering.ts         # drop EntryView.claimed
│   ├── supabase.ts         # drop claimEntry, releaseClaim, claimed_at in createEntry + mapping
│   └── localDraft.ts       # same, mirrored
└── ui/
    ├── leaderboard.ts      # statusOf: NOT STARTED replaces UNCLAIMED/CLAIMED
    └── organizer.ts        # drop RELEASE + releaseClaim from OrganizerActions; State column text

supabase/
├── setup.sql               # comment only: claimed_at retired by feature 010
└── migrations/0001_init.sql  # comment only, same

tests/
├── unit/                   # leaderboard, organizer, ordering, run-economy: drop `claimed`, new words
├── e2e-shared/rejoin.spec.ts        # NEW — reproduces the reported bug on the wire
├── e2e-shared/postgrest.ts          # fixture drops claimed_at default; selector rename
├── e2e-build/pick-name.spec.ts      # NEW — resume, NOT YOU? after commit, no claim words
├── e2e-build/*, e2e-shared/*, e2e/us1, e2e/us3   # data-claim → data-pick
└── e2e/claim-identity.spec.ts       # DELETED — asserts removed behavior (R9)

specs/001-shredpocalypse-bed-draft/spec.md   # FR amendments (R10)
docs/adr/0010-organizer-actions-as-secret-gated-functions.md  # status note
```

**Structure Decision**: The existing single-project layout. No new modules; the change is subtractive apart from two test files.

## Sequencing

1. **Red first.** Write `tests/e2e-shared/rejoin.spec.ts` and show it failing on the current code. This is the constitution's "reproduce the original failure" step, and it proves the test is aimed at the real bug.
2. **Remove `EntryView.claimed`** and let `tsc` enumerate every reader. Fix each one per `contracts/`.
3. **Device memory**: `safeLocal`, `pick:` key.
4. **UI**: roster filter, NOT YOU? always and without a dialog, leaderboard and organizer text, RELEASE removed.
5. **Selector rename** `data-claim` → `data-pick` across the tests.
6. **`pick-name.spec.ts`**; delete `claim-identity.spec.ts`.
7. **Spec 001 amendments**, ADR-0010 note, SQL comments.
8. **Run the full quickstart suite.** Human check per `quickstart.md`.

## Risks and blind spots

- **Shared device.** A laptop passed around now opens as the last person's name until someone presses NOT YOU?. This is accepted in the spec, but it is the most likely way someone spends another person's official attempt. If it proves a problem in play, the cheap mitigation is a name confirmation on the official-run button only. That is out of scope unless you ask for it.
- **Stale cached clients mid-draft.** An old client still calls `claimEntry` and still filters on `claimed_at`. Its user will not see names that new clients have picked, because new clients never set `claimed_at`. That is fine: rows claimed before the deploy are the only ones hidden, and a reload fixes it. Nothing breaks in the other direction.
- **Practice-count race (R6).** Two devices on one name finishing practice together can grant one extra practice run. Accepted.

## Complexity Tracking

No constitution violations to justify.
