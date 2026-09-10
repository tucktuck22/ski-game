# Feature Specification: Speed Comes From the Mountain

**Feature Branch**: `claude/lucid-dijkstra-6caua6`

**Created**: 2026-09-10

**Status**: Approved 2026-09-10 — reset decision taken, ready for `/speckit-tasks`

**Input**: User description: "Let's modify the physics so that speed changes
realistically as slope increases, like it would in real life. A gentle slope should
have you going kind of fast, whereas a very steep slope, like there is before the big
kickers, you should be going decently faster. I would look to the physics on this one
and say go with whatever is realistic and/or commonplace in game engines."

## Context

**Today the mountain does not affect your speed.** `applyGroundedMotion`
(src/sim/physics.ts:148) drives speed toward a target — `baseSpeed` 2.6 standing,
`tuckSpeedMax` 4.2 tucked — adds `slopeAccelFactor * uy`, and then clamps back into
`[2.6, 4.2]`. The slope term is at most 0.04 and the clamp absorbs nearly all of it.
Measured across the entire legal gradient range, from 1.1° to 24.2°, speed along the
slope moves from 2.601 to 2.616. It is, for all practical purposes, a constant.

The consequence is visible in the shipped game: the steep pitch before the big kicker
at x=5200 on the official course looks like it should throw you, and rides exactly
like the shallow run-out at x=7852. The mountain is drawn with a shape and simulated
without one.

This feature replaces the target-and-clamp with the actual physics: **gravity along
the slope, minus snow friction, minus air drag that rises with the square of speed.**
That is the standard model — it is what a physics textbook gives for a body on an
incline and what a game engine's rigid body with a drag coefficient computes — and it
produces the behaviour the description asks for as an emergent property rather than
as a curve someone tuned.

**Numbering**: requirements continue from feature 005 (FR-214+, SC-074+).

**Relationship to feature 005**: 005 is specified and planned on the explicit promise
that it changes no physics (its FR-196). This feature breaks that promise
deliberately, and the two now interact — see
[Interaction with feature 005](#interaction-with-feature-005). This is a separate
feature rather than an amendment to 005 because it carries a consequence 005 does not:
it invalidates every committed score.

## Why this is not a tuning change

Two things make it a feature rather than a number edit.

**It bumps `rulesVersion`.** FR-023 freezes physics from the moment the first official
run commits, and the database enforces it. A draft that already holds scores will
refuse every subsequent official run until it is reset, and resetting destroys the
scores already posted. That is a product decision about real people's bed picks, not
an implementation detail.

**It moves every launch in the game.** A kicker's impulse is `power × carried speed`.
Carried speed is currently 4.2 everywhere; under this feature it is a function of the
gradient the kicker sits on. Measured against the official course's five kickers, the
impulses move by −19% to +34%. Every shelf entry the course validator currently
certifies (CV-13) was certified against 4.2, and must be re-certified.

## The model

Per simulation tick, for a skier on the ground:

```
acceleration = gravity × (sinθ − friction × cosθ) − drag × speed²
speed        = speed + acceleration
```

`sinθ` and `cosθ` are already available as `uy` and `ux` from `slopeAt` — the
simulation has always computed them, as an exact unit vector via `sqrtDet`. So the
model needs **no trigonometry, no exponentiation, and no new primitive**: it is
addition, subtraction and multiplication over values the simulation already holds,
which is what the constitution's simulation-arithmetic rule requires.

`drag` takes one of two values. Tucked is the low one. **This is the realistic
mechanism and it replaces the invented one**: a tuck does not push you, it makes you
smaller, and you accelerate because the air is doing less to stop you.

Speed settles wherever gravity and resistance balance — terminal velocity — which the
player experiences as "this pitch is worth about this much speed".

### Measured behaviour

Constants chosen so that **gradient 0.30, the sustained pitch of both courses, gives
exactly today's 2.60 standing and 4.20 tucked.** The middle of the game is therefore
unchanged and only the ends move:

| Gradient | Angle | Standing | Tucked   | Today       |
| -------- | ----- | -------- | -------- | ----------- |
| 0.08     | 4.6°  | 1.23     | 1.98     | 2.60 / 4.20 |
| 0.12     | 6.8°  | 1.58     | 2.56     | 2.60 / 4.20 |
| 0.20     | 11.3° | 2.11     | 3.41     | 2.60 / 4.20 |
| 0.30     | 16.7° | **2.60** | **4.20** | 2.60 / 4.20 |
| 0.40     | 21.8° | 2.98     | 4.82     | 2.60 / 4.20 |
| 0.52     | 27.5° | 3.34     | 5.40     | 2.60 / 4.20 |
| 0.64     | 32.8° | 3.64     | 5.87     | 2.60 / 4.20 |

Nearly a threefold spread from the gentlest slope to the steepest, against
today's 0.6%.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — The hill you are looking at is the hill you are riding (Priority: P1)

A player crests onto the steep pitch before the big kicker at x=5200 and feels the
mountain take him. The snow starts moving past faster, the trees come at him quicker,
and the kicker at the bottom throws him further than the same kicker would have thrown
him off a gentle run-in. Later, on the shallow run-out, everything calms down without
him touching anything. He never reads a number. He can see how fast he is going by
looking at where he is.

**Why this priority**: It is the feature. Every other item supports it.

**Independent Test**: Ride the official course and record speed against gradient at
twenty sampled points. Confirm the two are monotonically related, and that the spread
between the gentlest and steepest sampled point exceeds a factor of two.

**Acceptance Scenarios**:

1. **Given** two stretches of piste at different gradients, **When** a player coasts
   both without touching the controls, **Then** he travels measurably faster on the
   steeper one.
2. **Given** a steep pitch, **When** the player reaches the bottom of it, **Then** he
   is carrying more speed than he entered it with, without having tucked.
3. **Given** a kicker at the foot of a steep pitch and an identical kicker on a gentle
   one, **When** the player takes both at the same input, **Then** the first launches
   him further.
4. **Given** any legal gradient, **When** the player rides it for long enough,
   **Then** speed settles rather than rising without limit.

---

### User Story 2 — A tuck is a tuck, not a throttle (Priority: P2)

A player holds the crouch and feels himself gather speed rather than jump to a new
one, the way a real tuck works: the mountain does the same thing it was doing and he
stops fighting the air. Releasing gives it back gradually. The tuck still gates the
trick economy exactly as FR-087 requires.

**Why this priority**: The tuck is the game's one continuous input and this changes how
it feels. Ranked second because it is a consequence of User Story 1's model rather than
a separate mechanism — but it is the change most likely to be judged wrong by a player.

**Independent Test**: On a fixed gradient, hold the tuck from a standing-speed start
and record speed per tick. Confirm it rises smoothly to the tucked terminal and that
the time to do so is within the tolerance FR-221 fixes.

**Acceptance Scenarios**:

1. **Given** a player at standing speed, **When** he holds the crouch, **Then** speed
   rises continuously to the tucked terminal for that gradient.
2. **Given** a player at tucked speed, **When** he releases, **Then** speed decays to
   the standing terminal rather than dropping to it.
3. **Given** a player who never crouches, **When** he completes a course, **Then** he
   never leaves the ground, exactly as FR-087 requires today.

---

### Edge Cases

- **A slope too gentle to overcome friction.** Below the friction threshold the model
  brings the player to a halt, which is realistic and unplayable. Two guards, both
  required: a floor in tuning (FR-219) and a validator rule that no course may contain
  such a segment at all (FR-220).
- **The steepest legal gradient.** CV-2 permits 1.732 (60°). The model settles at
  4.645 standing there and does not diverge — verified over 400 ticks with zero
  oscillation.
- **Landing from a launch.** `resolveLanding` already scrubs airborne velocity to the
  slope and clamps it. That clamp becomes the new bounds and must not reintroduce a
  fixed target.
- **A kicker on a steep pitch saturating the impulse cap.** `kickerImpulseMax` is 10.0
  and the fastest measured launch is 8.44. Headroom exists but is smaller than before.
- **An existing draft mid-flight.** Covered below. It is the reason this is a feature.

## Requirements _(mandatory)_

### Functional Requirements — the model

- **FR-214**: Grounded speed MUST be produced by gravity along the slope, opposed by a
  friction term proportional to the slope-normal component and a drag term
  proportional to the square of speed. It MUST NOT be produced by accelerating toward
  a fixed target speed.
- **FR-215**: Speed MUST rise monotonically with gradient across the whole legal range.
  Steeper MUST always mean faster, with no gradient at which the relationship inverts
  or flattens.
- **FR-216**: The spread between the gentlest and steepest legal gradient MUST exceed a
  factor of two, so the difference is felt rather than measured.
- **FR-217**: Tucking MUST act by reducing drag, not by raising a target speed or
  adding thrust. The tucked and standing drag coefficients MUST both live in tuning
  data.
- **FR-218**: The simulation MUST reach these results using only addition,
  subtraction, multiplication and division over values it already holds. No
  trigonometric, exponential, logarithmic or power function may be introduced.
- **FR-219**: Speed MUST be bounded below and above by values in tuning data, per
  FR-077's "within bounds set in tuning data". The lower bound exists so no player is
  ever stranded; the upper bound is a safety rail, not the mechanism.
- **FR-220**: The course validator MUST reject any terrain segment whose gradient is
  too shallow to overcome friction with margin. A course that could strand a player
  MUST NOT be publishable, and the floor in FR-219 MUST NOT be the only thing standing
  between a player and a stall.
- **FR-221**: The time for a tuck to deliver its speed gain MUST be a named value with
  an acceptance tolerance in tuning data, per Principle III. Measured at the anchor
  gradient it is presently 60 ticks against today's 30, and whether that is right is a
  playtest question, not a calculation.
- **FR-222**: The integrator MUST be numerically stable at every legal gradient from a
  standstill, settling on terminal velocity without oscillation or overshoot.

### Functional Requirements — consequences that must be handled

- **FR-223**: `rulesVersion` on the official course MUST be bumped, and the organizer
  MUST be warned that every committed score is invalidated and the draft requires a
  reset, per FR-023.
- **FR-224**: Every kicker's `power` MUST be re-tuned against the speed its gradient
  now delivers, and every shelf entry MUST be re-certified under CV-13. A shelf that
  is no longer reachable, or that has become reachable without a ramp, is a defect.
- **FR-225**: Both courses MUST re-validate clean under the full CV rule set, including
  FR-220's new rule.
- **FR-226**: The tuning keys this feature retires — `baseSpeed`, `tuckSpeedMax`,
  `tuckAccel`, `tuckDecel`, `slopeAccelFactor` — MUST be removed rather than left
  in the file unread.
- **FR-227**: Feature 001's FR-077 MUST be re-examined and confirmed rather than
  assumed. Its clause "Slope angle MAY modulate speed within bounds set in tuning
  data" already permits this feature; its clause "The skier MUST travel at a fixed base
  speed on the slope" does not, and MUST be amended to describe a speed the mountain
  sets.
- **FR-229**: The draft reset MUST be a named operator procedure, executed verbatim in
  CI with its output asserted, per Principle VII. It MUST NOT be prose instructing a
  human to run something the project has never run.
- **FR-230**: The organizer MUST notify players that committed scores are being
  destroyed and official runs returned, before the deploy that destroys them.
- **FR-228**: Feature 005's FR-196 MUST be amended. It currently forbids exactly this
  change and promises a live draft will survive; both halves stop being true.

### Key Entities

- **Slope response**: friction coefficient and two drag coefficients — standing and
  tucked — plus the bounds in FR-219. All tuning data, no code.
- **Terminal velocity**: not stored. An emergent property of the model at a given
  gradient and drag, and the thing the player actually experiences.

## Success Criteria _(mandatory)_

- **SC-074**: A player riding the official course can tell, without instrumentation,
  which of two stretches is steeper by how fast he is going.
- **SC-075**: Coasting speed at the steepest point of the official course exceeds
  coasting speed at the gentlest by at least a factor of two.
- **SC-076**: A player who never touches the controls completes both courses without
  stalling, at every point on both.
- **SC-077**: Every kicker launches the player onto the shelf it is meant to reach,
  and no shelf becomes reachable without its ramp.
- **SC-078**: The tuck still reads as responsive to a player who is using it to clear
  a deadfall under pressure.
- **SC-079**: Identical inputs produce an identical score on the same build, and the
  determinism suite passes on all three engines.
- **SC-080**: The organizer is told, before anything is deployed, that committed scores
  will be destroyed — and the draft is reset deliberately rather than discovered broken.

## Assumptions

- **Realism is bounded by the existing constitution.** FR-084 already settles that
  crispness beats realism where they conflict, and the simulation-arithmetic rule
  forbids the functions a more elaborate model would want. The model here is the most
  realistic one those two rules permit, which is also the commonplace one.
- **The anchor is gradient 0.30.** Both courses' sustained pitch. Anchoring there
  means today's feel survives in the middle of the game and only the extremes change,
  which is the smallest change that delivers the request.
- **Friction 0.02 is a game value, not a measurement.** Waxed ski on cold snow is
  roughly 0.03–0.1. The lower value keeps gentle terrain flowing; FR-220 exists
  because even at 0.02 a shallow enough segment stalls.
- **The tuck transient is the biggest feel risk.** 60 ticks against today's 30. It is
  what a real tuck does, and it may still feel wrong. FR-221 makes it a named,
  tolerated value so the playtest can move it.
- **No new dependency, no new module.** The change is contained to
  `applyGroundedMotion`, `resolveLanding`'s clamp, `data/tuning.json`, one new
  validator rule, and the course regeneration that follows.

## The draft reset decision

**Answered 2026-09-10 by the organizer: the draft holds committed scores, and
destroying them is acceptable.** This feature proceeds, and the reset is a deliberate,
announced step rather than a failure to be discovered.

Two obligations follow from the answer, and neither is optional:

- **FR-229**: The reset MUST be performed as a named operator procedure, executed
  verbatim in CI with its output inspected, per Principle VII. A README paragraph
  telling the organizer to "run the reset" is not a deliverable; a tested script is.
- **FR-230**: Players MUST be told their committed scores are being destroyed and
  their official run returned, BEFORE the deploy rather than after. Eight people took
  a run they were told was irreversible. Discovering it was reset without warning is a
  worse outcome than the physics being wrong.

The reasoning that led here is kept below, because the next physics change will face
the same question and should not have to rediscover it.

---

**The decision as it was put:**

FR-023 freezes physics at the first official commit and the database enforces it. The
moment this ships:

- A draft with **no committed scores** adopts the new version on its first run, per
  `0004_rules_freeze.sql`. Nothing is lost and nothing needs doing.
- A draft **with committed scores** refuses every subsequent official run with a rules
  version mismatch. The only remedy is `resetDraft`, which destroys every score
  already posted. Players who have already taken their one irreversible run take it
  again.

Feature 005 was scoped specifically to avoid this. This feature cannot be.

The decision is not technical and MUST NOT be taken by inference from the code: the
organizer states whether the live draft holds committed scores and whether destroying
them is acceptable. If it is not, this feature waits until the draft is finalised, and
feature 005 — which is safe mid-draft by construction — ships on its own in the
meantime.

## Interaction with feature 005

The two features touch and the order matters.

**This feature repairs two of 005's findings.** Research R1 measured that a gentler
slope makes the player cross the x-axis ~9% _faster_, because speed was pinned. Under
this feature that reverses and becomes true in the direction 005 always wanted: the
coached section at gradient 0.08 runs at 1.23 rather than 2.60, which takes on-screen
reading time from 1.38 s to **2.90 s**.

The knock-on is that 005's FR-191 workaround becomes unnecessary. Its 389-unit lead
was forced by R2's finding that the frame could not give a cue more than 1.38 s. With
2.90 s available, a badge bound to its object's visibility — FR-191 exactly as
originally written — is comfortable. **If both features ship, 005's FR-191 amendment
should be reconsidered rather than carried in out of habit.**

**Two orderings, both viable:**

| Order        | Consequence                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 005 then 006 | 005 ships mid-draft safely. Its 389-unit lead is built, then becomes redundant and wants removing. Two playtests.                                  |
| 006 then 005 | One physics playtest, then 005 built against the speeds it will actually ship with, and FR-191 kept as written. Requires the reset decision first. |

**Recommended: 006 then 005**, if the reset is acceptable. It builds each thing once
against the numbers it will really run on. If the reset is not acceptable yet, 005
ships alone and unchanged, and this feature waits — which is exactly why 005 was
scoped the way it was.
