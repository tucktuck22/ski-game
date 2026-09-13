# Specification Quality Checklist: Three Attempts, Best One Counts

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-13
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

Validation run 2026-09-13, single iteration. Recorded honestly per Principle VI: this is
what the pass actually found, not a tidied-up account of it.

**One item failed and was fixed.** FR-243 read "MUST bump `rulesVersion`", naming a
code-level identifier inside a requirement. Feature 001's FR-023 — the requirement this
one extends — says "a rules version" in prose and never names the variable. FR-243 now
matches that register and adds the player-facing consequence (scores under the two rule
sets are not comparable on one board). No other requirement referenced a column, table,
migration or product name; checked by grep over the Functional Requirements section.

**Two items were decided rather than marked [NEEDS CLARIFICATION].** Both are recorded in
Assumptions with their reasoning, because both have a defensible default and neither
changes scope:

- **Tiebreak follows the best attempt's timestamp, not the most recent** (FR-236). The
  alternative is perverse: a player sets a winning mark on attempt one, takes attempt two
  out of curiosity, and loses a tiebreak he had already won. Deciding it was cheaper than
  asking.
- **No "I'm done" declaration** (FR-240). This falls out of the tiebreak choice. Once
  taking another attempt can never lower a player's standing, there is nothing to protect
  him from, so no ceremony is worth building.

**One question is deliberately left open and does not block planning.** The organizer has
not been asked whether a player who loses all three attempts to genuine misfortune — a
dead battery three times over — should have an in-product remedy. The spec routes him to
the organizer's existing FR-006 powers and records the gap as an accepted consequence
rather than pretending it does not exist. If it happens in play, it is a follow-up
feature.

**Not verified by this checklist**: nothing here has been playtested, and Principle VIII
wants a play pass at the earliest playable point rather than at completion. Session length
roughly triples under this feature (Accepted Consequences), and that is a feel question no
document closes.
