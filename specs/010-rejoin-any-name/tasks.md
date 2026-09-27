---
description: 'Task list for feature 010: Rejoin Any Name'
---

# Tasks: Rejoin Any Name

**Input**: `specs/010-rejoin-any-name/`: spec.md (FR-300–309), plan.md, research.md (R1–R10), data-model.md, contracts/draft-store.md, contracts/ui.md, quickstart.md (Q1–Q6)

**Tests**: Required. The constitution's Definition of Done item 2 and Principle VI apply, and the plan's first step is to reproduce the reported bug before fixing it.

**Stop rules**:
- Nothing in `src/sim/` or `data/` changes.
- No SQL is executable-changed. Only comments may change in `supabase/` (research R3). If a task seems to need a migration, stop and raise it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 come back to my own name · US2 back out of the wrong name · US3 resume on the same device

---

## Phase 1: Setup

- [ ] T001 Record the before-state. Run `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run test:shared` and `npm run test:build`, and note each pass count in the scratchpad as `before-010.txt`. Anything already red is recorded, not fixed here.
- [ ] T002 Rename the roster selector `data-claim` → `data-pick`, with no behaviour change (research R8). In `src/main.ts` rename the attribute in `renderRoster()` (`data-claim="${e.id}"`) and in `wire()` (`[data-claim]`, `b.dataset['claim']` → `b.dataset['pick']`). Then run `grep -rl "data-claim" tests | xargs sed -i 's/data-claim/data-pick/g'`. That covers `tests/e2e-build/*.spec.ts`, `tests/e2e-shared/*.ts`, `tests/e2e/us1-claim-and-commit.spec.ts`, `tests/e2e/us3-organizer.spec.ts` and `tests/e2e/claim-identity.spec.ts`. Confirm `grep -rn "data-claim" src tests` is empty and `npm run test:build` still passes.

**Checkpoint**: same behaviour, new selector, suites green as in T001.

---

## Phase 2: Foundational

None. There is no shared prerequisite beyond T002. The claim model is removed inside US1, because removing it *is* the fix.

---

## Phase 3: User Story 1: Come back to my own name (P1) 🎯 MVP

**Goal**: Every non-removed name is on the roster and selecting it always succeeds, carrying that name's counts and score. Nothing in the draft records a claim. (FR-300, 301, 302, 307, 308)

**Independent test**: quickstart Q1 and Q2. An entry already carrying `claimed_at` from an earlier session is offered and selectable in a fresh browser, with its counts intact, and selecting sends no `roster_entry` write.

### Tests (write first; they MUST fail on the current code)

- [ ] T003 [US1] Create `tests/e2e-shared/rejoin.spec.ts` using `mockPostgrest`, `fixture` and `DRAFT_ID` from `tests/e2e-shared/postgrest.ts`. Add three tests:
  1. **The reported bug (FR-300, FR-301)**: `fixture({ entry: { ...fixture().entry, claimed_at: '2026-09-25T20:00:00Z', practice_runs_used: 2 } })`. Go to `/?draft=${DRAFT_ID}` and click `#drop-in`. Expect `button[data-pick]` with text `Tucker` to be visible, click it, and expect `#practice` to contain `1 left`.
  2. **Committed score carried (FR-302)**: seed `official_attempts_used: 1` plus one `scores` row (`entry_id: ENTRY_ID`, `attempt_no: 1`, `score: 41234`, `outcome: 'finished'`, `commit_at`), with `claimed_at` set. After picking, expect `#official` to contain `2 left` and the leaderboard to contain `41,234`.
  3. **No write on pick (contract draft-store.md)**: after picking in test 1, expect `f.patches` to equal `[]`.

  Put a header comment on the file citing spec 010 FR-300/301 and naming the bug in the maintainer's words: "I can't come back in a subsequent session once I've already claimed myself once".
- [ ] T004 [US1] Prove T003 is aimed at the bug. Run `npm run test:shared -- rejoin` on the current `src/` and confirm test 1 FAILS: `Tucker` is not listed, because `renderRoster()` filters `!e.claimed`. Record the failure line in the scratchpad `before-010.txt`. Do not proceed if it passes.
- [ ] T005 [P] [US1] In `tests/unit/leaderboard.test.ts`, change the FR-055 word list (line ~72) from `'UNCLAIMED'` to `'NOT STARTED'`. Add a test asserting that `renderLeaderboard` output for a mix of fresh, practising and committed entries contains neither `CLAIMED` nor `UNCLAIMED` (regex `/\bUN?CLAIMED\b/`) (FR-308). Remove the `claimed:` property from the `e()` factory and from the `Zach` entry at line ~29.

### Implementation

- [ ] T006 [US1] Remove `claimed: boolean` from `EntryView` in `src/state/ordering.ts`. Then run `npx tsc --noEmit` and keep its error list as the checklist for T007–T010 and T013.
- [ ] T007 [P] [US1] In `src/state/supabase.ts`:
  - delete `claimEntry()` (lines ~221–233) and its FR-012 doc comment;
  - delete `releaseClaim()` (lines ~324–330);
  - in `createEntry()`, drop `claimed_at: new Date().toISOString()` from the insert and change its doc comment to "FR-070: self-serve creation; the caller adopts the new entry as this device's pick";
  - in `snapshot()`'s mapping, drop `claimed: e.claimed_at !== null`.

  `select('*')` stays. `claimed_at` still arrives and is ignored.
- [ ] T008 [P] [US1] In `src/state/localDraft.ts`:
  - delete `claimEntry()` and `releaseClaim()`;
  - remove `claimed:` from `createEntry()`, `seedOrganizerEntry()` and `resetDraft()`.
- [ ] T009 [P] [US1] In `src/ui/leaderboard.ts` `statusOf()`: replace `if (!e.claimed) return 'UNCLAIMED';` with nothing, and change the final `return 'CLAIMED';` to `return 'NOT STARTED';`. Update the function's doc comment to say "NOT STARTED" is a name with no runs of either kind (research R7).
- [ ] T010 [US1] In `src/main.ts`, update the roster and pick:
  - `renderRoster()`: filter only `!e.removed`. Rename the local `unclaimed` to `names`. Delete the `'<em>Every name is claimed.</em>'` fallback, using `''` instead.
  - `wire()` `[data-pick]` handler: make it synchronous. Set `myEntryId = id`, `rosterError = ''`, and `safeSession.set(\`claim:${DRAFT_ID}\`, id)` (storage moves in T022), then call `render()`. No `backend.claimEntry` call, no `await refresh()`, no error branch.
  - Add a short comment citing FR-301: picking is device-local, so there is nothing to refuse.
- [ ] T011 [US1] In `src/main.ts` `reconcileIdentity()`, change the keep condition to `if (mine !== undefined && !mine.removed) return;`. Rewrite the function's doc comment: shared storage still decides whether the entry exists (FR-091 as amended, FR-306), and a release no longer exists. Keep the mid-run early return and its comment.
- [ ] T012 [P] [US1] Remove `claimed:` from the entry factories in `tests/unit/ordering.test.ts` (line ~11) and `tests/unit/run-economy.test.ts` (line ~23).
- [ ] T013 [US1] Run `npx tsc --noEmit`, `npm run lint` and `npm run test:unit`. Every T006 error is gone, apart from `OrganizerActions.releaseClaim` / `[data-release]`, which T017 removes. If `tsc` still fails only there, stub nothing; do T017 next.
- [ ] T014 [US1] Run `npm run test:shared -- rejoin`. All three T003 tests pass. Then run the full `npm run test:shared` to show nothing else broke.

**Checkpoint**: MVP. The reported bug is fixed on the wire and in the UI. A returning player on any device can pick their name. (Same-device auto-resume across browser restarts is still US3.)

---

## Phase 4: User Story 2: Back out of the wrong name (P1)

**Goal**: NOT YOU? is always available outside a run, is instant, and changes nothing shared. The organizer's RELEASE is gone. (FR-303, 304, 308, 309)

**Independent test**: quickstart Q4 and Q5. Pick, back out and pick another name with no dialog. After a committed attempt NOT YOU? is still there, and the name stays listed with its score.

### Tests

- [ ] T015 [P] [US2] In `tests/unit/organizer.test.ts`:
  - replace the test `'offers RELEASE only for a claimed but uncommitted entry'` (line ~59) with `'offers no RELEASE control, for any entry (FR-309)'`, asserting that `renderOrganizer` output contains no `data-release` for fresh, practising and committed entries;
  - add an assertion that the State cell reads `NO SCORE YET` for an entry without a score and `COMMITTED 41,234` for one with a score;
  - assert that the output never matches `/\bUN?CLAIMED\b/`;
  - remove `claimed:` from the `e()` factory (line ~13).
- [ ] T016 [US2] Create `tests/e2e-build/pick-name.spec.ts` (built artifact, local backend, `dropIn(page, './')` from `tests/e2e-build/helpers.ts`) with these tests:
  1. **No dialog on back-out (FR-304)**: register `page.on('dialog', () => { throw new Error('unexpected dialog'); })`. Pick the first name, then click `#not-me`. Expect `#new-name` to be visible and `button[data-pick]` with that name to still be visible.
  2. **Pick again**: pick the wrong name, click `#not-me`, pick the right one. The board says `You are <right>` and not `You are <wrong>`.
  3. **Back-out allowed after a committed attempt (FR-303)**: pick, then `#official` → `#go`. Wait for `.sfx` (timeout 90s), then `#done`. Expect `#not-me` to be visible. Click it. Expect the name to still be on the roster. Pick it again and expect `#official` to contain `2 left`. (This replaces claim-identity's FR-092 test, which asserted the opposite.)
  4. **No claim words anywhere (FR-308, FR-309)**: open `./?organizer=test-secret` and drop in. Expect the page text not to match `/\bUN?CLAIMED\b/`, and `[data-release]` to have count 0.

  Header comment citing spec 010 US2.

### Implementation

- [ ] T017 [US2] In `src/ui/organizer.ts`:
  - remove `releaseClaim` from `OrganizerActions`;
  - in `rowFor()`, change the State cell to `${committed ? \`COMMITTED ${e.score!.toLocaleString()}\` : 'NO SCORE YET'}` and delete the `data-release` button.
- [ ] T018 [US2] In `src/main.ts`:
  - delete the `[data-release]` wiring block (lines ~628–631);
  - in `renderPlayer()`, render `#not-me` unconditionally, deleting the `me.score === null ? … : ''` ternary and its FR-092 comment. Replace them with one line: backing out is device-local, so it is safe at any time (FR-303). Mid-run is already excluded, because `render()` returns while `game` is set.
  - replace the `notMe.onclick` body with `forgetIdentity(); render();`. No `confirm()`, no `backend` call, no try/catch.
  - rewrite the doc comment above it. The old one explained why the claim is released rather than forgotten; now forgetting is the whole action, because there is no claim (FR-304, research R5).
- [ ] T019 [US2] Delete `tests/e2e/claim-identity.spec.ts`. Every test in it asserts removed behaviour (organizer release, "frees the name", the FR-092 lock). Its still-valid "pick again" case now lives in T016 test 2 (research R9). Then run `npx tsc --noEmit`, `npm run lint`, `npm run test:unit` and `npm run test:build -- pick-name`. T016 tests 1, 2 and 4 pass. Test 3 passes once the device keeps its pick across the run, which it already does in-session.

**Checkpoint**: US1 + US2 complete. Back-out is free, and the organizer has nothing to release.

---

## Phase 5: User Story 3: Resume automatically on the same device (P2)

**Goal**: The device's pick survives the browser closing, and is dropped only by NOT YOU? or by the entry's removal. (FR-305, 306)

**Independent test**: quickstart Q3 and Q6. Pick, close the page, open a new one: back in without the roster. When the organizer removes the entry, the device returns to the roster.

### Tests

- [ ] T020 [US3] Add to `tests/e2e-build/pick-name.spec.ts`:
  5. **Resume after the browser closed (FR-305)**: pick the first name, `page.close()`, then `const p2 = await context.newPage()` in the same `BrowserContext` and `dropIn(p2, './')`. Expect `You are <name>` without clicking any `button[data-pick]`. A new page keeps `localStorage` but starts with empty `sessionStorage`, which is the browser-restart case. A plain `page.reload()` would NOT do: `sessionStorage` survives a reload, so the test would pass on the broken code.
  6. **Back-out is remembered (US3 scenario 2)**: pick, `#not-me`, close the page, open a new page in the same context, `dropIn`. Expect `#new-name` to be visible and no `You are`.
  7. **Removal drops the pick (FR-306)**: on `./?organizer=test-secret`, drop in and pick the first name. With `page.on('dialog', d => d.accept())`, click that row's `[data-remove]` in the organizer panel. Expect `#new-name` to be visible, and the name not to be among `button[data-pick]`.

  Run it before T022 and confirm test 5 FAILS (the new page shows the roster). Do not proceed if it passes.
- [ ] T021 [P] [US3] In `tests/unit/safe-storage.test.ts` (lines ~59–62), change the example key from `'claim:draft-1'` to `'pick:draft-1'`, and add the same set/get/remove round-trip for `safeLocal`.

### Implementation

- [ ] T022 [US3] In `src/main.ts`, switch device memory to `safeLocal` under the key `pick:${DRAFT_ID}` (research R2):
  - import `safeLocal` alongside `safeSession` from `./state/safeStorage.js`, and drop `safeSession` if it has no other user;
  - replace all three `safeSession.set(\`claim:${DRAFT_ID}\`, …)` calls (the pick handler, `#add-name`), the `safeSession.remove` in `forgetIdentity()`, and `myEntryId = safeSession.get(\`claim:${DRAFT_ID}\`)` at startup (line ~934).

  Add one comment at the startup read: FR-010/FR-305. This is local storage on purpose; session storage ended with the tab, which was half of the reported bug.
- [ ] T023 [US3] Run `npm run test:build -- pick-name`: all seven tests pass. Also run `npm run test:shared`: `attempts-ux.spec.ts` still passes. Update that file's comment at lines ~36–38, which describes `claim:<draft>` in session storage, to say `pick:<draft>` in local storage.

**Checkpoint**: all three stories complete.

---

## Phase 6: Polish and cross-cutting

- [ ] T024 [P] Amend `specs/001-shredpocalypse-bed-draft/spec.md` per research R10 (Principle I: same change set):
  - **FR-008**: players select any roster name; creating an entry selects it for its creator; no name is shown as claimed.
  - **FR-012**: `~~struck~~` with "Withdrawn by feature 010: there are no claims to race."
  - **FR-021**: drop "claims".
  - **FR-091**: narrowed to removal.
  - **FR-092**: "Superseded by feature 010 FR-303/FR-304."
  - **The honor-system assumption (line ~366)**: "anyone can select any name, including someone else's".
  - **The two Q&A entries at lines ~33–47**: append "Superseded by feature 010 (claims removed)."
- [ ] T025 [P] Add a status note at the top of `docs/adr/0010-organizer-actions-as-secret-gated-functions.md`: "Feature 010 (2026-09) removed claim release; three organizer actions remain."
- [ ] T026 [P] Comment-only SQL edits (research R3). On the `claimed_at` column line in `supabase/setup.sql` (~46) and `supabase/migrations/0001_init.sql` (~22), append `-- retired by feature 010: never read or written by the client`. On the grant comment in `setup.sql` (~207) and `supabase/migrations/0002_policies.sql` (~55), replace "claimed_at is how a claim is taken (FR-012)" with "claimed_at is retired (feature 010) and kept only so no migration is needed". Change no statements.
- [ ] T027 [P] Rename the title of `tests/e2e/us1-claim-and-commit.spec.ts`'s describe block and first test to "pick, practise, commit" / "a player picks a name…". Leave the filename unchanged to keep history.
- [ ] T028 Run the full-sweep check from quickstart: `grep -rnE "claimEntry|releaseClaim|data-claim|data-release|UNCLAIMED|claim:\\$" src tests` returns nothing. Then `grep -rn "claimed" src` returns nothing. `claimed_at` may remain only in `tests/e2e-shared/` fixtures, where it mirrors the real row, and in `supabase/`.
- [ ] T029 Run the full CI-equivalent suite: `npx tsc --noEmit && npm run lint && npm run test:unit && npm run test:sim && npm run test:course && npm run test:shared && npm run test:build`. Compare the counts to `before-010.txt`. Expected changes: +3 shared, +7 build, and a net change in unit tests. There must be no new failures. Name the commands and the environment (the cloud container, Chromium) in the commit message, per DoD item 7.
- [ ] T030 Update `specs/010-rejoin-any-name/spec.md` **Status** to "Implemented, awaiting play pass". Ask the maintainer for the quickstart manual check: steps 1–3 on the deployed build, or on `npm run build:artifact` if they want it before merge. Record their findings under a new "Play pass" heading in the spec, in their words (DoD item 6).

---

## Dependencies

```
T001 → T002 → US1 (T003 → T004 → T006 → {T007,T008,T009,T012} → T010 → T011 → T013 → T014)
                   T005 can start any time after T002
US1 → US2 (T017/T018 edit the same main.ts and depend on T006 having removed `claimed`)
US1 → US3 (T022 touches the pick handler that T010 rewrote)
US2 and US3 both edit src/main.ts, so run them sequentially (either order). Their test files are separate.
Polish T024–T027 can start any time; T028–T030 go last.
```

## Parallel examples

- After T006: T007 (`supabase.ts`), T008 (`localDraft.ts`), T009 (`leaderboard.ts`) and T012 (unit factories) together.
- T005, T015 and T021: unit test files, independent of each other.
- T024, T025, T026 and T027: docs, SQL comments and test titles. No code overlap.

## Implementation strategy

- **MVP = Phase 1 + US1 (T001–T014).** That alone fixes what was reported: a returning player can find and pick their name on any device. It is shippable on its own, though NOT YOU? would still show a now-meaningless confirm dialog until US2.
- **US2 next.** It removes the last user-visible trace of claiming (dialog, RELEASE) and is small.
- **US3 last.** It is the convenience layer. With US1 in, missing it costs one tap.
- One commit per phase keeps each checkpoint reviewable. Push after T029 is green.
