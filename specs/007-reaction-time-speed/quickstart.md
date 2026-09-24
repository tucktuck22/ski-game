# Quickstart: Verifying Time to See the Box

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-24

---

## Prerequisites

```bash
npm ci
```

For the play-pass build (§6) you also need the real sprite images, not Git LFS pointer
files. Check before building:

```bash
head -c 8 public/sprites/skier.png | od -An -c   # expect: 211   P   N   G  \r  \n 032  \n
```

If it prints `version https://git-lfs...`, fetch the objects first
([research § R8](./research.md#r8--the-play-pass-build-needs-the-real-sprite-fr-240)).

---

## 1. The course is generated, not edited

```bash
node --experimental-strip-types tools/gen-courses.ts
git diff --stat data/courses/
```

**Expect**: running the generator twice gives no further diff. `warmup.json` changes
only in `rulesVersion`.

## 2. The course is legal and the physics did not move

```bash
npx vitest run tests/course tests/unit/tuning-frozen.test.ts tests/unit/scoring-dominance.test.ts
```

**Expect**:

- Every CV rule passes on both courses (FR-234).
- `data/tuning.json` is byte-identical to its committed version (FR-232).
- An official course that moved without a `rulesVersion` bump fails (R7).
- Every finisher still outranks every non-finisher (FR-238).

## 3. Every box leaves 680 ms

```bash
npx vitest run tests/sim/reaction-budget.test.ts
```

**Expect**: assertions B1–B9 of
[contracts/reaction-budget.md](./contracts/reaction-budget.md) pass. A failure names the
box, the measured milliseconds and the arrival speed. Four boxes pass by a single
16.7 ms tick, so a failure after any course edit is likely, and it is a real failure,
not noise.

## 4. The jumps did not move

```bash
npx vitest run tests/sim/booters.test.ts tests/sim/tracks.test.ts tests/sim/base-jump.test.ts
```

**Expect**: unchanged and green, especially _"pays five rotations off the small booter
and six off the big one"_. This test has zero margin
([research § R5](./research.md#r5--the-booter-rotation-test-is-a-zero-margin-instrument)):
**re-run it after every edit to `OFFICIAL_GRADE`.**

## 5. The camera keeps its promises

```bash
npx vitest run tests/unit/camera-framing.test.ts tests/unit/sim-isolation.test.ts
npm run test:determinism
```

**Expect**: C1–C7 of [contracts/camera-framing.md](./contracts/camera-framing.md). The
determinism goldens are unchanged in all three engines, because the camera is drawing
only.

## 6. The whole gate, then the play pass

```bash
npm run lint && npx tsc --noEmit && npm test
npm run test:build
npm run build:artifact
```

`npm run test:build` drives the built artifact at `/ski-game/` in a real browser.
`build:artifact` produces the single file for the play pass. Publish it and name the
link and commit (FR-240). The play pass asks the maintainer:

1. On the official course, first ride of this build: **did you react to every box, or
   anticipate it?** (SC-082)
2. **Do the steeps still feel fast?** Especially the Cornice run-in (4,700–5,200) and
   both booters. (SC-085)
3. **Does the eased ground before a box read as part of the mountain, or as a speed
   bump?** The Narrows is now eased throughout rather than stepped. (SC-085)
4. **Does the camera read naturally on the steeps, or does it feel like it drops
   away?** (FR-242)

Record the answers in the maintainer's own words in `spec.md` before any further value
moves (Principle VIII).
