# Implementation Plan: Finish Line

**Branch**: `claude/bold-albattani-pag0m9` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-finish-line-crowd/spec.md`

## Summary

A finished run currently ends on the tick the simulation marks it finished, and the
results panel replaces the mountain in the same frame. This feature adds:

- a finish gantry at the course's length;
- a drawn finish area beyond it;
- a finish sequence on the model of the wipeout's, in which the skier coasts to a stop,
  FINISH lettering sits over the live view, and a crowd of backlit silhouettes
  celebrates with a synthesised cheer;
- a panel wipe into the results.

Everything past the line is drawn, not simulated. The course files, the simulation, the
scores and the rules version do not change (research R1).

## Technical Context

**Language/Version**: TypeScript 5 (strict), ES2022 modules

**Primary Dependencies**: Vite build, Canvas2D renderer (`src/render/draw.ts`), Web
Audio synth (`src/audio/synth.ts`). No new dependencies.

**Storage**: None. A new data file, `data/finish.json`, holds the feel values
(Principle III).

**Testing**: Vitest (unit, sim), Playwright against the built artifact
(`tests/e2e-build`, Principle VI)

**Target Platform**: Mobile and desktop browsers. 320×180 internal frame, 60 Hz fixed
simulation.

**Project Type**: Single-page web game

**Performance Goals**: Hold the existing frame budget. The crowd is about 60 flat-colour
figures, drawn only while the finish area is in frame.

**Constraints**:

- Bit-for-bit determinism (Principle II). Nothing added may be read by `src/sim`.
- The official score commits before the hold ends (FR-267).
- The hold is advanced per simulation tick, never per display frame.
- Every colour is a palette token (P-1 to P-6).

**Scale/Scope**: Two courses, one sequence, one crowd, one results transition.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                           | How this plan meets it                                                                                                                                                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Spec-driven (NN)**             | Spec 009 is clarified and has no open markers. Every task will trace to FR-262 to FR-277. The style bible gains finish rules in the same change set (see IV).                                                                                                                     |
| **II. Stability**                   | No simulation change, and runs stay bit-identical (R1, R2). The run-out beyond L+200 is never read by `src/sim`. The existing determinism goldens and the course map's rider summary must be unchanged, and both are checked (quickstart §1). The crowd draws only when in frame. |
| **III. Fun testable**               | Feel values live in `data/finish.json` with a parser and tests (R6), as `data/camera.json` does. Measurable criteria: SC-094 to SC-099. SC-100 is the human play pass.                                                                                                            |
| **IV. Style bible**                 | New rules FN-1 to FN-4 go into `assets/style-bible.md` (R5): the gantry, the crowd as `ink` silhouettes with a `cyan` rim, no `skin`, no `orange`, no `magenta`, and the results panel wipe (F-4). The existing palette test keeps every colour a token.                          |
| **V. Fair competition**             | Nothing reaches scoring or the rules version, and all runs finish identically. The celebration is the same for every finish (FR-276).                                                                                                                                             |
| **VI. Shipped artifact (NN)**       | The end-to-end evidence is a build test that replays a measuring pilot's recorded inputs through a real practice run on the built artifact, on a stepped clock, up to the results panel (R8). Where that cannot cover something (sound output), the gap is stated in quickstart.  |
| **VII. Operator instructions (NN)** | No SQL, setup or README steps change. `npm run map` gains the finish marker, and its skill needs no change.                                                                                                                                                                       |
| **VIII. Play pass (NN)**            | This is a feel change. A built artifact goes to the maintainer after implementation, and the verdict is recorded in the spec (SC-100).                                                                                                                                            |

**Result**: PASS. No violations; nothing for Complexity Tracking.

**Post-design re-check**: PASS. The design adds one data file, one render module, one
UI overlay and a CSS transition. `src/sim` is untouched (contract F7 enforces it).

## Project Structure

### Documentation (this feature)

```text
specs/009-finish-line-crowd/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── finish-sequence.md   # the coast, the hold, the skip, the camera
│   └── finish-data.md       # data/finish.json, the ground past the line, the crowd
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
data/finish.json                   # NEW - hold, run-out, stop, framing, crowd layout
src/data/load.ts                   # parseFinish, FinishConfig on GameData
src/main.ts                        # load finish.json; the finish cue; the results wipe
src/render/finish.ts               # NEW - groundY (drawn ground), FinishSequence, crowd layout
src/render/draw.ts                 # draw the gantry, the finish area and the crowd; groundY for the terrain beyond L
src/render/rampGeometry.ts         # lookDown reads groundY, so the camera sees the drawn run-out
src/ui/game.ts                     # drive the sequence per tick; skip that ignores key repeats
src/ui/finished.ts                 # NEW - the FINISH lettering overlay (sibling of youDied.ts)
src/ui/style.css                   # lettering styles; the results panel wipe (F-4)
src/audio/synth.ts                 # cue('finish'): fanfare plus crowd swell
assets/style-bible.md              # FN-1 to FN-4
tools/course-map/build.ts, map.html  # the finish marker (FR-277)
tests/unit/finish-ground.test.ts   # NEW - F1, F2
tests/unit/finish-sequence.test.ts # NEW - F3 to F5, F9
tests/unit/finish-config.test.ts   # NEW - the parser
tests/unit/finish-crowd.test.ts    # NEW - F8
tests/sim/finish-visible.test.ts   # NEW - F6 (SC-094), with the real camera and pilots
tests/sim/pilots.ts                # the observer also receives the input, so a trace can be recorded
tests/e2e-build/finish.spec.ts     # NEW - R8: replay to the finish on the built artifact
tests/e2e-build/fixtures/warmup-tuck.json  # NEW - the recorded input trace
```

**Structure Decision**: Follows the existing split. Drawing and presentation state
live in `src/render`, DOM overlays in `src/ui`, and feel values in `data/`. The new
`src/render/finish.ts` mirrors `src/render/death.ts`, which is the wipeout's
equivalent.

## Risks

| Risk                                                                             | Mitigation                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The drawn run-out diverges from what the simulation reads on the final tick.     | The run-out starts easing only past L. Over the at most ~8 units the final tick can travel, it differs from the data by under 0.25 units (the warm-up's data itself turns 0.30 → 0.32 at its line) (R1). F2 bounds it. |
| `lookDown` reading `groundY` moves reaction readings near the end of the course. | Only hazards within 213 units of L are affected (the rope at 11,900). B1 to B10 must still pass. The course map diff shows any change.                                                                                 |
| The replay drifts from the pilot in the browser (timing or input sampling).      | The seed has no effect on the simulation (R8). If the replay cannot reach the line, the test fails loudly and the gap is stated; it is never silently skipped.                                                         |
| The crowd reads as hazards.                                                      | Silhouettes stand behind the snow edge, feet hidden (FN-2). No `orange` anywhere in the crowd (P-4, F8).                                                                                                               |
| The shelf rider drops 50 units past the line and it reads as a fall.             | A ballistic drop with the orientation eased to the ground, landing clean (R2). The play pass judges it.                                                                                                                |

## Complexity Tracking

None.
