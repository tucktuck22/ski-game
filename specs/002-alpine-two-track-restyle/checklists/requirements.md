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

- **Whether the upper track should carry a cost as well as a reward.** Recorded
  in Assumptions rather than as a [NEEDS CLARIFICATION] marker, because a
  defensible default exists and is specified. The doubled accrual rate of FR-094
  widens the gap this item is about: the high line is now better per unit of
  ground as well as carrying the valuable pickups, and is still the safer of the
  two. Resolving it would amend FR-094 and add an acceptance scenario to User
  Story 1; it would not restructure the spec.
- **Whether releasing the crouch at the lip is required or merely sufficient.**
  Acceptance scenario 2 names it as the technique; FR-091 still admits a player
  who only holds a tuck. Making the timed release mandatory would tighten the
  skill gate and is a plausible reading of the request, so it is recorded in
  Assumptions rather than silently decided in either direction.

### Requirements not yet implemented

The Content Quality and Requirement Completeness sections above assess the
document. They do not assess whether the code matches it, and for FR-094,
FR-111, FR-112 and FR-113 it does not. The spec's Context section carries the
table. Under Principle I a spec that disagrees with shipped behavior is a
defect, so this checklist is not evidence that the feature is done — only that
the specification is fit to plan against.

### Process deviation

This specification was written **after** its implementation, inverting the order
Principle I (NON-NEGOTIABLE) requires. The checklist above assesses the document
on its own merits and it passes; it cannot assess whether writing the spec first
would have produced different requirements. Recorded here rather than in the
spec's notes so that a reviewer sees it while judging the spec's quality, not
only while reading its content.
