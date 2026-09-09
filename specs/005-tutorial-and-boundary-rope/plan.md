# Implementation Plan: A Coached First Run, and a Rope You Can See

**Branch**: `claude/lucid-dijkstra-6caua6` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-tutorial-and-boundary-rope/spec.md`

## Summary

Two changes that ship together: a coached opening prepended to the warm-up course
that teaches the game's four verbs, and a re-skin of the `low` obstacle from an
overhanging bough to a pennanted ski boundary rope.

The technical shape is decided by three measurements, all of which contradicted an
approved requirement. They are set out in [research.md](./research.md); in short:

- **Slope does not slow the player** (R1). Speed is clamped to a floor of
  `baseSpeed` whatever the terrain does, so a gentler gradient moves the player
  across the x-axis ~9% **faster**. Reading time is bought by spacing, full stop.
- **The frame caps on-screen reading at 1.38 s, and 0.95 s for the flip cue** (R2),
  because lookahead is a fixed 213.3 world units and the player is tucked when he
  meets the big kicker. So a badge cannot be bound to its object's visibility; it is
  bound to the skier's x at a **389-unit lead** (2.5 s).
- **No legal clearance lets a passive player survive the rope** (R3). CV-3 requires
  `9 < clearance < 16` by construction. The rope is authored at **15**, the most
  forgiving legal value, and it is allowed to bite.

Everything else is arranged so the simulation is untouched. The rope is a drawing
change inside the collision slab the game already computes; the coached section is
course data emitted by the existing generator; the badges are a sibling of
`popTrickBadge` driven by world position rather than a timer. No tuning value moves,
no `rulesVersion` moves, and a draft holding committed scores keeps working.

## Technical Context

**Language/Version**: TypeScript 5.6, ES modules, `strict` (existing repo settings)

**Primary Dependencies**: none added. Vite 5.4 build, Canvas 2D rendering, no engine.

**Storage**: N/A. FR-186a explicitly forbids persisting anything about who has been
coached — no new column, no migration, no `localStorage` key. This is the clarified
answer to Q1 and it is the reason this feature touches no storage layer at all.

**Testing**: Vitest for unit, sim and course suites; Playwright for e2e, with
`playwright.build.config.ts` driving the built artifact at the production base path
`/ski-game/`.

**Target Platform**: Evergreen mobile web — Safari iOS 16+, Chromium/Firefox Android
10+, same engines on desktop.

**Project Type**: Single-project browser game. Fixed 320×180 internal buffer,
integer-scaled, `imageSmoothingEnabled = false`.

**Performance Goals**: unchanged budgets — 16.7 ms frame time at p95, ≥ 50 fps
through a run, simulation step ≤ 2.0 ms/tick. The rope replaces a bough of comparable
mark count; the coached section adds course data, not per-frame work. Asserted as "no
worse", not as an improvement.

**Constraints**: `data/tuning.json`, `data/scoring.json` and `data/courses/official.json`
are frozen by FR-196. The 320×180 buffer is frozen by `src/render/stage.ts`'s fairness
argument (SC-006). `branchThickness` = 18 is frozen, so the rope is designed to fit it.

**Scale/Scope**: one new source module (coaching cues), three modified (`draw.ts`,
`game.ts`, `main.ts`), one modified tool (`gen-courses.ts`), one regenerated data file
(`warmup.json`), one style-bible amendment, six documentation corrections, and roughly
seven new or amended test files.

## Constitution Check

_GATE: evaluated before Phase 0, re-evaluated after Phase 1._

| Principle                                    | Gate                                                                       | Status                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| I — Spec-Driven Delivery                     | Approved spec; every task traces to a numbered requirement                 | **PASS WITH AMENDMENTS** — three requirements are contradicted by measurement and must be restated; see below              |
| II — Stability Before Content                | No simulation change; determinism preserved; monkey suite still green      | **PASS by construction** — see "Determinism argument"                                                                      |
| III — Fun Is a Testable Requirement          | No tuning value moves; feel values stay in data                            | **PASS** — FR-196 forbids it and a test asserts `tuning.json` is byte-identical                                            |
| IV — One Coherent 1980s Voice                | Style bible is authoritative; assets cite their rule                       | **PASS WITH AMENDMENT** — TR-2 and TR-3 are rewritten for the rope (FR-205). No ninth colour (FR-202)                      |
| V — Fair and Verifiable Competition          | Scores reproducible; no cross-version invalidation                         | **PASS** — no `rulesVersion` bump, no leaderboard partition, replay-identical across the change (SC-067)                   |
| VI — Shipped Artifact Is the Unit of Truth   | Verified against the built artifact at the production base path            | **PASS WITH NEW GATE** — a build-config spec drives the coached section in a real browser at `/ski-game/`                  |
| VII — Operator Instructions Are Deliverables | Any instruction a human runs is executed in CI                             | **PASS** — the course regeneration is a checked-in tool run by a test, not prose; README corrections are covered by FR-212 |
| VIII — The Player Judges Fun, Early          | Course/tuning/control changes reach the player at the first playable point | **BINDING** — this changes `data/courses/warmup.json` and the control surface's presentation. See "Playtest obligation"    |

### Amendments this plan forces on the spec

Principle I requires the governing spec to be amended in the same change set rather
than worked around. Three requirements state mechanisms that measurement disproved:

| Requirement | Measured problem                                               | Restate as                                                            |
| ----------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| FR-187      | A gentler slope speeds horizontal progress up, not down (R1)   | Gentle gradient is for how it reads; reading time comes from FR-191   |
| FR-191      | "While its object is visible" caps the key cue at 0.95 s (R2)  | Badge keys off skier x at a fixed lead; keep the one-at-a-time clause |
| FR-192      | No legal clearance lets a passive player survive the rope (R3) | No dead ends + maximum forgiveness; the rope is allowed to bite       |

None changes what the feature is. Each swaps a mechanism that does not work for one
that does. **These amendments are a task, not an assumption** — the spec is edited
before the code that depends on them is written.

### Determinism argument

FR-204 and SC-067 require an identical replay across this change. It holds by
construction, not by testing:

- **The rope changes only `src/render/draw.ts`.** Collision lives in `step.ts:206`
  and reads `o.clearance` and `tuning.branchThickness`. Neither moves. The renderer
  has never been able to influence simulation state — `drawRun` takes state by value
  and returns nothing.
- **Coaching cues are render-owned.** They read `state.x` and never write. They are a
  pure function of position, in the same way `selectPose` is a pure function of state
  (feature 004), and are unit-tested without a canvas.
- **The coached section is new terrain, not a rule change.** The warm-up course's
  hash changes because its geometry changed; the official course's does not. The
  golden tests pinned against the warm-up course are re-baselined deliberately and
  the official-course goldens must not move — that asymmetry is itself an assertion.

### Playtest obligation (Principle VIII)

This edits `data/courses/warmup.json`, which the constitution names explicitly. The
play pass happens at the **first point the coached section runs**, not at feature
completion: as soon as the generator emits a validating course and the badges appear,
`npm run build:artifact` is published and the link and commit are named. R1 is the
argument for why this cannot wait — the feature's whole premise is a pacing claim,
and pacing is the one thing the validator and the robot pilots hold no opinion on.

## Project Structure

### Documentation (this feature)

```text
specs/005-tutorial-and-boundary-rope/
├── plan.md                      # This file
├── spec.md                      # Amended by this plan's first task
├── research.md                  # Phase 0 — the three measurements
├── data-model.md                # Phase 1 — coached section, cue, rope geometry
├── quickstart.md                # Phase 1 — how to run and verify all of it
├── contracts/
│   ├── coaching-cues.md         # Cue selection: inputs, outputs, invariants
│   └── boundary-rope.md         # The drawn object and its collision contract
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks output — NOT created here
```

### Source Code (repository root)

```text
data/
├── courses/warmup.json          # REGENERATED — coached section prepended
└── tuning.json                  # UNCHANGED, asserted by test

tools/
└── gen-courses.ts               # MODIFIED — authors the coached section

src/
├── render/
│   ├── draw.ts                  # MODIFIED — drawBough -> drawBoundaryRope
│   └── coachingCue.ts           # NEW — pure cue selection from skier x
└── ui/
    ├── coachingBadge.ts         # NEW — sibling of trickBadge.ts
    ├── game.ts                  # MODIFIED — drives cue changes off the tick
    ├── main.ts                  # MODIFIED — mounts the cue slot for practice
    └── style.css                # MODIFIED — the cue's own slot in .badges

tests/
├── course/validate.test.ts      # AMENDED — coached section validates clean
├── sim/golden.test.ts           # AMENDED — warm-up re-baselined, official pinned
├── unit/coaching-cue.test.ts    # NEW — cue selection, lead distances, ordering
├── unit/coaching-badge.test.ts  # NEW — one at a time, reduced motion, copy
├── unit/rope-geometry.test.ts   # NEW — lowest mark == collision floor
├── unit/tuning-frozen.test.ts   # NEW — tuning.json and official.json unmoved
└── e2e-build/coached-run.spec.ts # NEW — the built artifact, real browser

assets/style-bible.md            # MODIFIED — TR-2, TR-3 rewritten (FR-205)
docs/adr/                        # MODIFIED — ADR-0002 corrected, 0010 renumbered
README.md                        # MODIFIED — status and principle count (FR-212)
package.json                     # MODIFIED — test:perf removed (FR-213)
```

**Structure Decision**: The existing single-project layout is kept unchanged. Two new
modules are added on the seam the project already uses for render-owned, non-
simulation state — `src/render/` for the pure selection function, `src/ui/` for the
DOM that presents it — which is exactly how feature 004 split `skierPose.ts` from the
sprite drawing, and how `trickBadge.ts` already sits.

## Approach by area

### 1. The coached section (FR-186 → FR-197)

Authored in `tools/gen-courses.ts` alongside the existing warm-up programme, because
prepending shifts every one of the warm-up's 18 existing features and the generator
is where that arithmetic belongs (R4). Gradient programme: **0.08** held through the
coached section, interpolated up to the warm-up's opening **0.230** across the join —
which CV-10 would have passed even as a hard step (0.146 rad against a 0.42
tolerance), so the interpolation is belt and braces.

Layout, derived from R2's lead table rather than chosen:

| x         | What                  | Cue                       | Lead |
| --------- | --------------------- | ------------------------- | ---- |
| 0–300     | empty run-in          | —                         | —    |
| 300       | cue fires             | **HOLD TO CROUCH!**       | 389  |
| 689       | boundary rope, clr 15 |                           |      |
| 900       | cue fires             | **RELEASE TO JUMP!**      | 389  |
| 1289      | deadfall              |                           |      |
| 1500      | cue fires             | **STAY CROUCHED!**        | 389  |
| 1889      | small ramp            |                           |      |
| 2100      | cue fires             | **SWIPE OR ← → TO FLIP!** | 389  |
| 2489      | booter                |                           |      |
| 2489–2900 | run-out and the join  | —                         | —    |

Exact positions are the generator's to settle against the validator; the **389-unit
lead is the invariant**, and `tests/unit/coaching-cue.test.ts` asserts it rather than
trusting the layout. CV-5's 140-unit minimum gap between low obstacles is satisfied
many times over — there is only one low obstacle in the section.

The section is warm-up-only (FR-197) because it lives in `warmup.json` and
`courseFor()` already routes official runs and post-commit free play to
`official.json`. No branching is needed to keep coaching out of scored runs; the
existing course routing does it. This is the reason the coached section is course
data rather than a mode.

### 2. Coaching cues (FR-189 → FR-191, FR-194)

`src/render/coachingCue.ts` exports a pure `cueAt(x: number): Cue | null` over a
static table of `{ from, to, text }` intervals — no state, no timers, no simulation
reads beyond `state.x`. `GameView.tick()` compares the cue at the previous tick's x
with the cue at this tick's and fires a change callback on transitions only, which is
the same edge-from-two-states pattern `LandingEffect` and the trick payout already
use, and is why nothing new has to be carried in `RunState`.

`src/ui/coachingBadge.ts` owns one DOM slot inside `#badges`. It shows and hides on
those transitions rather than on a `setTimeout`, which is the correction R6 names: a
timer would put the badge's life on the wall clock while its object is on the
simulation tick. Reduced motion is inherited free — the existing `.badge-still` class
and `badge-hold` keyframe already do what FR-194 asks.

The arrow glyphs (FR-190b) are `←` U+2190 and `→` U+2192, rendered in the game's
existing monospace stack. The build-config e2e spec asserts they draw as glyphs rather
than as tofu on the platform baseline; if they do not, the fallback is a drawn mark,
never the word "arrow".

### 3. The boundary rope (FR-198 → FR-205)

`drawBough` in `src/render/draw.ts` becomes `drawBoundaryRope`, with the same
signature and the same call site (`draw.ts:929`). It fills the collision slab
exactly — cord along the top, pennants hanging to the bottom, 18 units total (R5) —
which makes FR-200 true by construction rather than by care.

Composition, from the supplied reference: a twisted cord in `magenta` over a `purple`
core, with triangular pennants alternating `magenta`, `cyan`, `blue`, hanging
point-down. TR-3's hazard rule is satisfied by an `orange` edge along the pennant tips
— the line that actually kills — rather than a fill over the silhouette. Sag is drawn
inside the cord's own band so the tips stay flat across the full width; a sag that
dipped below them would put the picture and the collision in disagreement, which is
the one thing FR-200 forbids.

`tests/unit/rope-geometry.test.ts` asserts the contract directly: for a range of
clearances, the lowest mark the draw routine emits equals `ground - clearance`, and no
mark falls outside the slab.

### 4. Documentation corrections (FR-205 → FR-213)

Eight documents, no runtime behaviour, but each is a Principle I or VI obligation:
style bible TR-2/TR-3, feature 001's FR-030 strike plus the removal of the never-
called `saveBindings`, ADR-0002's stale "we will count them", the duplicate ADR-0010,
the README's "not yet built" and five-principle table, and the `test:perf` script that
points at a file which does not exist.

**The FR-030 strike still carries an unresolved constitutional conflict.** Technical
Standards & Constraints says "Controls MUST be fully remappable"; striking the
requirement that implements it leaves the constitution describing a product that does
not exist, which is what Principle VI forbids. It is recorded as an open deviation in
the spec with the maintainer as owner and "before this feature merges" as the date.
This plan does not resolve it and must not: amending the constitution is
`/speckit-constitution`'s job, and it needs a decision rather than a patch.

## Constitution Re-Check (post-Phase 1)

_Re-evaluated after data-model.md, contracts/ and quickstart.md were written._

No gate changed status. Three were sharpened by the design work, and one new
obligation appeared:

| Principle | Change since the pre-Phase 0 check                                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I         | The three forced amendments are now written as a **first task**, ahead of the code that depends on them, rather than as a note. The spec is corrected before it is implemented against, which is the order the principle asks for.                                                                                                                |
| II        | Strengthened from an argument to a structural property: `cueAt` is a total pure function of one number, nothing is added to `RunState`, and the cue edge is derived from `prevState`/`state` exactly as the landing flash already is. There is no path by which a cue can reach the hash.                                                         |
| IV        | Scope of the style-bible amendment is now pinned: TR-2 and TR-3 are rewritten, TR-9 is checked and expected to stand, and CV-14's prose reference to boughs follows the bible. Nothing else in section 3a moves.                                                                                                                                  |
| VI        | **New gate identified.** FR-190b's arrow glyphs can only be verified where a real browser renders real fonts, so `tests/e2e-build/coached-run.spec.ts` asserts them against the built artifact at `/ski-game/`. A glyph that falls back to tofu is a defect the unit suite cannot see, and the fallback is a drawn mark — never the word "arrow". |

### What is still open at the end of planning

One item, and it is not a planning gap:

**The constitutional deviation on controls remapping** (FR-206). Technical Standards
& Constraints says "Controls MUST be fully remappable"; FR-206 strikes the requirement
implementing it. Governance permits a documented deviation and one is recorded, with
the maintainer as owner and "before this feature merges" as the date. Resolving it is
`/speckit-constitution`'s job, not this plan's, and it wants a decision rather than a
patch: either narrow the clause to what the product intends to honour, or keep the
clause and leave FR-030 standing as unbuilt work.

Proceeding to `/speckit-tasks` is not blocked by it. Merging is.

## Complexity Tracking

| Violation                                          | Why Needed                                                                                                                                                    | Simpler Alternative Rejected Because                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two new modules for what is "just some text"       | The cue's _selection_ is pure and testable without a DOM; its _presentation_ is DOM. Fusing them makes the lead distances untestable except through a browser | One module holding both was tried on paper and forces `tests/unit/coaching-cue.test.ts` into Playwright, which is where this project's slowest feedback already lives |
| Badge lifetime driven by position, not a timer     | R6: the object is on the simulation tick and a timer is on the wall clock; they disagree on a slow frame                                                      | Reusing `popTrickBadge`'s `setTimeout` outright — rejected because a dropped frame would clear the instruction while its object is still ahead of the player          |
| Course regenerated by tool rather than hand-edited | Prepending shifts 18 existing features; the generator already owns that arithmetic and CV-10 interpolation                                                    | Hand-editing `warmup.json` — rejected, it is exactly the off-by-one that the generator exists to prevent, and `gen:courses` is already a checked-in script            |
