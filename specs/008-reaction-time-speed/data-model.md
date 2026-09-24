# Data Model: Time to See the Box

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-24

This feature adds **no entity, no table, no persisted field and no run state**. It
changes the shape of both course files, moves one obstacle, bumps one version string,
adds one small render-side data file, and adds one pure function of existing state to
the renderer.

---

## 1. Official course (data file, generated)

`data/courses/official.json`, written by `tools/gen-courses.ts`. It is never edited by
hand; the generator is edited and re-run.

| Field                              | Change                                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rulesVersion`                     | `2.0.0` → `2.1.0`                                                                                                                                                            |
| `terrain[]`                        | Every point from x = 1,600 onward moves in y, because easing changes all descent after it. x values are unchanged: 200-unit spacing, 62 points                               |
| `obstacles[]` (`solid` at 11,600)  | x → 11,680                                                                                                                                                                   |
| `kickers[].power` (pop ramps)      | Re-derived by the generator from the gradient at each lip. Expected to be unchanged, because the lips' gradients are held, but whatever the generator emits is authoritative |
| `ice[]` spans                      | Re-derived from the gradient under each band. The bands at 1,876, 5,546, 5,746 and 11,350 are recomputed as they always are                                                  |
| `ledges[]`, `rocks[]`, `pickups[]` | Unchanged in x. Ledges and pickups are stored relative to the piste, so they follow it                                                                                       |
| `length`                           | Unchanged (12,000)                                                                                                                                                           |

The gradient programme that produces it is in [research.md § R4](./research.md#r4--course-where-to-ease-the-ground-and-how-much).

**Validation**: every rule in `src/course/validate.ts` must hold (FR-249). In
particular:

- **CV-10**: adjacent segments within `landingAngleTolerance`.
- **CV-11**: a log 140 clear of a bough, which is what caps the moved box at 11,686.
- **CV-13**: shelves stay a choice.
- **CV-23**: no segment near stall.

The gentlest gradient used stays 0.25.

## 2. Warm-up course (data file, generated)

`data/courses/warmup.json`, from `WARMUP_GRADE` in the same generator:

- `rulesVersion` `2.0.0` → `2.1.0`, kept in step with the official course.
- Terrain from x = 4,800 onward: the approach to its box at 5,200 is eased to 0.25,
  and the ground gives the speed back at 5,300–5,400
  ([research R9](./research.md#r9--the-warm-up-course-has-a-failing-box-too)).
- The warm-up ramp's `power` and the shelf follow as the generator derives them.

The coached section (0–3,200) and every obstacle x are unchanged. The warm-up's
version is never submitted, so none of this has a draft consequence.

## 3. Tuning

`data/tuning.json`: **no change, byte for byte** (FR-247). Enforced by the retargeted
`tests/unit/tuning-frozen.test.ts`.

## 4. Camera framing (render-only, derived each frame)

A pure function of `(RunState, Course)`, recomputed every frame and never stored.

| Quantity   | Definition                                                                          | Range                  |
| ---------- | ----------------------------------------------------------------------------------- | ---------------------- |
| `drop`     | Piste height fall from the skier's x to 213 units ahead                             | ≥ 0 on a legal course  |
| `look`     | `clamp(drop − 72 + 4, 0, 92)`, then `min(look, shelfCap)` on the piste near a shelf | 0 – 92                 |
| `shelfCap` | `108 − shelf.height − 8`, eased in over the 120 units before the shelf              | 45 – 50 on this course |
| `shift`    | `max(cameraAirLift(heightAbovePiste), look)`                                        | 0 – 92                 |
| `camera.y` | `state.y − 108 + shift`                                                             | —                      |

Constants, with where each comes from. The three **new** ones live in a new data file,
`data/camera.json`, not in code (research R10, Principle III). The rest are existing
frame geometry:

| Name               | Value | Source                                                                             |
| ------------------ | ----: | ---------------------------------------------------------------------------------- |
| `PLAYER_LOOKAHEAD` |   213 | existing, `src/render/stage.ts`                                                    |
| frame below skier  |    72 | `0.4 × INTERNAL_HEIGHT`, existing geometry                                         |
| `lookMargin`       |     4 | `data/camera.json`: whole box inside the frame, not just its top pixel             |
| `AIR_LIFT_MAX`     |    92 | existing, `src/render/rampGeometry.ts`: the headroom ceiling                       |
| `shelfMargin`      |     8 | `data/camera.json`: shelf top edge kept this far inside the frame                  |
| `shelfEaseIn`      |   120 | `data/camera.json`: distance over which the shelf cap blends in, so it never snaps |

`data/camera.json` is parsed by a new `parseCamera` in `src/data/load.ts`. It rejects
a missing key, a non-number and a negative value, like its neighbours
`parseAudio`/`parseSprites`. It is carried on `GameData` and passed to `cameraFor`.
Only the renderer reads it, so it cannot change a score or a run. Changing a value
still changes feel, so Principle VIII's play-pass obligation applies to it.

## 5. Measured quantities (test-only)

Computed by `tests/sim/reaction-budget.test.ts` and never shipped:

| Quantity                     | Definition                                                         | Requirement                   |
| ---------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| time to decide               | `(arrives − seen − climb) / 60`, per box, on the low-line ride     | ≥ 680 ms (FR-246)             |
| `climb`                      | smaller root of `impulseMax·t − g·t²/2 = standHeight`, from tuning | 5.12 ticks today              |
| rope, rock and ice lead time | `arrives − seen`, per hazard                                       | ≥ shipped value (FR-252)      |
| kicker lip speed             | tucked high-line pilot's speed crossing each lip                   | within 2% of shipped (FR-250) |
| landed-before-next           | rider grounded when the next box is seen                           | true (FR-251)                 |

The "shipped" reference values are committed as a small table inside that test, taken
from rules `2.0.0`. They are not recomputed from git history at test time, so the test
compares against a fixed baseline rather than against whatever was last committed.
