---

description: "Task list for Shredpocalypse '86 — Bed-Pick Draft"
---

# Tasks: Shredpocalypse '86 — Bed-Pick Draft

**Input**: Design documents from `/specs/001-shredpocalypse-bed-draft/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: Included. Not optional here — the spec mandates them (FR-050, FR-062, SC-016) and constitution Definition of Done item 2 requires automated coverage including a determinism test for any simulation change.

**Organization**: Grouped by user story so each can be implemented, tested, and delivered independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on incomplete work
- **[Story]**: The user story this serves (US1–US6)

## Path Conventions

Single static web application per [plan.md](plan.md): `src/`, `data/`, `assets/`, `tests/`, `supabase/` at repository root.

## Two ordering constraints that are not negotiable

These come from the plan's Constitution Check and Complexity Tracking. Violating either produces work that has to be redone:

1. **The style bible (T011) precedes every asset.** Principle IV's gate passes only if the bible is the source of truth when assets are authored, not documentation backfilled afterward.
2. **The course validator (T024) precedes every course file (T027, T028).** FR-089 and SC-016 exist because a badly placed low obstacle makes the run unfinishable and is invisible to review. Authoring courses first means the rule gets violated before anything can catch it.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and toolchain

- [X] T001 Create the directory structure from plan.md in `src/`, `data/`, `assets/`, `tests/`, `supabase/`
- [X] T002 Initialize TypeScript strict-mode project with Vite in `package.json`, `tsconfig.json`, `vite.config.ts`
- [X] T003 [P] Add PixiJS v8 and the Supabase JS client as the only runtime dependencies in `package.json`
- [X] T004 [P] Configure ESLint and Prettier in `eslint.config.js`
- [X] T005 Add the simulation arithmetic lint rule banning `Math.*`, `Date.*`, and `performance.*` under `src/sim/**` in `eslint.config.js`
- [X] T006 [P] Configure Vitest in `vitest.config.ts`
- [X] T007 [P] Configure Playwright for Chromium, Firefox, and WebKit in `playwright.config.ts`, using the preinstalled browsers without calling `playwright install`
- [X] T008 [P] Configure Git LFS for binary sprite atlases in `.gitattributes`
- [X] T009 [P] Add the CI workflow running lint, unit, sim, course, and contract suites in `.github/workflows/ci.yml`
- [X] T010 [P] Add the GitHub Pages deploy workflow in `.github/workflows/deploy.yml`
- [X] T011 [P] Add Supabase environment configuration and `.env.example` documenting the public URL and anon key

**Checkpoint**: `npm install && npm run lint && npm test` runs clean on an empty suite.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The spine every user story rests on — the deterministic simulation, the course pipeline, the storage invariants, and the style authority

**⚠️ CRITICAL**: No user story work begins until this phase completes. The P1 story is a full vertical slice of a game; there is no smaller foundation that supports it.

### Style authority — before any asset exists

- [X] T012 Write the style bible covering palette, linework weight, halftone and scanline treatment, chrome and neon lettering, panel framing, audio character, and the legibility-outranks-style rule in `assets/style-bible.md`
- [X] T013 [P] Validate the style bible palette against protanopia, deuteranopia, and tritanopia and record results in `assets/style-bible.md`, with an automated contrast check in `tests/unit/palette.test.ts`

### Deterministic simulation core

- [X] T014 [P] Implement the seeded PRNG in `src/sim/rng.ts`
- [X] T015 [P] Generate the trigonometry lookup table with `tools/gen-trig.ts`, output committed to `src/sim/trig.ts`
- [X] T016 [P] Define simulation state and input types from data-model.md in `src/sim/types.ts`
- [X] T017 Implement semi-implicit Euler integration with piecewise-linear slope contact in `src/sim/physics.ts`
- [X] T018 Implement crouch charge, launch impulse, and the release-under-low-obstacle wipeout per FR-088 in `src/sim/physics.ts`
- [X] T019 Implement airborne rotation, rotation accumulation, and landing angle tolerance in `src/sim/physics.ts`
- [X] T020 Implement the pure `step(state, input) → state` entry point in `src/sim/step.ts`
- [X] T021 [P] Implement base, trick, and pickup score accumulation in `src/sim/scoring.ts`
- [X] T022 Record a golden seed and input trace and assert exact score and end-state hash in `tests/sim/golden.test.ts`
- [X] T023 [P] Fuzz randomised input across thousands of seeds asserting no throw, no non-finite state, and a terminal state per FR-062 in `tests/sim/monkey.test.ts`

### Course pipeline — validator before content

- [X] T024 [P] Define the course schema types from contracts/course-data.md in `src/course/types.ts`
- [X] T025 Implement validator rules CV-1 through CV-9, with CV-4's safe-release-window check per FR-089, in `src/course/validate.ts`
- [X] T026 Cover every validator rule including deliberately invalid fixtures in `tests/course/validate.test.ts`
- [X] T027 Implement the course loader in `src/course/load.ts`
- [X] T028 Author the warm-up course, validator passing, in `data/courses/warmup.json`
- [X] T029 Author the official course, validator passing, in `data/courses/official.json`

### Tuning and scoring data

- [X] T030 [P] Transcribe every parameter and tolerance from contracts/tuning-data.md into `data/tuning.json`
- [X] T031 [P] Define base, trick, and pickup values in `data/scoring.json`
- [X] T032 [P] Assert the completion base exceeds the maximum achievable bonus total per FR-034 in `tests/unit/scoring-dominance.test.ts`
- [X] T033 [P] Write at least 30 wipeout lines, R-rated register, no slurs or protected-characteristic content, in `data/insults.json`
- [X] T034 Implement data-file loading with schema validation in `src/data/load.ts`

### Shared storage

- [ ] T035 Create tables for draft, roster entry, and committed score in `supabase/migrations/0001_init.sql`
- [ ] T036 Add the unique constraints, roster cap trigger, server-assigned `commit_at`, and insert-only RLS policies from contracts/storage-api.md in `supabase/migrations/0002_policies.sql`
- [ ] T037 Implement the storage client covering the player operations in contracts/storage-api.md in `src/state/supabase.ts`
- [ ] T038 Assert every server-enforced invariant by attempting violations directly against the API in `tests/contract/storage.test.ts`
- [ ] T039 [P] Assert schema migrations round-trip without corrupting committed scores per FR-050 in `tests/contract/migration.test.ts`

### Rendering and input base

- [ ] T040 Implement the fixed 320×180 buffer with integer nearest-neighbour upscaling in `src/render/stage.ts`
- [ ] T041 Implement the fixed-timestep accumulator loop with render interpolation in `src/render/loop.ts`
- [ ] T042 [P] Implement keyboard input with full remapping per FR-030 in `src/input/keyboard.ts`
- [ ] T043 [P] Implement one-handed touch input for crouch/launch, rotate, and attack per contracts/controls.md in `src/input/touch.ts`
- [ ] T044 Sample input once per simulation tick, not per animation frame, in `src/input/sample.ts`
- [ ] T045 [P] Assert input-to-visible-response within 2 simulation frames per FR-031 in `tests/e2e/latency.spec.ts`

**Checkpoint**: A run is simulable and renderable end to end from a seed and an input trace. Determinism, monkey, course, and storage-contract suites all pass. No user-facing flow exists yet.

---

## Phase 3: User Story 1 — Claim your name and commit the one run that counts (Priority: P1) 🎯 MVP

**Goal**: A player opens the link, claims a name, takes three practice runs on the warm-up course, commits one official run whose score locks irreversibly, and sees his rank.

**Independent test**: With a roster provisioned by any means, open the link on a phone, claim a name, use three practice runs, commit an official run, and confirm the score appears on a leaderboard ranked with rank 1 labelled first bed pick — and that no path exists to run officially again.

- [ ] T046 [P] [US1] Implement roster listing and claim state display in `src/ui/roster.ts`
- [ ] T047 [US1] Implement name claiming with first-write-wins race handling per FR-012 in `src/state/claims.ts`
- [ ] T048 [US1] Implement same-device identity resumption per FR-010 in `src/state/identity.ts`
- [ ] T049 [US1] Implement the run economy — three practice, one official, skip-practice-forfeits-unused per FR-013 to FR-015 in `src/state/runEconomy.ts`
- [ ] T050 [US1] Implement the official-run confirmation gate stating the run counts once and cannot be retaken per FR-016 in `src/ui/officialConfirm.ts`
- [ ] T051 [US1] Wire the warm-up course to practice runs and the official course to the official run, keeping the official course unreachable before commit per FR-068 in `src/ui/runFlow.ts`
- [ ] T052 [US1] Implement irreversible commit on both finish and wipeout per FR-017 in `src/state/commit.ts`
- [ ] T053 [P] [US1] Implement the leaderboard with rank, name, score, status, and the rank-1-picks-first label per FR-040, FR-041 in `src/ui/leaderboard.ts`
- [ ] T054 [P] [US1] Implement free play after commit, visibly labelled as not counting, per FR-020 in `src/ui/freePlay.ts`
- [ ] T055 [P] [US1] Author skier, terrain, obstacle, and barrier sprites to the style bible, each citing the rule it satisfies per FR-052, in `assets/sprites/`
- [ ] T056 [P] [US1] Implement the run HUD showing score, run type, and runs remaining in `src/ui/hud.ts`
- [ ] T057 [US1] Assert the full claim-to-commit journey and that no retake path exists, per US1 acceptance scenarios 1–8, in `tests/e2e/us1-claim-and-commit.spec.ts`
- [ ] T058 [P] [US1] Assert a first-time player finishes using only base speed and crouch-to-duck with no tricks per SC-015 in `tests/e2e/us1-cautious-run.spec.ts`

**Checkpoint**: The draft is playable and decides a bed order. This is the MVP.

---

## Phase 4: User Story 2 — One official run per name, no matter the device (Priority: P2)

**Goal**: Run counts and commits survive device switching, private windows, and cleared site data.

**Independent test**: Commit on device A, then open the link on device B, in a private window, and after clearing site data on device A; all three show the committed score and offer only free play.

- [ ] T059 [US2] Implement cross-device identity recovery by name re-selection per FR-011 in `src/state/identity.ts`
- [ ] T060 [US2] Route all run counts and claims through shared storage, with no device-local read path, per FR-021 in `src/state/runEconomy.ts`
- [ ] T061 [US2] Implement duplicate-commit rejection surfacing "already committed" without retry per contracts/storage-api.md in `src/state/commit.ts`
- [ ] T062 [US2] Implement abandonment detection and the public abandoned-run counter per FR-019, FR-065 in `src/state/abandonment.ts`
- [ ] T063 [P] [US2] Ensure abandoned practice runs do not consume a practice run per FR-066 in `src/state/runEconomy.ts`
- [ ] T064 [P] [US2] Display the abandonment count on the leaderboard per FR-065, SC-013 in `src/ui/leaderboard.ts`
- [ ] T065 [US2] Assert device switching, private windows, and cleared storage grant no additional runs, per US2 acceptance scenarios, in `tests/e2e/us2-one-run-per-name.spec.ts`
- [ ] T066 [P] [US2] Assert abandonment discards the run, leaves the official run unused, and increments the visible counter in `tests/e2e/us2-abandonment.spec.ts`

**Checkpoint**: The one-run rule holds across every device path.

---

## Phase 5: User Story 3 — The organizer sets up the draft and shares one link (Priority: P2)

**Goal**: The organizer defines a roster and deadline and gets one player link; anyone with that link can add a name; the organizer keeps removal and reset powers on a separate URL.

**Independent test**: Create a roster and deadline through the organizer flow, open the player link in a clean browser, and confirm the roster and deadline appear exactly as entered.

- [ ] T067 [US3] Implement organizer draft creation with initial roster and deadline per FR-001, FR-004 in `src/ui/organizer/setup.ts`
- [ ] T068 [US3] Implement player link generation and the separate organizer URL per FR-005, FR-006 in `src/state/links.ts`
- [ ] T069 [US3] Implement self-serve entry creation, claimed in the same action, with cap and duplicate handling per FR-070, FR-072, FR-008 in `src/ui/roster.ts`
- [ ] T070 [P] [US3] Display organizer-created versus self-created provenance per FR-073 in `src/ui/leaderboard.ts`
- [ ] T071 [US3] Implement organizer removal of uncommitted entries and claim release per FR-007 in `src/ui/organizer/manage.ts`
- [ ] T072 [US3] Implement organizer removal of committed entries behind confirmation naming the discarded score, recorded and left visible per FR-074 in `src/ui/organizer/manage.ts`
- [ ] T073 [P] [US3] Refuse renaming any entry with a committed score per FR-075 in `src/ui/organizer/manage.ts`
- [ ] T074 [P] [US3] Implement draft reset destroying all committed scores in `src/ui/organizer/manage.ts`
- [ ] T075 [US3] Assert organizer controls are unreachable from the player link and that self-serve creation works, per US3 acceptance scenarios 1–6, in `tests/e2e/us3-organizer.spec.ts`

**Checkpoint**: A draft can be created, shared, and administered without developer intervention.

---

## Phase 6: User Story 4 — The deadline produces the final bed order (Priority: P2)

**Goal**: At the deadline the leaderboard freezes as FINAL, ties break by commit time, and unplayed entries sink to an unordered forfeit group.

**Independent test**: Set a near-future deadline with some entries uncommitted, wait past it, and confirm FINAL, refused commits, and forfeits grouped without an implied order.

- [ ] T076 [US4] Implement server-side deadline enforcement rejecting commits after the deadline per FR-043 in `supabase/migrations/0003_deadline.sql`
- [ ] T077 [US4] Allow a run started before the deadline to finish and commit after it per FR-044 in `src/state/commit.ts`
- [ ] T078 [US4] Implement the FINAL leaderboard state per FR-043 in `src/ui/leaderboard.ts`
- [ ] T079 [US4] Implement tie-breaking by earlier server-assigned `commit_at` per FR-037 in `src/ui/ordering.ts`
- [ ] T080 [US4] Display surviving ties as unresolved and flagged for coin flip per FR-038 in `src/ui/ordering.ts`
- [ ] T081 [US4] Place uncommitted entries below all scores as an unordered FORFEIT group with the coin-flip instruction, assigning no order, per FR-045 in `src/ui/ordering.ts`
- [ ] T082 [P] [US4] Warn the organizer before applying an already-elapsed deadline per FR-004 in `src/ui/organizer/setup.ts`
- [ ] T083 [US4] Assert FINAL state, tie-breaking, and that no order is implied among forfeits, per US4 acceptance scenarios, in `tests/e2e/us4-deadline.spec.ts`

**Checkpoint**: The leaderboard is an authoritative bed order the group can act on.

---

## Phase 7: User Story 5 — A bad signal never eats a score (Priority: P3)

**Goal**: A commit made without connectivity queues, survives restart, and posts on reconnect, never silently vanishing.

**Independent test**: Disable connectivity before a run ends; confirm pending state, survival across reload and browser restart, then posting on reconnect.

- [ ] T084 [US5] Implement the IndexedDB commit outbox as a write-only transport buffer per FR-046, FR-048 in `src/state/outbox.ts`
- [ ] T085 [US5] Implement exponential-backoff retry capped at 60s, halting on duplicate rejection, per contracts/storage-api.md in `src/state/outbox.ts`
- [ ] T086 [US5] Implement the pending-versus-confirmed UI distinction that never claims a leaderboard place before confirmation per FR-047 in `src/ui/commitStatus.ts`
- [ ] T087 [US5] Implement the service worker precaching app shell, course, tuning, and assets for fully offline runs per FR-049 in `src/sw.ts`
- [ ] T088 [P] [US5] Assert no run count, claim, or score is ever read back from the outbox per FR-021 in `tests/unit/outbox-not-authoritative.test.ts`
- [ ] T089 [US5] Assert offline commit queues, survives reload and restart, and posts on reconnect, per US5 acceptance scenarios, in `tests/e2e/us5-offline-commit.spec.ts`

**Checkpoint**: The one irreversible action is durable against the connectivity it will actually meet.

---

## Phase 8: User Story 6 — It looks and sounds like 1986 (Priority: P3)

**Goal**: Full period presentation — neon, chrome, scanlines, synthwave, insults — without sacrificing legibility or accessibility.

**Independent test**: Play a full run and confirm the style bible's rules are visibly followed, audio is silent until first interaction, and reduced motion leaves the run fully playable.

- [ ] T090 [P] [US6] Implement the scanline and halftone post-process shaders in `src/render/filters/scanline.ts` and `src/render/filters/halftone.ts`
- [ ] T091 [P] [US6] Implement neon bloom and chromatic fringing shaders in `src/render/filters/bloom.ts`
- [ ] T092 [P] [US6] Implement chrome and neon title lettering in `src/ui/titles.ts`
- [ ] T093 [P] [US6] Implement comic-idiom panels, gutters, and caption boxes for menus and transitions per FR-053 in `src/ui/panels.ts`
- [ ] T094 [US6] Implement Web Audio chiptune and synthwave synthesis, original by construction, in `src/audio/synth.ts`
- [ ] T095 [US6] Gate audio behind the first deliberate gesture with a persistent mute toggle per FR-054 in `src/audio/gate.ts`
- [ ] T096 [P] [US6] Display randomised wipeout insults drawn from the data file per FR-059 in `src/ui/wipeout.ts`
- [ ] T097 [US6] Implement the reduced-motion option disabling scanlines, shake, flashing, and parallax without changing timing per FR-056 in `src/render/reducedMotion.ts`
- [ ] T098 [P] [US6] Assert no effect flashes more than three times per second across a large screen area per FR-057 in `tests/e2e/us6-flash-limit.spec.ts`
- [ ] T099 [P] [US6] Assert every audio cue carrying gameplay information has a visible equivalent per FR-058 in `tests/e2e/us6-audio-parity.spec.ts`
- [ ] T100 [US6] Assert style-bible conformance, gesture-gated audio, and reduced-motion playability, per US6 acceptance scenarios, in `tests/e2e/us6-presentation.spec.ts`

**Checkpoint**: The game reads as 1986 and remains legible and accessible.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T101 Measure and enforce the R1 budgets under 4× CPU throttle and Fast 3G in `tests/e2e/performance.spec.ts`
- [ ] T102 [P] Assert median phone scores fall within 10% of desktop for comparable skill per SC-006 in `tests/e2e/parity.spec.ts`
- [ ] T103 [P] Assert no information required to complete a run or read standings is conveyed by colour alone per FR-055 in `tests/e2e/color-independence.spec.ts`
- [ ] T104 [P] Verify no player-facing copy or documentation claims standings are verified or tamper-proof per FR-069, SC-014 in `tests/unit/no-verified-claims.test.ts`
- [ ] T105 [P] Enforce rules-version pinning so a mid-draft physics or scoring change is refused rather than silently accepted per FR-023 in `src/state/rulesVersion.ts`
- [ ] T106 [P] Add empty, loading, and error states across roster, leaderboard, and run flows in `src/ui/states.ts`
- [ ] T107 Run the full suite and confirm every scenario in `specs/001-shredpocalypse-bed-draft/quickstart.md` passes, recording results in `specs/001-shredpocalypse-bed-draft/quickstart.md`
- [ ] T108 Conduct the human playtest on a real mid-range phone, confirm the tuning acceptance criteria in contracts/tuning-data.md, and record findings against spec.md per Definition of Done item 6
- [ ] T109 Re-tune `data/tuning.json` from playtest findings, staying within tolerance or re-running acceptance scenarios if outside

---

## Dependencies

### Phase order

```
Setup (T001–T011)
   ↓
Foundational (T012–T045)  ← blocks everything
   ↓
US1 (T046–T058)  ← MVP, independently deliverable
   ↓
US2 (T059–T066) ─┐
US3 (T067–T075) ─┼─ independent of each other, all depend on US1
US4 (T076–T083) ─┤     (US4 depends on US3 for organizer deadline control)
US5 (T084–T089) ─┤
US6 (T090–T100) ─┘
   ↓
Polish (T101–T109)
```

### Critical intra-phase ordering

- **T012 before T013, T055, and all of US6.** The style bible is the source of truth; assets authored before it cannot cite the rule they satisfy, and Principle IV's gate fails.
- **T025 and T026 before T028 and T029.** The validator must be able to reject a course before any course exists, or FR-089 gets violated first and discovered by a friend saying the game is broken.
- **T017 → T018 → T019 → T020.** Physics builds up before `step()` composes it.
- **T022 after T020.** Golden runs need something to run.
- **T035 → T036 → T037 → T038.** Schema, then policies, then client, then invariant tests.
- **T076 before T077.** Server-side deadline enforcement before the client-side grace path.
- **T108 before T109.** Tuning changes follow playtest findings, not precede them.

### Story dependencies

US2 through US6 all build on US1's run flow. US4 additionally needs US3's organizer deadline control. Otherwise the four are mutually independent and can be built in any order or in parallel.

---

## Parallel Execution Examples

**Phase 1 setup** — T003, T004, T006, T007, T008, T009, T010, T011 all touch different files and can run together after T002.

**Phase 2 simulation core** — T014, T015, T016 are independent; T021 and T023 can proceed alongside the physics work once types exist.

**Phase 2 data files** — T030, T031, T032, T033 are four separate files with no interdependency.

**Phase 3 US1** — T053, T054, T055, T056 are independent of the commit path and of each other.

**Phase 8 US6** — T090, T091, T092, T093, T096 are separate render and UI modules; T098 and T099 are separate test files.

**Phase 9 polish** — T102, T103, T104, T105, T106 are all independent.

---

## Implementation Strategy

### MVP

**Phases 1–3 (T001–T058).** That delivers a playable draft that decides a bed order: claim a name, practise, commit one run, see the standings. Everything after it protects, administers, or beautifies that loop.

### Incremental delivery

1. **Foundation + US1** → a working draft. Ship here if time runs short.
2. **US2** → the one-run rule survives device switching. The first thing to add, because without it a determined player quietly invalidates the result.
3. **US3 + US4** → the organizer stops needing a developer, and the deadline produces an authoritative order.
4. **US5** → the score survives lodge wifi.
5. **US6** → it stops looking like a prototype.

### If the trip is close

Cut US6 to the style bible plus sprites already required by US1, and cut US5 to the outbox without the service worker. Do not cut US2: a draft whose one-run rule can be sidestepped by opening a private window is not a draft, and the guys will find that out faster than any bug.

### Constitution checkpoints

- After **T029**: courses validate, so FR-089 and SC-016 are enforceable from here on.
- After **T045**: determinism proven across three engines. Principle II and Principle V's surviving reproducibility clause are satisfied.
- After **T058**: MVP exists. Trunk-always-playable becomes binding from this commit forward.
- After **T108**: Definition of Done item 6 is satisfied, and not before. No automated process substitutes for it.
