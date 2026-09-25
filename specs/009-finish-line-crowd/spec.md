# Feature Specification: Finish Line

**Feature Branch**: `claude/bold-albattani-pag0m9`

**Created**: 2026-09-25

**Status**: Accepted at play pass 2026-09-25 (build 22c7888)

**Input**: User description: "when the player finishes the course it just cuts to black.
We need to have a finish line w a celebration crowd"

**Numbering**: requirements continue from feature 008 (FR-262+, SC-094+).

## Context

A run that ends in a wipeout gets a moment. The skier is seen to crash, the view holds
on the mountain for a few seconds with lettering over it, and only then do the results
appear (feature 002, FR-131 to FR-133). A run that reaches the end gets nothing. The
simulation marks it finished on the tick the skier reaches the course's length, and the
next thing on screen is the results panel. Nothing on the mountain says where the end
is, so a player sees no line coming, does not see himself cross it, and goes straight
from racing to a panel on a dark ground.

Finishing is the good ending, and today it is the less satisfying of the two. On the
official course, finishing is also what separates a real score from a partial one:
every finisher outranks every non-finisher (feature 001, FR-034). The moment should
feel like the achievement it is.

Two rules in the style bible bear on this directly:

- **F-4**: transitions are panel wipes, never fades. A hard cut to the results panel is
  neither, so the current ending already sits outside the house style.
- **P-6**: the `skin` colour appears on player sprites and nowhere else, because "the
  player is the one thing in this game drawn as a person". A crowd adds more people to
  the game. How they are drawn is a style decision this spec has to settle, not a
  detail to leave to the art.

## Clarifications

### Session 2026-09-25

- Q: How is the crowd drawn, given P-6 keeps skin for the player alone? → A:
  Silhouettes in palette colours, backlit, with no skin. P-6 is unchanged, and the
  player stays the one figure drawn as a person. (FR-275)
- Q: Does the crowd react the same to every finish, or more for a better run? → A:
  The same celebration for every finish. A bigger reaction for a personal best or a
  new first place is left for later; it would need the board at the moment of
  finishing, which may be offline. (FR-276)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A player sees the finish coming and crosses it (Priority: P1)

A player on the last stretch of either course sees a finish line ahead: a banner or
gate across the course, readable for what it is before he reaches it. He crosses it.
Instead of the screen cutting away, the view stays on the mountain. His skier carries
on through the line into a finish area and comes to a stop. Lettering over the live
view says he has finished. Then the results appear.

**Why this priority**: This is the fix for "it just cuts to black". Without it the
crowd has nowhere to stand and nothing to react to. On its own, it already gives
finishing a visible end point and a moment.

**Independent Test**: Ride either course to the end (or use the course map's replay of
a measuring pilot). The finish line is visible before it is reached. Crossing it holds
on the mountain, shows the finish lettering, and the skier coasts to a stop before the
results panel appears.

**Acceptance Scenarios**:

1. **Given** a player approaching the end of the official course, **When** the end is
   within the view ahead, **Then** a finish line is on screen and reads as the finish.
2. **Given** a player who reaches the end, **When** he crosses the line, **Then** the view
   stays on the mountain, his skier continues through the line and stops in a finish
   area, and lettering over the view says he finished.
3. **Given** the finish sequence is playing, **When** it ends, **Then** the results
   panel appears through the house transition (F-4), not a hard cut.
4. **Given** the finish sequence is playing, **When** the player presses any key or taps,
   **Then** the sequence ends early and the results appear.
5. **Given** an official run that reaches the finish, **When** the sequence is still
   playing, **Then** the score has already been committed, exactly as it is today.

---

### User Story 2 - A crowd at the finish celebrates him (Priority: P2)

At the finish area there is a crowd behind the line. As he approaches they are there
and idle. When he crosses, they erupt: they jump, wave and throw things in the air, with
a cheer the player can hear. The celebration plays while the finish lettering is up.

**Why this priority**: This is the "celebration" half of the ask, and what turns an end
point into a reward. It depends on User Story 1's finish area and hold.

**Independent Test**: Finish either course. The crowd is visible at the finish before
the line is crossed, visibly reacts at the moment of crossing, and a cheer plays with
sound on. With sound off, the celebration is still unmistakable on screen.

**Acceptance Scenarios**:

1. **Given** a player approaching the finish, **When** the finish area comes into view,
   **Then** a crowd is visible behind the line, idle.
2. **Given** the crowd is in view, **When** the player crosses the line, **Then** the
   crowd visibly celebrates, starting on the same moment as the crossing.
3. **Given** sound is on, **When** the player crosses the line, **Then** a crowd cheer
   plays. **Given** sound is off, **Then** the celebration is still clear from the
   picture alone (A-4).
4. **Given** the player has reduced motion on, **When** he finishes, **Then** the crowd
   still shows that it is celebrating, without flashing, shake or fast repeated motion
   (FR-056, FR-057).

---

### Edge Cases

- **Finishing on the upper shelf.** The official course's last shelf ends exactly at the
  line, 50 units above the piste. The finish line must read across both tracks, and a
  rider who crosses it on the shelf must reach the finish area without looking as if he
  fell off the end of the shelf.
- **Finishing in the air.** The run ends on the tick he reaches the line, even mid-jump.
  His skier must still come down and stop in the finish area. It must never freeze in
  mid-air, and must never appear to crash.
- **Finishing mid-rotation.** The trick is scored or not by the simulation, which has
  already stopped. The finish sequence must not show a landing that contradicts the
  score, such as a clean landing on a run the simulation scored as a wipeout. A run that
  ended in a wipeout is not a finish and never gets this sequence.
- **Finishing slowly.** A cautious rider crosses the line at about half the speed of a
  tucked one. The coast to a stop must look right at both speeds.
- **Practice, official and free play.** All three end the same way. The finish is
  about the run, not about what it counts for.
- **The warm-up course.** It has a finish too, at its own length. The coached opening is
  earlier on that course and is not affected.
- **Skip on the crossing tick.** Most players are holding the tuck key when they cross.
  That held key must not skip the finish. The wipeout's skip does not guard against
  this: it ends on any key event, and a browser repeats key events while a key stays
  held, so a player crouched at the moment of a crash probably skips his own wipeout.
  That is feature 002's defect and is recorded here, not fixed here. The finish must
  not inherit it.
- **Closing the tab during the sequence.** The official score is already committed, as
  it is during the wipeout hold (FR-132).
- **Music.** The run's music hands over to the front-end music after the sequence, as it
  does after the wipeout hold (FR-135).
- **The course map.** `npm run map` draws the course from the same data. The finish line
  should appear on it, so a course designer can see where the end is.

## Requirements _(mandatory)_

### Functional Requirements

#### The finish line

- **FR-262**: Both courses MUST show a finish line at the point where a run is scored as
  finished. It MUST read as a finish line (a banner or gate across the course, in the
  comic idiom) and MUST span both the piste and any upper shelf that reaches the end.
- **FR-263**: The finish line MUST be visible from at least the full view ahead that
  every device is promised (213 units), so a player sees it before he reaches it.
- **FR-264**: The finish line and finish area MUST be drawing only. They MUST NOT change
  the simulation, a run's score, where a run is scored as finished, or anything that
  reaches the rules version. Runs MUST stay bit-for-bit identical to today.

#### The finish sequence

- **FR-265**: A run that ends by finishing MUST hold on the mountain before the results
  appear, as a wipeout does (FR-131). During the hold, the player's skier MUST carry on
  through the line and come to a stop in a finish area beyond it, and finish lettering
  MUST appear over the live view.
- **FR-266**: The hold MUST last long enough to see the crossing, the stop and the
  celebration, and MUST NOT outlast the wipeout hold: 2.6 seconds, or 0.9 seconds
  with reduced motion. A finish is not a longer wait than a crash.
- **FR-267**: The hold MUST NOT delay the commit (FR-132 applies unchanged). Only the
  change of screen waits.
- **FR-268**: A new key press or tap during the hold MUST end it early (FR-133). A key
  already held when the line was crossed, including the key repeats a browser sends
  while it stays held, MUST NOT count as that press.
- **FR-269**: The results panel MUST follow the hold through the house transition, a
  panel wipe (style bible F-4), instead of the current hard cut.
- **FR-270**: However the run reached the line (piste or shelf, grounded or airborne,
  fast or slow), the skier MUST be seen to come down and stop in the finish area. He
  MUST NOT freeze, fall through the ground, or appear to crash.

#### The crowd

- **FR-271**: A crowd MUST stand at the finish area on both courses, visible whenever the
  finish area is in view, and MUST NOT stand where it could be mistaken for a hazard on
  the racing line. Hazards are `orange` (P-4), and nothing in the crowd may be.
- **FR-272**: The crowd MUST be idle until the player crosses the line, and MUST visibly
  celebrate from the moment he crosses until the results appear.
- **FR-273**: A crowd cheer MUST play at the crossing when sound is on. It MUST follow
  the audio rules for its kind (A-1): synthesised within A-2's voices, or a recorded
  asset with a provenance record (A-5, O-1).
- **FR-274**: With reduced motion on, the celebration MUST still be recognisable. It
  MUST NOT use flashing, screen shake, or movement faster than FR-057 allows.
- **FR-275**: The crowd MUST be drawn as backlit silhouettes in palette colours, with
  no skin anywhere in it. P-6 is unchanged: the player remains the one figure drawn as
  a person, and the crowd reads by its shapes (heads, raised arms, flags, poles).
  The player's skier MUST stay distinguishable from the crowd at a glance.
- **FR-276**: The celebration MUST be the same for every finish, whatever the run's
  score, kind or rank. It MUST NOT depend on the board or on a network connection.

#### Tools

- **FR-277**: The course map (`npm run map`) MUST mark the finish line on both courses.

### Key Entities

- **Finish line**: the visible mark at the point where a run is scored as finished. It
  spans every track that reaches that point.
- **Finish area**: the ground beyond the line where the skier stops and the crowd stands.
  It is drawn only; no run ever rides it in the simulation.
- **Crowd**: the spectators in the finish area, with two states, idle and celebrating.
- **Finish sequence**: the hold between the finish and the results panel, made of the
  crossing, the stop, the lettering, the celebration, and the transition to results.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-094**: On both courses, the finish line is on screen at least 213 units before a
  run is scored as finished, for every measuring pilot.
- **SC-095**: Every finished run shows the finish sequence before the results panel. No
  finished run goes straight from the mountain to the results.
- **SC-096**: The finish sequence lasts no longer than the wipeout hold (2.6 s, or 0.9 s
  with reduced motion). A new key press or tap ends it within one frame, and a key held
  through the crossing does not.
- **SC-097**: Runs, scores and the rules version are unchanged by this feature, as shown
  by the existing determinism and scoring checks passing unmodified.
- **SC-098**: The official score is committed before the sequence ends, as shown by
  closing the page during the sequence and still finding the score.
- **SC-099**: With sound off and reduced motion on, a player can still tell from the
  picture that the crowd is celebrating.
- **SC-100**: At the play pass, the maintainer judges that finishing feels like an
  achievement and no longer "cuts to black" (Principle VIII).

## Assumptions

- **Presentation only.** The simulation already ends the run at the course's length.
  Everything past that point, including the skier's coast, is drawn and not simulated,
  exactly as the wipeout's tumble is.
- **The finish area needs ground to stand on.** Both courses end on a 0.6 slope. The
  finish area will be flatter ground beyond the line. That ground is past every point a
  run can reach, so it cannot change a run. If adding it changes the course files'
  recorded geometry, that is a bookkeeping consequence to handle in the plan, not a
  rules change.
- **Same ending for every run kind.** Practice, official and free play all end this way.
- **The results panel itself is unchanged.** This feature changes what comes before it
  and the transition into it, not its content.
- **The hold matches the wipeout's.** Up to 2.6 seconds, skippable, and never delaying
  the commit.
- **Out of scope**: a podium, replays, confetti that affects play, crowds anywhere else
  on the course, and any change to scoring for finishing.

## Playtest findings — 2026-09-25, build 22c7888

**Verdict, in the maintainer's words:**

> Looks good!

**Reading**: accepted (SC-100). No changes requested. The feature is complete.
