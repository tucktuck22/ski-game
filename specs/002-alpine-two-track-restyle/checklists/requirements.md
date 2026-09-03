# Specification Quality Checklist: Two Tracks Down a 1986 Mountain

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-02
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

### Validation record

One validation pass was run over the drafted spec. Three items failed and were
fixed; the rest passed as drafted.

1. **The spec contradicted itself on scope.** SC-024 was written as "a player
   watching a replay of his own run can say which track he was on" — but the
   Assumptions section of this same spec carries feature 001's out-of-scope list
   forward, and that list excludes replays. The criterion was unverifiable by
   construction. Restated against a single frame, which needs nothing that does
   not exist.
2. **SC-023 described the build, not an outcome.** "Rejected automatically
   before the build completes" is a fact about a pipeline. Restated as the thing
   the player is actually protected from: such a course never reaches him.
3. **SC-025 cited an internal budget without saying what it buys.** Restated to
   name the player-facing consequence — reaction time — so the criterion can be
   argued about by someone who has not read the constitution.

### Second validation pass — after the crouch-release, landing-effect and doubled-accrual amendments

Three requirements were added or changed on request. Validating them against the
spec as it already stood surfaced two contradictions, both fixed:

1. **FR-108 forbade the landing effect outright.** As originally written it said
   presentation "MUST NOT be derived from anything about the run beyond the
   camera position and elapsed run time" — and a flash triggered by landing on
   the upper track is derived from run state by definition. The new requirement
   would have been unsatisfiable without violating an existing one. FR-108 is
   now scoped to scenery, with feedback carved out explicitly and the reasoning
   for the line recorded: scenery must never become a second channel of gameplay
   information, whereas feedback confirms something the player just did and can
   already see.
2. **The doubled accrual rate reopened a hole feature 001 had deliberately
   closed.** Feature 001 computes progress from the furthest point reached, so
   that skiing back and forth cannot farm points. A naive rate multiplier
   applied per unit travelled would have undone that silently, in a feature that
   never mentions farming. FR-094 now constrains the doubled rate to newly
   covered ground, and SC-027 tests it.

Also checked and found consistent, not changed: the flash and shake fall under
feature 001's FR-056 (reduced motion) and FR-057 (flash ceiling, which exists
for photosensitivity), both of which this spec now cites explicitly in FR-113
rather than leaving to inference.

### Open items, deliberately not blocking

- ~~**Whether the upper track should carry a cost as well as a reward.**~~
  **Closed** by FR-116 to FR-123. The shelf now carries ice that costs the line
  and rocks that cost the run, so the doubled accrual rate is a risk premium
  rather than a bonus for taking the better road. Whether the two lines are
  _balanced_ is a separate, open, playtest question — not a specification one.
- **Whether releasing the crouch at the lip is required or merely sufficient.**
  Acceptance scenario 2 names it as the technique; FR-091 still admits a player
  who only holds a tuck. Making the timed release mandatory would tighten the
  skill gate and is a plausible reading of the request, so it is recorded in
  Assumptions rather than silently decided in either direction.

### Third validation pass — after the withdrawal and rebalancing amendments

FR-114 (attack withdrawn) and FR-115 (rotation rate) were added, and FR-094 and
FR-111 to FR-113 were implemented, closing the gap the previous pass recorded.
Two findings:

1. **FR-114 contradicts a ratified requirement of another feature, and saying so
   is the whole point of the entry.** Feature 001's FR-081 requires the attack
   verb and its barriers; this feature removes both. The requirement is written
   as a suspension rather than a deletion, names FR-081 explicitly, and records
   what has to come back with the verb (CV-6, the barrier entity, two tuning
   keys). Feature 001's controls, course-data and tuning contracts are amended
   in the same change set rather than left describing a verb the game no longer
   has, as Principle I requires.
2. **FR-115 is not a new requirement and should not have read like one.** It is
   AC-3 of feature 001's tuning contract, which had never been tested and had
   been false since 1.0.0 — at the old rotation rate no launch bought a complete
   turn, so the trick bonus was unreachable by any player. The entry says so,
   and the criterion now has a test rather than only a raised number.

### Fourth validation pass — after the upper-track hazards

FR-116 to FR-123 add crumbling ice and rocks to the shelf. Three findings, two
of them caught by the validator and the tests rather than by reading:

1. **The generator produced an unfair course and CV-19 rejected it.** The first
   placement dropped a player through the ice directly onto a deadfall log on
   the piste below. Falling through is involuntary — no input the player gave
   chose it — so an obstacle in the fall zone turns an unavoidable transition
   into a death. The rule fired on the shipped course before anyone played it,
   which is exactly what the validator is for.
2. **The first version of the ice fired on nobody, and looked completely
   correct.** A 48-unit stretch against a 20-tick countdown meant a player
   crossed it a tick or two before it gave way. CV-18 gained a second half —
   ice may not be short enough to ride across — so this class of failure is now
   caught in data rather than found by playing. It is the mirror of CV-13, and
   for the same reason: a hazard nobody can trigger is as broken as one nobody
   can survive.
3. **The ice was invisible from more than a few metres.** A translucent tint on
   six pixels of shelf, seen edge-on, read as white. The whole design of the
   countdown is that the player decides to hop the ice BEFORE reaching it, so an
   unreadable hazard makes the decision impossible. Style bible TR-8 now
   requires the ice to be a different material, with marker posts standing off
   the shelf to carry at distance.

The open item this checklist carried from its first pass — whether the upper
track should cost anything — is **closed** by these requirements, and the
Assumptions entry has been rewritten from a question into a record of how it was
answered. What is deliberately not claimed is that the two lines are now
balanced; SC-032 asserts only that the high line can be played badly enough to
lose, and leaves the tuning to playtest evidence.

### Implementation status

All requirements in the spec are built, and the spec's Context section says so.
That closes the Principle I defect this checklist recorded in its previous pass;
it does not undo the process deviation noted below, which is about the order the
work happened in, not about whether the two artifacts now agree.

### Process deviation

This specification was written **after** its implementation, inverting the order
Principle I (NON-NEGOTIABLE) requires. The checklist above assesses the document
on its own merits and it passes; it cannot assess whether writing the spec first
would have produced different requirements. Recorded here rather than in the
spec's notes so that a reviewer sees it while judging the spec's quality, not
only while reading its content.
