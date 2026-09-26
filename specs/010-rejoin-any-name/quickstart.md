# Quickstart: validating Rejoin Any Name

## Prerequisites

`npm ci`. Chromium is available via the pre-installed Playwright browsers.

## Automated (what CI runs)

```bash
npx tsc --noEmit        # every leftover reader of EntryView.claimed fails here
npm run lint
npm run test:unit       # leaderboard + organizer render tests (NOT STARTED, no RELEASE)
npm run test:shared     # tests/e2e-shared/rejoin.spec.ts — the reported bug
npm run test:build      # tests/e2e-build/pick-name.spec.ts — against /ski-game/ build
```

Expected: everything passes. `grep -rnE "claimEntry|releaseClaim|data-claim|data-release|UNCLAIMED" src tests` returns nothing.

`rejoin.spec.ts` MUST fail on `29ab3bc` (before the fix) and pass after it. Run it once before changing `src/` to prove it reproduces the bug:

```bash
git stash -- src && npm run test:shared -- rejoin && git stash pop
```

## Scenarios the specs cover

| #  | Scenario                                                                 | Spec reqs              | Where                          |
| -- | ------------------------------------------------------------------------ | ---------------------- | ------------------------------ |
| Q1 | An entry already has `claimed_at` set from a past session; a fresh browser sees it on the roster, picks it, and sees its counts | FR-300/301/302 | `e2e-shared/rejoin.spec.ts` |
| Q2 | Picking and backing out send no `roster_entry` request                   | FR-301/304, contract   | `e2e-shared/rejoin.spec.ts` |
| Q3 | Pick, reload the page: resumes without the roster                        | FR-305                 | `e2e-build/pick-name.spec.ts` |
| Q4 | NOT YOU? after a committed official attempt: allowed, and the name stays listed | FR-303/304      | `e2e-build/pick-name.spec.ts` |
| Q5 | No `CLAIMED`/`UNCLAIMED` text on the board or organizer panel; no RELEASE | FR-308/309            | unit + `pick-name.spec.ts` |
| Q6 | Organizer removes the picked entry: that device returns to the roster    | FR-306                 | `e2e-build/pick-name.spec.ts` (organizer URL, local mode) |

## Manual play pass (Definition of Done item 6)

This is not a feel change, so Principle VIII's early-build obligation does not apply. A human check at completion still does. On the deployed build or `npm run build:artifact`:

1. Pick your name and do one practice run. Close the browser completely and reopen the link. **You are straight back in as yourself.**
2. Open the same link in a private window. **Your name is listed; pick it; the practice count shows 1 used.**
3. Tap NOT YOU?, pick someone else, then NOT YOU? again and pick yourself. **No dialogs, and neither name's numbers changed.**
4. Record the findings against `spec.md` in your own words.
