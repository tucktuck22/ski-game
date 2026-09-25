# Data Model: Finish Line

Nothing here is simulation state. Every entity is presentation, and none of it can
reach `RunState`, a score or the rules version (FR-264).

## FinishConfig (`data/finish.json`)

| Field                  | Value     | Meaning                                                                                                                                                                                |
| ---------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `holdTicks`            | 156       | Length of the hold, in simulation ticks. Equals the wipeout's (FR-266).                                                                                                                |
| `reducedHoldTicks`     | 54        | The same, under reduced motion.                                                                                                                                                        |
| `runoutEase`           | 160       | Units past L over which the drawn ground eases to flat (R1).                                                                                                                           |
| `stopDistance`         | 200       | The furthest the skier slides after touching down (R2).                                                                                                                                |
| `stopWithinTicks`      | 90        | The skier is stopped this many ticks after crossing the line, time in the air included; no slide is shorter than 20 ticks. Whichever of this and `stopDistance` brakes harder applies. |
| `frameLead`            | 60        | The camera holds with L this far inside the frame's left edge (R7).                                                                                                                    |
| `frameFollow`          | 240       | The camera resumes following if the skier would pass this far into the frame.                                                                                                          |
| `gantryHeight`         | 100       | The gantry's crossbar height above the piste at L. Must clear the tallest shelf plus a standing skier.                                                                                 |
| `bannerWidth`          | 60        | The banner's width, centred on L.                                                                                                                                                      |
| `crowdFrom`, `crowdTo` | −120, 420 | The crowd's extent relative to L.                                                                                                                                                      |
| `crowdSpacing`         | 9         | Units between crowd slots.                                                                                                                                                             |

**Validation** (`parseFinish`):

- Every field is a finite number.
- Tick counts are positive integers.
- `crowdFrom` < `crowdTo`, and `crowdSpacing` > 0.
- Everything except `crowdFrom` is non-negative.
- `gantryHeight` exceeds the tallest ledge on either course plus `standHeight`; this is
  asserted in a test, not by the parser, because the parser does not see the courses.

## Drawn ground: `groundY(course, x)`

- `x ≤ L`: `terrainYAt(course.terrain, x)`, identical.
- `L < x ≤ L + runoutEase`: `y(L) + g·u − g·u²/(2·runoutEase)`, where `u = x − L` and `g`
  is the slope of the segment ending at L.
- `x > L + runoutEase`: flat at the end value.

It is continuous with a continuous slope. Used by the renderer, the look-down and the
finish sequence; never by `src/sim`.

## FinishSequence

Created from the final `RunState` on the tick a run finishes.

**State**: `tick`, `x`, `y`, `vx`, `vy`, `ox`, `oy` (orientation), `phase`, `brake` (the
deceleration fixed at touchdown), and `skipped`.

**Phases and transitions**:

```text
airborne --(y reaches groundY)--> braking --(vx reaches 0)--> stopped
    │                                 │                          │
    └──────── skip or tick ≥ hold ────┴──────────────────────────┴──> done
```

- It starts `airborne` if the final state is not grounded, or if it is on a ledge
  (every ledge ends at or before L). Otherwise it starts `braking`.
- `airborne`: `vy += gravity`, and the orientation eases towards the ground's slope,
  taking at least 8 ticks.
- `braking`: `vx -= brake` with `brake = max(vx²/(2·stopDistance), vx/max(stopWithinTicks − ticksSinceCrossing, 20))`,
  set once at touchdown; `y = groundY(x)`.
- `stopped`: holds position; the pose is standing.
- `done` once `skipped`, or once `tick ≥ holdTicks` (or `reducedHoldTicks`).

**Outputs per tick**: a drawable skier state (the `RunState` fields the renderer
reads), the camera position (R7), and the crowd's state.

## Crowd

- **Slots**: one every `crowdSpacing` units from L + `crowdFrom` to L + `crowdTo`, in
  two rows. The back row stands 6 units higher and draws 1 unit shorter.
- **Figure** (derived from a hash of the slot, never from an RNG): height 11 to 14,
  build, whether it carries a flag (about 1 in 5) and its colour (`yellow` or `cyan`),
  whether it throws a hat (about 1 in 10), and a phase offset.
- **Feet**: 2 units below `groundY`, hidden by the snow edge.
- **States**: `idle` before the crossing, `celebrating` from the crossing tick. The run
  view reads this from whether a `FinishSequence` exists.
