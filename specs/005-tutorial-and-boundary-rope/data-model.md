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

| Field           | Contribution                                                                |
| --------------- | --------------------------------------------------------------------------- |
| `terrain`       | Gradient 0.08 held to the join, then interpolated up to the warm-up's 0.230 |
| `obstacles`     | One `low` at clearance 15; one `solid` (deadfall)                           |
| `kickers`       | One small ramp; one booter                                                  |
| `length`        | Warm-up's 3,200 grows by the coached section's span                         |
| Everything else | Existing warm-up features, shifted right by the same span                   |

**Why no new type**: a coached section that the simulation could distinguish from
ordinary terrain would be a second kind of course, and every validator rule would
need to learn about it. Expressed as ordinary terrain, all eighteen CV rules apply
unchanged and the section is proven by the validator that already exists.

**Validation** — the section must satisfy the whole of `validateCourse`, and these
rules are the ones it is closest to:

| Rule  | Constraint                                                  | How this section satisfies it                                    |
| ----- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| CV-1  | Terrain starts at x=0, x strictly increases, reaches finish | The coached section becomes the new x=0                          |
| CV-2  | Gradient ≤ 1.732                                            | 0.08 is two orders inside it                                     |
| CV-3  | `crouchHeight(9) < clearance < standHeight(16)`             | Rope at **15** — the most forgiving legal value (R3)             |
| CV-4  | 140 clear units after every low obstacle                    | 600 units of clear run to the deadfall                           |
| CV-5  | Low obstacles ≥ 140 apart                                   | Only one low obstacle in the section                             |
| CV-7  | No `solid` overlapping a `low`                              | 600 units apart                                                  |
| CV-10 | Adjacent segments within 0.42 rad                           | Join is 0.146 rad, and interpolated rather than stepped (R4)     |
| CV-11 | A `solid` must be jumpable, not trapped in a release window | Deadfall sits 600 past the rope, far outside its 140-unit window |
| CV-15 | Ramps need clear air and must not overlap deadfall          | 600 units clear either side of each kicker                       |

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

| id             | text                    | Object     | Lead (`object.x − from`) |
| -------------- | ----------------------- | ---------- | ------------------------ |
| `crouch`       | `HOLD TO CROUCH!`       | rope       | 389                      |
| `jump`         | `RELEASE TO JUMP!`      | deadfall   | 389                      |
| `stayCrouched` | `STAY CROUCHED!`        | small ramp | 389                      |
| `flip`         | `SWIPE OR ← → TO FLIP!` | booter     | 389                      |

**Invariants**, each asserted in `tests/unit/coaching-cue.test.ts`:

1. **Intervals never overlap.** `cueAt(x)` returns at most one cue, which is FR-191's
   one-at-a-time clause enforced by the data shape rather than by the caller.
2. **Lead is 389 units for every cue.** Derived from R2's measurement of 2.5 s at
   base speed, not chosen. The test asserts the arithmetic against the course data so
   a moved object cannot silently shorten a cue.
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
