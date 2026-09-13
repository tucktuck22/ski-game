# Contract: Coaching Cues

**Feature**: 005 | **Requirements**: FR-189, FR-190, FR-190a, FR-190b, FR-191, FR-194, FR-197

Two modules, one seam. Selection is pure and lives in `src/render/coachingCue.ts`;
presentation is DOM and lives in `src/ui/coachingBadge.ts`. The seam exists so the
lead distances — the numbers this feature's teaching value actually rests on — are
testable without a browser.

---

## Selection: `src/render/coachingCue.ts`

```ts
export interface Cue {
  readonly id: 'crouch' | 'jump' | 'stayCrouched' | 'flip';
  readonly from: number; // world x where it becomes legible
  readonly to: number; // world x where it clears
  readonly text: string; // verbatim, FR-190
}

/** The cue legible at world x, or null. Total, pure, allocation-free. */
export function cueAt(x: number): Cue | null;

/** The table itself, exported for the tests that police it. */
export const CUES: readonly Cue[];
```

**A cue's `from` is its object's x minus `PLAYER_LOOKAHEAD`** — the point at which
that object crests the frame edge. `PLAYER_LOOKAHEAD` is 213.333 and lives in
`src/render/stage.ts`, where it is already documented as "the reaction time the course
is allowed to assume"; CV-24 reads the same constant for the same reason. Importing it
rather than restating it is what keeps the cue and the frame from drifting apart.

> **This module exported `CUE_LEAD = 389` until 2026-09-12.** That was R2's
> lead-distance workaround, built when speed was pinned to `baseSpeed` and a gentler
> gradient bought nothing. Feature 006 made gradient the speed control and roughly
> doubled the reading time, so R7 option C withdrew the lead entirely and FR-191 ships
> as the maintainer approved it — bound to its object's visibility, which he chose
> explicitly as "simpler and harder to break". The retired figure is recorded here, not
> deleted, so the next reader does not reintroduce it from the historical findings. See
> [research R7](../research.md#r7--what-feature-006-did-to-r1-and-r2).
>
> The re-baseline pass of 2026-09-12 corrected `spec.md`, `plan.md`, `research.md`,
> `data-model.md` and `quickstart.md` and **missed this file**. It was reconciled on
> 2026-09-12 by feature 005's T001.

### Guarantees

| #   | Guarantee                                                                         | Requirement |
| --- | --------------------------------------------------------------------------------- | ----------- |
| 1   | `cueAt` returns at most one cue for any x — intervals are disjoint                | FR-191      |
| 2   | `cueAt` is total: any finite x, including negative and past the finish, is legal  | II          |
| 3   | `cueAt` reads no clock, no state, no storage, and holds nothing between calls     | II          |
| 4   | Every cue's `from` is its object's x minus `PLAYER_LOOKAHEAD` — object visibility | FR-191, R7  |
| 5   | Every cue's `to` is at or past its object's trailing edge                         | FR-191      |
| 6   | Every interval lies inside the coached section, so none fires on warm-up terrain  | FR-197      |
| 7   | The four `text` values are exactly the strings in FR-190, arrows included         | FR-190      |

### Copy, fixed

| id             | text                    |
| -------------- | ----------------------- |
| `crouch`       | `HOLD TO CROUCH!`       |
| `jump`         | `RELEASE TO JUMP!`      |
| `stayCrouched` | `STAY CROUCHED!`        |
| `flip`         | `SWIPE OR ← → TO FLIP!` |

Arrows are U+2190 and U+2192. FR-190a forbids varying this string by device: one
string, always correct, no detection. FR-190b allows substituting a _drawn_ mark if a
glyph does not render on the platform baseline, and forbids falling back to the word
"arrow".

### Non-goals

- No knowledge of input devices, `RunState`, canvases, or the DOM.
- No opinion on whether the player obeyed. The cue tells; it never checks.

---

## Presentation: `src/ui/coachingBadge.ts`

```ts
/** Mounts the single coaching slot inside the existing #badges host. */
export function mountCoachingBadge(host: HTMLElement, motion: MotionSettings): CoachingBadge;

export interface CoachingBadge {
  /** Shows `cue`, replacing whatever was up. `null` clears the slot. */
  set(cue: Cue | null): void;
  destroy(): void;
}
```

### Guarantees

| #   | Guarantee                                                                               | Requirement |
| --- | --------------------------------------------------------------------------------------- | ----------- |
| 1   | At most one coaching badge exists in the DOM at any moment                              | FR-191      |
| 2   | The badge is removed only by `set(null)` or `destroy()` — **never by a timer**          | R6          |
| 3   | Trick badges and the coaching badge occupy separate slots and never displace each other | FR-191      |
| 4   | Under reduced motion the movement is dropped and the message and hold are kept          | FR-194      |
| 5   | The badge never overlaps the contact line or the hazard it points at                    | L-0         |
| 6   | Rendered in the trick badge's visual idiom — sound-effect lettering, panelled           | FR-189      |

### Why no timer

`popTrickBadge` removes its element after `LIFETIME_MS = 1100`. A trick badge reports
something already finished, so a wall clock suits it. A coaching badge describes an
object that is still ahead, on the simulation tick. On a slow frame a timer clears the
instruction while its object has not arrived — the one failure the player cannot
recover from, because he never gets the cue again. Position drives it instead.

### Reduced motion

Inherited, not rebuilt. `.badge-still` and the `badge-hold` keyframe already exist in
`src/ui/style.css` and already do what FR-194 asks. The coaching badge takes the same
class from the same `resolveMotion()` call the run already makes.

---

## Driving the seam: `src/ui/game.ts`

`GameView.tick()` already holds `prevState` and `state` for exactly this kind of
edge. The cue change is derived the same way the landing flash and the trick payout
are — from the two states either side of a tick, with nothing added to `RunState`:

```
const before = cueAt(this.prevState.x);
const after  = cueAt(this.state.x);
if (before !== after) this.onCue(after);
```

Identity comparison is sufficient and intentional: `CUES` entries are frozen
singletons, so `!==` is a transition and never a false positive.

### Guarantees

| #   | Guarantee                                                       | Requirement |
| --- | --------------------------------------------------------------- | ----------- |
| 1   | The callback fires only on a transition, never once per tick    | perf        |
| 2   | Nothing is added to `RunState`; the state hash is unchanged     | II, FR-204  |
| 3   | The cue is cleared on `destroy()`, so no badge outlives its run | II          |
| 4   | Cues appear in PRACTICE runs only — not official, not free play | FR-197      |

~~Guarantee 4 needs no branch in this file: the cue table's intervals lie inside the
coached section of the warm-up course (selection guarantee 6), and `courseFor()`
routes official runs to `official.json`. A run on the official course simply never
finds a cue.~~

**WRONG, and corrected 2026-09-12 during implementation.** `cueAt` is a function of
**x alone** — it has no idea which course is loaded — and both courses start at x=0.
An official run therefore rides straight through every cue interval and is coached
through a scored descent. `tests/e2e-build/coached-run.spec.ts` caught a badge on the
official course on its first run.

Gating on the course would not have been enough either: `courseFor()` serves the
**warm-up** course to free play until the official run is committed, and FR-197
excludes free play by name as well as official runs.

**Guarantee 4 is enforced by a branch on the RUN KIND**, in `src/main.ts`: the badge
is mounted only when `kind === 'practice'`. That is what FR-197 actually says —
"it is a property of practice" — rather than a consequence of the course routing.
`tests/unit/coaching-cue.test.ts` asserts the falsehood above explicitly, so the
elegant-sounding version cannot be restored by someone reading this paragraph.
