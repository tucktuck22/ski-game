# Implementation Plan: Shredpocalypse '86 — Bed-Pick Draft

**Branch**: `claude/session-start-ulvu8z` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-shredpocalypse-bed-draft/spec.md`

## Summary

A web-based 2D side-on skiing platformer, shared by one link, whose final
leaderboard is the bed-selection draft order for an eight-person ski trip. Each
player gets three practice runs on a warm-up course, then one official run on a
course he has never seen, whose score commits irreversibly the moment the run ends.

The technical approach is built around one constraint: **the simulation must be
bit-identical across devices**, because the leaderboard decides something real. A
pure `step(state, input) → state` function on a fixed 60 Hz timestep, using only
IEEE-754's exactly-specified arithmetic, is separated completely from rendering,
audio, and storage. Rendering targets a fixed 320 × 180 buffer, which is both the
period-correct look and the reason a phone and a desktop see the same amount of
course ahead. Shared state lives in Postgres, where the one-official-run rule is a
unique constraint rather than a promise.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode, targeting ES2022

**Primary Dependencies**: PixiJS v8 (rendering only), Supabase JS client (storage).
No physics, game-loop, or UI framework — the simulation and the interface are
written directly against the constraints in [research.md](research.md).

**Storage**: Supabase (hosted Postgres) with Row Level Security and Realtime for
shared draft state. IndexedDB as a commit outbox only — never a source of truth.

**Testing**: Vitest for unit, simulation, and course-validator tests. Playwright for
cross-browser determinism (Chromium, Firefox, WebKit), performance measurement, and
end-to-end runs.

**Target Platform**: Evergreen mobile web — Safari on iOS 16+, Chromium and Firefox
on Android 10+, same engines on desktop. Reference hardware is a 2022-era mid-range
phone (Pixel 6a / Galaxy A54 / iPhone SE 3rd gen class).

**Project Type**: Static single-page web application with a managed backend. No
server of our own.

**Performance Goals**: Simulation step ≤ 2.0 ms per 60 Hz tick at 4× CPU throttle;
frame time ≤ 16.7 ms p95 with ≥ 50 fps sustained; input-to-visible-response ≤ 2
simulation frames.

**Constraints**: ≤ 2 MB gzipped initial payload; ≤ 5 s to interactive on Fast 3G;
≤ 150 MB peak JS heap; a full run playable with no network; bit-identical
simulation across all three browser engines.

**Scale/Scope**: One draft, at most 16 roster entries, 8 expected. Roughly 64
official runs' worth of traffic over a week. Scale is not a design consideration;
correctness of a single irreversible write is.

## Constitution Check

*GATE: evaluated before Phase 0 and re-evaluated after Phase 1 design.*

| # | Principle | Gate | Verdict |
|---|---|---|---|
| I | Spec-Driven Delivery | Approved spec exists; every task traces to a numbered FR | **PASS** — 89 FRs, zero open markers, checklist 16/16 |
| II | Stability Before Content | No crash on any input; deterministic sim; frame budget held; saved state never corrupted | **PASS by design** — monkey fuzz over `step()`, three-engine golden run, throttled CI budget check, insert-only storage with migration round-trip |
| III | Fun Is a Testable Requirement | Feel parameters measurable; latency ≤ 2 frames; tuning in data; human playtest; consistent verbs | **PASS with residual** — see below |
| IV | One Coherent 1980s Voice | Style bible is the single source of truth; every asset cites a rule | **CONDITIONAL** — see below |
| V | Fair and Verifiable Competition | Runs reproducible; identical conditions; scores replay-verified; no pay-to-win | **DOCUMENTED DEVIATION** — see below |

### Principle III — residual, closed by this plan

The spec names every feel parameter and requires each to carry a tolerance
(FR-083) but states no target numbers, which left the principle partially
satisfied. This plan closes it: [contracts/tuning-data.md](contracts/tuning-data.md)
sets a starting value and an acceptance tolerance for every parameter. These are
opening positions to be refined by playtest, not guesses dressed as measurements —
but they are concrete, versioned, and testable, which is what the principle asks
for. The human playtest required by Definition of Done item 6 remains outstanding
and cannot be satisfied by any automated process.

### Principle IV — conditional, and the condition is ordering

No style bible exists in the repository. FR-051 makes writing it part of this
feature. The gate passes **only if** it is written before the first asset lands,
not alongside the last. This is a sequencing constraint on `/speckit-tasks`, and
the most likely way for this feature to violate the constitution is to treat the
style bible as documentation to be backfilled.

### Principle V — documented deviation, already recorded

Scores are accepted as reported by the client, with no replay verification. The
deviation is recorded in the spec's Constitutional Compliance Notes with rationale,
owner, and remediation date, and in
[ADR-0004](../../docs/adr/0004-accept-client-reported-scores.md).
[ADR-0005](../../docs/adr/0005-trust-the-players.md) proposes amending Principle V
so this becomes ordinary compliance; it is **Proposed, not approved**, so the
deviation stands.

The clauses of Principle V that survive are load-bearing and this plan honours all
of them: runs are reproducible from seed and inputs (R2), every competitor faces an
identical course from a shared seed (FR-022, R4), and nothing purchasable or
cosmetic affects scoring.

### Technical Standards

| Standard | How this plan satisfies it |
|---|---|
| Simulation separated from rendering | `src/sim/` is a pure function; `src/render/` reads state and never mutates it. Enforced by lint, not convention. |
| Fixed timestep with render interpolation | 60 Hz accumulator; renderer interpolates between the last two states |
| No wall-clock, unseeded random, or unordered iteration in sim | Lint bans `Math.*`, `Date.*`, `performance.*` in `src/sim/**`; all randomness from the shared seed |
| Floating-point pinned | float64 restricted to `+ - * /`; three-engine golden test is the proof (R2) |
| Data-driven content | Courses, tuning, scoring, and insults are versioned data files loaded without recompile |
| Performance budgets enforced in CI | Throttled Playwright measurement against the table in R1 |
| Accessibility | Remappable keys, no colour-only information, reduced-motion, flash limits, CVD-validated palette (FR-055 to FR-061) |
| Asset management | Git LFS for binary sprite atlases; audio is synthesised, so there are no audio binaries to track |

### Post-Phase-1 re-evaluation

Re-checked after the design artifacts below were written. No gate changed verdict.
The design added one obligation not visible at Phase 0: the course validator
(R4) is what makes FR-089 and SC-016 enforceable, and it must exist **before**
course content is authored, or the rule it enforces will be violated first and
discovered later. Recorded in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-shredpocalypse-bed-draft/
├── plan.md                    # This file
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
├── contracts/                 # Phase 1 output
│   ├── storage-api.md         # Shared-state operations and invariants
│   ├── course-data.md         # Course schema and validator rules
│   ├── tuning-data.md         # Feel parameters, values, tolerances
│   └── controls.md            # Input verbs across touch and keyboard
├── checklists/
│   └── requirements.md        # Spec quality checklist
└── tasks.md                   # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── sim/                    # Pure, deterministic. No DOM, no I/O, no Math.*
│   ├── step.ts             # step(state, input) -> state
│   ├── physics.ts          # Semi-implicit Euler, slope contact, launch
│   ├── scoring.ts          # Base, trick, and pickup accumulation
│   ├── rng.ts              # Seeded PRNG
│   └── trig.ts             # Generated lookup table
├── course/
│   ├── load.ts             # Parse and validate course data
│   └── validate.ts         # Shared by CI and runtime
├── render/                 # Reads sim state, never mutates it
│   ├── stage.ts            # 320x180 buffer, integer upscale
│   ├── filters/            # Scanline, halftone, bloom shaders
│   └── sprites/
├── audio/
│   └── synth.ts            # Web Audio, gesture-gated
├── input/
│   ├── keyboard.ts
│   └── touch.ts
├── state/                  # Draft, roster, claims, run counts
│   ├── supabase.ts
│   └── outbox.ts           # IndexedDB transport buffer only
└── ui/                     # Roster, leaderboard, confirmations, organizer

data/
├── courses/
│   ├── warmup.json
│   └── official.json
├── tuning.json
├── scoring.json
└── insults.json

assets/
└── style-bible.md          # Principle IV single source of truth

tests/
├── unit/
├── sim/                    # Determinism, golden runs, monkey fuzz
├── course/                 # Validator rules including FR-089
├── contract/               # Storage invariants
└── e2e/                    # Playwright, three engines
```

**Structure Decision**: A single static web application, not a frontend/backend
split, because there is no server of our own — Supabase is the backend. The
directory boundary that matters is not frontend/backend but `src/sim/` against
everything else: that boundary is what Principle II's determinism requirement and
Principle V's reproducibility clause both rest on, and it is enforced by lint rather
than left to discipline.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Hand-written physics instead of a physics library | FR-026 requires bit-identical scores across three browser engines | Matter.js and Planck.js are float-based general solvers whose iteration order and broadphase are not determinism-guaranteed, and both are larger than the entire simulation a skier on a height profile needs |
| Generated trig lookup table instead of `Math.sin` | `Math.sin` is implementation-approximated and differs across V8, SpiderMonkey, and JavaScriptCore | Using `Math.sin` directly would produce different scores per browser — the exact failure Principle V exists to prevent |
| A course validator in CI | FR-089 and SC-016 require every low obstacle to be followed by a verified safe release window | Human review misses this. A single badly placed beam makes the course unfinishable for the players FR-035 protects, and would surface as one friend saying the game is broken |
| Fixed 320 × 180 internal buffer instead of scaling to viewport | SC-006 requires phone and desktop scores to be comparable | Scaling to the viewport gives desktop more course ahead, which after FR-088 is directly more reaction time for the game's core skill — permanent tuning problem instead of a rendering property |
