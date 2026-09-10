# Quickstart: Verifying Slope-Driven Speed

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-10

---

## Prerequisites

```bash
npm ci
```

---

## 1. Prove the model does what it claims

```bash
npx vitest run tests/sim/slope-response.test.ts
```

**Expect**:

- **Monotonic** (FR-215) — terminal speed rises with gradient across the whole legal
  range, standing and tucked, with no inversion or plateau.
- **Spread** (FR-216) — gentlest to steepest exceeds 2×. Measured at 2.96×.
- **Anchor** (R2) — gradient 0.30 gives 2.60 standing and 4.20 tucked, to tolerance.
  This is the assertion that stops a hand-edited drag constant silently re-feeling the
  middle of both courses.
- **Stable** (FR-222) — from a standstill at gradients 0.30, 0.644, 1.0 and 1.732,
  speed settles on terminal over 400 ticks with no oscillation and no overshoot.
- **Tuck lowers drag** (FR-217) — tucked terminal exceeds standing terminal at every
  gradient, and the ratio is constant.

## 2. Prove the arithmetic is legal

```bash
npm run lint
```

The existing `no-restricted-properties` rules fail the build on `Math.sin`, `cos`,
`pow`, `exp`, `log` and `sqrt` inside simulation code. FR-218 needs no new gate — if
the model had been expressed in angles this would already be red.

## 3. Prove no course can strand a player

```bash
npm run test:course
```

**Expect** CV-19 present and both courses passing it. The shallowest gradient on
either course is 0.200 against a threshold near 0.02, so this is a guard for future
authoring — feature 005's coached section at 0.08 included.

To see it bite, temporarily add a near-flat segment to a scratch course and confirm
CV-19 rejects it. A rule that has never fired is untested (Principle VI).

## 4. Re-tune the kickers and re-certify the shelves

```bash
npm run gen:courses
npm run test:course
```

**Expect** CV-13 passing for every shelf. This is the largest piece of work in the
feature and it can fail in **both** directions:

- A **weakened** kicker no longer reaches its shelf. R6 measured three of five at −19%.
- A **strengthened** kicker makes a shelf reachable without its ramp, which CV-13
  forbids — the ramp is the entry fee. The kicker at x=5200 is +34%.

R6's table is the starting point, not the answer.

## 5. Re-baseline the goldens, deliberately

```bash
npm run test:sim
```

**Every golden must move.** This is the opposite of feature 005, where the official
course goldens _not_ moving was the assertion. Here a golden that did **not** move
means the physics never reached that path — investigate rather than accept it.

Re-baseline as a reviewable diff, not an `--update` run.

## 6. Prove determinism survives

```bash
npm run test:determinism
```

Three engines, identical hashes. The model uses only `+ − * /` over `slopeAt`'s exact
unit vector, so this should pass unchanged — but it is the check that would catch an
accidental `Math.` call that lint somehow missed.

## 7. Ride it (Principle VIII — binding)

```bash
npm run build:artifact
```

Publish it, and **name the link and the commit**. This is a pure feel change; there is
nothing here a test can settle.

**The questions to actually answer**:

1. **The tuck.** 90% of the speed gain now arrives at 60 ticks against today's 30
   (R4). Does holding a tuck to clear a deadfall under pressure still feel
   responsive, or does it feel like the game stopped listening? This is the single
   biggest risk in the feature. If it feels wrong, FR-221 makes it a named tuning
   value that moves without a code change.
2. **The steep pitch before the big kicker at x=5200.** It is the case the request
   named. Does it now throw you the way it looks like it should?
3. **The gentle run-out at x=7852.** It is 19% weaker. Does it still clear its shelf,
   and does slowing down there read as the mountain easing off or as the game bogging
   down?
4. **Does the mountain read?** Can you tell, without instrumentation, which of two
   stretches is steeper purely by how fast you are going (SC-074)?

Record findings against [spec.md](./spec.md) **in the player's own words** before
touching any of these values again.

## 8. The reset — before the deploy, not after

FR-229 and FR-230. The organizer accepted that committed scores are destroyed; that
acceptance is not the same as the players knowing.

```bash
npm run db:migrate          # whatever the reset procedure resolves to
```

**Order matters and is not negotiable**:

1. Tell the players their scores are being reset and their official run returned.
2. Deploy.
3. Reset the draft.

Reversing 1 and 3 means eight people discover that a run they were told was
irreversible was quietly taken back. The reset procedure itself must be executed
verbatim in CI with its output asserted (Principle VII) — a README paragraph is not a
deliverable.

---

## Full gate

```bash
npm run lint && npm run build && npm run test && npm run test:build
```

Green, plus a recorded play pass, plus the players told — that is Done for this
feature.
