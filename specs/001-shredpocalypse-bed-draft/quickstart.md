# Quickstart: Validating Shredpocalypse '86

**Date**: 2026-09-01 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

How to prove the feature works. Each scenario maps to requirements and success
criteria and is runnable rather than inspected by eye.

## Prerequisites

- Node 20+
- A Supabase project (free tier); URL and anon key in `.env.local`
- Playwright browsers are preinstalled in this environment — do **not** run
  `playwright install`

```bash
npm install
npm run dev          # local dev server
npm run db:migrate   # schema, RLS policies, constraints, triggers
```

## Scenario 1 — Determinism across three engines

**Proves**: FR-026, Principle II, and the reproducibility clause of Principle V that
survives ADR-0004.

```bash
npm run test:determinism
```

Replays a recorded seed and input trace on Chromium, Firefox, and WebKit.

**Expected**: identical score and identical end-state hash on all three. Any
divergence fails the build. This is the single most important test in the suite —
if it fails, the leaderboard cannot be trusted to mean anything, and no other
result matters.

## Scenario 2 — The course is survivable

**Proves**: FR-089, SC-015, SC-016, and by extension FR-035.

```bash
npm run test:course
```

Runs the validator (rules CV-1 to CV-9 in
[contracts/course-data.md](contracts/course-data.md)) over both courses, then
simulates a base-speed no-trick run end to end.

**Expected**: every rule passes and the scripted cautious run reaches the finish.
CV-4 is the one to watch — it is the rule most likely to be broken by a course edit
and the one whose violation makes the game unfinishable for the least confident
players.

## Scenario 3 — One official run, whatever the device

**Proves**: FR-017, FR-018, FR-021, US2.

```bash
npm run test:e2e -- --grep "one official run"
```

Commits an official run in one browser context, then attempts another from a fresh
context, a private window, and after clearing site data.

**Expected**: all three see the committed score and are offered only free play. The
duplicate commit is rejected by the unique constraint, not by client logic — verify
by attempting the write directly against the API with the anon key.

## Scenario 4 — A score survives a dead connection

**Proves**: FR-046 to FR-049.

```bash
npm run test:e2e -- --grep "offline commit"
```

Drops the network before a run ends, reloads mid-retry, restores the network.

**Expected**: run completes fully offline; UI shows **pending** and never claims a
leaderboard place; the queued commit survives reload; it posts on reconnect. Also
asserts that no run count or claim is ever read back from the outbox.

## Scenario 5 — Abandonment is free and visible

**Proves**: FR-019, FR-065, FR-066, ADR-0002.

```bash
npm run test:e2e -- --grep "abandon"
```

Starts an official run and kills the context mid-descent.

**Expected**: nothing commits, the official run is still available, the abandonment
counter increments, and the new count is visible to a second viewer.

## Scenario 6 — Performance on reference hardware

**Proves**: FR-025, FR-031, SC-001, SC-009.

```bash
npm run test:perf
```

Headless Chromium at 4× CPU throttle, Fast 3G for load.

**Expected**: simulation step ≤ 2.0 ms; frame time ≤ 16.7 ms p95 with ≥ 50 fps
sustained; input-to-response ≤ 2 frames; payload ≤ 2 MB gzipped; interactive ≤ 5 s.
These are a proxy for a real phone, not a substitute — see Manual validation.

## Scenario 7 — Nothing crashes

**Proves**: FR-062, Principle II.

```bash
npm run test:monkey
```

Fuzzes randomised input sequences across thousands of seeds against `step()`.

**Expected**: no throw, no non-finite state value, no tick over the wall-clock
ceiling, every run reaching a terminal state or the tick limit.

## Scenario 8 — The deadline produces the bed order

**Proves**: FR-043 to FR-045, FR-037, FR-038, US4.

```bash
npm run test:e2e -- --grep "deadline"
```

Seeds a draft with committed scores, tied scores, and unplayed entries; advances
past the deadline.

**Expected**: FINAL label; official runs refused; ties broken by earlier
`commit_at`; unplayed entries below all scores, marked FORFEIT, **unordered**, with
the coin-flip instruction. Assert explicitly that no order is implied among
forfeits.

## Full suite

```bash
npm test
```

## Manual validation — required, not optional

Automated checks cannot close these. Definition of Done item 6 requires a human to
have played the result and recorded findings against the spec.

1. **Play a full run on a real mid-range phone.** CPU throttling approximates a
   phone; it does not reproduce thermal behaviour, touch latency, or how the game
   feels one-handed on a chairlift.
2. **Confirm the feel parameters.** The values in
   [contracts/tuning-data.md](contracts/tuning-data.md) are opening positions.
   Check AC-2 (a cautious run finishes in 45–75 s) and whether the tuck-to-launch
   coupling reads as obvious without instruction.
3. **Check FR-088 teaches itself.** Release under a low obstacle and confirm the
   wipeout reads as your own mistake rather than the game cheating. If it reads as
   unfair, `safeReleaseWindowMin` is the first value to move.
4. **Style-bible review.** Every asset cites the rule it satisfies (FR-052). The
   style bible must exist before assets are authored, not after.
5. **Record findings against the spec**, per Principle III and the playtest cadence
   requirement.
