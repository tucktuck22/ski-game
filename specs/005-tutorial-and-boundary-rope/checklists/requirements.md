# Specification Quality Checklist: A Coached First Run, and a Rope You Can See

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-09
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

**Validation run 1 — 2026-09-09.** One item failed: three open questions were
carried in the Clarifications section, because each changed what gets built rather
than how, and defaulting them would have meant guessing at copy the maintainer
supplied verbatim.

**Validation run 2 — 2026-09-09. All items pass.** The three questions were answered
and encoded:

| Question                            | Answer                                | Encoded as                       |
| ----------------------------------- | ------------------------------------- | -------------------------------- |
| Coached section on which runs?      | Every practice run, always            | FR-186a, US3, SC-073             |
| Flip badge wording across devices?  | One string, both verbs, arrow glyphs  | FR-190, FR-190a, FR-190b, SC-072 |
| Wipeout inside the coached section? | Normal rules — a wipeout is a wipeout | FR-192a, SC-071                  |

User Story 3 was rewritten rather than deleted. Its original premise — that a
returning player is not held in a section he no longer needs — is not what the
answer to Q1 delivers, and leaving it would have shipped a user story the feature
contradicts. It now asserts the sameness the answer bought, which is a real property
worth testing.

Two things are recorded rather than resolved, and both need a decision outside this
spec:

1. **Open constitutional deviation** (accessibility / controls remapping, FR-206).
   The constitution states "Controls MUST be fully remappable" and this feature
   strikes the requirement implementing it. Governance permits a documented
   deviation; the honest resolution is a one-paragraph amendment. Owner and required
   action are in the spec's Constitutional Compliance Notes. Not a spec-quality
   defect — a real conflict, stated rather than absorbed.
2. **Accepted risk on the practice allowance** (FR-192a). A player can spend all
   three practice runs inside the teaching section. Raised before the decision,
   accepted by the maintainer, and recorded in Assumptions with the geometry that
   mitigates it and the success criterion (SC-071) that measures whether it worked.

One deliberate exception to "no implementation details" survives review: FR-196,
FR-204 and the `rulesVersion` assumption name the mechanism by which a mid-draft
change stays safe. That mechanism is why the requirement is achievable at all, and
stating it as a black-box outcome would have hidden the constraint from planning.

Ready for `/speckit-plan`.
