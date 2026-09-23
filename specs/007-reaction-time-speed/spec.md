# Feature Specification: Time to See the Box

**Feature Branch**: `claude/bold-albattani-pag0m9`

**Created**: 2026-09-23

**Status**: Approved 2026-09-23 — decisions recorded under [Clarifications](#clarifications), ready for `/speckit-plan`

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
arrives. Two things limit how early it can be seen:

- **Horizontally**, the game shows 213 units of course ahead of the skier on every
  device. That is a deliberate choice for phone/desktop fairness, and it stays.
- **Vertically**, the camera holds the skier 60% of the way down the frame. That
  leaves 72 units of screen below them. On ground steeper than about 0.41, a box 213
  units ahead is more than that below the skier, so it is still under the bottom edge
  of the screen when it is close enough horizontally. **On the steep boxes this, not
  speed, is the main reason there is so little time.**

Measured on the shipped build (rules `2.0.0`) by simulating a tucked ride into each box
with the real camera. Tucked is what a player holding crouch is doing:

| Course   | Box at x | Gradient | Horizontal speed at box | If only the 213 units limited it | Actually on screen | Time to decide |
| -------- | -------: | -------: | ----------------------: | -------------------------------: | -----------------: | -------------: |
| official |    1,830 |     0.32 |                    4.20 |                           833 ms |             833 ms |         748 ms |
| official |    3,600 |     0.51 |                    4.81 |                           733 ms |             617 ms |     **532 ms** |
| official |    4,120 |     0.55 |                    4.92 |                           717 ms |             533 ms |     **448 ms** |
| official |    4,640 |     0.58 |                    5.01 |                           700 ms |             483 ms |     **398 ms** |
| official |    6,100 |     0.40 |                    4.64 |                           750 ms |             750 ms |     **665 ms** |
| official |   11,600 |     0.56 |                    4.93 |                           717 ms |             533 ms |     **448 ms** |
| warm-up  |    1,289 |     0.05 |                    1.62 |                         2,167 ms |           2,167 ms |       2,082 ms |
| warm-up  |    5,200 |     0.31 |                    4.38 |                           800 ms |             800 ms |         715 ms |

_Corrected 2026-09-23 during `/speckit-clarify`. The first version of this table
treated speed along the slope as horizontal speed and ignored the frame's bottom edge,
giving 524 ms at the worst box. The measured figure is 398 ms._

"Time to decide" is the on-screen time minus about 85 ms. That is how long the jump
needs to climb to box height, so it is the latest a release can still clear the box.
Published human visual reaction time is roughly 250 ms for a single expected stimulus
and 400–500 ms when the player first has to identify _what_ appeared. Touch input and
display latency on a phone come on top of that.

**Five of the six official boxes leave under 680 ms. Four of them sit on ground steep
enough that the frame hides them, and at the worst the player has 398 ms, less than
it takes to recognise something new.** The boxes on moderate ground are comfortable.
The problem is not the course's speed in general; it is that boxes were placed on its
fastest, steepest ground, where they are both seen late and approached fast. Three of them (3,600 / 4,120 / 4,640) also come about 1.5 s apart, so a
player who is late on the first is still recovering when the next appears.

**Numbering**: requirements continue from feature 006 (FR-231+, SC-081+).

## Clarifications

### Session 2026-09-23

- **Q: How much reaction time?** → **A: 680 ms to decide at every box.** It covers a
  player who first has to recognise what appeared, plus phone input latency, with
  some margin. Equivalent to at least **765 ms on screen**, which at the fixed 213
  units ahead means a tucked player reaches every box at a horizontal speed of
  **about 4.6 or less**, roughly 8% under today's steep boxes. (When first answered,
  this was put as "a 20% slow-down"; that figure used speed along the slope and is
  superseded.)
- **Q: Does a live draft hold committed scores?** → **A: No.** No reset or player
  notice is needed. `rulesVersion` is still bumped, because the official course
  changes. The draft's first-commit freeze then adopts the new version from the
  first official run.
- **Q: How to slow the player down?** → The maintainer asked that the physics not
  change and suggested reshaping the slope instead. Three ways were weighed:

  | Approach                            | What moves                               | Verdict                                                                                                                                                                                                                                                                                                                                                  |
  | ----------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Raise drag everywhere               | Tuning file, and every kicker's power    | **Fallback.** It slows the whole game to fix five spots, costs the speed feel feature 006's play pass accepted, and forces every ramp and booter to be re-tuned. A 20% probe failed 11 existing tests.                                                                                                                                                   |
  | Flatten the whole mountain          | Every terrain point                      | **Rejected.** 20% slower everywhere needs gradients of about 0.16–0.37. That is well under the 0.25 floor feature 006's first playtest raised the gentlest ground to, because it felt dead.                                                                                                                                                              |
  | **Ease the ground before each box** | Terrain on each fast box's approach only | **Chosen.** Tuning is untouched, so the physics, the speed anchor and the tuck are exactly as they are. Needs to take about 8% off horizontal speed at the box, which a short stretch of gentler ground does. The steeps elsewhere and the speed carried into each kicker are unchanged. The maintainer's suggestion, applied only where the problem is. |

  A side effect worth keeping: **the ground easing off becomes a tell that a box is
  coming.** That is a readable pattern, not a flaw, and it helps exactly the new
  player the description is worried about.

- **Q: Should the camera show more ground below the skier on steep slopes, alongside
  the eased approaches?** → **A: Yes (option A).** A hazard hidden under the frame's
  bottom edge is a legibility defect in its own right: the constitution says
  legibility outranks style. It also affects ropes on steep ground, not only boxes.
  Fixing the camera alone lifts the worst box from 398 ms to about 615 ms. The eased
  approaches cover the rest, and can be shorter, because they only have to slow the
  player, not also bring the box into frame. The camera is drawing only. It changes
  no score, no course and no rules version. Rejected: easing alone (each approach
  would have to be a full screen long to bring its box into frame, and ropes on steep
  ground stay hidden); camera alone (about 615 ms, short of the 680 ms answered
  above).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A player sees a box in time to jump it (Priority: P1)

A player riding tucked down the official course sees a box come into view. They have
enough time to recognise it, release crouch, and clear it, on every box, on their
first time seeing the course.

**Why this priority**: This is the whole complaint. A box that cannot be reacted to
is memorisation, not skill, and the draft order is decided by one irreversible
official run. A player who has never seen the course cannot practise the official
layout: practice runs happen on the warm-up course.

**Independent Test**: In simulation, a tucked rider's time from each box entering
view to the last clearing release is at least 680 ms on both courses. Then the
maintainer rides the build and says whether the boxes are now reactable.

**Acceptance Scenarios**:

1. **Given** a player holding a tuck, **When** any box on either course enters view,
   **Then** they have at least 680 ms before they must release.
2. **Given** the box sequence at 3,600 / 4,120 / 4,640, **When** a player clears one
   on a late release, **Then** they have landed and are back on the snow before the
   next one needs a decision.
3. **Given** the maintainer, who knows the layout, **When** they ride the official
   course on the play-pass build, **Then** they report reacting to the boxes rather
   than anticipating them.

---

### User Story 2 - Everything else rides the same (Priority: P2)

Away from the boxes, the course rides as it does today. The steep pitches still feel
fast, each kicker throws as high and as far and pays as many rotations, and every
upper shelf is still a choice.

**Why this priority**: Feature 006's play pass signed off the speed and the jumps as
the best the game has felt. This feature exists to fix the boxes, not to re-open that.

**Independent Test**: Before and after, compare the speed each kicker is reached at,
the rotations available off each booter, and which shelves each robot pilot reaches.

**Acceptance Scenarios**:

1. **Given** a tucked player, **When** they reach any kicker, **Then** their speed is
   within 2% of what it is today.
2. **Given** the big booter at x=5,200, which follows the 4,640 box by 560 units,
   **When** approached tucked, **Then** it pays the same number of rotations as today.
3. **Given** each ramp to an upper shelf, **When** approached with speed, **Then**
   the shelf is enterable. **When** approached without, **Then** it is not forced.

---

### Edge Cases

- **The big booter comes right after the last steep box.** The 4,640 box sits 560
  units before the big booter at 5,200. Easing the approach to that box slows the
  player, and the ground between the box and the booter has to give the speed back
  before the lip. If it cannot, the box moves, not the booter. This is the tightest
  constraint in the feature.
- **Three boxes 520 units apart.** Each needs its own eased approach, and the ground
  between them is short. The stretch may come out as a stepped descent: steep, ease,
  box, steep, ease, box. That is acceptable if FR-236 holds, and the play pass judges
  whether it reads well.
- **Everything downhill moves.** Easing a section changes the height of every point
  after it. Shelves are set by height above the snow, so they follow. Anything else
  set against absolute height must be checked.
- **The gradient floor.** No eased section may go below the gentlest gradient the
  course already uses (0.25), because that is the speed anchor feature 006 set and
  what the stall rule protects.
- **Standing players.** A player who is not tucked already reaches every box well
  inside the budget (3.79 at the steepest). They are unaffected.
- **Ropes and upper-track hazards.** Not reported as a problem. Ropes are ducked by
  staying crouched, which a tucked player already is. They must not get _worse_
  (FR-237), and the camera change should make ropes on steep ground visible sooner
  too.
- **The camera and the jumps.** Showing more ground below the skier leaves less
  above. The big booter's apex already nearly fills the 180-unit frame, and the camera
  already lifts while airborne to keep it in view. The camera change must not cost
  that headroom in the air (FR-243).
- **The camera must not jump.** It moves continuously today, deliberately, so a
  landing or a shelf exit is not an unreadable snap. Whatever makes it show more
  ground below on steep slopes must ease in and out the same way.
- **Upper shelves.** A skier on the piste under a shelf needs to see the shelf 50–55
  units above them to read it as a choice. Holding the skier higher in the frame must
  not push shelves or ropes above the top edge before they matter.
- **Low-charge jumps.** A player who crouches late has little charge, and a
  low-charge jump already has a narrow clearing window (about 100 ms). Arriving slower
  does not widen that window, which is set by jump height, not ground speed. This
  feature buys _time to notice_. See Assumptions.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-231**: At every box (deadfall) on both shipped courses, a player riding tucked
  MUST have at least **680 ms** between the box entering view and the last release
  that still clears it. "Entering view" means the box's top edge is inside the frame
  both horizontally and vertically, with the camera the player actually sees. This is
  measured by simulating the actual ride, not by the local gradient's terminal speed,
  because speed lags behind the slope.
- **FR-232**: The gain MUST come from two places only: the camera's vertical framing
  (FR-242) and the course's shape. The tuning file MUST NOT change: gravity, friction, drag, the speed limits and every launch value stay
  as they are. So the speed model, the speed anchor and what a tuck is worth all stay
  as they are.
- **FR-233**: Terrain MUST change only on the approach to a box that fails FR-231
  today, and only as far upstream as that box needs. Boxes already inside the budget
  (official 1,830; both warm-up boxes) and the ground around them MUST NOT move.
- **FR-234**: A terrain segment MUST NOT fall below the gentlest gradient the course
  already uses, or break any rule the course validator enforces.
- **FR-235**: A tucked player MUST reach every kicker at a speed within 2% of today's.
  Each booter MUST offer the same number of rotations as under rules `2.0.0`, and
  every upper shelf MUST remain enterable with speed and avoidable without.
- **FR-236**: After clearing a box, a player MUST be back on the snow before the next
  box on the course needs a decision.
- **FR-237**: Other hazards on the official course (ropes, and rocks and ice on the
  shelves) MUST NOT give a player less reaction time than they do today.
- **FR-238**: Scoring MUST NOT change. The official course MUST remain finishable by
  every robot pilot that finishes it today. The rule that every finisher outranks
  every non-finisher MUST still hold against the new course. Its trick and pickup
  totals do not move, but its length-based totals could.
- **FR-239**: The official course's `rulesVersion` MUST be bumped. No draft reset is
  required, because none holds scores (see Clarifications).
- **FR-240**: Before any value is settled, the change MUST reach the maintainer as a
  playable single-file build carrying the real skier sprite, not the fallback
  renderer. The link and commit MUST be named, and the findings MUST be recorded in
  this spec in the maintainer's own words (Principle VIII).
- **FR-241**: If the eased approaches cannot meet FR-231 and FR-235 together, for
  example if the big booter cannot get its speed back after the 4,640 box, the
  fallback MUST be taken in this order. First, move the box to gentler ground.
  Second, and only with the maintainer's agreement, raise drag instead, as recorded
  under Clarifications. FR-235 MUST NOT be traded away silently.
- **FR-242**: On steep ground, the camera MUST show enough of the slope below the
  skier that a hazard up to 213 units ahead is in the frame no later than it would be
  on level ground. The view ahead MUST stay at 213 units horizontally and MUST stay
  identical on every device. The change MUST ease in and out with the slope, with no
  visible snap.
- **FR-243**: The camera change MUST NOT reduce how much of any jump stays in frame:
  every booter's apex that is fully visible today MUST still be fully visible. While
  riding the piste under an upper shelf, the shelf MUST stay in frame as it does today.
- **FR-244**: The camera is drawing only. It MUST NOT change the simulation, and runs
  MUST stay bit-for-bit identical, so it carries no rules-version consequence of its
  own.

### Key Entities

- **Reaction budget**: 680 ms. The minimum time a player is guaranteed between a box
  appearing and the last moment they can still release and clear it.
- **Eased approach**: A stretch of gentler ground ahead of a box, long enough that a
  tucked player has slowed to about 4.6 horizontally or less by the time the box
  comes into view.
- **Steep-slope framing**: How far the camera shifts the skier up the frame on steep
  ground, so the slope below and ahead is visible. It is set by how steep the ground
  is, and zero on gentle ground.
- **Box**: Deadfall. The obstacle cleared only by jumping over it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-081**: The shortest time any box gives a tucked player to decide rises from
  398 ms to at least 680 ms.
- **SC-086**: On every stretch of either course steeper than 0.41, a hazard enters the
  frame when it comes within 213 units horizontally, rather than later.
- **SC-082**: The maintainer, riding the official course on the play-pass build,
  clears every box on their first run of that build without releasing early from
  memory, and says so in their own words.
- **SC-083**: A player who has never seen the official course clears the 3,600 /
  4,120 / 4,640 sequence on their official run, observed with the group.
- **SC-084**: The rotations available off each booter, and the shelves each pilot
  reaches, are identical before and after.
- **SC-085**: The maintainer judges that the steeps still feel fast, and that the
  easing before a box reads as part of the mountain rather than as a speed bump. This
  is a play-pass question and cannot be measured.

## Assumptions

- **"Boxes" means deadfall**, the obstacle kind cleared only by jumping over it
  (feature 005 established this reading).
- **The warm-up course does not change.** Both of its boxes already leave more than
  680 ms.
- **Seeing further ahead horizontally is out of scope.** Widening the 213-unit view
  would also buy reaction time, but it is a phone/desktop fairness decision, and the
  course validator and the tutorial's cue timing both rely on it. The vertical framing
  is in scope (FR-242) because it only makes visible what the 213 units already
  promise. Widening is recorded as the alternative if SC-085 fails.
- **Late-crouch jumps stay as hard as they are.** This feature gives more time to
  _decide_. It does not make a jump started at the last moment more forgiving. If the
  play pass shows the problem is a late, weak jump rather than a late decision, that
  is a different lever (charge time) and a separate change.
- **The course gets slightly longer in time, not in distance.** Easing a few stretches
  adds a second or two to a run. That is well inside the game's maximum run length.
