# Data Model: Two Recorded Tracks, Looping Forever

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-04

There is no persistent data here at all. What this feature has instead is a manifest,
a small state machine, and a few invariants worth naming. Nothing below touches the
simulation, the draft, or the outbox.

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

The player's mute preference. **In memory only, for the session.**

| Field   | Type      | Rule                                                                     |
| ------- | --------- | ------------------------------------------------------------------------ |
| `muted` | `boolean` | Defaults to `false` on every load. Governs music and `Synth` cues alike. |

**It is deliberately not persisted.** FR-054 and style-bible A-3 require a persistent
toggle and this does not satisfy them — a standing gap that predates this feature,
deferred on 2026-09-04 and carried with an owner in the spec's
[Known deviations](spec.md#known-deviations). SC-047 was narrowed to within-session
behaviour to match. See [R8](research.md#r8--mute-and-an-inherited-defect-this-feature-does-not-fix).

There is therefore no new `localStorage` key, no `safeStorage` use, and no
`src/audio/settings.ts`. `main.ts` reads this the way it reads `synth.isMuted` today,
for the button label.

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
4. **Mute governs every audible path from one call.** Music and `Synth` cues fall
   silent together, and unmuting resumes the current context's piece rather than
   restarting it. SC-047. It does not survive a reload, by decision.

## What this feature does not add

No table, column, migration, or RLS policy. No outbox entry. No change to
`DraftSnapshot`, entries, scores, or the deadline. No new field reaches Supabase, and
**no durable write of any kind** — not even a `localStorage` key.
