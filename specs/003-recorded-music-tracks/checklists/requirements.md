# Specification Quality Checklist: Two Recorded Tracks, Looping Forever

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-03
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

## Validation Notes

### Iteration 1 — 2026-09-03

Three `[NEEDS CLARIFICATION]` markers, on FR-135, FR-146 and FR-147. Each was left
open rather than defaulted because the plausible-looking default would have committed
the project to a position its own governing documents forbid: style-bible A-1 bans
sampled audio "of any kind"; the supplied masters are 7.09 MiB against a 2 MB gzipped
ceiling; and "landing music" and "the loading screen" name different screens in the
shipped app.

### Iteration 2 — 2026-09-03 (all items pass)

All three answered and folded into the spec:

| Was    | Question                             | Answer                                                                                                      |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| FR-147 | Provenance and the A-1/A-2 amendment | Original works the project owns. Amend A-1/A-2 to permit original recorded music; ADR records the reversal. |
| FR-146 | The payload budget                   | Re-encode to mono ~96 kbps **and** fetch on demand. Budget not amended. New FR-150 and SC-049 pin the size. |
| FR-135 | What "the loading screen" means      | Everything that is not a run — boot shell, board, confirmation, results — as one continuous piece.          |

Requirements renumbered into sequence after FR-150 was added; FR-135 through FR-150
now read in order.

**Content Quality — a note on the third item.** The Governance impact section names
specific rule identifiers (A-1, A-2, FR-053, O-1) and cites the payload budget in
megabytes. That is not implementation detail leaking in: those are the project's own
governing constraints and the reason this feature is not a straightforward change. A
non-technical stakeholder needs exactly that section to understand what approving the
spec approves. The requirements themselves remain free of technology choices — no
audio APIs, no loading mechanisms, no file layouts are prescribed. FR-150 names an
encoding target (mono, ~96 kbps) because it is the substance of a product decision
about fidelity, not a technique for achieving one.

**Terminology hazard, now handled in the spec.** "Track" is overloaded in this
repository: feature 002 uses it for the upper and lower ski lines down the mountain.
The Context section says so explicitly and the document says "music track" or names
the piece throughout. Planning should keep that discipline.

**Two hard dependencies to carry into planning.** Neither is optional and neither is
code: the style-bible amendment plus its ADR (FR-147), and the provenance record
(FR-148). A merge without them fails FR-052 review regardless of how well the feature
works. A third is logistical — the master files must reach the repository or an
archive before the container holding them is reclaimed, since the shipped assets are
derived from them.

### Iteration 3 — 2026-09-04 (post-plan amendments, all items still pass)

Two decisions taken after planning, both folded back through spec, plan, research,
data model, contract and quickstart:

| Change                      | Decision                                                                                                      | Ripple                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SC-049 / FR-150 ceiling** | Raised 2 MiB → 4 MiB, so neither piece is trimmed and the bitrate stands. Load time accepted as a known cost. | Closes the plan's open risk. ~3.52 MiB projected, ~13% headroom. The constitution's 2 MB **initial-payload** budget is untouched — lazy loading keeps both pieces out of it. |
| **Mute persistence**        | Out of scope. SC-047 narrowed to within-session behaviour.                                                    | No `settings.ts`, no `localStorage` key, no `SoundSetting` persistence, one fewer test file, and one row dropped from Complexity Tracking.                                   |

**A new section: [Known deviations](../spec.md#known-deviations).** Deferring the mute
persistence leaves FR-054 and style-bible A-3 unsatisfied. That gap predates this
feature — `Synth.muted` has always been in-memory — but the constitution's
compliance-review clause requires a deviation to carry a rationale and an owner rather
than going unrecorded, so it is now tabled rather than implied by FR-140's silence.
Scope was **narrowed deliberately, not quietly**, which is the distinction that
matters at review.

**Still in scope, and deliberately separated**: un-ticking feature 001's T095, which is
marked complete against `src/audio/gate.ts` — a file that does not exist. That is a
documentation correction, independent of whether persistence is ever built, and it
survives the deferral. The quickstart's governance gate says so explicitly, because it
is the check most likely to be skipped now that the work it referred to is deferred.

**Traceability re-verified** after the amendments: every FR-135…FR-150 and
SC-039…SC-049 is referenced by at least one downstream artifact, and no downstream
artifact references a requirement the spec does not define.

**Status**: plan complete; ready for `/speckit-tasks`.
