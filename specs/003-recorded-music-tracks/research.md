# Phase 0 Research: Two Recorded Tracks, Looping Forever

**Feature**: [spec.md](spec.md) | **Date**: 2026-09-04

Ten decisions. The first one reframes the rest, so it is first.

---

## R1 — How long is a run, and does the course music ever loop?

**Decision**: The course piece never reaches its loop point in practice. Design for
that, but still implement the loop, because FR-137 requires it and it costs nothing.

**Evidence**: from `data/courses/*.json` and `data/tuning.json`, measured rather than
assumed:

| Course             | Length | Speed range (units/tick) | Ticks at 60 Hz | Wall time     |
| ------------------ | ------ | ------------------------ | -------------- | ------------- |
| `warmup` (3200)    | 3200   | 2.6 – 4.2                | 762 – 1231     | 12.7 – 20.5 s |
| `official` (12000) | 12000  | 2.6 – 4.2                | 2857 – 4615    | 47.6 – 76.9 s |

The slowest possible official run — `baseSpeed` 2.6 held the whole way, never
tucking — is **76.9 seconds**. Powder Rush is **220.1 seconds**. A player hears at
most the first **35%** of it, and only ever the beginning.

**What this changes**: the two pieces have completely different loop behaviour, and
therefore completely different engineering needs.

- **Look Out Below** (87.8 s) plays on the board while people read the standings,
  wait out the countdown, and argue about bed order. It loops constantly. Its loop
  join is heard, repeatedly, by everyone.
- **Powder Rush** (220.1 s) plays for at most 77 seconds and is cut off. Its loop
  join is heard by nobody, ever.

So SC-040 ("a listener cannot identify the loop point across five consecutive loops")
is, in practice, a requirement on Look Out Below alone. That is what makes R2's
split-mechanism decision affordable rather than gold-plating.

**Alternatives considered**: treating both pieces identically. Rejected — it forces
one mechanism to satisfy both the gapless requirement and the memory constraint,
and as R3 shows, no single mechanism does both well.

**A consequence worth surfacing**: 5.04 MiB of Powder Rush master buys 220 seconds of
music, of which no player will ever hear more than 77. Trimming it to roughly 90
seconds before encoding would cut its shipped size by about 60% with **zero**
player-observable loss. This was raised as Q2 option C during clarification and
declined on the reasonable grounds of not wanting to discard the composition. That
reasoning predates the measurement above. It is recorded here as a live option, not
re-decided: the plan implements what was chosen.

---

## R2 — Playback mechanism

**Decision**: Two mechanisms, chosen per piece.

| Piece          | Mechanism                                            | Why                                                          |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| Look Out Below | Web Audio `AudioBufferSourceNode` with `loop = true` | Sample-accurate, genuinely gapless loop. Required by SC-040. |
| Powder Rush    | `HTMLAudioElement` with `loop = true`, streamed      | Streams instead of decoding to RAM. Its loop is never heard. |

**Rationale**: These are the two constraints, and they pull opposite ways.

_Gaplessness_ is only achievable with `AudioBufferSourceNode`. An `HTMLAudioElement`
with `loop` re-seeks to zero at the end, and the encoder padding baked into an MP3
(see R3) surfaces as a short silence. Over an 88-second loop heard many times per
session, that is exactly the "audible gap" SC-040 forbids.

_Memory_ pulls the other way. `decodeAudioData` yields Float32 samples at the
AudioContext's rate — 48 kHz on the reference hardware. Mono, that is 192 kB per
second of audio, regardless of how small the compressed file was:

| Piece          | Duration | Decoded, mono float32 @ 48 kHz |
| -------------- | -------- | ------------------------------ |
| Look Out Below | 87.8 s   | **16.9 MB**                    |
| Powder Rush    | 220.1 s  | **42.3 MB**                    |
| Both resident  | —        | **59.2 MB**                    |

Against the constitution's **150 MB peak heap ceiling**, 59.2 MB of decoded audio is
not affordable — and the worst moment for it would be during a run, competing with
PixiJS textures and the simulation for exactly the memory and bandwidth the frame
budget depends on.

The split spends 16.9 MB on the piece whose loop is heard and near-zero on the piece
whose loop is not. Peak decoded audio drops from 59.2 MB to **16.9 MB**, and the
larger of the two pieces costs the least at the moment the budget is tightest.

**Alternatives considered**:

- _`HTMLAudioElement` for both._ Simplest by a clear margin, ~0 MB resident. Rejected:
  it fails SC-040 on the one piece where the loop is actually heard.
- _`AudioBufferSourceNode` for both._ One mechanism, gapless everywhere. Rejected on
  the 59.2 MB above — 39% of the entire heap ceiling, spent on a loop join no player
  reaches.
- _Decode Powder Rush lazily and release it after each run._ Still 42.3 MB resident
  during the run, which is the worst possible time, and adds decode latency to run
  start. Rejected.
- _Mastering the pieces to begin and end in silence_, so a plain restart sounds
  intentional. Cheapest of all and needs no code, but constrains the music to fit the
  mechanism. Recorded as a fallback if R3 proves harder than expected in practice.

This is the plan's one deliberate complexity, and it is tracked as such in
[plan.md](plan.md#complexity-tracking).

---

## R3 — Gapless looping over MP3 encoder padding

**Decision**: Decode Look Out Below to an `AudioBuffer`, then set `loopStart` and
`loopEnd` inside the padding rather than at the buffer's edges.

**Rationale**: Every MP3 carries encoder delay at the start and padding at the end,
because the format codes in fixed 1152-sample frames and a track rarely ends on a
frame boundary. `decodeAudioData` returns those padding samples as leading and
trailing silence. Looping edge-to-edge therefore plays that silence twice per lap.

`AudioBufferSourceNode` exposes `loopStart` and `loopEnd` in seconds, and loops
sample-accurately between them. Setting them just inside the silence gives a true
gapless join with no re-encode gymnastics.

The offsets are properties of the shipped encode, not of the master, so they MUST be
measured against the shipped file and stored as data (R7), not hardcoded.

**Alternatives considered**:

- _Trusting the LAME `Xing` header's delay/padding fields._ Browsers are inconsistent
  about honouring them through `decodeAudioData`. Rejected as unverifiable across the
  three target engines without a test that would cost more than measuring the offsets.
- _Shipping Opus instead of MP3_, which carries pre-skip metadata designed for exactly
  this. Rejected under R4 — see the codec-support reasoning there.
- _Shipping WAV_, which has no padding at all. Rejected on size; it defeats FR-150.

---

## R4 — Shipped encoding

**Decision**: MP3, mono, ~96 kbps CBR. Same container and codec as the masters.

**Rationale**: FR-150 fixes the target — mono, ~96 kbps, ≤ 2 MiB for the pair. The
open question was the codec, and the answer is "don't change it".

The masters are ~192 kbps stereo VBR. Mono at 96 kbps preserves the per-channel
bitrate exactly while halving the channel count and the file size. Expected result is
roughly 1.05 MiB + 2.6 MiB ≈ **3.7 MiB**, which meets SC-049's 2 MiB ceiling only if
Powder Rush is also trimmed — see the note under R1 and the flag in
[plan.md](plan.md#risks). At 64 kbps mono the pair lands near 2.5 MiB; at 96 kbps with
Powder Rush trimmed to 90 s, near 1.6 MiB.

MP3 is chosen over better codecs for one reason: it is the only one whose support on
Safari on iOS 16+ needs no verification. Opus at 96 kbps would sound materially better
and solves R3's padding problem outright, but Safari's Opus support has been
container-dependent and version-dependent, and a codec that decodes to silence on iOS
is a failure mode no test in this repository would currently catch. Trading audible
quality for a guarantee is the right side of that trade when the audience is eight
friends on phones.

**Alternatives considered**: Opus (rejected: iOS support risk, unverifiable from this
environment); AAC/M4A (well supported, but no advantage over MP3 at this bitrate that
justifies a second format); keeping the masters as-is (rejected by FR-146/FR-150).

**Unresolved and deliberately so**: whether 96 kbps or 64 kbps is the right point on
the quality/size curve cannot be settled by reasoning — it needs someone to listen to
both on a phone. That is a playtest task, not a research finding.

---

## R5 — Lazy loading, and the base path that has already broken this project once

**Decision**: Shipped assets live in `public/audio/`, are referenced only by runtime
URL built from `import.meta.env.BASE_URL`, and are never `import`ed into a module.

**Rationale**: FR-146 requires neither piece to enter the initial payload. In Vite, an
`import` of an asset is a bundle edge; a file under `public/` is copied verbatim and
fetched only when code asks for it. That is the whole mechanism.

The hazard is the URL. `vite.config.ts` sets `base: '/ski-game/'` for production and
`'/'` for dev, and the comment above it records why: a relative base already shipped a
blank page to players, because `./assets/main.js` resolved one directory too high at
`https://owner.github.io/ski-game` with no trailing slash. **No file in `src/`
currently reads `import.meta.env.BASE_URL` at all.** This feature would be the first,
which means it is the first chance to reintroduce that exact defect — and audio that
404s fails silently, with no blank page to make it obvious.

Every audio URL MUST therefore be built as `` `${import.meta.env.BASE_URL}audio/…` ``
and MUST be verified against the built artifact served at `/ski-game/`, entered
without a trailing slash. Principle VI makes this non-negotiable, and a dev-server
check MUST NOT be offered as evidence.

**Alternatives considered**: `import x from './x.mp3?url'` (Vite emits a hashed asset
and handles the base correctly, which is attractive — but it puts the URL string in
the initial bundle and makes the asset part of the build graph, which is the thing
FR-146 is trying to avoid reasoning about); inlining as base64 (absurd at this size).

---

## R6 — Retiring the synth music loop, keeping the cues

**Decision**: Delete `Synth.scheduleLoop`, `Synth.tick`, and the pentatonic table.
Keep `Synth.start`, `Synth.cue`, `pulse`, `bass`, `noise`, and `destroy`.

**Rationale**: FR-135 retires the synthesised _music_; FR-141 keeps the _cues_
synthesised, because each is paired with a visible equivalent under FR-058 and is
load-bearing for accessibility. `Synth.start()` must survive because it is what
creates the `AudioContext` the cues need — and, after this change, what the front-end
piece's `AudioBufferSourceNode` also needs.

The class comment in `src/audio/synth.ts` argues explicitly for runtime synthesis over
audio files, on both originality and payload grounds. That argument is now half
overturned, and the comment MUST be rewritten rather than left to contradict the code —
Principle I treats a spec that disagrees with shipped behaviour as a defect, and the
same logic applies to a comment that does.

---

## R7 — Tuning lives in data, not code

**Decision**: A new `data/audio.json` declares both pieces: id, filename, playback
context, mix gain, and Look Out Below's measured `loopStart`/`loopEnd`.

**Rationale**: The constitution requires that "courses, tuning curves, scoring tables,
and asset manifests MUST be declared in versioned, human-readable data files" and that
"magic numbers governing feel MUST NOT be embedded in code". Mix gain is a feel value:
music too loud buries the cues that carry gameplay information (FR-141), too quiet and
it is not there. The loop offsets are measurements of a specific encode, which is
precisely the kind of value that must not be a literal in a `.ts` file.

Validation follows the existing pattern in `src/data/load.ts`, which already asserts
the shape of `tuning.json`, `scoring.json` and the courses at load.

---

## R8 — Mute, and an inherited defect this feature has to absorb

**Decision**: One `setMuted` fans out to both the `Synth` and the new music player,
and the preference persists via `safeLocal`, following `src/render/reducedMotion.ts`
exactly.

**Rationale, and the defect**: FR-140 and SC-047 require a _persistent_ mute toggle,
as do FR-054 and style-bible A-3. **It is not persistent today.** `Synth.muted` is a
plain in-memory field; nothing in `src/` writes a mute preference to storage. Mute the
game, reload, and the sound comes back.

Feature 001's `tasks.md` marks **T095** complete — _"Gate audio behind the first
deliberate gesture with a persistent mute toggle per FR-054 in `src/audio/gate.ts`"_ —
and `src/audio/gate.ts` **does not exist**. The gesture-gate half was inlined into
`main.ts` as `armAudioOnFirstGesture()`; the persistence half was never written, and
the task was ticked anyway.

This feature cannot honour SC-047 without fixing it, so the fix is in scope here. Two
things follow that are not code: T095 must be un-ticked in feature 001's `tasks.md`
with a pointer to where the work actually landed, and the false tick is worth noting
as evidence for the constitution's own stop condition — a task marked done against a
file that does not exist is the kind of thing a checklist cannot catch and a test can.

**Mechanism note**: the music player must not be routed through
`createMediaElementSource`, which would let one master `GainNode` govern everything
but drags in cross-origin and iOS-specific graph quirks for no benefit. Setting
`.muted` on the element and the gain on the buffer path, both from one call, is
simpler and has no failure mode.

---

## R9 — Failure is silence, never an error

**Decision**: Every load and play path is fire-and-forget. A rejected `play()`, a 404,
a decode failure, and a still-in-flight fetch all resolve to "no music", never to a
thrown error, a retry storm, or a blocked run.

**Rationale**: FR-143 and SC-043 make this a hard requirement, and Principle II makes
it a merge blocker rather than a nicety. Two specific traps:

- `HTMLAudioElement.play()` returns a promise that **rejects** when autoplay policy
  refuses it. An unhandled rejection here would surface through the global handlers
  installed by `installGlobalErrorHandlers()` and put an error boundary over a working
  game because the music did not start.
- The first run of a cold session may begin before the course piece has arrived. The
  run must not wait. The music joins late or not at all.

The existing `showFatalError` path MUST never be reachable from audio.

---

## R10 — Where the transcode happens

**Decision**: Derived assets are committed to `public/audio/`, generated by a
documented script in `tools/`, not transcoded during the build.

**Rationale**: It matches how this repository already handles derived data —
`tools/gen-courses.ts` and `tools/gen-trig.ts` produce committed artifacts rather than
running in CI — and it keeps `ffmpeg` out of the build environment, which would
otherwise become a CI dependency for every commit, audio-related or not. The
constitution's "source files for derived assets MUST be retained" is satisfied by
`assets/audio/masters/`, which is already committed.

**Operator obligation**: the transcode command is an operator-facing instruction under
Principle VII. It MUST be executed verbatim and its output inspected — file sizes and
a listen — not merely asserted to exit zero. `ffmpeg` is **not** available in the
environment this plan was written in, so the encode is an implementation-phase task
that requires a machine that has it.
