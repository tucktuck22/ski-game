# 8. Verify the real thing, and treat setup instructions as code

Date: 2026-09-03

## Status

Accepted

## Context

The first deployment week produced six consecutive corrective changes. None was a
simulation, scoring, or storage defect — the three areas this project had invested
most heavily in proving:

| Failure reaching the organizer               | Where it lived                                                    |
| -------------------------------------------- | ----------------------------------------------------------------- |
| Assets 404 at `/ski-game`                    | Vite `base` config                                                |
| Blank page, audio still armed                | Top-level `await` halting module evaluation                       |
| Error panel reading `[object Object]`        | Error serialization of a plain object                             |
| `TypeError: Failed to fetch`                 | A placeholder URL in `.env.example`, pasted into a secret         |
| "Forbidden use of secret API key in browser" | Secret and publishable keys indistinguishable at the point of use |
| `No draft found for id "local-draft"`        | Bare entry URL with no `?draft=`                                  |
| Two links that 404                           | A placeholder inside the string carrying the required `?draft=`   |

Every one sits in the seam between the code and the human operating it: deployment
configuration, module bootstrap, error rendering, entry URLs, setup instructions.

The pattern is not carelessness in those areas. It is that the constitution's
principles held wherever a machine enforced them and failed wherever they were prose:

- Determinism: a lint rule restricting simulation arithmetic plus a golden-run test
  asserted on three browser engines. No determinism defect escaped.
- Storage invariants: `setup.sql` applied to a real Postgres 16, then twelve
  assertions that each violate an invariant on purpose. No storage defect escaped.
- "Trunk is always playable": prose, no gate. Trunk shipped a blank page twice, from
  two unrelated causes.
- "A human has played the result": prose, no gate. Tasks were marked done without it,
  and the organizer became the playtest, in production, on a phone.
- Setup instructions: no obligation of any kind. Three separate traps shipped.

Auditing the document against the repository found two clauses describing enforcement
that does not exist. Technical Standards & Constraints has claimed since v1.1.0 that
performance budgets are "verified in CI" and that "CI approximates [reference
hardware] with headless Chromium under 4x CPU throttling and Fast 3G network
emulation". There is no such job. CI also never runs `npm run build`, and never runs
the user-journey e2e specs — only `determinism.spec.ts` runs under Playwright. The
base-path and blank-page defects were therefore not missed by CI; they were outside
what CI could observe.

One earlier instance of the same fault is on record: a pull request description
claimed three-engine determinism verification at a time when the spec file did not
exist. A verification claim is worth exactly what the check behind it is worth.

## Decision

Add two principles, both NON-NEGOTIABLE.

**VI. The Shipped Artifact Is the Unit of Truth.** Claims are established against the
built artifact at its production base path, through the URL a player uses. CI builds
the artifact and drives it in a real browser: cold load at the production base path,
the bare entry URL, and the primary journey. Reachable failure states are produced
deliberately and asserted to name cause and remedy. Where the verified environment
differs from the player's, the difference is stated at review.

**VII. Operator Instructions Are Deliverables Under Test.** Setup scripts, example
environment files, pasted SQL, README commands and generated links are executed
verbatim in CI, and CI asserts on their output rather than their exit status. A
placeholder may not sit inside a string carrying required syntax. Values that must not
be interchanged are distinguishable at the point of use. No document instructs a human
to perform a step the project has never executed.

Supporting changes: "playable" is defined as the built artifact reaching an
interactive state rather than a build command exiting zero; Definition of Done gains a
requirement to name the command and environment behind any verification claim, to
check CI rather than assume it, and to execute any operator instruction the change
touches; and two consecutive fix-forward attempts at the same user-visible failure
become a stop condition, after which the missing gate is the deliverable.

The two false enforcement claims are corrected in place and recorded as open
deviations rather than deleted, so the gap stays visible until it is closed.

## Consequences

The gates are not free. A smoke job that builds and drives the artifact, plus a budget
job with throttling, add CI time and a maintenance surface, on a project whose
audience is eight people for one weekend. That cost is accepted because it is where
this project's defect budget was actually spent: the simulation and storage work,
which absorbed most of the engineering effort, produced no escaped defects, while the
operator path produced seven.

Principle VII slows setup changes. Adding a line to a SQL script now means adding an
assertion on its output. This is the intended trade: the seed script's CI step
asserted that eight roster rows appeared and ignored the unusable links it printed,
and so passed on exactly the failure it existed to catch.

Adding these principles does not enforce them. Four obligations are listed as unmet in
the Sync Impact Report, three of them predating this record. Until those jobs exist,
this ADR has changed what the project promises, not what it verifies — which is the
distinction the two new principles exist to make impossible to blur.
