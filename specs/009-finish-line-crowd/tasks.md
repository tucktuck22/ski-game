---
description: 'Task list for feature 009: Finish Line'
---

# Tasks: Finish Line

**Input**: `specs/009-finish-line-crowd/`: spec.md, plan.md, research.md (R1–R8),
data-model.md, contracts/finish-sequence.md, contracts/finish-data.md, quickstart.md

**Tests**: Required. Each contract row names its test, and Principle VI requires the
built-artifact test (E1).

**Stop rule**: nothing in `src/sim/` may change. If a task seems to need it, stop and
raise it; it breaks FR-264.

## Phase 1: Setup

- [x] T001 Record the before-state: run `npm run map` and copy
      `dist/course-map.summary.txt` to the scratchpad as `before-009.txt`. Run
      `npx vitest run` and note the pass count (quickstart §1).
- [x] T002 [P] Add FN-1 to FN-4 (research R5) to `assets/style-bible.md`, in a new
      "Finish" section after §3a. Cite P-4, P-6, T-3, L-0 and F-4 where each applies.
- [x] T003 [P] Create `data/finish.json` with the values in data-model.md and a
      `$comment` explaining each, citing R1, R2, R3, R6 and R7.

## Phase 2: Foundational (blocks both stories)

- [x] T004 Add the `FinishConfig` interface and `parseFinish` to `src/data/load.ts`
      (data-model.md validation rules), add `finish` to `GameData` and `assembleGameData`,
      and load `data/finish.json` in `src/main.ts`, next to `camera.json`.
- [x] T005 [P] Write `tests/unit/finish-config.test.ts` covering D1 and D2
      (contracts/finish-data.md).
- [x] T006 Create `src/render/finish.ts` with `groundY(course, x, cfg)` (R1).
- [x] T007 [P] Write `tests/unit/finish-ground.test.ts` covering F1 and F2.
- [x] T008 Use `groundY` wherever the renderer draws or looks at ground: the terrain
      fill and edge, scenery, and the camera look-down (`lookDown` in
      `src/render/rampGeometry.ts`). Inside the course it is identical to `terrainYAt`, so
      nothing before L may change. Thread `FinishConfig` through `LookFollower` and
      `cameraFor` callers, the reaction measure in `tests/sim/reaction-budget.test.ts`, and
      `tools/course-map/build.ts`.
- [x] T009 Run `npx vitest run`. Every existing test must pass unmodified except where
      a signature gained the config. B1 to B10 must hold; any changed reading near L is
      expected (plan, Risks) and is recorded in research.md R1.

**Checkpoint**: the drawn ground exists and nothing before L moved.

## Phase 3: User Story 1, the finish line and the finish sequence (P1) 🎯 MVP

**Goal**: The gantry is visible on the approach. Crossing it holds on the mountain
while the skier coasts to a stop, FINISH lettering appears, a new press skips, and
the results arrive by panel wipe.

**Independent test**: E1 on the built artifact, plus F3 to F6 and F10 to F11.

### Tests (write first; they fail until the implementation lands)

- [x] T010 [P] [US1] Write `tests/unit/finish-sequence.test.ts`: F3 from every
      measuring pilot's final state on both courses (use `ride` from
      `tests/sim/pilots.ts`), F4 with synthetic shelf and mid-rotation states, F5 against
      synthetic `KeyboardEvent`/`PointerEvent` objects, F10 and F11.
- [x] T011 [P] [US1] Write `tests/sim/finish-visible.test.ts`: F6 (SC-094). For every
      measuring pilot on both courses, from the first tick with x ≥ L − 213, the banner
      rectangle is inside the frame given by `cameraFor` with a `LookFollower`.

### Implementation

- [x] T012 [US1] Implement `FinishSequence` in `src/render/finish.ts` (data-model.md
      phases): `start(final: RunState, motion)`, `advance()`, `skip()`, `done`, `skier()`
      returning a drawable state, `cameraX(L)` per R7, and snow spray particles that are
      off under reduced motion.
- [x] T013 [US1] Draw the gantry and the checkered strip in `src/render/draw.ts`
      (FN-1). The gantry is visible whenever L is in frame, on both courses; the strip
      lies on the piste and on any ledge whose `x1` ≥ L.
- [x] T014 [US1] Drive the sequence from `src/ui/game.ts`:
  - On the finishing tick, `finish.start(state, motion)` replaces the immediate
    `resolveFinale()`.
  - `isRunning` stays true while the sequence is active, and `tick()` advances it
    instead of stepping the simulation (R3).
  - `render()` draws `finish.skier()` with the R7 camera x.
  - Resolve the finale when done.
  - Arm a skip listener that ignores `repeat` key events (R4).
  - `onEnd` fires on the finishing tick exactly as today (FR-267).
- [x] T015 [P] [US1] Create `src/ui/finished.ts`, the FINISH overlay mirroring
      `src/ui/youDied.ts`, with `role="status"` and the reduced-motion variant. Add styles
      to `src/ui/style.css`. Show it from `src/main.ts` through a new `onFinish` callback
      from `GameView`, as `onDeath` does.
- [x] T016 [US1] Add the results panel wipe (FN-4, FR-269) in `src/ui/style.css` and
      apply its class in `endRun` in `src/main.ts`, instant under reduced motion. Leave
      `endRun`'s order untouched: commit first, then `await finale`.
- [x] T017 [US1] Make T010 and T011 pass. Run the whole unit, sim and course suite.

### Built-artifact evidence

- [ ] T018 [US1] Record the input trace. Extend `RideObserver` in `tests/sim/pilots.ts`
      to receive the tick's input. Add a script, `tools/record-trace.ts` run with
      vite-node, that writes the `tuck` pilot's warm-up inputs to
      `tests/e2e-build/fixtures/warmup-tuck.json` as run-length encoded
      `[ticks, crouch, rotate]` rows. Check in the fixture.
- [ ] T019 [US1] Write `tests/e2e-build/finish.spec.ts` (E1):
  - Claim a name and start a practice run.
  - Install Playwright's clock, and replay the trace one tick at a time with
    `page.keyboard.down/up` on the keys `src/input/keyboard.ts` maps.
  - Assert the FINISH overlay while Space is held, still present after 60 ticks, then
    the results panel with the wipe class, and the pilot's score.
  - If the replay cannot reach the line, the test fails and the gap is reported
    (research R8); never skip it.
- [ ] T020 [US1] Run `npm run build && npm run test:build`. All green, including T019.

**Checkpoint**: US1 is complete and can ship without the crowd.

## Phase 4: User Story 2, the crowd celebrates (P2)

**Goal**: A silhouette crowd behind the finish, idle until the crossing, then
celebrating with a cheer. The celebration still reads under reduced motion.

**Independent test**: F8 and F9, the crowd visible in the E1 run, and the play pass.

- [ ] T021 [P] [US2] Write `tests/unit/finish-crowd.test.ts`: F8 (colours, feet below
      `groundY`, stable layout) and F9's crowd half (no vertical motion or thrown hats
      under reduced motion).
- [ ] T022 [US2] Implement the crowd layout and pose function in
      `src/render/finish.ts`: `crowdLayout(course, cfg)` from slot hashes, and
      `crowdPose(figure, t, celebrating, motion)` per FN-3.
- [ ] T023 [US2] Draw the crowd in `src/render/draw.ts` before the terrain fill, so the
      snow edge hides the feet (FN-2). Draw only figures in frame. They are idle until a
      `FinishSequence` is active, then celebrating.
- [ ] T024 [P] [US2] Add `cue('finish')` to `src/audio/synth.ts`: a three-note pulse
      fanfare plus a crowd swell built from longer enveloped noise (A-2 voices only). Call
      it in place of `'land'` for finished runs in `endRun` in `src/main.ts`.
- [ ] T025 [US2] Make T021 pass and rerun the whole suite plus `npm run test:build`.

**Checkpoint**: both stories are complete.

## Phase 5: Polish and cross-cutting

- [ ] T026 [P] Mark the finish on the course map (FR-277, M1) in
      `tools/course-map/build.ts` and `map.html`. Extend `tests/unit/course-map.test.ts`.
- [ ] T027 Extend C7 in `tests/unit/camera-framing.test.ts` so `src/sim/*` must not
      import `src/render/finish.ts` (F7).
- [ ] T028 Run `npm run map` and diff against `before-009.txt` (quickstart §1). The
      riders' lines must be identical. Record any lead-time change near L in research.md
      R1. Then `npm run test:determinism`.
- [ ] T029 Run `npx prettier --check .`, `npm run lint` and `npx tsc --noEmit`.
- [ ] T030 Build the play-pass artifact (`npm run build:artifact`), publish it to the
      play-pass artifact (https://claude.ai/artifact/Lp6Z4Pw6F4ZbsFbHLDzaUu), and
      republish the course map (`/course-map`). Hand over with quickstart §5's checklist.
- [ ] T031 Record the maintainer's verdict verbatim in spec.md under "Playtest
      findings" (SC-100). If they ask for changes, loop back to the relevant phase and
      repeat T030.

## Dependencies

```text
T001 ─┐
T002 ─┼─> T004 ─> T005
T003 ─┘    └────> T006 ─> T007 ─> T008 ─> T009
                                  │
             US1: T010,T011 (tests) ─> T012 ─> T013 ─> T014 ─> T015 ─> T016 ─> T017
                                                                   T018 ─> T019 ─> T020
             US2 (after T012, T014): T021 ─> T022 ─> T023 ; T024 ─> T025
             Polish: T026, T027 ─> T028 ─> T029 ─> T030 ─> T031
```

- US2 depends on US1's `FinishSequence` (T012) and its wiring (T014), because the crowd
  celebrates on the crossing.
- T018 to T019 can proceed in parallel with T013 to T016 once T014 exists.

## Parallel examples

- Setup: T002 (style bible) and T003 (data file) together.
- US1 tests: T010 and T011 together, before T012.
- US1 implementation: T015 (overlay) alongside T013 (gantry drawing), in different files.
- US2: T021 (tests) and T024 (audio) together.

## Implementation strategy

- **MVP = through T020.** The gantry, the coast, the lettering, the skip and the wipe
  already fix "it just cuts to black".
- US2 adds the crowd and the cheer.
- One play pass at T030 covers both. Principle VIII puts a build in the maintainer's
  hands at the first playable point, and the finish has no gameplay feel to tune
  before the crowd exists, so a single hand-over costs nothing.
