# Feature Specification: Shredpocalypse '86 — Bed-Pick Draft

**Feature Branch**: `claude/session-start-ulvu8z`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Build 'Shredpocalypse '86,' a web-based downhill skiing game that determines the bed-selection draft order for an 8-person boys ski trip. The final leaderboard IS the bed-pick order. Each player gets exactly 3 practice runs, then 1 official run that commits immediately and irreversibly when it ends, including wipeouts. Shared via a single link, no accounts; the organizer pre-defines a roster and sets a deadline, after which the leaderboard freezes as FINAL and unplayed members forfeit to the bottom by coin flip. Identical course and seed for every official run; touch and keyboard parity; hybrid scoring (base + trick and pickup bonuses); ties break by earlier commit timestamp. Shared storage, never device-local; commits queue and retry on connectivity loss. Full 1986 styling with original period art and audio. Out of scope for v1: multi-trip support, accounts, spectator mode, replays."

## Clarifications

### Session 2026-09-01

- Q: What should happen when someone opens the link whose name is not on the roster — a late addition to the trip, or a friend who got forwarded the link? → A: Option C — anyone holding the player link can create a new name themselves. Self-serve, no organizer step.
- Q: What stops a player from skiing as slowly as possible to guarantee a clean finish? → A: A minimum downhill speed enforced by the physics, not a timer or a scoring rule. Established alongside the game's form: a 2D side-on platformer with jump, airborne rotation, crouch-to-duck, and an attack verb, built on a crisp momentum-based physics model.
- Q: How much of the zombie idea belongs in v1? → A: Option C — none. Attack acts on destructible barriers and terrain only, there are no enemies or pursuing hazards, and pacing is solved through scoring. Zombies are deferred to a later feature.
- Q: How should the scoring reward a fast run over a slow one? → A: Through the controls rather than the scoring table. Fixed base speed; crouching accelerates above it; releasing the crouch produces the jump. Air is therefore only reachable by crouching, which gates every trick bonus behind the speed mechanic.
- Q: If releasing the crouch always launches a jump, how does a player duck under a low obstacle and come back up without jumping into it? → A: Option D — he doesn't. Releasing under a low obstacle launches the skier into it and wipes out the run. The timing is the difficulty and learning it is the skill.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Claim your name and commit the one run that counts (Priority: P1)

A trip attendee taps the link in the group chat, sees the eight names on the roster, and taps his own. He gets three practice runs on a warm-up slope to learn the controls — not the course he will be scored on — then starts his official run behind a confirmation that leaves no doubt it counts. The run ends — at the finish line or face-first in a snowbank — and his score locks in on the spot. He immediately sees where he landed in the bed-pick order.

**Why this priority**: This is the entire product. Everything else supports or protects this loop. With a roster provisioned by any means, this single story delivers a usable draft for eight friends.

**Independent Test**: Provision a roster of eight names, open the link on a phone, claim a name, burn three practice runs, commit one official run, and confirm the score appears on a leaderboard ranked with rank 1 labeled as first bed pick — and that no path exists to run officially again.

**Acceptance Scenarios**:

1. **Given** an unclaimed roster with eight names, **When** a player opens the shared link and selects a name, **Then** that name is bound to him and shown as claimed to every other link holder.
2. **Given** a player who has claimed a name and used zero runs, **When** he plays, **Then** he is given exactly three practice runs whose scores are displayed but never recorded to the leaderboard.
3. **Given** a player with practice runs remaining, **When** he chooses to start his official run, **Then** the system requires an explicit confirmation stating the run counts once and cannot be retaken.
4. **Given** an official run in progress, **When** the player crosses the finish line, **Then** the score commits immediately and irreversibly and his rank is displayed.
5. **Given** an official run in progress, **When** the player wipes out, **Then** the run ends and the score accumulated to that point commits immediately and irreversibly.
6. **Given** an official run in progress, **When** the player closes the tab, kills the app, or otherwise ends the session before the run reaches a finish or a wipeout, **Then** nothing commits, his official run remains unused, and his abandoned-run count increases by one and becomes visible to everyone.
7. **Given** a player whose official score has committed, **When** he looks for any way to retake, edit, or delete it, **Then** no such path exists anywhere in the product.
8. **Given** a player whose official score has committed, **When** he plays again, **Then** the run is labeled free play and its score is recorded nowhere and changes no standing.

---

### User Story 2 - One official run per name, no matter the device (Priority: P2)

A player takes his three practice runs on his phone, has a rough official run, and tries his luck on a laptop — or in a private window, or after clearing his browser data. The game recognizes his name, shows him his committed score, and gives him nothing but free play.

**Why this priority**: The draft is only worth playing if the one-run rule holds. Device-local run counting would make the entire result meaningless, and this is the most likely way for the product to fail at its actual job.

**Independent Test**: Commit an official run on device A, then open the link on device B, in a private window, and after clearing site data on device A; confirm all three show the committed score and offer only free play.

**Acceptance Scenarios**:

1. **Given** a name whose official run has committed, **When** the link is opened on a different device and that name is selected, **Then** the committed score and remaining run counts are shown unchanged and no official run is offered.
2. **Given** a player who has used two of three practice runs, **When** he switches devices, **Then** he has exactly one practice run remaining.
3. **Given** a player returning on the same device, **When** he reopens the link, **Then** he resumes his claimed name without re-selecting it.
4. **Given** two devices both attempting an official commit for the same name, **When** both reach shared storage, **Then** the first to be confirmed is kept and the second is rejected with a message explaining that the name's official run is already committed.

---

### User Story 3 - The organizer sets up the draft and shares one link (Priority: P2)

The organizer enters the eight names going on the trip, sets a deadline of the Thursday before departure, and gets one link to drop in the group chat. Anyone who opens that link can add a name that is not there yet, so a late addition to the trip needs no organizer step. The organizer keeps a separate link that lets him fix a typo, push the deadline, or remove an entry that turned out to belong to somebody who is not coming.

**Why this priority**: Needed before the draft can be shared, but the player loop can be demonstrated against a hand-provisioned roster, so it does not gate the P1 slice.

**Independent Test**: Create a roster of eight names and a deadline through the organizer flow, open the resulting player link in a clean browser, and confirm the roster and deadline appear exactly as entered.

**Acceptance Scenarios**:

1. **Given** the organizer flow, **When** the organizer enters a list of names and a deadline, **Then** a single player link is produced that grants any holder the ability to claim an unclaimed name.
2. **Given** a roster being entered, **When** two identical names are submitted, **Then** the system rejects the duplicate and requires a distinguishing name.
3. **Given** a player holding the player link, **When** he enters a name that is not on the roster, **Then** the entry is created, claimed for him, and shown to everyone as self-created.
4. **Given** a player holding the player link, **When** he looks for deadline, removal, or reset controls, **Then** none are reachable — those actions exist only on the organizer link.
5. **Given** a roster already at 16 entries, **When** anyone tries to add another, **Then** the system refuses and names the cap.
6. **Given** an entry with a committed score that belongs to someone not on the trip, **When** the organizer removes it, **Then** he must confirm against the score being discarded and the entry remains visible on the leaderboard as removed.

---

### User Story 4 - The deadline produces the final bed order (Priority: P2)

Thursday night passes. The leaderboard stamps itself FINAL. Six guys have committed scores and are ranked. Two never played; they sit at the bottom, marked FORFEIT, with a note that the cabin will coin-flip between them.

**Why this priority**: This is the moment the leaderboard becomes the actual bed order. Without the freeze there is no authoritative result, only a running score.

**Independent Test**: Set a deadline in the near future with some roster members uncommitted, wait past it, and confirm the leaderboard reads FINAL, refuses new official commits, and groups uncommitted members at the bottom without inventing an order among them.

**Acceptance Scenarios**:

1. **Given** the deadline has passed, **When** any link holder views the leaderboard, **Then** it is labeled FINAL and no official run can be started.
2. **Given** the deadline has passed with two roster members having no committed run, **When** the final order is displayed, **Then** both appear below every committed score, marked FORFEIT, presented as an unordered group with an instruction to resolve by coin flip.
3. **Given** two committed scores that are numerically tied, **When** the order is displayed, **Then** the earlier commit timestamp ranks higher.
4. **Given** an official run that started before the deadline, **When** the deadline passes mid-run, **Then** the run is allowed to finish and commit.

---

### User Story 5 - A bad signal never eats a score (Priority: P3)

A player takes his official run on the chairlift Wi-Fi. He crosses the finish line and the connection drops. The game tells him his score is pending, keeps retrying, and posts it the moment the signal returns. He never has to wonder whether it counted.

**Why this priority**: A silently lost official score is unrecoverable by design — there is no retake — so this protects the product's one irreversible action. It is P3 only because it can be added after the core loop is proven.

**Independent Test**: Disable connectivity immediately before an official run ends, confirm the score is shown as pending and survives a page reload and a browser restart, then restore connectivity and confirm it posts.

**Acceptance Scenarios**:

1. **Given** an official run ending with no connectivity, **When** the score is committed, **Then** it is queued locally and the player is shown an unambiguous pending state, never a confirmation.
2. **Given** a queued commit, **When** the player reloads the page or restarts the browser, **Then** the queued commit still exists and is still retrying.
3. **Given** a queued commit, **When** connectivity returns, **Then** the score posts to shared storage and the player's state changes to confirmed.
4. **Given** no connectivity at all, **When** a player takes a run, **Then** the run is fully playable start to finish.

---

### User Story 6 - It looks and sounds like 1986 (Priority: P3)

Chrome title lettering over a neon gradient. Scanlines rolling over the snow. A synthwave loop that stays silent until somebody taps. A hot-dog skier in a headband and blade shades eating it at the last gate while the screen throws an insult at him.

**Why this priority**: The presentation is what makes eight friends actually play it rather than picking beds out of a hat, but the draft is functional without it.

**Independent Test**: Play a full run and confirm the style bible's rules for palette, lettering, scanlines, and audio are visibly followed, that audio is silent until first interaction, and that the reduced-motion option leaves the run fully playable.

**Acceptance Scenarios**:

1. **Given** a first visit, **When** the page loads, **Then** no audio plays until the player performs a deliberate interaction, and a mute toggle is available from that point on.
2. **Given** a wipeout, **When** the crash resolves, **Then** an insult is drawn from the versioned insult set and displayed.
3. **Given** the reduced-motion option is enabled, **When** the player takes a run, **Then** scanlines, screen shake, flashing, and parallax are disabled and the run remains fully playable and scoreable.
4. **Given** any screen in the product, **When** it is reviewed against the style bible, **Then** every visual and audio element cites the rule it satisfies.

---

### Edge Cases

- **A player abandons his official run mid-descent** — closes the tab, kills the app, or pulls the plug when the run is going badly. Resolved in favor of the honor system: nothing commits and the official run stays unused (FR-019). The reroll path this opens is deliberately left open and made visible rather than blocked (FR-065). See **Accepted Consequences** below for what this costs.
- **A player restarts his official run repeatedly to scout the course.** Permitted by FR-019 and unpreventable under the chosen model. Each restart increments a publicly visible counter (FR-065); the deterrent is social, not technical.
- **A player abandons a practice run.** Same rule as official: nothing is consumed and the run may be retaken (FR-066).
- **Two players claim the same name at nearly the same moment.** The first claim to reach shared storage wins; the second player is told the name is taken and returned to the roster.
- **Someone who is not on the trip creates an entry and commits a score.** Self-serve creation makes this reachable by anyone holding the link. The organizer removes the entry under FR-074; the removal is confirmed, recorded, and shown rather than silent.
- **The roster fills up with entries nobody recognises.** The cap in FR-002 bounds the damage at 16, and FR-073 marks which entries were self-created so the group can tell them apart at a glance.
- **Two people create near-identical names** ("Dave" and "Dave "). FR-003 rejects only exact matches, so near-duplicates are possible and are left to the organizer to clean up rather than blocked by a similarity rule that would also reject two genuine Daves.
- **A player claims the wrong name.** Before any official commit, the organizer can release a claim from the organizer link. After an official commit, the claim is permanent and the organizer must reset the draft to undo it.
- **The organizer deploys a change to physics, course, or scoring mid-draft.** Scores committed under different rules are not comparable, and the leaderboard is the bed order. The rules freeze at the first official commit (FR-023).
- **Every roster member forfeits.** The leaderboard finalizes with no ranked entries and the entire roster in the coin-flip group.
- **A player finishes with a score identical to another and an identical commit timestamp.** The tie is displayed as unresolved and flagged for coin flip rather than broken arbitrarily.
- **The deadline is set in the past, or changed to a time already elapsed.** The draft finalizes immediately; the organizer is warned before the change is applied.
- **A player takes zero practice runs and goes straight to official.** Permitted; unused practice runs are forfeited.
- **A device's clock is wrong.** Commit timestamps are the tiebreaker and must not be derived from the player's device.
- **The browser tab is backgrounded mid-run.** The simulation must not advance unattended in a way that changes the outcome.
- **A player's connection drops mid-run rather than at commit.** The run continues locally and commits on the same queue-and-retry path.

## Requirements _(mandatory)_

### Functional Requirements

> Requirement numbers are stable identifiers, not an ordering. FR-065 through FR-069 were added when the clarification answers landed and are placed in the section they belong to rather than renumbered, so that anything tracing to an earlier number keeps tracing to it.

#### Draft setup and roster

- **FR-001**: System MUST allow an organizer to define an initial roster of named attendees before the draft is shared with players. The initial roster MAY be empty.
- **FR-002**: System MUST support a total of at most 16 roster entries, however they were created, with 8 as the expected size. A draft MUST be playable from the first entry onward; no minimum is required before play begins.
- **FR-003**: System MUST reject a new entry whose name exactly matches an existing entry and MUST require a distinguishing name.
- **FR-070**: Any holder of the player link MUST be able to create a new roster entry by entering a name, without an organizer step and without any credential, at any time before the deadline and while the roster is below the cap in FR-002.
- **FR-071**: A self-created entry MUST be indistinguishable in rights from an organizer-created one: 3 practice runs, 1 official run, and the same standing on the leaderboard.
- **FR-072**: When the roster is at the cap, the system MUST refuse new entries with a message naming the cap and directing the player to the organizer.
- **FR-073**: The leaderboard MUST show, for each entry, whether it was created by the organizer or self-created, so the group can see at a glance who was on the original list.
- **FR-004**: System MUST allow the organizer to set and later change a deadline, and MUST warn before applying a deadline that has already elapsed.
- **FR-005**: System MUST produce a single shareable player link that grants any holder the ability to create a roster entry, claim an unclaimed one, and play.
- **FR-006**: System MUST expose organizer-only actions — roster editing, entry removal, deadline changes, claim release, draft reset — only via a URL distinct from the player link, and MUST NOT expose them from the player link.
- **FR-007**: The organizer MUST be able to remove any roster entry that has no committed official run, without restriction.
- **FR-074**: The organizer MUST be able to remove a roster entry whose official run has already committed, because self-serve creation means an entry may belong to someone who is not on the trip. Such a removal MUST require an explicit confirmation naming the score being discarded, MUST be recorded, and MUST remain visible on the leaderboard as a removed entry rather than disappearing silently. Removal MUST NOT be available from the player link.
- **FR-075**: System MUST NOT allow renaming an entry whose official run has already committed. A wrong name on a committed score is corrected by removal, not by editing the name attached to a result.

#### Name claiming and identity

- **FR-008**: Players MUST be able to claim exactly one unclaimed roster name, and claimed names MUST be shown as claimed to all link holders. Creating an entry MUST claim it for its creator in the same action.
- **FR-009**: System MUST NOT require an account, password, PIN, or any other credential to claim a name or play.
- **FR-010**: System MUST resume a player's claimed identity automatically when he returns on the same device.
- **FR-011**: System MUST allow a player to resume his identity on any other device by re-selecting his name from the roster, carrying his run counts and committed score with him.
- **FR-012**: When two claims for the same name race, the first to be confirmed in shared storage MUST win and the second MUST be rejected with a clear message.

#### Run economy

- **FR-013**: Each claimed name MUST receive exactly 3 practice runs and exactly 1 official run.
- **FR-014**: Practice run scores MUST be displayed to the player and MUST NOT be recorded to the leaderboard or affect standings.
- **FR-015**: Players MUST be allowed to start their official run before exhausting practice; unused practice runs are forfeited.
- **FR-016**: System MUST require an explicit confirmation before an official run begins, stating unambiguously that the run counts once and cannot be retaken.
- **FR-017**: System MUST commit the official run's score immediately and irreversibly at run end, including runs that end in a wipeout.
- **FR-018**: System MUST NOT provide any player-accessible path to retake, edit, or delete a committed official score.
- **FR-019**: An official run whose session ends before the run reaches a finish or a wipeout MUST be discarded in full. No score commits, and the name's official run remains unused and may be started again. There is no limit on how many times an official run may be restarted this way before the deadline.
- **FR-065**: System MUST maintain, for each roster member, a count of official runs abandoned under FR-019, and MUST display that count on the leaderboard alongside his name and score. Abandonment is permitted; it MUST NOT be private.
- **FR-066**: A practice run abandoned before it ends MUST likewise be discarded and MUST NOT consume one of the three practice runs.
- **FR-020**: After committing, players MUST be able to take unlimited free-play runs whose scores are recorded nowhere and affect no standing, and which MUST be visibly labeled as not counting.
- **FR-021**: Run counts, claims, and committed scores MUST be held in shared storage readable by all link holders. Switching devices, clearing browser data, or using a private window MUST NOT grant additional practice or official runs.

#### Course fairness and determinism

- **FR-022**: Every official run MUST use an identical course layout and identical seeded randomness for every player.
- **FR-023**: Course layout, physics, and scoring rules MUST be frozen from the moment the first official run commits. System MUST record a rules version with every committed score, and MUST warn the organizer that changing any of them invalidates cross-version comparison and requires a full draft reset.
- **FR-024**: All randomized elements affecting a run — obstacle and pickup placement, weather, hazard timing — MUST derive from the shared seed. No unseeded randomness may influence scoring.
- **FR-025**: The simulation MUST advance on a fixed timestep independent of display refresh rate and device performance, so that frame rate and hardware never confer a scoring advantage.
- **FR-026**: Given an identical course, seed, input sequence, and rules version, the simulation MUST produce an identical score.
- **FR-027**: The simulation MUST NOT advance unattended while the browser tab is backgrounded in any way that alters the run's outcome.
- **FR-028**: Practice runs MUST use a warm-up course distinct from the official course, so that the official run is a first look at the scored terrain.
- **FR-067**: The warm-up course MUST be identical and identically seeded for every player, and MUST use the same physics, control response, and scoring rules as the official course, so that practice is a faithful rehearsal of everything except the terrain.
- **FR-068**: The official course MUST NOT be reachable in practice or in free play before that player's official run has committed. Free play after commit MAY use the official course.

#### Gameplay model and physics

- **FR-076**: The game MUST present as a 2D side-on platformer: the player skis left-to-right across a vertically varying slope, with the terrain profile, obstacles, and the skier's silhouette all readable from the side.
- **FR-077**: The skier MUST travel at a fixed base speed on the slope, defined in tuning data. There is no brake and no input that reduces speed below the base. Slope angle MAY modulate speed within bounds set in tuning data, but the player cannot choose to go slower.
- **FR-078**: Crouching MUST accelerate the skier above the base speed, and releasing the crouch MUST produce the jump. Jump and crouch are a single input: hold to tuck and gain speed, release to launch. The launch impulse MUST compose with current momentum rather than replacing it, so a faster tuck produces a longer, faster jump.
- **FR-079**: The player MUST be able to rotate while airborne. Rotation MUST feed the trick bonus in FR-033, and landing orientation relative to the slope MUST determine whether a landing is clean or a wipeout.
- **FR-080**: Crouching MUST also reduce the skier's profile enough to pass under low obstacles, so the same input serves ducking, accelerating, and charging a jump.
- **FR-088**: Releasing a crouch beneath a low obstacle MUST launch the skier into that obstacle and wipe out. There is no clearance check, no charge threshold, and no suppression of the launch. Ducking and jumping are the same input, and choosing when to release is the core skill of the game.
- **FR-089**: Every low obstacle on the official and warm-up courses MUST be followed by a stretch of overhead clearance, of a minimum length set in tuning data, in which a player can release safely. A low obstacle MUST NOT be placed so that the only survivable release point is unreachable at base speed. The mechanic is meant to punish bad timing, not to make a section impossible.
- **FR-087**: Airtime MUST be reachable only through FR-078's crouch-and-release. Because rotation requires air (FR-079) and trick bonuses require rotation (FR-033), the entire trick economy is gated behind the speed mechanic: a player who never crouches travels at base speed, never leaves the ground, and can earn only the completion base and ground-level pickups. This is the mechanism by which speed pays, in place of a time component in the scoring table.
- **FR-081**: The player MUST be able to attack, destroying destructible barriers placed on the course. Destructible barriers MUST be positioned so that breaking through opens a faster or higher-scoring line than going around, giving the verb a reason to exist beyond obstacle removal.
- **FR-086**: The course MUST contain no autonomous or pursuing entities in v1. Every hazard is static terrain, a static obstacle, or a destructible barrier, whose position derives from the shared seed. Nothing on the course chases, tracks, or reacts to the player.
- **FR-082**: Simulation MUST be continuous and momentum-preserving: position, velocity, and angular orientation evolve under slope, gravity, and player input rather than snapping between discrete states. Terrain contact MUST resolve against the slope angle, so landing on a downslope differs from landing on a flat.
- **FR-083**: Every feel parameter governing the above — minimum and maximum downhill speed, slope acceleration, jump impulse, rotation rate, air control, crouch profile and tuck bonus, landing angle tolerance, attack reach and cooldown — MUST have a named value and an acceptance tolerance in versioned tuning data, per FR-036 and constitution Principle III.
- **FR-084**: Where physical realism and input crispness conflict, crispness MUST win. No realism treatment may push input-to-visible-response past the 2-frame limit in FR-031 or introduce simulation behaviour that cannot be reproduced under FR-026.

#### Controls

- **FR-029**: Touch and keyboard control schemes MUST each expose every action available in the other with equivalent precision and timing capability.
- **FR-030**: Keyboard controls MUST be fully remappable.
- **FR-031**: Input-to-visible-response latency MUST NOT exceed 2 simulation frames under normal load.
- **FR-032**: Shared control verbs — crouch/launch, rotate, attack, crash, recover — MUST behave identically regardless of input device and MUST NOT invert or remap between devices.
- **FR-085**: Touch controls MUST express all three active inputs (crouch/launch, rotate, attack) one-handed on a phone, without requiring simultaneous multi-finger gestures.

#### Scoring

- **FR-033**: Score MUST be the sum of a base component awarded for progress and completion, plus trick bonuses and pickup bonuses.
- **FR-034**: The base component awarded for reaching the finish without wiping out MUST exceed the maximum bonus total achievable in a single run, so that every finisher outranks every non-finisher regardless of tricks collected.
- **FR-035**: A player who reaches the finish without collecting a single trick or pickup MUST post a non-trivial score, so that a non-gamer who simply survives is competitive rather than symbolic.
- **FR-036**: All scoring values, bonus tables, and feel-tuning parameters MUST live in versioned, human-readable data files and MUST NOT be embedded in code.
- **FR-037**: Ties MUST break by earlier commit timestamp. Timestamps MUST be assigned by shared storage, never by the player's device.
- **FR-038**: Ties that remain after timestamp comparison MUST be displayed as unresolved and flagged for coin flip rather than broken arbitrarily.
- **FR-039**: No cosmetic, progression, or purchasable element may confer any scoring advantage.

#### Leaderboard and final order

- **FR-040**: The leaderboard MUST be visible to every link holder and MUST show, for each roster member, his rank, name, score, and status — unclaimed, claimed, practicing, committed, or forfeit.
- **FR-041**: The leaderboard MUST state explicitly that rank 1 picks a bed first.
- **FR-042**: A committed score MUST become visible to all other viewers within 10 seconds under normal connectivity.
- **FR-043**: After the deadline the leaderboard MUST be labeled FINAL and MUST refuse to start or accept any further official run.
- **FR-044**: An official run started before the deadline MUST be allowed to finish and commit after it.
- **FR-045**: Roster members with no committed official run at the deadline MUST be placed below every committed score, marked FORFEIT, and displayed as an unordered group carrying an instruction to resolve by coin flip. System MUST NOT assign an order among them.

#### Connectivity and durability

- **FR-046**: A commit that cannot reach shared storage MUST be queued locally and retried until confirmed. It MUST NOT be silently discarded.
- **FR-047**: Players MUST see an unambiguous distinction between a pending commit and a confirmed one, and MUST NOT be told they are on the leaderboard until the commit is confirmed.
- **FR-048**: A queued commit MUST survive page reload and browser restart.
- **FR-049**: A run MUST be fully playable start to finish with no network connectivity.
- **FR-050**: Committed scores, claims, and run counts MUST never be lost or corrupted by a deployment. Any change to their stored shape MUST ship with a migration and a round-trip test.

#### Presentation, accessibility, and content

- **FR-051**: A written style bible MUST exist and MUST be the single source of truth for palette, linework, halftone and scanline treatment, chrome and neon lettering, panel framing, and audio character.
- **FR-052**: Every visual and audio asset MUST conform to the style bible and MUST cite the rule it satisfies at review. Assets failing style review MUST be rejected rather than merged with a promise to fix later.
- **FR-053**: All art and audio MUST be original works in period style. No third-party characters, logos, trademarks, music, or other licensed material may appear.
- **FR-054**: Audio MUST be silent on load and MUST begin only after a deliberate player interaction. A persistent mute toggle MUST be available thereafter.
- **FR-055**: No information a player needs to complete a run or read the standings may be conveyed by color alone.
- **FR-056**: A reduced-motion option MUST disable scanlines, screen shake, flashing, and parallax while leaving the run fully playable and scoreable.
- **FR-057**: No visual effect may flash more than three times per second across a large portion of the screen.
- **FR-058**: Audio cues carrying gameplay information MUST have a visible equivalent.
- **FR-059**: Wipeout insults MUST be drawn at random from a versioned data file. They MUST match the intended R-rated boys-weekend register and MUST NOT include slurs or content targeting protected characteristics.
- **FR-060**: Palette choices MUST be validated against common color vision deficiencies.
- **FR-061**: Legibility outranks style: where a period-authentic treatment obscures information the player needs, the treatment MUST be reduced.

#### Stability and integrity

- **FR-062**: No input sequence may crash, hang, or soft-lock the game. Randomized input testing MUST be part of the automated suite.
- **FR-063**: Any defect that interrupts an official run in progress is a release blocker.
- **FR-064**: Official scores are accepted as reported by the player's device. No verification is performed in v1.
- **FR-069**: Because scores are unverified, the product MUST NOT claim in player-facing copy, in the README, or anywhere else that standings are verified, validated, or tamper-proof. Existing wording to that effect MUST be corrected.

### Key Entities

- **Draft**: One trip's contest. Holds the roster, the deadline, the frozen rules version, the shared course seed, and the finalized state. Exactly one exists in v1.
- **Roster Entry**: A named attendee. Carries claim status, practice runs used, official run status, committed score, and commit timestamp.
- **Run**: A single descent. Typed as practice, official, or free play. Only official runs produce a committed score.
- **Committed Score**: The immutable record of an official run — name, score, commit timestamp assigned by shared storage, and rules version.
- **Course Definition**: The declared layout, obstacle and pickup placement rules, and seed from which every run is generated.
- **Scoring Table**: The versioned data defining base progress and completion values, trick bonuses, and pickup bonuses.
- **Insult Set**: The versioned collection of wipeout lines drawn from at random.
- **Style Bible**: The written authority on visual and audio treatment, against which every asset is reviewed.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A player who has never seen the game can open the link and be in his first practice run within 60 seconds, with no account, install, or instruction from the organizer.
- **SC-002**: All 8 roster members complete their practice runs and commit an official run without the organizer needing to intervene, reset, or manually correct any result.
- **SC-003**: A committed official score can never be increased, replaced, or removed by the player who set it — verified by attempting it from a second device, a private window, and after clearing site data.
- **SC-004**: Every official run presents the identical course and the identical placement of obstacles and pickups, verified by comparing runs across all 8 players.
- **SC-005**: A player who reaches the finish without collecting a single bonus outranks every player who wiped out, in 100% of cases.
- **SC-006**: Median official scores achieved on a mid-range phone are within 10% of median official scores achieved on desktop by players of comparable skill.
- **SC-007**: 100% of committed scores reach the leaderboard, including those committed with connectivity fully unavailable for at least 60 seconds afterward.
- **SC-008**: Zero crashes, hangs, or soft-locks across the full randomized input test suite and across all 8 players' complete sessions.
- **SC-009**: The run holds its frame budget on a mid-range phone with no hitch long enough to alter a player's line.
- **SC-010**: The final leaderboard is unambiguous enough that eight friends can read the bed order off it and act on it without argument, including the placement and coin-flip handling of any forfeits.
- **SC-011**: A full run is completable end to end with the reduced-motion option enabled and with audio muted, with no loss of information needed to score.
- **SC-012**: At least 6 of 8 players report the game was fun enough that they would have played it even if it did not decide the beds.
- **SC-013**: Every link holder can see, for every player, how many official runs that player abandoned — so that scouting the official course by restarting is possible but never invisible.
- **SC-014**: No player-facing copy, README text, or documentation claims that standings are verified, validated, or tamper-proof.
- **SC-015**: A player who has never played the game can complete the official course using only base speed and crouch-to-duck, without attempting a single trick, and post a finishing score.
- **SC-016**: Every low obstacle on both courses is followed by a safe release window, verified automatically against the course data rather than by eye.

## Assumptions

- **One draft per deployment.** Multi-trip support is out of scope, so the product manages exactly one roster, one deadline, and one leaderboard. A second trip means a second deployment or a full reset.
- **Skiing only.** Snowboarding appears in the project constitution as a second discipline but is not in this feature. Control verbs are named and specified so that snowboarding can adopt them unchanged rather than introducing a parallel vocabulary later.
- **"Realistic" is bounded by determinism and by crispness.** The physics model is momentum-based and slope-aware, not a rigid-body or soft-body simulation. It runs on a fixed timestep with no unbounded integration, because FR-026 requires an identical score from identical inputs. Where a more realistic treatment would cost response time, FR-084 settles it in favour of response.
- **Speed is rewarded through the controls, not through the scoring table.** A chasing horde was considered as the pacing mechanism and went with the zombies; a time component in the base score was considered and rejected in favour of FR-087's structural gate. Because the jump is a released crouch, and the crouch is what makes you fast, every trick bonus in the game sits behind the speed mechanic. Nothing needed to be added to the scoring table to make speed pay.
- **Low obstacles force every player through the timing mechanic.** Ducking requires crouching, and crouching arms the launch, so a cautious player cannot opt out of FR-088 the way he can opt out of tricks. FR-089 is what keeps that fair: the course must always give him somewhere safe to stand up. This is the requirement most likely to be violated by accident during course design, and the one whose violation would most directly damage FR-035.
- **A base-speed finisher still beats a fast crasher.** FR-034 makes every finish outrank every wipeout, and FR-087 does not change that — it only caps what a cautious run can earn. A player who never crouches, finishes clean, and collects ground pickups will place above a player who was flying, went for a trick, and ate it at the last gate. That is a deliberate consequence of FR-034, not an oversight, and it is the single clause to revisit first if the game plays timid.
- **No enemies in v1.** Zombies and any other autonomous hazard are deferred. FR-086 keeps every course element static and seed-derived, which also keeps the simulation smaller and its determinism cheaper to prove — a pursuing entity would be live state that has to stay replay-identical.
- **The honor system is the security model.** Eight friends with one link. Anyone holding the link can create an entry or claim any unclaimed one, and nothing prevents a player from claiming someone else's. This is accepted; FR-064 captures the separate and more serious question of forged scores.
- **The roster is open, and the organizer is the cleanup.** Self-serve creation means the roster is not a guest list — it is whoever showed up with the link. The controls against that are a hard cap of 16, a visible self-created marker, and an organizer who can remove entries including committed ones. This is the one place where a committed result can be undone, and it exists because an open roster requires it.
- **The organizer link is secrecy, not authentication.** A distinct URL keeps players from casually stumbling into roster and reset controls. Anyone who obtains that URL has full organizer power.
- **Players may skip practice.** Nothing forces the use of all three practice runs; going straight to official simply forfeits the unused ones.
- **Practice teaches the controls, not the course.** Per FR-028, the three practice runs happen on a warm-up slope. The official descent is a first look at the scored terrain. This deliberately favors adaptability over memorization, at the cost of making the official run harder for players who are not used to games.
- **The one-run rule is social, not enforced.** Per FR-019, an abandoned official run costs nothing and can be restarted without limit. The product does not prevent a player from bailing out of a bad run; it counts the bails and shows them to everyone (FR-065). This is the correct mechanism for eight friends and the wrong one for strangers.
- **A wipeout ends the run.** There is no recovery-and-continue after a crash on an official run; the crash is the run's end and its score commits — provided the player lets the crash happen.
- **Finishing beats wiping out, always.** FR-034 is an interpretation of "non-gamers can post a real score," implemented by making the completion bonus larger than the entire achievable bonus pool. It makes survival the dominant strategy and caps how much a skilled player can gain by trick-hunting. If the intent was for a spectacular trick run that ends in a crash to be able to beat a cautious clean run, FR-034 is wrong and should be overturned at clarification.
- **Deadline handling is wall-clock, server-assigned.** Both the deadline comparison and commit timestamps come from shared storage rather than player devices, so a wrong device clock cannot alter ranking or the freeze.
- **Forfeit order is resolved offline.** The product deliberately does not break ties among forfeits; the coin flip happens at the cabin, as specified.
- **Mid-range phone is the reference device.** The frame budget, latency, and parity criteria are stated against a mid-range phone because that is what most of the roster will actually play on. The specific reference hardware remains open as `TODO(TARGET_PLATFORM_BASELINE)` in the constitution and must be fixed during planning.
- **R-rated means profane, not hateful.** The boys-weekend register — beer, joints, jorts, mustaches, pizza, steaks, boomboxes, koozies — is intended and specified. Slurs and content targeting protected characteristics are excluded by FR-059 and are not a matter of taste.
- **No replays, no spectator mode, no accounts, no multi-trip, no enemies.** Explicitly out of scope for v1. The consequence for score verification is accepted as a recorded constitutional deviation below.

## Playtest Findings

Recorded against this spec per Principle III and the playtest cadence
requirement. First human playtest, 2026-09-02.

| #    | Finding                                                                                                                        | Disposition                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PT-1 | The crouch-to-tuck, release-to-jump coupling reads as self-explanatory without instruction.                                    | FR-078 holds as written. A brief tutorial is wanted anyway, deferred to a later feature.                                                                                                       |
| PT-2 | Obstacles are confusing and read as generic blocks — a player cannot tell at a glance what a thing does or how to get past it. | Legibility issue against style-bible rule L-0 and FR-061. Deferred to a later feature; the shapes must distinguish duck-under, jump-over and break-through without relying on colour (FR-055). |

Neither finding blocks the first deployment. PT-2 is the more serious of the
two: FR-088 makes release timing the core skill, and timing a release against
an obstacle you cannot read is guesswork rather than skill.

## Accepted Consequences

Three decisions were taken knowingly at clarification. Two of them compound, and the combination is worth stating plainly before planning starts.

Decision records: [ADR-0002](../../docs/adr/0002-abandoned-official-runs-are-discarded.md) (abandonment), [ADR-0003](../../docs/adr/0003-practice-uses-a-separate-warm-up-course.md) (warm-up course), [ADR-0004](../../docs/adr/0004-accept-client-reported-scores.md) (unverified scores).

**FR-019 (abandonment is free) plus FR-028 (practice is a different course) cancel most of FR-028's purpose.** Individually each is coherent. Together, a player can start his official run, ski the first two hundred metres of the unfamiliar course, close the tab, and start over — as many times as he likes until the deadline. The official run therefore stops being a cold read for anyone willing to do this, while remaining a cold read for the players who take the rules at face value. The cost of the combination falls hardest on the honest and on the non-gamers, which is the opposite of the distribution FR-035 is trying to achieve.

This is accepted rather than engineered away. FR-065 is the chosen response: abandonment is counted and published, so scouting is visible to the whole group and carries a social price instead of a technical one. Planning MUST NOT introduce a technical block on restarts without amending FR-019.

**FR-019 also softens the wipeout rule.** "A face-plant on your official run is your score" holds only for players who let the face-plant land. A player with quick enough reflexes can bail before impact and lose nothing. The abandonment counter is the only thing distinguishing that from a clean restart.

**FR-064 means the standings are unverified.** Any player willing to open developer tools can post any score. See the deviation record below.

## Constitutional Compliance Notes

This spec is governed by `.specify/memory/constitution.md` v1.0.0.

### Recorded deviation: Principle V — Fair and Verifiable Competition

Required by Governance ("all other deviations MUST be documented with rationale, an owner, and a remediation date, and MUST be reviewed at the next milestone").

| Field                   | Value                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Principle**           | V — Fair and Verifiable Competition                                                                                                                                                                                                                                                                                                                                           |
| **Clauses waived**      | "Submitted scores MUST be validated by replay verification before publication" and "Client-reported scores MUST NEVER be trusted as authoritative"                                                                                                                                                                                                                            |
| **Clauses retained**    | Identical course conditions for all competitors; all randomness derived from the shared seed; leaderboards partitioned by rules version; no mechanic confers competitive advantage                                                                                                                                                                                            |
| **Scope**               | This feature only. The waiver does not extend to any later feature or release.                                                                                                                                                                                                                                                                                                |
| **Rationale**           | v1 serves one private draft among eight friends who know each other and will be sharing a cabin. Server-side simulation or replay verification costs more than it defends against an adversary who is a friend and socially accountable. The determinism requirements (FR-024 through FR-027) are retained in full, so verification remains buildable later without redesign. |
| **Owner**               | tucktuck22, repository owner                                                                                                                                                                                                                                                                                                                                                  |
| **Remediation trigger** | Before any release that serves a draft among people who are not all personally known to one another, or before any release where the leaderboard governs a materially contested outcome.                                                                                                                                                                                      |
| **Remediation date**    | 2026-09-01                                                                                                                                                                                                                                                                                                                                                                    |
| **Review**              | At the next project milestone.                                                                                                                                                                                                                                                                                                                                                |
| **Decision record**     | [ADR-0004](../../docs/adr/0004-accept-client-reported-scores.md)                                                                                                                                                                                                                                                                                                              |

**The remediation date is the date this record was written, and that is deliberate.**
The deviation is due the moment it exists because the intent is to change the rule
rather than to satisfy it. [ADR-0005](../../docs/adr/0005-trust-the-players.md)
proposes amending Principle V so that required verification scales with who is
competing, which would make FR-064 ordinary compliance and dissolve this record
entirely. Until that amendment is approved and committed, this deviation stands and
is overdue.

**Consequence for existing documentation.** The README currently describes the project as delivering "leaderboards where the standings can actually be trusted." Under this deviation that claim is not true of v1, and FR-069 requires it be corrected rather than left standing.

### Open constitutional gaps, to be closed during planning

1. **Principle IV — style bible.** The constitution requires a style bible as the single source of truth before assets are reviewed. None exists in this repository. FR-051 makes writing it part of this feature; it must be produced before the first asset lands, not alongside the last.

2. **`TODO(TARGET_PLATFORM_BASELINE)`.** Engine, target platforms, and reference hardware are undetermined in the constitution and must be fixed during `/speckit-plan` and recorded there as a MINOR amendment. This spec states its budgets against "a mid-range phone" precisely because that placeholder is still open.

3. **Definition of Done, item 6.** A mechanic is not done until a human has played it and recorded findings. Nothing in this spec changes that, and no automated process can satisfy it. Playtest findings must be recorded against this spec at feature completion.

4. **Principle III — feel parameters have names but not yet numbers.** The
   constitution requires every mechanic spec to define its feel parameters _and_
   measurable acceptance criteria. FR-083 now names every parameter the gameplay
   model depends on and requires each to carry a value and an acceptance tolerance
   in versioned tuning data, and FR-031 pins input latency at 2 frames. The
   concrete target ranges for the rest — base speed, tuck acceleration, launch
   impulse, rotation rate, landing angle tolerance, attack reach — do not exist
   yet and cannot be invented honestly at a desk. They must be set during
   planning and refined by the human playtest that Definition of Done item 6
   requires. Until they carry numbers, this principle is partially satisfied.

5. **Governance — `CLAUDE.md`.** The constitution requires agent-facing runtime guidance in a project-root `CLAUDE.md`. The file does not exist. Unrelated to this feature's content, but it is an open compliance item against the same document that governs it.
