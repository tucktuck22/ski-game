# Feature Specification: Two Recorded Tracks, Looping Forever

**Feature Branch**: `claude/session-start-qjf82j`

**Created**: 2026-09-03

**Status**: Clarified 2026-09-03 — ready for `/speckit-plan`

**Input**: User description: "I'd like to update the landing music and the in-game
track to the following two MP3 files. Look out below should play when the user hits
the loading screen and replaces the current track. Powder Rush should play when the
user is in-game and actually on the course. In either setting, when the song runs
out, it should loop and play from the beginning and continue to do so."

Supplied material, as delivered:

| Track          | Duration | Size         | Encoding                          |
| -------------- | -------- | ------------ | --------------------------------- |
| Look Out Below | 1:28     | 2.05 MiB     | MP3, VBR ~196 kbps, 48 kHz stereo |
| Powder Rush    | 3:40     | 5.04 MiB     | MP3, VBR ~192 kbps, 48 kHz stereo |
| **Total**      | **5:08** | **7.09 MiB** |                                   |

These are the masters. What ships is re-encoded — see FR-150 and the Q2 resolution.

## Context

This feature changes **the music only**. It replaces the runtime-synthesised music
loop with two recorded tracks, one for the screens outside a run and one for the run
itself. It changes nothing about claiming a name, the run economy, committing a
score, the deadline, or the standings (feature 001), and nothing about the mountain,
the two tracks down it, the hazards, or the trick economy (feature 002).

Sound **effects** are explicitly out of scope and stay as they are: the launch, land,
pickup and wipeout cues remain synthesised at runtime, because each is an
accessibility-relevant cue paired with a visible equivalent under FR-058, and none of
them is what was asked to change.

**Numbering**: requirements continue from feature 002 (FR-135+, SC-039+) rather than
restarting at 001, for the reason recorded in feature 002's spec — source comments,
validator rules and contracts across this repository cite bare requirement numbers
with no feature prefix, so a second `FR-001` would be ambiguous wherever it appeared.

**Terminology**: "track" is overloaded here. Feature 002 uses it for the upper and
lower ski lines down the mountain. This document says **music track**, or names the
piece, wherever the context is not obvious.

## Governance impact _(three conflicts, all resolved)_

This feature cannot be built without changing ratified governance. Three separate
binding rules forbid it in the form originally described. None was a technical
obstacle implementation could engineer around; each needed a deliberate decision, and
each has now been taken. They are recorded here because approving this spec approves
those decisions.

### 1. The style bible forbade sampled audio outright — amending it

`assets/style-bible.md`, rule **A-1**: _"All audio is synthesised at runtime via Web
Audio (FR-053). No sampled or licensed material of any kind."_

Rule **A-2**: _"Voices: two pulse leads, one triangle bass, one noise percussion.
This is the whole instrument set."_

Two MP3 files are, by definition, sampled material outside that instrument set.
Constitution Principle IV makes the style bible the single source of truth for audio
character, and requires every asset to cite the rule it satisfies at review (FR-052).
These music tracks could cite no such rule.

**Resolved**: A-1 and A-2 are to be amended — A-1 to permit **original recorded
music**, A-2's instrument set to be scoped to synthesised audio, which is what it was
always describing. Synthesis remains the rule for every sound effect. The reversal is
significant enough to warrant an ADR, because A-1 was not an accident: `synth.ts`
argues for it explicitly, and a future reader deserves to know the position changed
on purpose. See FR-147.

### 2. FR-053 and rule O-1 forbid third-party musical material — satisfied

Feature 001 **FR-053**: _"All art and audio MUST be original works in period style.
No third-party characters, logos, trademarks, music, or other licensed material may
appear."_

Style-bible **O-1**: _"All art and audio are original works in period style… no
existing artist's work is reproduced. Period-*style*, never period-*property*."_

Whether these files satisfy FR-053 depends entirely on their provenance, which cannot
be determined by inspecting them.

**Resolved**: both are original works the project owns. FR-053 and O-1 are therefore
satisfied as written and need no amendment — only A-1/A-2 do. The provenance is to be
recorded in the repository rather than left as conversational context, so that a
reviewer in a year can verify the claim (FR-148).

### 3. The masters are 3.5× the payload budget — re-encoding and lazy-loading

The constitution fixes a binding budget: _"initial payload MUST NOT exceed 2 MB
gzipped… time to interactive MUST NOT exceed 5 s on Fast 3G with a cold cache."_
(ADR-0006, reference hardware: a 2022-era mid-range phone.)

The masters total **7.09 MiB**. MP3 is already compressed, so gzip recovers
effectively nothing — that is 7.09 MiB on the wire either way, against a 2 MB
ceiling, **before a single byte of game code, course data, or fonts**. On Fast 3G it
is roughly 35 seconds of transfer against a 5-second time-to-interactive ceiling.
ADR-0006 rejected two candidate game engines "on payload alone — they spend the
entire budget before any game code." The same arithmetic applied here, more sharply.

**Resolved**: both measures, not either. The shipped assets are re-encoded to mono at
roughly 96 kbps, bringing the pair to roughly 3.5 MiB — about half the bytes, for a
fidelity loss unlikely to register through a phone speaker on a chairlift. And neither
is part of the initial bundle: both are fetched on demand, so the initial-payload and
time-to-interactive budgets are untouched rather than merely survived.

**The constitution's 2 MB gzipped budget is not amended and is not in play here.** It
governs the _initial_ payload, and lazy loading keeps both pieces out of it entirely.
SC-049's 4 MiB is a separate, self-imposed ceiling on the music itself, raised from
2 MiB on 2026-09-04 so that neither piece has to be trimmed. What it costs is
transfer time on a slow connection before music arrives — silence, never a blocked
run (FR-143). See FR-146 and FR-150.

### What was never in conflict

- **FR-054 / A-3** (silent until a deliberate gesture) is preserved unchanged, and is
  reinforced by browser autoplay policy. Nothing here needs it relaxed.
- **FR-058 / A-4** (every gameplay cue has a visible equivalent) is unaffected: music
  is atmosphere and carries no gameplay information, and the cues that do carry it are
  out of scope.
- **Principle II determinism** is unaffected: audio is not part of the simulation and
  no simulation value derives from playback state.
- **FR-056** (reduced motion) is unaffected: it governs motion, not sound.

## Clarifications

### Session 2026-09-03

- **Q: Where did the two music tracks come from, and how should the conflict with
  style-bible A-1/A-2 and FR-053/O-1 be resolved?**
  A: They are original works the project owns. Amend A-1 and A-2 to permit original
  recorded music while keeping synthesis for sound effects, and record the reversal
  in an ADR. FR-053 and O-1 are satisfied as written and are not amended.

- **Q: The masters total 7.09 MiB against a 2 MB gzipped initial-payload ceiling and a
  5 s Fast 3G time-to-interactive ceiling. How is that resolved?**
  A: Both re-encode and lazy-load. Ship the music re-encoded to mono at roughly
  96 kbps, and fetch both on demand so neither is part of the initial bundle. The
  constitution's budget is not amended. _(The 2 MiB asset ceiling set here was raised
  to 4 MiB on 2026-09-04, below, once the encode was projected at ~3.5 MiB.)_

- **Q: The request says "landing music" and "the loading screen" in consecutive
  sentences, but those are different screens in the shipped app, and the literal boot
  shell is sub-second and usually precedes the first gesture. Which screens does
  "Look Out Below" own?**
  A: Everything that is not a run — the boot shell, the board, the official-run
  confirmation, and the results panel — as one continuous piece that does not restart
  when the screen changes. The rule reduces to "on the course, or not".

### Session 2026-09-04

- **Q: Mono at ~96 kbps projects to roughly 3.5 MiB for the pair, over SC-049's
  original 2 MiB ceiling. Trim Powder Rush, drop the bitrate, or raise the ceiling?**
  A: Raise the ceiling to 4 MiB. Neither piece is trimmed and the bitrate stands.
  Load time is accepted as a known cost and revisited only if it proves a problem in
  practice. The constitution's initial-payload budget is untouched either way, because
  lazy loading keeps both pieces out of it.

- **Q: The mute toggle is not persistent today, though FR-054 and style-bible A-3
  require it. Fix it inside this feature, since SC-047 depended on it?**
  A: No. Persistence is out of scope here. SC-047 is narrowed to within-session
  behaviour, and the standing FR-054 gap is recorded below as a deviation rather than
  quietly dropped.

### Session 2026-09-04 (post-merge)

- **Q: The music does not start until the player clicks somewhere. Can it start on
  page load?**
  A: No — and not for a reason this project can decide. Every target browser blocks
  audio before a user gesture, and Safari on iOS 16+, the primary target, permits no
  exception. FR-054 and style-bible A-3 independently require the same thing. The
  resolution is to make the required gesture **purposeful and visible** rather than
  invisible: a title screen with a single control that starts the music and enters the
  game in one action. See FR-151 to FR-154.

## Known deviations

The constitution's compliance-review clause requires a deviation to carry a rationale,
an owner, and a remediation date rather than going unrecorded.

| Deviation                                                                                         | Rationale                                                                                                                                                                                           | Owner         | Remediation |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------- |
| **The mute toggle does not persist**, though FR-054 and style-bible A-3 require a persistent one. | Pre-existing, not introduced here: `Synth.muted` has always been an in-memory field. Judged low impact — a player who wants silence re-mutes once per session. Deferred deliberately on 2026-09-04. | Project owner | Undated     |

This is a **standing** gap, not one this feature opens. It is named here because
FR-140 and SC-047 would otherwise read as though the toggle behaved as A-3 describes.

Related and **not** deferred: feature 001's `tasks.md` marks **T095** complete against
`src/audio/gate.ts`, a file that does not exist. Correcting that tick is a
documentation fix, independent of whether the persistence is ever built, and it stays
in scope — the constitution treats a check that did not run as a defect of the same
severity as the bug it conceals.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The front-end has a theme (Priority: P1)

A player opens the draft link, taps to claim a name, and hears "Look Out Below"
start. It plays while they read the countdown, look at the standings, and decide
whether to take a practice run. When it reaches the end it starts again from the
beginning, and keeps doing so for as long as they stay off the course.

**Why this priority**: It is the first thing anyone hears, it is where players spend
the most cumulative time, and it replaces the existing synth loop — which is the
specific change requested. It delivers value on its own with no course work done.

**Independent Test**: Open the app, make one deliberate gesture, and confirm the
piece plays; leave the board open past its 1:28 duration and confirm it restarts and
continues without intervention.

**Acceptance Scenarios**:

1. **Given** a freshly loaded board and no prior interaction, **When** the player
   makes their first deliberate gesture, **Then** Look Out Below begins and the
   synthesised music loop does not.
2. **Given** Look Out Below is playing, **When** it reaches its end, **Then** it
   resumes from its beginning with no perceptible gap and no player action.
3. **Given** Look Out Below has looped, **When** it reaches its end again, **Then** it
   loops again — indefinitely, not once.
4. **Given** Look Out Below is playing on the board, **When** the player opens the
   official-run confirmation and then backs out, **Then** it continues from where it
   was rather than restarting.
5. **Given** the player has muted sound, **When** they reload and return, **Then** the
   music stays silent and the toggle still reads muted.

---

### User Story 2 - The course has a theme (Priority: P2)

A player starts a run. "Powder Rush" takes over for the duration of the run, loops if
the run outlasts it, and hands back to the front-end piece when the run is over.

**Why this priority**: It is the other half of the request and the more atmospheric
half, but the front-end piece is what establishes the change; a run with the wrong
music is still a playable, scoreable run. Independently valuable and independently
testable once US1 exists.

**Independent Test**: Start a practice run and confirm Powder Rush is what plays;
finish or wipe out and confirm the front-end piece returns.

**Acceptance Scenarios**:

1. **Given** the player is on the board with Look Out Below playing, **When** they
   start any run — practice, official, or free play — **Then** Powder Rush plays and
   Look Out Below stops.
2. **Given** a run in progress with Powder Rush playing, **When** it reaches its end
   before the run does, **Then** it resumes from its beginning and continues.
3. **Given** a run in progress, **When** the player wipes out, **Then** Powder Rush
   continues through the wipeout sequence and stops when the results panel appears.
4. **Given** a run has ended and the results panel is shown, **When** the player
   returns to the board, **Then** Look Out Below is playing again.
5. **Given** the player starts a second run in the same session, **When** the run
   begins, **Then** Powder Rush plays again from its beginning.

---

### User Story 3 - Music never gets in the way (Priority: P3)

Whatever the network, the device, or the player's settings do, the music is the first
thing to give up and the run is never the thing that breaks.

**Why this priority**: Principle II — no crashes on any input, and the frame budget
held — makes this a hard constraint rather than a nicety, but it is only observable
once US1 and US2 exist. It is the story that keeps a music download from becoming a
reason someone cannot take their one official run.

**Independent Test**: Simulate a failed and a slow music download and confirm every
run still starts, plays, ends, and commits its score.

**Acceptance Scenarios**:

1. **Given** the music cannot be downloaded at all, **When** the player starts an
   official run, **Then** the run starts, plays, ends, and commits its score normally,
   in silence or with whatever audio is available.
2. **Given** a piece is still downloading, **When** the player starts a run, **Then**
   the run is not delayed waiting for it.
3. **Given** music is playing, **When** the player mutes, **Then** all audio including
   music falls silent, and unmuting resumes it.
4. **Given** a run is in progress, **When** music playback is compared against the
   same run with music disabled, **Then** the simulation produces an identical result
   from the same seed and inputs.
5. **Given** the player switches away from the tab mid-run and returns, **Then** the
   app is still responsive and no duplicate or overlapping music is audible.

### Edge Cases

- **The loop point.** A plain restart at the end of an MP3 leaves a short silence,
  because encoder padding is part of the file. Re-encoding (FR-150) changes that
  padding, so the loop join must be judged on the shipped asset, not the master.
- **First gesture never happens.** A player who reads the standings without tapping
  anything hears nothing at all, correctly, under FR-054. The music must not be what
  prompts a gesture.
- **Rapid run start/stop.** Starting a run, backing out, and starting another in quick
  succession must not leave two pieces audible at once.
- **A run shorter than a piece, and a run longer than one.** Both are ordinary; the
  first stops mid-piece, the second loops.
- **Mute toggled mid-piece.** Unmuting should resume, not restart from zero.
- **Tab backgrounded.** Browsers may throttle or suspend audio; returning must not
  produce a second overlapping instance.
- **Phone call or another app taking audio focus** on mobile mid-run.
- **A device that blocks web storage** (already handled for the rest of the app by
  `safeStorage`) must not break the mute preference or the music.
- **The results panel and the wipeout finale** — both are front-end screens reached
  directly from a run, so the handoff back happens while a visual sequence is playing.
- **Free play** is a run for these purposes even though it scores nothing.
- **A run started before the course piece has finished downloading**, on the very
  first run of a cold session. The run wins; the music joins when it can, or not.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-135**: The screens outside a run — the title screen, the board, the official-run
  confirmation, and the results panel — MUST play "Look Out Below" as their music,
  replacing the runtime-synthesised music loop on those screens.
- **FR-136**: A run in progress MUST play "Powder Rush" as its music, for every run
  kind — practice, official, and free play.
- **FR-137**: When either piece reaches its end it MUST resume from its beginning
  without player action, and MUST continue doing so indefinitely rather than once.
- **FR-138**: Exactly one music track MUST be audible at any moment. Starting a run
  MUST stop the front-end piece; ending one MUST stop the course piece.
- **FR-139**: The front-end piece MUST NOT restart when the player moves between
  screens that are all outside a run. Moving from the board to the confirmation screen
  and back is not a reason to restart the music.
- **FR-140**: Music MUST remain silent until a deliberate player gesture, and the
  existing mute toggle MUST silence and restore it within the session, preserving the
  gesture gate of FR-054 and style-bible A-3 unchanged. The toggle is **not** required
  to survive a reload — see [Known deviations](#known-deviations).
- **FR-141**: The launch, land, pickup and wipeout sound cues MUST remain synthesised
  at runtime and MUST remain audible over the music, preserving FR-058 and style-bible
  A-2 and A-4 for the audio that carries gameplay information.
- **FR-142**: No music track may carry information a player needs to complete a run or
  read the standings. Music is atmosphere only.
- **FR-143**: A failure or delay in obtaining either piece MUST NOT prevent a run from
  starting, running, ending, or committing its score, and MUST NOT surface as an error
  to the player. Music degrades to silence; the game does not degrade at all.
- **FR-144**: Music playback MUST NOT affect the simulation. The same seed and the
  same inputs MUST produce the same run, score, and outcome whether music is playing,
  muted, or unavailable.
- **FR-145**: Music playback MUST NOT cause the frame-time or simulation-step budgets
  to be exceeded on reference hardware.
- **FR-146**: Neither music track may form part of the initial payload. Both MUST be
  fetched on demand, so that the 2 MB gzipped initial-payload budget and the 5 s Fast
  3G time-to-interactive budget are unchanged by this feature rather than merely
  survived by it.
- **FR-147**: Style-bible rules A-1 and A-2 MUST be amended before this feature
  merges — A-1 to permit original recorded music, A-2's instrument set to be scoped to
  synthesised audio — and the reversal MUST be recorded as an ADR. An asset that
  cannot cite a style-bible rule is rejected under FR-052, and no rule as currently
  written admits a recorded piece.
- **FR-148**: The provenance of both music tracks MUST be recorded in the repository,
  establishing them as original works the project owns, as FR-053 and style-bible O-1
  require. A claim made only in conversation is not a record.
- **FR-149**: Both music tracks MUST be identifiable in the repository by name, so
  that a reviewer can tell which asset satisfies which requirement.

- **FR-151**: A title screen MUST be the first thing a player sees on a cold load,
  carrying the game's name and a single control that enters the game.
- **FR-152**: Activating that control MUST start the music and place the player on the
  board in one action. A player MUST NOT have to find a second thing to click before
  hearing anything.
- **FR-153**: The title screen MUST NOT gate entry on audio. A player whose sound is
  muted, refused, or unavailable MUST reach the board from the same control, and the
  control MUST NOT wait for the music to load.
- **FR-154**: The title screen MUST be reachable and operable by keyboard, and MUST
  respect the reduced-motion setting, as every other screen does (FR-056).
- **FR-150**: The shipped music assets MUST be re-encoded from the masters to mono at
  approximately 96 kbps, and the two together MUST NOT exceed 4 MiB transferred. The
  masters are archived, not shipped.

### Key Entities

- **Music Track**: A named piece of recorded music with a fixed duration, a
  provenance record, a shipped encoding distinct from its master, and exactly one
  playback context. Two exist: Look Out Below (front-end) and Powder Rush (course).
- **Playback Context**: The condition under which a music track is the one that should
  be audible. Two exist — _on the course_ and _not on the course_ — and they are
  mutually exclusive and exhaustive, which is what makes FR-138 checkable.
- **Sound Setting**: The player's existing mute preference, which now governs music as
  well as cues. It lasts the session only — see [Known deviations](#known-deviations).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-039**: On a warm cache, music becomes audible within 1 second of the player's
  first deliberate gesture.
- **SC-040**: A listener cannot identify the loop point by ear across five consecutive
  loops of either piece — no audible gap, click, or stutter — judged on the shipped
  encoding.
- **SC-041**: The change of music on starting and on ending a run completes within
  half a second, and at no point are two pieces audible together.
- **SC-042**: The front-end piece survives at least ten screen changes outside a run
  without restarting.
- **SC-043**: 100% of runs start, complete, and commit their score when the music
  cannot be downloaded, and 100% do so when it downloads slowly.
- **SC-044**: The initial payload stays at or under 2 MB gzipped and time to
  interactive stays at or under 5 s on Fast 3G with a cold cache — both unchanged from
  before this feature, within measurement noise.
- **SC-045**: Frame time at the 95th percentile and simulation step time are within
  budget on reference hardware with music playing, and no worse than before this
  feature by more than 5%.
- **SC-046**: A run replayed from the same seed and inputs produces an identical score
  and outcome with music playing, muted, and unavailable.
- **SC-047**: Muting silences all audio — music and cues alike — within 100 ms, and
  unmuting resumes the current context's piece rather than restarting it. The
  preference is not required to survive a reload.
- **SC-048**: Every shipped audio asset cites the style-bible rule it satisfies, as
  FR-052 requires — zero assets failing review, rather than assets documented as
  exceptions.
- **SC-050**: From a cold load, a player reaches the board in **one** action, and the
  music is audible from that same action rather than a later one.
- **SC-051**: The title screen adds nothing to the initial payload beyond markup and
  styling already served — no new image, font, or media file.
- **SC-049**: The two shipped music assets total no more than 4 MiB transferred, down
  from 7.09 MiB of masters. At mono ~96 kbps the pair projects to roughly 3.5 MiB,
  leaving about 13% headroom.

## Assumptions

Recorded here are the defaults taken where the description did not specify. The three
gaps judged too consequential to default were raised as clarifications and are
answered above.

- **The existing synthesised music loop is retired entirely**, not merely paused. The
  request says Look Out Below "replaces the current track", and after Q3's answer
  there is no context left in which the synth loop would play.
- **Sound effects are unchanged.** The request names two music tracks and says nothing
  about cues, and the cues are load-bearing for accessibility under FR-058.
- **Looping is a plain restart from the first sample**, not a musically-authored loop
  point inside the piece. SC-040 asks only that the join not be audible.
- **The handoff between pieces is a cut or a short fade, not a beat-matched
  transition.** Nothing in the request asks for synchronisation between the two.
- **There is no separate music volume control.** The existing single mute toggle
  governs all audio, as it does today — including its lack of persistence.
- **Mixing keeps the cues audible over the music**, since the cues carry information
  and the music does not.
- **Reduced motion does not affect audio.** FR-056 governs motion; there is no
  reduced-audio setting and this feature does not add one.
- **The music is the two pieces supplied with this request** and no others; adding a
  third piece or per-course music is out of scope.
- **Re-encoding is a lossy transcode of the supplied masters**, not a remix or a
  re-render from source stems, which are not available.
- **Determinism is unaffected**, because audio is outside the simulation and no
  simulation value derives from playback state. FR-144 and SC-046 exist to keep it
  that way, not because there is a known risk.

## Dependencies

- **Feature 001** supplies the screens, the run economy, the mute toggle, and the
  gesture gate this feature attaches to.
- **`assets/style-bible.md` must be amended** (rules A-1, A-2) before merge, and an
  ADR written recording the reversal — see FR-147. A hard dependency, not a follow-up.
- **A provenance record** for both music tracks — see FR-148. Also a hard dependency.
- **The master files** must reach the repository or an archive before the container
  holding them is reclaimed; the shipped assets are derived from them and cannot be
  regenerated otherwise.
- **A performance-budget measurement** to demonstrate SC-044 and SC-045. The
  constitution notes that no payload or frame-budget job exists yet, recorded as an
  open deviation; this feature is precisely the kind of change that budget was written
  to catch, so the measurement has to happen even if the job does not exist to
  automate it.

## Out of Scope

- Changing, adding, or removing any sound effect or gameplay cue.
- Per-course, per-track, or dynamic music that responds to what the player is doing.
- A music volume slider or any audio setting beyond the existing mute toggle.
- Offline caching of the music beyond whatever the browser does on its own.
- Making the mute toggle persist across reloads. Recorded as a deviation above.
- Trimming or shortening either piece.
- Amending the constitution's payload or time-to-interactive budgets.
- Any change to the simulation, scoring, courses, run economy, deadline, or standings.
