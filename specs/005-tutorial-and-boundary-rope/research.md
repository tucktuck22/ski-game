# Phase 0 Research: A Coached First Run, and a Rope You Can See

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-09

Every number below was measured against the shipped simulation, not reasoned about.
The probe drove `src/sim/step.ts` through `initialState`/`step` with the real
`data/tuning.json`, and is reproduced in [quickstart.md](./quickstart.md) so any
reviewer can re-run it.

Three of these findings contradict requirements in the approved spec. Principle I
requires the spec to be amended in the same change set rather than quietly worked
around, so each names the amendment it forces.

> **Feature 006 changes the ground under R1 and R2.**
> [`specs/006-slope-driven-speed/`](../006-slope-driven-speed/spec.md) replaces the
> speed model these two findings measured. Both were correct about a game where speed
> was pinned to a `baseSpeed` floor; neither survives a game where the mountain sets
> the speed. R1 **reverses** and R2's constraint **lifts**. Each is flagged in place
> below, and the consequences are worked through in
> [R7](#r7--what-feature-006-does-to-r1-and-r2). If 006 ships first, the FR-187 and
> FR-191 amendments R1 and R2 force should be reconsidered rather than carried in out
> of habit.

---

## R1 — A gentler slope does not slow the player down. It speeds him up.

> **Superseded if feature 006 ships.** Under 006's model a gentler slope genuinely is
> slower — the coached section at gradient 0.08 runs at 1.23 rather than 2.60. This
> finding is true of the game as it stands today and false of the game 006 delivers.

**Decision**: The coached section's gentle gradient is retained for what it _looks_
like, not for what it does to speed. Reading time is bought by **spacing**, and by
spacing alone.

**Measured**. Horizontal distance covered in 60 ticks, from a standing start:

| Gradient | Angle | Coasting | Speed | Tucking | Speed |
| -------- | ----- | -------- | ----- | ------- | ----- |
| 0.02     | 1.1°  | 156.0    | 2.601 | 229.8   | 4.200 |
| 0.05     | 2.9°  | 155.9    | 2.602 | 230.1   | 4.200 |
| 0.10     | 5.7°  | 155.5    | 2.604 | 229.9   | 4.200 |
| 0.20     | 11.3° | 153.4    | 2.608 | 227.9   | 4.200 |
| 0.30     | 16.7° | 150.1    | 2.611 | 223.7   | 4.200 |
| 0.45     | 24.2° | 143.2    | 2.616 | 214.2   | 4.200 |

**Rationale**: `resolveGrounded` (src/sim/physics.ts:160) ends with
`clamp(next, tuning.baseSpeed, tuning.tuckSpeedMax)`. Speed along the slope is pinned
to a floor of 2.6 whatever the terrain does; the slope term contributes
`slopeAccelFactor * uy` = at most 0.04, which the clamp absorbs. What the gradient
_does_ change is how that fixed speed is split between the axes: a steeper slope
spends more of it on `y`, so horizontal progress **falls** from 156 to 143 units per
second across the whole legal gradient range. A gentle coached slope therefore moves
the player across the x-axis roughly **9% faster** than the warm-up course does.

**Amendment forced**: FR-187 says the slope must be gentler _"such that a player
travels it slowly enough to read a badge and act on it"_. The stated mechanism is
backwards and the intended effect is unobtainable from slope at any gradient. FR-187
must be restated: the gentle gradient exists because a beginner slope should look
like a beginner slope, and the reading time it claims to buy is delivered by FR-191's
lead distance instead.

**Alternatives considered**: Lowering `baseSpeed` for the coached section would buy
real time, and is rejected outright — `baseSpeed` is a tuning value, FR-196 forbids
touching it, and a per-section speed override would put a second speed rule into a
simulation whose determinism argument depends on there being one.

---

## R2 — The frame caps on-screen reading time at 1.38 seconds, and 0.95 s where it matters most.

> **Constraint lifts if feature 006 ships.** The 213.3-unit lookahead does not change,
> but the player crosses it more slowly on gentle terrain: 2.90 s rather than 1.38 s.
> The 389-unit lead below is a workaround for a budget 006 removes.

**Decision**: Coaching badges key off the **skier's x position with a lead
distance**, not off their object being visible. The badge is up before its object
crests the frame edge.

**Measured**. Lookahead ahead of the skier is `INTERNAL_WIDTH - CAMERA_X_OFFSET` =
`320 - 320/3` = **213.3 world units**, at 1:1 with no zoom (`cameraFor`,
src/render/draw.ts:36,49; the transform is `terrainYAt(course.terrain, cam.x + px)`).
Ticks from an object entering the right edge to reaching the skier:

| Gradient | Coasting    | Tucking     |
| -------- | ----------- | ----------- |
| 0.05     | 83 (1.38 s) | 57 (0.95 s) |
| 0.08     | 83 (1.38 s) | 57 (0.95 s) |
| 0.23     | 84 (1.40 s) | 57 (0.95 s) |

**Rationale**: A badge bound to its object's visibility gets 1.38 seconds at the
absolute best. The flip cue is the longest string in the feature (**SWIPE OR ← →
TO FLIP!**), teaches the one verb the product has never named, and is read by a
player who is _tucked_ — because FR-190's lesson at the previous object told him to
stay crouched. So the single most important cue in the feature would get **0.95
seconds**. That is not a budget, it is a coin flip.

The 320×180 buffer cannot be widened to fix it. `src/render/stage.ts` documents the
fixed buffer as a fairness property — every device sees the same amount of course
ahead, which is what keeps FR-088's release timing comparable between a phone and a
desktop. Widening it to buy tutorial reading time would trade SC-006 for it.

Lead distance is the only lever left, and it is free:

| Reading time | Lead distance (coasting) |
| ------------ | ------------------------ |
| 1.5 s        | 234 units                |
| 2.0 s        | 311 units                |
| 2.5 s        | 389 units                |
| 3.0 s        | 467 units                |

**Amendment forced**: FR-191 says a badge _"MUST appear while its object is visible
and before the player reaches it"_. Keeping that clause caps every cue at 1.38 s. It
must be restated so the badge appears at a **fixed lead in world x** — the object
then crests the frame under a badge that is already up, which is better teaching
anyway (name the thing, then show it) and is what the measurements permit. The half
of FR-191 that must survive verbatim is the clearing rule: one badge legible at a
time, cleared once its object is behind him.

**Alternatives considered**: (a) shortening the copy — rejected, the maintainer chose
that wording deliberately and FR-190 fixes it verbatim; (b) holding the badge after
the object passes — rejected, it would overlap the next cue and break the one-at-a-
time rule; (c) slowing the player — see R1, not available.

---

## R3 — The coached rope will kill a passive player, and no legal clearance prevents it.

**Decision**: The coached rope is authored at **clearance 15**, the most forgiving
value CV-3 permits, and given the longest approach in the section. A player who does
nothing still wipes out on it. That is accepted, and the spec must say so.

**Measured**. `src/sim/step.ts:206-210` treats a `low` obstacle as a slab occupying
`[ground - clearance - branchThickness, ground - clearance]`, passed under when
`headY > bottom`. Standing height is 16, crouched 9, and `crouchProfile` interpolates
between them over `crouchTransitionTicks` = 4.

CV-3 (src/course/validate.ts:149-160) requires `crouchHeight < clearance <
standHeight` — so clearance must lie strictly inside (9, 16). At the maximum legal
**15**, passing needs height < 15, i.e. `crouchProfile > 1/7 ≈ 0.143`: **under one
tick of crouch**. At the warm-up course's current 14 it needs 0.29; at 10 it needs
0.86, nearly a full crouch.

**Rationale**: There is no clearance at which a standing player passes. CV-3 forbids
it by construction and is right to — a low obstacle that never forces a crouch is not
a low obstacle. So "survivable by a player who presses nothing" cannot be delivered
for the one object that teaches the crouch.

**Amendment forced**: FR-192 and its supporting edge case require the section to be
_"survivable by a player who reads nothing and presses nothing"_. That is unbuildable
as written. It must be restated as what is actually achievable and actually wanted:

- **No dead ends** — no position where a player who _did_ the instructed thing cannot
  continue, and no object that is unavoidable-and-unsurvivable in combination.
- **Maximum forgiveness on the one lethal object** — clearance 15, and the longest
  lead in the section.
- **The rope is allowed to bite.** It is the lesson. FR-192a already prices it: a
  wipeout there spends a practice run, which the maintainer accepted with the risk
  stated. SC-071 is the measurement that says whether the pricing was right.

The other three objects are genuinely passive-safe and need no amendment: deadfall is
cleared or struck but sits _on_ the ground so a coasting player meets it head-on
(same as any course), and both kickers launch without asking and land on terrain that
CV-10 guarantees is landable.

---

## R4 — The join to the warm-up course is free.

**Decision**: Author the coached section in `tools/gen-courses.ts` as a gradient
programme that ramps from the coached gradient up to the warm-up's opening 0.230.

**Measured**. CV-10 (src/course/validate.ts:118-141) caps the angle between adjacent
terrain segments at `landingAngleTolerance` = 0.42 rad (24.1°). Candidate joins:

| Join        | Angle             | CV-10    |
| ----------- | ----------------- | -------- |
| 0.08 → 0.23 | 0.146 rad (8.4°)  | **PASS** |
| 0.05 → 0.23 | 0.176 rad (10.1°) | **PASS** |
| 0.02 → 0.23 | 0.206 rad (11.8°) | **PASS** |

Every candidate passes even as a single hard step. And it need not be a step at all:
`terrain()` in `tools/gen-courses.ts` builds from interpolated gradient keys
specifically so CV-10 is satisfied for free — its own comment says a 200-unit sample
of a ramp spread over a section "moves by a fraction of a degree".

**Rationale**: The warm-up course opens at gradient 0.230 and runs 0.230 → 0.352 →
0.300. A coached section at **0.08** is a third of the opening pitch, reads
unmistakably as a nursery slope, and joins without a kink. The generator is also
where the whole course must be authored anyway, because prepending shifts every
existing warm-up feature by the coached section's length — 2 obstacles, 11 pickups,
1 ledge, 2 kickers, 1 rock, 1 ice section — and doing that by hand in JSON is how
off-by-one errors get committed.

**Alternatives considered**: hand-editing `data/courses/warmup.json` — rejected, the
generator exists precisely so course data is derived and validated rather than typed;
a separate `coached.json` course loaded before the warm-up — rejected, FR-186 requires
one continuous run with nothing to load between the two halves.

---

## R5 — The rope fits the collision slab exactly, and `branchThickness` must not move.

**Decision**: Draw the cord along the **top** of the collision slab and hang the
pennants down to its **bottom**, so the assembly occupies exactly
`[ground - clearance - branchThickness, ground - clearance]` — 18 units.

**Rationale**: This is what makes FR-200 ("what the player sees is what collides")
true by construction rather than by careful drawing. The slab already has a top and a
bottom; the reference image already has a cord on top and pennant tips underneath.
The pennant tips land on the collision floor because that is the only place the
drawing lets them land.

`branchThickness` = 18 is a **tuning value** read by both `step.ts` (collision) and
`draw.ts` (drawing). FR-196 forbids changing tuning, so the rope is designed to the
18 it already has: roughly 4 units of cord over 14 units of pennant. The sag in the
reference is drawn _within_ the cord's own band, above the pennant tips, so the
lowest mark stays flat across the full width and the silhouette keeps its contract.

**Observation, deliberately out of scope**: `branchThickness` is now a misleading
name for "the vertical extent of a low obstacle". Renaming the key is a pure
rename — no value moves, no feel changes, no `rulesVersion` bump — but it touches
`data/tuning.json`, `src/data/load.ts`, `src/sim/step.ts` and `src/render/draw.ts`,
and Principle VIII treats any edit to `data/tuning.json` as a change wanting a play
pass. Not worth spending this feature's play pass on. Recorded as a follow-up.

---

## R6 — Badges reuse the trick-badge machinery, and must not reuse its container blindly.

**Decision**: Coaching badges render through the existing `.badge` idiom in
`src/ui/style.css` and a sibling of `popTrickBadge`, into the **same** `#badges` host.

**Rationale**: The maintainer asked for "a similar style we used for the point
badges", and FR-189 fixes that. The CSS already carries the sound-effect lettering
(LT-3), the reduced-motion variant `.badge-still`, and the `badge-hold` keyframe that
FR-194 needs — so honouring reduced motion is reuse, not new work.

Two differences are load-bearing and must not be inherited:

1. **Lifetime.** `popTrickBadge` removes its element after a fixed `LIFETIME_MS` = 1100. A coaching badge lives on a _world-x interval_, not a timer: it appears at
   the lead point and clears when its object is behind the skier. A `setTimeout` would
   put the badge's lifetime on the wall clock while everything it describes is on the
   simulation tick, and the two disagree the moment a frame is slow.
2. **Stacking.** The `.badges` container is a column and trick badges stack in it. A
   coaching badge must be the only one of its kind on screen (FR-191), so it needs its
   own slot rather than appending into the stack — otherwise a trick landed during the
   coached section pushes the instruction off its mark.

`#badges` is positioned at `top: 34%` and is `pointer-events: none`, which already
satisfies the edge case forbidding a badge from covering the hazard it points at: the
contact line sits at 60% of frame height (`cameraFor`), well below.

**Alternatives considered**: a second container — rejected, two absolutely-positioned
overlays competing for the same band is how the coaching badge ends up on top of the
score. One container, two slots.

---

## R7 — What feature 006 does to R1 and R2

**Measured** with 006's model and constants (friction 0.02, standing drag 0.01270),
at the coached section's gradient of 0.08:

| Quantity                                | Today  | Under feature 006 |
| --------------------------------------- | ------ | ----------------- |
| Standing speed in the coached section   | 2.60   | **1.23**          |
| Horizontal progress (units/sec)         | ~156   | **~74**           |
| On-screen reading time over 213.3 units | 1.38 s | **2.90 s**        |

**Consequence for R1**: it reverses. The gentle gradient stops being cosmetic and
starts doing exactly what FR-187 originally claimed — a beginner slope that is
actually slower. The amendment R1 forces ("the gentle gradient is for how it reads,
not what it does") becomes wrong in the opposite direction.

**Consequence for R2**: the constraint lifts. With 2.90 s available, FR-191 as
**originally written** — the badge appears while its object is visible — is
comfortable, and the 389-unit lead is unnecessary machinery.

**Decision**: do not resolve this here. It depends on shipping order, and the ordering
depends on a decision the organizer has not yet made (feature 006 destroys the scores
in a live draft). Both orderings are viable and both are set out in
[006's spec](../006-slope-driven-speed/spec.md#interaction-with-feature-005). What
this document must not do is let R1 and R2 be read as timeless when they are
measurements of a model that is under active revision.

---

## Summary of forced spec amendments

| Requirement | Problem                                                        | Restate as                                                            |
| ----------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| FR-187      | Gentle slope does not slow the player; it speeds him up (R1)   | Gentle gradient is for how it reads; reading time comes from lead     |
| FR-191      | "While its object is visible" caps the key cue at 0.95 s (R2)  | Badge keys off skier x at a fixed lead; keep the one-at-a-time clause |
| FR-192      | No legal clearance lets a passive player survive the rope (R3) | No dead ends + max forgiveness; the rope is allowed to bite           |

None of these changes what the feature _is_. Each replaces a mechanism that does not
work with one that does, and all three were found by measuring rather than by
building and playing — which is the cheap end of Principle VIII.
