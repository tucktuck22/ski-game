# Feature Specification: Two Recorded Tracks, Looping Forever

**Feature Branch**: `claude/session-start-qjf82j`

**Created**: 2026-09-03

**Status**: Draft — blocked on three clarifications (see [Clarifications](#clarifications))

**Input**: User description: "I'd like to update the landing music and the in-game
track to the following two MP3 files. Look out below should play when the user hits
the loading screen and replaces the current track. Powder Rush should play when the
user is in-game and actually on the course. In either setting, when the song runs
out, it should loop and play from the beginning and continue to do so."

Supplied material:

| Track          | Duration | Size         | Encoding                          |
| -------------- | -------- | ------------ | --------------------------------- |
| Look Out Below | 1:28     | 2.05 MiB     | MP3, VBR ~196 kbps, 48 kHz stereo |
| Powder Rush    | 3:40     | 5.04 MiB     | MP3, VBR ~192 kbps, 48 kHz stereo |
| **Total**      | **5:08** | **7.09 MiB** |                                   |

## Context

This feature changes **the music only**. It replaces the runtime-synthesised music
loop with two recorded tracks, one for the screens outside a run and one for the
run itself. It changes nothing about claiming a name, the run economy, committing a
score, the deadline, or the standings (feature 001), and nothing about the mountain,
the two tracks down it, the hazards, or the trick economy (feature 002).

Sound **effects** are explicitly out of scope and stay as they are: the launch,
land, pickup and wipeout cues remain synthesised at runtime, because each is an
accessibility-relevant cue paired with a visible equivalent under FR-058, and none
of them is what the user asked to change.

**Numbering**: requirements continue from feature 002 (FR-135+, SC-039+) rather than
restarting at 001, for the reason recorded in feature 002's spec — source comments,
validator rules and contracts across this repository cite bare requirement numbers
with no feature prefix, so a second `FR-001` would be ambiguous wherever it appeared.

## Governance conflicts _(read before approving)_

This feature, as described, **cannot be built without changing ratified governance**.
Three separate binding rules forbid it in its current form. None of these is a
technical obstacle that implementation can engineer around; each is a decision the
project owner has to take deliberately.

### 1. The style bible forbids sampled audio outright

`assets/style-bible.md`, rule **A-1**: _"All audio is synthesised at runtime via Web
Audio (FR-053). No sampled or licensed material of any kind."_

Rule **A-2**: _"Voices: two pulse leads, one triangle bass, one noise percussion.
This is the whole instrument set."_

Two MP3 files are, by definition, sampled material outside that instrument set.
Constitution Principle IV makes the style bible the single source of truth for audio
character, and requires every asset to cite the rule it satisfies at review (FR-052).
These tracks can cite no such rule today. **A-1 and A-2 must be amended before this
feature can merge.**

### 2. FR-053 and rule O-1 forbid third-party musical material

Feature 001 **FR-053**: _"All art and audio MUST be original works in period style.
No third-party characters, logos, trademarks, music, or other licensed material may
appear."_

Style-bible **O-1**: _"All art and audio are original works in period style… no
existing artist's work is reproduced. Period-*style*, never period-*property*."_

Whether these two files satisfy FR-053 depends entirely on where they came from,
which this specification cannot determine by inspecting them. If they are original
works the project owns or is licensed to use, FR-053 is satisfiable and only A-1/A-2
need amending. If they are anyone else's recordings, FR-053 and O-1 both block the
feature and no amendment short of abandoning the "original work only" position
resolves it. **Provenance must be established and recorded.**

### 3. The tracks are 3.5× the entire payload budget

The constitution fixes a binding budget: _"initial payload MUST NOT exceed 2 MB
gzipped… time to interactive MUST NOT exceed 5 s on Fast 3G with a cold cache."_
(ADR-0006, reference hardware: a 2022-era mid-range phone.)

The two files total **7.09 MiB**. MP3 is already compressed, so gzip recovers
effectively nothing — this is 7.09 MiB on the wire either way, against a 2 MB
ceiling, **before a single byte of game code, course data, or fonts**. On Fast 3G
that is roughly 35 seconds of transfer, against a 5-second time-to-interactive
ceiling.

ADR-0006 rejected two candidate game engines "on payload alone — they spend the
entire budget before any game code." The same arithmetic applies here, more sharply.

This one has engineering answers — lazy loading so neither track is part of the
_initial_ payload, and re-encoding to a lower bitrate — but they are product
trade-offs (fidelity, and how long a player waits in silence), not free wins, so
they are put as a clarification rather than assumed.

### What is _not_ in conflict

- **FR-054 / A-3** (silent until a deliberate gesture) is preserved unchanged, and is
  reinforced by browser autoplay policy. Nothing here needs it relaxed.
- **FR-058 / A-4** (every gameplay cue has a visible equivalent) is unaffected: music
  is atmosphere and carries no gameplay information, and the cues that do carry it
  are out of scope.
- **Principle II determinism** is unaffected: audio is not part of the simulation and
  no simulation value derives from playback state.
- **FR-056** (reduced motion) is unaffected: it governs motion, not sound.

## Clarifications

Three questions block this spec. Each has been left as a `[NEEDS CLARIFICATION]`
marker in the requirements below rather than answered by a default, because in each
case the reasonable-looking default would silently commit the project to a position
its own governing documents currently forbid.

### Q1 — Provenance and the style-bible amendment _(scope; legal)_

Where did these two tracks come from, and how should the conflict with style-bible
A-1/A-2 and FR-053/O-1 be resolved?

| Option | Answer                                                                                                                                       | Implications                                                                                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | They are original works I own (commissioned or self-generated). Amend A-1/A-2 to permit original recorded music, keep synthesis for effects. | FR-053 and O-1 are satisfied as written. Style bible gains a rule permitting pre-rendered original music; A-2's instrument set is scoped to synthesised audio only. An ADR records the reversal of A-1. |
| B      | They are original works I own, but keep the style bible as-is and treat this as a documented deviation.                                      | Ships faster, but adds a second live Principle IV deviation alongside feature 002's Principle I one. Deviations are accumulating rather than closing.                                                   |
| C      | They are third-party or AI-generated from copyrighted material, or I am not sure.                                                            | FR-053 and O-1 both block the feature outright. The honest resolution is either to establish a licence, or to keep the synth and drop the feature.                                                      |
| Custom | Provide your own answer                                                                                                                      | Describe the provenance and the governance path you want.                                                                                                                                               |

### Q2 — The payload budget _(scope; performance)_

7.09 MiB of music against a 2 MB gzipped initial-payload ceiling and a 5 s Fast 3G
time-to-interactive ceiling. How should this be resolved?

| Option | Answer                                                                                             | Implications                                                                                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Stream both tracks lazily; neither counts toward the _initial_ payload. Ship them at full quality. | Budget is honoured as literally written, and time-to-interactive is unaffected because nothing blocks on audio. But a player on lodge wifi still pulls 7 MiB, and the front-end may sit silent for tens of seconds on a cold, slow connection. |
| B      | Lazy-load **and** re-encode: mono, ~96 kbps, which brings the pair to roughly 1.8 MiB total.       | Roughly a quarter of the bytes for a modest fidelity loss most people will not notice through a phone speaker on a chairlift. Recommended if the music is meant to be heard rather than admired.                                               |
| C      | Lazy-load, re-encode, **and** shorten — trim each track to a 60–90 s section chosen to loop.       | Smallest payload and the cleanest loop, at the cost of discarding most of Powder Rush's 3:40. Worth it only if the loop point matters more than the composition.                                                                               |
| D      | Raise the payload budget in the constitution to accommodate the music.                             | Honest about the trade-off being made, but weakens a budget that ADR-0006 used to reject two game engines. Amending a budget to fit an asset is the pattern the budget exists to prevent.                                                      |
| Custom | Provide your own answer                                                                            | Describe the size/fidelity trade-off you want.                                                                                                                                                                                                 |

### Q3 — What counts as "the loading screen"? _(user experience)_

The request says "landing music" in one sentence and "the loading screen" in the
next. In the shipped app these are different screens, and the literal loading screen
is usually invisible:

- The **boot shell** (`"Loading the mountain…"`) is painted synchronously and replaced
  as soon as shared storage answers — typically well under a second, and often before
  a player has made the deliberate gesture that browser autoplay policy and FR-054
  require before any sound may start at all. Music scoped to only this screen would,
  in the normal case, never play.
- The **board** (roster, countdown, leaderboard, organizer controls) is where a player
  actually spends time, along with the official-run confirmation and the results
  panel.

| Option | Answer                                                                                             | Implications                                                                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Look Out Below covers **everything that is not a run** — boot shell, board, confirmation, results. | The rule is simply "on the course or not". One continuous track across the whole front-end, never restarting as screens change. Matches "landing music". _(Assumed below.)_ |
| B      | Look Out Below covers only the boot shell; the board keeps the existing synth loop.                | Literal reading, but in practice near-inaudible: the boot shell is sub-second and usually precedes the first gesture. The synth stays as a second music system.             |
| C      | Look Out Below covers the front-end, and the results panel switches back to something else.        | Extra state to specify and test for a screen most players see once.                                                                                                         |
| Custom | Provide your own answer                                                                            | Describe which screens each track owns.                                                                                                                                     |

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The front-end has a theme (Priority: P1)

A player opens the draft link, taps to claim a name, and hears "Look Out Below"
start. It plays while they read the countdown, look at the standings, and decide
whether to take a practice run. When it reaches the end it starts again from the
beginning, and keeps doing so for as long as they stay on the board.

**Why this priority**: It is the first thing anyone hears, it is the screen players
spend the most cumulative time on, and it replaces the existing synth loop — which is
the specific change requested. It delivers value on its own with no course work done.

**Independent Test**: Open the app, make one deliberate gesture, and confirm the
track plays; leave the board open past the track's 1:28 duration and confirm it
restarts and continues without intervention.

**Acceptance Scenarios**:

1. **Given** a freshly loaded board and no prior interaction, **When** the player
   makes their first deliberate gesture, **Then** Look Out Below begins and the
   synthesised music loop does not.
2. **Given** Look Out Below is playing, **When** it reaches its end, **Then** it
   resumes from its beginning with no perceptible gap and no player action.
3. **Given** Look Out Below has looped, **When** it reaches its end again, **Then**
   it loops again — indefinitely, not once.
4. **Given** Look Out Below is playing on the board, **When** the player opens the
   official-run confirmation and then backs out, **Then** the track continues from
   where it was rather than restarting.
5. **Given** the player has muted sound, **When** they reload and return, **Then** the
   music stays silent and the toggle still reads muted.

---

### User Story 2 - The course has a theme (Priority: P2)

A player starts a run. "Powder Rush" takes over for the duration of the run, loops if
the run outlasts it, and hands back to the front-end track when the run is over.

**Why this priority**: It is the other half of the request and the more atmospheric
half, but the front-end track is what establishes the change; a run with the wrong
music is still a playable, scoreable run. Independently valuable and independently
testable once US1 exists.

**Independent Test**: Start a practice run and confirm Powder Rush is what plays;
finish or wipe out and confirm the front-end track returns.

**Acceptance Scenarios**:

1. **Given** the player is on the board with Look Out Below playing, **When** they
   start any run — practice, official, or free play — **Then** Powder Rush plays and
   Look Out Below stops.
2. **Given** a run in progress with Powder Rush playing, **When** the track reaches
   its end before the run does, **Then** it resumes from its beginning and continues.
3. **Given** a run in progress, **When** the player wipes out, **Then** Powder Rush
   continues through the wipeout sequence and stops when the results panel appears.
4. **Given** a run has ended and the results panel is shown, **When** the player
   returns to the board, **Then** Look Out Below is playing again.
5. **Given** the player starts a second run in the same session, **When** the run
   begins, **Then** Powder Rush plays again from its beginning.

---

### User Story 3 - Music never gets in the way (Priority: P3)

Whatever the network, the device, or the player's settings do, the music is the
first thing to give up and the run is never the thing that breaks.

**Why this priority**: Principle II — no crashes on any input, and the frame budget
held — makes this a hard constraint rather than a nicety, but it is only observable
once US1 and US2 exist. It is the story that keeps a 7 MiB download from becoming a
reason someone cannot take their one official run.

**Independent Test**: Simulate a failed and a slow music download and confirm every
run still starts, plays, ends, and commits its score.

**Acceptance Scenarios**:

1. **Given** the music files cannot be downloaded at all, **When** the player starts
   an official run, **Then** the run starts, plays, ends, and commits its score
   normally, in silence or with whatever audio is available.
2. **Given** a track is still downloading, **When** the player starts a run, **Then**
   the run is not delayed waiting for it.
3. **Given** music is playing, **When** the player mutes, **Then** all audio including
   music falls silent, and unmuting resumes it.
4. **Given** a run is in progress, **When** music playback is compared against the
   same run with music disabled, **Then** the simulation produces an identical
   result from the same seed and inputs.
5. **Given** the player switches away from the tab mid-run and returns, **Then** the
   app is still responsive and no duplicate or overlapping music is audible.

### Edge Cases

- **The loop point.** A plain restart at the end of an MP3 leaves a short silence,
  because encoder padding is part of the file. What does "loop and play from the
  beginning" tolerate — a hard restart, or a gapless join?
- **First gesture never happens.** A player who reads the standings without tapping
  anything hears nothing at all, correctly, under FR-054. The music must not be what
  prompts a gesture.
- **Rapid run start/stop.** Starting a run, backing out, and starting another in quick
  succession must not leave two tracks audible at once.
- **A run shorter than a track, and a run longer than one.** Both are ordinary; the
  first stops mid-track, the second loops.
- **Mute toggled mid-track.** Unmuting should resume, not restart from zero.
- **Tab backgrounded.** Browsers may throttle or suspend audio; returning must not
  produce a second overlapping instance.
- **Phone call or another app taking audio focus** on mobile mid-run.
- **A device that blocks web storage** (already handled for the rest of the app by
  `safeStorage`) must not break the mute preference or the music.
- **The results panel and the wipeout finale** — both are front-end screens reached
  directly from a run, so the handoff back happens while a visual sequence is playing.
- **Free play** is a run for these purposes even though it scores nothing.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-135**: The screens outside a run MUST play "Look Out Below" as their music,
  replacing the runtime-synthesised music loop on those screens.
  [NEEDS CLARIFICATION: which screens count as "outside a run" — see Q3. Assumed:
  boot shell, board, official-run confirmation, and results panel.]
- **FR-136**: A run in progress MUST play "Powder Rush" as its music, for every run
  kind — practice, official, and free play.
- **FR-137**: When either track reaches its end it MUST resume from its beginning
  without player action, and MUST continue doing so indefinitely rather than once.
- **FR-138**: Exactly one music track MUST be audible at any moment. Starting a run
  MUST stop the front-end track; ending one MUST stop the course track.
- **FR-139**: The front-end track MUST NOT restart when the player moves between
  screens that are all outside a run. Moving from the board to the confirmation
  screen and back is not a reason to restart the music.
- **FR-140**: Music MUST remain silent until a deliberate player gesture, and the
  existing persistent mute toggle MUST silence and restore it, preserving FR-054 and
  style-bible A-3 unchanged.
- **FR-141**: The launch, land, pickup and wipeout sound cues MUST remain synthesised
  at runtime and MUST remain audible over the music, preserving FR-058 and style-bible
  A-2 and A-4 for the audio that carries gameplay information.
- **FR-142**: No music track may carry information a player needs to complete a run or
  read the standings. Music is atmosphere only.
- **FR-143**: A failure or delay in obtaining either track MUST NOT prevent a run from
  starting, running, ending, or committing its score, and MUST NOT surface as an
  error to the player. Music degrades to silence; the game does not degrade at all.
- **FR-144**: Music playback MUST NOT affect the simulation. The same seed and the
  same inputs MUST produce the same run, score, and outcome whether music is playing,
  muted, or unavailable.
- **FR-145**: Music playback MUST NOT cause the frame-time or simulation-step budgets
  to be exceeded on reference hardware.
- **FR-146**: The initial payload MUST remain within the 2 MB gzipped budget and time
  to interactive MUST remain within 5 s on Fast 3G with a cold cache, as ADR-0006
  requires. [NEEDS CLARIFICATION: how — lazy loading alone, re-encoding, trimming, or
  a budget amendment. See Q2.]
- **FR-147**: Style-bible rules A-1 and A-2 MUST be amended, and the amendment
  recorded, before this feature merges. An asset that cannot cite a style-bible rule
  is rejected under FR-052, and no current rule admits a recorded track.
  [NEEDS CLARIFICATION: whether to amend the style bible or record a deviation, and
  on what provenance basis. See Q1.]
- **FR-148**: The provenance of both tracks MUST be recorded in the repository, and
  MUST establish that they are original works the project may use, as FR-053 and
  style-bible O-1 require.
- **FR-149**: Both tracks MUST be identifiable in the repository by name, so that a
  reviewer can tell which file satisfies which requirement.

### Key Entities

- **Music Track**: A named piece of recorded music with a fixed duration, a
  provenance record, and exactly one playback context. Two exist: Look Out Below
  (front-end) and Powder Rush (course).
- **Playback Context**: The condition under which a track is the one that should be
  audible. Two exist — _on the course_ and _not on the course_ — and they are mutually
  exclusive and exhaustive, which is what makes FR-138 checkable.
- **Sound Setting**: The player's existing persistent mute preference, which now
  governs music as well as cues.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-039**: On a warm cache, music becomes audible within 1 second of the player's
  first deliberate gesture.
- **SC-040**: A listener cannot identify the loop point by ear across five
  consecutive loops of either track — no audible gap, click, or stutter.
- **SC-041**: The change of music on starting and on ending a run completes within
  half a second, and at no point are two tracks audible together.
- **SC-042**: The front-end track survives at least ten screen changes outside a run
  without restarting.
- **SC-043**: 100% of runs start, complete, and commit their score when the music
  cannot be downloaded, and 100% do so when it downloads slowly.
- **SC-044**: The initial payload stays at or under 2 MB gzipped and time to
  interactive stays at or under 5 s on Fast 3G with a cold cache — both unchanged
  from before this feature.
- **SC-045**: Frame time at the 95th percentile and simulation step time are within
  budget on reference hardware with music playing, and no worse than before this
  feature by more than 5%.
- **SC-046**: A run replayed from the same seed and inputs produces a byte-identical
  score and outcome with music playing, muted, and unavailable.
- **SC-047**: Muting silences all audio within 100 ms, and the preference survives a
  reload.
- **SC-048**: Every shipped audio asset cites the style-bible rule it satisfies, as
  FR-052 requires — which is zero assets failing review, not "documented as an
  exception".

## Assumptions

Recorded here are the defaults taken where the description did not specify. Three
gaps were judged too consequential to default and are raised as clarifications
instead.

- **The two contexts are exhaustive.** Every screen is either a run or not a run, so
  there is no third state needing a third track or a silence. _(Q3 option A.)_
- **"Landing music" and "the loading screen" refer to the same thing** — the
  front-end as a whole, not solely the sub-second boot shell.
- **The existing synthesised music loop is retired entirely**, not merely paused. The
  request says Look Out Below "replaces the current track", and there is no context
  left in which the synth loop would play.
- **Sound effects are unchanged.** The request names two music tracks and says nothing
  about cues, and the cues are load-bearing for accessibility under FR-058.
- **Looping is a plain restart from the first sample**, not a musically-authored loop
  point inside the track. SC-040 asks only that the join not be audible.
- **The handoff between tracks is a cut or a short fade, not a beat-matched
  transition.** Nothing in the request asks for synchronisation between the two.
- **There is no separate music volume control.** The existing single mute toggle
  governs all audio, as it does today.
- **Mixing keeps the cues audible over the music**, since the cues carry information
  and the music does not.
- **Reduced motion does not affect audio.** FR-056 governs motion; there is no
  reduced-audio setting and this feature does not add one.
- **The tracks are the files supplied with this request** and no others; adding a
  third track or per-course music is out of scope.
- **Determinism is unaffected**, because audio is outside the simulation and no
  simulation value derives from playback state. FR-144 and SC-046 exist to keep it
  that way, not because there is a known risk.

## Dependencies

- **Feature 001** supplies the screens, the run economy, the mute toggle, and the
  gesture gate this feature attaches to.
- **`assets/style-bible.md`** must be amended (rules A-1, A-2) before merge — see
  FR-147. This is a hard dependency, not a follow-up.
- **A provenance record** for both tracks — see FR-148. Also a hard dependency.
- **A performance-budget measurement** to demonstrate SC-044. The constitution notes
  that no payload or frame-budget job exists yet, recorded as an open deviation; this
  feature is precisely the kind of change that budget was written to catch, so the
  measurement has to happen even if the job does not exist to automate it.

## Out of Scope

- Changing, adding, or removing any sound effect or gameplay cue.
- Per-course, per-track, or dynamic music that responds to what the player is doing.
- A music volume slider or any audio setting beyond the existing mute toggle.
- Offline caching of the tracks beyond whatever the browser does on its own.
- Any change to the simulation, scoring, courses, run economy, deadline, or standings.
