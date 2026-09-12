---
description: 'Task list for feature 005 — A Coached First Run, and a Rope You Can See'
---

# Tasks: A Coached First Run, and a Rope You Can See

**Input**: Design documents from `/specs/005-tutorial-and-boundary-rope/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included and NOT optional. The spec names seven test files by path in
plan.md's Project Structure, quickstart.md gives the command for each, and both
contracts write their guarantees as numbered tables that say "asserted in
`tests/unit/...`". Principle II additionally makes the determinism assertion a gate
rather than a nicety.

**Organization**: Tasks are grouped by user story. US2 (the rope) is deliberately
placed before US1 (the coaching), against spec priority order — see the note under
Phase 4.

---

## Before anything: what shipped under this feature's feet

Read this first. It is the reason three of the design documents disagree with each
other, and the reason T001–T004 exist.

Feature 006 (`specs/006-slope-driven-speed`) replaced the speed model **after** 005
was specified and planned. A re-baseline pass on 2026-09-12 corrected `spec.md`,
`plan.md`, `research.md`, `data-model.md` and `quickstart.md`. It **did not touch
`contracts/`**, and it left one stale sentence in `plan.md` and one stale table in
`data-model.md`.

The disagreement is on the single number this feature's teaching value rests on:

| Document                       | Says                                                                                 | Status                 |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---------------------- |
| `research.md` R7, option C     | Gradient **0.05**, **no lead machinery**, cue binds to object visibility             | **AUTHORITY**          |
| `quickstart.md` §4             | "bound to **its object's visibility** — FR-191 as approved"                          | Agrees                 |
| `spec.md` FR-191 + its callout | Ships as approved; amendments withdrawn                                              | Agrees                 |
| `plan.md` summary + §1         | "R7 option C drops the lead to zero" … then "the **389-unit lead is the invariant**" | **CONTRADICTS ITSELF** |
| `data-model.md` §2             | Lead **389** for every cue; invariant 2 asserts it                                   | **STALE**              |
| `contracts/coaching-cues.md`   | `CUE_LEAD = 389`; guarantee 4 asserts it                                             | **STALE**              |

**Build to object visibility, not to 389.** A cue's `from` is
`object.x − PLAYER_LOOKAHEAD` (213.333, from `src/render/stage.ts`). Building to 389
would fire every cue ~1.8× earlier than intended and **nothing would fail**, because
the tests would be written from the same stale table. T001 closes this before any code
reads it, which is the order Principle I asks for.

**Re-run of R7's probe, 2026-09-12 (this session).** `data/tuning.json` has not moved
since R7 was taken, so its table stands. Verified against the shipped constants
(`gravity` 0.16, `slopeFriction` 0.012, `dragStanding` 0.00546494, `dragTucked`
0.00230894):

| Quantity at coached gradient 0.05       | Value                      |
| --------------------------------------- | -------------------------- |
| Terminal speed, standing                | **1.054**                  |
| Terminal speed, tucked                  | **1.622**                  |
| Reading time over 213.33 u, standing    | **3.38 s**                 |
| Reading time over 213.33 u, tucked      | **2.19 s**                 |
| CV-23 stall floor (`slopeFriction * 3`) | **0.036** — 0.05 clears it |

**One more staleness the re-baseline missed**, found by reading the generator rather
than the docs: `plan.md`, `data-model.md` and `research.md` R4 all describe the join
as `0.05 → 0.230`, because 0.230 was the warm-up's opening gradient when 005 was
planned. `tools/gen-courses.ts:578` now opens `WARMUP_GRADE` at **0.26** — 006 raised
it off the new stall floor. The join is therefore `0.05 → 0.26`, a step of 0.204 rad
against CV-10's 0.42 tolerance. Still legal with room, so the conclusion survives; the
figure does not. T002 corrects it.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are given in every task

## Path Conventions

Single project, repository root: `src/`, `tests/`, `tools/`, `data/`, `docs/`,
`assets/`, `specs/`.

---

## Phase 1: Setup — make the specification true before building from it

Principle I: a plan that forces an amendment amends the spec **in the same change
set**, ahead of the code that depends on it. Every task here is a documentation edit
with no runtime behaviour, and each is a prerequisite for a task that reads it.

- [x] T001 [P] Reconcile the retired 389-unit lead in `specs/005-tutorial-and-boundary-rope/contracts/coaching-cues.md`: replace `export const CUE_LEAD = 389` with a binding to object visibility (`from = object.x − PLAYER_LOOKAHEAD`, imported from `src/render/stage.ts`), rewrite selection guarantee 4 to assert that binding instead of a fixed lead, and add a dated note pointing at [research R7](./research.md#r7--what-feature-006-did-to-r1-and-r2) so the retired figure is labelled rather than deleted (per the re-baseline's own convention)
- [x] T002 [P] Correct `specs/005-tutorial-and-boundary-rope/data-model.md` §2: drop the `Lead (object.x − from)` column of 389s in favour of the visibility binding, rewrite invariant 2 to match, and correct the join figure in §1 from `0.230` to the warm-up's actual opening gradient of **0.26** (`tools/gen-courses.ts:578`), with the recomputed step of 0.204 rad against CV-10's 0.42
- [x] T003 [P] Strike the two stale sentences in `specs/005-tutorial-and-boundary-rope/plan.md`: the "**389-unit lead is the invariant**" clause in "Approach by area §1" (it contradicts the same paragraph's own re-baseline note), and the "Amendments this plan forces on the spec" table, whose FR-187 and FR-191 rows were withdrawn on 2026-09-12 and whose FR-192 row is the only one still live. Correct the join to `0.05 → 0.26` in the same pass
- [x] T004 [P] Correct research R4 in `specs/005-tutorial-and-boundary-rope/research.md` the same way — `0.08 → 0.230` becomes `0.05 → 0.26` at 0.204 rad — keeping the retired measurement labelled in place rather than deleting it
- [x] T005 Re-read the four amended documents end to end and confirm no reference to a 389-unit lead, a 0.08 coached gradient, or a 0.230 join survives anywhere in `specs/005-tutorial-and-boundary-rope/` except where explicitly labelled as a retired measurement

**Checkpoint**: The design set agrees with itself and with `data/tuning.json`. No code
has been written against a number that moved.

---

## Phase 2: Foundational — the frozen-data gate, before anything can move it

**Purpose**: FR-196 and FR-204 are the clauses that let this feature ship into a live
draft. They are cheapest to enforce as a test that exists _before_ the edits, so a
violation is caught by a red test rather than by a reviewer.

**⚠️ BLOCKS every later phase.**

- [x] T006 Write `tests/unit/tuning-frozen.test.ts` asserting that `data/tuning.json` and `data/courses/official.json` are byte-identical to their committed versions (read the blob via `git show HEAD:<path>` or a checked-in digest — whichever the repo's existing test helpers make cleaner), with the failure message naming FR-196 and explaining that 005 may not move physics, tuning, scoring, or the official course
- [x] T007 Run `npx vitest run tests/unit/tuning-frozen.test.ts` and confirm it passes **now**, on unmodified data. A test that cannot go green before the feature starts cannot prove anything after it

**Checkpoint**: The freeze is mechanical. Any later task that touches tuning or the
official course fails loudly.

---

## Phase 3: User Story 2 — The thing that kills you does not look like the forest (P1)

**Goal**: A `low` obstacle is drawn as a pennanted boundary rope on every course, with
the lowest drawn mark equal to the collision floor, and the simulation provably
untouched.

**Independent test**: Ride a stretch of the official course containing `low`
obstacles; the object is a rope, not a bough. Replay an identical course, seed and
input sequence across the change and get an identical score.

**Why this phase runs before US1**, against the spec's own priority order: the
coached section's first object _is_ a boundary rope, so US1's course data and its
e2e spec both depend on the rope existing. The spec's own text agrees — US2 is
"shippable on its own", US1 is not shippable without it. This is a build-order
choice, not a re-prioritisation, and both remain P1.

### Tests for US2

- [x] T008 [P] [US2] Write `tests/unit/rope-geometry.test.ts` against the contract in [contracts/boundary-rope.md](./contracts/boundary-rope.md): over a spread of clearances across the legal `(9, 16)` range and a spread of widths, the lowest mark the rope emits equals `ground − clearance` **flat across the full span**, and no mark falls outside the 18-unit slab. Drive it through a recording stub for `CanvasRenderingContext2D` that captures every emitted coordinate, in the style of the existing `tests/unit/palette.test.ts`
- [x] T009 [P] [US2] Extend `tests/unit/palette.test.ts` to cover the rope's marks, asserting only the eight existing palette tokens appear and no ninth colour is introduced (FR-202)
- [x] T010 [P] [US2] Add an assertion to `tests/unit/palette.test.ts` (or a sibling) that **no bough draw path survives** anywhere in `src/` — the grep-style check clause 3 of the rope contract asks for (FR-198: no course may show both idioms)

### Implementation for US2

- [x] T011 [US2] Replace `drawBough` with `drawBoundaryRope` in `src/render/draw.ts` (currently at line 687, called at line 927), keeping the signature `(ctx, x, width, bottom, thickness)` and the call site unchanged: a `magenta` twist over a `purple` core in the top ~4 units of the slab, triangular pennants hanging point-down through the remaining ~14 to the slab bottom, alternating `magenta`, `cyan`, `blue`, with an `orange` edge along the tips. Sag is drawn **inside the cord band only** — the tips stay flat at `bottom`, because a sag that carried them down would put the picture and the collision in disagreement, which is the one thing FR-200 forbids
- [x] T012 [US2] Rename the generator constant `BOUGH_W` to `ROPE_W` in `tools/gen-courses.ts:196` and at both use sites, so the data layer stops naming an object the game no longer draws
- [x] T013 [US2] Correct CV-14's prose in `src/course/validate.ts` to say "rope" rather than "bough" — the rule is about clearance and is unaffected; only its wording follows the style bible
- [x] T014 [P] [US2] Amend `assets/style-bible.md` TR-2 and TR-3 per FR-205: TR-2's `low` obstacle becomes a boundary rope, keeping **verbatim** the clause that is the contract — _the shape the player sees is the shape he has to get under_; TR-3's `orange` killing edge moves from a bough's underside to the pennant tips, with the rule itself unchanged. Check TR-9 and expect it to stand — it contrasts rocks with deadfall, and neither moves
- [x] T015 [US2] Run `npm run test:sim` and confirm **every golden is unchanged**, official and warm-up alike. At this point no course data has moved, so a moved hash means the re-skin reached the simulation and FR-204 is broken — stop and fix rather than re-baseline
- [x] T016 [US2] Run `grep -rn "bough" assets/style-bible.md src/` and confirm zero hits (quickstart §8)

**Checkpoint**: US2 is independently shippable. The rope is drawn everywhere, the
style bible describes it, and the simulation is provably untouched.

---

## Phase 4: User Story 1 — The game teaches its four verbs before it asks for them (P1)

**Goal**: A practice run opens on a gentle coached section carrying four objects and
four badges, then continues into the existing warm-up terrain within the same run.

**Independent test**: Start a practice run with no prior knowledge of the controls.
All four badges appear in order, each while its object is on screen and before it is
reached. The section is completable on the instruction alone, and the run continues
into the warm-up terrain with no break, load, or second start.

### Course data for US1

- [x] T017 [US1] Author the coached section in `tools/gen-courses.ts`'s `warmup()`: gradient **0.05** held through the section, interpolated up to the warm-up's opening **0.26** across the join, with all 18 existing warm-up features shifted right by the section's span and `length` grown to match. Prepending is done in the generator, never by hand-editing `warmup.json` — the generator owns exactly this arithmetic (research R4)
- [x] T018 [US1] Place the four coached objects in the same programme, in FR-188's order: a `low` at clearance **15** (the most forgiving legal value under CV-3, per research R3), a `solid` deadfall, a small ramp, and a booter — each separated by enough clear run to satisfy CV-4, CV-5, CV-7, CV-11 and CV-15 with room. Derive ramp and booter power from the coached gradient via the existing `rampPowerFor` / `terminalAt` helpers, not from the warm-up's figures: at 0.05 the player arrives far slower than anywhere else in the game
- [x] T019 [US1] Satisfy FR-192 explicitly: confirm by running a passive robot pilot (`tests/sim/pilots.ts`) through the section that a player who reads nothing and presses nothing **reaches the warm-up course** — no dead end. With FR-192a in force this is the only thing between a confused player and a spent practice allowance, and it is the single most important geometric constraint in the feature
- [x] T020 [US1] Run `npm run gen:courses` and `npm run test:course`, and confirm zero CV violations over both courses. If CV-10 fires the gradient programme stepped instead of interpolating; if CV-23 fires the coached gradient fell under the 0.036 floor
- [x] T021 [US1] Re-baseline the warm-up goldens in `tests/sim/golden.test.ts` **deliberately and once**, as a reviewable diff and never via an `--update` run, and confirm in the same pass that the **official-course goldens have not moved**. That asymmetry is itself the assertion (quickstart §2). **Finding: there was nothing to re-baseline.** `golden.test.ts` pins no course hash — it asserts that a run is identical to _itself_ across 25 executions, and that both courses are completable. So a changed course moves no golden by construction, and the asymmetry quickstart §2 describes is carried instead by `tests/unit/tuning-frozen.test.ts` (T006), which is a byte comparison of `official.json` and is the stronger assertion of the two. The plan's expectation of a pinned-hash re-baseline was mistaken about this repository

### Cue selection for US1

- [x] T022 [P] [US1] Write `tests/unit/coaching-cue.test.ts` first, per the guarantees in [contracts/coaching-cues.md](./contracts/coaching-cues.md) as amended by T001: `cueAt` returns at most one cue at any x; it is total over any finite x including negative and past the finish; each cue's `from` equals its object's x minus `PLAYER_LOOKAHEAD`, **asserted against the generated course data** so moving an object without moving its cue fails the build; each `to` is at or past its object's trailing edge; every interval lies inside the coached section; and the four strings match FR-190 character for character, arrow glyphs included
- [x] T023 [US1] Implement `src/render/coachingCue.ts`: `export function cueAt(x: number): Cue | null`, `export const CUES: readonly Cue[]`, over a static table of `{ id, from, to, text }`. Total, pure, allocation-free, reading no clock, no state, no storage, and holding nothing between calls. Entries are frozen singletons so the caller's `!==` is a transition and never a false positive
- [x] T024 [US1] Derive the cue table's `from` values from the object positions T018 settled, so the two cannot drift apart. The four strings are verbatim from FR-190: `HOLD TO CROUCH!`, `RELEASE TO JUMP!`, `STAY CROUCHED!`, `SWIPE OR ← → TO FLIP!`, with arrows U+2190 and U+2192

### Cue presentation for US1

- [x] T025 [P] [US1] Write `tests/unit/coaching-badge.test.ts`: at most one coaching badge in the DOM at any moment; the badge is removed **only** by `set(null)` or `destroy()` and never by a timer; a trick badge landing beside it displaces neither; under reduced motion the badge still appears, still says the same thing, and still holds long enough to read
- [x] T026 [US1] Implement `src/ui/coachingBadge.ts` as a sibling of `src/ui/trickBadge.ts`: `mountCoachingBadge(host, motion): CoachingBadge` with `set(cue | null)` and `destroy()`. **No `setTimeout`.** `popTrickBadge`'s `LIFETIME_MS` suits a badge reporting something finished; a coaching badge describes an object still ahead on the simulation tick, and on a slow frame a timer clears the instruction while its object has not arrived — the one failure the player cannot recover from, because he never gets the cue again (research R6)
- [x] T027 [US1] Give the coaching badge its own slot inside `.badges` in `src/ui/style.css`, in the trick badge's visual idiom (LT-3 sound-effect lettering, panelled, yellow on ink with the magenta drop) but in a slot that neither displaces the other. Reuse the existing `.badge-still` class and `badge-hold` keyframe for reduced motion rather than adding new ones — FR-194 is inherited, not rebuilt
- [x] T028 [US1] Add an `onCue` callback to `GameView` in `src/ui/game.ts` alongside the existing `onTrick`, and derive the cue edge in `tick()` from the `prevState`/`state` pair the method already holds: `const before = cueAt(this.prevState.x); const after = cueAt(this.state.x); if (before !== after) this.onCue(after);`. **Nothing is added to `RunState`** — this is the same edge-from-two-states pattern `LandingEffect` and the trick payout already use, and it is why the state hash cannot move. Clear the cue on `destroy()` so no badge outlives its run
- [x] T029 [US1] Mount the coaching badge in `src/main.ts`'s `startRun` beside the existing `popTrickBadge` wiring (line 685), passing the `#badges` host and the already-resolved `motion`. No branch on run kind is needed: the cue intervals lie inside the warm-up course's coached section and `courseFor()` already routes official runs and post-commit free play to `official.json`, so an official run simply never finds a cue (FR-197)

### Verification for US1

- [x] T030 [US1] Run `npx vitest run tests/unit/coaching-cue.test.ts tests/unit/coaching-badge.test.ts` and confirm both pass
- [x] T031 [US1] Add `tests/e2e-build/coached-run.spec.ts` driving the **built artifact** at the production base path `/ski-game/` via `playwright.build.config.ts`: a cold load reaches the title screen; **DROP IN** → claim → **PRACTICE RUN** reaches the coached section; all four badges appear in order with the correct text; and the arrow glyphs render as **glyphs, not tofu** (FR-190b). A glyph failure means substituting a _drawn_ mark — never falling back to the word "arrow", which is what these marks were chosen over
- [x] T032 [US1] Run `npm run build && npm run test:build` and confirm the new spec passes

**Checkpoint**: The coached section runs. **Phase 5 is now due — do not continue to
Phase 6 first.**

---

## Phase 5: The play pass (Principle VIII) — BINDING, and due here

**⚠️ This is not a polish item and it does not wait for feature completion.** The
constitution names `data/courses/warmup.json` explicitly, and this feature edits it.
The play pass happens at **the first point the coached section runs** — which is the
end of Phase 4 — because the feature's whole premise is a pacing claim, and pacing is
the one thing the course validator and both robot pilots hold no opinion about.

- [ ] T033 Run `npm run build:artifact` to produce the single-file playable build
- [ ] T034 Publish it and **name the link and the commit it was built from** in the handover, per Principle VIII
- [ ] T035 Record the maintainer's findings against `specs/005-tutorial-and-boundary-rope/spec.md` **in his own words**, before changing any of these values again. The questions to put to him, in this order: (1) **Is 2.19 s enough to read the flip cue and act?** — that is what a _tucked_ player gets at gradient 0.05, against the 2.5 s R2 set out to buy, and it is the one number no measurement closes; (2) does the rope read as a hazard from across the frame, or only once it is close; (3) does **STAY CROUCHED!** land, given the previous cue just taught the opposite; (4) does riding this three times per practice session become tedious, given FR-186a puts every player through it on all three runs
- [ ] T036 **Only if the player says the flip cue reads short**: apply research R7's recorded fallback of **30 units of lead**, which brings 0.05 to 2.5 s. This is a data change, not a mechanism, and it is deliberately **not** taken in advance of play — build the simple thing, ride it, then decide. Do not apply it speculatively

**Checkpoint**: The player has judged the pacing. Any tuning that follows is evidence-led.

---

## Phase 6: User Story 3 — The same run every time (P3)

**Goal**: Every practice run presents an identical coached section, and nothing about
who has been coached is recorded anywhere.

**Independent test**: Three consecutive practice runs under the same name, on a fresh
device and then on a second device, are identical from the start line to the end of
the coached section.

- [ ] T037 [P] [US3] Add a test asserting this feature introduced **no persistence whatsoever** (FR-186a): no new database column, no migration under `supabase/`, and no new `localStorage` or IndexedDB key. The existing `tests/unit/safe-storage.test.ts` and `tests/unit/no-verified-claims.test.ts` show the idiom. US3 is protected by the _absence_ of a mechanism, which is exactly why it is worth asserting rather than assuming
- [ ] T038 [US3] Confirm by inspection that `cueAt` and the coached section read nothing per-player: the section is course data loaded once, the cue is a pure function of `x`, and there is no branch anywhere on runs used, device, or session

**Checkpoint**: A record that could be wrong does not exist, so it cannot drop a player into the wrong terrain.

---

## Phase 7: The documentation half (FR-206 → FR-213)

No runtime behaviour, and **not optional** — each is a Principle I or VI obligation,
and SC-070 requires every document this feature contradicts to be corrected in the
same change set. All are independent of each other.

- [ ] T039 [P] Strike FR-030 in `specs/001-shredpocalypse-bed-draft/spec.md:268` with the reason and the date, following the precedent set by FR-065, and remove the never-called `saveBindings` from `src/input/keyboard.ts:33` rather than leaving machinery implying a feature that does not exist (FR-206)
- [ ] T040 [P] Correct `docs/adr/0002-abandoned-official-runs-are-discarded.md` to remove its claim that abandonments are counted and visible on the leaderboard — that counter was removed in `7b2cc8b` and the record still describes it as the deterrent the decision rests on (FR-210)
- [ ] T041 [P] Resolve the duplicate ADR number: `docs/adr/0010-a-ninth-colour.md` and `docs/adr/0010-organizer-actions-as-secret-gated-functions.md` both claim 0010 and only the second appears in the index. Renumber one and make `docs/adr/README.md` list **both** (FR-211)
- [ ] T042 [P] Correct `README.md` (FR-212): it opens by stating the project is "Planned, not yet built" with "no game code" — the game has shipped and been played — and it still describes five governing principles where the constitution has carried eight since v1.3.0, which is the outstanding `TODO(README_PRINCIPLE_TABLE)`
- [ ] T043 [P] Remove or make real the `test:perf` script in `package.json`: it points at `tests/e2e/performance.spec.ts`, which does not exist, so the one command that looks like the performance gate the constitution has required since v1.1.0 fails the moment anyone runs it (FR-213). **Removing it does not close the constitution's open deviation 3** — it stops that deviation being misrepresented as covered, which is a different thing, and the note in `spec.md` saying so must survive
- [ ] T044 Verify the documentation half per quickstart §8: `npm run test:perf` either runs something real or reports "script not found", and `grep -rn "bough" assets/style-bible.md src/` returns nothing

---

## Phase 8: Polish and the full gate

- [ ] T045 Run `npm run lint` and fix anything this feature introduced. **Do not fold an unrelated repo-wide reformat into this diff** — feature 004's T005 is the precedent, and it is its own change
- [ ] T046 Run the full gate in the order CI runs it: `npm run lint && npm run build && npm run test && npm run test:build`. Green here plus a recorded play pass is this feature's Definition of Done
- [ ] T047 Confirm SC-069: the coached section adds course data, not per-frame work, and the cue callback fires only on a transition rather than once per tick. Assert "no worse" against the existing frame-time budget, which is the claim the plan actually makes — not an improvement
- [ ] T048 Walk `specs/005-tutorial-and-boundary-rope/quickstart.md` start to finish as written and confirm every step behaves as documented. Principle VII: an instruction a human runs is a deliverable, and a quickstart that has never been executed is prose

---

## The one thing no task here can close

**The open constitutional deviation on controls remapping.** The constitution's
Technical Standards & Constraints states, without qualification, _"Controls MUST be
fully remappable."_ T039 strikes the spec requirement that implements it (FR-206).
Governance permits a documented deviation and one is recorded in
[spec.md](./spec.md#constitutional-compliance-notes), owned by tucktuck22, with
"before this feature merges" as its remediation date.

**This is not a task on this list, and must not be treated as one.** Amending the
constitution is `/speckit-constitution`'s job and it wants a decision, not a patch:
either narrow the accessibility clause to what this product intends to honour, or keep
the clause and leave FR-030 standing as unbuilt work. Striking the spec requirement
while leaving the constitutional MUST in place is the one outcome that makes the
constitution describe a product that does not exist — precisely what Principle VI
forbids.

**Implementation is not blocked by it. Merging is.**

---

## Dependencies & Execution Order

### Phase order

```text
Phase 1 (Setup, T001-T005)
    ↓  the spec must be true before code reads it (Principle I)
Phase 2 (Foundational, T006-T007)  ⚠️ BLOCKS EVERYTHING
    ↓  the freeze is mechanical before anything can move it
Phase 3 (US2 — the rope, T008-T016)
    ↓  US1's first coached object IS a rope
Phase 4 (US1 — the coaching, T017-T032)
    ↓
Phase 5 (PLAY PASS, T033-T036)  ⚠️ BINDING, due HERE not at the end
    ↓
Phase 6 (US3, T037-T038)  ─┐
Phase 7 (Docs, T039-T044) ─┼─ independent of each other
Phase 8 (Gate, T045-T048) ─┘  runs last
```

### Story dependencies

| Story | Depends on                | Why                                                       |
| ----- | ------------------------- | --------------------------------------------------------- |
| US2   | Phase 1, Phase 2          | Needs the freeze gate; otherwise standalone and shippable |
| US1   | Phase 1, Phase 2, **US2** | Its first coached object is a boundary rope               |
| US3   | US1                       | Asserts a property of the coached section US1 builds      |

### Within-phase dependencies

- **T011 blocks T015/T016** — the goldens and the grep are checks on the rewrite
- **T017 → T018 → T019 → T020 → T021** are strictly sequential: terrain, then objects on it, then the passive-pilot proof, then validation, then the re-baseline
- **T022 before T023/T024** (tests first), and **T024 depends on T018** — the cue table is derived from the object positions
- **T025 before T026**; **T026 → T027 → T028 → T029** are sequential through the DOM → CSS → tick → mount seam
- **T031 depends on T029** — there is nothing to drive in a browser until the badge is mounted

### Parallel opportunities

| Phase | Parallel set                       | Note                                         |
| ----- | ---------------------------------- | -------------------------------------------- |
| 1     | T001, T002, T003, T004             | Four separate documents                      |
| 3     | T008, T009, T010                   | Test files; T014 is a fifth (style bible)    |
| 4     | T022 ∥ T025                        | Cue tests and badge tests are separate files |
| 6/7   | T037, T039, T040, T041, T042, T043 | All independent documents and files          |

---

## Implementation Strategy

**MVP is US2 — the boundary rope (Phase 1 → 2 → 3).** It is the smaller half of the
maintainer's request, it is an L-0 correction rather than a preference, it improves
every course immediately, and the spec itself calls it "shippable on its own". It
also lands the change with the highest blast radius — a renderer edit on the object
that kills people — behind the freeze gate and the golden tests, where it is cheapest
to be wrong.

**Then US1, then stop and hand it to the player.** Phase 5 is placed where it is
deliberately. A coached section that reads well in a diff and badly at speed is the
exact failure Principle VIII exists to catch, and 2.19 s of flip-cue reading time is a
figure that is _close_ to its target and therefore exactly the kind that only play can
settle. Everything after Phase 5 is documentation and gates, none of which teaches
anybody anything about whether the feature works.

**Do not apply R7's 30-unit lead fallback before the play pass.** It is recorded so
that it is available, not so that it is applied. Build the simple thing, ride it, then
decide.
