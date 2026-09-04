---
description: 'Task list for feature 003 — two recorded music tracks, looping forever'
---

# Tasks: Two Recorded Tracks, Looping Forever

**Input**: Design documents from `/specs/003-recorded-music-tracks/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/audio.md](contracts/audio.md),
[quickstart.md](quickstart.md)

**Tests**: Included. The spec defines testable success criteria (SC-039…SC-049) and
[contracts/audio.md](contracts/audio.md#test-obligations) names the proof obligation
for each of the nine guarantees. Constitution Principle II makes the resilience tests
a merge blocker rather than a nicety.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on incomplete work
- **[Story]**: The user story this task serves (US1, US2, US3)
- Every task names its file path and traces to a numbered requirement

## Path Conventions

Single project, paths from the repository root: `src/`, `tests/`, `data/`, `public/`,
`assets/`, `tools/`, `docs/`. Structure per [plan.md](plan.md#source-code-repository-root).

---

## Phase 1: Governance (BLOCKING — merge gate, no code)

**Purpose**: This feature is unmergeable until these land, and none of them depends on
a line of code. Sequenced first deliberately: a prerequisite with no code dependency is
the kind that gets deferred and then forgotten, and writing the amendment before the
implementation means it is written from intent rather than back-fitted to whatever got
built.

**Gate**: FR-052 rejects any asset that cannot cite a style-bible rule. Until T001 and
T002 land, both shipped music files are unreviewable regardless of how well they play.

- [x] T001 Amend rule A-1 in `assets/style-bible.md` to permit original recorded music alongside runtime synthesis, keeping "no licensed or third-party material of any kind", per FR-147
- [x] T002 Amend rule A-2 in `assets/style-bible.md` to scope its instrument set (two pulse leads, triangle bass, noise percussion) explicitly to synthesised audio, so recorded music is outside it rather than in breach of it, per FR-147
- [x] T003 Add a rule to the audio section of `assets/style-bible.md` that recorded music must cite its provenance record, so the new assets have a rule to cite at review per FR-052 and FR-148
- [x] T004 Write `docs/adr/0009-recorded-music.md` recording the A-1 reversal — what A-1 said, why it said it (the payload and originality argument in `src/audio/synth.ts`), what changed, and what stays synthesised — per FR-147
- [x] T005 [P] Correct T095 in `specs/001-shredpocalypse-bed-draft/tasks.md`: un-tick it, note that the gesture gate landed in `src/main.ts` as `armAudioOnFirstGesture()` and that `src/audio/gate.ts` was never created, and that the persistence half is deferred per this feature's Known deviations
- [x] T006 [P] Add the FR-054 / A-3 mute-persistence gap to the constitution's open-deviations list in `.specify/memory/constitution.md`, with the owner and rationale already recorded in [spec.md](spec.md#known-deviations)

**Checkpoint**: `grep -n "A-1\|A-2" assets/style-bible.md` shows recorded music
permitted; `docs/adr/0009-*.md` exists; T095 is `[ ]`. This is step 0 of
[quickstart.md](quickstart.md).

---

## Phase 2: Assets (BLOCKING — nothing audible works without these)

**Purpose**: Produce and measure the shipped files. Every downstream task assumes they
exist at known sizes with known loop offsets.

**Requires**: `ffmpeg`, which is **not** available in the environment this plan was
written in. This phase needs a machine that has it.

- [ ] T007 Write `tools/encode-audio.sh` transcoding both masters in `assets/audio/masters/` to mono ~96 kbps MP3 in `public/audio/`, printing input and output sizes for each, per FR-150 and R10
- [ ] T008 Run `tools/encode-audio.sh` verbatim and inspect its printed output — not merely its exit code — producing `public/audio/look-out-below.mp3` and `public/audio/powder-rush.mp3`, per Principle VII
- [ ] T009 Verify the two shipped files total at or under 4 MiB (4194304 bytes) and record the actual figure; if breached, trim Powder Rush rather than dropping bitrate, per SC-049 and R1
- [ ] T010 Measure the leading and trailing encoder silence in the shipped `public/audio/look-out-below.mp3` and derive `loopStart`/`loopEnd` just inside it, per FR-137, SC-040 and R3
- [ ] T011 Create `data/audio.json` declaring both music tracks — id, file, context, gain, and Look Out Below's measured loop offsets — using the shape in [contracts/audio.md](contracts/audio.md#data-contract), per FR-149 and R7
- [ ] T012 [P] Update `assets/audio/README.md` with the encode command, the shipped file sizes measured in T009, and the note that re-encoding invalidates the loop offsets in T010

**Checkpoint**: `du -cb public/audio/*.mp3` is at or under 4 MiB, and `data/audio.json`
carries measured offsets rather than placeholders.

---

## Phase 3: Foundational (BLOCKING — both stories build on these)

**Purpose**: The manifest reaches the app validated, and the player's surface exists
with the failure semantics that make everything downstream safe.

- [ ] T013 [P] Extend `assembleGameData` in `src/data/load.ts` to validate `data/audio.json` — both ids present exactly once, contexts covering `frontEnd` and `course` exactly once each, gain in range, loop offsets well-ordered — per the rules in [data-model.md](data-model.md#musictrack)
- [ ] T014 [P] Add `tests/unit/audio-manifest.test.ts` asserting the validator rejects a duplicate id, a missing context, an out-of-range gain, and `loopStart >= loopEnd`, per FR-149
- [ ] T015 Create `src/audio/music.ts` with the four-operation surface from [contracts/audio.md](contracts/audio.md#surface) — `arm`, `setContext`, `setMuted`, `destroy` — every one returning `void` and structurally unable to throw, per FR-143 and G6
- [ ] T016 Implement URL construction in `src/audio/music.ts` as `` `${import.meta.env.BASE_URL}audio/${track.file}` `` and nowhere else, per FR-146 and R5
- [ ] T017 [P] Add `tests/unit/music-player.test.ts` with fakes for `HTMLAudioElement` and the Web Audio nodes, since neither exists under jsdom, and assert nothing is audible before `arm()`, per FR-140 and G1

**Checkpoint**: `npm run test:unit` passes. No behaviour is player-visible yet.

---

## Phase 4: User Story 1 — The front-end has a theme (Priority: P1) 🎯 MVP

**Goal**: "Look Out Below" plays on every screen that is not a run, loops seamlessly
and indefinitely, and replaces the synthesised music loop.

**Independent test**: Open the app, make one gesture, confirm the piece plays; leave the
board open past 1:28 and confirm it restarts and continues without intervention.

- [ ] T018 [US1] Implement the decoded-buffer path in `src/audio/music.ts` — fetch, `decodeAudioData`, `AudioBufferSourceNode` with `loop = true` and `loopStart`/`loopEnd` from the manifest — per FR-135, FR-137 and R2
- [ ] T019 [US1] Route the buffer path through a `GainNode` at the manifest's gain, sharing the `AudioContext` the `Synth` already owns rather than creating a second one, per FR-141 and R6
- [ ] T020 [US1] Implement `setContext('frontEnd')` as idempotent in `src/audio/music.ts` — a repeat call while already in that context must not restart the piece — per FR-139 and G5
- [ ] T021 [US1] Call `music.arm()` from the existing `armAudioOnFirstGesture()` handler in `src/main.ts`, in the same handler that starts the `Synth` rather than a second listener, per FR-140 and caller obligation 1
- [ ] T022 [US1] Set the front-end context in `src/main.ts` on boot and after every return from a run, so the boot shell, board, official-run confirmation and results panel all share one continuous piece, per FR-135
- [ ] T023 [US1] Delete `scheduleLoop`, `tick`, `loopTimer`, `step` and `A_MINOR_PENTATONIC` from `src/audio/synth.ts`, keeping `start`, `cue`, `pulse`, `bass`, `noise` and `destroy` intact, per FR-135 and FR-141
- [ ] T024 [US1] Rewrite the class comment in `src/audio/synth.ts`, which currently argues for runtime synthesis over audio files on payload and originality grounds — an argument this feature half overturns — per Principle I and R6
- [ ] T025 [P] [US1] Extend `tests/unit/music-player.test.ts` to assert the front-end piece loops with `loop = true` and the manifest's offsets applied, per FR-137
- [ ] T026 [P] [US1] Assert in `tests/unit/music-player.test.ts` that repeated `setContext('frontEnd')` does not restart the source, per FR-139 and SC-042

**Checkpoint**: US1 is independently demonstrable. Music plays on the board, loops, and
survives screen changes. The synth loop is gone; the cues are not.

---

## Phase 5: User Story 2 — The course has a theme (Priority: P2)

**Goal**: "Powder Rush" plays for the duration of a run and hands back cleanly.

**Independent test**: Start a practice run, confirm Powder Rush is what plays; finish or
wipe out and confirm the front-end piece returns.

- [ ] T027 [US2] Implement the streamed-element path in `src/audio/music.ts` using `HTMLAudioElement` with `loop = true`, deliberately not `createMediaElementSource`, per FR-136 and R2/R8
- [ ] T028 [US2] Implement the `frontEnd` ↔ `course` transition in `src/audio/music.ts` so the outgoing source is stopped before the incoming one starts, making two-at-once structurally impossible, per FR-138 and G2
- [ ] T029 [US2] Call `setContext('course')` in `startRun()` in `src/main.ts` when the run's view is created, for all three run kinds — practice, official and free play — per FR-136
- [ ] T030 [US2] Call `setContext('frontEnd')` in `endRun()` in `src/main.ts` **after** `await finale` and the view teardown, not when the score commits, so the course piece carries the wipeout sequence, per FR-135 and caller obligation 2
- [ ] T031 [P] [US2] Assert in `tests/unit/music-player.test.ts` that every context transition stops the outgoing source before starting the incoming one, per FR-138 and SC-041
- [ ] T032 [P] [US2] Assert in `tests/unit/music-player.test.ts` that entering `course` twice in succession restarts the course piece from its beginning, per US2 acceptance scenario 5

**Checkpoint**: Both stories work. A full session — board, run, wipeout, results, board
— plays the right piece throughout and never two at once.

---

## Phase 6: User Story 3 — Music never gets in the way (Priority: P3)

**Goal**: The music is the first thing to give up, and the run is never the thing that
breaks.

**Independent test**: Block every audio request and drive a full official run; it must
start, play, end, and commit its score.

- [ ] T033 [US3] Handle the rejected `HTMLAudioElement.play()` promise in `src/audio/music.ts` so autoplay refusal never reaches the global handlers installed by `installGlobalErrorHandlers()`, per FR-143 and R9
- [ ] T034 [US3] Swallow fetch and `decodeAudioData` failures in `src/audio/music.ts` into a valid silent state, with no retry loop and no path to `showFatalError`, per FR-143 and G6
- [ ] T035 [US3] Ensure a run starting before its piece has arrived proceeds without waiting, the music joining late or not at all, per FR-143 and SC-043
- [ ] T036 [US3] Implement `setMuted` in `src/audio/music.ts` to silence and resume without restarting, and fan the mute button in `src/main.ts` out to both the `Synth` and the music player from one call site, per FR-140, SC-047 and caller obligation 3
- [ ] T037 [P] [US3] Assert in `tests/unit/music-player.test.ts` that a rejected `play()`, a 404, and a decode error each leave a valid silent state and throw nothing, per FR-143 and G6
- [ ] T038 [P] [US3] Assert in `tests/unit/music-player.test.ts` that one `setMuted` silences both audio paths and that unmuting resumes rather than restarts, per SC-047 and G7
- [ ] T039 [US3] Add `tests/e2e/music-never-blocks.spec.ts` blocking every `*.mp3` request and driving a full official run to a committed score, asserting no error boundary and no fatal message, per FR-143 and SC-043
- [ ] T040 [US3] Add `tests/e2e/music-base-path.spec.ts` asserting both files return 200 from `/ski-game/audio/…` against the **built artifact** served at `/ski-game/`, entered with no trailing slash, per FR-146, R5 and Principle VI
- [ ] T041 [US3] Extend the determinism check so a run from the same seed and inputs produces an identical score and outcome with music playing, muted, and unavailable, per FR-144 and SC-046
- [ ] T042 [P] [US3] Assert no import path reaches `src/audio/` from `src/sim/`, keeping the simulation structurally unable to observe playback state, per FR-144 and G8

**Checkpoint**: Every guarantee in [contracts/audio.md](contracts/audio.md#test-obligations)
has its proof, except the two that only a human ear can give.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T043 Verify no `.mp3` appears under `dist/assets/` after `npm run build`, confirming both pieces are copied from `public/` and outside the bundle graph, per FR-146 and SC-044
- [ ] T044 Measure and record initial payload gzipped and time to interactive on Fast 3G with a cold cache, confirming both are unchanged from before this feature, per SC-044
- [ ] T045 Measure and record frame time p95, sustained fps, simulation step time, and peak JS heap during a run at 4× CPU throttle, confirming decoded audio accounts for roughly 16.9 MB and not 59 MB, per FR-145, SC-045 and R2
- [ ] T046 Walk the eight-row scenario table in [quickstart.md](quickstart.md) against the built artifact at `http://localhost:4173/ski-game` with no trailing slash, recording the command and environment in the change description, per Definition of Done item 7
- [ ] T047 Listen through the front-end loop join five consecutive times on the shipped encode and confirm no gap, click, or stutter, per SC-040 and G4
- [ ] T048 Play a full session end to end on a phone and record findings against this spec, settling the two questions only listening can answer — 96 vs 64 kbps, and whether the cues stay audible over the music — per Principle III, FR-141 and Definition of Done item 6
- [ ] T049 [P] Confirm every shipped audio asset cites the style-bible rule it satisfies, with zero assets carried as documented exceptions, per FR-052 and SC-048
- [ ] T050 [P] Update the audio paragraph of `README.md` if it describes audio as synthesised at runtime, so the repository's own description does not contradict what ships
- [ ] T051 [P] Confirm at review that neither music track carries information a player needs to complete a run or read the standings — a run must be equally completable and scoreable in silence — per FR-142 and SC-043

---

## Dependencies

```text
Phase 1 (Governance)  ──────┐   merge gate; no code depends on it,
  T001…T006                 │   which is exactly why it is first
                            │
Phase 2 (Assets)  ──────────┼──► T007 → T008 → T009
  needs ffmpeg              │            └─► T010 → T011 → T012
                            │
Phase 3 (Foundational) ─────┴──► T013,T014 [P]
  needs T011 (manifest)          T015 → T016 → T017

        ┌──────────────────────────────┐
        ▼                              │
Phase 4 — US1 (P1)  T018 → T019 → T020 → T021 → T022 → T023 → T024
        │                                        T025,T026 [P]
        ▼
Phase 5 — US2 (P2)  T027 → T028 → T029 → T030 ; T031,T032 [P]
        │
        ▼
Phase 6 — US3 (P3)  T033…T036 → T037,T038,T042 [P] → T039,T040,T041
        │
        ▼
Phase 7 (Polish)    T043 → T044,T045 → T046 → T047 → T048 ; T049,T050,T051 [P]
```

**Story independence**: US1 stands alone and is the MVP. US2 depends on US1 only for
the shared player surface built in Phase 3, not for anything in Phase 4 — the two
context paths are independent once T015 exists. US3 hardens both and is meaningful only
after them.

**Hard ordering**: Phase 1 gates the **merge**, not the work — Phases 2 onward can
proceed in parallel with it, but nothing ships until it lands. Phase 2 gates everything
audible. T010 must run against the shipped encode produced by T008, never the master.

## Parallel execution examples

**Phase 1** — T005 and T006 are independent documentation corrections in different
files, parallel with each other and with T001–T004.

**Phase 3** — T013 and T014 (manifest validation and its test) run parallel to T015–T017
(player surface); different files, no shared state.

**Phase 4** — T025 and T026 are both assertions in the same test file, so run them
together but land them as one change.

**Phase 6** — T037, T038 and T042 are independent of each other and of the three e2e
tasks, which share Playwright and are best run in sequence.

**Phase 7** — T049, T050 and T051 are review and documentation checks, parallel with
everything.

## Implementation strategy

**MVP is Phase 1 + Phase 2 + Phase 3 + Phase 4.** That delivers the change actually
asked for — the landing music replaced with Look Out Below, looping forever — and is
mergeable, because Phase 1 is included. Stopping there leaves runs playing no music,
which is a coherent state rather than a broken one.

**Increment 2 is Phase 5**: the course gets its theme, completing the feature as
specified.

**Increment 3 is Phase 6 + 7**, and it is not optional. Principle II makes "music never
breaks a run" a merge blocker, and Principle VI makes the base-path test the difference
between this working and appearing to work. Audio 404s produce no visible symptom, so
T040 is the only thing standing between a silent production failure and noticing it.

**The two tasks most likely to be skipped**, and why they are not skippable:

- **T005** (un-tick T095) survives the mute-persistence deferral, because it is a
  documentation correction rather than the implementation that was deferred. The
  constitution treats citing a check that did not run as a defect of the same severity
  as the bug it conceals.
- **T010** (measure loop offsets on the shipped encode). Shipping the placeholder
  offsets in `data/audio.json` produces exactly the audible seam SC-040 forbids, on the
  one piece whose loop every player hears repeatedly.
