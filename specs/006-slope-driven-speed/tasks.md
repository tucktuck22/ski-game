# Tasks: Speed Comes From the Mountain

**Input**: Design documents from `/specs/006-slope-driven-speed/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included, and not optional here. Constitution Principle II requires automated
coverage plus a determinism test for **any** simulation change, and this is a change to
the core of the simulation.

**Organization**: Grouped by user story. The two stories are genuinely separable — US1
is the model, US2 is how the tuck feels under it — but both sit behind a foundational
phase that is unusually large for this project, because retiring five tuning keys
breaks every call site at once.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2, mapping to spec.md's user stories

## Path Conventions

Single project. `src/`, `tests/`, `data/`, `tools/` at repository root.

---

## Phase 1: Setup

**Purpose**: Amend the documents this feature contradicts, before writing code that
contradicts them. Principle I: a spec that disagrees with shipped behaviour is a defect,
and the amendment belongs in the same change set.

- [x] T001 Amend FR-077 in `specs/001-shredpocalypse-bed-draft/spec.md`: strike "The skier MUST travel at a fixed base speed on the slope" and restate as a speed the mountain sets, keeping the existing "Slope angle MAY modulate speed within bounds set in tuning data" clause which already permits this feature (FR-227)
- [x] T002 [P] Amend FR-196 in `specs/005-tutorial-and-boundary-rope/spec.md` to record that its no-physics-change promise is superseded by this feature, with the date and a pointer to the reset decision (FR-228)
- [x] T003 [P] Capture the pre-change baseline: run `npm run test:sim` and save the current golden hashes to `specs/006-slope-driven-speed/baseline-goldens.txt`, so the re-baseline in T024 is a reviewable diff against a recorded starting point rather than an unexplained rewrite

**Checkpoint**: The governing specs now describe the game this feature is about to build.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The tuning vocabulary changes. Every consumer of the retired keys breaks at
once, so nothing else can compile until this phase lands.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Retire `baseSpeed`, `tuckSpeedMax`, `tuckAccel`, `tuckDecel` and `slopeAccelFactor` from `data/tuning.json` and add `slopeFriction` 0.02, `dragStanding` 0.01270, `dragTucked` 0.00487, `speedMin` 0.80, `speedMax` 7.00, with a `$comment` recording that the two drag values are SOLVED from the gradient-0.30 anchor and must not be hand-edited (FR-226, data-model.md §1)
- [x] T005 Update the `Tuning` interface in `src/sim/types.ts`: remove the five retired keys, add the five new ones (FR-226)
- [x] T006 Update tuning validation in `src/data/load.ts`: all five new keys finite and positive, `dragTucked < dragStanding`, `speedMin < speedMax`; remove validation of the retired keys (data-model.md §1)
- [x] T007 [P] Write `tests/unit/tuning-keys.test.ts` asserting the five retired keys are absent from `data/tuning.json` entirely — not merely unread — and that the five new keys are present and satisfy the ordering constraints (FR-226)

**Checkpoint**: The project compiles against the new tuning vocabulary. Speed is wrong
everywhere, which the next phase fixes.

---

## Phase 3: User Story 1 — The hill you are looking at is the hill you are riding (Priority: P1) 🎯 MVP

**Goal**: Grounded speed is produced by gravity, friction and quadratic drag, so a steeper
pitch is genuinely faster and a kicker at the foot of one throws further.

**Independent Test**: Ride the official course sampling speed against gradient at twenty
points; confirm the two are monotonically related and the spread exceeds 2×.

### Tests for User Story 1 ⚠️

> Write these first and watch them fail.

- [x] T008 [P] [US1] Write `tests/sim/slope-response.test.ts` covering monotonicity across the legal gradient range standing and tucked (FR-215), spread greater than 2× (FR-216), and the gradient-0.30 anchor holding at 2.60 standing / 4.20 tucked to tolerance (research R2)
- [x] T009 [P] [US1] Extend the same file with the stability case: from a standstill at gradients 0.30, 0.644, 1.0 and 1.732, speed settles on terminal over 400 ticks with no oscillation and no overshoot (FR-222, research R3)

### Implementation for User Story 1

- [x] T010 [US1] Rewrite `applyGroundedMotion` in `src/sim/physics.ts` per contracts/slope-response.md: `accel = gravity * (uy - slopeFriction * ux) - drag * speed * speed`, explicit integration, clamped to `[speedMin, speedMax]`, drag selected by `crouchHeld` (FR-214, FR-217, FR-218, FR-219)
- [x] T011 [US1] Change the clamp in `resolveLanding` (`src/sim/physics.ts`) from `[baseSpeed, tuckSpeedMax]` to `[speedMin, speedMax]`, keeping the scrub-onto-slope behaviour unchanged so a fast landing keeps the speed its pitch earned (contracts/slope-response.md)
- [x] T012 [US1] Verify `npm run lint` passes, confirming no `Math.sin`/`cos`/`pow` reached simulation code — the existing `no-restricted-properties` rules are the gate for FR-218 and need no new check

### The stall guard

- [x] T013 [P] [US1] Add `CV-19` to `src/course/validate.ts`: reject any terrain segment whose gradient is too shallow to overcome `slopeFriction` with margin, expressed against the tuning value so re-tuning friction re-tunes the rule (FR-220, research R5)
- [x] T014 [P] [US1] Extend `tests/course/validate.test.ts` with a CV-19 case that actually fires — a scratch course carrying a near-flat segment — plus confirmation that both shipped courses pass. A rule that has never fired is untested (Principle VI)

### Re-tuning the courses — the largest piece of work

- [x] T015 [US1] In `tools/gen-courses.ts`, derive each kicker's `power` against the gradient it sits on rather than against a fixed carried speed, using research R6's measured impulses as the starting point (FR-224)
- [x] T016 [US1] Run `npm run gen:courses` and re-certify every shelf under CV-13, checking BOTH failure directions: a weakened kicker that no longer reaches its shelf (three of five measured at −19%), and a strengthened one that makes a shelf reachable without its ramp (x=5200 at +34%) (FR-224, research R6)
- [x] T017 [US1] Bump `rulesVersion` on `data/courses/official.json`. This is the change that resets the draft — do not do it before T016 certifies the course it describes (FR-223)
- [x] T018 [US1] Run `npm run test:course` and confirm both courses validate clean under the full CV rule set including CV-19 (FR-225)

**Checkpoint**: The mountain sets the speed. Both courses are legal. Goldens are red,
which is correct and is fixed in Phase 5.

---

## Phase 4: User Story 2 — A tuck is a tuck, not a throttle (Priority: P2)

**Goal**: Holding the crouch gathers speed by lowering drag rather than by jumping to a
new target, and releasing gives it back gradually.

**Independent Test**: On a fixed gradient, hold the tuck from a standing-speed start and
record speed per tick; confirm it rises smoothly to the tucked terminal within the
tolerance FR-221 fixes.

### Tests for User Story 2 ⚠️

- [x] T019 [P] [US2] Extend `tests/sim/slope-response.test.ts` with the tuck transient: from standing terminal at gradient 0.30, holding the crouch reaches 90% of the gain within the tolerance named in tuning, and releasing decays back to the standing terminal rather than dropping to it (FR-221)
- [x] T020 [P] [US2] Add a case asserting FR-087 still holds: a player who never crouches never leaves the ground on either course — the trick economy stays gated behind the tuck

### Implementation for User Story 2

- [x] T021 [US2] Add `tuckTransientTicks` to `data/tuning.json` as a NAMED value with an acceptance tolerance, documenting the measured 60 ticks against today's 30, so the playtest can move it without a code change (FR-221, research R4)
- [x] T022 [US2] Confirm `crouchTransitionTicks` still drives the POSE independently of the speed transient, so input-to-visible-response stays inside Principle III's 2-frame rule even though the payoff is slower

**Checkpoint**: Both stories functional. The tuck's feel is now a tuning value rather
than an emergent accident, ready for the playtest to judge.

---

## Phase 5: Determinism & Goldens

**Purpose**: Prove the change is deterministic and that it reached every path it should.

- [x] T023 Run `npm run test:sim` and confirm the monkey fuzz suite passes — no crash, hang or soft-lock on any input sequence under the new model (Principle II)
- [x] T024 Re-baseline every golden in `tests/sim/golden.test.ts` as a reviewable diff, not an `--update` run. **Every golden must move.** A golden that did NOT move means the physics never reached that path — investigate rather than accept it (SC-079, quickstart §5)
- [x] T025 Run `npm run test:determinism` and confirm identical hashes across all three engines (SC-079)

**Checkpoint**: The simulation is deterministic, stable, and provably different everywhere
it should be.

---

## Phase 6: The reset — an operator procedure, not prose

**Purpose**: The organizer accepted that committed scores are destroyed. That acceptance
is not the same as the players knowing, and it is not the same as the procedure working.

- [x] T026 Write the draft-reset procedure as a checked-in script under `supabase/`, superseding any README paragraph that tells a human to do it by hand (FR-229, Principle VII)
- [x] T027 Execute that procedure verbatim in CI against a scratch project and **assert on its output**, not merely its exit status — a script that succeeds while printing something unusable has failed (FR-229, Principle VII)
- [x] T028 [P] Document the deploy order in `README.md` and make it unmissable: tell the players FIRST, deploy SECOND, reset THIRD. Reversing one and three means eight people discover that a run they were told was irreversible was quietly taken back (FR-230)

**Checkpoint**: The reset is a tested deliverable and the order that protects players is
written down.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T029 Run the full gate: `npm run lint && npm run build && npm run test && npm run test:build`
- [x] T030 [P] Update `README.md` if any rules-version guidance it carries is now wrong — it already documents a rules-version mismatch incident and this feature deliberately causes one
- [x] T031 **Playtest (Principle VIII — binding, not optional).** Run `npm run build:artifact`, publish it, and name the link and the commit. Answer quickstart §7's four questions, above all whether the tuck still feels responsive at 60 ticks against today's 30. Record findings against `spec.md` in the player's own words before touching any of these values again
- [x] T032 Apply whatever the playtest says. Principle VIII: where the player and the measurement disagree, the player's reading wins and the measurement is what gets revised

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T001–T003 can all run together
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS everything** — retiring the tuning keys breaks every call site at once
- **US1 (Phase 3)**: Depends on Foundational. This is the MVP
- **US2 (Phase 4)**: Depends on Foundational; naturally follows US1 since it tunes US1's behaviour
- **Determinism & Goldens (Phase 5)**: Depends on US1 and US2 both landing — re-baselining before the model is final means doing it twice
- **Reset (Phase 6)**: Depends on T017 having bumped `rulesVersion`. Independent of Phase 5 otherwise
- **Polish (Phase 7)**: Depends on everything

### Critical Path

```
T004 → T005 → T006 → T010 → T013 → T015 → T016 → T017 → T024 → T031
```

T016 is the one to watch: re-certifying every shelf under CV-13 is a larger job than the
physics change, and it can fail in both directions.

### Within User Story 1

Tests (T008, T009) before implementation (T010, T011). CV-19 (T013) before course
regeneration (T015, T016), because a course generated against a rule that does not exist
yet may need generating twice. `rulesVersion` (T017) last, after the course it describes
is certified.

### Parallel Opportunities

- T002 and T003 alongside T001
- T007 alongside T004–T006 once the shape of the tuning change is settled
- T008 and T009 together — same file, but written as one unit before any implementation
- T013 and T014 together, independent of the kicker re-tune
- T019 and T020 together
- T028 and T030 alongside the rest of their phases

---

## Implementation Strategy

### MVP scope

**Phases 1–3 (T001–T018).** That delivers the whole point of the feature: the mountain
sets the speed, both courses are legal, and a steep pitch throws you further than a
gentle one. It is demonstrable and judgeable on its own.

US2 is tuning on top of it. Phase 5 proves it. Phase 6 ships it safely.

### Stop-and-validate points

1. **After T018** — ride it. This is the earliest point the feature is playable, and
   Principle VIII says that is when the player should see it, not at completion
2. **After T025** — determinism proven across three engines
3. **After T027** — the reset works before it is needed in anger

### What must not be skipped

- **T024's golden re-baseline is a review artifact.** An `--update` run destroys the one
  chance to notice a path the physics did not reach
- **T031's playtest is binding.** R4's tuck transient cannot be settled by measurement,
  and this is a pure feel change
- **T028's ordering.** Everything else in this feature is recoverable. Telling eight
  people after the fact that their irreversible run was reset is not

---

## Notes

- `[P]` = different files, no dependencies
- Commit after each task or logical group
- The two drag constants are **solved, not chosen** — if a task tempts you to hand-edit
  one, the anchor test in T008 is what will catch it
- Goldens moving is success here. Goldens NOT moving is the defect

---

## Closed 2026-09-12

T031 and T032 are recorded in
[`spec.md` → Verdict](./spec.md#verdict-2026-09-11--2026-09-12-builds-e118322-and-57d034e).
Accepted by the player in his own words; T032 produced one code change, CV-24, after
he found a defect the gravity change had created in authored course geometry that no
rule was checking.
