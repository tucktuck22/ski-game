# Implementation Plan: Speed Comes From the Mountain

**Branch**: `claude/lucid-dijkstra-6caua6` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-slope-driven-speed/spec.md`

## Summary

Replace `applyGroundedMotion`'s accelerate-toward-a-target-then-clamp with the real
thing: gravity along the slope, minus snow friction, minus quadratic air drag, with
the tuck acting by reducing drag. Speed then settles at terminal velocity for whatever
pitch the player is on, which is the behaviour the request asks for and is an emergent
property rather than a curve anyone tuned.

The physics change itself is roughly fifteen lines in one function. **The work is
everything downstream of it**: every kicker in the game launches at a different speed
(R6), both courses need re-certifying under CV-13, a new validator rule is needed to
stop a course stranding a player (R5), every golden re-baselines, and `rulesVersion`
bumps — which destroys the scores in any live draft.

Constants are anchored so that **gradient 0.30, the sustained pitch of both courses,
gives exactly today's 2.60 standing and 4.20 tucked** (R2). The middle of the game is
therefore unchanged and only the ends move — from 1.23/1.98 at the gentlest to
3.64/5.87 at the steepest, against today's flat 2.60/4.20 everywhere.

## Technical Context

**Language/Version**: TypeScript 5.6, ES modules, `strict`.

**Primary Dependencies**: none added.

**Storage**: N/A for the model. But `rulesVersion` is a stored, compared value and
this feature moves it — see "The reset gate".

**Testing**: Vitest for unit/sim/course; Playwright for e2e and the three-engine
determinism proof.

**Target Platform**: Evergreen mobile web, unchanged.

**Project Type**: Single-project browser game, fixed 320×180 buffer.

**Performance Goals**: unchanged. The new model is three multiplies and two adds per
tick against the old model's compare-and-clamp — well inside the 2.0 ms/tick budget.

**Constraints**: The constitution's simulation-arithmetic rule forbids trigonometric,
exponential, logarithmic and power functions in simulation code. The model complies by
construction because `slopeAt` already provides `ux`/`uy` as an exact unit vector
(R1). Determinism must hold on three engines.

**Scale/Scope**: one function rewritten, one landing clamp adjusted, five tuning keys
retired and four added, one new validator rule, both courses re-tuned and regenerated,
and every simulation golden re-baselined.

## Constitution Check

| Principle                                    | Gate                                                                              | Status                                                                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| I — Spec-Driven Delivery                     | Approved spec; tasks trace to requirements                                        | **PASS** — FR-214..FR-228, SC-074..SC-080. Two upstream specs need amending and both are numbered requirements (FR-227, FR-228)              |
| II — Stability Before Content                | Deterministic; no crash on any input; monkey suite green                          | **PASS WITH NEW RISK** — the integrator is proven stable at every legal gradient (R3), and FR-220 closes the stall case the model introduces |
| III — Fun Is a Testable Requirement          | Feel parameters named with tolerances, in data                                    | **PASS** — four new tuning values, all in `data/tuning.json`. FR-221 names the tuck transient explicitly because it is the one that changed  |
| IV — One Coherent 1980s Voice                | Style bible authoritative                                                         | **N/A** — nothing visual changes                                                                                                             |
| V — Fair and Verifiable Competition          | Scores reproducible; leaderboards partitioned when physics invalidates comparison | **PASS ONLY IF THE RESET HAPPENS** — this is precisely the case the principle's partition clause is about. See "The reset gate"              |
| VI — Shipped Artifact Is the Unit of Truth   | Verified against the built artifact at its base path                              | **PASS** — determinism spec already runs on three engines against the build                                                                  |
| VII — Operator Instructions Are Deliverables | Instructions a human runs are executed in CI                                      | **BINDING** — the reset is an operator procedure. The SQL the organizer runs must be executed verbatim in CI, not described                  |
| VIII — The Player Judges Fun, Early          | Course/tuning changes reach the player at the first playable point                | **BINDING AND CENTRAL** — this is a pure feel change. R4's tuck transient cannot be settled by measurement                                   |

### The reset gate

**Nothing in this feature may be deployed until the organizer has answered the
question in [spec.md](./spec.md#the-draft-reset-decision).**

FR-023 freezes physics at the first official commit and the database enforces it. A
draft holding committed scores will refuse every subsequent official run once
`rulesVersion` moves, and the only remedy destroys the scores already posted — which
means players who have taken their one irreversible run take it again.

This is a gate on _deployment_, not on implementation: the code, the re-tuning and the
tests can all be built and validated behind it. It is called out as a gate because the
failure mode is silent and remote — the organizer would discover it as "official runs
stopped working", which is exactly the defect class the README already documents from
the last time a rules version moved unexpectedly.

**Principle VII applies to the remedy.** If the answer is "reset", the reset procedure
is an operator instruction and must be executed verbatim in CI with its output
inspected — not written into a README and hoped for.

## Project Structure

```text
specs/006-slope-driven-speed/
├── plan.md               # This file
├── spec.md
├── research.md           # R1-R7, all measured
├── quickstart.md         # Phase 1
├── data-model.md         # Phase 1
├── contracts/
│   └── slope-response.md # Phase 1 — the model's contract
└── checklists/requirements.md

src/sim/
├── physics.ts            # MODIFIED — applyGroundedMotion rewritten; landing clamp
└── types.ts              # MODIFIED — Tuning keys retired and added

src/course/
└── validate.ts           # MODIFIED — CV-19, the stall rule (FR-220)

src/data/
└── load.ts               # MODIFIED — tuning validation follows the key change

data/
├── tuning.json           # MODIFIED — 5 keys out, 4 in
└── courses/*.json        # REGENERATED — kicker powers re-tuned, rulesVersion bumped

tools/
└── gen-courses.ts        # MODIFIED — kicker powers derived against local gradient

tests/
├── sim/slope-response.test.ts   # NEW — monotonicity, spread, terminal, stability
├── sim/golden.test.ts           # AMENDED — every golden re-baselined
├── course/validate.test.ts      # AMENDED — CV-19
└── unit/tuning-keys.test.ts     # NEW — retired keys are gone, not merely unread
```

**Structure Decision**: No new modules. The change is contained inside the simulation
layer that already owns grounded motion, which is what keeps the determinism argument
short: one function's arithmetic changed, and nothing else moved.

## Approach

### 1. The model (FR-214 → FR-219, FR-222)

`applyGroundedMotion` becomes:

```
slope    = slopeAt(terrain, x)                    // ux = cosθ, uy = sinθ, already exact
drag     = crouchHeld ? dragTucked : dragStanding
accel    = gravity * (slope.uy - slopeFriction * slope.ux) - drag * speed * speed
speed    = clamp(speed + accel, speedMin, speedMax)
```

Only `+`, `−`, `×` over values the simulation already holds, so the arithmetic rule is
satisfied structurally rather than by inspection (R1). Explicit integration, because
it is both simpler and more accurate than the semi-implicit alternative here (R3).

`resolveLanding`'s existing clamp changes from `[baseSpeed, tuckSpeedMax]` to
`[speedMin, speedMax]` — it must keep scrubbing airborne velocity onto the slope, and
must not reintroduce a target.

### 2. Tuning (FR-217, FR-221, FR-226)

| Retired                 | Added                                   |
| ----------------------- | --------------------------------------- |
| `baseSpeed` 2.6         | `slopeFriction` 0.02                    |
| `tuckSpeedMax` 4.2      | `dragStanding` 0.01270                  |
| `tuckAccel` 0.055       | `dragTucked` 0.00487                    |
| `tuckDecel` 0.09        | `speedMin` / `speedMax` bounds (FR-219) |
| `slopeAccelFactor` 0.04 |                                         |

Retired keys are **deleted**, not left unread (FR-226) — the `abandoned_official_runs`
column in the schema is the standing example of what unread data costs later.

### 3. The stall rule, CV-19 (FR-220)

A new validator rule rejecting any terrain segment whose gradient is too shallow to
overcome friction with margin (R5). Neither existing course comes close — the
shallowest gradient anywhere is 0.200 against a 0.02 threshold — so this is a guard
for future authoring, feature 005's coached section included.

It is a validator rule rather than only a runtime floor because a floor hides the
defect: the player creeps through a section the designer believed was rideable. CV-4
already makes this argument about release windows.

### 4. Re-tuning the courses (FR-224, FR-225)

The largest piece of work, and larger than the physics change. Every kicker's `power`
is re-derived against the gradient it actually sits on, in `gen-courses.ts`, and every
shelf re-certified under CV-13 — which can now fail in **both** directions: a weakened
kicker that no longer reaches its shelf, and a strengthened one that makes a shelf
reachable without the ramp CV-13 requires as its entry fee.

R6's table is the starting point, not the answer. The measured impulse changes run
from −19% to +34%.

### 5. Goldens (SC-079)

Every simulation golden re-baselines, deliberately and once, as a reviewable diff
rather than an `--update` run. This is the opposite of feature 005, where the
_official_ course goldens not moving was itself an assertion. Here they must all move,
and a golden that did **not** move would mean the physics never reached that path.

## Complexity Tracking

| Violation                                           | Why Needed                                                                                                                                  | Simpler Alternative Rejected Because                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retiring five tuning keys and adding four           | The old keys describe a mechanism that no longer exists; `baseSpeed` has no meaning when the mountain sets the speed                        | Keeping them as aliases — rejected, two vocabularies for one mechanism is how tuning files rot, and FR-226 exists because this repository already carries one dead column |
| A new validator rule for a case neither course hits | The model introduces a stall that is impossible today, and a course that strands a player must be unpublishable rather than merely unlikely | A runtime floor alone — rejected in R5: it converts a hard failure into a silent crawl, which ships                                                                       |
| Re-tuning both courses for a physics change         | Every launch is `power × speed` and every speed moved                                                                                       | Leaving powers alone — rejected, CV-13 certifies shelf entry against carried speed and R6 measures five of five kickers changing, one by +34%                             |

## Post-design note

Phase 1 artifacts — `data-model.md`, `contracts/slope-response.md`, `quickstart.md` —
are written once the reset gate is answered. They describe how to verify a deployment,
and the shape of that verification depends on whether this ships into a fresh draft or
a reset one. The physics research they would rest on is complete and is in
[research.md](./research.md).
