# Implementation Plan: The Skier Becomes a Drawn Character

**Branch**: `004-skier-sprite-animation` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-skier-sprite-animation/spec.md`

## Summary

Replace the six primitives that currently stand in for the player with a drawn
character blitted from a sprite sheet, and build the **sprite system** that does it
as a general facility rather than a skier-specific one — the maintainer has stated
that more sprites are coming, and the cost of generalising is a manifest file and one
loader module, paid once.

The technical shape follows from the two clarifications:

- **Q2 (pose-carried alignment)** means the run loop never calls `ctx.rotate` for a
  grounded skier. Alignment is chosen, not computed, so drawing the character is a
  `drawImage` at integer coordinates and the 320×180 pixel grid survives intact.
  Measurement (research R1) shows both courses live inside a 20.1° slope band, which
  **three** hand-drawn lean variants cover to within ±3.35° — under one pixel of ski
  discrepancy, and half that once the sprite is anchored at the ski centre.
- **Q1 (a ninth colour)** is enforced by shipping the sheet as an **8-bit indexed
  PNG** and validating its `PLTE` chunk. Indexed colour turns "no tenth colour
  anywhere in the image" from a pixel walk into reading a 27-byte table, needs no new
  dependency, and makes the guarantee structural: a non-conforming colour cannot be
  encoded in the file at all.

Everything else is arranged so the simulation is not touched: pose selection is a
pure function of existing state plus render-owned timing, tested without a canvas.

## Technical Context

**Language/Version**: TypeScript 5.6, ES modules, `strict` (existing repo settings)

**Primary Dependencies**: none added. Vite 5.4 build, Canvas 2D rendering (no engine,
per the constitution's platform baseline). `pixi.js` is declared in `package.json` but
imported nowhere in `src/` or `tests/` — this feature does not adopt it and does not
remove it; see "Observations outside scope".

**Storage**: N/A. Nothing this feature adds is persisted. Sprite art is a static
asset; the manifest is a bundled data file.

**Testing**: Vitest for unit and simulation suites; Playwright for e2e, with
`playwright.build.config.ts` driving the **built** artifact at the production base
path `/ski-game/`.

**Target Platform**: Evergreen mobile web — Safari iOS 16+, Chromium/Firefox Android
10+, same engines on desktop.

**Project Type**: Single-project browser game. Fixed 320×180 internal buffer,
integer-scaled with `imageSmoothingEnabled = false` (`src/render/stage.ts`).

**Performance Goals**: unchanged budgets — 16.7 ms frame time at p95, ≥ 50 fps
through a run, simulation step ≤ 2.0 ms/tick. Blitting one sprite per frame replaces
six fills and a path; this is expected to be neutral-to-favourable, and is asserted
as "no worse", not as an improvement.

**Constraints**: initial payload ≤ 2 MB gzipped, TTI ≤ 5 s on Fast 3G cold. The sheet
is the first raster asset in the run renderer and must be budgeted explicitly
(FR-176). Indexed PNG is chosen partly for this.

**Scale/Scope**: one sheet, ~20 authored cells, six pose families, three lean
variants for grounded poses. Three new source modules, four modified, one new data
file, one new tool, five new or amended test files.

## Constitution Check

_GATE: evaluated before Phase 0, re-evaluated after Phase 1._

| Principle                                    | Gate                                                                                                       | Status                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| I — Spec-Driven Delivery                     | Approved spec exists; every task traces to a numbered requirement                                          | **PASS** — spec.md carries FR-159..FR-185, SC-053..SC-062, both clarifications resolved                                              |
| II — Stability Before Content                | No simulation change; determinism preserved; no frame-budget regression                                    | **PASS by construction** — see "Determinism argument" below                                                                          |
| III — Fun Is a Testable Requirement          | No tuning value moves; feel values stay in data; human playtest recorded                                   | **PASS** — FR-161 forbids touching `standHeight`/`crouchHeight`; absorb duration is a render constant, see note                      |
| IV — One Coherent 1980s Voice                | Style bible is authoritative; assets cite their rule                                                       | **PASS WITH AMENDMENT** — the palette goes from eight tokens to nine, deliberately, with ADR-0010. Approving the spec approved this. |
| V — Fair and Verifiable Competition          | Scores reproducible; no cross-version invalidation                                                         | **PASS** — rendering-only change, no `rulesVersion` bump, no leaderboard partition                                                   |
| VI — Shipped Artifact Is the Unit of Truth   | Verified against the built artifact at the production base path; every failure state deliberately produced | **PASS WITH NEW GATE** — a new build-config spec covers both sheet-loads and sheet-blocked                                           |
| VII — Operator Instructions Are Deliverables | Any instruction a human runs is executed in CI                                                             | **PASS** — the asset-preparation step is a checked-in tool run by a test, not prose in a README                                      |

### Determinism argument (Principle II / V)

The strongest available guarantee, and it is structural rather than testimonial:
`RunState` gains no field, so the state hash cannot change, so the three-engine
determinism gate (`npm run test:determinism`) compares the same bytes it compared
before. Pose selection is a **pure read** — it takes a `RunState` and a render-owned
counter and returns a string; it is typed to take a `Readonly<RunState>` so a write
is a compile error rather than a review catch.

The absorb sequence is the one piece of new _timing_, and it is advanced from the
simulation tick like `LandingEffect` and `DeathSequence` already are, never from
`requestAnimationFrame`. That is what makes it identical on a 60 Hz phone and a
120 Hz desktop, and it is why the absorb duration is a render-layer constant rather
than an entry in `data/tuning.json`: it is not a feel parameter the simulation reads,
and putting it in the tuning file would imply it could change the game.

### Style-bible amendment (Principle IV)

This feature edits `assets/style-bible.md` section 1 — the only palette change since
ratification. Three things ship together or none do (FR-180):

1. Section 1's table gains one row, and a new rule assigns the token its role and
   forbids it everywhere else (FR-181).
2. `docs/adr/0010-a-ninth-colour.md` records why "eight colours" stopped being true.
3. `tests/unit/palette.test.ts` — which currently asserts the token set
   **exhaustively** — is updated to nine and gains the CVD separation check against
   `orange` (FR-182). It is tightened, never loosened.

### Stated gaps (Principle VI requires these be named, not implied)

- **`npm run lint` is already failing on `main`, and this blocks the feature's first
  step.** Found while planning, verified as pre-existing: with dependencies installed
  from the committed lockfile, `prettier --check .` reports **167 files** with style
  issues, including files this feature never touches (`vite.config.ts`,
  `src/render/palette.ts`, most of `tests/unit/`). The cause is a version drift —
  `package.json` asks for `prettier: ^3.3.3`, `package-lock.json` resolves **3.9.6**,
  and the 3.9 line changed default formatting. CI installs with `npm ci`, so the CI
  lint job gets 3.9.6 too.

  This matters here for two reasons and is not merely noted in passing. First,
  `quickstart.md` step 1 is `npm run lint`, so implementation hits it immediately.
  Second, **Definition of Done item 8 requires CI green on the head commit, checked
  rather than assumed** — and this feature cannot satisfy that on its own, because the
  red is not its doing. The fix is a one-line decision someone must take (pin
  `3.3.x`, or run `prettier --write .` once and commit the reformat) and it is a
  separate change, not this one. What must not happen is this feature quietly
  reformatting 167 unrelated files inside a sprite change, or its author reporting CI
  green because the failure predates them.

  The new documents in `specs/004-skier-sprite-animation/` were formatted with the
  lockfile's 3.9.6, so they are consistent with whichever way that decision goes only
  if it goes toward 3.9.6. If it goes toward pinning 3.3.x, they will need
  re-formatting along with everything else.

- **SC-057 has no gate.** `package.json` declares `test:perf` →
  `tests/e2e/performance.spec.ts`, and **that file does not exist**. This is
  constitution open deviation 3 (no performance budget job), which this feature does
  not close. Frame-budget non-regression will be established by hand and the method
  named in the change description; it is not machine-enforced, and must not be
  described as though it were.
- **The build smoke job runs Chromium only.** The new sprite specs inherit that
  limit. Sheet loading is exercised on one engine; the three-engine determinism job
  covers the simulation, which this feature does not touch.
- **The constitution's platform baseline says "rendering runs on a thin WebGL
  layer".** The renderer is Canvas 2D and has been since feature 001. This feature
  adds a `drawImage` call to that existing renderer; it neither creates nor worsens
  the discrepancy, and is noted here rather than silently inherited.

### Post-design re-check (after Phase 1)

Re-evaluated against the artifacts now that they exist. **No gate changed status**,
and the design tightened three of them:

- **Principle II** got stronger, not weaker. `selectPose` taking `Readonly<RunState>`
  (research R6) turns "rendering must not mutate simulation state" into a compile
  error. FR-169's prohibition on continuous rotation while skiing means the grounded
  draw path is a single `drawImage` with no `ctx.rotate` and no scale — which is also
  what makes FR-178's nearest-neighbour guarantee reachable rather than aspirational,
  since `stage.ts` already holds `imageSmoothingEnabled = false`.
- **Principle IV**'s amendment is narrower than first drafted. Choosing indexed PNG
  (research R2) means the nine-colour rule is enforced structurally — a tenth colour
  is unrepresentable in the file, not merely absent from it. The palette test is
  tightened to nine and gains a CVD assertion; it is never loosened.
- **Principle VI** gained a real gate where the spec only had a requirement:
  `tests/e2e-build/sprite-*.spec.ts` blocks the sheet request and plays a full
  run through the fallback, so SC-056 is produced deliberately rather than assumed.

Two things the re-check confirms are **not** resolved, and must not be reported as
though they were: SC-057's frame budget still has no CI gate (deviation 3), and the
build smoke job is still Chromium-only (deviation 1). Both are stated above.

FR-175 and SC-054 — the player staying distinguishable from hazards in silhouette,
not merely in hue — are the two requirements this design cannot fully automate. The
CVD assertion covers colour; silhouette is a human judgement, and it is a checklist
item in `quickstart.md` step 6 rather than a test pretending to be one.

## Project Structure

### Documentation (this feature)

```text
specs/004-skier-sprite-animation/
├── plan.md              # This file
├── research.md          # Phase 0 — R1..R8
├── data-model.md        # Phase 1 — manifest schema, pose vocabulary, state machine
├── quickstart.md        # Phase 1 — how to verify this end to end
├── contracts/
│   ├── sprite-manifest.md   # The data contract other sprites will also satisfy
│   └── pose-selection.md    # State → pose, as a table that can be read as tests
├── checklists/
│   └── requirements.md  # Spec quality checklist (16/16)
└── tasks.md             # NOT created by /speckit-plan
```

### Source Code (repository root)

```text
data/
└── sprites.json                     # NEW  Sprite manifest. Bundled import, validated at assembly.

public/sprites/
└── skier.png                        # NEW  Shipped sheet. 8-bit indexed PNG, nine-colour PLTE.

assets/sprites/
├── README.md                        # NEW  Provenance record (FR-170), mirroring assets/audio/README.md
└── skier.source.*                   # NEW  Retained editable source (FR-171)

src/render/
├── sprites.ts                       # NEW  Generic sheet loader + integer blitter. Not skier-specific.
├── skierPose.ts                     # NEW  Pure (RunState, absorb timer) -> pose. No canvas import.
├── draw.ts                          # MOD  drawSkier() blits a cell; keeps the primitive fallback
└── palette.ts                       # MOD  Ninth token; PALETTE stays exhaustive

src/data/
└── load.ts                          # MOD  parseSprites(); GameData gains `sprites`

src/
└── main.ts                          # MOD  Imports data/sprites.json; starts the sheet load

tools/
└── check-sprite-palette.ts          # NEW  Reads PNG PLTE chunks. Zero dependencies.

tests/unit/
├── sprite-manifest.test.ts          # NEW  Manifest validation, incl. the bare-filename rule
├── skier-pose.test.ts               # NEW  Pose table, boundary hysteresis, reduced motion
├── sprite-palette.test.ts           # NEW  Every PNG under public/sprites/ has a conforming PLTE
└── palette.test.ts                  # MOD  Nine tokens; skin-vs-orange under three CVD types

tests/e2e-build/
├── sprite-base-path.spec.ts         # NEW  Sheet resolves at /ski-game/, not just at /
└── sprite-never-blocks.spec.ts      # NEW  Sheet blocked -> run still completes and commits

assets/style-bible.md                # MOD  Section 1 table + the new token's role rule
docs/adr/0010-a-ninth-colour.md      # NEW  Why eight became nine
```

**Structure Decision**: the existing layout is kept exactly — simulation in `src/sim`,
rendering in `src/render`, data parsing in `src/data`, versioned content in `data/`,
runtime binary assets in `public/`, retained sources in `assets/`. The one structural
addition is the split of `src/render/sprites.ts` (generic, reusable, knows about
sheets and cells) from `src/render/skierPose.ts` (specific, knows about the skier and
nothing about drawing). That seam is what makes the next sprite a manifest entry
rather than a second copy of this work, and it is the direct answer to "we will
likely create other sprites".

## Complexity Tracking

| Violation                                       | Why Needed                                                                                                     | Simpler Alternative Rejected Because                                                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A ninth palette token                           | The supplied art carries a skin tone; the maintainer chose to admit it (Q1) rather than quantise the face away | Quantising to eight was offered and declined. It is genuinely simpler and stays available if the ADR is ever reversed.                                          |
| A sprite **system** rather than a skier blitter | Explicitly requested: more sprites are coming. The generic half is ~90 lines and one data file                 | A skier-specific blitter is smaller today and becomes two divergent copies at the second sprite — the failure mode the repo has already paid for once elsewhere |
| Three lean variants of each grounded pose       | FR-183 requires the whole 20.1° slope band drawn, and FR-185 forbids generating them by rotation               | One variant leaves ±10° of error — ~2.8 px of ski floating off the snow, which is the artefact the feature exists to remove                                     |

## Observations outside scope

Noted because they were found while planning, not proposed as work here:

- **`pixi.js` is an unused dependency.** Declared in `package.json`, imported nowhere
  in `src/` or `tests/`. It is not on the critical path of this feature; removing it
  would shrink the payload FR-176 constrains, but that is a separate change.
- **`npm run test:perf` points at a file that does not exist.** A script that cannot
  run is worse than no script, because it reads like a gate. Called out above under
  stated gaps.
