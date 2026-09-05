# Phase 1 Data Model: The Skier Becomes a Drawn Character

Four entities. Two are data files, one is render-owned state, one is a vocabulary.
None of them is simulation state — that is the whole point, and it is asserted rather
than assumed (FR-164).

---

## 1. Sprite manifest — `data/sprites.json`

The generic half. Every future sprite is an entry in this file (research R3).

### Shape

```
SpriteManifest
└── sheets: SpriteSheet[]            non-empty

SpriteSheet
├── id:         string               unique across the manifest
├── file:       string               BARE FILENAME, must end .png, must not contain '/'
├── cellWidth:  integer > 0
├── cellHeight: integer > 0
├── columns:    integer > 0          cells per row in the source image
├── anchorX:    integer              draw-origin offset within a cell, in cell pixels
├── anchorY:    integer              "
└── poses:      Record<string, PoseEntry>   non-empty

PoseEntry
├── cells:      integer[]            non-empty; 0-based indices, row-major
└── holdTicks?: integer > 0          per-cell dwell, simulation ticks. Omitted = static.
```

### Validation rules

These are enforced by `parseSprites()` in `src/data/load.ts` and throw rather than
degrade, matching `parseAudio()`'s stance that a bad manifest is a build-time defect.

| Rule                                                     | Message shape                                                                                                      | Why                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `sheets` is a non-empty array                            | `sprites.json: "sheets" must be a non-empty array`                                                                 | An empty manifest is a mistake, not a configuration                                                                             |
| `id` unique                                              | `sprites.json: duplicate sheet id "x"`                                                                             | Lookup is by id                                                                                                                 |
| `file` ends `.png`                                       | `sprites.json: sheet x: "file" must be a filename ending .png`                                                     | R2 requires PNG                                                                                                                 |
| **`file` contains no `/`**                               | `... must be a bare filename, not a path — the base path is applied at load so it stays one decision in one place` | **FR-173.** Copied verbatim in spirit from the audio rule, which exists because a path here works in dev and 404s in production |
| `cellWidth`/`cellHeight`/`columns` are positive integers | `... must be a positive integer`                                                                                   | Cell geometry is exact; a fractional cell means a resampled blit                                                                |
| `anchorX`/`anchorY` are integers within the cell         | `... must be an integer within the cell`                                                                           | A fractional anchor puts the sprite on a half-pixel, breaking LW-1                                                              |
| `poses` non-empty; every `cells` non-empty               | `sheet x: pose "y" must list at least one cell`                                                                    | A pose with no cell is undrawable                                                                                               |
| Every cell index ≥ 0                                     | `sheet x: pose "y" cell index must be >= 0`                                                                        | —                                                                                                                               |
| `holdTicks`, if present, is a positive integer           | `... "holdTicks" must be a positive integer`                                                                       | Tick-based, never millisecond-based (R7)                                                                                        |
| **Required poses present for `skier`**                   | `sprites.json: sheet "skier" is missing required pose "z"`                                                         | FR-165 names the minimum set; the manifest is where it is checkable                                                             |

The cell-index upper bound cannot be validated here — the manifest does not know the
image's height. It is checked at load, once the image's real dimensions are known,
and a pose referencing a cell past the end of the sheet is a load failure that trips
the R4 fallback rather than drawing garbage.

### Skier entry — required poses (FR-165, FR-183)

Grounded poses carry a lean suffix; airborne ones do not, because nothing off the
ground is aligned to a surface.

| Pose key                                    | Meaning                                | Lean variants |
| ------------------------------------------- | -------------------------------------- | ------------- |
| `carveShallow`, `carveMid`, `carveSteep`    | Riding, no crouch                      | 3             |
| `crouchShallow`, `crouchMid`, `crouchSteep` | Folded, charging                       | 3             |
| `launch`                                    | The extension as he leaves the surface | 1             |
| `air`                                       | Airborne, no spin turning              | 1             |
| `tuck`                                      | Airborne, past the apex                | 1             |
| `spin`                                      | A spin is turning                      | 1             |
| `absorbShallow`, `absorbMid`, `absorbSteep` | Compressed on touchdown                | 3             |
| `wipeout`                                   | The run has ended                      | 1             |

Fourteen pose keys over the sheet's ~20 authored cells. `crouch*` may declare several
cells with `holdTicks` if the fold is drawn as a sequence; the pose selector does not
know or care.

---

## 2. Lean bucket — derived, not stored

Not a persisted entity; a classification computed per frame from the slope the skier
is standing on.

**Domain** (research R1, measured across both shipped courses):

| Bucket    | Angle range         | Centre |
| --------- | ------------------- | ------ |
| `shallow` | 11.66° ≤ θ < 18.36° | 15.0°  |
| `mid`     | 18.36° ≤ θ < 25.06° | 21.7°  |
| `steep`   | 25.06° ≤ θ ≤ 31.76° | 28.4°  |

**Angles outside the measured band clamp to the nearest bucket.** The band is a
measurement of today's courses, not a law about all future ones; a new course with a
35° pitch must render, not throw. Clamping is the honest behaviour and it degrades
gracefully — the steep pose on a 35° slope is 6.6° off, visibly imperfect, still a
skier on a mountain.

**Transitions carry hysteresis** (FR-184, research R8). The boundary an angle must
cross to _enter_ a bucket sits inside the boundary at which it _leaves_, so a slope
sitting on a vertex cannot alternate. The hysteresis band is a render constant; the
current bucket is the remembered value that makes the rule directional.

**Input note**: `slopeAt()` returns a unit vector whose `uy` is the sine of the slope
angle, so bucketing compares against pre-computed sines of the boundaries and needs
no trigonometry at draw time. This is render code, so the simulation's ban on
`asin`/`atan2` does not bind it — but there is no reason to spend the call.

---

## 3. Absorb timer — render-owned state

Modelled on `LandingEffect` (research R7). Lives in the render layer, advanced from
the simulation tick, never persisted, never read by the simulation.

```
AbsorbTimer
├── ticks: integer          counts down; 0 = not absorbing
└── (constant) DURATION     simulation ticks
```

**State transitions:**

| From      | Trigger                                            | To                             | Note                                                                                            |
| --------- | -------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| idle      | `grounded` false → true, and the run has not ended | absorbing (`ticks = DURATION`) | Touchdown derived by the view from two consecutive states — no `RunState` field added           |
| absorbing | each simulation tick                               | `ticks -= 1`, idle at 0        | Tick-driven, so identical at 60 Hz and 120 Hz                                                   |
| absorbing | `grounded` true → false                            | **idle immediately**           | FR-168's abandonment. Covers ramp-relaunch: an absorb must never outlive the state it describes |
| any       | run starts                                         | idle                           | Reset with the rest of the render state                                                         |

**Not triggered on a wipeout landing.** A touchdown that ends the run resolves to
`wipeout`, which outranks absorb in the pose table (FR-167) — the character must not
be drawn as a clean landing in the frame the run ends.

---

## 4. Pose vocabulary — `PoseKey`

A closed string-union type in `src/render/skierPose.ts`, exactly the fourteen keys
tabled above. Closed rather than `string` so that a manifest pose the code never
selects, or a pose the code selects that the manifest lacks, is caught by the
required-pose validation rather than by a blank frame.

**The mapping from state to key is a contract in its own right** and is specified as
a precedence-ordered table in [`contracts/pose-selection.md`](./contracts/pose-selection.md),
where it can be read directly as the unit-test table (research R6).

---

## What is deliberately absent

- **No new `RunState` field.** FR-164. Everything above is either a data file, a
  derived classification, or render-owned state. The state hash is untouched, so the
  three-engine determinism gate compares the same bytes it compared before.
- **No entry in `data/tuning.json`.** Absorb duration and the hysteresis band are
  render constants, not feel parameters. See plan.md's Constitution Check for why
  putting them in the tuning file would be actively misleading.
- **No per-cell pivot, no non-uniform atlas, no nine-slice.** All plausible for a
  future sprite; none needed now. `contracts/sprite-manifest.md` records which
  additions are backward-compatible so the second sprite does not have to break this
  schema to get them.
