# Contract: Music Playback

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

What the music player promises to the rest of the application, and what the rest of
the application may assume. Behaviour, not implementation: the split between a decoded
buffer and a streamed element ([R2](../research.md#r2--playback-mechanism)) is an
internal detail and is not part of this contract.

## Surface

Four operations. Nothing else is exposed.

| Operation                            | Promise                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `arm()`                              | Called once, from the first deliberate gesture. Before it, nothing is audible under any circumstances.        |
| `setContext('frontEnd' \| 'course')` | The named context's piece becomes the only audible music. Idempotent: setting the current context is a no-op. |
| `setMuted(boolean)`                  | All music falls silent, or resumes the current context's piece. Session-scoped.                               |
| `destroy()`                          | Everything stops and releases. Safe to call in any state, including twice.                                    |

**Every operation returns `void` and never throws, in any state, for any reason.** A
caller that needs to know whether music is playing has a design problem: nothing in
this application is allowed to depend on that.

## Guarantees

- **G1 — Silent until armed.** No audio before `arm()`. (FR-140, FR-054, A-3.)
- **G2 — Exactly one piece.** At no instant are two pieces audible. Switching stops
  before it starts. (FR-138.)
- **G3 — Loops forever.** On reaching its end, a piece resumes from its beginning
  without a caller doing anything, indefinitely. (FR-137.)
- **G4 — Gapless where it is heard.** The front-end piece's loop join carries no
  audible gap, click, or stutter. (SC-040. See the asymmetry note below.)
- **G5 — Context is sticky within itself.** Repeated `setContext` calls with the
  current value change nothing — the piece does not restart. (FR-139.)
- **G6 — Failure is silence.** A missing file, a refused `play()`, a decode error, or a
  fetch still in flight all produce no music and no error. Never a rejected promise
  reaching a global handler, never a retry storm, never a blocked caller. (FR-143.)
- **G7 — Mute is total, and resumes rather than restarts.** One call silences music
  and `Synth` cues alike within 100 ms; unmuting picks the current context's piece back
  up where it was. Session-scoped: it does **not** survive a reload, which is a known
  deviation from FR-054 and A-3, not an oversight. (SC-047, and the spec's
  [Known deviations](../spec.md#known-deviations).)
- **G8 — Nothing here is reachable from the simulation.** (FR-144, SC-046.)
- **G9 — Nothing here blocks.** No operation delays a run's start, its ticks, or its
  commit. (FR-143, SC-043.)

### The asymmetry in G4, stated deliberately

G4 binds the **front-end** piece only. The course piece is 220.1 s and the longest
possible run is 76.9 s, so its loop join is unreachable
([R1](../research.md#r1--how-long-is-a-run-and-does-the-course-music-ever-loop)).
G3 still binds it — the loop is implemented and correct — but no gapless guarantee is
offered for a join no player can hear, and buying one would cost 42.3 MB of heap.

Per Principle VI, this is stated as an explicit gap rather than left implied. **If the
course piece is ever shortened below the longest run, or a course is ever lengthened
past the piece, G4 must be extended to cover it.**

## Caller obligations

The application must:

1. Call `arm()` from the same first-gesture handler that starts the `Synth`, not from a
   separate listener. Two gates drift apart.
2. Call `setContext('course')` when a run's view is created and
   `setContext('frontEnd')` after the finale resolves and the view is destroyed — not
   when the run's score commits. The score commits before the wipeout finishes playing,
   and the music belongs to the screen, not to the transaction. (US2 scenario 3.)
3. Route the mute button through this contract **and** the `Synth`, from one call site.
   Two mute paths is one too many.
4. Never branch on whether music is playing.

## Data contract

`data/audio.json`. Shape and validation rules in
[../data-model.md](../data-model.md#musictrack); this is the shipped shape.

```json
{
  "$comment": "Mix gains are feel values and loop offsets are measurements of the SHIPPED encode, not the master. Re-encoding invalidates loopStart/loopEnd: re-measure, do not carry them over.",
  "tracks": [
    {
      "id": "lookOutBelow",
      "file": "look-out-below.mp3",
      "context": "frontEnd",
      "gain": 0.5,
      "loopStart": 0.026,
      "loopEnd": 87.75
    },
    {
      "id": "powderRush",
      "file": "powder-rush.mp3",
      "context": "course",
      "gain": 0.45
    }
  ]
}
```

`gain` values above are opening positions for playtest, not measurements — the same
convention as `data/tuning.json`. They must leave the `Synth` cues clearly audible over
the music (FR-141): the cues carry gameplay information and the music carries none.

`loopStart`/`loopEnd` above are **placeholders**. They must be measured against the
shipped file once it exists and replaced. Shipping the placeholders would produce
exactly the audible seam G4 forbids.

## URL construction

One rule, and it is the highest-risk line in the feature:

```text
url = import.meta.env.BASE_URL + 'audio/' + track.file
```

`BASE_URL` is `/ski-game/` in production and `/` in dev. No other construction is
permitted — no leading slash on `file`, no relative `./`, no hardcoded prefix. A
relative path already shipped a blank page to players from this repository, and audio
fails _silently_, so the same mistake here would not announce itself.

This is asserted by an end-to-end test against the **built artifact served at
`/ski-game/`, entered with no trailing slash**. A passing dev-server check proves
nothing about this and must not be offered as evidence (Principle VI).

## Test obligations

| Guarantee | Proven by                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1        | Unit: no source starts before `arm()`.                                                                                                             |
| G2        | Unit: every `setContext` transition stops the outgoing source before starting the incoming.                                                        |
| G3        | Unit: loop flag set on both sources. Manual: leave the board past 88 s.                                                                            |
| G4        | Manual, on the shipped encode: five consecutive loops, listened to.                                                                                |
| G5        | Unit: repeated `setContext('frontEnd')` does not restart the source.                                                                               |
| G6        | Unit: rejected `play()`, 404, and decode error each leave a valid silent state. E2e: a full run with audio requests blocked completes and commits. |
| G7        | Unit: one `setMuted` silences both paths; unmuting resumes rather than restarts.                                                                   |
| G8        | Lint/grep: no `src/sim/` import reaches `src/audio/`.                                                                                              |
| G9        | E2e: run start-to-commit timing unchanged with audio blocked, and score identical (SC-046).                                                        |
