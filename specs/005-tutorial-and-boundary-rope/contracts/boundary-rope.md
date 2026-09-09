# Contract: The Boundary Rope

**Feature**: 005 | **Requirements**: FR-198 → FR-205 | **Style bible**: TR-2, TR-3, L-0, P-5

The `low` obstacle's depiction changes from an overhanging bough to a ski boundary
rope. **Nothing else changes.** This document is the contract between what the player
sees and what the simulation does, and its central clause is that the two cannot
disagree.

---

## The collision slab is given, not chosen

`src/sim/step.ts:206-210` already defines the object's geometry. The renderer is a
consumer of it:

```
bottom = terrainYAt(terrain, x) − obstacle.clearance
top    = bottom − tuning.branchThickness          // 18
span   = [obstacle.x, obstacle.x + obstacle.width)   // half-open
```

Passing under requires the skier's head to be below `bottom`. Passing over requires
his feet to be above `top`. Both remain true across this change, byte for byte.

**Frozen**: `tuning.branchThickness` (18) and every `clearance` in both course files.
FR-196 forbids moving them, so the rope is designed to the 18 units it already has.

---

## The drawing contract

| #   | Clause                                                                                | Requirement  |
| --- | ------------------------------------------------------------------------------------- | ------------ |
| 1   | The lowest mark drawn equals `bottom`, **flat across the full span**                  | FR-200       |
| 2   | No mark falls below `bottom` or above `top` — the drawing fits the slab exactly       | FR-200       |
| 3   | Every `low` obstacle on every course is drawn this way; no course shows both idioms   | FR-198       |
| 4   | The object is a twisted cord carrying triangular pennants hanging point-down          | FR-199       |
| 5   | Only the eight existing palette tokens appear                                         | FR-202       |
| 6   | `orange` marks the killing edge — the pennant tips — never a fill over the silhouette | FR-203, TR-3 |
| 7   | Nothing in the backdrop is drawn in the cord's colours at the cord's scale            | FR-201       |
| 8   | The drawing reads from state no deeper than camera and tick                           | TR-7         |

### Clause 1 is the whole point

TR-2's existing contract — _"the shape the player sees IS the shape he has to get
under"_ — is inherited verbatim. It is satisfied structurally rather than carefully:
the pennants hang **to** the slab bottom because that is the only place the geometry
lets them end.

The sag in the supplied reference is drawn **inside the cord band**, above the pennant
tips. A sag that carried the tips down with it would make the lowest visible mark vary
across the span, and a player would judge his duck against a silhouette that is lower
in the middle than the thing that actually kills him. That is precisely the misread
this feature exists to remove.

---

## Composition

| Band     | Extent              | Content                                                     |
| -------- | ------------------- | ----------------------------------------------------------- |
| Cord     | top ~4 of 18 units  | `magenta` twist over a `purple` core; sag lives here only   |
| Pennants | remaining ~14 units | Triangles point-down, alternating `magenta`, `cyan`, `blue` |
| Tips     | at `bottom`, flat   | `orange` edge — the surface that kills (TR-3)               |

Exact band split is the implementer's, subject to clauses 1 and 2. The 18-unit total
is not negotiable.

---

## Why this reads where the bough did not

Rule TR-1 fills the frame with five ranks of pine. The bough was a tree in a forest of
trees — the same vocabulary, the same greens and darks, at the same scale. The rope
answers with three separations, any one of which would help and which together make
the object unmistakable:

1. **Vocabulary** — no forest contains a rope. There is nothing for it to be confused
   with, at any distance.
2. **Palette** — `magenta` and `cyan` are the _player's_ colours in this game, not the
   backdrop's. FR-201's test is a scan for backdrop marks in those colours at that
   scale, so this separation is asserted rather than asserted-to-be-obvious.
3. **Geometry** — a horizontal line with regular vertical teeth is a shape the pine
   ranks never make.

P-5 is satisfied without relying on any one of them: the rope differs from a tree in
hue, in silhouette, and in kind.

---

## Style bible amendment (FR-205)

TR-2 and TR-3 currently describe the bough and must be rewritten in the same change
set. Principle IV makes the bible the single source of truth and Principle I makes a
document that disagrees with shipped behaviour a defect, so leaving them is not an
option.

- **TR-2** — the `low` obstacle becomes a boundary rope: a twisted cord with pennants
  hanging to the collision floor. The clause that must survive verbatim is the
  contract: the shape the player sees is the shape he has to get under. `solid`
  obstacles are untouched and stay deadfall.
- **TR-3** — the `orange` killing edge moves from "the underside of a bough" to "the
  tips of the pennants". The rule itself — an edge on the surface that kills, never a
  fill over the whole silhouette — is unchanged.
- **TR-9** is checked but expected to stand: it contrasts rocks with deadfall, and
  neither moves.
- **CV-14** in `src/course/validate.ts` refers to boughs in prose ("a shelf must clear
  every bough beneath it"). The rule is about clearance and is unaffected; only its
  wording needs to follow the bible.

---

## Verification

| Claim                         | How                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| Clauses 1 and 2               | `tests/unit/rope-geometry.test.ts` — lowest mark == `bottom` over a range of clearances and widths |
| Clause 5                      | `tests/unit/palette.test.ts`, extended to the rope's marks                                         |
| Clause 3                      | Grep-style assertion that no bough draw path survives                                              |
| Simulation unchanged (FR-204) | `tests/sim/golden.test.ts` — official-course goldens must **not** move                             |
| Reads at distance (FR-201)    | The human play pass. Principle VIII: the pilots hold no opinion on this                            |
