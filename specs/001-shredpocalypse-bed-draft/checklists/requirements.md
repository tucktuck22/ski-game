# Specification Quality Checklist: Shredpocalypse '86 — Bed-Pick Draft

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-01
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

## Validation Findings

### Iteration 1 — issues found and fixed

- **Implementation leak (fixed)**: initial drafting of the persistence requirements named browser storage mechanisms directly. Rewritten as FR-021 ("shared storage readable by all link holders") and FR-048 ("survive page reload and browser restart") — observable behavior, no mechanism named.
- **Untestable success criterion (fixed)**: "the game feels good on a phone" replaced with SC-006 (median phone scores within 10% of desktop for comparable skill) and SC-009 (frame budget held with no hitch long enough to alter a line).
- **Unbounded scope (fixed)**: roster size was unstated; FR-002 bounds it at 2–16 with 8 expected.
- **Missing tiebreak terminal case (fixed)**: FR-037 breaks ties by commit timestamp, but ties surviving that had no defined behavior. FR-038 added.
- **Device clock trust (fixed)**: commit timestamps were unattributed; FR-037 now assigns them from shared storage, and the wrong-clock case is listed under Edge Cases.

### Iteration 2 — clarifications resolved

All three markers were answered and encoded into the spec. Zero markers remain.

| Marker                            | Resolution                                                                                      | Requirements changed                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Abandoned official run (FR-019)   | Abandoned runs are discarded; the official run stays unused and may be restarted without limit  | FR-019 rewritten; FR-065 (public abandonment counter) and FR-066 (practice symmetry) added                                            |
| Practice course identity (FR-028) | Practice uses a distinct warm-up course; the official run is a first look at the scored terrain | FR-028 rewritten; FR-067 (warm-up identical and identically seeded for all) and FR-068 (official course unreachable pre-commit) added |
| Score verification (FR-064)       | Documented deviation from constitution Principle V on honor-system grounds                      | FR-064 rewritten; FR-069 (no "verified standings" claims anywhere) added                                                              |

### Iteration 3 — consequence review

Re-reading the resolved spec surfaced two interactions that the individual answers did not create:

- **FR-019 and FR-028 compound.** Free abandonment lets a player scout the unfamiliar official course by restarting until he knows it, which removes the cold read that FR-028 exists to create — but only for players who choose to do it. Recorded in the spec's **Accepted Consequences** section rather than engineered away, per the chosen honor-system model, with FR-065 as the visibility-based response.
- **FR-019 weakens FR-017's wipeout clause.** "A face-plant is your score" binds only players who let the crash land. Also recorded under **Accepted Consequences**.

Neither is a spec defect — both follow from decisions taken knowingly — but both are stated explicitly so that planning does not rediscover them as surprises or silently design around them.

### Iteration 4 — deviation record closed

The Principle V deviation record now carries a remediation date of 2026-09-01, completing the rationale / owner / date set that Governance requires. The record is therefore formally complete and immediately overdue, which is the intended state: [ADR-0005](../../../docs/adr/0005-trust-the-players.md) proposes amending Principle V so that FR-064 becomes ordinary compliance and the deviation dissolves. Nothing here blocks `/speckit-plan`.

All decisions taken during clarification are recorded as ADRs in `docs/adr/`.

### Iteration 5 — re-validated after clarification session 2026-09-01

Five clarifications were asked and integrated. Checklist re-evaluated against the
updated spec: **16/16 → 16/16 items passing**, no newly passing items, no
regressions, none remaining unchecked.

The spec grew from 69 to 89 functional requirements and from 14 to 16 success
criteria. The additions are gameplay-model requirements (FR-076 to FR-089) and
open-roster requirements (FR-070 to FR-075). Item 1 ("no implementation details")
was re-checked with particular care because the new requirements describe physics
and controls in detail: they specify player-observable behaviour — what the skier
does, what the player presses, what ends a run — and name no engine, framework,
language, or API. It still passes.

One residual is tracked in the spec rather than here, because it is a
constitutional matter and not a spec-quality defect: Principle III's feel
parameters are now all named with required tolerances (FR-083) but do not yet
carry target numbers. Recorded as gap 4 under the spec's Constitutional
Compliance Notes.

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- Beyond the three markers, the spec's **Constitutional Compliance Notes** section records two further constitutional gaps that are not spec defects but must be resolved during planning: no style bible exists yet (Principle IV, folded into FR-051), and Definition of Done item 6 requires human playtesting that no automated process can satisfy.
