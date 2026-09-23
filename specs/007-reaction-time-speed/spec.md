# Feature Specification: Time to See the Box

**Feature Branch**: `claude/bold-albattani-pag0m9`

**Created**: 2026-09-23

**Status**: Draft — two decisions outstanding (see [Open questions](#open-questions))

**Input**: User description: "in playtesting on production, I'm finding that I am
moving too fast and don't have the reaction time necessary to jump over boxes while
crouched. If even I struggle to do this and I know the map layout, I don't think it's
fair for new players. I'd like to balance the speed against human reaction time and
make this a little bit more approachable. I don't want to alter the physics. I would
just like to tune it so that, either by lowering the base speed or increasing drag,
players aren't moving quite so fast. And have more time to react to obstacles."

## Context

**The complaint is about time, not speed.** A box, which is the deadfall the player
has to jump, is dangerous for one reason: the player sees it and has to act before it
arrives. The game shows a fixed amount of course ahead of the skier, 213 units on
every device (a deliberate choice for phone/desktop fairness). So the time a player
has is that distance divided by how fast they are going when the box comes into view.

Measured on the shipped build (rules `2.0.0`), riding tucked, which is what a player
holding crouch is doing:

| Course   | Box at x | Gradient | Tucked speed | Box on screen before it arrives |
| -------- | -------: | -------: | -----------: | ------------------------------: |
| official |    1,830 |     0.32 |         4.48 |                          794 ms |
| official |    3,600 |     0.51 |         5.54 |                          642 ms |
| official |    4,120 |     0.55 |         5.72 |                          622 ms |
| official |    4,640 |     0.58 |         5.84 |                      **609 ms** |
| official |    6,100 |     0.40 |         5.00 |                          711 ms |
| official |   11,600 |     0.56 |         5.76 |                          617 ms |
| warm-up  |    1,289 |     0.05 |         1.62 |                        2,197 ms |
| warm-up  |    5,200 |     0.31 |         4.44 |                          801 ms |

The latest release that still clears a box is about 85 ms before it arrives, because
the jump needs that long to climb to box height. Take that off and the fastest box
leaves about **520 ms** to notice it, decide, and let go. Published human visual
reaction time is roughly 250 ms for a single expected stimulus and 400–500 ms when the
player first has to identify _what_ appeared. Touch input and display latency on a
phone come on top of that. 520 ms leaves almost no margin for a player who already
knows the box is there, which is the maintainer's experience, and too little for one
who doesn't.

The three steepest boxes (3,600 / 4,120 / 4,640) come about 1.5 s apart, so a player
who is late on the first one is still recovering when the second one appears.

**Numbering**: requirements continue from feature 006 (FR-231+, SC-081+).

## Why this is not only a number edit

The description asks that this be a tuning change and not a physics change.
**It can be: the speed model from feature 006 stays exactly as it is.** Gravity
along the slope, friction, and drag that grows with the square of speed are all kept.
Only how strong the drag is changes. There is no "base speed" left to lower; feature
006 retired it. Drag is now the only way to reduce grounded speed without touching
the model.

Three things the description does not mention come with it, all consequences of
speed the course already relies on:

1. **Every kicker moves.** A kicker throws the skier with a force proportional to the
   speed they arrive with. Slowing everyone by 20% was tried against the current
   course as a probe. The booters then threw lower and shorter: fewer rotations, less
   hang time, and one pilot could no longer reach the upper shelves. Eleven course and
   feel tests failed. The kickers have to be re-tuned against the new speeds to keep
   the jumps the player signed off on in feature 006 ("That felt wonderful").
2. **Every score is invalidated.** Any change to the official run's feel bumps
   `rulesVersion`. A draft that holds committed scores refuses every run after that
   until it is reset, and a reset deletes the scores already posted.
3. **The speed feel from feature 006 comes down with it.** The steep pitch before the
   big kicker keeps its _relative_ kick: steep ground is still faster than gentle
   ground, by the same ratio. But the absolute top speed drops. That is the price
   this feature asks, and the play pass is where it gets judged.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A player sees a box in time to jump it (Priority: P1)

A player riding tucked down the official course sees a box come into view. They have
enough time to recognise it, release crouch, and clear it. That holds even at the
steepest box on the course and on their first time seeing the course.

**Why this priority**: This is the whole complaint. A box that cannot be reacted to
is memorisation, not skill, and the draft order is decided by one irreversible
official run. A player who has never seen the course cannot practise the official
layout: practice runs happen on the warm-up course.

**Independent Test**: Measure the time from a box entering view to the last moment a
release still clears it, at every box on both courses, and compare it against the
reaction budget (FR-231). Then hand the build to the maintainer and ask whether the
steep boxes are now reactable.

**Acceptance Scenarios**:

1. **Given** a player holding a tuck on the steepest box approach of the official
   course, **When** the box enters view, **Then** they have at least the reaction
   budget before they must release.
2. **Given** the three steep boxes about 1.5 s apart, **When** a player clears the
   first one on a late release, **Then** they have landed and are back on the snow
   before the second one requires a decision.
3. **Given** the maintainer, who knows the layout, **When** they ride the official
   course on the play-pass build, **Then** they report being able to react to the
   boxes rather than having to anticipate them.

---

### User Story 2 - The jumps still feel like the jumps (Priority: P2)

The ramps and booters still throw the player as high and as far, and pay as many
rotations, as the build the maintainer accepted in feature 006. Every upper shelf is
still reachable by a player who carries speed into its ramp, and still skippable by
one who doesn't.

**Why this priority**: Slower speed changes every kicker. If it goes unaddressed,
this feature fixes the boxes by quietly breaking the part of the game that was most
recently signed off as fun.

**Independent Test**: Before and after, measure apex height, hang time and rotations
available off each booter, and which shelves each pilot can reach. They match within
tolerance.

**Acceptance Scenarios**:

1. **Given** the big booter approached tucked, **When** the player leaves the lip,
   **Then** they have the same number of rotations available as they do today.
2. **Given** each ramp that leads to an upper shelf, **When** approached with speed,
   **Then** the shelf is enterable. **When** approached without speed, **Then** the
   shelf is not forced.

---

### User Story 3 - The draft moves to the new rules safely (Priority: P3)

The organizer ships the slower build into the draft in the order feature 006
established: players are told first, then the build is deployed, then the draft is
reset. The next official run posts normally under the new rules.

**Why this priority**: This is necessary but not new. Feature 006 already built and
tested the reset path, and this feature reuses it.

**Independent Test**: The existing reset-then-first-commit test is re-run against the
new rules version.

**Acceptance Scenarios**:

1. **Given** a draft with scores under `2.0.0`, **When** the new build is deployed
   and the draft is reset, **Then** the first official run under the new rules
   commits and freezes the new version.

---

### Edge Cases

- **The gentlest ground.** The coached opening of the warm-up course runs at gradient
  0.05, where standing speed is 1.05 today. The game has a minimum speed of 0.8. A
  cut of more than about 24% pushes standing speed there onto that floor. The floor
  then decides the speed there instead of the slope, and the tutorial's cue timing
  (accepted as "enough" at 2.19 s) stretches further than it was judged at.
- **Coached section tedium.** The passive crossing of the coached section is about
  13 s today and was judged "not tedious" at that length on all three practice runs.
  Any slow-down lengthens it by the same proportion.
- **A tuck is still worth taking.** Standing and tucked speed must drop by the same
  proportion. Otherwise the tuck-versus-stay-low choice the two-track design hangs on
  changes as a side effect.
- **Low-charge jumps.** A player who crouches late has little charge, and a
  low-charge jump already has a narrow clearing window (about 100 ms). Slower speed
  does not widen that window, which is set by jump height, not ground speed. This
  feature buys _time to notice_, not a more forgiving late jump. See Assumptions.
- **Run length.** Slower speed lengthens a run. The official course must still be
  finishable well inside the game's maximum run length.
- **Upper-track hazards.** Rocks and ice on the shelves are reached at kicker exit
  speed, not grounded speed. They are covered by User Story 2 keeping kicker exit
  speeds where they are, and the reaction budget applies to them too.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-231**: At every box (deadfall) on both shipped courses, a player riding tucked
  at the speed that ground is worth MUST have at least the **reaction budget** between
  the box entering view and the last release that still clears it. The reaction
  budget is [NEEDS CLARIFICATION: how much time — see Q1].
- **FR-232**: The reduction MUST be achieved by changing drag strength only. The
  speed model (gravity along the slope, friction, drag that grows with the square of
  speed), gravity, friction and the minimum and maximum speed limits MUST NOT change.
- **FR-233**: Standing and tucked speed MUST be reduced by the same proportion on all
  ground, so the speed gained by tucking stays exactly the same ratio as today.
- **FR-234**: Each booter MUST still offer the same number of rotations as it does
  under rules `2.0.0`, and its apex MUST stay within the camera's frame as it does
  today.
- **FR-235**: Every upper shelf MUST remain enterable by a player carrying speed into
  its ramp and MUST remain avoidable by a player who does not. Every rule the course
  validator enforces today MUST still pass on both courses.
- **FR-236**: On the warm-up course's coached section, the slowest ground MUST remain
  above the minimum speed floor, so the slope and not the floor sets speed there.
- **FR-237**: The official course MUST remain finishable by every existing robot pilot
  that finishes it today, in less than half the maximum run length.
- **FR-238**: Scoring MUST NOT change. The scoring table, including what a rotation
  is worth, stays as it is, and the rule that every finisher outranks every
  non-finisher MUST still hold against the new course and tuning.
- **FR-239**: The official course's `rulesVersion` MUST be bumped, and the change
  MUST ship by the feature 006 procedure: tell players, deploy, reset. The feature 006
  reset-then-first-commit test MUST pass under the new version. Whether a reset is
  acceptable now is [NEEDS CLARIFICATION: see Q2].
- **FR-240**: Before any value is settled, the change MUST reach the maintainer as a
  playable single-file build carrying the real skier sprite, not the fallback
  renderer. The link and commit MUST be named, and the findings MUST be recorded in
  this spec in the maintainer's own words (Principle VIII).
- **FR-241**: The tuning file's commentary and every document that states the old
  anchor speeds (2.60 standing / 4.00 tucked on the gentlest ground) MUST be updated
  to the new values in the same change (Principle I).

### Key Entities

- **Reaction budget**: The minimum time a player is guaranteed between a box
  appearing and the last moment they can still release and clear it. It is one number
  for the whole game, and it is the acceptance line for FR-231.
- **Speed anchor**: The speed the gentlest ground on the course is worth, standing and
  tucked. The drag values are solved to hit it, as feature 006 established. This
  feature moves the anchor down.
- **Kicker power**: How hard each ramp and booter throws, relative to arrival speed.
  It is re-solved against the new speeds so the throw is unchanged (FR-234).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-081**: The shortest time any box gives a tucked player between appearing and
  the last clearing release is at or above the reaction budget, up from about 520 ms
  today.
- **SC-082**: The maintainer, riding the official course on the play-pass build,
  clears every box on their first run of that build without having to release early
  from memory, and says so in their own words.
- **SC-083**: A player who has never seen the official course clears the steep box
  sequence (the three boxes 520 units apart) on their official run, observed with
  the group.
- **SC-084**: Rotations available off each booter, and which shelves each pilot
  reaches, are identical before and after.
- **SC-085**: The maintainer judges that the course still feels fast on the steeps.
  This is a play-pass question and cannot be measured. If the answer is no, the
  budget is revisited, not the players.

## Open questions

These are the decisions this spec cannot make on the maintainer's behalf.

- **Q1 — Reaction budget.** How much time (FR-231)? Every option is the same drag
  change at a different strength; the play pass can move it afterwards.
- **Q2 — The draft.** Does a live draft hold committed scores, and is a reset
  acceptable now (FR-239)?

## Assumptions

- **"Boxes" means deadfall**, the obstacle kind cleared only by jumping over it
  (feature 005 established this reading).
- **Uniform, not targeted.** Speed comes down everywhere by one proportion, not just
  near boxes. A targeted fix, such as flattening the ground in front of each box, is a
  course redesign and would move exactly the gradients feature 006's play pass
  accepted.
- **Kickers are preserved, not left to fall.** The description says nothing about
  jumps. Feature 006's verdict on them was the strongest positive finding on record,
  so keeping them is taken as the default and FR-234 makes it binding.
- **Seeing further ahead is out of scope.** Widening the view ahead of the skier would
  also buy reaction time, without slowing anyone down. It is not what the description
  asked for, and the fixed view is a phone/desktop fairness decision. It is recorded
  as the alternative to reach for if SC-085 fails, not pursued here.
- **Late-crouch jumps stay as hard as they are.** This feature gives more time to
  _decide_. It does not make a jump started at the last moment more forgiving. If the
  play pass shows the problem is a late, weak jump rather than a late decision, that
  is a different lever (charge time) and a separate change.
- **Warm-up course changes ride along.** It shares the tuning file, so it slows by the
  same proportion. It is not frozen by the rules version, so this adds no draft risk
  beyond FR-239.
