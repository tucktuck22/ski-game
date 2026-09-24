# Tasks: Time to See the Box

**Input**: Design documents from `/specs/007-reaction-time-speed/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included, and not optional. Principle II requires automated coverage for
every behaviour change. Principle III makes every feel target in this feature numeric
(680 ms, ±2%, rotations equal). Both contracts are written as assertions.

**Organization**: Grouped by the spec's three user stories:

- **US1** (P1) makes the boxes reactable: the camera and the course.
- **US2** (P2) proves nothing else moved: kickers, booters, shelves, ropes, headroom.
- **US3** (P3) moves the draft to the new rules version.

US2 and US3 verify and ship what US1 changes, so they follow it. Each still ends at a
testable checkpoint of its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3, mapping to spec.md's user stories

## Path Conventions

Single project. `src/`, `tests/`, `data/`, `tools/`, `supabase/` at repository root.

---

## Phase 1: Setup

**Purpose**: Capture the 2.0.0 baseline before anything moves, and make a real
play-pass build possible.

- [ ] T001 Record the rules-2.0.0 baseline on the unchanged course. With `data/courses/official.json` as committed, measure and write into `specs/007-reaction-time-speed/baseline-2.0.0.md`:
  - the tucked high-line pilot's speed at each kicker lip (1,400 / 5,200 / 7,852 / 9,188 / 11,000);
  - the low-line rider's rope lead times, all ten ropes;
  - the time to decide at all six boxes, under the shipped camera.

  Confirm they match the tables in `research.md` R1, R4 and R6 to the printed precision. If any value differs, stop and correct research.md first. Every later "within 2%" and "≥ baseline" assertion is compared against this file.

- [ ] T002 [P] Make the real sprites available (research R8). Try, in order:
  1. install `git-lfs` and run `git lfs pull`;
  2. fetch `public/sprites/skier.png` and `assets/sprites/*.png` by their pointer `oid` through the GitHub LFS media endpoint.

  Then run `npx vitest run tests/unit/sprite-palette.test.ts` and confirm it passes, which proves the files are real PNGs. If neither route works, record the blocker in `specs/007-reaction-time-speed/baseline-2.0.0.md` and carry on. T018 will refuse to hand over a build.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The measuring instrument, which both US1 and US2 assert against, and the
frozen-file guard, which will otherwise fail the moment the course changes.

**⚠️ CRITICAL**: US1's course change cannot be tested until T003–T005 exist.

- [ ] T003 Add the low-line tucked rider to `tests/sim/pilots.ts`, beside `ride()` and sharing its `releaseWithin`/`chargeFrom`. Its rules, per `contracts/reaction-budget.md` "The measuring ride":
  - it holds a tuck on the piste;
  - it stands (crouch released) for the 260 units before each pop ramp, meaning a kicker with `launchAngle` absent or ≥ 90, so the ramp hops it and it stays on the piste;
  - it charges and releases for each `solid` obstacle exactly as `ride()` does.

  Export it as a new `Pilot` value, `'low-line'`, handled inside `ride()`, so there is one ride loop, not two.

- [ ] T004 Add a per-tick observer to `ride()` in `tests/sim/pilots.ts`. This is an optional `onTick(before: RunState, after: RunState)` callback, so tests can measure seen/arrived ticks and lip speeds without copying the loop. Existing callers pass nothing and behave byte-identically. Confirm by running `npx vitest run tests/sim` unchanged and green.
- [ ] T005 Add the measurement helpers in a new file, `tests/sim/reaction.ts`. All three take the camera as a parameter (a `(state, course) => {x, y}` function), so they measure against the real `cameraFor` in US1 and against a stub for the 2.0.0 baseline.
  - `timeToDecide(course, camera)`: rides `'low-line'` and returns, per box, `{ x, seenTick, arriveTick, vxAtArrival, groundedWhenSeen, ms }`. "Seen" means the box's top edge (`pisteY − standHeight`) is inside the 320×180 frame under the given camera, and the rider is still short of the box. "Arrive" means `x + vx ≥ box.x`. `ms = (arrive − seen − climb) × 1000/60`, where `climb` is the smaller root of `launchImpulseMax·t − gravity·t²/2 = standHeight`, computed from `tuning`.
  - `ropeLeadTimes(course, camera)`: the same ride, per `low` obstacle, with the slab (`pisteY − clearance` down to `− branchThickness`) inside the frame.
  - `kickerLipSpeeds(course)`: rides `'tuck'` and returns speed at each lip crossing, grounded, on the piste.
- [ ] T006 [P] Retarget `tests/unit/tuning-frozen.test.ts` (research R7). Changes:
  - Retitle the suite to name feature 007 as the current owner of the freeze.
  - Keep `data/tuning.json` byte-frozen, with the reason rewritten to cite FR-232.
  - Remove `data/courses/official.json` from `FROZEN`.
  - Add a test: if the committed `official.json` differs from the working copy in anything other than `rulesVersion`, the `rulesVersion` must also differ. Read HEAD through the existing `committed()` helper, and skip with a warning where git cannot answer, exactly as today.

**Checkpoint**: `npx vitest run tests/sim tests/unit/tuning-frozen.test.ts` is green on
the unchanged course, and the new helpers reproduce T001's numbers when given the
shipped camera.

---

## Phase 3: User Story 1 — A player sees a box in time to jump it (Priority: P1) 🎯 MVP

**Goal**: Every box on both courses leaves ≥ 680 ms to decide on a real ride (FR-231,
SC-081).

**Independent Test**: `npx vitest run tests/sim/reaction-budget.test.ts -t "680"`
passes, and the play-pass build lets the maintainer react to every box.

### Tests for User Story 1

- [ ] T007 [P] [US1] Write `tests/unit/camera-framing.test.ts` covering C1, C2, C3 and C7 of `contracts/camera-framing.md`:
  - **C1**: `camera.x === state.x − CAMERA_X_OFFSET`.
  - **C2**: on gentle ground, where `drop ≤ 68`, `camera.y` equals `state.y − 108 + cameraAirLift(h)` exactly. Sweep x in 10-unit steps over both courses.
  - **C3**: sweeping x in 10-unit steps along both courses with a grounded state on the piste, every piste point in `[x, x+213]` projects inside `[0, 180 − 4]`, except where the shelf cap applies.
  - **C7**: `src/render/rampGeometry.ts` imports nothing from `src/sim/step.ts`.

  Written first; it must fail against the current `cameraFor` on the Narrows.

- [ ] T008 [P] [US1] Write `tests/sim/reaction-budget.test.ts` with B1, B3 and B9 of `contracts/reaction-budget.md`, using T005's `timeToDecide` with the real `cameraFor` from `src/render/draw.ts`:
  - every `solid` on both courses is ≥ 680 ms;
  - the rider is grounded when each box after the first is seen;
  - the failure message names the box x, the ms and the arrival vx.

  Written first; it must fail on the shipped course and camera, and its failure output should reproduce research R1's full-ride figures.

### Implementation for User Story 1

- [ ] T009 [US1] Add `lookDown(course, x, onPiste)` and the constants `LOOK_MARGIN = 4`, `SHELF_MARGIN = 8` and `SHELF_EASE_IN = 120` to `src/render/rampGeometry.ts`, beside `cameraAirLift` and `AIR_LIFT_MAX`, per `data-model.md` §4:
  - `drop = terrainYAt(x + PLAYER_LOOKAHEAD) − terrainYAt(x)`;
  - `look = clamp(drop − 0.4·INTERNAL_HEIGHT + LOOK_MARGIN, 0, AIR_LIFT_MAX)`;
  - when `onPiste` and within `SHELF_EASE_IN` before, or inside, a ledge's span, cap it at `0.6·INTERNAL_HEIGHT − ledge.height − SHELF_MARGIN`. The cap blends linearly from no cap to the full cap across the ease-in, so it never snaps.

  Write a doc comment in the style of the neighbouring ones, explaining why the camera looks down, citing research R2/R3 and FR-242/FR-243.

- [ ] T010 [US1] Change `cameraFor` in `src/render/draw.ts` to use `shift = max(cameraAirLift(above), lookDown(course, state.x, state.ledge < 0))`, replacing the bare `lift`. Update its comment. T007 now passes.
- [ ] T011 [US1] Edit `OFFICIAL_GRADE` in `tools/gen-courses.ts` to research R4's programme. Replace the keys between 1,200 and 11,850 exactly as listed there, including 6,300/6,600 at 0.46 and 6,800 at 0.40. Give each changed key an inline comment naming the box it eases, or the kicker/booter it restores, per FR-233's "each change recorded against its box". Rewrite the programme's header comment where it says "213 units of lookahead at 5.9 is already only 0.6s of reaction and the frame cannot show more": that is now false, and it points to this feature.
- [ ] T012 [US1] In `official()` in `tools/gen-courses.ts`, change `deadfall(11600)` to `deadfall(11680)`. Keep the paired rock at 11,600. Add a comment citing FR-241's first fallback and research R4: the ramp hop at 11,000, and CV-11's ceiling of 11,686.
- [ ] T013 [US1] In `tools/gen-courses.ts`, set `rulesVersion: '2.1.0'` for both courses (official and warm-up). The version moves in the same change as the geometry, so T006's guard is never red on a pushed commit and CI stays green at T017. Then regenerate with `node --experimental-strip-types tools/gen-courses.ts`, and:
  - run it a second time and confirm no further diff;
  - confirm `data/courses/warmup.json` changes only in `rulesVersion`;
  - confirm `data/courses/official.json` terrain matches research R4's candidate, i.e. the same y values the probe produced.
- [ ] T014 [US1] Run `npx vitest run tests/course tests/sim/reaction-budget.test.ts tests/unit/camera-framing.test.ts` and confirm the course validator is clean and T007/T008 pass. If any box reads below 680 ms, adjust only the eased key for that box, down to a floor of 0.25, and re-run T014 **and** `tests/sim/booters.test.ts` together. Research R5 says any upstream edit can flip the booter.
- [ ] T015 [US1] Look for one 16.7 ms tick of headroom on the four boxes that pass at exactly 681 ms (1,830 / 4,640 / 6,100 / 11,680, research R4). Try lowering that box's eased key by 0.01–0.02. Keep a change only if T014's suite **and** `tests/sim/booters.test.ts` **and** the ±2% kicker check (run ad hoc via T005's `kickerLipSpeeds`) all still pass. Record in `research.md` R4 what was tried and kept, including "nothing kept" if that is the result.
- [ ] T016 [US1] Run the full sim and course suites (`npm run test:sim && npm run test:course && npm run test:unit`). Everything must be green except `sprite-palette` where T002 could not fetch the sprites; say so explicitly. The booter rotation test must pass unmodified.

### Play pass (Principle VIII, FR-240): at the first playable point

- [ ] T017 [US1] Commit US1's changes (T007–T016) and push to `claude/bold-albattani-pag0m9`, so the play-pass build has a named commit.
- [ ] T018 [US1] Build the play-pass artifact. First assert `head -c 4 public/sprites/skier.png` is the PNG signature (`\x89PNG`). **If it is not, stop and tell the maintainer the build would show the fallback skier; do not hand it over.** Otherwise run `npm run build:artifact`, publish the single file as an artifact, and give the maintainer the link, the commit from T017, and quickstart §6's four questions.
- [ ] T019 [US1] Record the maintainer's verdict in `specs/007-reaction-time-speed/spec.md` under a new "Playtest findings — <date>, build <sha>" section, in their own words, before any value moves again. If they ask for changes, stop here and loop back to T011/T014 rather than continuing to US2.

**Checkpoint**: every box is reactable in simulation, and the maintainer has ridden it.

---

## Phase 4: User Story 2 — Everything else rides the same (Priority: P2)

**Goal**: kickers, booters, shelves, ropes and jump headroom are unchanged
(FR-235–FR-238, FR-243, SC-084, SC-086).

**Independent Test**: `npx vitest run tests/sim/reaction-budget.test.ts tests/unit/camera-framing.test.ts tests/sim/booters.test.ts tests/sim/tracks.test.ts`
is green with every B and C assertion present.

- [ ] T020 [P] [US2] Add B4, B5, B7 and B8 to `tests/sim/reaction-budget.test.ts`, with T001's baseline values committed as a table inside the test and a comment saying they are rules-2.0.0 measurements:
  - **B4**: every rope's lead time ≥ its 2.0.0 value;
  - **B5**: each kicker's lip speed within ±2% of its 2.0.0 value;
  - **B7**: shelves ridden are 3 on `'tuck'` and 0 on `'stay-low'`;
  - **B8**: the gentlest official gradient is exactly 0.25.
- [ ] T021 [P] [US2] Add B2 to `tests/sim/reaction-budget.test.ts`: `'low-line'`, `'tuck'` and `'stay-low'` all finish the official course, each in under half of `MAX_TICKS` (FR-237, FR-238).
- [ ] T022 [P] [US2] Add C4, C5 and C6 to `tests/unit/camera-framing.test.ts`:
  - **C4**: `cameraAirLift(h) ≤ shift ≤ AIR_LIFT_MAX` for every tick of a `'tuck'` ride, including both booter flights.
  - **C5**: every tick of a `'low-line'` ride under or approaching a ledge keeps the ledge's top edge ≥ 8 units inside the frame.
  - **C6**: across full `'low-line'` and `'tuck'` rides, the camera moves at most 4 units vertically between consecutive ticks.

  Use T004's observer.

- [ ] T023 [US2] Add SC-086 to `tests/unit/camera-framing.test.ts`: on every official and warm-up segment steeper than 0.41, a piste point exactly 213 units ahead of a grounded skier on the piste is inside the frame, outside shelf caps.
- [ ] T024 [US2] Run `npx vitest run tests/sim tests/course tests/unit` and confirm the whole of US2 is green, with `tests/sim/booters.test.ts` and `tests/unit/scoring-dominance.test.ts` unmodified. If B5 fails at the kicker at 11,000 (−1.8% in research), take the plan's risk-table mitigation: move the Last Pitch box further within CV-11's window, not steepen anything.

**Checkpoint**: every guarantee in both contracts is asserted, and the existing suites
pass unmodified.

---

## Phase 5: User Story 3 — The draft moves to the new rules safely (Priority: P3)

**Goal**: rules 2.1.0, bumped in T013 alongside the course, ships with every operator
artifact agreeing, and no reset is needed (FR-239).

**Independent Test**: `npx vitest run tests/unit/tuning-frozen.test.ts` passes with the
bump, and the Postgres invariants job passes in CI.

- [ ] T025 [US3] Confirm the 2.1.0 bump from T013 is on both generated courses, that `tests/unit/tuning-frozen.test.ts` passes against it, and that no other file in the repository still names `2.0.0` as the version to seed, repair to or submit. `grep -rn "2\.0\.0" --include=*.ts --include=*.sql --include=*.json --include=*.md .` should list only history: specs, changelog prose, and the FR-229 fixture.
- [ ] T026 [P] [US3] Change the version literal in `supabase/seed-draft.sql` (line 43) and the `target` in `supabase/fix-rules-version.sql` (line 49) from `'2.0.0'` to `'2.1.0'`. Leave the FR-229 fixture in `supabase/tests/invariants.sql`, which uses 2.0.0 as history (research R7). Check each file's own comments for a stated version and correct those too (Principle VII).
- [ ] T027 [P] [US3] Update `README.md` § "Deploying a physics change into a live draft". Add that 2.1.0 (feature 007) moves the official course's geometry but not the physics, and that no committed scores existed when it shipped, so no reset was needed. Keep the three-step order as the procedure for any future bump. Also update the status table with a row for feature 007.
- [ ] T028 [US3] Run `npm run test:determinism`. The goldens in `tests/e2e/determinism.spec.ts` are expected to be unchanged, because their traces die before x = 1,400. If any value moves, regenerate it as the file's header instructs and append a dated paragraph naming feature 007 and why.

**Checkpoint**: version, operator SQL and README agree on 2.1.0, with no reset in the
instructions.

---

## Phase 6: Polish & cross-cutting

- [ ] T029 [P] Update `specs/007-reaction-time-speed/research.md` R4 and R6 with the final measured numbers from T014/T015/T020, if they differ from the candidate's.
- [ ] T030 Run the full gate as quickstart §6 lists it: `npm run lint && npx tsc --noEmit && npm test && npm run test:build`. Report every failure verbatim. The only acceptable pre-existing failure is `sprite-palette` in an environment without LFS, and it must be named as such.
- [ ] T031 If T019 moved values, re-run T030 and hand over a fresh build per T018 before calling the feature done (Principle VIII: findings are recorded before further change, and the changed build is played too).
- [ ] T032 Tick completed tasks in this file, and add a validation-run note to `specs/007-reaction-time-speed/checklists/requirements.md` recording the final numbers and the play-pass verdict.

---

## Dependencies & execution order

```text
T001 ─┐
T002 ─┼─(parallel)
      ▼
T003 → T004 → T005 ─┐        T006 (parallel with T003–T005)
                    ▼
US1:  T007, T008 (parallel, tests first)
      → T009 → T010                     (camera)
      → T011 → T012 → T013 → T014 → T015 → T016   (course; sequential, one file and one generator run)
      → T017 → T018 → T019              (play pass: blocks US2 if the maintainer asks for changes)
                    ▼
US2:  T020, T021, T022 (parallel) → T023 → T024
                    ▼
US3:  T025 → T026, T027 (parallel) → T028      (the version bump itself is in T013)
                    ▼
Polish: T029 → T030 → T031 → T032
```

- **The camera (T009–T010) and the course (T011–T016) are independent** and could be
  swapped. Camera first because it is smaller and on its own helps ropes and four
  boxes.
- **US2 depends on US1's course**: it asserts against the new geometry.
- **US3 depends on US1**: the version bump itself rides with the course in T013, so
  the frozen-file guard is never red on a pushed commit. US3 brings the operator
  artifacts into line with it.

## Parallel examples

```text
# Phase 1
T001 baseline capture  |  T002 sprite fetch

# US1 tests before code
T007 camera-framing.test.ts  |  T008 reaction-budget.test.ts

# US2 assertions (different describe blocks and files)
T020 B4/B5/B7/B8  |  T021 B2  |  T022 C4/C5/C6

# US3
T026 operator SQL  |  T027 README
```

## Implementation strategy

**MVP is US1 through T019**: the camera, the course and a play pass. That is the whole
of what the maintainer asked for, in their hands at the earliest point it can run.
US2 hardens the "nothing else moved" claim that research already measured. US3 ships
it under the right version.

**Stop conditions**:

- **The maintainer rejects the feel at T019.** Loop back; do not harden a course they
  have not accepted.
- **T014 cannot reach 680 ms without breaking the booter test.** Take FR-241's
  fallbacks in order: first move boxes, then only with the maintainer's agreement
  raise drag. Never adjust the booter rig to pass.
- **T002 and T018 cannot get real sprites.** Do not hand over a build; say why.
