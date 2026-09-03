# Contract: Tuning Data

**File**: `data/tuning.json` | **Governs**: FR-036, FR-083, Principle III

Every value governing feel lives here. None may be embedded in code. This file is
what closes constitution Principle III's requirement for _measurable_ acceptance
criteria — the parameters were named in the spec, and this is where they get
numbers.

## How to read the numbers

Units are simulation units: **1 world unit ≈ 1 pixel at the 320 × 180 internal
resolution**, and time is in 60 Hz ticks. Speeds are units per tick.

**These are opening positions, not measurements.** They are chosen to be internally
consistent and to make a full run take roughly 45–60 seconds, and they are expected
to move during playtest. The tolerance column is the part that must hold: a change
outside tolerance is a feel change that requires re-running the acceptance
scenarios, not a tweak.

## Motion

| Key                | Value | Tolerance | Rationale                                                                                                              |
| ------------------ | ----- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `baseSpeed`        | 2.60  | ±0.30     | ~156 units/s. Crosses the 320-wide viewport in ~2 s, so a player sees an obstacle about two seconds before reaching it |
| `tuckSpeedMax`     | 4.20  | ±0.40     | 1.6× base. Enough that tucking is visibly worth it; not so much that reaction time collapses                           |
| `tuckAccel`        | 0.055 | ±0.015    | Base to max in ~29 ticks (0.48 s). Fast enough to feel responsive, slow enough that committing to a tuck is a decision |
| `tuckDecel`        | 0.090 | ±0.020    | Falls back to base in ~18 ticks. Deliberately faster than acceleration: losing speed is cheap, earning it is not       |
| `slopeAccelFactor` | 0.040 | ±0.010    | Multiplier on sin(slope). Steeper is faster within `tuckSpeedMax`                                                      |
| `gravity`          | 0.32  | ±0.05     | Airborne vertical acceleration per tick                                                                                |

## Launch and air

| Key                | Value | Tolerance | Rationale                                                                                                                                                                                                                         |
| ------------------ | ----- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `launchImpulseMin` | 3.4   | ±0.4      | Release with no charge. Clears a low obstacle, no more                                                                                                                                                                            |
| `launchImpulseMax` | 7.2   | ±0.6      | Release at full charge. ~0.75 s of air — one comfortable full rotation                                                                                                                                                            |
| `chargeTicksToMax` | 45    | ±8        | 0.75 s holding the tuck to reach maximum launch                                                                                                                                                                                   |
| `rotationRateMax`  | 0.2   | ±0.030    | Radians per tick. Full rotation in ~31 ticks, inside the ~45 a full-charge launch buys — a full spin is achievable but not free. Raised from 0.115, where a maximum launch bought four fifths of a turn and AC-3 was simply false |
| `airControlFactor` | 0.25  | ±0.10     | How much rotation input affects horizontal drift. Low: air is committed                                                                                                                                                           |

## Landing and wipeout

| Key                              | Value | Tolerance | Rationale                                                                                 |
| -------------------------------- | ----- | --------- | ----------------------------------------------------------------------------------------- |
| `landingAngleTolerance`          | 0.42  | ±0.08     | Radians (~24°) between skier orientation and slope. Outside this is a wipeout (FR-079)    |
| `landingAngleToleranceForgiving` | 0.58  | ±0.10     | Applied for the first 15 ticks after any landing, so a chained landing is not a coin flip |
| `collisionSpeedThreshold`        | 1.80  | ±0.30     | Below this, contact with an obstacle scrubs speed; above it, wipeout                      |

## Crouch and profile

| Key                     | Value | Tolerance | Rationale                                                                        |
| ----------------------- | ----- | --------- | -------------------------------------------------------------------------------- |
| `standHeight`           | 16    | exact     | Collision box height standing                                                    |
| `crouchHeight`          | 9     | exact     | Must clear every `low` obstacle in course data. Enforced by the course validator |
| `crouchTransitionTicks` | 4     | ±1        | Time to change profile. Non-zero so ducking must be anticipated                  |

## Attack — withdrawn

`attackReach` and `attackCooldownTicks` are removed from `tuning.json` by
feature 002's FR-114, along with the verb and the barriers it acted on. They
were 22 units and 30 ticks. Restoring the verb restores both keys.

## Course validation constants

| Key                    | Value | Tolerance | Rationale                                                                                                                                                                  |
| ---------------------- | ----- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `safeReleaseWindowMin` | 140   | ±20       | Units of clear overhead required after every low obstacle (FR-089). At `baseSpeed` this is ~54 ticks — comfortably longer than `crouchTransitionTicks` plus human reaction |

## Acceptance criteria

These are the Principle III criteria and are asserted by tests, not by eye:

- **AC-1**: Input to visible response ≤ 2 simulation frames for all three inputs (FR-031)
- **AC-2**: A run at `baseSpeed` with no crouch completes the official course in 45–75 s
- **AC-3**: A full rotation is achievable from a full-charge launch and not from a
  zero-charge launch. **Asserted by `tests/sim/rotation.test.ts`.** It had no test
  until feature 002 and was false for the whole of 1.0.0 and 1.1.0: at
  `rotationRateMax` 0.115 no launch bought a complete turn, so the trick bonus
  was unreachable by anyone
- **AC-4**: `crouchHeight` clears every obstacle marked `low` in both courses
- **AC-7**: A pilot who holds a tuck on the open piste rides every shelf on the
  official course; a pilot who never tucks rides none of them, and both finish.
  Asserted by `tests/sim/tracks.test.ts` against the shipped courses
- **AC-5**: Every parameter above is read from this file; no literal governing feel appears in `src/sim/`, asserted by lint
- **AC-6**: Changing any value here changes behaviour with no recompile (FR-036)

## Change rules

Changing a value **within** tolerance is a tuning change. Changing one **outside**
tolerance, or changing a tolerance, is a feel change: it requires re-running the
acceptance scenarios, bumps `rules_version`, and — if any official run has committed
— invalidates the draft under FR-023.
