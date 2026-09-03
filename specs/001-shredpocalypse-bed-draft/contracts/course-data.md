# Contract: Course Data

**Files**: `data/courses/official.json`, `data/courses/warmup.json`
**Governs**: FR-022, FR-024, FR-028, FR-067, FR-068, FR-081, FR-089, SC-016

Both courses use this schema. That is FR-067's requirement made structural: the
warm-up rehearses everything except the terrain, so it cannot differ in kind.

## Schema

```jsonc
{
  "id": "official",
  "rulesVersion": "1.1.0",
  "length": 12000, // world units, finish line at x = length
  "terrain": [
    // piecewise-linear height profile
    { "x": 0, "y": 0 }, // strictly increasing x, no duplicates
    { "x": 400, "y": 90 }, // y increases downhill
  ],
  "obstacles": [
    {
      "x": 1200,
      "kind": "low", // "low" | "solid"
      "width": 40,
      "clearance": 11, // gap under a "low"; must exceed crouchHeight
    },
  ],
  "pickups": [
    { "x": 900, "y": -30, "value": "small" }, // y relative to terrain
  ],
  "ledges": [
    // the upper track: a shelf of snow parallel to the piste, at a constant
    // height above it. One-way — landed on from above, passed up through from
    // below — and open at both ends.
    { "x0": 1496, "x1": 2396, "height": 50 },
  ],
  "kickers": [
    // a ramp. Crossing the lip at x + width while grounded launches the skier
    // by power * carried speed, capped at `kickerImpulseMax`.
    { "x": 1400, "width": 56, "power": 1.9 },
  ],
}
```

`ledges` and `kickers` both default to `[]`. A course with neither is still a
valid course — it simply has one line down the mountain instead of two.

Nothing here is random. Where the spec calls for seeded randomness (FR-024), the
seed selects among declared variants — it never generates geometry, so every
property the validator proves holds for every player.

## Why a ledge is an offset and not a polyline

A ledge is the terrain profile translated upward by a constant, which means its
slope at any x is identical to the slope of the piste beneath it. That is not a
simplification, it is the load-bearing choice: landing on a shelf and landing on
the piste face the same tolerance check, and riding off the end of a shelf can
never present the skier an angle he was not already riding. A free-form upper
polyline would have needed its own copy of CV-2 and CV-10, and a second class of
bad landing to test for.

## Validator rules

Run by `src/course/validate.ts` in CI over both courses. **The build fails on any
violation.** These are executable requirements, not review guidance.

| ID       | Rule                                                                                                                                           | Source             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| CV-1     | `terrain` x-values strictly increasing, no duplicates, first `x` = 0, last `x` ≥ `length`                                                      | R3 contact solver  |
| CV-2     | No terrain segment exceeds a maximum slope angle the contact solver can resolve                                                                | R3                 |
| CV-3     | Every `low` obstacle has `clearance` > `crouchHeight` and < `standHeight` — it must be passable crouched and impassable standing               | FR-080             |
| CV-4     | **Every `low` obstacle is followed within its own width by at least `safeReleaseWindowMin` units of clear overhead**, reachable at `baseSpeed` | **FR-089, SC-016** |
| CV-5     | No two `low` obstacles are separated by less than `safeReleaseWindowMin`                                                                       | FR-089             |
| ~~CV-6~~ | _Withdrawn with the barrier entity by feature 002's FR-114._ Required a barrier's bypass to cost more than breaking through                    | FR-081             |
| CV-7     | The course is completable at `baseSpeed` with no crouch except where CV-3 requires it                                                          | FR-035, SC-015     |
| CV-8     | Total achievable pickup and trick bonus is less than the completion base in `scoring.json`                                                     | FR-034             |
| CV-9     | No pickup or barrier is positioned unreachable from any survivable line                                                                        | FR-035             |
| CV-10    | Adjacent terrain segments differ in slope by no more than `landingAngleTolerance`                                                              | FR-089, CV-7       |
| CV-11    | No `solid` obstacle sits inside a `low` obstacle's safe release window                                                                         | FR-088, CV-7       |
| CV-12    | Ledges have positive span, lie inside the course, and never overlap one another                                                                | R3 contact solver  |
| CV-13    | **Every ledge is reachable at `tuckSpeedMax` and unreachable at `baseSpeed`**                                                                  | **FR-035, SC-015** |
| CV-14    | Every ledge clears the top of every bough it crosses, with margin                                                                              | FR-035             |
| CV-15    | No kicker sits inside a `low` obstacle's safe release window or overlaps a `solid` one                                                         | FR-088             |

**CV-13 is the upper track's version of the same trap, and it is why the rule has
two halves rather than one.** A ramp too weak to reach the shelf makes the upper
track scenery — visible, never usable. A ramp strong enough to throw a
_base-speed_ skier onto it is worse: it takes the single line SC-015 and FR-035
promise the cautious pilot and replaces it with one he never chose, silently, on
a course that still validates. So the shelf must be reachable by a player
carrying speed and unreachable by one who is not. The gap between those two
apex heights is the upper track's entry fee, and `tests/sim/tracks.test.ts`
rides both pilots down the real course to prove the fee is actually charged —
CV-13 checks the arithmetic, the simulation checks the claim.

**CV-4 is the one that matters most.** FR-088 makes releasing a crouch under a low
obstacle fatal, and ducking requires crouching, so a cautious player cannot opt out
of the mechanic. A single low obstacle placed just before a tunnel makes the course
unfinishable for exactly the players FR-035 protects, and it would not be visible
by eye — it would surface as one friend saying the game is broken, after the draft
has already started.

## Change rules

Any edit to `official.json` after the first official run commits invalidates the
draft under FR-023. The validator does not enforce that — the storage layer does,
by refusing commits whose `rules_version` differs from the draft's.
