# Data Model: A Coached First Run, and a Rope You Can See

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-09

Three entities. **None of them is simulation state**, and that is the load-bearing
property of this whole design: nothing here appears in `RunState`, nothing here is
hashed, and nothing here can change a score. The determinism argument in
[plan.md](./plan.md#determinism-argument) rests on it.

There is also, deliberately, **no persisted entity at all**. FR-186a forbids
recording whether a player has been coached, so this feature adds no database column,
no migration, and no browser-storage key.

---

## 1. Coached section (course data)

Not a new type. The coached section is the **opening 2,900 units of the existing
warm-up course**, expressed entirely in structures `Course` already has.

| Field           | Contribution                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terrain`       | Gradient 0.05 held to the join, then interpolated up to the warm-up's **0.26** (was 0.08 → 0.230 before the 2026-09-12 re-baseline; see R7 for the gradient, R4 for the join) |
| `obstacles`     | One `low` at clearance 15; one `solid` (deadfall)                                                                                                                             |
| `kickers`       | One small ramp; one booter                                                                                                                                                    |
| `length`        | Warm-up's 3,200 grows by the coached section's span                                                                                                                           |
| Everything else | Existing warm-up features, shifted right by the same span                                                                                                                     |

**Why no new type**: a coached section that the simulation could distinguish from
ordinary terrain would be a second kind of course, and every validator rule would
need to learn about it. Expressed as ordinary terrain, every CV rule applies
unchanged and the section is proven by the validator that already exists.

**Validation** — the section must satisfy the whole of `validateCourse`, and these
rules are the ones it is closest to:

| Rule  | Constraint                                                  | How this section satisfies it                                                                                                                                                        |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CV-1  | Terrain starts at x=0, x strictly increases, reaches finish | The coached section becomes the new x=0                                                                                                                                              |
| CV-2  | Gradient ≤ 1.732                                            | 0.05 is two orders inside it                                                                                                                                                         |
| CV-3  | `crouchHeight(9) < clearance < standHeight(16)`             | Rope at **15** — the most forgiving legal value (R3)                                                                                                                                 |
| CV-4  | 140 clear units after every low obstacle                    | 600 units of clear run to the deadfall                                                                                                                                               |
| CV-5  | Low obstacles ≥ 140 apart                                   | Only one low obstacle in the section                                                                                                                                                 |
| CV-7  | No `solid` overlapping a `low`                              | 600 units apart                                                                                                                                                                      |
| CV-10 | Adjacent segments within 0.42 rad                           | Join is **0.204 rad** (0.05 → the warm-up's 0.26), interpolated not stepped (R4)                                                                                                     |
| CV-11 | A `solid` must be jumpable, not trapped in a release window | Deadfall sits 600 past the rope, far outside its 140-unit window                                                                                                                     |
| CV-15 | Ramps need clear air and must not overlap deadfall          | 600 units clear either side of each kicker                                                                                                                                           |
| CV-23 | Gradient ≥ `slopeFriction * 3` = **0.036**                  | **0.05 clears it — the binding rule on this section.** Added by 006 after this table was written; at 006's pre-shipping friction the floor was 0.06 and 0.05 would have been illegal |

**CV-24** (nothing between a shelf's end and one lookahead past a jumped lip) does not
bind: the coached section carries no ledge. It binds on the warm-up features _after_
the join, which are shifted wholesale rather than re-authored, so the relation between
the warm-up's shelf and what follows it is preserved by construction. The validator
will say so either way.

**State transitions**: none. Course data is static, loaded once, never mutated.

---

## 2. Coaching cue (render-owned, pure)

A static table of world-x intervals, each carrying one instruction.

```
Cue {
  id:     'crouch' | 'jump' | 'stayCrouched' | 'flip'
  from:   number   // world x at which the cue becomes legible
  to:     number   // world x at which it clears — its object is now behind
  text:   string   // fixed verbatim copy, FR-190
}
```

| id             | text                    | Object     | `from`                        |
| -------------- | ----------------------- | ---------- | ----------------------------- |
| `crouch`       | `HOLD TO CROUCH!`       | rope       | `object.x − PLAYER_LOOKAHEAD` |
| `jump`         | `RELEASE TO JUMP!`      | deadfall   | `object.x − PLAYER_LOOKAHEAD` |
| `stayCrouched` | `STAY CROUCHED!`        | small ramp | `object.x − PLAYER_LOOKAHEAD` |
| `flip`         | `SWIPE OR ← → TO FLIP!` | booter     | `object.x − PLAYER_LOOKAHEAD` |

`PLAYER_LOOKAHEAD` is 213.333, from `src/render/stage.ts`. A cue becomes legible
exactly when its object crests the frame edge — FR-191 as approved.

> **This table read `Lead 389` for all four cues until 2026-09-12.** R2 measured that
> lead when speed was pinned to `baseSpeed`; feature 006 made gradient the speed
> control, and R7 option C withdrew the lead rather than keep a mechanism nothing now
> needs. Recorded rather than deleted, so it is not reintroduced from the historical
> findings. See [research R7](./research.md#r7--what-feature-006-did-to-r1-and-r2).

**Invariants**, each asserted in `tests/unit/coaching-cue.test.ts`:

1. **Intervals never overlap.** `cueAt(x)` returns at most one cue, which is FR-191's
   one-at-a-time clause enforced by the data shape rather than by the caller.
2. **Every `from` is its object's x minus `PLAYER_LOOKAHEAD`.** The cue becomes
   legible exactly when its object becomes visible, which is FR-191 as approved. The
   test asserts the arithmetic against the generated course data, so moving an object
   without moving its cue fails the build rather than shortening a cue in silence.
3. **`to` is at or past its object's trailing edge.** A cue never clears while the
   thing it describes is still ahead of the player.
4. **Copy is exact.** The four strings are compared literally, including the arrow
   glyphs, so no well-meaning edit can drift the maintainer's wording.
5. **Every cue lies inside the coached section**, so none can fire on warm-up terrain.

**Purity**: `cueAt` is a total function of one number. It reads no clock, no state, no
storage, and holds nothing between calls — which is what lets the whole cue system be
tested without a canvas or a browser.

**State transitions**: the _caller_ derives an edge by comparing `cueAt(prev.x)` with
`cueAt(next.x)` on each tick. Four transitions exist and all are handled by the same
comparison:

```
null   -> Cue    show
Cue    -> null   hide
Cue A  -> Cue B  hide A, show B      (cannot occur with the layout above; asserted anyway)
same   -> same   no-op
```

---

## 3. Boundary rope (drawn geometry)

Not stored anywhere. It is the _depiction_ of a `low` obstacle, derived per frame
from data the game already holds.

**Derivation** — given an obstacle `o` and terrain height `ground` at each x:

| Quantity     | Value                                    | Source                    |
| ------------ | ---------------------------------------- | ------------------------- |
| Slab bottom  | `ground − o.clearance`                   | `step.ts:207` (collision) |
| Slab top     | `slab bottom − tuning.branchThickness`   | `step.ts:208` (collision) |
| Span         | `[o.x, o.x + o.width)`                   | half-open, as everywhere  |
| Cord band    | top ~4 units of the slab                 | this feature              |
| Pennant band | remaining ~14 units, down to slab bottom | this feature              |

**The contract** (FR-200): the lowest mark drawn anywhere in the object equals the
slab bottom, flat across the full span. The pennant tips _are_ the collision floor.
Sag from the reference image is drawn inside the cord band only — above the tips —
so the silhouette never dips below the line that kills.

**Palette** (FR-202): `magenta` cord over a `purple` core, pennants alternating
`magenta`, `cyan`, `blue`, and an `orange` edge along the tips for TR-3. All eight
tokens already exist. No ninth colour.

**Frozen inputs**: `tuning.branchThickness` = 18 and `o.clearance` are read, never
written. FR-196 forbids changing either, so the rope is designed to the 18 units it
already has rather than asking for more.

---

## What this feature deliberately does not model

| Not modelled                         | Why                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| "Has this player been coached?"      | FR-186a — every practice run is identical, so there is nothing to remember      |
| A coached-section flag on the course | The section is ordinary terrain; a flag would make the validator learn about it |
| Cue state in `RunState`              | It is a pure function of `x`; carrying it would put render data in the hash     |
| A separate coached course file       | FR-186 requires one continuous run with nothing to load between halves          |
| Wipeout handling inside the section  | FR-192a — a wipeout there is an ordinary wipeout, with no special case          |
