# Contract: Slope Response

**Feature**: 006 | **Requirements**: FR-214 → FR-222 | **Constitution**: simulation arithmetic

The one function this feature changes, and the guarantees it must hold.

---

## `applyGroundedMotion(state, course, tuning)`

**Before** — accelerate toward a fixed target, then clamp:

```
target = crouchHeld ? tuckSpeedMax : baseSpeed
next   = approach(speed, target, rate) + slopeAccelFactor * uy
next   = clamp(next, baseSpeed, tuckSpeedMax)
```

**After** — gravity against friction and drag:

```
slope = slopeAt(terrain, x)                       // ux = cosθ, uy = sinθ, exact unit vector
drag  = crouchHeld ? dragTucked : dragStanding
accel = gravity * (slope.uy - slopeFriction * slope.ux) - drag * speed * speed
speed = clamp(speed + accel, speedMin, speedMax)
state.vx = speed * slope.ux
state.vy = speed * slope.uy
state.ox = slope.ux
state.oy = slope.uy
```

### Guarantees

| #   | Guarantee                                                                                          | Requirement |
| --- | -------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Speed is produced by gravity opposed by friction and quadratic drag, never by approaching a target | FR-214      |
| 2   | Terminal speed rises monotonically with gradient across `[0, 1.732]`                               | FR-215      |
| 3   | Spread between the gentlest and steepest legal gradient exceeds 2×                                 | FR-216      |
| 4   | Tucking lowers drag. It does not raise a target or add thrust                                      | FR-217      |
| 5   | Only `+`, `−`, `*`, `/` over values already held. No `Math.sin`/`cos`/`pow`/`exp`                  | FR-218      |
| 6   | Speed stays within `[speedMin, speedMax]`                                                          | FR-219      |
| 7   | Stable from a standstill at every legal gradient — settles, never oscillates or overshoots         | FR-222      |
| 8   | The function writes only `vx`, `vy`, `ox`, `oy`. It reads no clock and no storage                  | II          |

### Why the arithmetic rule is satisfied structurally

`slopeAt` computes the unit downhill vector using `sqrtDet`, the repository's own
deterministic square root. So `uy` **is** sin θ and `ux` **is** cos θ, already exact,
already deterministic, and already used by the existing code. Expressing the model in
angles would have required `Math.sin` and been rejected by lint. Expressing it in the
unit vector requires nothing new.

This is a property of the design, not a coding convention to be remembered — the
values are the only ones available.

---

## `resolveLanding` — the clamp only

The landing path already scrubs airborne velocity onto the slope and clamps it. The
bounds change; the behaviour must not:

```
along   = vx * slope.ux + vy * slope.uy
settled = clamp(along, speedMin, speedMax)        // was clamp(along, baseSpeed, tuckSpeedMax)
```

| #   | Guarantee                                                                  | Requirement   |
| --- | -------------------------------------------------------------------------- | ------------- |
| 1   | Landing still scrubs to the slope and never adds speed                     | II (existing) |
| 2   | The clamp uses the new bounds and reintroduces no target speed             | FR-214        |
| 3   | A landing at the bottom of a steep pitch keeps the speed that pitch earned | FR-215        |

Guarantee 3 is the substantive change. Today a fast landing is clamped to 4.2; under
this feature it keeps up to `speedMax`, which is what makes a steep run-in pay off
through a launch rather than being confiscated at touchdown.

---

## Tuning contract

| Key             | Value      | Meaning                                                |
| --------------- | ---------- | ------------------------------------------------------ |
| `slopeFriction` | 0.02       | Snow friction, as a fraction of the slope-normal force |
| `dragStanding`  | 0.01270    | Drag coefficient upright                               |
| `dragTucked`    | 0.00487    | Drag coefficient tucked — 38% of standing              |
| `speedMin`      | see FR-219 | Floor. Nobody is ever stranded                         |
| `speedMax`      | see FR-219 | Safety rail, not the mechanism                         |

**Retired and deleted, not left unread**: `baseSpeed`, `tuckSpeedMax`, `tuckAccel`,
`tuckDecel`, `slopeAccelFactor` (FR-226).

The two drag values are **solved, not chosen**: they are whatever makes gradient 0.30
produce exactly today's 2.60 and 4.20. If either is edited by hand, the anchor moves
and the middle of both courses changes feel — so the derivation is recorded in
[research.md](../research.md) R2 and asserted by test rather than trusted.

---

## `CV-19` — the stall rule (FR-220)

```
for each terrain segment:
    if gradient <= slopeFriction * STALL_MARGIN:  violation
```

| #   | Guarantee                                                                              | Requirement |
| --- | -------------------------------------------------------------------------------------- | ----------- |
| 1   | No course may contain a segment too shallow to overcome friction with margin           | FR-220      |
| 2   | The rule is expressed against `slopeFriction`, so re-tuning friction re-tunes the rule | FR-220      |
| 3   | Both existing courses pass — shallowest is 0.200 against a 0.02 threshold              | FR-225      |

A runtime floor alone would convert a hard failure into a silent crawl through a
section the designer believed was rideable. CV-4 already makes this argument about
release windows: the validator prevents, the floor only survives.

---

## Verification

| Claim                                    | How                                                                |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Monotonicity and spread (FR-215, FR-216) | `tests/sim/slope-response.test.ts` sweeps the legal gradient range |
| Stability (FR-222)                       | Same file, 400 ticks from standstill at 0.30, 0.644, 1.0 and 1.732 |
| Anchor holds (R2)                        | Terminal at gradient 0.30 equals 2.60 / 4.20 to within a tolerance |
| Arithmetic rule (FR-218)                 | Existing lint rules; they already fail the build on `Math.sin`     |
| Determinism (SC-079)                     | Existing three-engine determinism spec, re-baselined               |
| Feel (SC-078)                            | The human play pass. Principle VIII — no measurement substitutes   |
