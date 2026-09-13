# Quickstart: Three Attempts, Best One Counts

**Phase 1** for [plan.md](./plan.md). How to prove this feature works, end to end.

Per **Principle VI**, a claim that this works is established against the built artifact
served at its production base path — not against a dev server and not against a unit
test of an extracted function. Per **Definition of Done item 7**, whoever validates this
names the command run and the environment it ran in.

## Prerequisites

```bash
npm ci
npx playwright install --with-deps chromium
```

For the database scenarios, a local Postgres. CI does this in the "Storage invariants
against real Postgres" job; locally:

```bash
createdb shred
psql -d shred -v ON_ERROR_STOP=1 -f supabase/setup.sql
```

## Automated gates

Run in this order — cheapest first, and each one's failure means something different.

| #   | Command                                 | Proves                                                                    | Requirement            |
| --- | --------------------------------------- | ------------------------------------------------------------------------- | ---------------------- |
| 1   | `npm run lint`                          | Formatting and lint clean                                                 | —                      |
| 2   | `npx tsc --noEmit`                      | `EntryView`'s new shape propagated everywhere it is read                  | —                      |
| 3   | `npm run test:unit`                     | Best-of reduction, the FR-236 tiebreak, attempt availability, outbox keys | FR-232, FR-235, FR-236 |
| 4   | `npm run test:contract`                 | Both backends — Supabase and local — obey one contract                    | R6                     |
| 5   | `npm run test:shared`                   | An attempt is spent whatever the commit does                              | FR-233, FR-234         |
| 6   | `npm run test:build`                    | The journey works **on the built artifact at `/ski-game/`**               | Principle VI           |
| 7   | `psql -f supabase/tests/invariants.sql` | The database refuses what it must, on real Postgres                       | FR-231, FR-237         |

Gate 7 is the one that matters most for this feature: the three-attempt cap is a schema
constraint, and a constraint nobody has tripped is not evidence of anything.

## Scenario 1 — Best of three counts (FR-232, SC-082)

1. Claim a name. Take the three practice runs, or skip them.
2. Take official attempt 1. Note the score.
3. Take attempt 2 and deliberately score **lower** — wipe out early.
4. Check the leaderboard.

**Expected**: attempt 1's score still stands. The lower attempt appears nowhere as your
score. The board says one attempt remains.

**Fails if**: the board shows the most recent score rather than the best. That is the
R4 defect — the snapshot keeping the last row instead of reducing to the best.

## Scenario 2 — Starting spends it (FR-233, FR-234, SC-083)

1. With attempts remaining, start an official attempt.
2. Part-way down, **kill the tab** — close it outright, do not let the run end. A hard
   kill, not a graceful navigation; they are different code paths and only this one
   matters.
3. Reopen the game, **on a different device or in a private window**.

**Expected**: one fewer attempt. No score posted for it. The board agrees from the
second device.

**Fails if**: the attempt came back. That means the counter is being written at run end
rather than at run start, and abandonment is free again — the exact hole this feature
exists to close.

## Scenario 3 — A wipeout does not end your draft (FR-238, SC-081)

1. Take attempt 1 and wipe out immediately for a near-zero score.
2. Confirm the score posts and that **two attempts remain**.
3. Take attempt 2 and finish cleanly for a good score.

**Expected**: the good score is what stands. The wipeout is not your result.

This is the scenario that carries the whole point of the feature, and SC-081 requires it
demonstrated end to end rather than argued.

## Scenario 4 — No fourth attempt, ever (FR-235, SC-084)

Use all three attempts, then try each of these in turn:

- Clear site data and reload
- Open in a private window
- Open on a second device

**Expected**: no attempts, every time. The official control stays unavailable and your
best score is stated plainly.

**Fails if**: any of them grants an attempt. Feature 001's US2 property must survive this
feature unchanged.

## Scenario 5 — The attempt that will not start (FR-234, R9, Principle VI)

1. Go offline (devtools → Network → Offline).
2. Press the official run control.

**Expected**: the attempt does **not** start, and the message says so _and_ says the
attempt has not been lost. Something in the shape of: _"Could not start your attempt —
you have not lost it. Check your connection and try again."_

**Fails if**: the run starts anyway (unlimited offline attempts — the loophole, moved
rather than closed), or if the message leaves the player thinking he has been charged.

This is the one place the feature makes the offline experience worse, and it is
deliberate — see the contract's
[Why `startOfficialAttempt` fails closed](./contracts/storage-api.md#why-startofficialattempt-fails-closed).

## Scenario 6 — Migration round-trip (FR-050, feature 001's T039)

Against a database holding a draft under the **old** one-run schema, with at least one
committed score:

```bash
psql -d shred -v ON_ERROR_STOP=1 -f supabase/migrations/0005_best_of_three.sql
```

**Expected**: applies cleanly standalone. Existing scores survive untouched and become
`attempt_no = 1`. A player who had committed shows one attempt used and two remaining.

This is feature 001's T039, still unchecked, and this is the first schema change since it
was written down.

## Playtest — required, and required EARLY

**Principle VIII is binding here.** This changes a rule the player meets as difficulty,
so the play pass happens at the **first playable point** — as soon as attempts can be
allocated and spent against local mode, before the migration exists — not at feature
completion.

```bash
npm run build:artifact
```

Hand over the link and name the commit it was built from.

Questions for the player, to be answered in his own words and recorded against
[spec.md](./spec.md) before any further change to these rules:

1. **Does three feel right?** Or does it want to be two — or five?
2. **Session length roughly triples.** Up to three practice runs plus three attempts on
   the long course. Does the session outstay its welcome, and if so, is the answer fewer
   attempts or fewer practice runs?
3. **Does losing an attempt to a bail feel fair, or punitive?** This is the ADR-0002
   reversal meeting a real person. It is the single riskiest judgement in the feature.
4. **Is attempt 1 still a cold read worth having,** now that attempts 2 and 3 are
   informed by it?

Question 3 is the one to watch. Everything else is tunable; that one is the design.
