# Contract: Course Data

**Files**: `data/courses/official.json`, `data/courses/warmup.json`
**Governs**: FR-022, FR-024, FR-028, FR-067, FR-068, FR-081, FR-089, SC-016

Both courses use this schema. That is FR-067's requirement made structural: the
warm-up rehearses everything except the terrain, so it cannot differ in kind.

## Schema

```jsonc
{
  "id": "official",
  "rulesVersion": "1.0.0",
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
  "barriers": [
    // destructible, cleared by attack (FR-081)
    { "x": 3400, "width": 30, "bypassCostTicks": 22 },
  ],
  "pickups": [
    { "x": 900, "y": -30, "value": "small" }, // y relative to terrain
  ],
}
```

Nothing here is random. Where the spec calls for seeded randomness (FR-024), the
seed selects among declared variants — it never generates geometry, so every
property the validator proves holds for every player.

## Validator rules

Run by `src/course/validate.ts` in CI over both courses. **The build fails on any
violation.** These are executable requirements, not review guidance.

| ID   | Rule                                                                                                                                           | Source             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| CV-1 | `terrain` x-values strictly increasing, no duplicates, first `x` = 0, last `x` ≥ `length`                                                      | R3 contact solver  |
| CV-2 | No terrain segment exceeds a maximum slope angle the contact solver can resolve                                                                | R3                 |
| CV-3 | Every `low` obstacle has `clearance` > `crouchHeight` and < `standHeight` — it must be passable crouched and impassable standing               | FR-080             |
| CV-4 | **Every `low` obstacle is followed within its own width by at least `safeReleaseWindowMin` units of clear overhead**, reachable at `baseSpeed` | **FR-089, SC-016** |
| CV-5 | No two `low` obstacles are separated by less than `safeReleaseWindowMin`                                                                       | FR-089             |
| CV-6 | Every barrier's bypass costs more ticks or scores lower than breaking through, using `bypassCostTicks`                                         | FR-081             |
| CV-7 | The course is completable at `baseSpeed` with no crouch except where CV-3 requires it                                                          | FR-035, SC-015     |
| CV-8 | Total achievable pickup and trick bonus is less than the completion base in `scoring.json`                                                     | FR-034             |
| CV-9 | No pickup or barrier is positioned unreachable from any survivable line                                                                        | FR-035             |

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
