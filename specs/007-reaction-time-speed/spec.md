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
arrives. The game shows a fixed amount of course ahead of the skier, 213 units on
every device (a deliberate choice for phone/desktop fairness). So the time a player
has is that distance divided by how fast they are going when the box comes into view.

Measured on the shipped build (rules `2.0.0`), riding tucked, which is what a player
holding crouch is doing:

| Course   | Box at x | Gradient | Tucked speed | On screen before arrival | Time to decide |
| -------- | -------: | -------: | -----------: | -----------------------: | -------------: |
| official |    1,830 |     0.32 |         4.48 |                   794 ms |         709 ms |
| official |    3,600 |     0.51 |         5.54 |                   642 ms |     **557 ms** |
| official |    4,120 |     0.55 |         5.72 |                   622 ms |     **537 ms** |
| official |    4,640 |     0.58 |         5.84 |                   609 ms |     **524 ms** |
| official |    6,100 |     0.40 |         5.00 |                   711 ms |     **626 ms** |
| official |   11,600 |     0.56 |         5.76 |                   617 ms |     **532 ms** |
| warm-up  |    1,289 |     0.05 |         1.62 |                 2,197 ms |       2,112 ms |
| warm-up  |    5,200 |     0.31 |         4.44 |                   801 ms |         716 ms |

"Time to decide" is the on-screen time minus about 85 ms. That is how long the jump
needs to climb to box height, so it is the latest a release can still clear the box.
Published human visual reaction time is roughly 250 ms for a single expected stimulus
and 400–500 ms when the player first has to identify _what_ appeared. Touch input and
display latency on a phone come on top of that.

**Five of the six official boxes sit on steep ground (gradient 0.40–0.58) and leave
under 630 ms. The two boxes on moderate ground are already comfortable.** The problem
is not the course's speed in general; it is that boxes were placed on its fastest
ground. Three of them (3,600 / 4,120 / 4,640) also come about 1.5 s apart, so a
player who is late on the first is still recovering when the next appears.

**Numbering**: requirements continue from feature 006 (FR-231+, SC-081+).

## Clarifications

### Session 2026-09-23

- **Q: How much reaction time?** → **A: 680 ms to decide at every box**, the
  equivalent of a 20% slow-down at the fastest box. It covers a player who first has
  to recognise what appeared, plus phone input latency, with some margin. Equivalent
  to at least **765 ms on screen**, which at the fixed view ahead means a tucked
  player reaches every box at a horizontal speed of **4.65 or less**.
- **Q: Does a live draft hold committed scores?** → **A: No.** No reset or player
  notice is needed. `rulesVersion` is still bumped, because the official course
  changes. The draft's first-commit freeze then adopts the new version from the
  first official run.
- **Q: How to slow the player down?** → The maintainer asked that the physics not
  change and suggested reshaping the slope instead. Three ways were weighed:

  | Approach                            | What moves                               | Verdict                                                                                                                                                                                                                                                                                                                                                         |
  | ----------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Raise drag everywhere               | Tuning file, and every kicker's power    | **Fallback.** It slows the whole game to fix five spots, costs the speed feel feature 006's play pass accepted, and forces every ramp and booter to be re-tuned. A 20% probe failed 11 existing tests.                                                                                                                                                          |
  | Flatten the whole mountain          | Every terrain point                      | **Rejected.** 20% slower everywhere needs gradients of about 0.16–0.37. That is well under the 0.25 floor feature 006's first playtest raised the gentlest ground to, because it felt dead.                                                                                                                                                                     |
  | **Ease the ground before each box** | Terrain on each fast box's approach only | **Chosen.** Tuning is untouched, so the physics, the speed anchor and the tuck are exactly as they are. Measured: a run of 230–330 units at gradient 0.25–0.30 brings a tucked player from 5.84 down to 4.7 or less. The steeps elsewhere and the speed carried into each kicker are unchanged. The maintainer's suggestion, applied only where the problem is. |

  A side effect worth keeping: **the ground easing off becomes a tell that a box is
  coming.** That is a readable pattern, not a flaw, and it helps exactly the new
  player the description is worried about.

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
- **Ropes and upper-track hazards.** Not reported as a problem and not in scope.
  Ropes are ducked by staying crouched, which a tucked player already is. They must
  not get _worse_ (FR-237).
- **Low-charge jumps.** A player who crouches late has little charge, and a
  low-charge jump already has a narrow clearing window (about 100 ms). Arriving slower
  does not widen that window, which is set by jump height, not ground speed. This
  feature buys _time to notice_. See Assumptions.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-231**: At every box (deadfall) on both shipped courses, a player riding tucked
  MUST have at least **680 ms** between the box entering view and the last release
  that still clears it. This is measured by simulating the actual ride, not by the
  local gradient's terminal speed, because speed lags behind the slope.
- **FR-232**: The reduction MUST come from the course's shape. The tuning file MUST
  NOT change: gravity, friction, drag, the speed limits and every launch value stay
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

### Key Entities

- **Reaction budget**: 680 ms. The minimum time a player is guaranteed between a box
  appearing and the last moment they can still release and clear it.
- **Eased approach**: A stretch of gentler ground ahead of a box, long enough that a
  tucked player has slowed to 4.65 or less by the time the box comes into view.
- **Box**: Deadfall. The obstacle cleared only by jumping over it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-081**: The shortest time any box gives a tucked player to decide rises from
  524 ms to at least 680 ms.
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
- **Seeing further ahead is out of scope.** Widening the view ahead of the skier
  would also buy reaction time. It is not what was asked for, and the fixed view is a
  phone/desktop fairness decision. It is recorded as the alternative if SC-085 fails.
- **Late-crouch jumps stay as hard as they are.** This feature gives more time to
  _decide_. It does not make a jump started at the last moment more forgiving. If the
  play pass shows the problem is a late, weak jump rather than a late decision, that
  is a different lever (charge time) and a separate change.
- **The course gets slightly longer in time, not in distance.** Easing a few stretches
  adds a second or two to a run. That is well inside the game's maximum run length.
