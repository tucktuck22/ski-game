# Implementation Plan: Two Recorded Tracks, Looping Forever

**Branch**: `claude/session-start-qjf82j` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-recorded-music-tracks/spec.md`

## Summary

Replace the runtime-synthesised music loop with two recorded pieces: "Look Out Below"
on every screen that is not a run, "Powder Rush" while a run is in progress, each
looping from its beginning indefinitely. Sound effects stay synthesised, because they
carry gameplay information and are paired with visible equivalents under FR-058.

The technical approach turns on one measurement, made in
[research.md](research.md#r1--how-long-is-a-run-and-does-the-course-music-ever-loop):
**the longest possible run is 76.9 seconds and Powder Rush is 220.1 seconds, so the
course piece can never reach its loop point.** The two pieces therefore have opposite
needs. Look Out Below loops constantly on the board and must be genuinely gapless, so
it is decoded to an `AudioBuffer` and looped sample-accurately between offsets
measured inside the MP3's encoder padding. Powder Rush is streamed from an
`HTMLAudioElement`, which costs almost no memory and whose only weakness — an audible
seam at the loop — is at a point no player reaches. That split holds peak decoded
audio at 16.9 MB instead of 59.2 MB, and spends the smaller figure at the moment the
frame budget is tightest.

Neither file enters the initial payload. Both live under `public/audio/` and are
fetched at runtime from a URL built on `import.meta.env.BASE_URL` — the first code in
this repository to read it, and therefore the first opportunity to reintroduce the
base-path defect that already shipped a blank page to players once.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode, targeting ES2022. No new language
or runtime surface.

**Primary Dependencies**: None added. Web Audio API (`AudioContext`,
`AudioBufferSourceNode`, `GainNode`) and `HTMLAudioElement`, both already available;
`Synth` already owns the `AudioContext`. PixiJS and the Supabase client are untouched.

**Storage**: `localStorage` via the existing `safeStorage` wrapper, for the mute
preference only. No schema change, no migration, nothing added to Supabase or the
outbox.

**Testing**: Vitest for the player state machine, the `data/audio.json` validator, and
the mute-persistence round trip — all with `HTMLAudioElement` and Web Audio faked, as
neither exists under jsdom. Playwright for what only the real thing can prove: assets
resolving at the production base path, a run completing with the network blocked, and
the determinism assertion that a run's score is identical with music playing, muted,
and unavailable.

**Target Platform**: Evergreen mobile web — Safari on iOS 16+, Chromium and Firefox on
Android 10+, same engines on desktop. Reference hardware is a 2022-era mid-range phone.

**Project Type**: Static single-page web application. Unchanged.

**Performance Goals**: No regression. Frame time ≤ 16.7 ms p95 and simulation step
≤ 2.0 ms per tick must hold with music playing, and be no worse than 5% off the
pre-feature figures (SC-045).

**Constraints**: Initial payload ≤ 2 MB gzipped and time to interactive ≤ 5 s on Fast
3G, both **unchanged** by this feature rather than merely survived (FR-146, SC-044);
shipped audio ≤ 2 MiB transferred for the pair (FR-150, SC-049); peak JS heap
≤ 150 MB, against which decoded audio is now a named line item; music never blocks,
delays, or fails a run (FR-143).

**Scale/Scope**: Two audio assets, one new module, one modified module, one new data
file, one deleted method pair. Roughly 200 lines of production code. The governance
work around it is a comparable amount of prose and is not optional.

## Constitution Check

_GATE: evaluated before Phase 0 and re-evaluated after Phase 1 design. Both passes
below._

| Principle                                | Verdict           | Basis                                                                                                                                                                                                                                             |
| ---------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec-Driven Delivery (NON-NEGOTIABLE) | **PASS**          | Spec approved and clarified before this plan. Every task will trace to FR-135…FR-150. Order respected, unlike feature 002.                                                                                                                        |
| II. Stability Before Content             | **PASS, gated**   | FR-143/SC-043 make "music never breaks a run" testable; R9 fixes the mechanism. Determinism untouched (FR-144, SC-046). Frame and heap budgets accounted for in R2 and asserted by SC-045.                                                        |
| III. Fun Is a Testable Requirement       | **PASS**          | Mix gain and loop offsets are feel and measurement values, so they go in `data/audio.json`, not code (R7). Human playtest required for the 96-vs-64 kbps question, which reasoning cannot settle.                                                 |
| IV. One Coherent 1980s Voice             | **GATE — BLOCKS** | Style-bible **A-1 forbids sampled audio outright** and **A-2 fixes the instrument set**. Both must be amended, with an ADR, before merge. FR-052 rejects an asset that cannot cite a rule. This is the plan's hard prerequisite, not a follow-up. |
| V. Fair and Verifiable Competition       | **PASS**          | Audio is outside the simulation. No scoring, seeding, or leaderboard surface is touched.                                                                                                                                                          |
| VI. Shipped Artifact Is Truth (NON-NEG.) | **GATE**          | Audio URLs are the first `BASE_URL` consumers in this repository (R5). Verification MUST be against the built artifact at `/ski-game/`, entered with no trailing slash. A dev-server check is not evidence and MUST NOT be offered as one.        |
| VII. Operator Instructions (NON-NEG.)    | **GATE**          | The transcode command in `assets/audio/README.md` is operator-facing. It MUST be run verbatim and its **output inspected** — sizes and a listen — not merely exit zero.                                                                           |

**Performance budgets** (Technical Standards): initial payload and time-to-interactive
are held by FR-146's lazy loading; shipped bytes by FR-150; decoded-audio memory by
R2's mechanism split. The constitution records that **no budget job exists** — open
deviation 3. This feature is precisely what that job was meant to catch, so the
measurement is a task here regardless, done by hand and recorded.

**Accessibility**: unchanged and explicitly protected. Cues keep their visible
equivalents (FR-141, FR-058); music carries no information (FR-142); reduced motion is
untouched (FR-056 governs motion, not sound).

**Two pre-existing defects this feature must absorb**, both documented in
[R8](research.md#r8--mute-and-an-inherited-defect-this-feature-has-to-absorb):

1. **The mute toggle is not persistent**, though FR-054 and style-bible A-3 require it.
   SC-047 cannot pass without fixing it, so the fix is in scope.
2. **Feature 001's T095 is ticked against a file that does not exist**
   (`src/audio/gate.ts`). It must be un-ticked with a pointer to where the gesture gate
   actually landed. A task marked done against a missing file is the failure mode the
   constitution's stop condition exists for.

### Post-Phase-1 re-evaluation

Design added no new dependency, no new persistent state beyond one string, and no
simulation coupling. The verdicts above are unchanged. The single complexity
introduced — two playback mechanisms — is justified below rather than waved through.

## Project Structure

### Documentation (this feature)

```text
specs/003-recorded-music-tracks/
├── plan.md              # This file
├── spec.md              # Approved, clarified 2026-09-03
├── research.md          # Phase 0 — ten decisions, R1 reframes the rest
├── data-model.md        # Phase 1 — entities and the player state machine
├── quickstart.md        # Phase 1 — how to prove it works, against the built artifact
├── contracts/
│   └── audio.md         # Phase 1 — the music player's contract and data shape
├── checklists/
│   └── requirements.md  # Spec quality, 16/16
└── tasks.md             # Phase 2 — NOT created by /speckit-plan
```

### Source code (repository root)

```text
assets/audio/
├── README.md                        # provenance (FR-148), masters-vs-shipped, LFS status
└── masters/                         # committed, archive only, never loaded
    ├── look-out-below.master.mp3
    └── powder-rush.master.mp3

public/audio/                        # NEW — shipped assets, copied verbatim by Vite,
├── look-out-below.mp3               #   never imported, fetched via BASE_URL (R5)
└── powder-rush.mp3

data/
└── audio.json                       # NEW — manifest, mix gains, loop offsets (R7)

src/audio/
├── synth.ts                         # MODIFIED — music loop deleted, cues kept (R6)
├── music.ts                         # NEW — the two-context player (R2)
└── settings.ts                      # NEW — persistent mute, mirrors reducedMotion.ts (R8)

src/data/load.ts                     # MODIFIED — validate audio.json at load
src/main.ts                          # MODIFIED — context transitions, mute fan-out

tests/unit/
├── music-player.test.ts             # NEW — state machine, exclusivity, failure paths
└── audio-settings.test.ts           # NEW — mute persistence round trip
tests/e2e/
├── music-base-path.spec.ts          # NEW — assets resolve at /ski-game/ (Principle VI)
└── music-never-blocks.spec.ts       # NEW — run completes with audio requests blocked

assets/style-bible.md                # MODIFIED — A-1, A-2 amended (FR-147) — BLOCKING
docs/adr/0009-recorded-music.md      # NEW — records the A-1 reversal (FR-147) — BLOCKING
specs/001-.../tasks.md               # MODIFIED — un-tick T095 (R8)
tools/encode-audio.sh                # NEW — the documented transcode (R10, Principle VII)
```

**Structure Decision**: The existing layout already separates `src/audio/` from
`src/render/` and `src/sim/`, and this feature stays inside that seam entirely.
`music.ts` is a sibling of `synth.ts` rather than an extension of it because the two
have genuinely different lifetimes — the `Synth` owns the `AudioContext` and lives for
the session, while the music player switches sources as the player moves on and off
the course. `settings.ts` is separate from both because the mute preference outlives
either and is read before either exists.

## Phase sequencing

The governance work is not a parallel track that lands whenever. It gates the merge,
so it is sequenced first, where it is cheap to change.

1. **Governance** — amend style-bible A-1/A-2, write ADR-0009, un-tick T095. No code.
   Nothing below can merge without this, and doing it first means the amendment is
   written from intent rather than back-fitted to whatever got built.
2. **Assets** — transcode the masters, measure the loop offsets on the _shipped_ file,
   write `data/audio.json`, verify sizes against SC-049.
3. **Foundation** — `settings.ts` and its test; `load.ts` validation. Both independent
   of the player and of each other.
4. **US1 (P1)** — the front-end piece: `music.ts` buffer path, `main.ts` wiring, synth
   music loop deleted. Deliverable and demonstrable on its own.
5. **US2 (P2)** — the course piece: element path, run-start and run-end transitions.
6. **US3 (P3)** — failure paths, blocked-network e2e, determinism assertion, base-path
   e2e, and the by-hand budget measurement.
7. **Playtest** — required by Principle III and Definition of Done item 6, and the only
   way to settle 96 vs 64 kbps.

## Complexity Tracking

| Violation                                      | Why needed                                                                                                                                                                                                              | Simpler alternative rejected because                                                                                                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two playback mechanisms rather than one        | Gaplessness (SC-040) is only achievable with `AudioBufferSourceNode`; the 150 MB heap ceiling cannot absorb 59.2 MB of decoded audio. R1 shows the two pieces need opposite things, so one mechanism cannot serve both. | `HTMLAudioElement` for both is simpler and near-free on memory, but fails SC-040 on the one piece whose loop is actually heard. `AudioBufferSourceNode` for both is also simpler, but spends 39% of the heap ceiling on a loop join nobody reaches. |
| Fixing mute persistence inside a music feature | SC-047 requires the preference to survive a reload, and it does not today. The feature cannot pass its own success criteria while the defect stands.                                                                    | Deferring it to a separate change would leave this feature knowingly shipping a failing success criterion, which Principle I treats as a defect rather than a scheduling choice.                                                                    |

## Risks

- **SC-049 may not be reachable at 96 kbps without trimming.** Mono at 96 kbps projects
  to roughly 3.7 MiB for the pair, against a 2 MiB ceiling. Either Powder Rush is
  trimmed — which [R1](research.md#r1--how-long-is-a-run-and-does-the-course-music-ever-loop)
  shows costs nothing a player can perceive — or the bitrate drops to ~64 kbps, or
  SC-049 is amended. **This needs a decision before the transcode task runs**, and it
  is the one open question this plan cannot close by itself.
- **Silent 404s.** Audio that fails to load produces no visible symptom, by design
  (FR-143). That is correct behaviour and a bad debugging experience, and it is why the
  base-path e2e test is not optional.
- **`ffmpeg` is unavailable in the environment this plan was written in.** The
  transcode is an implementation-phase task requiring a machine that has it.
- **The style-bible amendment is a merge blocker with no code dependency**, which makes
  it exactly the kind of task that gets deferred and then forgotten. It is sequenced
  first for that reason.
