<!--
SYNC IMPACT REPORT
==================
Version change: (none) → 1.0.0
Rationale: Initial ratification. Template scaffold replaced with concrete project
governance derived from the stated project purpose.

Modified principles:
  [PRINCIPLE_1_NAME] (placeholder) → I. Spec-Driven Delivery (NON-NEGOTIABLE)
  [PRINCIPLE_2_NAME] (placeholder) → II. Stability Before Content
  [PRINCIPLE_3_NAME] (placeholder) → III. Fun Is a Testable Requirement
  [PRINCIPLE_4_NAME] (placeholder) → IV. One Coherent 1980s Graphic Novel Voice
  [PRINCIPLE_5_NAME] (placeholder) → V. Fair and Verifiable Competition

Added sections:
  Technical Standards & Constraints (was [SECTION_2_NAME])
  Development Workflow & Quality Gates (was [SECTION_3_NAME])
  Governance (populated)

Removed sections: none

Deferred TODOs:
  TODO(TARGET_PLATFORM_BASELINE): Engine, target platforms, and the reference
    hardware that defines the frame budget are not yet chosen. Resolve during the
    first /speckit-plan and amend as a MINOR bump.
  TODO(PRODUCT_TITLE): "Ski Game" is a working name. Final product title is a
    deferred naming decision and does not block governance.
-->

# Ski Game Constitution

## Core Principles

### I. Spec-Driven Delivery (NON-NEGOTIABLE)

Specification precedes implementation. No production code merges without an approved
spec describing the player-observable behavior it delivers.

- Every feature MUST progress through spec → plan → tasks → implement before merge.
- Specs MUST describe observable player behavior and acceptance criteria, NOT
  implementation details, engine APIs, or class layouts.
- Every task MUST trace to a numbered requirement in its spec. Untraceable work is
  out of scope and MUST be rejected or escalated into a spec amendment.
- Behavior changes MUST amend the governing spec in the same change set. A spec that
  disagrees with shipped behavior is a defect.

Rationale: Games decay into unmaintainable prototypes when behavior lives only in
code and in the author's head. A written spec is the only durable contract about what
the game is supposed to do, and it is what makes the rest of these principles
enforceable.

### II. Stability Before Content

Stability is the first quality gate, not a release-hardening phase. A feature that
destabilizes the build is not done.

- The game MUST NOT crash, hang, or soft-lock on any input sequence. Randomized input
  ("monkey") testing MUST be part of the automated suite.
- The simulation MUST be deterministic: identical (course, seed, input sequence,
  build) MUST produce an identical run, bit-for-bit, on the same platform.
- The build MUST hold its frame budget on reference hardware. Any change that
  regresses frame time beyond the budget is a merge blocker until resolved.
- Player profiles, settings, and saved runs MUST NEVER be corrupted by an update.
  Schema changes MUST ship with a migration and a round-trip test.
- Any defect that interrupts a run already in progress is a release blocker.

Rationale: The project purpose names stability first. In a timing-and-skill game, a
crash, hitch, or lost run destroys the player's investment, and no amount of content
compensates for a game that cannot be trusted to finish a run.

### III. Fun Is a Testable Requirement

"Enjoyable" is a requirement subject to acceptance criteria, not a subjective hope
deferred to polish.

- Every mechanic spec MUST define its feel parameters and measurable acceptance
  criteria (e.g. input-to-response latency, carve radius, airtime, landing tolerance,
  speed ranges).
- Input-to-visible-response latency MUST NOT exceed 2 simulation frames under normal
  load.
- All tuning values MUST live in versioned data files. Magic numbers governing feel
  MUST NOT be embedded in code.
- A mechanic MUST NOT be marked done until it has been played end-to-end by a human
  and the session findings are recorded against its spec.
- Controls MUST behave consistently across skiing and snowboarding; shared verbs
  (turn, carve, jump, grab, crash, recover) MUST NOT invert or remap between them.

Rationale: Fun is the product. Treating it as unmeasurable makes it unmanageable and
pushes it to the end of the schedule, where it is never fixed. Externalizing tuning
into data is what makes iteration on feel cheap enough to actually happen.

### IV. One Coherent 1980s Graphic Novel Voice

The 1980s graphic novel aesthetic is a governing constraint on every asset, not a
theme layered on at the end.

- A style bible MUST exist and MUST be the single source of truth for palette,
  linework weight, halftone/screen-tone treatment, panel framing, lettering, and
  typography.
- Every visual and audio asset MUST conform to the style bible and MUST cite the rule
  it satisfies at review. Assets failing style review MUST be rejected, not merged
  with a promise to fix later.
- Skiing and snowboarding MUST read as the same world while remaining instantly
  distinguishable in silhouette, stance, and animation vocabulary.
- UI, HUD, menus, and transitions MUST use the comic idiom (panels, gutters, caption
  boxes, sound-effect lettering) rather than generic engine-default UI.
- Legibility outranks style: no stylistic treatment may obscure information the player
  needs to complete a run.

Rationale: The aesthetic is the project's differentiator, and art direction drifts
asset by asset when it is not written down and enforced at review. The final clause
exists because period-authentic treatments (heavy halftone, limited palette, dense
lettering) can actively harm readability at speed.

### V. Fair and Verifiable Competition

Players compete for glory, and glory is worthless if the standings cannot be trusted.

- Every scored run MUST be reproducible from its (course, seed, input trace, build
  version) record.
- All competitors on a given leaderboard MUST face identical course conditions.
  Randomized elements MUST derive from the shared seed.
- Submitted scores MUST be validated by replay verification before publication.
  Client-reported scores MUST NEVER be trusted as authoritative.
- Leaderboards MUST be partitioned by build version whenever a physics or scoring
  change invalidates cross-version comparison.
- No progression, cosmetic, or monetization mechanic may confer competitive advantage.

Rationale: Competitive integrity is a technical property, not a policy statement. It
is achievable only if determinism and replay capture are designed in from the start —
they cannot be retrofitted onto a nondeterministic simulation.

## Technical Standards & Constraints

**Simulation architecture.** The simulation MUST be separated from rendering and
MUST advance on a fixed timestep, with rendering interpolating between simulation
states. Rendering MUST NOT mutate simulation state.

**Determinism requirements.** Simulation code MUST NOT read wall-clock time, frame
duration, uninitialized memory, unordered collection iteration, or any unseeded random
source. All randomness MUST derive from an explicit seed. Floating-point behavior in
the simulation MUST be specified and pinned, or fixed-point arithmetic used.

**Data-driven content.** Courses, tuning curves, scoring tables, and asset manifests
MUST be declared in versioned, human-readable data files, loadable without a code
change or recompile.

**Performance budgets.** Each release MUST declare and enforce a frame-time budget, a
memory ceiling, and a load-time ceiling on reference hardware, verified in CI.

**Accessibility.** Controls MUST be fully remappable. Information MUST NEVER be
conveyed by color alone. A reduced-motion option and subtitles for narrative and
audio cues MUST be provided. Palette choices MUST be validated against common color
vision deficiencies.

**Asset management.** Binary assets MUST be version-controlled with large-file
handling configured. Source files for derived assets MUST be retained.

TODO(TARGET_PLATFORM_BASELINE): Engine, target platforms, and reference hardware are
undetermined. These MUST be fixed during the first `/speckit-plan` and recorded here
via a MINOR amendment, at which point the numeric budgets above become concrete.

## Development Workflow & Quality Gates

**Flow.** Work follows the Spec Kit sequence: `/speckit-specify` → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement`. `/speckit-clarify` MUST be run when a spec
contains unresolved ambiguity; `/speckit-analyze` SHOULD be run before implementation
on any multi-part feature.

**Trunk is always playable.** The main branch MUST build and reach a playable run at
every commit. A change that leaves the game unplayable MUST be reverted rather than
fixed forward.

**Definition of Done.** A task is done only when all of the following hold:

1. Its spec requirement is satisfied and acceptance criteria are verified.
2. Automated tests cover the behavior, including a determinism test for any
   simulation change.
3. Frame budget and memory ceiling are not regressed.
4. Any new asset has passed style-bible review.
5. Tuning values are in data files, not code.
6. A human has played the result and recorded findings.

**Review.** Every change MUST be reviewed against this constitution. Reviewers MUST
explicitly confirm principle compliance and reject changes that trade a principle for
speed. Added complexity MUST be justified in writing against a simpler rejected
alternative.

**Playtest cadence.** Playtesting MUST occur at feature completion, not solely at
milestone boundaries. Findings MUST be recorded against the governing spec.

## Governance

This constitution supersedes all other development practices, conventions, and
preferences. Where any other document, habit, or convenience conflicts with it, this
constitution governs.

**Amendment procedure.** Amendments MUST be proposed in writing with: the exact text
change, the rationale, the impact on existing specs and code, and a migration plan
where behavior changes. An amendment takes effect only once approved and committed
with an updated version line and Sync Impact Report.

**Versioning policy.** This constitution uses semantic versioning:

- **MAJOR** — a principle is removed or redefined in a backward-incompatible way, or
  governance is materially restructured.
- **MINOR** — a principle or section is added, or existing guidance is materially
  expanded.
- **PATCH** — clarifications, rewording, or typo fixes that do not change meaning.

**Compliance review.** Compliance MUST be verified at every code review and at every
milestone. Principles marked NON-NEGOTIABLE MUST NOT be waived; all other deviations
MUST be documented with rationale, an owner, and a remediation date, and MUST be
reviewed at the next milestone.

**Runtime guidance.** Agent-facing runtime development guidance MUST be maintained in
a project-root `CLAUDE.md` and MUST remain consistent with this constitution. Where
the two disagree, this constitution governs and the guidance file MUST be corrected.

**Version**: 1.0.0 | **Ratified**: 2026-09-01 | **Last Amended**: 2026-09-01
