# Contract: `data/sprites.json`

The data contract every sprite in this product satisfies — the skier first, and the
ones after it without further code. This file is the direct answer to _"keeping in
mind that we will likely create other sprites"_ (research R3).

Schema and validation rules: [`../data-model.md`](../data-model.md#1-sprite-manifest--datspritesjson).
This document covers the contract's **boundaries** — what callers may rely on, what
the file may not contain, and what a future sprite can add without breaking it.

---

## Example

```jsonc
{
  "$comment": "Sprite manifest. `file` is a bare filename: the base path is applied at load in src/render/sprites.ts, so it stays one decision in one place — a path here works in dev and 404s under the production base path. Sheets are 8-bit indexed PNG; tests/unit/sprite-palette.test.ts reads the PLTE chunk and fails on any colour outside the nine in assets/style-bible.md section 1.",
  "sheets": [
    {
      "id": "skier",
      "file": "skier.png",
      "cellWidth": 32,
      "cellHeight": 32,
      "columns": 8,
      "anchorX": 16,
      "anchorY": 30,
      "$comment": "anchorY sits at the ski line, anchorX at the ski CENTRE rather than the tail — research R1: centring splits the lean-bucket discrepancy between both ski ends, halving the largest visible gap for free.",
      "poses": {
        "carveShallow": { "cells": [0] },
        "carveMid": { "cells": [1] },
        "carveSteep": { "cells": [2] },
        "crouchShallow": { "cells": [3] },
        "crouchMid": { "cells": [4] },
        "crouchSteep": { "cells": [5] },
        "launch": { "cells": [6] },
        "air": { "cells": [7] },
        "tuck": { "cells": [8, 9], "holdTicks": 6 },
        "spin": { "cells": [10] },
        "absorbShallow": { "cells": [11] },
        "absorbMid": { "cells": [12] },
        "absorbSteep": { "cells": [13] },
        "wipeout": { "cells": [14] },
      },
    },
  ],
}
```

Cell indices are illustrative. The real ones come from the re-cut sheet (FR-160) and
are not knowable until the art is committed.

---

## Guarantees to callers

1. **`file` is a bare filename.** Never a path, never a URL. The base path is applied
   in exactly one place — `src/render/sprites.ts` — and this is enforced by
   `parseSprites()`, not by convention. The rule is inherited verbatim in intent from
   `data/audio.json`, where `src/data/load.ts` already carries the comment explaining
   that a path here works in dev and 404s under the production base path.
2. **Cell geometry is exact and integral.** Cells are uniform within a sheet; every
   dimension and anchor is an integer. Nothing in the pipeline resamples, so LW-1's
   one-device-pixel linework survives the blit.
3. **The blit is nearest-neighbour, at integer destination coordinates, unrotated
   and unscaled.** `src/render/stage.ts` already sets `imageSmoothingEnabled = false`
   on the 320×180 buffer and scales it to the display by an integer factor only;
   `sprites.ts` rounds destination coordinates and never passes a scale. Together
   these satisfy FR-178 — a smoothed or fractionally placed pixel-art blit is a
   style-review rejection under LW-1. FR-169's prohibition on continuous rotation
   while skiing is what makes this reachable at all: a grounded skier is drawn with
   `drawImage` and no `ctx.rotate`, so there is no resampling step to get wrong.
4. **A bad manifest throws at assembly.** It is a build-time defect, not a runtime
   fallback — `parseAudio()`'s stance, applied identically.
5. **`holdTicks` is simulation ticks, never milliseconds.** Any cycling therefore
   lasts the same wall-clock time at 60 Hz and 120 Hz (research R7).
6. **Pose keys are stable identifiers.** Re-cutting a sheet changes cell indices
   only; the code selecting `carveMid` is untouched. This is the seam that lets art
   and logic move independently.

---

## Prohibited

| Not allowed                                                    | Because                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A path or URL in `file`                                        | FR-173. The whole defect class this repository has already paid for once |
| Non-integer cell dimensions or anchors                         | Puts the sprite on a half-pixel; resampling breaks LW-1                  |
| A colour outside the nine declared tokens, anywhere in the PNG | FR-162. Structurally prevented by indexed colour (research R2)           |
| `orange` as a dominant colour on a player sheet                | FR-163, P-4. A player must never read as a hazard                        |
| The skin token on anything but a player sprite                 | FR-181                                                                   |
| Millisecond-based timing                                       | Breaks refresh-rate independence                                         |
| Deriving a lean pose by rotating another cell                  | FR-185. It is the exact artefact Q2 chose pose-selection to avoid        |

---

## Extending this for the next sprite

Additive and backward-compatible — a future sprite may introduce these without
touching the skier's entry or `parseSprites()`'s existing rules:

| Addition                 | Shape                                      | For                                                                  |
| ------------------------ | ------------------------------------------ | -------------------------------------------------------------------- |
| Per-pose anchor override | `poses.x.anchorX/anchorY`                  | A sprite whose poses do not share one origin                         |
| Non-looping sequences    | `poses.x.loop: false`                      | A one-shot effect that holds its final cell                          |
| Per-cell dwell           | `holdTicks: number[]` alongside the scalar | Easing a sequence without duplicating cells                          |
| Tint-free variants       | a second sheet id                          | Simpler than a runtime tint, and keeps R2's palette guarantee intact |

**Breaking changes** — needing a schema version and a migration — would be:
non-uniform cell sizes within a sheet (an atlas with a rect per cell), nine-slice
regions, and multi-sheet poses. None is needed now; all are recorded so the second
sprite recognises them as decisions rather than accidents.

**What a new sprite costs today**: one PNG in `public/sprites/`, one entry here, one
provenance line in `assets/sprites/README.md`, and the retained source. No new code,
and it inherits the palette check, the bare-filename check and the base-path
resolution automatically.

---

## Verification

| Check                                                                       | Where                                                                   | Requirement    |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------- |
| Schema, uniqueness, bare filename, integer geometry                         | `tests/unit/sprite-manifest.test.ts`                                    | FR-160, FR-173 |
| Required skier poses all present                                            | same                                                                    | FR-165         |
| Every PNG under `public/sprites/` is colour-type 3 with a conforming `PLTE` | `tests/unit/sprite-palette.test.ts` via `tools/check-sprite-palette.ts` | FR-162, SC-059 |
| Skin token separates from `orange` under three CVD types                    | `tests/unit/palette.test.ts`                                            | FR-182         |
| Sheet resolves at the production base path                                  | `tests/e2e-build/sprite-*.spec.ts`                                      | FR-173         |
| Run completes with the sheet blocked                                        | same                                                                    | FR-172, SC-056 |
