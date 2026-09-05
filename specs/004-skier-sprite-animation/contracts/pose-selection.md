# Contract: State → Pose

The UI contract between the simulation's state and what the player sees. This table
**is** the unit-test table (research R6) — each row is one case in
`tests/unit/skier-pose.test.ts`.

```
selectPose(
  state:  Readonly<RunState>,
  absorb: AbsorbTimer,
  lean:   LeanState,          // carries the current bucket for hysteresis
): PoseKey
```

`Readonly<RunState>` is load-bearing: it makes the constitution's "rendering MUST NOT
mutate simulation state" a compile error rather than a review comment.

---

## Precedence

Evaluated top to bottom. **First match wins.** The order is the contract — several
conditions are true at once in normal play, and getting the order wrong is how a
crashed skier ends up drawn mid-carve.

| #   | Condition                                                            | Pose           | Requirement    |
| --- | -------------------------------------------------------------------- | -------------- | -------------- |
| 1   | `state.outcome` is a wipeout, or the death sequence is running       | `wipeout`      | FR-165, FR-167 |
| 2   | `state.spinTicksLeft > 0`                                            | `spin`         | FR-167         |
| 3   | `!state.grounded` and rising (`state.vy < 0`)                        | `air`          | FR-165         |
| 4   | `!state.grounded` and falling (`state.vy >= 0`)                      | `tuck`         | FR-165         |
| 5   | `absorb.ticks > 0`                                                   | `absorb{Lean}` | FR-165, FR-168 |
| 6   | `state.crouchProfile >= CROUCH_POSE_THRESHOLD`                       | `crouch{Lean}` | FR-165, FR-166 |
| 7   | launch window: grounded, and the previous tick was a charged release | `launch`       | FR-165         |
| 8   | otherwise                                                            | `carve{Lean}`  | FR-165         |

`{Lean}` resolves to `Shallow`, `Mid` or `Steep` per the bucketing in
[`../data-model.md`](../data-model.md#2-lean-bucket--derived-not-stored).

### Why the order is what it is

- **Wipeout outranks everything.** Rule 1 above rule 5 is FR-167's explicit demand:
  a touchdown that ends the run under FR-124 must not be drawn as a clean landing.
  The frame the run ends is the frame the player will remember, and drawing an absorb
  there would tell him he landed it.
- **Spin outranks air.** A spin is the only place continuous rotation survives (Q2),
  so it must be identifiable as its own case rather than inferred from airborne-ness.
- **Absorb outranks crouch.** Landing compression and a held crouch are visually
  similar and mechanically opposite. On touchdown `crouchProfile` may be non-zero
  from a crouch held through the air; absorb is what actually just happened.
- **Launch is last among grounded cases** because it is the narrowest — it describes
  one or two ticks, and anything else true at that moment is more informative.

---

## Rule 7: the launch window

The only rule that reads more than the current tick, and the one most easily got
wrong.

Launch is not a `RunState` field (FR-164 forbids adding one). The view derives it the
way `LandingEffect` derives touchdown — by comparing consecutive states. The
condition is: the skier is grounded, was crouched with charge on the previous tick,
and is no longer crouch-held.

**It is time-boxed to a small number of ticks** and expires on its own. Without the
box, a state that never advances (a paused frame, a stalled tab) would hold the
launch pose indefinitely.

---

## Reduced motion (FR-174, SC-060)

**This function does not read `MotionSettings` at all.**

That is the contract, not an omission. Every pose in this table carries state, and
FR-174 says what may be suppressed is decorative movement, never a message. Making
pose selection motion-aware would create a path where reduced motion changes what the
player is _told_, which is what LT-6 forbids.

What reduced motion suppresses instead, in the drawing code around this function:

| Suppressed                                                                 | Kept                          | Why                                            |
| -------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| Multi-cell cycling within a static-state pose (e.g. an idle carve flutter) | The pose itself               | Decoration vs. message                         |
| The existing rooster tail, landing flash, camera shake                     | —                             | Already gated today; unchanged by this feature |
| —                                                                          | Absorb, and its full duration | It reports a landing, which is information     |

**Test obligation**: SC-060 is satisfied by running the entire table above with
`REDUCED_MOTION` in effect and asserting the pose is _identical_ in every row. If any
row differs, reduced motion has changed what the player is told.

---

## Edge cases this table must answer

Each is a named test case; each corresponds to an edge case in the spec.

| Case                                                  | Expected                             | Note                                                                 |
| ----------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Touchdown with `spinTicksLeft > 0` (run ends, FR-124) | `wipeout`                            | Rule 1 before rule 2 before rule 5                                   |
| Ramp relaunch two ticks into an absorb                | `air` or `tuck`, never `absorb*`     | Absorb cancelled on leaving the ground (data-model transition 3)     |
| `crouchProfile` hovering at the threshold             | Stable; no alternation               | FR-166. Same hysteresis argument as the lean buckets                 |
| Slope angle sitting exactly on a lean boundary        | Stable; whichever bucket was current | FR-184, research R8                                                  |
| Slope steeper than the measured 31.76° band           | `*Steep`, clamped                    | Data-model: clamp, never throw                                       |
| Riding a ledge                                        | Same pose as the piste at that x     | Ledge slope is identical by construction (`src/sim/types.ts`)        |
| Airborne at the exact apex (`vy === 0`)               | `tuck`                               | Rule 4's `>=` makes the boundary deterministic rather than undefined |

---

## What this contract does not cover

- **Where the sprite is drawn.** Position, camera and the wipeout slide are
  `draw.ts`'s business and are unchanged by this feature.
- **Which cell a pose maps to.** That is the manifest's job
  ([`sprite-manifest.md`](./sprite-manifest.md)) — deliberately, so re-cutting the
  sheet never requires touching this logic.
- **What happens when the sheet is missing.** The fallback renderer (research R4)
  does not consult this table; it draws the incumbent primitive skier, which has no
  poses.
