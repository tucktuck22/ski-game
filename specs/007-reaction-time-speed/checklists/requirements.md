# Specification Quality Checklist: Time to See the Box

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-23
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

**Validation run 1 — 2026-09-23.** Passes on quality and is blocked on two decisions
for the maintainer. Q1: the reaction budget (FR-231). Q2: whether a reset is
acceptable now (FR-239).

The spec names project data (`rulesVersion`, drag, the tuning file) where earlier
specs in this repository do the same. The constraint "change the course, not the
physics" is the user's own requirement and cannot be stated without naming what it
constrains. The spec does not name languages, frameworks or code structure.

The baseline numbers in Context were measured on the shipped `2.0.0` data by
simulation (terminal tucked speed at each box's gradient, 213-unit view ahead,
60 Hz). The claim that "a 20% cut breaks 11 tests" comes from a temporary probe that
was reverted; no data file was changed.

**Validation run 2 — 2026-09-23. All items pass.** The maintainer answered Q1 with
680 ms (option B) and Q2 with "no committed scores" (option A). They also suggested
reshaping the slope instead of changing drag, so the physics does not move. The
approach changed with that: a temporary probe measured how much eased ground brings a
tucked player back under the budget (230–330 units at 0.25–0.30), and the spec now
changes the course shape at the five failing box approaches only, leaving tuning
untouched. Drag is kept as the explicit fallback (FR-241) rather than dropped, because
the big booter 560 units after the 4,640 box may not get its speed back in time.
