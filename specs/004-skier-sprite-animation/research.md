# Phase 0 Research: The Skier Becomes a Drawn Character

Eight questions had to be answered before the design could be written. Two were
measurements, four were technique choices, two were about not breaking things that
already work.

---

## R1 — How many lean poses does the slope actually need?

**This is the measurement FR-183 was deliberately left open for.** The spec refused
to guess it; here it is, read off the shipped course data.

Both courses' terrain profiles were sampled segment by segment
(`atan2(dy, dx)` per segment, both files under `data/courses/`):

| Course     | Segments | Min        | p25    | Median | p75    | Max        | Span       |
| ---------- | -------- | ---------- | ------ | ------ | ------ | ---------- | ---------- |
| `warmup`   | 17       | 15.31°     | 17.49° | 21.27° | 23.82° | 26.96°     | 11.65°     |
| `official` | 61       | 11.66°     | 18.04° | 23.00° | 26.52° | 31.76°     | 20.10°     |
| **Union**  | 78       | **11.66°** | —      | —      | —      | **31.76°** | **20.10°** |

Three facts fall out, and all three shape the design:

1. **The band is narrow.** 20.1°, not 90°. A general-purpose rotation solution was
   never needed for the common case.
2. **It is entirely downhill.** No segment is flat or uphill. There is no 0° pose to
   draw and no mirrored uphill case.
3. **Ledges add nothing.** `Ledge` is the terrain profile translated up by a constant
   (`src/sim/types.ts`), so the upper track's slope at any x is _identical_ to the
   piste's. Riding the shelf presents no angle not already in the table.

**Decision: three lean variants**, bucketing the 11.66°–31.76° band into thirds
centred near 15°, 21.7° and 28.4°.

**Rationale** — worst-case angular error is half a bucket, ±3.35°. Converted to the
thing a player can actually see, the ski failing to lie flat on the snow across its
16 px length:

| Variants | Max error  | Ski-tip discrepancy | Anchored at ski centre |
| -------- | ---------- | ------------------- | ---------------------- |
| 1        | ±10.05°    | 2.79 px             | ±1.40 px               |
| 2        | ±5.03°     | 1.40 px             | ±0.70 px               |
| **3**    | **±3.35°** | **0.93 px**         | **±0.47 px**           |
| 4        | ±2.51°     | 0.70 px             | ±0.35 px               |

Three is where the error crosses below one pixel — below the smallest thing the
320×180 buffer can express, which is the only threshold that means anything here.
Four buys 0.23 px and costs another variant of every grounded pose.

**Anchoring at the ski centre rather than the tail is part of the decision**, not a
detail: it splits the discrepancy between both ends, halving the largest visible gap
for free.

**Alternatives considered**: snapping a rotated blit to N discrete angles was
rejected by Q2 and by FR-185 — rotation at any angle other than a multiple of 90°
resamples the grid and breaks LW-1's one-device-pixel linework, which is the artefact
this whole treatment exists to avoid.

---

## R2 — How is "nine colours, no exceptions" actually enforced?

FR-162 says every pixel is one of nine colours or transparent; SC-059 says this is
verified automatically, with zero exceptions, and fails on a tenth.

**Decision: ship the sheet as an 8-bit indexed-colour PNG and validate its `PLTE`
chunk.**

**Rationale** — indexed PNG stores the image as indices into an embedded palette
table. A tenth colour is then not merely absent from the pixels, it is
_unrepresentable in the file_. The check becomes: parse the PNG chunk sequence, read
`PLTE` (a flat `RGBRGB…` table, ≤ 256 entries), assert every entry is one of the nine
declared tokens, and assert `tRNS` marks only fully transparent or fully opaque
entries. That is a ~40-line reader over `IHDR`/`PLTE`/`tRNS` headers, and it needs
**no new dependency**: no zlib inflate, no scanline unfiltering, no pixel walk,
because the pixel data is indices and the indices cannot point outside the table.

Three secondary benefits, none of them the reason but all of them real: indexed
colour is materially smaller than RGBA, which helps FR-176's payload ceiling; the
check runs in milliseconds in the existing Vitest suite with no image decoding; and
the same check generalises to every future sprite for free (R3).

**The check must also assert `IHDR` colour-type 3 and bit-depth ≤ 8.** Without that,
someone re-exports as RGBA one day, the file has no `PLTE` at all, and a check
looking for a chunk that is not there could be written to pass vacuously. It fails
loudly instead.

**Alternatives considered**: decoding RGBA pixels and walking them needs `zlib`
inflate plus the five PNG unfilter modes — perfectly doable in Node's stdlib, roughly
150 lines of fiddly code, and it verifies a _weaker_ property (this file happens to
contain nine colours) than indexed colour does (this file cannot contain a tenth).
Adding `pngjs` was rejected for the same reason plus a dependency.

---

## R3 — What makes this a sprite system rather than a skier blitter?

The maintainer's instruction: _"keeping in mind that we will likely create other
sprites."_ This is the research item that answers it.

**Decision: two modules with a hard seam, plus one manifest file.**

- `src/render/sprites.ts` — **generic**. Knows sheets, cells, loading, failure, and
  integer blitting. Knows nothing about skiers, poses, or run state. This is the part
  the next sprite reuses unchanged.
- `src/render/skierPose.ts` — **specific**. Knows the skier's states and which pose
  each implies. Imports no canvas and no DOM; it is a function from data to a string.
- `data/sprites.json` — the manifest. A new sprite is an entry here plus a PNG, with
  no new code.

**Rationale** — the repository has already paid for the alternative once. The
constitution's open deviations record a defect class where the same concern was
solved twice in two places and the copies diverged. A second sprite added by
copy-editing `drawSkier` is that failure with a new name.

**Three rules the manifest inherits from `data/audio.json`, deliberately:**

1. **`file` is a bare filename, never a path.** `src/data/load.ts` already enforces
   this for music tracks, with a comment explaining exactly why: a manifest carrying
   `/sprites/x.png` works in dev and 404s under the production base path. The base is
   applied at load in one place. Sprites get the identical rule and the identical
   error message shape.
2. **A bad manifest is a build-time defect, not a runtime fallback.** Parsing throws.
3. **`$comment` fields carry the reasoning next to the data**, as every other file in
   `data/` does.

**What the manifest does NOT do**: it does not describe animation for anything other
than sheets of uniform cells. Non-uniform atlases, nine-slice, and per-cell pivots
are all things a future sprite might want and none of them are needed now. They are
addable without breaking this schema — see `contracts/sprite-manifest.md` for which
fields are optional and why.

---

## R4 — What happens when the sheet does not load?

FR-172, User Story 3, SC-056. This is the failure class that reached players in this
project's first deployment week — an asset resolved against the wrong base path,
failing silently.

**Decision: keep the existing primitive skier as the fallback renderer. Do not delete
it.**

`drawSkier` becomes a two-branch function: sheet ready → blit the pose; sheet not
ready (still loading, 404, decode error, or no manifest entry) → draw exactly what it
draws today. The fallback is not a degraded placeholder written for the occasion; it
is the renderer that has shipped every run so far, so it is known to be playable,
known to satisfy LW-3, and known to be magenta and hazard-distinguishable.

**Rationale** — a fallback that has never been played is a second untested code path,
and Principle VI is explicit that a failure path never executed is untested however
carefully written. Keeping the incumbent means the fallback's quality is a fact
rather than a hope. The build-config spec then blocks the sheet request and plays a
full run through it (SC-056), which is what turns "there is a fallback" into "the
fallback works".

**A consequence worth stating**: the scarf. The sheet draws it, so the sine-driven
polygon is removed from the sprite path — but it stays in the fallback path, because
the fallback is the old renderer entire. The two paths are allowed to differ; what
they may not do is disagree about whether the player is visible.

---

## R5 — What is the skin token's value?

FR-179: derived from the supplied sheet's own skin tone, not invented.

**Decision: sampled during implementation, from the committed source, then checked —
not chosen here.**

This is the one value this plan deliberately does not fix, for a reason that matters:
the sheet is **not yet in the repository** (spec Dependencies). Picking a hex from a
screenshot and writing it into the palette would be inventing the value FR-179 says
must be derived, and it would be the kind of number that survives forever because
nobody knows where it came from.

**The procedure, which is testable:**

1. Commit the source and the shipped PNG.
2. Read the skin entry from the sheet's own `PLTE` — the art defines the colour.
3. Add it to `PALETTE` in `src/render/palette.ts` and to the style-bible table.
4. Assert it separates from `orange` under protanopia, deuteranopia and tritanopia at
   the threshold `tests/unit/palette.test.ts` already applies to the magenta/orange
   pair (FR-182).
5. **If step 4 fails, the art changes, not the threshold.** A skin tone that collapses
   into the hazard colour reintroduces exactly the confusion P-4 exists to prevent,
   and the palette test is the mechanism that has already caught this once — the
   style bible records `orange` being darkened from `#FF7A29` for precisely this
   reason.

Step 5 is the part to keep. It is the only step that can fail, and the temptation
when it does will be to relax the assertion.

---

## R6 — How is pose selection tested without a browser?

SC-060 requires reduced-motion pose coverage verified by automated test rather than
by eye, and the repo's unit suite is Node-side Vitest with no canvas.

**Decision: pose selection is a pure function in its own module, importing nothing
from the DOM.**

```
selectPose(state: Readonly<RunState>, absorb: AbsorbTimer, motion: MotionSettings) -> PoseKey
```

Every acceptance scenario in User Stories 1 and 4 becomes a table row: construct a
`RunState`, call the function, assert the pose. No canvas, no image, no timing, no
flake. The rendering half — does `PoseKey` map to a cell that exists in the manifest
— is a separate assertion over the manifest, which is also just data.

**Rationale** — this is the same split that let `LandingEffect` and `DeathSequence`
be unit-tested (`tests/unit/landing-effect.test.ts`, `death-sequence.test.ts`) while
the drawing around them was not. It is an established pattern here, not a new one.

`Readonly<RunState>` in the signature makes Principle II's "rendering MUST NOT mutate
simulation state" a compile error rather than a review comment.

---

## R7 — How is the absorb sequence timed?

FR-168: render-side, on the simulation tick, abandoned if the skier leaves the ground.

**Decision: an `AbsorbTimer` in `src/render/`, modelled directly on `LandingEffect`.**

`LandingEffect` already solves this exact problem and documents why: it is advanced
from the tick rather than the frame _"so the effect lasts the same wall-clock time on
a 60 Hz phone and a 120 Hz desktop"_, and it derives its trigger by comparing two
consecutive states rather than adding a field to `RunState` — with a comment noting
that a field added for presentation would put presentation inside the thing FR-026's
reproducibility is computed over. That is verbatim the constraint FR-164 imposes here.

Touchdown is likewise derived by the view from `grounded` transitioning false → true.
The timer is cancelled, not merely ignored, the moment `grounded` goes false again —
which is FR-168's "abandoned immediately if the skier leaves the ground", and covers
the ramp-relaunch edge case where an absorb would otherwise outlive its state.

**Duration is a render constant**, not a `data/tuning.json` entry, for the reason
given in plan.md's Constitution Check: it is not read by the simulation and is not a
feel parameter, and putting it in the tuning file would falsely imply it changes the
game.

---

## R8 — What stops the lean poses flickering?

FR-184: an angle sitting on a bucket boundary, or oscillating across it, must resolve
stably rather than alternating frame to frame.

**Decision: hysteresis on the bucket boundaries — a band the angle must cross fully
before the pose changes, not a threshold it can sit on.**

**Rationale** — the terrain is piecewise linear, so slope is a _step_ function of x,
not a smooth one: crossing a vertex changes the angle discontinuously. A player
riding a vertex whose two segments straddle a bucket boundary, or oscillating across
one, would alternate poses at tick rate. Plain rounding cannot fix this; a
switch-point that differs by direction of travel can, and costs one remembered value
in the render layer.

The remembered value is render-owned state, like the absorb timer, and is reset when
a run starts. It is an input to `selectPose` rather than a hidden global, which keeps
R6's pure-function property and makes the oscillation case a unit test rather than
something only a human at a vertex would ever see.

---

## Summary of decisions

| #   | Decision                                                                                                      | Governs                |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------------- |
| R1  | Three lean variants over the measured 11.66°–31.76° band; anchor at ski centre                                | FR-183, SC-062         |
| R2  | 8-bit indexed PNG; validate the `PLTE` chunk; assert colour-type 3                                            | FR-162, SC-059         |
| R3  | Generic `sprites.ts` + specific `skierPose.ts` + `data/sprites.json`; bare-filename rule inherited from audio | FR-159, FR-160, FR-173 |
| R4  | Keep the existing primitive skier as the fallback renderer                                                    | FR-172, SC-056         |
| R5  | Skin hex sampled from the committed art, then CVD-checked; art changes if the check fails                     | FR-179, FR-182         |
| R6  | Pose selection is a pure `Readonly<RunState>` function in its own module                                      | FR-164, SC-060         |
| R7  | `AbsorbTimer` modelled on `LandingEffect`; tick-driven; cancelled on leaving the ground                       | FR-168                 |
| R8  | Hysteresis on lean-bucket boundaries, with the switch point carried in render state                           | FR-184                 |

No `NEEDS CLARIFICATION` items remain. R5 records a value that is deliberately
deferred to implementation with a stated procedure, which is not the same thing as an
open question.
