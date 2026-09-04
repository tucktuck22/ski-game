# Data Model: Two Recorded Tracks, Looping Forever

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-04

There is no persistent domain data here beyond one preference string. What this
feature has instead is a manifest, a small state machine, and one invariant worth
naming. Nothing below touches the simulation, the draft, or the outbox.

## Entities

### MusicTrack

A named piece of recorded music with exactly one playback context. Declared in
`data/audio.json`, never constructed in code.

| Field       | Type                               | Rule                                                                                                                       |
| ----------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`        | `'lookOutBelow'` \| `'powderRush'` | Exactly these two, named so a reviewer can tell which asset satisfies which requirement (FR-149). A third is out of scope. |
| `file`      | string                             | Filename only, no path and no leading slash. The base is applied at load (R5). Must end `.mp3`.                            |
| `context`   | `'frontEnd'` \| `'course'`         | The one condition under which this piece is audible. The two are exhaustive and exclusive.                                 |
| `gain`      | number, `0 < g <= 1`               | Mix level. A feel value, so it lives here rather than in code (R7).                                                        |
| `loopStart` | number, seconds, `>= 0`            | Optional. Present only for the buffer-looped piece. Measured on the **shipped** encode.                                    |
| `loopEnd`   | number, seconds                    | Optional. Must satisfy `loopStart < loopEnd <= duration`.                                                                  |

**Validation** (in `src/data/load.ts`, following the existing `assembleGameData`
pattern): both ids present exactly once; contexts cover `frontEnd` and `course` exactly
once each; `gain` in range; `loopStart`/`loopEnd` well-ordered when present. A manifest
that fails validation is a build-time defect, not a runtime fallback — the game boots
with music broken rather than not at all, per FR-143, but the validator must have
already rejected it in CI.

**Why `file` is a bare filename**: forcing the caller to apply
`import.meta.env.BASE_URL` makes the base path a single decision in a single place. A
manifest carrying `/audio/x.mp3` would silently work in dev and 404 in production —
the exact defect class recorded in `vite.config.ts` (R5).

### PlaybackContext

Not stored; derived. The condition determining which track should be audible.

| Value      | Means                                                          | Screens                                                     |
| ---------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| `frontEnd` | No run is in progress                                          | Boot shell, board, official-run confirmation, results panel |
| `course`   | A run is in progress, any kind — practice, official, free play | The canvas view, including the wipeout finale               |

The two are **exhaustive and mutually exclusive**, which is exactly what makes FR-138
("exactly one music track audible at any moment") checkable rather than aspirational.
In `main.ts` the discriminator already exists and is not new state: `game !== null` is
true for precisely the `course` context and false for precisely the `frontEnd` one.

### SoundSetting

The player's mute preference. One string in `localStorage` via `safeStorage`.

| Field | Type                     | Rule                                                                  |
| ----- | ------------------------ | --------------------------------------------------------------------- |
| key   | `'shredpocalypse-muted'` | Mirrors `shredpocalypse-reduced-motion` in naming and mechanism (R8). |
| value | `'muted'` \| `'on'`      | Any other value, including absent, resolves to `'on'`.                |

Denied storage must fall through to the default without throwing, as
`reducedMotion.ts` already does. A device that blocks site data is a supported device
here — that defect has already been fixed once in this project.

**This is new persistence.** The preference is not stored today, though FR-054 and
style-bible A-3 require it. See [R8](research.md#r8--mute-and-an-inherited-defect-this-feature-has-to-absorb).

## State machine

The player has four states. Transitions are driven only by context changes and the
mute toggle — never by the simulation, and never by a timer.

```text
                   ┌──────────────────────────────────────────┐
                   │                                          │
   page load       ▼                first gesture             │
  ──────────► [ SILENT ] ─────────────────────────────► [ FRONT_END ]
                   ▲                                     │      ▲
                   │ mute                          start │      │ end of run
                   │                                 run │      │ (after finale)
                   │                                     ▼      │
               [ MUTED ] ◄──── mute ──────────────► [ COURSE ]──┘
                   │                                     ▲
                   └──────── unmute, resumes ────────────┘
                             the context's piece
```

| From        | Event                     | To          | Notes                                                                                             |
| ----------- | ------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `SILENT`    | first deliberate gesture  | `FRONT_END` | FR-140 / A-3. Also what browser autoplay policy requires.                                         |
| `SILENT`    | first gesture while muted | `MUTED`     | A stored preference is honoured before anything is heard.                                         |
| `FRONT_END` | run starts                | `COURSE`    | FR-138: the front-end piece stops before the course piece starts.                                 |
| `COURSE`    | run ends, finale complete | `FRONT_END` | Restarts from the beginning (US2 scenario 5). The finale keeps the course piece (US2 scenario 3). |
| any audible | mute                      | `MUTED`     | Position is retained, not reset (edge case: "unmuting should resume").                            |
| `MUTED`     | unmute                    | context's   | Resumes the piece the _current_ context calls for, not the one interrupted.                       |

**Screen changes within `frontEnd` produce no transition at all.** That is FR-139, and
it is why the state is keyed on context rather than on screen.

## Invariants

1. **At most one source is playing.** Enforced structurally: a single `current` handle,
   and every start path stops it first. FR-138.
2. **No state is read by the simulation.** No field here is reachable from `src/sim/`.
   FR-144, and the reason SC-046 is assertable.
3. **Every failure resolves to silence.** Load, decode, and play failures all leave the
   machine in a valid state with no audible output and no error surfaced. FR-143.
4. **The mute preference outlives the player object.** It is read before the
   `AudioContext` exists and applied when one is created. SC-047.

## What this feature does not add

No table, column, migration, or RLS policy. No outbox entry. No change to
`DraftSnapshot`, entries, scores, or the deadline. No new field reaches Supabase. The
only durable write is one `localStorage` key on the player's own device.
