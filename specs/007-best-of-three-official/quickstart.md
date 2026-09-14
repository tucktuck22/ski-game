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

## Scenario 5 — Offline does not block a run (R2, FR-234)

1. Go offline (devtools → Network → Offline).
2. Press the official run control.

**Expected**: the run **starts normally**. Gameplay never waits on the network.

3. Finish the run, come back online, let the outbox drain, reload.

**Expected**: the score posts and the attempt count reconciles from shared storage.

**Fails if**: the run refuses to start. An earlier revision of this feature did exactly
that — the attempt dispenser failed closed — and the organizer's 2026-09-14 trust ruling
removed it. Gameplay gated on the network is the regression to watch for here.

**Known and accepted**: an attempt taken fully offline may go uncounted if the counter
write never lands. The player gets a free attempt by accident. This is the cost of
failing open, recorded in
[the contract](./contracts/storage-api.md#why-startofficialattempt-fails-open) rather
than defended against.

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

## Playtest — what is answered, and what is left

**Principle VIII is binding**, and three of its four questions were **answered by the
organizer on 2026-09-14 rather than by play**. That is legitimate — feature 006 recorded
two of its four the same way — but it is recorded as acceptance, not as a verdict from
riding the thing.

| Question                                        | Status                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| Does three attempts feel right?                 | **Answered**: _"3 is right."_ Accepted, not played                      |
| Does losing an attempt to a bail feel fair?     | **Answered**: _"Losing a run to a crashed tab is acceptable."_ Accepted |
| Should the count be defended against tampering? | **Answered**: no — _"we can count on honorable behavior"_               |
| Does the tripled session outstay its welcome?   | **OPEN.** Only play answers this                                        |

So one question remains, and it is the one no armchair settles: a full session is now up
to three practice runs on the warm-up slope plus three attempts on the 12,000-unit
official course.

```bash
npm run build:artifact
```

Hand over the link and name the commit it was built from (Definition of Done item 6).

Ask, and record the answer in the player's own words in [spec.md](./spec.md):

1. **Does the session outstay its welcome?** If so, is the answer fewer attempts, fewer
   practice runs, or a shorter official course?
2. **Does the first real bail sting more than expected?** The cost was accepted in advance;
   this is the chance to find out whether the acceptance survives contact. If it does not,
   FR-233 is the requirement to revisit, and the spec says so.

Question 2 is not a formal gate — it is already decided — but Principle VIII is explicit
that where measurement and the player disagree, the player wins. Ask it anyway.
