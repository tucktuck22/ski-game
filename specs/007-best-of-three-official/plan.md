# Implementation Plan: Three Attempts, Best One Counts

**Branch**: `claude/blissful-volta-462rjk` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-best-of-three-official/spec.md`

## Summary

Replace the single official run with three official attempts on the official course, of
which the best single attempt counts, and make starting an attempt spend it.

The technical approach is **append-only attempt rows plus a client-advanced attempt
counter**. Each attempt gets a number, 1 to 3, taken when the run starts; scores are
inserted as separate immutable rows keyed
`(draft_id, entry_id, attempt_no)`; the leaderboard score is derived by reducing that set
to its best. Nothing is ever updated or deleted, which preserves the immutability
property `0002_policies.sql` was built around, and the per-attempt unique index preserves
the idempotency that today's one-per-entry index provides for free.

Three latent defects in the current code would become live bugs under a naive
implementation and are called out as first-class work rather than discovered later:
the outbox's fixed per-entry key, the snapshot's silently-last-wins score map, and the
loss of insert idempotency if the unique index is simply dropped. See
[research.md](./research.md) R3, R4 and R1.

## Technical Context

**Language/Version**: TypeScript 5.6, ES modules, `strict` on

**Primary Dependencies**: `@supabase/supabase-js` 2.x (storage), `pixi.js` 8.x
(rendering — untouched by this feature)

**Storage**: Supabase (Postgres 15 + RLS). Local in-memory fallback
(`src/state/localDraft.ts`) when no project is configured. IndexedDB outbox for commit
durability.

**Testing**: Vitest (unit, sim, course, contract); Playwright (e2e, e2e-build,
e2e-shared, three-engine determinism); `psql` against real Postgres in CI for storage
invariants.

**Target Platform**: Evergreen mobile web — Safari iOS 16+, Chromium/Firefox Android
10+, same engines on desktop.

**Project Type**: Single-project browser game, no backend of our own beyond Postgres.

**Performance Goals**: Unchanged. This feature adds no simulation work and no per-frame
cost; it changes storage shape and menu state only. Budgets from the constitution
continue to apply and are not expected to move.

**Constraints**: Offline-capable commits (FR-046). No client may be trusted for values
(ADR-0004) but every client is bound by rules enforced in the database. Simulation
determinism is untouched — this feature does not enter `src/sim/`.

**Scale/Scope**: 16 roster entries maximum, up to 3 score rows each, so at most 48 score
rows per draft. Volume is irrelevant; correctness under retry and device-switching is
the whole problem.

## Constitution Check

_GATE: evaluated before Phase 0, re-evaluated after Phase 1._

| Principle                                        | Status  | Evidence / obligation this plan accepts                                                                                                                                                                                                                                                               |
| ------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Spec-Driven Delivery (NON-NEGOTIABLE)         | PASS    | spec.md approved with FR-231..FR-244, SC-081..SC-087. Every task in `/speckit-tasks` must cite one. FR-019 is amended in the same change set by FR-233, and ADR-0002 gets its reversal recorded, satisfying "behaviour changes MUST amend the governing spec".                                        |
| II. Stability Before Content                     | PASS\*  | Schema change ships with a migration and a round-trip test (see R7, and the migration round-trip task T039 that feature 001 left open is directly in scope here). No simulation change, so determinism is untouched. \*The obligation is real work, not a free pass — see Phase 2 notes.              |
| III. Fun Is a Testable Requirement               | PASS    | No tuning values move; nothing enters `data/*.json`. The feel change is structural (how many attempts), and its acceptance criteria are SC-081..SC-087.                                                                                                                                               |
| IV. One Coherent 1980s Graphic Novel Voice       | PASS    | New UI is text in existing panels — attempt counters and menu copy. No new asset, so no style review needed. Legibility clause applies: attempts remaining must not be conveyed by colour alone (FR-055).                                                                                             |
| V. Fair and Verifiable Competition               | PASS\*  | \*Already knowingly deviated via ADR-0004/ADR-0005; this feature neither worsens nor repairs it. It does move one rule from honour-system to server-enforced (R2), which is a step toward V rather than away. Recorded below.                                                                         |
| VI. The Shipped Artifact Is the Unit of Truth    | PASS    | The rule is proven in the real-Postgres CI job against `supabase/setup.sql` pasted as an organizer would, and the player-facing half in `test:build` against the built artifact at `/ski-game/`. Both gates already exist; this feature extends them rather than inventing them.                      |
| VII. Operator Instructions Are Deliverables      | PASS\*  | `0005` must be appended to `supabase/setup.sql` and exercised by the existing real-Postgres job. \*One pre-existing violation found in passing and NOT fixed here — see Complexity Tracking.                                                                                                          |
| VIII. The Player Judges Fun, and Judges It Early | **GAP** | This changes a rule the player meets as difficulty, so a play pass is required at the FIRST playable point, not at completion. Session length roughly triples (spec Accepted Consequences). The plan schedules this explicitly; see Phase 2 notes. Not yet satisfied, and stated rather than implied. |

**No gate blocks Phase 0.** Principle VIII's obligation is a scheduling commitment
carried into `/speckit-tasks`, not a design violation.

### Deviations this plan does not repair

- **Principle V** remains knowingly violated by ADR-0004 (client-reported scores).
  Three attempts triple the number of unverified values without changing the trust
  model. Recorded in the spec's Accepted Consequences.
- **The abandonment counter is honour-system**, by the organizer's ruling of 2026-09-14
  (_"we should not build this with cheaters in mind"_). An earlier revision of this plan
  hardened it with a `security definer` function; [R2](./research.md#r2--where-starting-spends-it-is-enforced)
  records the reversal. The rule is stated, implemented and counted — it is simply not
  defended, exactly as ADR-0004 does not defend the score field beside it.

## Project Structure

### Documentation (this feature)

```text
specs/007-best-of-three-official/
├── plan.md              # This file
├── research.md          # Phase 0 — nine decisions, with rejected alternatives
├── data-model.md        # Phase 1 — entities, constraints, state transitions
├── quickstart.md        # Phase 1 — runnable validation guide
├── contracts/
│   └── storage-api.md   # Phase 1 — delta to feature 001's storage contract
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # /speckit-tasks output — NOT created here
```

### Source code touched

```text
supabase/
├── migrations/0005_best_of_three.sql   NEW — schema and the counter's update grant
├── setup.sql                            APPEND 0005 (hand-maintained concatenation)
└── tests/invariants.sql                 EXTEND — per-attempt invariants, in the
                                         deliberate-violation style already used

src/state/
├── runEconomy.ts        availability() and course gating move to an attempt count
├── ordering.ts          EntryView gains attempts used and best-attempt fields;
│                        computeStandings ranks on best, ties on the best attempt's time
├── supabase.ts          snapshot() reduces many score rows to the best (R4);
│                        startOfficialAttempt() replaces markOfficialRunEnded()
├── localDraft.ts        mirrors every rule above, including the 1..3 refusal
└── outbox.ts            PendingCommit carries attemptNo (R3)

src/
├── main.ts              startRun() allocates an attempt BEFORE gameplay;
│                        endRun() enqueues under an attempt-scoped key
└── ui/leaderboard.ts    statusOf() reports official attempts, not only practice

tools/gen-courses.ts     rulesVersion 2.0.0 → 3.0.0 on both courses
data/courses/*.json      regenerated via npm run gen:courses

tests/
├── unit/run-economy.test.ts        rewritten for three attempts
├── unit/ordering.test.ts           best-of ranking and the FR-236 tiebreak
├── unit/outbox.test.ts             attempt-scoped keys do not collide
├── contract/storage.test.ts        the storage surface's new shape
├── e2e-shared/official-run-is-spent.spec.ts   becomes attempts-are-spent
└── e2e/us2-*.spec.ts               device-switching grants no fourth attempt
```

**Structure Decision**: No new directories and no new modules. The feature is a change
of rule, and every rule it changes already has a home. Adding a `src/state/attempts.ts`
was considered and rejected — `runEconomy.ts` exists precisely to answer "what may this
player do next", and splitting that answer across two files would make the one question
the feature is about harder to find, not easier. Feature 001 already shipped an orphaned
`src/state/abandonment.ts` that nothing ever called; that is the failure mode to avoid.

## Complexity Tracking

| Violation                                                          | Why Needed                                                                                                                                                                                                                             | Simpler Alternative Rejected Because                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~A `security definer` function to allocate attempts~~             | **WITHDRAWN 2026-09-14** by the organizer's ruling on the trust model. The feature is simpler for it: no function, no revoke, no network round-trip gating gameplay. See [R2](./research.md#r2--where-starting-spends-it-is-enforced). | The plain column update it was rejected in favour of is now the decision, matching `recordPracticeRun` at `src/state/supabase.ts:213`.                                                                                                                 |
| An explicit `attempt_no` rather than just allowing three rows (R1) | It restores insert idempotency, which today's `UNIQUE (draft_id, entry_id)` provides for free and which the outbox's retry loop silently depends on. It also caps scored attempts in the schema rather than in the client.             | "Just drop the unique index" means a commit that succeeded but whose response was lost gets retried and posts a phantom second attempt. The outbox is built to retry until confirmed; without a natural key it cannot tell a retry from a new attempt. |

### Found in passing, deliberately NOT fixed here

Both are real and neither belongs in this feature's diff (Definition of Done item 8's
sibling concern: an unrelated fix hides in a feature diff).

1. **`package.json` declares `"db:migrate": "node tools/migrate.mjs"` and
   `tools/migrate.mjs` does not exist.** Principle VII forbids instructing a human to
   run a step the project has never executed. `npm run db:migrate` fails immediately.
2. **`docs/adr/` contains two files numbered 0010** —
   `0010-a-ninth-colour.md` and `0010-organizer-actions-as-secret-gated-functions.md`.
   This feature's ADR takes 0011; the collision wants its own change.

## Constitution Check — re-evaluated after Phase 1

Design is complete. Nothing in Phase 1 changed a gate's verdict, and two got sharper:

- **Principle II** gained a concrete obligation rather than a promise. The migration
  round-trip is now a named scenario (quickstart Scenario 6) against a database holding
  a pre-feature score, which is feature 001's still-unchecked T039. "Ships with a
  migration and a round-trip test" is now something a reviewer can check rather than
  take on trust.
- **Principle VI** briefly gained a failure state and then lost it again. R2's original
  decision — the dispenser failing closed — created a reachable failure the player had
  never seen, an attempt that refuses to start, which Principle VI would have required a
  deliberate test for. The organizer's 2026-09-14 ruling removed the dispenser, and with
  it that state and its test. **Fewer reachable failure states is the right direction**,
  and it is worth noting that the simplification came from a product decision rather than
  from engineering.

**Design-stage findings that did not change a verdict but are worth a reviewer's eye:**

- **The feature no longer gates gameplay on the network.** An earlier revision did, and
  it was the single worst consequence in the design — offline meant you could not start a
  run. The organizer's trust ruling removed it. What remains is that an offline player's
  attempt may go uncounted; that is recorded in the contract as an accepted cost rather
  than left to be discovered in play.
- **Three latent defects** in shipping code (research R1, R3, R4) become live bugs under
  a naive implementation. All three are silent: a phantom attempt from a retried commit,
  a queued score overwritten by the next attempt, and a leaderboard ranking on whichever
  row the database happened to return last. None would fail a build. They are Phase 0
  decisions rather than implementation notes for exactly that reason.

**Verdict: no gate blocks `/speckit-tasks`.** Principle VIII's play pass remains an open
obligation, scheduled at the first playable point, and is stated here rather than
implied.

## Phase 2 notes (for `/speckit-tasks`, not executed here)

- **Playtest ordering is a constitutional obligation, not a preference.** Principle VIII
  requires the play pass at the first playable point. The first playable point here is
  after the client can allocate and spend attempts against local mode — before the
  migration is written. `/speckit-tasks` must order it there and name the published
  build, per Definition of Done item 6.
- **The migration round-trip test** is feature 001's T039, still unchecked. This feature
  is the first schema change since it was written down, so it stops being deferrable.
- **`rulesVersion` 2.0.0 → 3.0.0** invalidates cross-version comparison by design
  (FR-243). The draft is not live (spec Assumptions), so no reset is needed, but the
  bump must land in the same change as the rule or a seeded draft will refuse commits.
