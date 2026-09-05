# Feature Specification: The Skier Becomes a Drawn Character

**Feature Branch**: `004-skier-sprite-animation`

**Created**: 2026-09-04

**Status**: Clarified 2026-09-04 — ready for `/speckit-plan`

**Input**: User description: "I'd like to enhance the skiier character from its
current arrangement to something like this. I made this myself, so it's an asset
that's okay to use for the video game." — supplied with a pixel-art sprite sheet of
the skier.

Supplied material, as delivered:

| Property        | As supplied                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| Form            | Single raster sprite sheet, 8 columns x 3 rows on a flat grey backing         |
| Populated cells | 20, with five cells in row 2 left empty                                       |
| Cell labels     | `CROUCH`, `JUMP`, `TUCK` (x2), `LAND & ABSORB`                                |
| Cell numbering  | Non-contiguous — `6` and `13` each appear twice, `1`–`20` is not a clean run  |
| Character       | Magenta helmet, cyan goggles, purple/blue suit, cyan trailing scarf, two skis |
| Provenance      | Original work by the maintainer, cleared for use in this product              |

## Context

This feature changes **how the player character is drawn**. Nothing else.

Today the skier is assembled every frame out of five filled rectangles and a
four-point polygon: a magenta body box scaled between a standing and a crouched
height, a yellow headband, an ink visor, a sine-driven cyan scarf, and a snow ski
bar. It satisfies rule LW-3 — the silhouette reads — and nothing more. It is a
placeholder that has outlived its purpose: the mountain around it got a sunset, five
ranks of depth, trees drawn as trees, and hazards drawn as materials, and the player
is now the least-drawn thing on his own screen.

The supplied sheet replaces that construction with a drawn character whose **pose
tells the player what the simulation thinks he is doing**. Crouched and charging,
launched, in the air, tucked, absorbing a landing — these are already distinct
simulation states, and today all of them are conveyed by one number: how tall the
magenta box is.

**Out of scope**, explicitly:

- The simulation. No physics value, tuning value, collision footprint, scoring rule
  or state field changes. A run recorded before this feature and replayed after it
  MUST produce the same score and the same hash (Principle V, FR-026).
- The mountain, the backdrop, the hazards, the HUD, the trick badges, the wipeout
  lettering, the panels, and every screen outside the run.
- Audio of any kind.
- Snowboarding. The constitution requires skiing and snowboarding to read as one
  world in distinct silhouettes; there is no snowboard in this product yet, and this
  feature does not add one. It does set the precedent that feature will follow.

**Numbering**: requirements continue from feature 003 (FR-159+, SC-053+) rather than
restarting, for the reason recorded in feature 002's spec — source comments,
validator rules and contracts across this repository cite bare requirement numbers
with no feature prefix, so a second `FR-001` would be ambiguous wherever it appeared.

## Governance impact _(one conflict resolved, one obligation)_

### 1. The eight-colour palette becomes nine — amending the style bible

`assets/style-bible.md` section 1 is unambiguous: _"Eight colours. Nothing outside
this set appears in any asset."_ Constitution Principle IV makes that document the
single source of truth, and FR-052 requires every asset to cite the rule it satisfies
at review.

The supplied sheet, as drawn, carries shading ramps and a skin tone that are not
among the eight. This is the same shape of conflict feature 003 hit with rule A-1,
and it had the same two honest exits — bring the asset to the rule, or amend the rule
on purpose and record why. What it did **not** have is a third exit where the asset
ships and the rule is quietly not applied to it.

**Resolved (Q1, decided 2026-09-04)**: section 1 gains **exactly one** token, for
skin. Everything else in the sheet is quantised to the resulting nine. The shading
ramps collapse; the face stays a face.

This is the smallest amendment that admits the art: one row in the section 1 table,
and the palette remains a hard enumeration a test can enforce — which matters,
because the existing palette test asserts the token set exhaustively and would
otherwise have to be loosened into something that could not catch a drift. A ramp
allowance would have been a rule about "how many tones is too many", and nobody can
enforce that at review. A ninth named colour either appears in the file or does not.

The reversal is deliberate and significant enough to warrant an ADR, following the
precedent ADR-0009 set for rule A-1: a future reader deserves to know that "eight
colours" was not an accident and that the position changed on purpose. See FR-179,
FR-180.

Three rules are load-bearing and are **not** amended here:

- **P-4** — the player is `magenta` and hazards are `orange`. The supplied character
  is already magenta-helmeted, so this is satisfied by the art as drawn.
- **P-5** — no information by hue alone. Pose does the work here: every state this
  feature distinguishes differs in **silhouette**, which is exactly the shape
  difference P-5 asks for.
- **L-0** — legibility outranks style. A more detailed character that reads worse at
  speed than the box it replaced is a regression, not an enhancement, and SC-053
  exists to catch that.
- **P-2** — body text stays `snow` on `ink` or `purple`. The new token is a sprite
  colour and is never a text or ground colour, so it adds no text pairing.

### 2. Provenance must be recorded, not asserted in a chat message

Rule **A-5** requires a recorded music asset to cite its provenance in a README
establishing it as an original work the project owns. The reasoning is not specific
to audio, and O-1 covers art in the same breath as music. The maintainer's statement
that they made this sheet is the right claim; it needs to live in the repository
rather than in a conversation, and the editable source needs to be retained alongside
the shipped file, per the constitution's asset-management clause. See FR-170, FR-171.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The player can see what he is doing (Priority: P1)

A player skiing down the mountain sees a drawn skier whose body changes with his
inputs and his situation: upright and carving while cruising, folded low while he
holds the crouch, extended at the moment of launch, compact and tucked through the
air, and compressed on touchdown before he stands back up.

**Why this priority**: this is the whole feature. Every remaining story is an edge, a
fallback, or a polish pass on this one. Shipped alone it delivers the enhancement
that was asked for.

**Independent Test**: play a single practice run that includes a cruise, a held
crouch, a launch, an air, and a landing, and confirm the character on screen takes a
visibly different, correct pose for each — without reading the HUD.

**Acceptance Scenarios**:

1. **Given** a run in progress with the skier grounded and no crouch held, **When**
   the player provides no input for one second, **Then** the skier is drawn in an
   upright carving pose riding the surface he is actually on.
2. **Given** a run in progress with the skier grounded, **When** the player presses
   and holds crouch, **Then** the skier folds into the crouch pose over the same
   crouch transition the simulation already uses, and holds it while the input is
   held.
3. **Given** a fully charged crouch, **When** the player releases and the simulation
   launches him, **Then** the skier is drawn extended in the launch pose on the tick
   he leaves the surface.
4. **Given** the skier is airborne with no spin turning, **When** he is past the top
   of the arc, **Then** he is drawn in the tucked air pose.
5. **Given** the skier is airborne, **When** he touches down cleanly, **Then** he is
   drawn compressed in the absorb pose and returns to the carving pose over a fixed,
   brief interval rather than snapping upright on the landing tick.

---

### User Story 2 - Nothing about the run changes but the picture (Priority: P1)

A player who has a committed score, and an organizer looking at the standings, see
exactly the same numbers after this feature as before it. A replayed run produces an
identical result.

**Why this priority**: shares P1 with story 1 because it is the constraint that makes
story 1 shippable at all. Principle V is not negotiable, and a rendering change that
moved a score would invalidate a live leaderboard.

**Independent Test**: replay a stored run record captured before this change and
assert the resulting score, outcome and state hash are byte-identical.

**Acceptance Scenarios**:

1. **Given** a run record (course, seed, input trace) captured before this feature,
   **When** it is replayed on the build carrying this feature, **Then** the final
   score, outcome, wipeout reason and state hash are identical.
2. **Given** the same course, seed and inputs, **When** the run is played on two
   different browser engines, **Then** the results remain identical, as they were
   before.
3. **Given** a run in progress, **When** the character's pose changes for any reason,
   **Then** no simulation field has been written and no field has been added to the
   simulation state to support it.

---

### User Story 3 - The character survives a missing or broken sheet (Priority: P2)

A player on a slow or flaky connection, or one who loads a build where the sprite
sheet failed to deploy, still gets a complete, playable, scoreable run.

**Why this priority**: this is the exact failure class the first deployment week
produced — an asset resolved against the wrong base path, failing silently. Principle
VI requires every reachable failure state to be produced deliberately in a test. A
run must never be blocked by decoration.

**Independent Test**: block the sprite sheet request in a real browser against the
built artifact at its production base path, then complete a full run and commit a
score.

**Acceptance Scenarios**:

1. **Given** the sprite sheet cannot be loaded, **When** the player starts a run,
   **Then** the run starts, is fully playable, and commits a score.
2. **Given** the sprite sheet cannot be loaded, **When** the skier is drawn, **Then**
   a visible player character is drawn in `magenta` at the same footprint, and it
   remains distinguishable from every hazard on screen.
3. **Given** the sprite sheet is still loading, **When** the first frame of a run is
   drawn, **Then** the frame renders without an exception and without a gap where the
   player should be.

---

### User Story 4 - Reduced motion keeps the information and drops the flourish (Priority: P2)

A player who has asked for reduced motion sees a character whose pose still tells him
what the simulation is doing, without decorative movement he did not ask for.

**Why this priority**: FR-056 and FR-113 already establish this contract for every
other effect in the game, and rule LT-6 draws the line — what is dropped is movement,
never a message. A pose that carries state is a message.

**Independent Test**: enable reduced motion, play a run through a crouch, launch, air
and landing, and confirm every state-carrying pose still appears while purely
decorative movement does not.

**Acceptance Scenarios**:

1. **Given** reduced motion is enabled, **When** the player crouches, launches, and
   lands, **Then** each state-carrying pose is still shown.
2. **Given** reduced motion is enabled, **When** the skier is cruising with no input,
   **Then** no purely decorative idle movement plays.

---

### Edge Cases

- **A spin is turning.** The skier rotates through a committed full turn. The pose
  must not fight the rotation, and touching down mid-spin ends the run (FR-124) — the
  character must not be drawn as a clean landing in the frame the run ends.
- **The wipeout tumble.** The death sequence already spins and slides the body. The
  character must read as a body that has stopped skiing, not a skier still holding a
  carve while rotating five and a half radians.
- **Landing straight into a second launch.** A player who touches down on a ramp and
  is relaunched within a few ticks must not be left part-way through an absorb
  sequence that outlives the state it describes.
- **Riding the upper track.** The character is drawn on the shelf, not floating above
  the piste. This already works and must not regress.
- **Crouch partially held.** The crouch profile is continuous between standing and
  fully crouched. The character has a finite number of drawn poses; the mapping must
  be defined at every value, with no flicker when the profile hovers at a boundary.
- **Facing.** The character is drawn facing downhill in the sheet. The run only ever
  travels one way; no mirrored variant is required, and none should be invented.
- **Very small viewports.** At the smallest supported device width the character must
  still be identifiable as a skier and distinguishable from a hazard.

## Requirements _(mandatory)_

### Functional Requirements

**The asset**

- **FR-159**: The player character MUST be drawn from a single supplied sprite sheet
  rather than assembled from primitive shapes at draw time.
- **FR-160**: The shipped sheet MUST be a contiguous, unambiguously indexed grid. The
  supplied source numbers two cells `6` and two cells `13` and leaves five cells
  empty; the shipped sheet MUST resolve that into a stable index with exactly one
  meaning per cell, and the mapping from index to pose MUST be declared in a
  versioned data file rather than embedded in code.
- **FR-161**: The character's drawn footprint MUST match the simulation's existing
  standing and crouched heights. This feature MUST NOT change `standHeight`,
  `crouchHeight`, or any other tuning value.
- **FR-162**: Every pixel in the shipped sheet MUST be one of the nine declared
  palette colours — the existing eight plus the skin token added by FR-179 — or fully
  transparent. No other value may appear, and the sheet MUST cite the specific
  style-bible rules it satisfies at review, per FR-052.
- **FR-163**: The character MUST remain `magenta`-dominant and MUST NOT use `orange`
  as a dominant colour, so the player is never confusable with a hazard (P-4).

**The palette amendment** _(Q1, decided 2026-09-04)_

- **FR-179**: The style bible's section 1 palette MUST gain exactly one token, for
  skin, and MUST continue to be stated as an exhaustive enumeration. The token's
  value MUST be derived from the supplied sheet's own skin tone rather than invented,
  so the amendment admits the art that prompted it and nothing more.
- **FR-180**: The amendment MUST ship in the same change set as the asset, comprising
  the section 1 table edit, an architecture decision record explaining why "eight
  colours" changed, and the extension of the automated palette check to the ninth
  token. A bible that disagrees with a shipped asset is a defect under Principle I.
- **FR-181**: The new token MUST NOT be used as a ground, a text colour, a terrain
  edge, or a hazard marking. It is a player-sprite colour, and the rules that assign
  every other token its role MUST be extended to say so.
- **FR-182**: The new token MUST remain distinguishable from `orange` under simulated
  protanopia, deuteranopia and tritanopia, to the same threshold already applied to
  the player/hazard pair. A skin tone that collapses into the hazard colour would
  reintroduce by the back door the confusion P-4 exists to prevent.

**Pose selection**

- **FR-164**: The pose MUST be selected from run state and render-only timing that
  already exist. This feature MUST NOT add, remove or alter any field of the
  simulation state, and MUST NOT change the state hash.
- **FR-165**: The system MUST distinguish, at minimum, these states by pose: carving
  while grounded; crouched and charging; the launch extension; airborne and tucked;
  absorbing a landing; and wiped out.
- **FR-166**: Pose MUST follow the crouch continuously enough that a player holding
  and releasing crouch repeatedly sees no flicker or stutter in the character.
- **FR-167**: While a spin is turning, the character MUST read as spinning, and on a
  touchdown that ends the run under FR-124 MUST NOT be drawn as a clean landing.
- **FR-168**: The landing absorb MUST be driven by render-side timing in the manner
  the existing landing effect already uses, MUST run on the simulation's tick rather
  than the display's frame so it lasts the same wall-clock time on any refresh rate,
  and MUST be abandoned immediately if the skier leaves the ground again before it
  completes.
- **FR-169**: The character MUST NOT be rotated by a continuously varying angle while
  it is skiing. Alignment to the surface MUST be carried by which pose is drawn, from
  a small fixed set of lean poses, so the sheet's pixel grid stays intact at every
  angle the slope presents. Continuous rotation is permitted in exactly two places
  where the rotation is itself the subject and grid breakup is acceptable: a spin
  that is turning, and the wipeout tumble.
- **FR-183**: The lean poses MUST cover the full range of slope angle the courses
  actually present, with no angle left undrawn.
- **FR-184**: Transitions between lean poses MUST NOT flicker. A slope angle sitting
  on the boundary between two poses, or oscillating across it, MUST resolve to a
  stable choice rather than alternating frame to frame.
- **FR-185**: Where the supplied sheet does not already contain a lean pose FR-183
  requires, the additional pose MUST be drawn in the same hand and pass the same
  style review as the rest of the sheet. It MUST NOT be produced by rotating an
  existing cell, which is the artefact FR-169 exists to avoid.

**Provenance and source retention**

- **FR-170**: The sheet's provenance MUST be recorded in a versioned README in the
  asset directory, naming the work and establishing it as an original work the
  project owns, in the manner rule A-5 requires of recorded audio. An asset whose
  provenance is not recorded there cannot pass review under FR-052.
- **FR-171**: The editable source of the sheet MUST be retained in the repository
  alongside the shipped file, per the constitution's asset-management clause, with
  large-file handling configured if the source exceeds the threshold already
  configured for this repository.

**Robustness and accessibility**

- **FR-172**: If the sprite sheet fails to load for any reason, the run MUST remain
  fully playable and scoreable, and a visible `magenta` player character MUST be
  drawn at the same footprint.
- **FR-173**: The sheet MUST be requested through the same base-path resolution every
  other runtime asset in this product uses, so it cannot 404 at the production base
  path while succeeding on a development server.
- **FR-174**: Under reduced motion, every pose that carries state MUST still be
  shown; only purely decorative movement may be suppressed.
- **FR-175**: The character MUST remain distinguishable from every hazard under
  simulated protanopia, deuteranopia and tritanopia, and MUST differ from them in
  silhouette as well as in hue (P-5).

**Budgets**

- **FR-176**: The shipped sheet MUST NOT push the initial payload past its 2 MB
  gzipped ceiling, and MUST NOT push time to interactive past 5 s on Fast 3G with a
  cold cache.
- **FR-177**: Drawing the character MUST NOT regress the frame-time budget: 16.7 ms
  at the 95th percentile on reference hardware, sustaining at least 50 fps through a
  full run.
- **FR-178**: The character MUST be drawn with nearest-neighbour sampling. Smoothed
  or interpolated scaling of a pixel-art asset breaks rule LW-1's one-device-pixel
  linework and is a style-review rejection.

### Key Entities

- **Sprite sheet**: one raster image containing every drawn pose of the player
  character on a uniform grid. Ships as a single file; has a retained editable
  source; has a recorded provenance entry.
- **Pose**: a named state the character can be drawn in — carve, crouch, launch, air,
  absorb, wipeout. Each maps to one or more cells of the sheet.
- **Pose map**: the versioned declaration binding pose names to sheet cells, cell
  geometry, and any sequence timing. Data, not code, per the constitution's
  data-driven-content clause.
- **Provenance record**: the versioned statement that the sheet is an original work
  the project owns, naming the work and its author.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-053**: A player watching a recorded run with the HUD hidden can name what the
  skier is doing — cruising, charging, launched, airborne, landing, crashed — at
  every moment of the run, with at least 90% agreement across at least three
  observers.
- **SC-054**: The character is identified as a skier, and told apart from every
  hazard on screen, within one second of a first-time player's first frame.
- **SC-055**: 100% of replayed pre-feature run records produce an identical score,
  outcome and state hash on the build carrying this feature.
- **SC-056**: A full run completes and commits a score with the sprite sheet
  unavailable, in a real browser, against the built artifact at its production base
  path.
- **SC-057**: Frame time stays within 16.7 ms at the 95th percentile through a full
  run on reference hardware, and the run sustains at least 50 fps — no worse than the
  measurement taken before this feature.
- **SC-058**: The addition to the initial payload is stated in the change
  description, and the total initial payload remains under 2 MB gzipped.
- **SC-059**: Every pixel of the shipped sheet is one of the nine declared colours or
  fully transparent — zero exceptions — verified automatically rather than by
  inspection, and the palette check fails if a tenth colour is ever introduced.
- **SC-062**: The character reads as aligned to the surface it is riding at every
  slope angle the courses present, and no observer reports the character stepping,
  flickering or shimmering between orientations during a full run.
- **SC-060**: Every state-carrying pose still appears with reduced motion enabled,
  verified in an automated test rather than by eye.
- **SC-061**: A human has played a full run end to end and recorded findings against
  this spec, per the Definition of Done.

## Clarifications

### Session 2026-09-04

Two decisions changed what gets built and could not be defaulted. Both are settled.

- **Q1 — palette conformance.** Does the sheet come to the eight-colour rule, or does
  the rule get amended for the player sprite?
  → **Add exactly one token, for skin, and quantise everything else to the resulting
  nine.** The palette stays an exhaustive enumeration a test can enforce, rather than
  becoming a judgement call about how many tones are too many. Requires a style-bible
  amendment and an ADR in the same change set. Governs FR-162 and FR-179..FR-182;
  measured by SC-059.

- **Q2 — rotation treatment.** How is a pixel-art character rotated by a continuous
  orientation angle without turning to mush?
  → **It is not.** Alignment to the surface is carried by pose selection from a fixed
  set of lean poses; continuous rotation survives only for a turning spin and the
  wipeout tumble, where the rotation is the subject rather than an artefact. Governs
  FR-169 and FR-183..FR-185; measured by SC-062.

## Assumptions

- The character faces one direction. The run travels downhill only, so no mirrored
  variant is drawn and none is needed.
- Pose selection reads only fields already on the run state — grounded, crouch held,
  crouch charge, crouch profile, spin ticks remaining, spin direction, accumulated
  rotation, which surface is ridden, the tick, and the orientation vector — plus
  render-side timing owned entirely by the view, in the manner the landing effect
  established. No new simulation field is introduced, because a field added for
  presentation would put presentation inside the thing FR-026's reproducibility is
  computed over.
- The existing rooster tail, landing flash and camera shake are kept as they are.
  They are not part of the character sheet and this feature does not redesign them.
  The scarf **is** drawn in the sheet, so the separately drawn sine-driven scarf is
  expected to be retired — a consequence of the change rather than a goal of it.
- The collision model is a footprint, not a silhouette. A more detailed drawing does
  not make the character's hitbox more detailed, and must not, because that would be
  a feel change under Principle III.
- The sheet is delivered as a raster grid with uniform cells. Where the supplied
  source is not uniform, re-laying it out into a uniform grid is part of this feature
  (FR-160) and the original layout is retained as source (FR-171).
- Only the run screen is affected. The title screen, results panel, leaderboard and
  every other screen keep whatever they draw today.
- The existing palette test remains the enforcing mechanism for the amended palette,
  extended rather than replaced. It currently asserts the token set exhaustively;
  that assertion is updated to nine and is not loosened.
- The nine-colour rule binds the sheet's pixels. It does not authorise a tenth colour
  anywhere else in the product, and every other asset stays inside the original
  eight.
- The number of lean poses is a consequence of the slope range the courses present
  and of what reads at this buffer size. It is settled during planning against the
  actual course data, not guessed here.

## Dependencies

- **The sheet itself.** The supplied image arrived in conversation, not in the
  repository. It MUST be committed — shipped file and editable source — before any of
  this can be built or reviewed. Nothing here is buildable from a screenshot.
- **The existing render/simulation separation** — the render layer reads run state
  and never writes it — is relied upon and must hold.
- **The reduced-motion settings** already used by the landing and death effects are
  relied upon for FR-174.
- **The base-path asset resolution** introduced by feature 003 is relied upon for
  FR-173.

## Constitutional Compliance Notes

- **Principle I** — this spec precedes implementation; every requirement is numbered
  and traceable.
- **Principle II** — no simulation change, so determinism is preserved by
  construction rather than by test alone; the determinism test still gates it
  (SC-055).
- **Principle III** — no tuning value moves (FR-161). The human playtest required by
  the Definition of Done is SC-061.
- **Principle IV** — the palette conflict is stated rather than worked around. Q1
  amends the style bible by one token; FR-180 requires the bible edit, the ADR and
  the extended automated check to ship in the same change set as the asset, following
  the precedent set by ADR-0009. **Approving this spec approves that amendment.**
  Being a style-bible change rather than a constitution change, it carries no
  constitution version bump — the same treatment ADR-0009's A-1 amendment received.
- **Principle V** — unaffected, and asserted by SC-055.
- **Principle VI** — SC-056 is verified against the built artifact at its production
  base path in a real browser, not against a development server.
- **Principle VII** — this feature adds no operator-facing instruction. If it adds a
  build or asset-preparation step, that step falls under Principle VII and must be
  executed verbatim in CI.
