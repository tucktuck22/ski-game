# Feature Specification: Two Tracks Down a 1986 Mountain

**Feature Branch**: `claude/game-design-80s-ski-p37wa0`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "I'd like to iterate on the design of the game. There should be snow and trees, and it should feel like a cliché caricature of a 1980. Outside of the general aesthetic, instead of boxes, it should be tree branches ducking or jumping over, and there should be fewer of them. Also, I'd like to incorporate actual jumps and a bit more of a platform aesthetic with multiple paths skiers can ski on. As in an upper and lower track."

## Context

This feature iterates the run itself — the mountain a player skis down during
the runs specified by feature 001. It changes nothing about claiming a name,
the run economy, committing a score, the deadline, or the standings. Those
remain governed by `specs/001-shredpocalypse-bed-draft/spec.md`.

**Numbering**: requirements continue from feature 001 (FR-090+, SC-017+) rather
than restarting at 001. Source comments, validator rules and contracts across
this repository cite bare requirement numbers with no feature prefix, so a
second `FR-001` would be ambiguous wherever it appeared.

**Process note (Principle I deviation)**: the implementation of this feature was
written before this specification, inverting the spec → plan → tasks → implement
order that Principle I requires. This spec is therefore written against shipped
behavior rather than ahead of it. It is offered for approval on the same terms
as any other spec — but reviewers should know that approving it ratifies a
decision already taken in code, and that the usual protection of catching a bad
requirement before it is expensive was not available here.

## Clarifications

None requested. Every gap in the feature description had a defensible default
given feature 001's existing requirements; each default taken is recorded in
[Assumptions](#assumptions). One design question the defaults do **not** settle
is flagged there as open.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Choose a line down the mountain (Priority: P1)

A player who has learned the controls discovers that the mountain is not one
path but two. Ramps built into the piste throw him up onto a shelf of snow
running above it — but only if he is carrying speed when he hits one. Up there
the hazards on the piste pass harmlessly beneath him and the pickups are worth
far more. The shelf runs out, he drops back to the piste, and the next ramp
offers the same bargain again. A player who never carries speed never sees the
upper track at all, and gets down the mountain regardless.

**Why this priority**: This is the feature. It converts a single memorised line
into a run-long sequence of decisions, which is what makes one player's official
run differ from another's by more than execution. Everything else here supports
or dresses it.

**Independent Test**: Play the official course twice — once holding a tuck on
the open piste, once never tucking. Confirm the first run reaches every upper
segment and finishes, the second finishes without ever reaching one, and the
first scores materially higher.

**Acceptance Scenarios**:

1. **Given** a player approaching a ramp at base speed, **When** he crosses it,
   **Then** he is launched, lands back on the piste, and continues — he does not
   reach the upper track.
2. **Given** a player approaching a ramp carrying speed, **When** he crosses it,
   **Then** he is launched high enough to land on the upper track above.
3. **Given** a player riding the upper track, **When** he passes over a hazard
   that sits on the piste below, **Then** it does not touch him.
4. **Given** a player riding the upper track, **When** he reaches the end of the
   segment, **Then** he drops to the piste and continues the run without an
   unavoidable wipeout.
5. **Given** a player on the piste passing beneath an upper segment, **When** he
   travels under it, **Then** it does not obstruct or touch him.
6. **Given** a player who never carries speed, **When** he plays the official
   course start to finish, **Then** he completes it and is never placed on the
   upper track by anything other than his own choice.
7. **Given** a player anywhere in a run, **When** he looks at the screen,
   **Then** he can tell which of the two tracks he is on.

---

### User Story 2 - Read the mountain and answer it (Priority: P2)

Obstacles are trees. A bough overhangs the piste and the player must get under
it or over it; a fallen log lies across the piste and must be jumped. There are
markedly fewer of them than before and they are further apart, so each one is a
decision the player sees coming and answers deliberately, rather than a texture
he memorises.

**Why this priority**: The two-track choice in Story 1 is only a choice if the
player can read the mountain fast enough to make it. Density and legibility are
what buy him the time. It is P2 rather than P1 because the upper track is
playable, if harder to read, without this change.

**Independent Test**: Play the official course and confirm every obstacle is
visible far enough ahead to be answered, that no two obstacles demand
overlapping responses, and that overhanging obstacles can be passed both by
ducking and by clearing them.

**Acceptance Scenarios**:

1. **Given** an overhanging bough ahead, **When** the player ducks beneath it,
   **Then** he passes it cleanly.
2. **Given** an overhanging bough ahead, **When** the player instead clears it
   from above with enough height, **Then** he passes it cleanly.
3. **Given** an overhanging bough ahead, **When** the player neither ducks nor
   clears it, **Then** the run ends in a wipeout.
4. **Given** a fallen log across the piste, **When** the player jumps it,
   **Then** he passes it cleanly.
5. **Given** any two consecutive obstacles on the official course, **When** the
   player answers the first, **Then** he has room to stand up, recover and read
   the second before reaching it.
6. **Given** a player seeing an obstacle for the first time, **When** he looks at
   its shape alone, **Then** he can tell whether it hangs from above or lies on
   the ground.

---

### User Story 3 - A mountain that looks like 1986 thought it did (Priority: P3)

The run is a side-on cut through a snowy, forested mountainside at dusk: a
striped sunset disc low in the sky, ranks of pines receding into the distance,
snow falling, snow packed under the skis. The treatment is unapologetically of
its period — and it never costs the player a piece of information he needs.

**Why this priority**: It is what the player sees first and it is why this game
exists rather than a scoreboard, but a run is playable and scoreable without any
of it. That ordering is also the safety property: presentation must be
removable.

**Independent Test**: Play a run with all effects on and a run with reduced
motion on. Confirm both complete, both score identically for identical play, and
that every hazard and both tracks remain readable in each.

**Acceptance Scenarios**:

1. **Given** a run in progress, **When** the player looks at the screen, **Then**
   he sees falling snow, a forested mountainside and a period sunset without any
   of it obscuring the surface he is skiing on or the hazards on it.
2. **Given** a player with reduced motion enabled, **When** he plays a run,
   **Then** the run is fully playable and scoreable and the score is unchanged
   by the setting.
3. **Given** a player who cannot distinguish the palette's hues, **When** he
   plays a run, **Then** every hazard, every ramp and both tracks remain
   distinguishable by shape and position alone.
4. **Given** two runs with identical input, **When** their scores are compared,
   **Then** they are identical regardless of what was drawn on screen.

---

### Edge Cases

- **A ramp crossed while already committed to something else.** A ramp launches
  the player whether he asked for it or not. If one sat where a duck or a jump
  was already required, it would take a survivable situation and make it
  unwinnable. Ramps must not be placed where the launch cannot be survived.
- **Standing up while on the upper track.** Feature 001 makes standing up
  beneath an overhanging obstacle fatal (FR-088). A player on the upper track is
  above every bough by construction, so that rule must not fire for him there.
- **An upper segment that nothing can reach.** A shelf no launch can get onto is
  scenery the player can see and never use.
- **An upper segment that everything reaches.** A ramp strong enough to throw a
  base-speed player onto the shelf silently removes the single line the cautious
  player was promised. This is the more dangerous failure of the two, because
  the course still looks correct.
- **Dropping off the end of an upper segment.** The player is airborne with no
  warning and no input given. The landing must be survivable.
- **Being underneath an upper segment.** A player on the piste must not collide
  with the shelf above him, and must be able to launch up through it.
- **Scores committed before this change.** The mountain and its physics have
  changed, so a score set on the old course is not comparable to one set on the
  new one.
- **A course with no upper track at all.** The warm-up course and any future
  course must remain valid with zero upper segments and zero ramps.

## Requirements _(mandatory)_

### Functional Requirements

#### Route and the upper track

- **FR-090**: A course MUST be able to offer one or more **upper track**
  segments running above the main piste for part of the course's length, and
  MUST remain valid with none.
- **FR-091**: An upper track segment MUST be reachable by a player carrying
  speed into the ramp that serves it, and MUST NOT be reachable by a player
  travelling at the game's base speed.
- **FR-092**: The main piste MUST remain completable from start to finish
  without ever using the upper track, at base speed, by a player who crouches
  only where feature 001's FR-080 requires it.
- **FR-093**: Reaching the end of an upper track segment MUST return the player
  to the piste without an unavoidable wipeout.
- **FR-094**: The upper track MUST carry materially greater scoring reward than
  the piste beneath it over the same stretch of course.
- **FR-095**: A player positioned beneath an upper track segment MUST NOT
  collide with it, and MUST be able to pass upward through it.
- **FR-096**: Hazards placed on the piste MUST NOT affect a player riding the
  upper track above them.
- **FR-097**: The player MUST be able to tell, at any moment during a run, which
  track he is on.

#### Ramps

- **FR-098**: A course MUST be able to place **ramps** on the piste that launch
  the player on contact, without requiring the crouch-and-release input feature
  001's FR-078 defines, and MUST remain valid with none.
- **FR-099**: The height a ramp launches a player MUST increase with the speed
  he carries into it, up to a bounded maximum.
- **FR-100**: A ramp MUST NOT be placed anywhere its launch cannot be survived,
  including within the recovery window that follows an overhanging obstacle.
- **FR-101**: A ramp MUST be visually distinguishable from the snow surface it
  is built on, and MUST indicate the point at which it launches.

#### Obstacles

- **FR-102**: An overhanging obstacle MUST be passable both by ducking beneath
  it and by clearing it from above.
- **FR-103**: The official course MUST present materially fewer obstacles than
  it did under feature 001's course data, spaced far enough apart that the
  player answers each one individually.
- **FR-104**: Every obstacle MUST be identifiable as either overhanging or
  ground-lying from its silhouette alone.

#### Presentation

- **FR-105**: The run MUST be presented as a snowy, forested mountainside at
  dusk, in the visual language of the 1980s, governed by the style bible that
  Principle IV makes authoritative.
- **FR-106**: Every presentation element added by this feature MUST be disabled
  by the reduced-motion setting (feature 001's FR-056), and the run MUST remain
  fully playable and scoreable with them all disabled.
- **FR-107**: No information added by this feature — which track, which obstacle
  kind, where a ramp launches — may be carried by colour alone.
- **FR-108**: Presentation MUST NOT be derived from anything about the run
  beyond the camera position and elapsed run time. It MUST NOT vary with score,
  outcome, or standing.

#### Validation and versioning

- **FR-109**: Every requirement above that can be violated by course data MUST
  be checked automatically over every shipped course before a build succeeds,
  and MUST fail the build on violation.
- **FR-110**: This feature MUST bump the rules version, because a score set
  under it is not comparable to one set before it (feature 001's FR-023).

### Key Entities

- **Upper track segment**: a stretch of skiable surface running above the main
  piste, entered from above and open at both ends. Has a start, an end, and a
  height above the piste. Optional; a course may have none.
- **Ramp**: a feature of the piste that launches a player who crosses it, by an
  amount that grows with his carried speed. Serves the upper track segment that
  follows it. Optional; a course may have none.
- **Overhanging obstacle**: a tree bough above the piste with a gap beneath it
  and open air above it. Passable by ducking or by clearing.
- **Ground obstacle**: fallen deadfall lying across the piste. Passable only by
  going over.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-017**: A player who never carries speed completes the official course and
  spends zero time on the upper track.
- **SC-018**: A player who carries speed into every ramp reaches every upper
  track segment on the official course and completes the run.
- **SC-019**: The speed-carrying line scores at least twice the bonus of the
  base-speed line on the same course, so the choice in Story 1 is a real one.
- **SC-020**: The official course presents at least 30% fewer obstacles than it
  did before this feature.
- **SC-021**: A run played with reduced motion enabled produces the identical
  score to the same run played with all effects enabled.
- **SC-022**: Every hazard, ramp and track is distinguishable from every other
  by shape or position alone, with hue disregarded entirely.
- **SC-023**: A course that violates FR-091, FR-092, FR-093, FR-095 or FR-100
  never reaches a player — each violation is caught automatically rather than by
  review.
- **SC-024**: Any single frame taken from a run is enough to say which track the
  player is on, judged without the score and without motion.
- **SC-025**: The run holds the frame rate the constitution fixes for the
  reference device with the full presentation enabled, so nothing added here
  costs a player a reaction he would otherwise have had.

## Assumptions

- **The upper track is a reward, not a gamble.** The description asked for
  multiple paths and did not say what the upper path should cost. The default
  taken is that it costs the skill of carrying speed into a ramp and nothing
  else: it is safer than the piste (the hazards below pass beneath the player)
  as well as better scoring. **This is the one design decision here worth
  revisiting before approval.** A path that is both safer and more valuable is
  strictly dominant for any player able to reach it, which makes it a skill gate
  rather than a decision. Giving the upper track a real downside — a harder
  landing, a shorter run-out, fewer chances to recover — would turn it into the
  choice the feature description asks for. FR-094 deliberately specifies only
  the reward, so that adding a cost later amends this spec rather than
  contradicting it.
- **The upper track never carries obstacles of its own.** Everything a player
  must duck, jump or break sits on the piste. This keeps the two lines legible
  and keeps the recovery rules of feature 001 applying to exactly one surface.
- **Ramps are unavoidable where they are placed.** A ramp spans the piste and
  launches everyone who crosses it. The design does not offer a way to decline
  one; the player's control is over how much speed he brings, which is what
  FR-091 turns into the choice of line.
- **Upper track segments do not connect to one another.** Each is entered from a
  ramp and exited at its end. There is no route that stays high for the whole
  course.
- **"Fewer obstacles" is measured against feature 001's shipped official
  course**, which is the only baseline that exists.
- **No new player input is introduced.** The three inputs of feature 001's
  controls contract are unchanged; ramps launch on contact rather than on a
  button.
- **The rules-version bump invalidates any draft already in progress**, by
  feature 001's FR-023 and its storage layer's refusal to accept commits under a
  different rules version. This is the intended consequence and not a defect,
  but it is a scheduling constraint on when this feature may ship.
- **Scoring totals are rescaled, not redesigned.** The upper track adds reward,
  which raises the pool of obtainable bonuses; feature 001's FR-034 requires
  every finisher to outrank every non-finisher, so the completion base rises to
  preserve that property. The property is unchanged; only the numbers move.
- **Feature 001's out-of-scope list still applies.** No enemies, no replays, no
  accounts, no multi-trip support are introduced here.
