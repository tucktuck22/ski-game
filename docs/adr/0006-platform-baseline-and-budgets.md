# 6. Evergreen mobile web, hand-written simulation, mid-range phone as reference

**Status**: Accepted
**Date**: 2026-09-01
**Deciders**: tucktuck22
**Relates to**: constitution `TODO(TARGET_PLATFORM_BASELINE)`;
[research.md](../../specs/001-shredpocalypse-bed-draft/research.md) R1–R3, R6

## Context

The constitution deferred engine, target platforms, and reference hardware, with an
instruction: fix them during the first `/speckit-plan` and record them as a MINOR
amendment. Every numeric budget in the Technical Standards section was waiting on
this, and so was the first line of code.

The product decides those choices more than taste does. It is a link dropped into a
group chat that must be playable in under a minute, on whatever eight friends have
in their pockets, on lodge wifi. And the leaderboard is the bed order, so the
simulation must produce identical results on every one of those devices.

## Decision

**Platform**: the evergreen mobile web — Safari on iOS 16+, Chromium and Firefox on
Android 10+, and the same engines on desktop. No install, no app store, no native
build.

**Engine**: none. PixiJS v8 for rendering only; the simulation, physics, and game
loop are written directly. Determinism is the reason: game frameworks bring float
based solvers and iteration orders that are not built to be bit-identical across
engines, and a skier on a piecewise-linear height profile is not a rigid-body
problem.

**Reference hardware**: a 2022-era mid-range phone — Pixel 6a / Galaxy A54 / iPhone
SE 3rd gen class — approximated in CI by headless Chromium at 4× CPU throttle with
Fast 3G for load measurement.

**Budgets**: simulation step ≤ 2.0 ms per 60 Hz tick; frame time ≤ 16.7 ms p95 with
≥ 50 fps sustained; input-to-visible-response ≤ 2 simulation frames; initial payload
≤ 2 MB gzipped; interactive ≤ 5 s on Fast 3G; peak JS heap ≤ 150 MB.

**Arithmetic**: IEEE-754 float64 restricted to `+`, `-`, `*`, `/`, enforced by lint
in `src/sim/**` and proved by a golden-run test asserted on all three engines.

## Consequences

The 60-second promise in SC-001 becomes achievable. Unity and Godot web exports were
both rejected on payload alone — they spend the entire budget before any game code
exists.

Choosing the phone as reference rather than desktop makes SC-006's parity
requirement a design constraint instead of a hope. It also drove the fixed
320 × 180 render buffer, which turns out to serve the aesthetic and the frame budget
and the parity requirement at once.

Writing the physics by hand is more work than adopting a library and is the right
trade only because of determinism. If bit-identical replay ever stops mattering,
this decision should be revisited rather than defended.

CPU throttling is a proxy. It catches regressions and order-of-magnitude mistakes;
it does not reproduce thermal throttling, touch latency, or how the game feels
one-handed. The human playtest that Definition of Done item 6 requires is not
optional and is not replaced by any of these numbers.

The budgets are now binding. A change that regresses frame time past the budget is a
merge blocker under Principle II, which is the point of writing them down.

## Amendment applied

Constitution **1.0.0 → 1.1.0** (MINOR — an existing section is materially
expanded). Unlike [ADR-0005](0005-trust-the-players.md), which is still Proposed
and awaits approval, this amendment was applied directly: the constitution itself
instructed that it happen during the first `/speckit-plan` and pre-specified the
version bump, so the standing instruction is the approval.
