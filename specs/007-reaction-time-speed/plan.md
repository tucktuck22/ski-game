# Implementation Plan: Time to See the Box

**Branch**: `claude/bold-albattani-pag0m9` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-reaction-time-speed/spec.md`

## Summary

Boxes on the official course's steep ground give a player as little as **365 ms** to
decide. The spec's target is 680 ms. Two things cause it:

- **The camera hides steep hazards below the frame.** It holds the skier 60% of the way
  down, leaving 72 units below.
- **Riders arrive faster than the slope's own speed.** There is no drag in the air, so
  every jump and every ramp hop adds speed, and it is still bleeding off when the next
  box appears.

The plan fixes both without touching `data/tuning.json`:

1. **Camera look-down** (render-only). On steep ground, show the piste up to 213 units
   ahead, capped so a shelf overhead stays in frame, and never less than today's
   airborne lift.
2. **Eased approaches**, authored in the course generator's gradient programme:
   - the Narrows (3,200–4,600) eased to 0.30 throughout;
   - short eases before the boxes at 1,830 and 6,100, and before the Last Pitch box;
   - speed given back where the eases would otherwise have moved a kicker or the small
     booter.
3. **One box moves**, 11,600 → 11,680, as FR-241's first fallback.

`rulesVersion` goes 2.0.0 → 2.1.0, and no reset is needed.

All of this was measured in simulation before planning
([research.md](./research.md)). Every box then gets 681–748 ms. Kicker lip speeds are
within 2%, rotations are unchanged, the validator is clean, both pilots finish, and no
rope loses time; six ropes gain more than 100 ms.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), ES modules. Node 22 for tools (`--experimental-strip-types`)

**Primary Dependencies**: none added. Vite 5, Pixi 8 (unused by this change; the renderer here is Canvas 2D)

**Storage**: N/A. Course and tuning are versioned JSON; Supabase only compares `rulesVersion` strings

**Testing**: Vitest (unit/sim/course), Playwright (built artifact at `/ski-game/`, determinism across 3 engines), Postgres invariants

**Target Platform**: evergreen mobile web (Safari iOS 16+, Chromium/Firefox Android 10+), fixed 320×180 buffer

**Project Type**: single-project browser game with a deterministic simulation separated from rendering

**Performance Goals**: sim step ≤ 2.0 ms per 60 Hz tick (untouched). The camera adds two `terrainYAt` lookups and one ledge scan per frame, which is negligible

**Constraints**: bit-for-bit determinism (the sim is not touched); `tuning.json` byte-identical; horizontal lookahead fixed at 213 on every device; every CV rule holds

**Scale/Scope**: one generated course file, one version string on two courses, one renderer function, two operator SQL literals, one frozen-file test, one new sim test, one new unit test

## Constitution Check

_GATE: evaluated before Phase 0 and re-checked after Phase 1. **PASS.**_

| Principle                           | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Spec-driven (NN)**             | Every change traces to FR-231–FR-244. Research found the spec wrong on four facts (below), so the spec is amended in this change set before tasks, as the principle requires.                                                                                                                                                                                                                                                                                       |
| **II. Stability**                   | The simulation is untouched. Determinism goldens are expected unchanged (R7), and the camera is render-only (C7). The monkey test and pilots run on the new course. No save schema changes.                                                                                                                                                                                                                                                                         |
| **III. Fun is testable**            | Every feel target is numeric: 680 ms, ±2% lip speed, rotations equal, rope lead ≥ baseline. Tuning stays in data and does not move. **Camera constants in code**: `LOOK_MARGIN`, `SHELF_MARGIN` and `SHELF_EASE_IN` sit beside the existing `AIR_LIFT_MAX` and `CAMERA_X_OFFSET`. They are frame geometry, cannot change a score, and follow the precedent that camera framing is not a `tuning.json` value. Recorded rather than assumed; see Complexity Tracking. |
| **IV. One voice**                   | No new asset. Legibility outranks style: this feature exists to un-hide hazards.                                                                                                                                                                                                                                                                                                                                                                                    |
| **V. Fair competition**             | The same view on every device, because the horizontal lookahead is unchanged and the look-down depends only on the course. `rulesVersion` bumps, so scores under 2.0.0 and 2.1.0 are never compared. Client-trust deviation 4 is unchanged.                                                                                                                                                                                                                         |
| **VI. Shipped artifact (NN)**       | `npm run test:build` drives the built artifact at `/ski-game/`. **Gap, stated**: no browser test asserts the camera's vertical framing from pixels. It is proven on the pure `cameraFor` function the renderer calls, and seen by a human in the play pass.                                                                                                                                                                                                         |
| **VII. Operator instructions (NN)** | `seed-draft.sql` and `fix-rules-version.sql` carry the version literal and move to 2.1.0. CI already executes both against Postgres. The README's rules-version section gains the 2.1.0 entry, stating that no reset is needed.                                                                                                                                                                                                                                     |
| **VIII. Player judges fun (NN)**    | Course and camera change feel, so a single-file build goes to the maintainer at the first playable point: **task order puts it before hardening tests are finalised**. The real sprite is required (R8), and quickstart §6 lists the four questions.                                                                                                                                                                                                                |

**Post-design re-check**: PASS. Phase 1 added no dependency, no persisted state and no
simulation code.

## Project Structure

### Documentation (this feature)

```text
specs/007-reaction-time-speed/
├── spec.md              # amended in this change (see Spec amendments)
├── plan.md              # this file
├── research.md          # R1–R8, all measured
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── camera-framing.md
│   └── reaction-budget.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks, not created here
```

### Source Code (repository root)

```text
tools/gen-courses.ts               # OFFICIAL_GRADE keys; deadfall 11,600 -> 11,680; rulesVersion 2.1.0 (both courses)
data/courses/official.json         # regenerated
data/courses/warmup.json           # regenerated (rulesVersion only)
src/render/rampGeometry.ts         # + lookDown(course, x, onPiste), + LOOK_MARGIN / SHELF_MARGIN / SHELF_EASE_IN
src/render/draw.ts                 # cameraFor: shift = max(cameraAirLift, lookDown)
tests/sim/pilots.ts                # + low-line tucked rider, next to the existing pilots
tests/sim/reaction-budget.test.ts  # new: B1–B9
tests/unit/camera-framing.test.ts  # new: C1–C7
tests/unit/tuning-frozen.test.ts   # retargeted: tuning.json stays frozen; official.json must bump rulesVersion when it moves
tests/e2e/determinism.spec.ts      # goldens: expected unchanged; regenerated with a dated note only if they move
supabase/seed-draft.sql            # '2.0.0' -> '2.1.0'
supabase/fix-rules-version.sql     # target '2.0.0' -> '2.1.0'
README.md                          # rules version section: 2.1.0, no reset
```

**Structure Decision**: this is the existing single project. No new directories. The
new tests sit in the existing `tests/sim` and `tests/unit` suites, which CI already runs.

## Implementation order

The order is set by Principle VIII: playable first, hardened second.

1. **Camera** (`lookDown` plus `cameraFor`), with its unit test. It is independent and
   verifiable alone, and on its own it helps ropes and four of the boxes.
2. **Course**: generator keys, the box move and the version bump. Regenerate, then run
   the validator, the booter, track and base-jump suites, and scoring dominance.
3. **Fetch the real sprites, build the single-file artifact, and hand it to the
   maintainer** (FR-240). Record the verdict before any value moves again.
4. **Harden**: `reaction-budget.test.ts` with the committed baseline table, the
   frozen-file retarget, the operator SQL and the README.
5. **The full gate**: lint, tsc, `npm test`, `test:build`, `test:determinism`.

## Spec amendments

Research contradicted the spec in four places. Principle I says a spec that disagrees
with the facts is a defect, so these are corrected in `spec.md` in this change:

1. **The worst box is 365 ms, not 398 ms, and the box at 1,830 fails** (631 ms) once
   measured on a real ride rather than a clean approach (R1). Context, SC-081 and FR-233
   are updated.
2. **The reduction needed at the box is 5–19% of horizontal speed, not "about 8%"**:
   4.65 → 4.43 at 1,830, up to 5.41 → 4.45 at 4,640. Clarifications and Key Entities are
   updated.
3. **The ramp at 5,200 is the Cornice shelf ramp, not the big booter.** The big booter
   is at 9,188. User Story 2, the Edge Cases and FR-241 named the wrong one.
4. **FR-233's "terrain changes only on a failing box's approach" is too strict to meet
   FR-235.** Easing under the Cornice also eases the shelf above it, and that costs the
   small booter a tick of air (R5). FR-233 now allows terrain changes that exist only to
   give speed back downstream, each one named. The move of the box from 11,600 to 11,680
   is recorded as FR-241's first fallback, taken.

FR-243 is also sharpened: "the shelf stays in frame as it does today" becomes "the
shelf's top edge stays at least 8 units inside the frame" (R3).

## Risks

| Risk                                                                                           | Mitigation                                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four boxes pass by one 16.7 ms tick; any later edit can tip them                               | The test names the box and the measured ms. Look for a tick of headroom during implementation.                                                      |
| The booter rotation test has zero margin and responds non-monotonically to upstream edits (R5) | Re-run it after every `OFFICIAL_GRADE` edit (quickstart §4). Never adjust the rig to pass.                                                          |
| The kicker at 11,000 is at −1.8% of the 2% limit                                               | It is asserted in B5. If implementation needs more easing at the Last Pitch, move the box further before steepening anything else.                  |
| The play-pass build ships the fallback skier                                                   | R8: assert the PNG signature before building. Do not hand over otherwise.                                                                           |
| The maintainer finds the eased Narrows dull (SC-085)                                           | Their reading wins (Principle VIII). The documented fallbacks are, in order: shorter eases with a larger camera margin, then moving boxes (FR-241). |

## Complexity Tracking

| Item                                                           | Why needed                                                                                                                                                      | Simpler alternative rejected because                                                                                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera constants in code, not `tuning.json` (Principle III)    | They are frame geometry derived from the 320×180 buffer, like the existing `CAMERA_X_OFFSET` and `AIR_LIFT_MAX`, and they never reach the simulation or a score | Putting them in `tuning.json` would break FR-232 (tuning byte-identical), and would put render values in the file the simulation reads, which is the coupling the architecture separates |
| Terrain changes beyond the box approaches (6,300–6,800; 5,000) | Without them the small booter loses a rotation, or the Cornice ramp its speed (R4, R5)                                                                          | Leaving them out fails FR-235. Re-solving booter power instead changes what the zero-margin rig measures                                                                                 |
