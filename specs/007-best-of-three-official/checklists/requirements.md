# Specification Quality Checklist: Three Attempts, Best One Counts

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-13 · **Re-validated**: 2026-09-14 (trust reversal), 2026-09-23 (`/speckit-analyze`)
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

### Re-validation 2026-09-23 (after `/speckit-analyze`)

The 2026-09-14 trust reversal changed FR-234, FR-235, the Context, Assumptions and
Accepted Consequences, and **this checklist was not re-run against any of it** — it sat
fully checked against a spec that no longer existed. `/speckit-analyze` caught that as a
Principle VI problem: the difference between what was verified and what ships must be
stated, not implied. It has now been re-run against the current spec.

**One box came unchecked, and was resolved on 2026-09-23 rather than waived.**

- **Success criteria are measurable** — **SC-087 failed, now fixed.** It read: _"A player can determine how
  many attempts he has left, and what his best score is, within five seconds of opening
  the game, without scrolling."_ No device, viewport or measurement method is named, so
  two people could disagree about whether it passed and both be right. The organizer chose
  to quantify it rather than demote it. It now names **375 × 667 CSS pixels** — the iPhone
  SE 3rd-gen class from the constitution's reference hardware, and the narrowest of the
  three listed, so passing there passes on all of them — and delegates the timing half to
  the existing time-to-interactive budget instead of restating it.

  **Noted while fixing it**: no suite in this repository tests a mobile viewport. Every
  Playwright project runs `devices['Desktop Chrome']`, on a product whose platform baseline
  is the evergreen mobile web. T020 now asserts at 375 × 667, which makes this feature the
  first thing checked at phone width — a gap worth its own change rather than this one.

**Two boxes were at risk and now pass on their merits:**

- _No implementation details_ — FR-245 as first drafted said "any database constraint on
  attempt numbering MUST be a loose sanity rail". That named the storage engine inside a
  requirement. Reworded to "Shared storage MUST NOT impose a narrower limit than that
  value", matching FR-021's register. The mechanism lives in research R10 and the storage
  contract, which is where it belongs.
- _Requirements are testable and unambiguous_ — FR-234 was rewritten on 2026-09-14 from
  "the attempt MUST NOT start" to a best-effort write that gates nothing. The new wording
  is testable (quickstart Scenario 5 asserts a run starts while offline) where a
  half-reversed version would not have been.

### Coverage gaps closed 2026-09-23

`/speckit-analyze` found four requirements with zero tasks. Three are now cited; the
fourth got a task of its own:

| Requirement                                      | Was     | Now                                                              |
| ------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| FR-238 (a wipeout does not end the competition)  | no task | T013                                                             |
| SC-081 (wipe out on attempt 1, still win)        | no task | **T061**, an end-to-end demonstration against the built artifact |
| SC-086 (never ranked lower for using an attempt) | no task | T011                                                             |
| SC-087 (attempts and best score legible fast)    | no task | T020 — intent covered, criterion still unmeasurable, see above   |

SC-081 mattered most: it is the one criterion that proves the feature does what it claims,
and nothing pointed at it.

### Earlier sessions

**2026-09-14 (trust reversal)** — the organizer ruled the attempt count honour-system.
FR-234 and FR-235 were rewritten, the Context's "closes the hole" claim was corrected to
what trust actually buys, and research R2 was reversed. Not re-validated at the time; see
above.

**2026-09-13 (original)** — single iteration. One item failed and was fixed: FR-243 read
"MUST bump `rulesVersion`", naming a code identifier inside a requirement, where FR-023 —
the requirement it extends — says "a rules version" in prose. Two items were decided
rather than marked [NEEDS CLARIFICATION]: the tiebreak follows the best attempt's
timestamp (FR-236), and no "I'm done" declaration is needed (FR-240), the second falling
out of the first.

### Still not verified by anything here

Nothing in this feature has been playtested. Session length roughly triples, and
Principle VIII wants that judged by a person at the first playable point — Phase 5, T030.
The attempt count and the crashed-tab cost were settled by the organizer in advance rather
than by play, and the spec records them as acceptance rather than as findings.
