---
description: 'Task list for feature 004 — The Skier Becomes a Drawn Character'
---

# Tasks: The Skier Becomes a Drawn Character

**Input**: Design documents from `/specs/004-skier-sprite-animation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Test tasks are included and are **not optional here**. Constitution Definition of Done item 2 requires automated tests for the behaviour, and four success criteria name automated verification explicitly — SC-055 (determinism), SC-056 (sheet blocked), SC-059 (palette, "verified automatically rather than by inspection"), SC-060 (reduced motion, "verified in an automated test rather than by eye").

**Organization**: Grouped by user story. Every task cites the requirement it satisfies; per Principle I, a task that traces to no numbered requirement is out of scope.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1–US4)
- Exact file paths in every description

## Path Conventions

Single project, existing layout: simulation in `src/sim/`, rendering in `src/render/`, parsing in `src/data/`, versioned content in `data/`, runtime binaries in `public/`, retained sources in `assets/`, tests in `tests/{unit,sim,e2e-build}/`.

---

## ⚠️ Two blockers before any of this runs

Both were found during planning, both are real, and neither is this feature's doing.

1. **The art is not in the repository.** It arrived as an image in conversation. T001–T004 exist to fix that and **everything else depends on them**. Nothing below is buildable from a screenshot.
2. **`npm run lint` is already red on `main`.** With the committed lockfile installed, `prettier --check .` reports 167 files, most untouched by this work — `package.json` asks for prettier `^3.3.3`, `package-lock.json` resolves `3.9.6`, and 3.9 formats differently. This blocks Definition of Done item 8 (CI green, checked not assumed) and it is quickstart step 1. T005 is a **decision task, resolved as its own change** — do not fold a 167-file reformat into a sprite feature.

---

## Implementation status — 2026-09-04 (art complete)

**41 of 47 complete.** Every pose is now drawn art. What remains is one separate
change and five things only a person can do.

### T003 is closed

The maintainer generated the missing frames and all fourteen poses are real drawings.
Nothing is a stand-in and nothing is derived by rotating another frame (FR-185):

| Pose group                         | Source                          | Note                                                               |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| carve x3                           | `skier.source.png`              | Three drawn ski angles (FR-183)                                    |
| crouch x3                          | `skier-crouch-leans.source.png` | Drawn at 15 / 22 / 28 degrees                                      |
| launch, air, tuck, spin, absorb x3 | `skier-poses.source.png`        | `spin` is now a real spin with motion blur, not a compact stand-in |
| wipeout                            | `skier-wipeout.source.png`      | Mid-tumble, which reads under the death sequence's rotation        |

The three gaps recorded in the previous revision — no wipeout frame, no crouch leans,
no absorb leans — are all gone.

One honest limitation remains: at the crouch's 13px height the three lean variants
differ by under a pixel across most of the body. The distinction is real in the source
and only marginally visible in game. That is a consequence of matching `crouchHeight`,
not a defect in the art.

### Still open

| Task          | Why                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **T005**      | The pre-existing prettier drift. Deliberately a separate change, not folded into this diff.                                        |
| **T043-T047** | Frame budget, playtest, first-time-viewer silhouette check, style review, CI green. Definition of Done items 6-8 require a person. |

### The asset pipeline, rewritten

The first version measured a pixel grid off one sheet and cut on those constants. It
worked for exactly one file and broke on the next, because every generated sheet lays
its cells out differently. **Frames are now found, not indexed by grid**: connected
components over "saturated or near-black" pixels, so greys — backing, cell fill, ground
line, caption text — fall out for free and a new source needs no new constants.

`npm run build:sprites` composes the sheet from four sources; each declares a reference
frame and its height in output pixels, which is what keeps a crouch cut from a
three-cell image the same scale as a carve cut from an eight-cell one.
`tests/unit/sprite-palette.test.ts` runs the tool and compares bytes, so Principle VII
is met by execution rather than by assertion.

Result: 256x64, 8 columns of 32x32, 14 poses, 1,363 bytes, 8 palette slots.

### Verified this session — commands run, Windows 11, deps from the committed lockfile

- `npx tsc --noEmit`, `npx eslint src tools tests` — clean
- `npx vitest run tests/unit tests/sim tests/course` — **321 passed**, 33 of 34 files
  green (the exception is pre-existing, below)
- `npm run build:sprites` twice to different paths — **byte-identical**
- `npm run build` — clean. Payload well inside the 2 MB gzipped ceiling, sheet
  included — **SC-058 holds**
- `playwright test --config playwright.build.config.ts --workers=1` — **26 passed, 0
  failed, 0 skipped** against the built artifact at `/ski-game/`
- Screenshotted grounded and airborne mid-run in a real browser; the poses visibly
  differ

### Five defects this work caught by running things rather than reading them

1. **`LeanState.update` advanced only one bucket per call** — a skier dropping from a
   steep pitch to a shallow runout was drawn a bucket wrong for a tick.
2. **Loading the sheet at module scope made the title screen fetch a media file**,
   breaking feature 003's SC-051. Caught only by the e2e against the built artifact.
3. **The first sheet build had no `ink` in it** — the outline is `#030207`, nearly
   unsaturated, so a saturation-keyed filter discarded it and produced an open
   silhouette against LW-2.
4. **Skin quantised to `orange` on the faces**, putting the hazard colour on the player
   against P-4. `orange` is now excluded from the sheet's quantisation set.
5. **The palette gate caught its own blind spot** — the fully transparent PLTE slot
   carries a placeholder RGB that is not a declared colour. Now exempt if and only if
   `tRNS` marks it fully transparent, with both directions asserted.

### One pre-existing condition, unchanged

`tests/unit/no-verified-claims.test.ts` cannot run on Windows: it builds a path from
`new URL(...).pathname`, yielding `/C:/...claude%20code/...` — a leading slash and an
undecoded space. Fails identically on a clean tree; passes on CI's Linux. The prettier
drift (T005) is the other, and is its own task.

---

## Phase 1: Setup (the art, and the blocked gate)

**Purpose**: get the asset into the repository in the form the rest of the work assumes.

- [x] T001 Retain the supplied sheet unmodified as the editable source at `assets/sprites/skier.source.*`, preserving its original layout including the duplicate `6`/`13` cell numbering and the five empty cells (FR-171)
- [x] T002 Re-cut the sheet into a contiguous, uniformly celled grid with exactly one meaning per cell, exported to `public/sprites/skier.png` as **8-bit indexed PNG (colour-type 3)** (FR-159, FR-160, research R2)
- [x] T003 Author the additional lean variants the sheet does not already contain — three grounded orientations spanning the measured 11.66°-31.76° band for each of carve, crouch and absorb. Each MUST be **drawn** in the same hand and pass the same style review; producing one by rotating an existing cell is forbidden and is the exact artefact Q2 chose pose-selection to avoid (FR-183, FR-185, research R1)
- [x] T004 [P] Write `assets/sprites/README.md` recording provenance — names the work, names its author, establishes it as an original work the project owns — mirroring the structure of `assets/audio/README.md` (FR-170, rule A-5, O-1)
- [ ] T005 [P] Resolve the pre-existing prettier version drift **as a separate change**: either pin `prettier` to `3.3.x` in `package.json` + `package-lock.json`, or run `prettier --write .` once and commit the reformat. Record which was chosen. Not part of this feature's diff (Definition of Done item 8)

**Checkpoint**: the art exists in the repo in both forms, and `npm run lint` can go green.

---

## Phase 2: Foundational (the sprite system + the palette amendment)

**Purpose**: the reusable machinery, and the governance change the art cannot ship without.

**⚠️ CRITICAL**: no user story work begins until this phase is complete.

### The palette amendment — FR-180 requires all four to ship together

- [x] T006 Sample the skin colour from the shipped sheet's own `PLTE` chunk (never invented, never eyedropped from a screenshot) and add it as the ninth token in `src/render/palette.ts` (FR-179, research R5)
- [x] T007 Add the ninth row to the palette table in `assets/style-bible.md` section 1, plus a new `P-*` rule assigning the token its role and forbidding it as a ground, text, terrain-edge or hazard colour (FR-179, FR-181)
- [x] T008 Write `docs/adr/0010-a-ninth-colour.md` explaining why "eight colours. Nothing outside this set" stopped being true, following the form of `docs/adr/0009-recorded-music.md` (FR-180)
- [x] T009 Update `tests/unit/palette.test.ts`: the exhaustive token assertion goes from eight to nine, and a new case asserts the skin token separates from `orange` under protanopia, deuteranopia and tritanopia at the threshold already applied to the magenta/orange pair (FR-182). **If this fails, the art changes — not the threshold** (research R5)

### The palette gate — generalises to every future sprite

- [x] T010 [P] Write `tools/check-sprite-palette.ts`: parse PNG chunks, assert `IHDR` colour-type 3 and bit-depth ≤ 8, read `PLTE`, assert every entry is one of the nine tokens, assert `tRNS` marks only fully transparent or fully opaque entries. No dependencies, no zlib, no pixel walk (research R2)
- [x] T011 [P] Write `tests/unit/sprite-palette.test.ts` running T010's checker over **every** PNG under `public/sprites/`, so a future sprite inherits the gate without being added to a list (FR-162, SC-059)

### The manifest

- [x] T012 Create `data/sprites.json` with the `skier` sheet entry — cell geometry, `columns`, `anchorX` at the **ski centre** and `anchorY` at the ski line, and the fourteen pose keys — plus a `$comment` recording the bare-filename rule and the indexed-PNG requirement, as every other file in `data/` does (FR-160, contracts/sprite-manifest.md, research R1)
- [x] T013 Add `parseSprites()` to `src/data/load.ts` and extend `GameData` with `sprites`, enforcing every validation rule in data-model.md §1 — including **`file` must be a bare filename containing no `/`**, with the same error-message reasoning `parseAudio()` already carries (FR-160, FR-173)
- [x] T014 [P] Write `tests/unit/sprite-manifest.test.ts` covering the schema, duplicate ids, the bare-filename rejection, non-integer geometry rejection, and the presence of all fourteen required skier poses (FR-160, FR-165, FR-173)

### The loader

- [x] T015 Write `src/render/sprites.ts`: the **generic** sheet loader and integer blitter. Applies `import.meta.env.BASE_URL` in this one place; exposes readiness; blits a cell at rounded destination coordinates with no scale and no rotation. Knows nothing about skiers, poses or run state (FR-159, FR-173, FR-178, research R3)
- [x] T016 Wire `data/sprites.json` into `src/main.ts` alongside the existing data imports, and start the sheet load without blocking the first frame (FR-159, FR-173)
- [x] T017 Validate cell indices against the loaded image's real dimensions at load time; a pose referencing a cell past the end of the sheet is a load failure that trips the fallback rather than drawing garbage (data-model.md §1)

**Checkpoint**: the palette is nine tokens and enforced; a sheet can be declared, loaded and blitted. No skier logic exists yet.

---

## Phase 3: User Story 1 — The player can see what he is doing (P1) 🎯 MVP

**Goal**: the character's pose tells the player what the simulation thinks he is doing — carving, charging, launched, airborne, absorbing, crashed.

**Independent Test**: play one practice run through a cruise, a held crouch, a launch, an air and a landing, and confirm the character takes a visibly different correct pose for each, without reading the HUD.

### Tests for User Story 1

- [x] T018 [P] [US1] Write `tests/unit/skier-pose.test.ts` as a direct transcription of the precedence table in [contracts/pose-selection.md](./contracts/pose-selection.md) — all eight rules, first-match-wins, one case per row (FR-165, FR-167)
- [x] T019 [P] [US1] Add the edge-case block to `tests/unit/skier-pose.test.ts`: touchdown with a spin turning resolves `wipeout` not `absorb`; ramp relaunch two ticks into an absorb resolves airborne; `crouchProfile` hovering at the threshold does not alternate; slope on a lean boundary does not alternate; slope beyond 31.76° clamps rather than throwing; apex `vy === 0` resolves `tuck` (FR-166, FR-167, FR-168, FR-184)

### Implementation for User Story 1

- [x] T020 [P] [US1] Create `src/render/skierPose.ts` with the closed `PoseKey` union of the fourteen keys and the `selectPose(state: Readonly<RunState>, absorb, lean): PoseKey` signature. Imports nothing from the DOM or canvas (FR-164, FR-165, research R6)
- [x] T021 [US1] Implement lean bucketing in `src/render/skierPose.ts`: three buckets over the measured 11.66°–31.76° band, compared against pre-computed sines of the boundaries so no trigonometry runs at draw time, clamping outside the band (FR-183, research R1, data-model.md §2)
- [x] T022 [US1] Implement boundary hysteresis in `src/render/skierPose.ts`, carrying the current bucket in render-owned `LeanState` so a slope sitting on a terrain vertex resolves stably instead of alternating at tick rate (FR-184, research R8)
- [x] T023 [US1] Implement the precedence chain in `selectPose` in exactly the contract's order — wipeout, spin, air, tuck, absorb, crouch, launch, carve (FR-165, FR-167)
- [x] T024 [US1] Implement the launch window in `src/render/skierPose.ts`, derived by comparing consecutive states rather than from any `RunState` field, and time-boxed so a stalled tick cannot hold the pose indefinitely (FR-164, FR-165, contracts/pose-selection.md)
- [x] T025 [US1] Implement `AbsorbTimer` in `src/render/` modelled on `LandingEffect`: triggered by the view observing `grounded` false→true, advanced from the **simulation tick** not the frame, cancelled the moment `grounded` goes false again, and not triggered on a wipeout landing (FR-168, research R7, data-model.md §3)
- [x] T026 [US1] Rewrite `drawSkier()` in `src/render/draw.ts` to blit the selected pose cell — no `ctx.rotate` for a grounded or airborne skier, integer destination coordinates, anchored at the ski centre (FR-159, FR-169, FR-178)
- [x] T027 [US1] Keep continuous rotation in `src/render/draw.ts` for the two permitted cases only: a spin that is turning, and the wipeout tumble (FR-169)
- [x] T028 [US1] Retire the separately drawn sine-driven scarf from the sprite path in `src/render/draw.ts`, since the sheet draws it — leaving it intact in the fallback path (spec Assumptions)
- [x] T029 [US1] Advance `AbsorbTimer` and `LeanState` from the run loop's tick in `src/render/loop.ts` or its caller, and reset both when a run starts (FR-168, data-model.md §3)

**Checkpoint**: US1 is fully functional and independently testable. This is the MVP.

---

## Phase 4: User Story 2 — Nothing about the run changes but the picture (P1)

**Goal**: identical scores, outcomes and state hashes before and after.

**Independent Test**: replay a run record captured before this change; assert score, outcome, wipeout reason and state hash are byte-identical.

**Note on independence**: this story's guarantee is established _by construction_ during Phase 3 (no `RunState` field is added) and _verified_ here. It is independently testable but not independently implementable — stated plainly rather than pretended otherwise.

### Tests for User Story 2

- [x] T030 [P] [US2] Extend `tests/unit/sim-isolation.test.ts` with a structural gate asserting `RunState` in `src/sim/types.ts` still carries exactly its known field set, so a field added for presentation fails in milliseconds on every commit rather than at the three-engine gate (FR-164)
- [x] T031 [P] [US2] Add a static assertion to `tests/unit/sim-isolation.test.ts` that nothing under `src/sim/` imports from `src/render/`, extending the existing source-scan pattern to the sprite modules (FR-164)
- [x] T032 [US2] Run `npm run test:sim` and `npm run test:determinism` and confirm results identical to the pre-feature build across Chromium, Firefox and WebKit (SC-055)

### Implementation for User Story 2

- [x] T033 [US2] Confirm `selectPose` and every new render module take `Readonly<RunState>`, so a write to simulation state from the render layer is a compile error rather than a review catch; verify with `npx tsc --noEmit` (FR-164, research R6)
- [x] T034 [US2] Confirm no value in `data/tuning.json` changed, and that absorb duration and the hysteresis band are render-layer constants rather than tuning entries (FR-161, plan.md Constitution Check)

**Checkpoint**: the leaderboard is provably unaffected.

---

## Phase 5: User Story 3 — The character survives a missing or broken sheet (P2)

**Goal**: a run is never blocked by decoration.

**Independent Test**: block the sheet request in a real browser against the built artifact at `/ski-game/`, then complete a full run and commit a score.

### Tests for User Story 3

- [x] T035 [P] [US3] Write `tests/e2e-build/sprite-base-path.spec.ts`: the request for `/ski-game/sprites/skier.png` returns 200 and a run renders, following `music-base-path.spec.ts` (FR-173)
- [x] T036 [P] [US3] Write `tests/e2e-build/sprite-never-blocks.spec.ts`: abort the sheet route, then play a full run and commit a score, following `music-never-blocks.spec.ts` (FR-172, SC-056)

### Implementation for User Story 3

- [x] T037 [US3] Make `drawSkier()` in `src/render/draw.ts` two-branch — sheet ready blits the pose, sheet not ready (loading, 404, decode failure, missing manifest entry, or out-of-range cell) draws the **incumbent primitive skier unchanged**. Do not delete the existing renderer (FR-172, research R4)
- [x] T038 [US3] Ensure a sheet load failure is non-fatal at every call site in `src/main.ts` and `src/render/`, and that the first frame renders without an exception while the sheet is still in flight (FR-172)

**Checkpoint**: the failure path is exercised deliberately, not assumed.

---

## Phase 6: User Story 4 — Reduced motion keeps the information (P2)

**Goal**: pose still carries state under reduced motion; only decorative movement is dropped.

**Independent Test**: enable reduced motion, play through a crouch, launch, air and landing, and confirm every state-carrying pose still appears while decorative movement does not.

### Tests for User Story 4

- [x] T039 [P] [US4] Add the reduced-motion block to `tests/unit/skier-pose.test.ts`: run the entire precedence table under `REDUCED_MOTION` and assert the pose is **identical** in every row. A differing row means reduced motion changed what the player is told (FR-174, SC-060)

### Implementation for User Story 4

- [x] T040 [US4] Confirm `selectPose` never reads `MotionSettings` — the contract is that it cannot, so pose can never become motion-dependent (FR-174, contracts/pose-selection.md)
- [x] T041 [US4] Gate only decorative multi-cell cycling within static-state poses on `MotionSettings` in `src/render/draw.ts`, keeping the pose itself and the full absorb duration in both modes (FR-174, rule LT-6)

**Checkpoint**: all four stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T042 [P] Measure the payload delta: compare `dist/` totals before and after, confirm the initial payload stays under 2 MB gzipped, and state the addition in the change description (FR-176, SC-058)
- [ ] T043 Measure frame time through a full run on the built artifact at `/ski-game/` and compare with the pre-feature measurement; expected no worse. **Manual — no CI gate exists** (constitution deviation 3). Name the command and environment in the change description per Definition of Done item 7 (FR-177, SC-057)
- [ ] T044 Human playtest per [quickstart.md](./quickstart.md) step 6, including the ramp-relaunch case, the upper track, terrain vertices, and both reduced-motion checks; record findings against this spec (SC-053, SC-061, SC-062)
- [ ] T045 Show a first-time viewer the opening frame and confirm they identify the skier and pick him out from the hazards within one second; confirm the character's **silhouette** differs from every hazard silhouette with hue removed entirely (FR-175, SC-054, rule P-5)
- [ ] T046 [P] Confirm at style review that the sheet cites the style-bible rules it satisfies (FR-052), that the character reads **magenta-dominant**, and that `orange` appears nowhere as a dominant colour on it — the player must never read as a hazard (FR-162, FR-163, rule P-4, Principle IV)
- [ ] T047 Run the full quickstart start to finish and confirm CI is green on the head commit — **checked, not assumed**, and only once T005 has resolved the pre-existing lint failure (Definition of Done item 8)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)** — no dependencies, but T001/T002 gate literally everything else
- **Phase 2 (Foundational)** — depends on Phase 1; **blocks all user stories**
- **Phase 3 (US1)** — depends on Phase 2. The MVP
- **Phase 4 (US2)** — verifies Phase 3; T030/T031 can be written earlier, T032/T033 need Phase 3 complete
- **Phase 5 (US3)** — depends on Phase 2; T037 touches the same function as T026, so it follows Phase 3
- **Phase 6 (US4)** — depends on Phase 3 (needs poses to assert parity over)
- **Phase 7 (Polish)** — depends on all desired stories

### Story dependencies

- **US1 (P1)**: after Phase 2. No dependency on other stories
- **US2 (P1)**: guarantee built during US1, verified here. Its static gates (T030, T031) are independent and can land first
- **US3 (P2)**: after Phase 2 for its tests; its implementation shares `drawSkier()` with US1
- **US4 (P2)**: after US1

### The one shared-file conflict to respect

`src/render/draw.ts` is touched by T026, T027, T028, T037 and T041. **None of these are `[P]` with each other.** Sequence them.

`tests/unit/skier-pose.test.ts` is touched by T018, T019 and T039 — the first two are `[P]` because they are separate blocks written before the file is contended; T039 follows US1.

### Parallel opportunities

- **Phase 1**: T004, T005 in parallel with each other (T001→T002 are sequential)
- **Phase 2**: T010 + T011 (the palette gate) run in parallel with T012 + T014 (the manifest). T006–T009 are one atomic group per FR-180
- **Phase 3**: T018 + T019 in parallel; T020 in parallel with them
- **Phase 5**: T035 + T036 in parallel
- **Phase 7**: T042 and T046 in parallel with everything

---

## Parallel Example: Phase 2

```bash
# The palette gate and the manifest are independent — different files, no shared state:
Task: "Write tools/check-sprite-palette.ts (T010)"
Task: "Write tests/unit/sprite-palette.test.ts (T011)"
Task: "Create data/sprites.json (T012)"
Task: "Write tests/unit/sprite-manifest.test.ts (T014)"

# But T006-T009 are ONE change set (FR-180): palette token, style bible row,
# ADR-0010 and the tightened palette test ship together or not at all.
```

---

## Implementation Strategy

### MVP first

1. Phase 1 — get the art in (nothing works without it)
2. Phase 2 — sprite system + palette amendment
3. Phase 3 — US1
4. **STOP and VALIDATE**: play a run; the character poses correctly
5. Run T032 immediately after — determinism is the one thing that must never be discovered late

### Incremental delivery

1. Setup + Foundational → a sheet can be loaded and blitted
2. - US1 → the drawn skier works (**MVP**)
3. - US2 → provably no score changed
4. - US3 → provably unbreakable by a missing asset
5. - US4 → provably accessible

### Risk order

The two tasks most likely to force rework, front-loaded deliberately:

- **T009** — if the skin token fails the CVD check, the **art** changes and T002 is redone. Run it the moment T006 lands
- **T002** — if the sheet cannot be expressed as indexed colour within nine tokens, the whole Q1 decision is back open

---

## Notes

- `[P]` = different files, no dependency on incomplete work
- Every task cites its requirement; Principle I rejects untraceable work
- Commit after each task or logical group; T006–T009 commit as one
- Do **not** report CI green until T005 is resolved separately — the lint failure predates this feature and is not this feature's to hide or to fix inline
