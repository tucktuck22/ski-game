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
for the maintainer. Q1: the reaction budget (FR-246). Q2: whether a reset is
acceptable now (FR-254).

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
untouched. Drag is kept as the explicit fallback (FR-256) rather than dropped, because
the big booter 560 units after the 4,640 box may not get its speed back in time.

**Validation run 3 — 2026-09-23 (`/speckit-clarify`). All items pass.** Re-measuring
with a simulated tucked ride and the real camera showed the frame's bottom edge hides
steep boxes, so the worst box leaves 398 ms, not 524 ms. The Context table is
corrected in place. The maintainer chose to fix the vertical framing as well as ease
the approaches (option A), which adds FR-257 to FR-259 and SC-093. The earlier "20%"
figure used speed along the slope rather than horizontal speed. The real reduction
needed at the box is about 8%, and the Clarifications entry now says so rather than
leaving the superseded number standing.

**Validation run 4 — 2026-09-23 (`/speckit-clarify`, second pass). All items pass; no
question asked.** Three consistency fixes, made without asking the maintainer. The
"standing players are unaffected" edge case predated the corrected measurement and
was wrong: a standing player at the steepest box also gets about 650 ms, because the
frame hides the box. It now says so and points at FR-257. FR-251's "needs a
decision" now reads "enters view", which can be measured. SC-093 is moved to the end
so the success criteria are in numeric order.

**Validation run 5 — 2026-09-24 (`/speckit-plan`). All items pass after amendment.**
Planning research measured a full ride instead of a clean approach per box and found
the spec wrong on four facts:

1. The worst box is 365 ms, not 398 ms.
2. The box at 1,830 fails.
3. The needed speed cut is 5–19%, not "about 8%".
4. The ramp at 5,200 is the Cornice shelf ramp, not the big booter.

FR-248 was widened to allow terrain changes that give back downstream speed, each one
named, and FR-258's shelf clause was sharpened to a measurable margin. The one box move
(11,600 → 11,680) is recorded as FR-256's first fallback, taken. Every amendment is
marked in place with its date and its research reference, rather than silently
rewritten.

**Validation run 6 — 2026-09-24 (`/speckit-analyze` remediation). All items pass.**
Analysis found one constitution conflict and one feasibility gap. Both are resolved by
amendment, not by argument:

- **D1, Principle III**: the camera constants move from code to `data/camera.json`.
- **C1**: the warm-up box at 5,200 measured 648 ms on a real ride, and FR-248 as
  written froze the warm-up course. The freeze is lifted for that one approach. A
  measured easing gives 698 ms with both warm-up kickers within 0.3% (research R9).

Medium findings F1–F3, G1 and E1 are applied across the spec, plan, contracts and
tasks. The full test suite passes with both candidate courses installed (559/562). The
three failures are the LFS sprite tests and the frozen-file guard, which the tasks
retarget.
