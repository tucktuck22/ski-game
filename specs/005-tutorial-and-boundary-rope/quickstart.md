# Quickstart: Verifying a Coached First Run and the Boundary Rope

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-09

How to run this feature and prove it works. Every command below is real and runnable
from the repository root. Nothing here is implementation — see
[data-model.md](./data-model.md) and [contracts/](./contracts/) for the shapes.

---

## Prerequisites

```bash
npm ci
```

No Supabase configuration is needed. The whole feature lives on the practice run,
which a clearly-labelled local session serves without any shared storage.

---

## 1. Regenerate the course, and prove it is legal

The coached section is authored in the generator, not typed into JSON (research R4).

```bash
npm run gen:courses          # rewrites data/courses/warmup.json
npm run test:course          # every CV rule over both courses
```

**Expect**: `gen:courses` exits clean, and `test:course` passes with zero violations.

The rules most likely to catch a mistake here, and what they are protecting:

| Rule  | Catches                                                              |
| ----- | -------------------------------------------------------------------- |
| CV-3  | A rope clearance outside `(9, 16)` — the coached rope must be **15** |
| CV-4  | Nowhere to stand up after the rope                                   |
| CV-10 | A kink at the join to the warm-up course                             |
| CV-11 | Deadfall placed inside the rope's release window                     |
| CV-15 | A ramp overlapping deadfall, or with no clear air                    |

**If CV-10 fires**, the join gradient stepped instead of interpolating. R4 measured
0.08 → 0.230 at 0.146 rad against a 0.42 tolerance, so a failure here means the
gradient programme, not the tolerance.

---

## 2. Prove the simulation did not move

This is FR-204 and SC-067, and it is the check that lets this ship into a live draft.

```bash
npm run test:sim             # goldens, determinism, monkey fuzz
npm run test:unit            # includes the frozen-data assertions
```

**Expect**:

- **Official-course goldens are unchanged.** If `tests/sim/golden.test.ts` reports a
  moved official-course hash, stop — something reached the simulation and FR-196 is
  broken.
- **Warm-up goldens are re-baselined, deliberately and once.** Its geometry genuinely
  changed. The re-baseline is a reviewable diff, not a `--update` run.
- `tests/unit/tuning-frozen.test.ts` passes: `data/tuning.json` and
  `data/courses/official.json` are byte-identical to their committed versions.

---

## 3. Prove the picture and the collision agree

```bash
npx vitest run tests/unit/rope-geometry.test.ts
```

**Expect**: for every clearance in the legal range and a spread of widths, the lowest
mark the rope emits equals `terrainY − clearance`, flat across the full span, and no
mark falls outside the 18-unit slab.

This is FR-200 — the clause that stops a player judging his duck against a silhouette
that disagrees with what kills him.

---

## 4. Prove the cues fire where they should

```bash
npx vitest run tests/unit/coaching-cue.test.ts tests/unit/coaching-badge.test.ts
```

**Expect**:

- Each cue is bound to **its object's visibility** — FR-191 as approved — asserted
  against the generated course data, so moving an object without moving its cue fails
  the build. _(Re-baselined 2026-09-12: this read "exactly 389 units before its
  object", which was R2's lead-distance workaround. Feature 006 shipped and doubled
  the reading time; the lead is withdrawn. See
  [research R7](./research.md#r7--what-feature-006-did-to-r1-and-r2).)_
- `cueAt` returns at most one cue at any x, and `null` everywhere outside the section.
- The four strings match FR-190 character for character, arrows included.
- One coaching badge in the DOM at a time; a trick badge landing beside it displaces
  neither.
- Under reduced motion the badge still appears, still says the same thing, and still
  holds long enough to read.

---

## 5. Ride it

```bash
npm run dev
```

Open the printed URL, take the local session's roster, claim any name, and press
**PRACTICE RUN**.

**Expect, in order**:

| Beat | What you should see                                                                             |
| ---- | ----------------------------------------------------------------------------------------------- |
| 1    | A slope visibly gentler than anything the game has shown before                                 |
| 2    | **HOLD TO CROUCH!** on screen for ~2.5 s, with the rope cresting the frame edge partway through |
| 3    | A magenta rope with hanging pennants — unmistakable against the pines                           |
| 4    | **RELEASE TO JUMP!**, then deadfall                                                             |
| 5    | **STAY CROUCHED!**, then a small ramp that throws you further for staying tucked                |
| 6    | **SWIPE OR ← → TO FLIP!**, then a booter — and a trick badge if you spin                        |
| 7    | The slope steepens into the warm-up course. No further coaching badges                          |

**The things to actually judge** (the validator has no opinion on any of them):

- **Is 2.19 s enough to read the flip cue and act?** That is what the frame gives a
  _tucked_ player at the coached section's gradient of 0.05 (re-baselined 2026-09-12;
  standing he gets 3.37 s, but the previous badge told him to stay crouched). R2 set
  out to buy 2.5 s. Whether 2.19 s is _enough_ is a human question, and this is the
  one to answer first. If it reads short, **30 units of lead** closes the gap — a data
  change, not a mechanism. See [research R7](./research.md#r7--what-feature-006-did-to-r1-and-r2).
- Does the rope read as a hazard from across the frame, or only once it is close?
- Does **STAY CROUCHED!** land, given the previous cue just taught the opposite?
- Does riding this three times per practice session become tedious? FR-186a means
  every player rides it on all three runs.

---

## 6. Verify the built artifact (Principle VI)

A dev server at a different path is not evidence about the deployed game.

```bash
npm run build
npm run test:build           # Playwright against the built artifact at /ski-game/
```

**Expect** `tests/e2e-build/coached-run.spec.ts` to pass, having asserted in a real
browser:

- A cold load at the production base path reaches the title screen.
- **DROP IN** → claim → **PRACTICE RUN** reaches the coached section.
- All four badges appear, in order, with the correct text.
- The arrow glyphs render as glyphs, not as tofu (FR-190b). A failure here means
  substituting a drawn mark — **never** falling back to the word "arrow".

---

## 7. Hand it to the player (Principle VIII)

Binding, not optional. This feature edits `data/courses/warmup.json`, which the
constitution names by path.

```bash
npm run build:artifact       # single-file playable build
```

Publish it and **name the link and the commit it was built from**. Do this at the
first point the coached section runs — not at feature completion. The argument is the
one R1 and R7 make between them: the feature's premise is a pacing claim, and pacing
is exactly what the course validator and both robot pilots hold no opinion about.

Record the findings against [spec.md](./spec.md) **in the player's own words**, before
changing any of these values again.

---

## 8. The documentation half

FR-205 through FR-213 are corrections with no runtime behaviour. They are not
optional — each is a Principle I or VI obligation — and they are verified by reading:

| Requirement | Check                                                                                  |
| ----------- | -------------------------------------------------------------------------------------- |
| FR-205      | Style bible TR-2/TR-3 describe the rope; no reference to a bough survives              |
| FR-206      | FR-030 struck through in feature 001's spec, with reason and date; `saveBindings` gone |
| FR-210      | ADR-0002 no longer claims abandonments are counted                                     |
| FR-211      | One ADR renumbered; the index lists both                                               |
| FR-212      | README does not say "not yet built"; principle count matches the constitution's eight  |
| FR-213      | `npm run test:perf` either runs something real or does not exist                       |

```bash
npm run lint                 # eslint + prettier over everything, docs included
grep -rn "bough" assets/style-bible.md src/     # expect no hits
npm run test:perf            # expect: a real run, or "script not found"
```

---

## Full gate, in the order CI runs it

```bash
npm run lint && npm run build && npm run test && npm run test:build
```

Green here plus a recorded play pass is the Definition of Done for this feature —
with one item outstanding that no command can close: the **open constitutional
deviation** on controls remapping, recorded in
[spec.md](./spec.md#constitutional-compliance-notes). It needs a decision from the
maintainer before merge, not a patch.
