# Data Model: Speed Comes From the Mountain

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-10

This feature adds **no entity, no table, no persisted field and no state**. It changes
the arithmetic that produces one existing number. That is the whole of its data
footprint, and it is worth stating plainly because the feature's risk is entirely in
its consequences rather than in its shape.

---

## 1. Tuning values (data file)

`data/tuning.json`. Five keys retired, five added.

| Retired            | Was   | Why it goes                                                       |
| ------------------ | ----- | ----------------------------------------------------------------- |
| `baseSpeed`        | 2.6   | There is no base speed. The mountain sets the speed               |
| `tuckSpeedMax`     | 4.2   | There is no target to cap. Terminal velocity is emergent          |
| `tuckAccel`        | 0.055 | Approach rate is set by drag and the speed gap, not by a constant |
| `tuckDecel`        | 0.09  | As above, in the other direction                                  |
| `slopeAccelFactor` | 0.04  | The slope term is now the whole model, not a nudge added to it    |

| Added           | Value   | Tolerance | Meaning                                           |
| --------------- | ------- | --------- | ------------------------------------------------- |
| `slopeFriction` | 0.02    | ±0.01     | Snow friction as a fraction of slope-normal force |
| `dragStanding`  | 0.01270 | derived   | Drag upright — **solved**, not chosen (R2)        |
| `dragTucked`    | 0.00487 | derived   | Drag tucked. 38% of standing                      |
| `speedMin`      | 0.80    | ±0.3      | Floor, so nobody is stranded (FR-219)             |
| `speedMax`      | 7.00    | ±1.0      | Safety rail above the steepest terminal (5.87)    |

**`dragStanding` and `dragTucked` are derived, not authored.** They are whatever makes
gradient 0.30 produce exactly today's 2.60 and 4.20. Editing either by hand moves the
anchor and silently changes how the middle of both courses feels. A test asserts the
anchor rather than the constants, so an edit that breaks it fails loudly.

**Validation** (`src/data/load.ts`): all five must be finite and positive;
`dragTucked < dragStanding` (a tuck cannot increase drag); `speedMin < speedMax`.

---

## 2. Terminal velocity (emergent, not stored)

Not a field. The speed at which gravity, friction and drag balance on a given
gradient. It is what the player experiences as "this pitch is worth about this much
speed", and it exists nowhere in the code.

Recorded here because it is the concept the feature is _about_, and because the tests
assert it — computed in the test as `sqrt(gravity × (uy − friction × ux) / drag)`,
which is legal in a test and would not be legal in simulation code.

| Gradient         | Standing | Tucked   |
| ---------------- | -------- | -------- |
| 0.08             | 1.23     | 1.98     |
| 0.20             | 2.11     | 3.41     |
| 0.30             | **2.60** | **4.20** |
| 0.52             | 3.34     | 5.40     |
| 0.64             | 3.64     | 5.87     |
| 1.732 (CV-2 max) | 4.65     | —        |

---

## 3. Course data (regenerated)

No schema change. Values move.

| Field             | Change                                                           |
| ----------------- | ---------------------------------------------------------------- |
| `kickers[].power` | Re-tuned per kicker against the gradient it sits on (FR-224)     |
| `rulesVersion`    | Bumped on the official course. **This is what resets the draft** |
| `terrain`         | Unchanged unless CV-19 or CV-13 re-certification forces a change |
| everything else   | Unchanged                                                        |

---

## 4. What is deliberately not modelled

| Not modelled                               | Why                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| A per-course or per-section speed override | Two speed rules is how the determinism argument stops being one sentence        |
| Terminal velocity as a stored field        | It is a function of gradient and drag; storing it is a second place to be wrong |
| Momentum or mass                           | The model is per-unit-mass; mass cancels in every term                          |
| A separate tuck acceleration constant      | Held in reserve for the playtest only (R4), and only as a named tuning value    |
| Anything about the draft reset             | An operator procedure (FR-229), not application state                           |

---

## 5. The stored value this feature actually moves

`rules_version`, on the `draft` row and on every `score` row.

This is the feature's only persistent effect and its entire risk. The database trigger
compares a submitted `rulesVersion` against the draft's frozen one and refuses any
mismatch. Bumping it means:

- Every committed score was posted under rules that no longer exist.
- Every subsequent official run is refused until the draft is reset.
- `resetDraft` destroys the committed scores, returning each player's official run.

The organizer has accepted this (see
[the reset decision](./spec.md#the-draft-reset-decision)). FR-229 makes the reset a
tested procedure and FR-230 requires players be told before it happens, not after.
