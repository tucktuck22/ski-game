# Tasks: Time to See the Box

**Input**: Design documents from `/specs/008-reaction-time-speed/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included, and not optional. Principle II requires automated coverage for
every behaviour change. Principle III makes every feel target in this feature numeric
(680 ms, ±2%, rotations equal). Both contracts are written as assertions.

**Organization**: Grouped by the spec's three user stories:

- **US1** (P1) makes the boxes reactable: the camera and the course.
- **US2** (P2) proves nothing else moved: kickers, booters, shelves, hazards, headroom.
- **US3** (P3) brings the operator artifacts into line with the new rules version.

US2 and US3 verify and ship what US1 changes, so they follow it. Each still ends at a
testable checkpoint of its own.

_Regenerated 2026-09-24 after `/speckit-analyze`. Changes from the first version:_

- _**D1**: the camera constants move to `data/camera.json` (T009)._
- _**C1**: the warm-up course's box at 5,200 is eased too (T013)._
- _**G1**: the play pass comes right after the first green gate, and looking for extra
  margin comes after the verdict (T016–T020)._
- _**E1**: rocks and ice are measured and asserted, not only ropes (T001, T005, T022)._
- _**B1**: T023 no longer adds a run-length limit the spec does not state._

_Implementation notes, 2026-09-24. Each deviation from the tasks as written is
recorded here and in research R11:_

- _**T003**: the low-line pilot stands **500** units before a pop ramp, not 260. At
  260, standing up hops it onto every shelf._
- _**T005/T008/T022**: every hazard is read on **all three** measuring pilots, and
  the worst reading counts. The cautious pilot is the worst case on the shipped
  course._
- _**T006**: the course guard is a per-version geometry fingerprint table, not a
  comparison against HEAD. HEAD cannot see a committed edit in CI._
- _**T012**: the shipped programme is R11's, not R4's. Boxes 1,830 and 6,100 pass
  today and do not move. The Flats key at 6,800 is 0.395._
- _**T013**: superseded. The warm-up box at 5,200 passes today at 715 ms, and the
  warm-up course changes only in its version string._
- _**T022 (B4)**: asserts FR-252 as amended: not below the budget, and nothing already
  below it loses more._
- _**T028**: done early, alongside T015. `tests/contract/storage.test.ts` ties both SQL
  literals to the course version, so CI would be red between the two otherwise._

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3, mapping to spec.md's user stories

## Path Conventions

Single project. `src/`, `tests/`, `data/`, `tools/`, `supabase/` at repository root.

---

## Phase 1: Setup

**Purpose**: Capture the 2.0.0 baseline before anything moves, and make a real
play-pass build possible.

- [x] T001 Record the rules-2.0.0 baseline on the unchanged courses in `specs/008-reaction-time-speed/baseline-2.0.0.md`. With both course files as committed, measure:
  - the tucked high-line pilot's speed at every kicker lip on **both** courses (official 1,400 / 5,200 / 7,852 / 9,188 / 11,000; warm-up 1,889 / 2,489 / 4,600 / 5,586);
  - the low-line rider's rope lead times;
  - the tuck pilot's lead time to every rock and every ice band on the shelves (FR-252, not measured in research);
  - the time to decide at every box on both courses, under the shipped camera.

  Confirm the kicker, rope and box values match research R1, R4, R6 and R9 to the printed precision. If any value differs, stop and correct research.md first. Every later "within 2%" and "≥ baseline" assertion is compared against this file.

- [x] T002 [P] Make the real sprites available (research R8). Try, in order:
  1. install `git-lfs` and run `git lfs pull`;
  2. fetch `public/sprites/skier.png` and `assets/sprites/*.png` by their pointer `oid` through the GitHub LFS media endpoint.

  Then run `npx vitest run tests/unit/sprite-palette.test.ts` and confirm it passes, which proves the files are real PNGs. If neither route works, record the blocker in `baseline-2.0.0.md` and carry on. T018 will refuse to hand over a build.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The measuring instrument, which both US1 and US2 assert against, and the
frozen-file guard, which will otherwise fail the moment the course changes.

**⚠️ CRITICAL**: US1's course change cannot be tested until T003–T005 exist.

- [x] T003 Add the low-line rider to `tests/sim/pilots.ts` as a new `Pilot` value, `'low-line'`, handled inside the existing `ride()`, so there is one ride loop, not two. Per `contracts/reaction-budget.md` "The measuring ride":
  - it holds a tuck on the piste;
  - it stands (crouch released) for the 260 units before each pop ramp, meaning a kicker with `launchAngle` absent or ≥ 90, so the ramp hops it and it stays on the piste;
  - it charges and releases for each `solid` obstacle exactly as the existing pilots do, via `releaseWithin`/`chargeFrom`.
- [x] T004 Add an optional per-tick observer, `onTick(before: RunState, after: RunState)`, to `ride()` in `tests/sim/pilots.ts`, so tests can measure without copying the loop. Existing callers pass nothing and behave byte-identically. Confirm with `npx vitest run tests/sim`, unchanged and green.
- [x] T005 Add the measurement helpers in a new file, `tests/sim/reaction.ts`. Each takes the camera as a parameter (`(state, course) => {x, y}`), so it can measure against the real camera or against the 2.0.0 camera.
  - `timeToDecide(course, camera)`: rides `'low-line'` and returns, per box, `{ x, seenTick, arriveTick, vxAtArrival, groundedWhenSeen, ms }`.
    - "Seen" is the first tick the box's top edge (`pisteY − standHeight`) is inside the 320×180 frame, with the rider still short of the box.
    - "Arrive" is the first tick at which `x + vx ≥ box.x`.
    - `ms = (arrive − seen − climb) × 1000/60`, where `climb` is the smaller root of `launchImpulseMax·t − gravity·t²/2 = standHeight`, computed from `tuning`.
  - `hazardLeadTimes(course, camera)`:
    - per `low` obstacle, on `'low-line'`, with the slab (`pisteY − clearance` to `− branchThickness`) inside the frame;
    - per rock and per ice band, on `'tuck'`, with the hazard's top on the shelf inside the frame.
  - `kickerLipSpeeds(course)`: rides `'tuck'` and returns the speed at each lip crossing, grounded, on the piste.
- [x] T006 [P] Retarget `tests/unit/tuning-frozen.test.ts` (research R7). Changes:
  - Retitle the suite to name feature 008 as the current owner of the freeze.
  - Keep `data/tuning.json` byte-frozen, with the reason rewritten to cite FR-247.
  - Remove `data/courses/official.json` from `FROZEN`.
  - Add a test: for **each** course file, if the committed copy differs from the working copy in anything other than `rulesVersion`, the `rulesVersion` must also differ. Read HEAD through the existing `committed()` helper, and skip with a warning where git cannot answer, as today.

**Checkpoint**: `npx vitest run tests/sim tests/unit/tuning-frozen.test.ts` is green on
the unchanged courses, and T005's helpers reproduce T001's numbers when given the
2.0.0 camera.

---

## Phase 3: User Story 1 — A player sees a box in time to jump it (Priority: P1) 🎯 MVP

**Goal**: Every box on both courses leaves ≥ 680 ms to decide on the low-line ride
(FR-246, SC-088).

**Independent Test**: `npx vitest run tests/sim/reaction-budget.test.ts` passes on its
B1/B3/B9 assertions, and the play-pass build lets the maintainer react to every box.

### Tests for User Story 1

- [x] T007 [P] [US1] Write `tests/unit/camera-framing.test.ts` covering C1, C2, C3 and C7 of `contracts/camera-framing.md`, calling `cameraFor(state, course, framing)` with `framing` parsed from `data/camera.json`:
  - **C1**: `camera.x === state.x − CAMERA_X_OFFSET`.
  - **C2**: on gentle ground, where `drop ≤ 68`, `camera.y` equals `state.y − 108 + cameraAirLift(h)` exactly. Sweep x in 10-unit steps over both courses.
  - **C3**: with a grounded state on the piste, sweeping x in 10-unit steps along both courses, every piste point in `[x, x+213]` projects inside `[0, 180 − lookMargin]`, except where the shelf cap applies.
  - **C7**: `src/render/rampGeometry.ts` imports nothing from `src/sim/step.ts`.

  Written first; it must fail against the current camera on the Narrows.

- [x] T008 [P] [US1] Write `tests/sim/reaction-budget.test.ts` with B1, B3 and B9 of `contracts/reaction-budget.md`, using T005's `timeToDecide` with the real `cameraFor`:
  - **B1**: every `solid` on both courses is ≥ 680 ms;
  - **B3**: the rider is grounded when each box after the first is seen;
  - **B9**: failures name the box x, the ms and the arrival vx.

  Written first; it must fail on the shipped courses, and its failure output should reproduce research R1 and R9's full-ride figures.

### Implementation for User Story 1: camera

- [x] T009 [US1] Create `data/camera.json` containing `{ "lookMargin": 4, "shelfMargin": 8, "shelfEaseIn": 120 }`, with a `$comment` citing research R2, R3 and R10 in the style of `data/tuning.json`. Then:
  - add a `CameraFraming` type and `parseCamera(raw)` to `src/data/load.ts`, rejecting a missing key, a non-number or a negative value, with messages in the style of `parseAudio`;
  - add `camera: CameraFraming` to `GameData` and parse it in `assembleGameData`;
  - import `../data/camera.json` in `src/main.ts` beside `sprites.json` and pass it in;
  - add `tests/unit/camera-config.test.ts`, asserting the shipped file parses and each rejection fires with its message.
- [x] T010 [US1] Add `lookDown(course, x, onPiste, framing)` to `src/render/rampGeometry.ts`, beside `cameraAirLift` (data-model §4):
  - `drop = terrainYAt(x + PLAYER_LOOKAHEAD) − terrainYAt(x)`;
  - `look = clamp(drop − 0.4·INTERNAL_HEIGHT + framing.lookMargin, 0, AIR_LIFT_MAX)`;
  - when `onPiste`, and within `framing.shelfEaseIn` before or inside a ledge's span, cap it at `0.6·INTERNAL_HEIGHT − ledge.height − framing.shelfMargin`. The cap blends linearly from no cap to the full cap across the ease-in, so it never snaps.

  Doc comment in the neighbouring style, citing research R2/R3 and FR-257/FR-258.

- [x] T011 [US1] Change `cameraFor` in `src/render/draw.ts` to `cameraFor(state, course, framing)`, with `shift = max(cameraAirLift(above), lookDown(course, state.x, state.ledge < 0, framing))`. Thread `framing` through `drawRun` from its caller in `src/ui/game.ts`, which has `GameData`. Update the comment. T007 now passes.

### Implementation for User Story 1: course

- [x] T012 [US1] Replace `OFFICIAL_GRADE` in `tools/gen-courses.ts` with research R4's complete programme, the code block under "The complete programme". Give each changed key an inline comment naming the box it eases, or the kicker/booter it restores (FR-248: each change recorded against its box). Rewrite the programme's header comment where it says "213 units of lookahead at 5.9 is already only 0.6s of reaction and the frame cannot show more": it is now false, and it points to this feature.
- [x] T013 [US1] Replace `WARMUP_GRADE` in `tools/gen-courses.ts` with research R9's programme: ease 4,800–5,200 to 0.25, restore at 5,300/5,400. Leave every key at x ≤ 3,200 (the coached section) exactly as it is. Comment each changed key, citing box 5,200 and research R9.
- [x] T014 [US1] In `official()` in `tools/gen-courses.ts`, change `deadfall(11600)` to `deadfall(11680)`. Keep the paired rock at 11,600. Add a comment citing FR-256's first fallback and research R4: the ramp hop at 11,000, and CV-11's ceiling of 11,686.
- [x] T015 [US1] Set `rulesVersion: '3.1.0'` for both courses in `tools/gen-courses.ts`, so the version moves in the same commit as the geometry and T006's guard is never red on a pushed commit. Regenerate with `node --experimental-strip-types tools/gen-courses.ts`. Then:
  - run it a second time and confirm no further diff;
  - confirm `warmup.json` changes only in `rulesVersion` and at terrain from x = 4,800;
  - confirm both files' terrain matches research R4/R9's candidates.
- [x] T016 [US1] First gate: `npx vitest run tests/course tests/sim/reaction-budget.test.ts tests/unit/camera-framing.test.ts tests/unit/camera-config.test.ts tests/sim/booters.test.ts tests/unit/tuning-frozen.test.ts`. The validator, T007, T008, the booter rotations and the frozen-file guard must all be green. If any box reads below 680 ms:
  - adjust only the eased key for that box, down to a floor of 0.25;
  - re-run this whole command, including the booter test. Research R5 says any upstream edit can flip the booter.

### Play pass (Principle VIII, FR-255): at the first playable point

- [x] T017 [US1] Commit T007–T016 and push to `claude/bold-albattani-pag0m9`, so the play-pass build has a named commit.
- [x] T018 [US1] Build the play-pass artifact. First assert `head -c 4 public/sprites/skier.png` is the PNG signature (`\x89PNG`). **If it is not, stop and tell the maintainer the build would show the fallback skier; do not hand it over.** Otherwise run `npm run build:artifact`, publish the single file as an artifact, and give the maintainer the link, the commit from T017, and quickstart §6's four questions.
- [x] T019 [US1] Record the maintainer's verdict in `specs/008-reaction-time-speed/spec.md` under a new "Playtest findings — <date>, build <sha>" section, in their own words, before any value moves again. If they ask for changes, loop back to T012–T016 and hand over again (T017–T018) rather than continuing.
- [x] T035 [US1] (loop-back from T019) Add B10 (FR-260) to `tests/sim/reaction-budget.test.ts`: landing a box to reaching the rope after it, at least 300 ms on every measuring pilot.
- [x] T036 [US1] Move the boughs after the Narrows logs (+0, +20, +85) and the Last Pitch bough (11,850 → 11,900) in `tools/gen-courses.ts`, and start the drop after the Narrows at 4,800 instead of 4,700. Teach B4 which ropes moved. Re-record the 3.1.0 fingerprint.
- [x] T037 [US1] Add C8 and C9 (FR-261) to `tests/unit/camera-framing.test.ts`.
- [x] T038 [US1] Add the look-down to the air lift instead of taking the larger (`cameraFor`), and follow it per tick with `LookFollower` (`src/render/rampGeometry.ts`, wired into `src/ui/game.ts` and the reaction measure). Add `lookRateAir`, `lookRateGround` and `lookRampTicks` to `data/camera.json` and its parser.
- [x] T039 [US1] Hand over a fresh build (T017–T018) and record the verdict (T019). _Build f900b25 published 2026-09-24 as version 3 of the play-pass artifact; verdict pending._ _Verdict recorded 2026-09-25 on build 22c7888: accepted, ropes noted as known open._
- [x] T020 [US1] Only after an accepting verdict, look for one 16.7 ms tick of headroom on the boxes that pass at exactly 681 ms (official 1,830 / 4,640 / 6,100 / 11,680; research R4). Try lowering that box's eased key by 0.01–0.02 in `tools/gen-courses.ts`. Keep a change only if T016's command and the ±2% kicker check (T005's `kickerLipSpeeds` against T001) both still pass. Record what was tried and kept in `research.md` R4, including "nothing kept". **If anything is kept, the played build is no longer the shipped build: repeat T017–T019 with the new commit.** _Not taken, by decision: the maintainer judged the speed "probably where it should be for starters" (2026-09-24) and the ropes "a bit unfair" (2026-09-25). Finding headroom would make boxes faster, which is the opposite direction._
- [x] T021 [US1] Run the full sim, course and unit suites (`npm run test:sim && npm run test:course && npm run test:unit`). Everything must be green except `sprite-palette` where T002 could not fetch the sprites; say so explicitly. The booter rotation test passes unmodified. _Done: 710 unit/sim/course tests green at 22c7888, sprites present._

**Checkpoint**: every box is reactable in simulation, and the maintainer has ridden the
build that ships.

---

## Phase 4: User Story 2 — Everything else rides the same (Priority: P2)

**Goal**: kickers, booters, shelves, hazards and jump headroom are unchanged
(FR-250–FR-253, FR-258, SC-091, SC-093).

**Independent Test**: `npx vitest run tests/sim/reaction-budget.test.ts tests/unit/camera-framing.test.ts tests/sim/booters.test.ts tests/sim/tracks.test.ts`
is green with every B and C assertion present.

- [x] T022 [P] [US2] Add B4, B5, B7 and B8 to `tests/sim/reaction-budget.test.ts`. Commit T001's baseline values as a table inside the test, with a comment saying they are rules-2.0.0 measurements.
  - **B4**: every rope's lead time on `'low-line'`, and every rock's and ice band's lead time on `'tuck'`, is ≥ its 2.0.0 value.
  - **B5**: each kicker's lip speed on both courses is within ±2% of its 2.0.0 value.
  - **B7**: shelves ridden are 3 on `'tuck'` and 0 on `'stay-low'`.
  - **B8**: the gentlest official gradient is exactly 0.25.
- [x] T023 [P] [US2] Add B2 to `tests/sim/reaction-budget.test.ts`: `'low-line'`, `'tuck'` and `'stay-low'` all finish both courses (FR-253).
- [x] T024 [P] [US2] Add C4, C5 and C6 to `tests/unit/camera-framing.test.ts`, using T004's observer:
  - **C4**: `cameraAirLift(h) ≤ shift ≤ AIR_LIFT_MAX` for every tick of a `'tuck'` ride, including both booter flights.
  - **C5**: every tick of a `'low-line'` ride under or approaching a ledge keeps the ledge's top edge ≥ `shelfMargin` inside the frame.
  - **C6**: across full `'low-line'` and `'tuck'` rides, the camera moves at most 4 units vertically between consecutive ticks.
- [x] T025 [US2] Add SC-093 to `tests/unit/camera-framing.test.ts`: on every official and warm-up segment steeper than 0.41, a piste point exactly 213 units ahead of a grounded skier on the piste is inside the frame, except where a shelf cap applies. That exception is the one the amended SC-093 names.
- [x] T026 [US2] Run `npx vitest run tests/sim tests/course tests/unit` and confirm the whole of US2 is green, with `tests/sim/booters.test.ts` and `tests/unit/scoring-dominance.test.ts` unmodified. If B5 fails at the kicker at 11,000 (−1.8% in research), take the plan's risk-table mitigation: move the Last Pitch box further within CV-11's window, not steepen anything. Any such move is a course change and repeats T017–T019.

**Checkpoint**: every guarantee in both contracts is asserted, and the existing suites
pass unmodified.

---

## Phase 5: User Story 3 — The draft moves to the new rules safely (Priority: P3)

**Goal**: rules 3.1.0, bumped in T015 alongside the course, ships with every operator
artifact agreeing, and no reset is needed (FR-254).

**Independent Test**: no file tells an operator to seed, repair to or submit `2.0.0`,
and the Postgres invariants job passes in CI.

- [x] T027 [US3] Confirm the 3.1.0 bump from T015 is on both generated courses, and that no file still names `2.0.0` as the version to seed, repair to or submit. `grep -rn "2\.0\.0" --include=*.ts --include=*.sql --include=*.json --include=*.md .` should list only history: specs, dated prose, and the FR-229 fixture in `supabase/tests/invariants.sql`. _Done: only test fixtures and dated history name 2.0.0 or 3.0.0; seed and repair SQL say 3.1.0._
- [x] T028 [P] [US3] Change the version literal in `supabase/seed-draft.sql` (line 43) and the `target` in `supabase/fix-rules-version.sql` (line 49) from `'2.0.0'` to `'3.1.0'`. Leave the FR-229 fixture in `supabase/tests/invariants.sql` (research R7). Correct any version stated in either file's own comments (Principle VII).
- [x] T029 [P] [US3] Update `README.md`: _Done: status table (007, 008, 009) and the 3.1.0 deploy note, which says to check the board for existing scores first._
  - In "Deploying a physics change into a live draft", add that 3.1.0 (feature 008) moves both courses' geometry and the camera but not the physics, and that no committed scores existed when it shipped, so no reset was needed. Keep the three-step order as the procedure for any future bump.
  - Add a feature 008 row to the status table.
- [x] T030 [US3] Run `npm run test:determinism`. The goldens in `tests/e2e/determinism.spec.ts` are expected to be unchanged, because their traces die before x = 1,400 on the official course. If any value moves, regenerate as the file's header instructs and append a dated paragraph naming feature 008 and why.

**Checkpoint**: version, operator SQL and README agree on 3.1.0, with no reset in the
instructions.

---

## Phase 6: Polish & cross-cutting

- [x] T031 [P] Update `specs/008-reaction-time-speed/research.md` R4, R6 and R9 with the final measured numbers from T016/T020/T022, if they differ from the candidates'. _Done: final numbers recorded in spec.md "Playtest findings — 2026-09-25" and in the loop-back notes._
- [x] T032 Run the full gate as quickstart §6 lists it: `npm run lint && npx tsc --noEmit && npm test && npm run test:build`. Report every failure verbatim. The only acceptable pre-existing failure is `sprite-palette` in an environment without LFS, and it must be named as such. _Done at 22c7888: lint, tsc, 710 unit, 31/31 build, determinism 2/2._
- [x] T033 If any value in either course file or `data/camera.json` moved after the last play pass (T019/T020/T026), hand over a fresh build per T018 and record the verdict per T019 before calling the feature done (Principle VIII). _Nothing moved after the last play pass: 22c7888 is the build played._
- [x] T034 Tick completed tasks in this file, and add a validation-run note to `specs/008-reaction-time-speed/checklists/requirements.md` recording the final numbers and the play-pass verdict. _Done._

---

## Dependencies & execution order

```text
T001 ─┐
T002 ─┼─(parallel)
      ▼
T003 → T004 → T005 ─┐        T006 (parallel with T003–T005)
                    ▼
US1:  T007, T008 (parallel, tests first)
      → T009 → T010 → T011                    (camera: data file, function, call site)
      → T012 → T013 → T014 → T015 → T016      (course: one generator, one regen)
      → T017 → T018 → T019                    (play pass at the first green gate)
      → T020 (only after an accepting verdict; repeats T017–T019 if it keeps a change)
      → T021
                    ▼
US2:  T022, T023, T024 (parallel) → T025 → T026
                    ▼
US3:  T027 → T028, T029 (parallel) → T030
                    ▼
Polish: T031 → T032 → T033 → T034
```

- **The camera (T009–T011) and the course (T012–T016) are independent** and could be
  swapped. Camera first because it is smaller and on its own helps ropes and four boxes.
- **US2 depends on US1's course**: it asserts against the new geometry.
- **US3 depends on US1**: the version bump rides with the course in T015, so the
  frozen-file guard is never red on a pushed commit.

## Parallel examples

```text
# Phase 1
T001 baseline capture  |  T002 sprite fetch

# US1 tests before code
T007 camera-framing.test.ts  |  T008 reaction-budget.test.ts

# US2 assertions (different describe blocks and files)
T022 B4/B5/B7/B8  |  T023 B2  |  T024 C4/C5/C6

# US3
T028 operator SQL  |  T029 README
```

## Implementation strategy

**MVP is US1 through T019**: the camera, both courses and a play pass. That is the
whole of what the maintainer asked for, in their hands at the first point it passes
its own gate. US2 hardens the "nothing else moved" claim that research already
measured. US3 lines up every operator artifact with the version.

**Stop conditions**:

- **The maintainer rejects the feel at T019.** Loop back; do not harden a course they
  have not accepted.
- **T016 cannot reach 680 ms without breaking the booter test.** Take FR-256's
  fallbacks in order: first move boxes, then raise drag only with the maintainer's
  agreement. Never adjust the booter rig to pass.
- **T002 and T018 cannot get real sprites.** Do not hand over a build; say why.
