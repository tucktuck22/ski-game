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

Version change: 1.0.0 → 1.1.0
Rationale: TARGET_PLATFORM_BASELINE resolved during the first /speckit-plan, as
this document instructed. Technical Standards & Constraints materially expanded
with concrete platform, engine, reference hardware, and numeric budgets. No
principle added, removed, or redefined, so MINOR per the versioning policy.
Decision record: docs/adr/0006-platform-baseline-and-budgets.md

Resolved TODOs:
  TODO(TARGET_PLATFORM_BASELINE): resolved 2026-09-01. Evergreen mobile web, no
    game engine, 2022-era mid-range phone as reference hardware, budgets fixed.

Version change: 1.1.0 → 1.2.0
Rationale: Two principles added after the first deployment week produced six
consecutive corrective changes, none of which was a simulation, scoring, or storage
defect. Every one sat in the seam between the code and the human operating it:
deployment configuration, module bootstrap, error rendering, entry URLs, and setup
instructions. That seam was under no automated obligation. Two principles added, so
MINOR per the versioning policy.
Decision record: docs/adr/0008-verify-the-real-thing.md

Added principles:
  VI. The Shipped Artifact Is the Unit of Truth (NON-NEGOTIABLE)
  VII. Operator Instructions Are Deliverables Under Test (NON-NEGOTIABLE)

Modified sections:
  Technical Standards & Constraints — performance budget and reference-hardware
    clauses corrected: both described CI enforcement that does not exist. Now stated
    as obligations with their unmet status recorded, per Principle VI.
  Development Workflow & Quality Gates — "Trunk is always playable" now defines
    playable mechanically; Definition of Done gains items 7-9; a stop condition added
    for repeated fix-forward.

OPEN DEVIATIONS (Principle VI requires these be stated, not implied)
  The following are REQUIRED by this document and NOT YET ENFORCED. Each is a
  deviation under the Governance compliance-review clause, owned by the maintainer,
  for remediation before the deadline in specs/001-shredpocalypse-bed-draft.
    1. Smoke gate: LARGELY CLOSED 2026-09-04. CI now has a `smoke` job that runs
       `npm run build`, serves the artifact at the production base path
       `/ski-game/`, and drives the primary player journey - roster, practice run,
       results, board - in a real browser, plus the bare entry URL carrying no
       parameters. That is the three things Principle VI names. Two gaps remain
       and are stated in the job itself rather than implied away: it runs Chromium
       only, and `vite preview` 404s the bare `/ski-game` with no trailing slash
       where GitHub Pages redirects it, so that entry shape is still unverified.
       The originally recorded text read: "CI never runs `npm run build` and never
       loads the built artifact in a browser."
    1b. User-journey coverage in that gate is the music feature's journey plus the
       claim-and-practise path it drives through. The pre-existing us1/us3/us6 and
       error-boundary specs are still not run by any job - see deviation 2.
    2. User-journey e2e specs (us1, us3, us6, error-boundary) exist but no CI job
       runs them; only determinism.spec.ts runs under Playwright in CI.
    3. No performance budget job: no frame-time, heap, payload, or time-to-
       interactive check, and no CPU or network throttling. Required by Technical
       Standards & Constraints since v1.1.0 and never implemented.
    4. Principle V remains knowingly violated pending ADR-0005, which is still
       Proposed. Recorded in the spec's Constitutional Compliance Notes.
    5. The mute toggle is not persistent, though FR-054 and style-bible A-3 both
       require it. `Synth.muted` is an in-memory field and has always been one, so
       muting does not survive a reload. Feature 001's T095 was ticked against
       `src/audio/gate.ts`, a file that was never created - the gesture-gate half
       landed in `src/main.ts` and the persistence half was never written. The tick
       is corrected; the gap is deferred deliberately as low impact, owned by the
       maintainer, undated. Recorded in
       specs/003-recorded-music-tracks/spec.md#known-deviations.
  An amendment that adds an obligation without adding its gate leaves the obligation
  in this list. It does not get to be described as enforced.

  Remediation sequencing, agreed 2026-09-03: deviations 1 and 2 are built once the
  deployed game is confirmed playable end to end by the organizer, so the gate is
  written against a known-good baseline rather than a moving target.

  Update 2026-09-04: deviation 1 was brought forward at the maintainer's request
  while feature 003 was in flight, because that feature added the first code in the
  repository to read `import.meta.env.BASE_URL` and its failure mode - audio that
  404s - is completely silent. Waiting for the baseline would have meant shipping
  the one defect class the gate exists to catch, with nothing to notice it. The
  sequencing for deviation 2 is unchanged. This defers the
  stop condition in Development Workflow & Quality Gates by one step and does not
  waive it: the gate is the next deliverable after the game works, ahead of any
  further feature work. Deviation 3 has no date. Deviation 4 awaits a decision on
  ADR-0005.

  Style-bible amendment, 2026-09-04: rule A-1 previously forbade sampled audio of any
  kind. It now permits original recorded MUSIC while keeping every sound effect
  synthesised; A-2's instrument set is scoped to synthesis; A-5 is added, requiring a
  provenance record for any recorded asset. This is a Principle IV change to the style
  bible rather than to this document, so no version bump applies here. Decision
  record: docs/adr/0009-recorded-music.md. Governing feature:
  specs/003-recorded-music-tracks/.

Deferred TODOs:
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

### VI. The Shipped Artifact Is the Unit of Truth (NON-NEGOTIABLE)

Verification performed against a convenient approximation of the product is not
verification of the product.

- Every claim that a change works MUST be established against the built artifact,
  served at its production base path, entered through the URL a player actually uses.
  A development server at a different path, a unit test of an extracted function, or a
  locally run subset of the suite MUST NOT be offered as evidence that the deployed
  product works.
- CI MUST build the artifact and drive it in a real browser through, at minimum: a
  cold load at the production base path, the bare entry URL carrying no parameters,
  and the primary player journey end to end.
- Every failure state a player can reach MUST be produced deliberately in a test and
  asserted to render a message naming the cause and the remedy. A failure path that
  has never been executed is untested however carefully it was written.
- Where the environment verified differs from the player's, the difference MUST be
  stated at review as an explicit gap. An unstated difference is an untested one.

Rationale: every defect that reached a player in this project's first deployment week
— asset paths resolved against the wrong base, a top-level await that halted module
evaluation, an error object rendered as "[object Object]", an entry URL with no draft
— was invisible to a green local suite and visible within seconds of loading the
deployed page. The principles here that have held are the ones with a machine
enforcing them against the real thing. The ones that failed were prose.

### VII. Operator Instructions Are Deliverables Under Test (NON-NEGOTIABLE)

Anything a human is told to run, paste, edit, or copy is part of the product and
carries the same burden of proof as code.

- Setup scripts, example environment files, SQL an operator pastes, README command
  blocks, and any link the system generates MUST be executed verbatim in CI, on the
  platform the operator actually uses.
- CI MUST assert on the output of those artifacts, not merely on their exit status. A
  script that succeeds while printing something unusable has failed.
- A placeholder MUST NOT appear inside a string that also carries required syntax.
  Editable values MUST be isolated so that substituting one cannot destroy the rest.
- Values that MUST NOT be interchanged MUST be distinguishable at the point of use,
  and the consequence of confusing them MUST be stated where the choice is made.
- No document may instruct a human to perform a step the project has never executed.

Rationale: three separate setup traps reached the organizer — a placeholder URL that
produced an opaque network error, a secret key presented indistinguishably from the
publishable one and published in a browser bundle, and a link query whose placeholder
sat inside the string carrying the required parameter, so substituting it silently
deleted the parameter. The last of these passed a CI step that asserted the script
inserted eight rows while ignoring the unusable links it printed. Setup is where this
project has spent nearly all of its defect budget, and it was the only area under no
automated obligation at all.

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
memory ceiling, and a load-time ceiling on reference hardware, verified in CI. This
obligation is currently UNMET: no budget job exists. Recorded as an open deviation in
the Sync Impact Report rather than left stated as though it were in force, per
Principle VI.

**Accessibility.** Controls MUST be fully remappable. Information MUST NEVER be
conveyed by color alone. A reduced-motion option and subtitles for narrative and
audio cues MUST be provided. Palette choices MUST be validated against common color
vision deficiencies.

**Asset management.** Binary assets MUST be version-controlled with large-file
handling configured. Source files for derived assets MUST be retained.

**Platform baseline.** The target is the evergreen mobile web: Safari on iOS 16+,
Chromium and Firefox on Android 10+, and the same engines on desktop. No install and
no app store. No game engine is used; rendering runs on a thin WebGL layer and the
simulation, physics, and game loop are written directly, because general-purpose
engines are not built to produce bit-identical results across browser engines.

**Reference hardware.** A 2022-era mid-range phone — Pixel 6a, Galaxy A54, or iPhone
SE 3rd gen class. CI MUST approximate it with headless Chromium under 4× CPU
throttling and Fast 3G network emulation. This approximation is for catching
regressions; it does not replace the human playtest required by the Definition of
Done. This approximation is NOT YET IMPLEMENTED — see the open deviations.

**Budgets.** On reference hardware: simulation step MUST NOT exceed 2.0 ms per 60 Hz
tick; frame time MUST NOT exceed 16.7 ms at the 95th percentile, sustaining at least
50 fps through a full run; input-to-visible-response MUST NOT exceed 2 simulation
frames; initial payload MUST NOT exceed 2 MB gzipped; time to interactive MUST NOT
exceed 5 s on Fast 3G with a cold cache; peak heap MUST NOT exceed 150 MB.

**Simulation arithmetic.** Simulation code MUST use IEEE-754 float64 restricted to
addition, subtraction, multiplication, and division, all of which are correctly
rounded and therefore identical across conforming engines. Implementation-
approximated functions — trigonometric, exponential, logarithmic, and power
operations — MUST NOT appear in simulation code. This restriction MUST be enforced
by lint and proved by a determinism test asserted on three browser engines.

## Development Workflow & Quality Gates

**Flow.** Work follows the Spec Kit sequence: `/speckit-specify` → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement`. `/speckit-clarify` MUST be run when a spec
contains unresolved ambiguity; `/speckit-analyze` SHOULD be run before implementation
on any multi-part feature.

**Trunk is always playable.** The main branch MUST build and reach a playable run at
every commit. A change that leaves the game unplayable MUST be reverted rather than
fixed forward. "Playable" means the built artifact, served at its production base
path, reaches an interactive state in a real browser — proven by the smoke gate
required by Principle VI. A build command that exits zero is not evidence of this and
MUST NOT be cited as such.

**Definition of Done.** A task is done only when all of the following hold:

1. Its spec requirement is satisfied and acceptance criteria are verified.
2. Automated tests cover the behavior, including a determinism test for any
   simulation change.
3. Frame budget and memory ceiling are not regressed.
4. Any new asset has passed style-bible review.
5. Tuning values are in data files, not code.
6. A human has played the result and recorded findings.
7. The change has been exercised against the built artifact at its production base
   path, and the change description names the command run and the environment it ran
   in. "Verified" without a named command and environment is not a claim, and MUST be
   treated at review as unverified.
8. CI is green on the head commit, checked rather than assumed. Citing a check that
   did not run, or that does not exist, is a defect of the same severity as the bug it
   conceals, and MUST be handled as one.
9. Any operator-facing instruction the change adds or alters has been executed
   verbatim and its output inspected, per Principle VII.

**Review.** Every change MUST be reviewed against this constitution. Reviewers MUST
explicitly confirm principle compliance and reject changes that trade a principle for
speed. Added complexity MUST be justified in writing against a simpler rejected
alternative.

**Playtest cadence.** Playtesting MUST occur at feature completion, not solely at
milestone boundaries. Findings MUST be recorded against the governing spec.

**Repeated fix-forward is a stop condition.** Where two consecutive changes attempt to
fix the same user-visible failure, work on a third MUST NOT begin until the missing
gate has been identified and added. The defect is then the absence of the gate, not
the bug, and the gate is the deliverable. A sequence of corrective changes that adds
no gate is evidence the root cause has not been found.

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

**Version**: 1.2.0 | **Ratified**: 2026-09-01 | **Last Amended**: 2026-09-03
