# Feature Specification: Three Attempts, Best One Counts

**Feature Branch**: `claude/blissful-volta-462rjk`

**Created**: 2026-09-13

**Status**: Draft — ready for `/speckit-plan`

**Input**: User description: "I think players either need to be able to practice the
real course and have one shot to do it, or have multiple attempts on the actual course
itself. Best of three on the actual course itself feels like the better solution here
and is akin to what a professional skier would experience. In the Olympics or any other
kind of competitive event, rarely in life is it just one run and done."

## Context

**Today a player gets one official run, and abandoning it costs nothing.** Those two
rules were specified together and they do not work together. FR-017 spends the run the
instant it reaches a finish or a wipeout; FR-019 discards a run whose session ends
before either, leaving the official run unused, "no limit on how many times an official
run may be restarted this way before the deadline."

Feature 001 recorded what that combination costs, in its own Accepted Consequences
(`specs/001-shredpocalypse-bed-draft/spec.md:400`):

> **FR-019 (abandonment is free) plus FR-028 (practice is a different course) cancel
> most of FR-028's purpose.** Individually each is coherent. Together, a player can
> start his official run, ski the first two hundred metres of the unfamiliar course,
> close the tab, and start over — as many times as he likes until the deadline. The
> official run therefore stops being a cold read for anyone willing to do this, while
> remaining a cold read for the players who take the rules at face value. **The cost of
> the combination falls hardest on the honest and on the non-gamers**, which is the
> opposite of the distribution FR-035 is trying to achieve.

The chosen mitigation was FR-065 — count abandonments and publish them, so scouting
carried a social price. The organizer withdrew it on 2026-09-08. The cost above has
stood unmitigated and known ever since.

This feature replaces the one-shot rule with **three attempts on the official course,
of which the best single attempt counts**, and makes **starting an attempt spend it**.
The second half is what closes the hole: the dishonest player and the honest player now
get the same three attempts, because there is no longer a free restart for either of
them.

## Why best-of-three and not two-runs-combined

The organizer's reference is competitive skiing, and competitive skiing has two
different answers:

| Format                        | Rule                                      | Fits Shredpocalypse? |
| ----------------------------- | ----------------------------------------- | -------------------- |
| Alpine (downhill, slalom, GS) | Two runs, times **summed**                | No                   |
| Slopestyle, halfpipe, big air | Two or three runs, **best single** counts | Yes                  |

Shredpocalypse scores tricks, pickups and a completion bonus — it is a scoring
discipline, not a race against a clock. Slopestyle is the correct analogue, and
slopestyle takes the best single run and discards the rest. That is the rule adopted
here.

## Why "starting spends it" is safe now, and was not before

ADR-0002 discarded abandoned runs rather than committing them. Its reasoning was
specific, and the operative clause is the last one:

> The first two close the hole completely and punish a dead battery or a dropped
> chairlift connection exactly as hard as they punish a rage-quit — with no appeal,
> **on a run that cannot be retaken**.

That objection was correct when a player had exactly one run. A dead phone meant the
draft was over for him with nothing on the board and no remedy.

Under this feature a dead phone costs **one of three attempts**, not the draft. The
penalty ADR-0002 refused to impose is now proportionate, because the thing it falls on
is no longer irreplaceable. This feature therefore reverses ADR-0002 in part, and that
reversal is only defensible as a package with the two extra attempts — neither half
should ship without the other.

`specs/001-shredpocalypse-bed-draft/spec.md:402` states the procedural bar:

> Planning MUST NOT introduce a technical block on restarts without amending FR-019.

**This feature is that amendment.** FR-019 is superseded by FR-233 below.

## What does not change

Feature 001's warm-up arrangement stands in full. **The three practice runs on the
warm-up slope are unchanged** (FR-028, FR-067, ADR-0003), and the official course
remains unreachable in practice and in free play until the player's official attempts
are done (FR-068). The warm-up slope is the training hill; the three official attempts
are the competition. A full session is therefore up to three practice runs plus three
official attempts.

Scoring (FR-030 to FR-036), the physics, the deadline machinery, claiming, the roster
and the organizer powers are all untouched.

**Numbering**: requirements continue from feature 006 (FR-231+, SC-081+).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Three attempts, best one counts (Priority: P1)

A player who has finished practising takes his first official attempt on the official
course. It ends — at the finish line or face-first — and the score is posted. He still
has two attempts. He takes them, or he does not. Whichever attempt scored highest is
the one that stands on the leaderboard and decides his bed pick.

**Why this priority**: This is the feature. Everything else supports it.

**Independent Test**: Take three attempts with known scores in any order and confirm the
leaderboard ranks the player on the highest of them, and that the other two are never
shown as his score.

**Acceptance Scenarios**:

1. **Given** a claimed player with three attempts remaining, **When** he completes an
   attempt scoring 4,000, **Then** 4,000 is on the leaderboard and two attempts remain.
2. **Given** that player, **When** his second attempt scores 2,500, **Then** the
   leaderboard still shows 4,000 and one attempt remains.
3. **Given** that player, **When** his third attempt scores 6,100, **Then** the
   leaderboard shows 6,100 and no attempts remain.
4. **Given** a player who wipes out on his first attempt for 300, **When** he takes his
   remaining two attempts, **Then** the wipeout does not end his draft and his best of
   the three stands.
5. **Given** a player with no attempts remaining, **When** he opens the game, **Then**
   the official run control is unavailable and his best score is stated plainly.

---

### User Story 2 - Starting an attempt spends it (Priority: P1)

A player starts his second official attempt, sees a bad line into the first kicker, and
closes the tab. That attempt is gone. He has one left.

**Why this priority**: Without this, best-of-three is strictly more permissive than
today's rule and the unfairness at spec.md:400 survives untouched. It ships with
User Story 1 or the feature does not deliver what it claims.

**Independent Test**: Start an attempt, kill the session before any end state, reopen on
any device, and confirm the attempt count has decreased and no score was posted.

**Acceptance Scenarios**:

1. **Given** a player with three attempts, **When** he starts an attempt and closes the
   tab mid-descent, **Then** no score is posted and he has two attempts remaining.
2. **Given** the same player on a different device, **When** he opens the leaderboard,
   **Then** it agrees that two attempts remain.
3. **Given** a player who has abandoned all three attempts, **When** the deadline
   passes, **Then** he is FORFEIT, exactly as a player who never played.
4. **Given** a player about to start an attempt, **When** shared storage cannot record
   the attempt as spent, **Then** the attempt MUST NOT begin and he is told why.

---

### User Story 3 - The board reads honestly while attempts are in flight (Priority: P2)

Everyone holding the link can see who is mid-competition and who is done, without being
able to mistake a partial result for a final one.

**Why this priority**: The leaderboard is checked daily by eight people and already
carries live run state (PRACTISING (n/3), READY — NOT YET OFFICIAL). Attempts in flight
need the same treatment or the board starts lying by omission.

**Independent Test**: With players at 0, 1, 2 and 3 attempts used, confirm each row
states attempts used and that a player with attempts remaining is visibly not final.

**Acceptance Scenarios**:

1. **Given** a player with one attempt used and two remaining, **When** anyone views the
   leaderboard, **Then** his best-so-far score is shown alongside his attempts used, and
   he is not presented as finished.
2. **Given** a player with three attempts used, **When** anyone views the leaderboard,
   **Then** his score is presented as final.
3. **Given** the deadline has passed, **When** anyone views the leaderboard, **Then**
   unused attempts are irrelevant and every player is presented as final.

---

### Edge Cases

- **A player's phone dies on his third attempt.** He keeps the best of attempts one and
  two. If all three died, he is FORFEIT, and his remedy is the organizer, not the
  product (FR-006 powers already exist). This is a deliberate and known cost of
  User Story 2 — see Accepted Consequences.
- **An attempt's score is still queued in the outbox when the next attempt starts.** The
  attempt count must already have moved, because it moves at start, not at commit. A
  queued or refused commit must never return a spent attempt.
- **A player clears storage, switches devices or opens a private window mid-competition.**
  Attempts used comes from shared storage (FR-021), so he gets no fourth attempt.
- **Two players tie on their best attempt.** Broken by the commit time of the **best**
  attempt, not the last (FR-236). If that still ties, it is displayed as unresolved for a
  coin flip (FR-038, unchanged).
- **An attempt is in progress when the deadline passes.** It may finish and commit inside
  the existing grace (FR-044). No new attempt may be started after the deadline.
- **A player scores the same on two of his own attempts.** Irrelevant to ranking; the
  earlier of the two supplies the timestamp, which is the natural reading of FR-236.
- **A player abandons an attempt with a large score already accumulated.** Nothing is
  banked. An abandoned attempt scores nothing at all — it is spent and blank.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-231**: Each roster member MUST be granted exactly three official attempts on the
  official course, replacing the single official run of FR-017/FR-018.
- **FR-232**: A player's leaderboard score MUST be the highest score among his completed
  official attempts. Lower attempts MUST NOT be displayed as his score and MUST NOT
  affect his rank.
- **FR-233**: Starting an official attempt MUST consume it. An attempt whose session ends
  before the run reaches a finish or a wipeout MUST be spent, MUST post no score, and
  MUST NOT be restartable. **This supersedes FR-019**, which permitted unlimited free
  restarts, and it is the amendment that
  `specs/001-shredpocalypse-bed-draft/spec.md:402` requires before any technical block on
  restarts may be introduced.
- **FR-234**: An official attempt MUST be recorded as spent in shared storage **before**
  gameplay begins. If that record cannot be written, the attempt MUST NOT start and the
  player MUST be told that it did not start and why.
- **FR-235**: The count of attempts used MUST be held in shared storage and MUST be the
  only authority on how many remain. Switching devices, clearing browser data, or using a
  private window MUST NOT grant a fourth attempt (extends FR-021).
- **FR-236**: Ties on best score MUST break by the commit timestamp **of the attempt that
  produced that best score**, not of the player's most recent attempt. Timestamps remain
  server-assigned (FR-037). Ties surviving this remain unresolved and flagged for a coin
  flip (FR-038).
- **FR-237**: A committed attempt's score MUST remain immutable. A later attempt MUST NOT
  overwrite, amend or delete an earlier attempt's record; the leaderboard score MUST be
  derived from the set of attempts rather than stored as a mutable field.
- **FR-238**: An attempt that ends in a wipeout MUST commit its score immediately and
  irreversibly, and MUST NOT end the player's competition while attempts remain. FR-017's
  irreversibility attaches to **the attempt**, not to the player's standing.
- **FR-239**: The leaderboard MUST show, for every roster member, how many official
  attempts he has used, and MUST distinguish a player with attempts remaining from a
  player who is finished.
- **FR-240**: A player MAY stop at any point and keep his best score. Unused attempts
  expire at the deadline and are forfeited without ceremony, as unused practice already is
  under FR-015. No declaration of "done" is required or offered.
- **FR-241**: After the deadline, no new official attempt may be started (FR-043). An
  attempt already in progress MAY finish and commit within the existing grace window
  (FR-044).
- **FR-242**: A roster member with no completed official attempt at the deadline MUST be
  FORFEIT under FR-045, whether he never played or abandoned all three attempts. The two
  MUST NOT be distinguished on the board.
- **FR-243**: This change to the run economy MUST carry a new rules version, because it
  changes what a score means, and FR-023 freezes the rules from the first official
  commit. Scores earned under one-shot rules and scores earned under best-of-three MUST
  NOT be comparable on the same board.
- **FR-244**: The three practice runs on the warm-up slope MUST be unchanged (FR-028,
  FR-066, FR-067), and the official course MUST remain unreachable in practice and free
  play until the player's official attempts are exhausted or the deadline has passed
  (FR-068, restated at attempt granularity).

### Key Entities

- **Official attempt**: One of three chances at the official course for a roster member.
  Comes into existence when the player starts it, which is also when it is spent. Ends
  either with a committed score (finish or wipeout) or with nothing (abandonment).
  Immutable once ended.
- **Roster member**: Gains a count of official attempts used, replacing today's binary
  used/unused official status. Retains practice runs used, unchanged.
- **Leaderboard entry**: Presents a member's best attempt score, his attempts used, and
  whether he is finished. Derived, never stored as an authoritative mutable score.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-081**: A player who wipes out on his first attempt can still finish first in the
  draft. Demonstrated end to end, not argued.
- **SC-082**: Across three attempts with distinct scores taken in any order, the
  leaderboard shows the highest and only the highest, in 100% of orderings tested.
- **SC-083**: Abandoning an attempt reduces attempts remaining by exactly one and posts no
  score, verified after a hard session kill (not a graceful close) and confirmed from a
  second device.
- **SC-084**: No sequence of device switches, storage clears or private windows yields a
  fourth attempt. The existing US2 property survives unchanged.
- **SC-085**: A player mid-competition is never presented as final, and a player with
  three attempts used always is — verified at every attempt count from 0 to 3.
- **SC-086**: Two players whose best attempts tie are ordered by the timestamp of those
  best attempts, and a player is never disadvantaged in a tiebreak for having taken
  attempts he was entitled to.
- **SC-087**: A player can determine how many attempts he has left, and what his best
  score is, within five seconds of opening the game, without scrolling.

## Assumptions

- **Best single attempt counts; attempts are not summed or averaged.** Settled by the
  slopestyle analogy above.
- **An abandoned attempt scores nothing rather than banking progress.** Banking a partial
  score would require trusting a client that just disappeared, and would reward
  abandoning at a local maximum. DNF semantics are simpler and match the competitive
  reference.
- **Attempts remaining is public.** The leaderboard already publishes PRACTISING (n/3) and
  READY — NOT YET OFFICIAL, so this is consistent rather than novel. It also costs nothing
  competitively: under best-of-N with FR-236's tiebreak, holding attempts back carries no
  strategic advantage to conceal.
- **No "I'm done" declaration is needed.** Because the best attempt is kept and the
  tiebreak follows the best attempt, taking another attempt can never lower a player's
  standing. There is nothing to protect him from, so the product does not add a ceremony
  to protect him from it.
- **Three, not two.** The organizer said best of three. Three also gives a player who
  loses one attempt to a dead battery a genuine second chance rather than a last one.
- **The draft is not live and no scores are committed** (organizer, 2026-09-13). No draft
  reset is required and no player is mid-competition under the old rules.
- **The existing start-marking mechanism is sufficient.** `roster_entry.official_run_started_at`
  already records that an official run began, specifically so abandonment is detectable
  when an unload handler cannot fire. FR-234 needs exactly that primitive; it is already
  built and does not need inventing.

## Accepted Consequences

- **A dead battery now costs an attempt.** This is the cost ADR-0002 declined to impose,
  accepted here only because the thing it falls on is one of three rather than the whole
  draft. A player who loses all three attempts to genuine misfortune has no in-product
  remedy and must go to the organizer. This is judged acceptable for eight friends with a
  group chat, and would not be for strangers.
- **Sessions get longer.** Up to three practice runs on the 3,200-unit warm-up slope plus
  three attempts on the 12,000-unit official course. The official course is the long one,
  so total play time roughly triples for a player who uses everything.
- **Scores are still unverified** (FR-064, ADR-0004). Three attempts multiply the number
  of client-reported scores but change nothing about the trust model. A player who would
  forge one score can forge three.
- **The cold read is diluted by design.** Attempt one is still a genuine first look at an
  unseen course, but attempts two and three are informed by it. That is the point of the
  change and the direct cost of FR-068's surprise, accepted deliberately: the organizer
  judged that a fair three beats an unfair one.

## Dependencies

- Supersedes FR-019 and amends FR-017, FR-018 and FR-021 of feature 001.
- Requires a new ADR recording the partial reversal of ADR-0002 and the reasoning above.
  Note that `docs/adr/` currently contains **two** files numbered 0010
  (`0010-a-ninth-colour.md` and `0010-organizer-actions-as-secret-gated-functions.md`);
  the new record should be 0011 and the collision wants fixing separately.
- Requires a schema change and a migration the organizer runs against the live project,
  following the pattern already documented for `0003_organizer.sql` and
  `0004_rules_freeze.sql`.
- Requires a `rulesVersion` bump (FR-243).
