# Feature Specification: A Coached First Run, and a Rope You Can See

**Feature Branch**: `claude/lucid-dijkstra-6caua6`

**Created**: 2026-09-09

**Status**: Clarified 2026-09-09 — ready for `/speckit-plan`

**Input**: User description: "in addition to the features called out below from our
initial chat, I would like to expand the practice runs to include an initial
tutorial section that teaches users how to interact with each terrain object. We
should use a similar style we used for the point badges, where a player is moving
down a gentler slope than the current course and sees a tree branch with a badge
saying 'hold to crouch!' and then sees a box and a badge saying 'release to Jump!',
and then a little jump with a badge saying 'stay crouched!', and then a big kicker
with a badge saying 'swipe forward or backward to flip!'
&nbsp;
Also, I find the tree branch to be visually difficult to distinguish from the
terrain. Let's shift to using a ski boundary rope instead, the player has to duck
under. Please use the attached image for reference." — supplied with a pixel-art
reference sheet of a pennanted boundary rope.

Supplied material, as delivered:

| Property   | As supplied                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Form       | Single raster reference sheet, five panels on a flat grey backing                                                                               |
| Panels     | Taut span bare; short span with three pennants; arced span with three pennants; a two-panel repeating run of catenary swags between high points |
| Rope       | Twisted / barber-striped cord, magenta over a darker purple core                                                                                |
| Pennants   | Triangular, hanging point-down beneath the rope, alternating magenta, cyan, purple/blue                                                         |
| Palette    | Reads entirely within the style bible's existing eight tokens — no ninth colour required                                                        |
| Provenance | Reference supplied by the maintainer for use in this product                                                                                    |

## Context

This feature changes **what the player is taught, and what one hazard looks like**.
It changes nothing about claiming a name, the run economy, committing a score, the
deadline, the standings, the official course, the physics, or the scoring table.
Those remain governed by `specs/001-shredpocalypse-bed-draft/spec.md` and
`specs/002-alpine-two-track-restyle/spec.md`.

Two problems, one feature.

**The game never teaches its own controls.** The entire instruction set a player
receives today is one 12px line on the roster panel: _"Hold to tuck and go faster —
let go to jump. Let go under something low and you eat it."_ Rotation is never
mentioned anywhere in the product. Rotation gates the whole trick economy — FR-079
requires air to rotate, FR-033 pays the trick bonus from rotation, FR-087 gates air
behind the crouch — so a player who is never told that arrows or a drag will spin
him can only ever earn the completion base and ground-level pickups. He then spends
his one official run, which FR-018 makes irreversible, without knowing a scoring
verb exists. Feature 001 saw this coming: assumption PT-1 records _"A brief tutorial
is wanted anyway, deferred to a later feature."_ This is that feature.

**The hazard you must duck is drawn as scenery.** Rule TR-2 makes a `low` obstacle
an overhanging bough — a tapered limb with needle wedges hanging to the collision
floor. It was the right call against the rectangle it replaced, and it has one flaw
the rule could not anticipate: rule TR-1 fills the same frame with five ranks of
pine, so the one bough that kills is drawn in the same vocabulary as the several
dozen trees that do not. The maintainer, who built it, cannot pick it out of the
terrain at speed. Rule L-0 settles what happens next — legibility outranks style —
so the bough is replaced by a ski boundary rope: a rope-and-pennant line strung
across the piste, which is a thing no forest contains, sits in the player's own
palette rather than the backdrop's, and says "get under me" without needing to be
learned.

The two halves ship together because the coached opening has to teach the rope, and
teaching the old bough would mean drawing the player's attention to the exact object
this feature exists to retire.

**Numbering**: requirements continue from feature 004 (FR-186+, SC-063+) rather than
restarting at 001, matching the convention established in feature 002. Source
comments, validator rules and contracts across this repository cite bare requirement
numbers with no feature prefix, so a second `FR-001` would be ambiguous wherever it
appeared.

## Clarifications

### Session 2026-09-09

Three questions were put to the maintainer rather than defaulted, because each one
changed what gets built. All three are answered and folded into the requirements
below. Everything else the description left unstated was defaulted and is recorded
in [Assumptions](#assumptions).

- **Q: Does the coached opening run on every practice run, or only the first?**
  → **A: Every practice run, always.** No record of who has been coached, no new
  field on the roster entry, no migration, and nothing for a device switch or a
  cleared browser to get wrong. The section is short and gentle; a player who
  already knows it rides through it in seconds. Encoded as FR-186a.

- **Q: How does the flip badge word itself for a player with no touchscreen?**
  → **A: Name both verbs in one string, using arrow glyphs rather than the word
  "arrow".** The badge reads **SWIPE OR ← → TO FLIP!** on every device. One string
  is simpler than device detection and has no failure mode: there is no state in
  which a player is shown a verb his hardware cannot perform. Encoded as FR-190.

- **Q: What happens when a player wipes out inside the coached opening?**
  → **A: Normal rules apply. A wipeout is a wipeout — it ends the run and spends
  one of the three practice runs.** Nothing special is built. The consequence, which
  was raised before the decision and accepted, is that a player can spend his whole
  practice allowance inside the teaching section and then meet the scored course
  cold. Encoded as FR-192a, which also records what now carries the weight of
  preventing it: FR-187's gentler slope and FR-192's "completable by a player who
  does nothing" are no longer comfort requirements, they are the only guard.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — The game teaches its four verbs before it asks for them (Priority: P1)

A player taps his name and starts his first practice run. The slope he lands on is
gentler than anything he has ridden — it barely falls away — and he is moving slowly
enough to read. A boundary rope is strung across the piste ahead, pennants hanging
off it, and above it a badge in the game's own sound-effect lettering: **HOLD TO
CROUCH!**. He holds, he ducks under it, the badge clears. A box of deadfall comes
next with **RELEASE TO JUMP!** over it; he lets go and pops over it. Then a small
ramp with **STAY CROUCHED!**, and holding through the lip throws him further than
letting go would have. Then a big kicker with **SWIPE OR ← → TO FLIP!**, which
tells him what to do whether he is holding a phone or sitting at a laptop, and for
the first time he spins in the air and a trick badge pays him for it. The
coached section ends, the slope steepens into the warm-up course he has always had,
and he rides the rest of it knowing four things he previously had to guess.

**Why this priority**: This is the feature. Every other item here supports it. A
player who reaches his one irreversible official run without knowing rotation exists
has been failed by the product, and today that is every player who does not read
source code.

**Independent Test**: Start a practice run with no prior knowledge of the controls.
Confirm all four badges appear in order, each while its object is on screen and
before it is reached, each naming the verb that object answers to. Confirm the
coached section is completable using only the instruction on screen. Confirm the run
then continues into the existing warm-up terrain without a break, a load, or a
second start.

**Acceptance Scenarios**:

1. **Given** a player starting a practice run, **When** the run begins, **Then** he
   is on a section whose slope is materially gentler than the warm-up course that
   follows it, and the first coached object is ahead of him.
2. **Given** the boundary rope is approaching, **When** it enters the readable
   zone, **Then** a badge reading **HOLD TO CROUCH!** appears and stays legible
   until he has passed the rope.
3. **Given** the player has ducked the rope, **When** the deadfall approaches,
   **Then** a badge reading **RELEASE TO JUMP!** appears and the previous badge is
   gone.
4. **Given** the player has cleared the deadfall, **When** the small ramp
   approaches, **Then** a badge reading **STAY CROUCHED!** appears, and holding the
   crouch across the lip produces a visibly longer launch than releasing it.
5. **Given** the player has taken the small ramp, **When** the big kicker
   approaches, **Then** a badge reading **SWIPE OR ← → TO FLIP!** appears, and
   executing either verb in the air pays a trick badge on landing.
6. **Given** a player on a laptop with no touchscreen, **When** the flip badge
   appears, **Then** it names a verb he can perform, without the product having
   detected anything about his device.
7. **Given** the coached section is complete, **When** the player passes its end,
   **Then** the slope steepens into the existing warm-up course, no further coaching
   badges appear, and the run ends as practice runs end today.

---

### User Story 2 — The thing that kills you does not look like the forest (Priority: P1)

A player riding any course sees a magenta rope strung across the piste with
triangular pennants hanging beneath it, sagging between its posts. It is the only
object on screen drawn in the colours the player himself is drawn in. He does not
have to work out whether it is a hazard or a tree, and he does not have to work out
how low it is, because the pennant tips hang to exactly the height he has to get
under. He ducks. Nothing about the timing, the clearance, or the consequence of
getting it wrong differs from before — only what he sees.

**Why this priority**: It is half the maintainer's request, it is a rule L-0
correction rather than a preference, and User Story 1 cannot teach a hazard the
player cannot pick out. Shippable on its own: re-skinning the obstacle improves
every course immediately, with or without the coached opening.

**Independent Test**: Ride a stretch of the official course containing `low`
obstacles, before and after the change, and confirm the object is identified as a
hazard from further away. Confirm by replay that an identical input sequence
produces an identical run and an identical score across the change — the picture
moved, the simulation did not.

**Acceptance Scenarios**:

1. **Given** any course containing a `low` obstacle, **When** it is drawn, **Then**
   it is a pennanted boundary rope and not a bough, on every course including the
   official one.
2. **Given** a boundary rope on screen, **When** the player judges his clearance,
   **Then** the lowest drawn mark on the object is the height he must get under —
   what he sees is what collides.
3. **Given** an identical course, seed, and input sequence, **When** a run is
   replayed across this change, **Then** the resulting score is identical.
4. **Given** the ranks of pine behind it, **When** a rope is on screen, **Then**
   nothing in the backdrop is drawn in the rope's colours at the rope's scale.

---

### User Story 3 — The same run every time (Priority: P3)

A player takes his second and third practice runs and gets exactly what he got the
first time: the same gentle opening, the same four objects, the same four badges,
then the same warm-up course. Nothing is remembered about him, nothing is skipped,
and nothing behaves differently because of what he did before.

**Why this priority**: This is the sameness the clarification bought, and it is
worth asserting rather than assuming. The alternative designs all needed a record of
who had been coached, and a record that can be wrong is a way for a player to be
dropped into the wrong terrain. Ranked last because it delivers no new capability —
it protects one.

**Independent Test**: Take three practice runs in a row under the same name, on a
fresh device and then on a second device, and confirm all three are identical from
the start line to the end of the coached section.

**Acceptance Scenarios**:

1. **Given** a player who has already completed a coached practice run, **When** he
   starts another practice run, **Then** the coached opening is present and
   identical.
2. **Given** a player who switches device, clears browser data, or opens a private
   window, **When** he starts a practice run, **Then** the coached opening is
   present and identical — nothing about it is remembered anywhere.

---

### Edge Cases

- **A player wipes out inside the coached section.** Settled: normal rules apply
  (FR-192a). The run ends and a practice run is spent, exactly as anywhere else.
  The accepted consequence is that a player can spend all three practice runs inside
  the teaching section and then meet the scored course cold. FR-187 and FR-192 are
  what keep that from happening in practice, which is why both are stated as hard
  requirements rather than as guidance.
- **A player ignores every badge.** The section MUST remain survivable by a player
  who reads nothing and presses nothing — he coasts through it and reaches the
  warm-up course. This is the single most important geometric constraint in the
  feature, because with FR-192a in force it is the only thing standing between a
  confused player and a spent practice allowance. See FR-192.
- **A player wipes out on the boundary rope in an official run.** No change: the
  rope collides exactly as the bough did, and the outcome commits per FR-017.
- **Reduced motion is on.** The coaching badges are score-adjacent information, not
  decoration. They follow the existing badge rule: the movement is dropped, the
  message and its legible hold are kept.
- **The player is mid-coached-section when the deadline passes.** Practice is
  unaffected by the deadline today and remains so; only starting an official run is
  gated.
- **A draft is already in flight with committed scores.** The re-skin is visual and
  the coached section is warm-up-only, so nothing here touches the frozen rules —
  see FR-196. But players who committed before this ships practised against a bough
  and players who commit after practise against a rope, on the same leaderboard.
  Recorded in [Assumptions](#assumptions) as accepted.
- **A badge would be drawn over the object it describes.** Legibility outranks
  style (L-0): the badge must not obscure the hazard it is pointing at, nor the
  contact line under it.

## Requirements _(mandatory)_

### Functional Requirements — the coached opening

- **FR-186**: Practice runs MUST begin with a coached section that precedes the
  existing warm-up terrain within the same continuous run. The player MUST NOT have
  to start, load, or select anything between the coached section and the warm-up
  course.
- **FR-186a**: The coached section MUST appear on every practice run, identically,
  for every player. The product MUST NOT record, anywhere, whether a player has
  been coached before, and MUST NOT vary the section on the basis of practice runs
  used, device, or session. Clearing browser data, switching device, or opening a
  private window MUST make no difference to it.
- **FR-187**: The coached section's terrain MUST be materially gentler than the
  warm-up course that follows it, such that a player travels it slowly enough to
  read a badge and act on it before reaching the object it describes.
- **FR-188**: The coached section MUST present exactly four coached objects, in this
  order: a boundary rope, a deadfall box, a small ramp, and a large kicker.
- **FR-189**: Each coached object MUST carry a badge naming the verb that object
  answers to, rendered in the same visual idiom as the existing trick badges
  (FR-128): sound-effect lettering, panelled, in the style bible's lettering rules.
- **FR-190**: The four badges MUST read, in order and verbatim: **HOLD TO CROUCH!**,
  **RELEASE TO JUMP!**, **STAY CROUCHED!**, **SWIPE OR ← → TO FLIP!**.
- **FR-190a**: The flip badge MUST carry both verbs in one string on every device.
  The product MUST NOT detect the input device and word the badge differently for
  each: one string that is always correct has no state in which a player is told to
  perform a gesture his hardware cannot perform.
- **FR-190b**: The two arrow marks in the flip badge MUST render legibly at badge
  size on the platform baseline, in the game's own typeface stack. Where a glyph
  does not, it MUST be replaced by a drawn arrow mark of the same meaning — the
  wording MUST NOT fall back to the word "arrow", which is what these marks were
  chosen over.
- **FR-191**: A coaching badge MUST appear while its object is visible and before
  the player reaches it, and MUST clear once that object is behind him. No two
  coaching badges may be legible at the same time.
- **FR-192**: The coached section MUST be completable by a player who performs the
  instructed verb, and MUST NOT be a dead end for one who does not. No coached
  object may be positioned such that failing to act on its badge makes the remainder
  of the section impossible to reach.
- **FR-192a**: A wipeout inside the coached section MUST behave exactly as a wipeout
  anywhere else: the run ends and one practice run is spent. No forgiving hazards, no
  refunded run, no mid-run restart, and no distinction in the run economy between
  where in a practice run the player came to grief.
- **FR-193**: The coached section MUST teach rotation explicitly, and MUST be the
  first place in the product where rotation is named. Rotation is the verb whose
  absence from the product this feature exists to correct.
- **FR-194**: Coaching badges MUST honour the reduced-motion preference the same way
  trick badges do: the movement is dropped, the message and its legible hold are
  kept.
- **FR-195**: The coached section MUST NOT alter the run economy. A practice run that
  includes it counts as exactly one practice run, and the official run, free play,
  and the three-run allowance are unchanged.
- **FR-196**: This feature MUST NOT change the official course layout, the physics,
  the tuning values governing feel, or the scoring table, and MUST NOT change the
  `rulesVersion` submitted with a committed score. A draft already holding committed
  scores MUST continue to accept official runs across this change without a reset.
- **FR-197**: The coached section MUST NOT appear in an official run or in free play.
  It is a property of practice.

### Functional Requirements — the boundary rope

- **FR-198**: A `low` obstacle MUST be drawn as a ski boundary rope on every course,
  replacing the overhanging bough entirely. No course may show both.
- **FR-199**: The rope MUST be drawn as a twisted cord carrying triangular pennants
  hanging point-down beneath it, following the supplied reference.
- **FR-200**: The lowest drawn extent of the rope object MUST correspond to the
  height the player must get under, across the object's full width. What the player
  sees MUST be what collides — this is rule TR-2's contract, carried over intact.
- **FR-201**: The rope MUST be visually distinguishable from the backdrop's pine
  ranks from far enough away that the player can commit to a duck before reaching
  it. Distinguishable at a glance, not on inspection.
- **FR-202**: The rope MUST be drawn within the style bible's existing eight-colour
  palette. This feature MUST NOT introduce a ninth colour.
- **FR-203**: The rope MUST carry the hazard treatment rule TR-3 requires — the
  killing surface marked as an edge, never as a fill over the whole silhouette.
- **FR-204**: This change MUST be visual only. The collision geometry, clearance,
  width, and every simulation consequence of a `low` obstacle MUST be byte-for-byte
  unchanged, provable by an identical replay across the change.
- **FR-205**: Style bible rules TR-2 and TR-3 MUST be amended in the same change set
  to describe the rope rather than the bough, per Principle IV's requirement that the
  style bible is the single source of truth, and Principle I's requirement that a
  spec disagreeing with shipped behaviour is a defect.

### Functional Requirements — decisions carried in from the usability review

These record decisions the maintainer took on findings raised before this spec was
written. Each is a documentation change with no runtime behaviour, and each is listed
as a requirement so the work is traceable per Principle I.

- **FR-206**: FR-030 ("Keyboard controls MUST be fully remappable") MUST be struck
  through in `specs/001-shredpocalypse-bed-draft/spec.md` with the reason and the
  date, following the precedent set by FR-065. The supporting `saveBindings` function,
  which no code has ever called, MUST be removed rather than left as machinery
  implying a feature that does not exist. **This conflicts with the constitution and
  is recorded as an open deviation — see [Constitutional Compliance
  Notes](#constitutional-compliance-notes).**
- **FR-207**: The absence of any way to abandon a practice or free-play run other
  than reloading the page is accepted and MUST NOT be built. ADR-0002 already governs
  abandonment of official runs and is unaffected.
- **FR-208**: Assistive-technology support — live-region announcements, managed
  focus, and semantic roles — is out of scope and MUST NOT be built. The audience is
  eight named friends. The constitution's existing accessibility obligations that
  ARE met — never conveying information by colour alone, and the reduced-motion
  option — remain in force and are not relaxed by this decision.
- **FR-209**: Highlighting the reading player's own row on the leaderboard is
  accepted as negligible and MUST NOT be built.
- **FR-210**: ADR-0002 MUST be corrected to remove its claim that abandonments are
  counted and visible on the leaderboard. That counter was removed in `7b2cc8b` and
  the record still describes it as the deterrent the decision rests on.
- **FR-211**: The duplicate ADR number MUST be resolved — `0010-a-ninth-colour.md`
  and `0010-organizer-actions-as-secret-gated-functions.md` both claim 0010, and only
  the second appears in the ADR index. One MUST be renumbered and the index MUST list
  both.
- **FR-212**: `README.md` MUST be corrected. It opens by stating the project is
  "Planned, not yet built" with "no game code" — the game has shipped and been
  played. It also still describes five governing principles; the constitution has
  carried eight since v1.3.0, which is the outstanding
  `TODO(README_PRINCIPLE_TABLE)`.
- **FR-213**: The `test:perf` script MUST be removed or made real. It points at
  `tests/e2e/performance.spec.ts`, which does not exist, so the one command that
  looks like the performance gate the constitution has required since v1.1.0 fails
  the moment anyone runs it.

### Key Entities

- **Coached section**: The opening stretch of the practice run. Has its own terrain
  profile, its own four objects, and a defined end at which the warm-up course
  begins. Not a separate course from the player's point of view — one continuous
  run.
- **Coaching badge**: A short instruction bound to a coached object, with a defined
  point at which it becomes legible and a defined point at which it clears. Carries
  no score and no simulation consequence.
- **Boundary rope**: The visual identity of a `low` obstacle. A twisted cord with
  hanging triangular pennants whose lowest extent is the collision ceiling. Purely a
  depiction — it owns no geometry the simulation does not already own.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-063**: A player who has never seen the game, given no instruction beyond what
  is on screen, completes all four coached beats on his first practice run.
- **SC-064**: That same player performs a rotation in the air during that run —
  the verb the product has never previously named.
- **SC-065**: A player can state, unprompted after one practice run, what each of
  the four objects requires of him.
- **SC-066**: Asked to point out the hazard he must duck while a run is in motion,
  a player identifies the boundary rope earlier than he identified the bough, and
  does not mistake a backdrop pine for it.
- **SC-067**: An identical course, seed, and input sequence produces an identical
  score across this change. The re-skin is provably invisible to the simulation.
- **SC-068**: A draft holding committed scores accepts a further official run after
  this change is deployed, with no reset and no rules-version mismatch.
- **SC-069**: The coached section adds no more than the frame-time budget already in
  force allows — no regression against the budgets in the constitution's Technical
  Standards.
- **SC-070**: Every document this feature contradicts is corrected in the same change
  set: the style bible, feature 001's spec, ADR-0002, the ADR index, and the README.
- **SC-071**: No playtester spends more than one practice run inside the coached
  section. A second one spent there means FR-187's slope or FR-192's geometry is
  wrong, and the section — not the player — is what gets revised.
- **SC-072**: A player on a device with no touchscreen, and a player on a phone,
  each read the flip badge and perform the rotation without asking what it means.
- **SC-073**: Three consecutive practice runs, across two devices and a cleared
  browser, present a byte-identical coached section.

## Assumptions

Recorded defaults where the description did not specify. Each is a decision taken,
not a gap left.

- **The user's numbered replies map to review findings 2 through 5, offset by one.**
  The maintainer replied "1. We don't need and can be struck / 2. Can be struck / 3.
  We don't need to do assistive tech / 4. I think is negligible" to a five-item
  review. Item 3 names assistive tech, which was the review's fourth item, so the
  list is read as: remappable controls struck (FR-206), mid-run abandonment struck
  (FR-207), assistive tech out of scope (FR-208), leaderboard self-highlight
  negligible (FR-209). The review's first item — that the game never teaches
  rotation — is not struck, because this feature is the maintainer commissioning its
  fix. Under a literal reading the first reply would strike the tutorial in the same
  message that requests it, so the offset reading is taken as the only coherent one.
- **The coached section prepends to the warm-up course rather than replacing it.**
  The description says "expand the practice runs to include an initial tutorial
  section", and FR-028 requires practice to happen somewhere other than the scored
  terrain. The warm-up course keeps its existing shape behind the new opening.
- **The coached section is scored like any other terrain.** Practice scores are
  recorded nowhere and affect no standing (FR-014), so nothing here needs a special
  scoring rule. The live score HUD behaves as it does today.
- **"Box" means the existing `solid` obstacle.** The description's "box" is deadfall
  — the obstacle kind that is cleared only by going over, which is what "release to
  jump" answers.
- **"Little jump" and "big kicker" are both the existing kicker object**, tuned
  differently, as the warm-up course already does: it carries a `power: 1.9` ramp
  and a `power: 0.7, launchAngle: 45, gravityScale: 0.25` booter today.
- **Changing the warm-up course does not touch the rules freeze.** Only the official
  course's `rulesVersion` is submitted with a score and compared by the database
  trigger, so warm-up terrain can change freely mid-draft. This is what makes
  FR-196 achievable rather than aspirational.
- **A mid-draft visual change is accepted.** Players who committed before this ships
  practised against a bough; players who commit after practise against a rope. The
  course layout, seed, and scoring are identical for both (FR-022 holds), and the
  alternative — holding a legibility fix until the draft closes — costs more than it
  protects.
- **The reference sheet is a reference, not an asset to ship.** It shows the object's
  vocabulary — twist, pennant shape, hang, sag. The shipped rope is drawn to the
  style bible in the game's own palette, as every other terrain object is.
- **Eight players, one cabin.** The audience is fixed and known, which is what makes
  FR-208 defensible and would not survive a public release.
- **The practice allowance is allowed to be spent on the tutorial.** FR-192a keeps
  normal wipeout rules inside the coached section, so a player who repeatedly fails
  the first rope can use all three practice runs without reaching the warm-up
  course, and then rides the scored course cold. This was raised before the decision
  and accepted: the alternatives each required either a hazard that does not hurt or
  a new distinction in the run economy, and neither was judged worth building for
  eight people on a gentle slope. The mitigation is geometric rather than
  procedural — FR-187 makes the section slow and FR-192 makes it survivable by a
  player who does nothing — which is why both are MUSTs and why SC-071 measures the
  outcome rather than trusting it.

## Out of Scope

- Any change to the official course, physics, tuning, or scoring (FR-196).
- Replay verification, accounts, or anything touching ADR-0004's trust model.
- The bough as a fallback or an option. It is replaced, not made configurable.
- Coaching anywhere outside the practice run — no badges in official runs or free
  play (FR-197).
- Teaching the upper track, ice, rocks, or pickups. Four verbs, four objects. A
  player who knows crouch, release, hold-through-a-lip and rotate has every verb the
  game has; the upper track is those verbs applied, not a fifth thing to learn.

## Constitutional Compliance Notes

**Principle I (Spec-Driven Delivery)** — satisfied. This spec precedes
implementation, which is the order features 002 and 004 did not manage.

**Principle III (Fun Is a Testable Requirement)** — the coached section's terrain and
its four objects are course data, and MUST live in versioned data files rather than
in code, like every other course in this project.

**Principle IV (One Coherent Voice)** — the rope is a style-bible change, and FR-205
requires the bible to be amended in the same change set rather than left describing
an object the game no longer draws.

**Principle VIII (The Player Judges Fun, Early)** — binding here. This feature
changes course data and the control surface's presentation, so it MUST reach the
maintainer as a playable single-file build at the first point the coached section
runs, not at completion, and the findings MUST be recorded against this spec in his
own words. A coached section that reads well in a diff and badly at speed is the
exact failure this principle exists to catch.

**OPEN DEVIATION — accessibility, controls remapping.** The constitution's Technical
Standards & Constraints states, without qualification: _"Controls MUST be fully
remappable."_ FR-206 strikes the spec requirement that implements it. This is a
deviation from a written MUST and it is recorded here rather than absorbed silently.

- **Rationale**: The obligation has never been met — `saveBindings` has existed
  since feature 001 and no code has ever called it. The audience is eight known
  people on their own phones and laptops, and no member of it has asked to rebind.
  The alternative to striking it is building a bindings UI nobody wants in order to
  satisfy a clause written for a broader product.
- **Scope**: This strikes remapping only. The other accessibility obligations in the
  same clause — information never carried by colour alone, and a reduced-motion
  option — are met today and stay in force, as FR-208 states.
- **Owner**: tucktuck22.
- **Required action**: Accessibility is in Technical Standards & Constraints, not in
  a NON-NEGOTIABLE principle, so Governance permits a documented deviation. But the
  honest resolution is an amendment: either narrow the constitution's accessibility
  clause to what this product actually intends to honour, or keep the clause and
  leave FR-030 standing as unbuilt work. Striking the spec requirement while leaving
  the constitutional MUST in place is the one outcome that makes the constitution
  describe a product that does not exist — which is precisely what Principle VI
  forbids.
- **Remediation date**: Before this feature merges. It is a paragraph in one
  document, not a build.

**Note on existing open deviations.** Deviations 2 (user-journey e2e specs run by no
CI job) and 3 (no performance budget job) in the constitution's Sync Impact Report
remain open and are untouched by this feature. FR-213 removes a script that
misrepresents deviation 3 as covered; it does not close it.
