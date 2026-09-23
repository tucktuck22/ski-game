---
description: 'Task list for feature 007 — Three Attempts, Best One Counts'
---

# Tasks: Three Attempts, Best One Counts

**Input**: Design documents from `/specs/007-best-of-three-official/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/storage-api.md](./contracts/storage-api.md),
[quickstart.md](./quickstart.md)

**Tests**: **Required, not optional.** The template treats test tasks as optional; this
project's constitution does not. Principle II requires automated tests covering the
behaviour, and Definition of Done item 2 repeats it. Every phase below carries its tests.

**Organization**: Grouped by user story. US1 and US2 are both P1 and ship together —
spec.md is explicit that US2 "ships with User Story 1 or the feature does not deliver
what it claims", so the MVP is both.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1, US2, US3. Setup, Foundational, Playtest and Polish phases carry none
- Every task names its file path and the requirement it traces to (Principle I)

## Path Conventions

Single project. `src/` and `tests/` at repository root; SQL under `supabase/`.

---

## A note on playtest ordering — read before starting

**Revised 2026-09-14.** The organizer answered three of the four playtest questions in
advance, which changes what the play passes are for.

| Question                                      | Status                                                         |
| --------------------------------------------- | -------------------------------------------------------------- |
| Does three attempts feel right?               | **Answered**: _"3 is right."_                                  |
| Does losing an attempt to a bail feel fair?   | **Answered**: _"Losing a run to a crashed tab is acceptable."_ |
| Defend the count against tampering?           | **Answered**: no — _"we can count on honorable behavior."_     |
| Does the tripled session outstay its welcome? | **OPEN** — only play answers this                              |

Answered by acceptance rather than by play, and recorded that way in
[spec.md](./spec.md); feature 006 logged two of its four the same way. So:

- **Playtest A (Phase 5)** now carries **one** open question — session length — rather
  than three. It stays where it is: it is still the first playable point, and a session
  that outstays its welcome is cheapest to fix before the course or the allowances are
  written into constraints.
- **Playtest B (Phase 8)** is no longer a blocking design gate, because the question it
  existed to ask is settled. It becomes **verification** that the tab-kill behaviour works
  against real storage, plus one informal question: did the acceptance survive contact?

The structural reason for the split is unchanged and still worth knowing.
`src/state/localDraft.ts` is in-memory with no persistence, and there is **no in-app quit
path during a run**, so the only way to abandon is to kill the tab — which in local mode
destroys the draft rather than costing an attempt. The bail cannot be exercised at all
until Phase 7.

## Phase 1: Setup

**Purpose**: Establish the baseline this feature will be measured against.

- [x] T001 Confirm the suite is green before any change — `npm run lint`, `npx tsc --noEmit`, `npm test` — and record the pass/fail counts in this file under Notes. A baseline nobody captured is not a baseline (Definition of Done item 8)
- [x] T002 [P] Record the current `rulesVersion` (`2.0.0`, `tools/gen-courses.ts:558` and `:606`) and confirm no live draft holds committed scores, re-verifying the spec Assumption that permits shipping without a reset (FR-243)
- [x] T003 [P] Read `supabase/tests/invariants.sql` end to end and note the deliberate-violation block style; Phase 7 extends this file and must match it rather than inventing a second idiom

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared attempt model, plus the three latent defects from
[research.md](./research.md) that become live bugs the moment three attempts exist.

**⚠️ CRITICAL**: No user story work begins until this phase is complete. All three
defects are silent — none would fail a build — so they are fixed deliberately here
rather than discovered in play.

- [x] T004 Extend `EntryView` in `src/state/ordering.ts`: replace `officialStatus: 'unused' | 'committed'` with `officialAttemptsUsed: number` (0–3), keeping `score` and `commitAt` as the **best** attempt's values so `computeStandings` needs no change (FR-231, FR-235, research R5)
- [x] T005 **D1 — the allowance is data, not a constant.** Add `officialAttempts: 3` to `data/tuning.json`, validate it in `parseTuning` (`src/data/load.ts`) as a positive integer like every other key, and read it in `src/state/runEconomy.ts` via an `attemptsRemaining()` helper. Principle III is a MUST and T030/T031 already anticipate play moving this number (FR-231, FR-245, research R10)
- [x] T006 Add `attemptNo: number` to `PendingCommit` in `src/state/outbox.ts` (FR-231, contracts/storage-api.md)
- [x] T007 **Defect 1 — outbox key collision.** Change the enqueue key at `src/main.ts:735` from `` `${me.id}-official` `` to `` `${me.id}-official-${attemptNo}` ``. The IndexedDB store uses `keyPath: 'id'` and `put()`, so today a second attempt queued while the first is still pending overwrites it — destroying a score that may be the player's best, on exactly the wifi the outbox exists for (research R3, FR-046)
- [x] T008 [P] **Defect 1 test.** In `tests/unit/outbox.test.ts`, queue two attempts for one entry without draining and assert both survive. Assert it against the real key-generation path, not a hand-written key, or the test passes while the bug ships (research R3)
- [x] T009 **Defect 2 — snapshot keeps the wrong row.** Replace the score map at `src/state/supabase.ts:137` with a reduction to the best attempt: highest score, ties to the earliest `commit_at`. `new Map(pairs)` keeps the **last** value per key, and with no `ORDER BY` the row returned last is unspecified — so the bed order would be wrong and would not reproduce (research R4, FR-232, FR-236)
- [x] T010 [P] Extract that reduction as a pure exported function (`bestAttempt`) in `src/state/ordering.ts` so it is unit-testable without a server and is shared by both backends, matching how this project already tests bed-order rules (`ordering.ts:6`, research R4, R6)
- [x] T011 [P] **Defect 2 test.** In `tests/unit/ordering.test.ts`, assert `bestAttempt` picks the highest score regardless of input order, and that a tie carries the **earlier** timestamp — the FR-236 property that stops a player losing a tiebreak by taking an attempt he was entitled to. Assert that property directly, as SC-086 states it: a player is never ranked lower for having used an attempt (FR-232, FR-236, SC-086)
- [x] T012 **Defect 3 — idempotency.** Record in `contracts/storage-api.md` (already written) and in the Phase 7 migration that `UNIQUE (draft_id, entry_id, attempt_no)` is what preserves retry idempotency. No code here; this task is the check that Phase 7 does not simply drop the old index (research R1, FR-237)

**Checkpoint**: The attempt model exists and the three silent defects are closed. User story work can begin.

---

## Phase 3: User Story 1 — Three attempts, best one counts (Priority: P1) 🎯 MVP

**Goal**: A player takes up to three attempts; the highest stands and decides his bed pick.

**Independent Test**: Take three attempts with known scores in any order; the leaderboard
shows the highest and only the highest (quickstart Scenario 1, SC-082).

### Tests for User Story 1 ⚠️

- [x] T013 [P] [US1] In `tests/unit/run-economy.test.ts`, rewrite the official-run cases for three attempts: availability at 0, 1, 2 and 3 used; `courseFor` still refusing the official course to practice and free play until attempts are exhausted. Include the case FR-238 turns on: an attempt ending in a **wipeout** commits its score and leaves the remaining attempts available (FR-231, FR-238, FR-244, FR-068)
- [x] T014 [P] [US1] In `tests/unit/ordering.test.ts`, assert `computeStandings` ranks two players on their best attempts and that a lower later attempt never displaces a higher earlier one (FR-232, SC-082)

### Implementation for User Story 1

- [x] T015 [US1] Rewrite `availability()` in `src/state/runEconomy.ts` against `officialAttemptsUsed`: official available while used < 3 and the draft is live; `blockedReason` distinguishes "all three used" from "the deadline has passed" (FR-231, FR-240, FR-241)
- [x] T016 [US1] Rewrite `hasCommitted()` in `src/state/runEconomy.ts` as `isFinished()` — true when three attempts are used or the deadline has passed — and update `courseFor()` so free play reaches the official course only then (FR-068, FR-244)
- [x] T017 [US1] Update `src/state/localDraft.ts`'s `snapshot()` to store attempts as a list per entry and expose the best via the shared `bestAttempt` from T010, so local mode and Supabase agree by construction rather than by coincidence (research R6)
- [x] T018 [US1] Replace `submitCommit`'s single-commit refusal in `src/state/localDraft.ts` with the per-attempt rule: reject a duplicate `(entryId, attemptNo)`, reject `attemptNo` outside 1–3, mirroring the constraints Phase 7 adds to Postgres (research R6, R1)
- [x] T019 [US1] Update `endRun()` in `src/main.ts` to enqueue with the attempt number and to stop calling `markOfficialRunEnded` — that write moves earlier, to the start of the run in Phase 4 (contracts/storage-api.md, FR-234)
- [x] T020 [US1] Update the menu in `src/main.ts:409` so the official control reads attempts remaining (e.g. `OFFICIAL RUN (2 left)`), matching the existing practice control's idiom, and is disabled at zero. Attempts remaining and best score must both be visible without scrolling at 375 × 667 CSS px — assert it in `tests/e2e/` at that viewport, since every suite currently runs Desktop Chrome and would not catch a regression (FR-239, FR-055, SC-087)
- [x] T021 [US1] Update the menu copy at `src/main.ts:422` — "The official run is a course you have not seen" is no longer true after attempt one and a spec that disagrees with shipped behaviour is a defect (Principle I, spec Accepted Consequences)

**Checkpoint**: Best-of-three works end to end in local mode. Attempts are not yet spent on start.

---

## Phase 4: User Story 2 — Starting an attempt spends it (Priority: P1)

**Goal**: Starting an attempt consumes it. Abandoning costs it and scores nothing.

**Independent Test**: Start an attempt, end the session before any end state, reopen; one
fewer attempt and no score (quickstart Scenario 2, SC-083). **Fully verifiable only once
Phase 7 lands** — see the playtest note above and T028.

### Tests for User Story 2 ⚠️

- [x] T022 [P] [US2] In `tests/unit/run-economy.test.ts`, assert an attempt allocated but never committed still counts against the allowance — the abandonment case, expressed as counter-minus-rows (FR-233, data-model.md Derived values)
- [x] T023 [P] [US2] In `tests/contract/storage.test.ts`, assert both backends refuse a fourth `startOfficialAttempt` and that neither exposes a way to lower the counter (FR-233, FR-235, research R2)

### Implementation for User Story 2

- [x] T024 [US2] Add `startOfficialAttempt(entryId)` to the local backend in `src/state/localDraft.ts`: increments, returns 1–3, refuses beyond three and after the deadline (contracts/storage-api.md, FR-233, FR-241)
- [x] T025 [US2] Add `startOfficialAttempt(entryId, used)` to `src/state/supabase.ts` as a plain column update on `official_attempts_used`, mirroring `recordPracticeRun` at `src/state/supabase.ts:213`, and delete `markOfficialRunEnded` with its call site (research R2, FR-234)
- [x] T026 [US2] In `startRun()` (`src/main.ts:648`), advance the attempt counter **before** gameplay begins but do **not** await it as a gate: a failed write must not stop the run, matching how `markOfficialRunEnded` was "best effort by design" (`src/main.ts:754`). Spending at start rather than at end is the point; blocking on the network is not (FR-234, research R2)
- [x] T027 [US2] Show attempts remaining optimistically from local state and let the next snapshot correct it, as the practice counter already does. Do **not** add a failure screen — the counter write no longer gates the run, so the "could not start" state does not exist. Assert in `tests/e2e/` that going offline still starts a run (FR-234, research R9, quickstart Scenario 5)
- [x] T028 [US2] Rewrite `tests/e2e-shared/official-run-is-spent.spec.ts` as `attempts-are-spent.spec.ts`: an attempt is spent at start whatever the commit does, and a refused commit does not return it. This is the spec that held the original bug shut and it must keep holding under three attempts (FR-233, FR-234)

**Checkpoint**: MVP complete. Both P1 stories work; the rule is still client-side only until Phase 7.

---

## Phase 5: Playtest A — the one question still open (Principle VIII)

**Still blocking**, though for a narrower reason than before. The attempt count is settled;
what is not is whether a session of up to three practice runs plus three 12,000-unit
attempts is too long. That is cheapest to learn here, before Phase 7 writes allowances
into constraints.

- [x] T029 Publish a playable single-file build — `npm run build:artifact` — and hand over the link, naming the commit it was built from (Principle VIII, Definition of Done item 6)
- [ ] T030 Ask the player two questions and record both **in his own words** in `spec.md`: (1) does the session outstay its welcome now that it roughly triples, and if so is the answer fewer attempts, fewer practice runs, or a shorter official course? (2) is attempt 1 still a cold read worth having now that 2 and 3 are informed by it? The first is the open gate; the second is free to ask while someone is holding the phone (Principle VIII, quickstart Playtest)
- [ ] T031 If the answers move the attempt count or the practice allowance, change `officialAttempts` in `data/tuning.json` and amend `spec.md` FR-231/FR-244 to match. No migration is needed — the allowance is data, and the schema carries only a sanity rail (FR-245, research R10, Principle I)

**Checkpoint**: the last tunable nobody can settle from a desk is settled.

---

## Phase 6: User Story 3 — The board reads honestly (Priority: P2)

**Goal**: Everyone can see who is mid-competition and who is done, without mistaking a
partial result for a final one.

**Independent Test**: With players at 0, 1, 2 and 3 attempts used, every row states
attempts used and only a finished player reads as final (SC-085).

### Tests for User Story 3 ⚠️

- [ ] T032 [P] [US3] In `tests/unit/leaderboard.test.ts`, assert `statusOf` at every attempt count 0–3, before and after the deadline (FR-239, SC-085)

### Implementation for User Story 3

- [ ] T033 [US3] Extend `statusOf()` in `src/ui/leaderboard.ts:54` to report official attempts alongside practice — a player mid-competition must never present as final (FR-239)
- [ ] T034 [US3] Show attempts used on each leaderboard row, not carried by colour alone (FR-239, FR-055)
- [ ] T035 [P] [US3] Assert the forfeit case is undistinguished: a player who abandoned all three and one who never played read identically (FR-242, spec Edge Cases)
- [ ] T036 [P] [US3] Confirm the deadline case — after FINAL, unused attempts are irrelevant and everyone reads as final (FR-241, SC-085)

**Checkpoint**: All three stories work against local mode.

---

## Phase 7: Shared storage — where the rule becomes real

**Purpose**: Until this phase the three-attempt limit is client-side, which FR-235 does
not accept. This is what makes the feature's central fairness claim true.

- [ ] T037 Write `supabase/migrations/0005_best_of_three.sql` per [research R7](./research.md#r7--migration-strategy): add `official_attempts_used` (`CHECK >= 0`) backfilled from `official_status`; add `attempt_no` to `committed_score` backfilled to 1; drop `committed_score_one_per_entry`; create `UNIQUE (draft_id, entry_id, attempt_no)` and `CHECK (attempt_no between 1 and 9)`. The CHECK is a **sanity rail, not the allowance** — a schema that could veto the tuning value would make it half-obeyed (FR-231, FR-237, FR-245, research R10)
- [ ] T038 Add `official_attempts_used` to the **column-level** UPDATE grant on `roster_entry` in that migration, alongside `practice_runs_used`. `0002_policies.sql` grants specific columns, not the table, so a new column is unwritable until it is named — the client would silently fail to spend attempts (FR-235, research R2)
- [ ] T039 Confirm that grant stays **column-scoped**: `name`, `origin`, `removed_at` and `removed_score` remain revoked, so widening it for the counter does not hand players organizer territory. There is deliberately **no** `security definer` function and **no** revoke of the counter — the organizer ruled the count honour-system on 2026-09-14 (FR-006, research R2)
- [ ] T040 Verify the migration is safe run **standalone** against a project that already has data, not only as part of a fresh `setup.sql` — the README documents organizers pasting single migrations for exactly this reason (Principle VII, research R7)
- [ ] T041 Append 0005 to `supabase/setup.sql` — it is a hand-maintained concatenation, not generated — and update its header comment, which currently advertises "one committed score per entry, forever" (Principle VII)
- [ ] T042 [P] Extend `supabase/tests/invariants.sql` with the new deliberate violations: a fourth attempt row rejected; `attempt_no` of 0 or 4 rejected; a duplicate `(entry, attempt_no)` rejected; UPDATE and DELETE on `committed_score` still refused; a direct UPDATE of the counter refused (FR-231, FR-235, FR-237)
- [ ] T043 [P] Assert in SQL that a player can update his own counters but still **cannot** update `name`, `origin` or `removed_at`, so T038's widened grant is proved scoped rather than assumed (FR-006, Principle VI)
- [ ] T044 **Migration round-trip test** — feature 001's T039, still unchecked and no longer deferrable, since this is the first schema change since it was written. Assert a pre-feature draft with committed scores migrates without corrupting them (FR-050, Principle II, quickstart Scenario 6)
- [ ] T045 Update `src/state/supabase.ts`'s `snapshot()` to read `official_attempts_used` and to select attempt rows with an explicit `ORDER BY`, so the reduction never depends on unspecified row order (research R4)
- [ ] T046 [P] Confirm `classifyError` still maps the per-attempt unique violation (`23505`) to `rejected`, so a retry after a lost response is dropped rather than posting a phantom attempt. This is the idempotency T012 flagged (research R1, FR-046)
- [ ] T047 [P] Update `supabase/seed-draft.sql` if it names the rules version, so a freshly seeded draft matches the bumped value rather than refusing every commit (FR-023, FR-243, research R8)
- [ ] T048 Run the real-Postgres CI job locally per [quickstart](./quickstart.md) — `psql -f supabase/setup.sql` then `psql -f supabase/tests/invariants.sql` — and name the command and environment in the change description (Definition of Done item 7)

**Checkpoint**: The rule is enforced by the database. US2 is now fully verifiable.

---

## Phase 8: Playtest B — verify the bail, and check the acceptance held

**No longer a blocking design gate.** The question this phase existed to ask — does losing
an attempt to a bail feel fair or punitive — was answered by the organizer on 2026-09-14:
_"Losing a run to a crashed tab is acceptable."_ What remains is verification that the
behaviour works against real storage, which cannot be done earlier for the structural
reason at the top of this file.

- [ ] T049 Publish a build against a real Supabase project and have the player **start an attempt and kill the tab**, then reopen and find one fewer attempt (quickstart Scenario 2, SC-083). This is the first point the bail is exercisable at all: `localDraft.ts` is in-memory and there is no in-app quit, so a tab kill in local mode destroys the draft rather than costing an attempt
- [ ] T050 Ask one informal question and record the answer in `spec.md`: **did the acceptance survive contact?** The cost was accepted in advance rather than discovered in play, and Principle VIII is explicit that where measurement and the player disagree the player wins. If the first real bail stings more than it read on paper, FR-233 is the requirement to revisit — the spec already says so (Principle VIII, spec Accepted Consequences)

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T051 Bump `rulesVersion` `2.0.0` → `3.0.0` in `tools/gen-courses.ts` for both courses and regenerate via `npm run gen:courses` (FR-243, research R8)
- [ ] T052 Write `docs/adr/0011-three-attempts-best-one-counts.md` recording (a) the partial reversal of ADR-0002 and why it is safe now — the penalty falls on one of three rather than on an unrepeatable run, and the organizer ruled that cost acceptable on 2026-09-14 — and (b) the trust decision: the attempt count is honour-system by choice, consistent with ADR-0004, and an earlier design that hardened it was withdrawn. Use 0011 because **two existing files are numbered 0010**; do not fix that collision here (plan.md Complexity Tracking, research R2)
- [ ] T053 Amend `specs/001-shredpocalypse-bed-draft/spec.md`: mark FR-019 superseded by FR-233, restate FR-017/FR-018 at attempt granularity, and update the Accepted Consequence at line 400 — the defect it records is now closed. A spec that disagrees with shipped behaviour is a defect (Principle I)
- [ ] T054 [P] Update `specs/001-shredpocalypse-bed-draft/contracts/storage-api.md`'s invariant table, whose first row still reads "One committed score per entry, forever" (Principle I)
- [ ] T055 [P] Update `README.md` where it describes the run economy, and `assets/` or docs copy that says one official run
- [ ] T056 [P] Update `tests/e2e/us1-claim-and-commit.spec.ts` and `tests/e2e/us2-*` for three attempts, including that device switching grants no fourth (FR-235, SC-084)
- [ ] T057 Run the full suite and every quickstart scenario, recording results in [quickstart.md](./quickstart.md) (Definition of Done items 1, 2, 8)
- [ ] T058 Confirm CI is green on the head commit — **checked, not assumed**. Citing a check that did not run is a defect of the same severity as the bug it conceals (Definition of Done item 8)
- [ ] T059 [P] Re-run `npm run test:build` and confirm the journey works against the built artifact at `/ski-game/`, naming the command and environment (Principle VI, Definition of Done item 7)
- [ ] T060 Record in `spec.md` what was verified and what was not, per Principle VI — in particular whether Playtest B's answer changed anything
- [ ] T061 **The feature's acceptance demonstration (SC-081).** Drive one player end to end through: wipe out on attempt 1 for a near-zero score, take attempts 2 and 3, finish top of the leaderboard — against the built artifact at `/ski-game/`, not a unit test. SC-081 says "demonstrated end to end, not argued", and it is the single criterion that proves the feature does what it claims: a bad first run no longer ends your draft (SC-081, FR-238, Principle VI)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies
- **Phase 2 (Foundational)**: after Phase 1 — **blocks all user stories**
- **Phase 3 (US1)**: after Phase 2
- **Phase 4 (US2)**: after Phase 3 (shares `runEconomy.ts` and `main.ts`)
- **Phase 5 (Playtest A)**: after Phase 4 — **blocks Phases 6 and 7**
- **Phase 6 (US3)**: after Phase 5
- **Phase 7 (Storage)**: after Phase 5; independent of Phase 6
- **Phase 8 (Playtest B)**: after Phase 7. No longer blocks Phase 9 — its design question is settled, so verification and polish can overlap
- **Phase 9 (Polish)**: after Phase 7; T049–T050 may run alongside

### Critical Path

```text
T001 → T004..T012 → T015..T021 → T024..T028 → T029..T031 (PLAY)
     → T037..T048 → T049..T050 (PLAY) → T051..T060
```

Phase 6 (US3) sits off the critical path and can proceed alongside Phase 7.

### Why US1 and US2 are not independent here

The template wants each story independently deliverable, and these two are not. spec.md
says so directly: without US2, best-of-three is _strictly more permissive_ than today and
leaves the unfairness at `spec.md:400` untouched. Shipping US1 alone would be a
regression wearing a feature's clothes. The MVP is both.

### Parallel Opportunities

- T002, T003 together
- T008, T010, T011 together (different files)
- T013, T014 together; T022, T023 together
- T032, T035, T036 together
- T042, T043, T046, T047 together
- T054, T055, T056, T059 together

---

## Implementation Strategy

### MVP scope

Phases 1–5: both P1 stories plus the play pass. That is a complete, honest increment —
three attempts, best counts, starting spends it — running against local mode, with the
riskiest tunable settled by a person before any SQL is written.

It is **not shippable**: FR-235 requires shared storage to be the authority, and until
Phase 7 the limit is client-side. Stopping at Phase 5 is a valid pause, not a release.

### Stop-and-validate points

1. **After Phase 2** — the three latent defects are closed and the suite is still green.
2. **After Phase 5** — the player has answered the tunable questions. Amend the spec here if needed; it is the cheapest moment in the feature.
3. **After Phase 7** — the database refuses what it must, proven on real Postgres.
4. **After Phase 8** — the bail is verified against real storage and the accepted cost has met a real player.

### What must not be skipped

- **T007, T009, T046.** The three silent defects. None fails a build; all three corrupt a bed order.
- **T038.** Without the column added to the grant, the client silently cannot spend attempts — `0002_policies.sql` grants columns, not tables, so the write fails quietly and every attempt looks free.
- **T030.** Principle VIII is NON-NEGOTIABLE and session length is the one question nobody has answered from a desk. T050 is now a check rather than a gate, but it is the only chance to find out whether an accepted cost survives contact.
- **T044.** Feature 001's T039 has been deferred since it was written. This is the first schema change since; it stops being deferrable here.

---

## Notes

### Baseline (T001, captured 2026-09-23, before any change)

`npm run lint` PASS · `npx tsc --noEmit` PASS · `npm test` **431 passed, 2 failed (433)**.

The two failures are `tests/unit/sprite-palette.test.ts` and are **environmental, not
code**: `git-lfs` is not installed in this container, so the sprite PNGs are unsmudged
131-byte pointer files. CI checks out with `lfs: true` (`.github/workflows/ci.yml:18`) and
is green. Recorded rather than glossed, so "2 failing" after this feature is not mistaken
for a regression it caused.

**After Phases 1-4 + T029: 446 passed, 2 failed (448)** unit/sim — same two, +15 new
tests. **`npm run test:shared`: 8 passed**, including the rewritten attempt specs and the
two new ones (375 x 667 legibility, and a run starting while every roster write fails).
Lint and typecheck clean. Commands run on Linux, Node 22, headless Chromium.

**T029 build**: `npm run build:artifact` -> `dist/artifact.html`, 401 KiB, built from the
commit this note ships in.

- **Found during task generation, out of scope, worth its own change**: there is **no
  in-app way to abandon a run**. Under the old rules bailing was free, so killing the tab
  was a fine way to do it. Under FR-233 abandoning becomes a deliberate, costly choice a
  player may reasonably want to make — and the only way to make it is to kill the tab,
  which reads as a crash rather than a decision. Worth raising with the organizer after
  Playtest B, when there is evidence rather than speculation.
- Two pre-existing defects from plan.md's Complexity Tracking stay out of this diff:
  `package.json`'s `db:migrate` points at a `tools/migrate.mjs` that does not exist, and
  `docs/adr/` has two files numbered 0010.
