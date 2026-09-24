# Research: Time to See the Box

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-24

Every figure here was measured with a throwaway probe. The probe ran the real
simulation (`src/sim/step.ts`) over the real course generator (`tools/gen-courses.ts`),
with the generator's official gradient programme overridden. It also used a candidate
camera function written the way `cameraFor` is. No data file was changed, and the probe
is not committed: R1's harness is what gets built for real, as
`tests/sim/reaction-budget.test.ts`.

---

## R1 — How is "time to decide" measured?

**Decision**: By one deterministic ride of the whole official course by a **low-line
tucked rider**, recording for every box:

- **Seen**: the first tick at which the box's top edge is inside the 320×180 frame,
  horizontally and vertically, under the camera the player sees.
- **Arrives**: the first tick at which the rider's next position reaches the box's
  leading edge.

Time to decide is `(arrives − seen − climb) / 60 s`. `climb` is 5.12 ticks: the time a
max-charge release needs to rise one `standHeight`. It is derived from `tuning.json`,
not hard-coded.

The rider holds a tuck everywhere, with two exceptions:

- It stands up for the 260 units before each **pop ramp**, so the ramp hops it rather
  than putting it on the shelf. This keeps it on the piste, where the boxes are.
- It releases for each box at the pilots' existing `releaseWithin(vx)` point, so it
  jumps every box the way `tests/sim/pilots.ts` already does.

**Rationale**: the clarify session measured each box from a clean start: 500 units
upstream, at the local terminal speed. That understates the problem, because **there
is no drag in the air**. A rider who has just jumped the previous box, or been hopped
by a ramp, lands faster than the slope's terminal speed and is still bleeding that
speed off when the next box appears. The full ride captures it:

| Box at x | Clean approach (spec, 2026-09-23) | Full ride, shipped camera | Full ride horizontal speed at box |
| -------: | --------------------------------: | ------------------------: | --------------------------------: |
|    1,830 |                            748 ms |                **631 ms** |                              4.65 |
|    3,600 |                            532 ms |                    531 ms |                              4.78 |
|    4,120 |                            448 ms |                    398 ms |                              5.21 |
|    4,640 |                            398 ms |                **365 ms** |                              5.41 |
|    6,100 |                            665 ms |                    631 ms |                              4.78 |
|   11,600 |                            448 ms |                    398 ms |                              5.35 |

Two things change from the spec as clarified:

1. **The worst box is 365 ms, not 398 ms.**
2. **The box at 1,830 fails too.** From a clean start it passes at 748 ms. In a real
   ride the ramp at 1,400 hops a low-line player into it at speed, and they get 631 ms.

The spec is amended to both (see [plan.md § Spec amendments](./plan.md#spec-amendments)).

**Alternatives considered**:

- **A clean approach per box.** Rejected: it misses the airborne speed gain above,
  which is the mechanism that makes the Narrows worst.
- **The high-line tuck pilot.** Rejected: it rides the shelves above boxes 1,830,
  6,100 and 11,600 and never meets them.

**Quantisation**: the simulation runs at 60 Hz, so every measurement moves in 16.7 ms
steps. 680 ms is 40.8 ticks, so a box passes at 681 ms, one tick over, and fails at
665 ms.

---

## R2 — Camera: how much ground to show below the skier

**Decision**: a grounded **look-down** term, combined with the existing airborne lift
by taking the larger of the two.

```text
drop(x)   = pisteY(x + PLAYER_LOOKAHEAD) − pisteY(x)          // how far the ground falls across the view
look(x)   = clamp(drop(x) − 0.4·INTERNAL_HEIGHT + lookMargin, 0, AIR_LIFT_MAX)
look(x)   = min(look(x), shelfCap(x))                         // R3, only on the piste
shift     = max(cameraAirLift(h), look(x))
camera.y  = state.y − 0.6·INTERNAL_HEIGHT + shift              // today: + cameraAirLift(h)
```

`lookMargin` = 4 units. It lives in a new data file, `data/camera.json`, with the
two shelf constants from R3: see R10. That is enough for the whole box, not just its
top pixel, to
be in frame when it crosses 213 units.

**Rationale**:

- **It only makes visible what the 213 units already promise.** `drop` is measured
  over exactly `PLAYER_LOOKAHEAD`, so the camera shows the ground the player is
  already owed horizontally, and no more. The horizontal lookahead does not change, so
  the fixed-view fairness decision (stage.ts, research R6 of feature 001) holds, and so
  do CV-24 and the coaching cue timing, which both read `PLAYER_LOOKAHEAD`.
- **It is continuous.** `pisteY` is piecewise linear and continuous, so `drop(x)`, and
  with it `look(x)`, is continuous in x. Measured across a full ride, the largest
  camera move in one tick is 3.69 units, against 3.76 on the shipped camera. The
  existing airborne lift already sets the fastest the camera moves.
- **It cannot cost jump headroom (FR-243).** `max` with the airborne lift means the
  shift is never smaller than it is today. It is capped at `AIR_LIFT_MAX` (92), which
  is exactly the headroom limit the booter test already enforces. At the apex of both
  booters the airborne lift is 85–90 and dominates, so those frames are identical.
- **It is drawing only (FR-244).** `cameraFor` is called from the renderer alone
  (`src/render/draw.ts:841`), and `tests/unit/sim-isolation.test.ts` already forbids the
  simulation from importing the renderer.

**Measured, shipped course, camera alone**: 3,600 → 648 ms; 4,120 → 565 ms;
4,640 → 548 ms; 11,600 → 548 ms. The camera does nothing for 1,830 and 6,100, which
are limited horizontally, not hidden. **Ropes on steep ground gain the most**: the rope
at 4,860 goes from 333 ms to 450 ms, and 11,850 from 350 ms to 783 ms (see R6).

**Alternatives considered**:

- **Move the fixed anchor from 60% to about 40% down the frame.** Rejected: it would
  cost every jump 36 units of headroom. The big booter already uses 90 of a possible 92.
- **Add the look-down to the airborne lift instead of taking the larger.** Rejected: it
  would push past `AIR_LIFT_MAX` in the air and put the skier's head out of frame.
- **Smooth the camera over time.** Rejected: `cameraFor` is a pure function of state,
  deliberately. A time-smoothed camera would make render state depend on history, and
  the render tests pin it as pure.

---

## R3 — Camera: keeping a shelf overhead in frame

**Decision**: while the rider is on the piste under a shelf, or approaching one,
`look` is capped so the shelf's top edge stays at least 8 units inside the frame:

```text
shelfCap = 0.6·INTERNAL_HEIGHT − shelf.height − 8        // 50 for a 50-high shelf, 45 for 55
```

The cap eases in over the 120 units before the shelf begins, so it never snaps.

**Rationale**: without the cap, the camera probe put the top of the final shelf 0.9
units from the top of the frame at the finish line. With the cap the worst case is
10.9 units, and no box loses time, because no box needs more look-down than the cap
allows where a shelf is overhead. Today's worst case is 53.9 units. FR-243's "as today"
is therefore read as "the shelf's top edge stays inside the frame". A literal
equality would forbid any look-down under the Cornice at all, where the 6,100 box sits.
This reading is written back into FR-243.

**Alternatives considered**: no cap, rejected because the shelf touches the frame edge.
Suppressing look-down entirely under shelves, rejected because it re-hides steep
hazards under the Cornice.

---

## R4 — Course: where to ease the ground, and how much

**Decision**: edit the official gradient programme `OFFICIAL_GRADE` in
`tools/gen-courses.ts` (the course is generated, not hand-edited) to the following.
Rows that change are marked with ◆:

```text
x      g     note
0      0.25
1200   0.30
1400   0.30  ◆ held to the ramp at 1,400 so its lip speed moves < 2%
1600   0.25  ◆ ease: box 1,830 (the ramp hop lands fast)
1850   0.25  ◆
2000   0.30  ◆
3000   0.34
3200   0.30  ◆ the Narrows eased throughout: was 0.46 -> 0.60
4600   0.30  ◆
4700   0.60  ◆ steep straight after the last Narrows box, to rebuild the Cornice run-in
5000   0.56  ◆ was 0.52: gives the Cornice ramp its speed back (+1.4%)
5400   0.42
5800   0.42  ◆
5900   0.26  ◆ ease: box 6,100 (under the Cornice shelf)
6100   0.26  ◆
6300   0.46  ◆ restore: the shelf above follows the piste (R5)
6600   0.46  ◆
6800   0.40  ◆ was 0.38 (R5)
7300   0.56  ... unchanged from here to 10,900 ...
10900  0.44
11200  0.40  ◆ was 0.52
11300  0.25  ◆ ease: box at the Last Pitch
11680  0.25  ◆
11850  0.60  ◆ the run to the line, as before
12200  0.60
```

**And one box moves**: the Last Pitch deadfall goes from **x = 11,600 to x = 11,680**.
This is FR-241's first fallback, taken on evidence. With the ground eased to the
0.25 floor all the way from 11,300, the box at 11,600 still measured only 615–631 ms.
The ramp at 11,000 hops a low-line player into it, and 600 units is not enough to shed
that speed. 80 more units is. The move is inside CV-11's window: a log must sit 140
clear of the bough at 11,850, which caps it at 11,686. The paired rock on the shelf
above stays at 11,600.

**Measured result (candidate "E400"), with the R2+R3 camera**:

| Box at x        | Time to decide | Horizontal speed at box (was) |
| --------------- | -------------: | ----------------------------: |
| 1,830           |         681 ms |                   4.43 (4.65) |
| 3,600           |         748 ms |                   4.22 (4.78) |
| 4,120           |         698 ms |                   4.41 (5.21) |
| 4,640           |         681 ms |                   4.45 (5.41) |
| 6,100           |         681 ms |                   4.40 (4.78) |
| 11,680 (11,600) |         681 ms |                   4.36 (5.35) |

All six pass. **Four of them pass by one tick**, so the margin is thin, and implementation
should look for a tick of headroom where it is cheap: a further 0.01–0.02 off an eased
key.

**Kicker lip speeds, measured on the high-line tuck pilot (FR-235, within 2%)**:

| Kicker | Shipped | Candidate | Change |
| ------ | ------: | --------: | -----: |
| 1,400  |   4.371 |     4.311 |  −1.4% |
| 5,200  |   5.730 |     5.809 |  +1.4% |
| 7,852  |   5.045 |     5.046 |   0.0% |
| 9,188  |   5.169 |     5.169 |   0.0% |
| 11,000 |   5.188 |     5.094 |  −1.8% |

The kicker at 11,000 is closest to the limit.

**Everything else on the candidate**: the course validator passes with no violations.
The tuck pilot finishes with 3 shelves and the stay-low pilot finishes with 0. The
whole `tests/sim`, `tests/course` and scoring-dominance suites pass (129/129).
`tuning-frozen` fails on `official.json` by design (see R7).

**Rationale for the shape**: speed responds to a gradient with a time constant of
about 40 ticks, roughly 200 units at these speeds. So an ease has to start 200–400
units before the point where the box comes into view, not at the box. That is why the
Narrows, where boxes are 520 apart, comes out eased almost throughout rather than
stepped. The spec's edge case "may come out as a stepped descent" resolves as
"eased throughout". The Narrows still asks a decision every 520 units; it just stops
asking it at 5.4.

**Alternatives considered**:

- **Stepped Narrows** (steep, ease, box, repeated): tried with keys at 0.36. At 0.36
  the chained jumps still carried riders in at 4.73–4.80, giving 631–648 ms. There is
  no room between boxes 520 apart to both rebuild speed and shed it again.
- **Only the three Narrows boxes**: leaves 1,830, 6,100 and 11,600 failing (R1).

**The complete programme**, exactly as measured. This is what T012 writes into
`OFFICIAL_GRADE`; the table above omits the unchanged keys between 7,300 and 10,900:

```ts
[
  { x: 0, g: 0.25 },
  { x: 1200, g: 0.3 },
  { x: 1400, g: 0.3 },
  { x: 1600, g: 0.25 },
  { x: 1850, g: 0.25 },
  { x: 2000, g: 0.3 },
  { x: 3000, g: 0.34 },
  { x: 3200, g: 0.3 },
  { x: 4600, g: 0.3 },
  { x: 4700, g: 0.6 },
  { x: 5000, g: 0.56 },
  { x: 5400, g: 0.42 },
  { x: 5800, g: 0.42 },
  { x: 5900, g: 0.26 },
  { x: 6100, g: 0.26 },
  { x: 6300, g: 0.46 },
  { x: 6600, g: 0.46 },
  { x: 6800, g: 0.4 },
  { x: 7300, g: 0.56 },
  { x: 7700, g: 0.56 },
  { x: 7800, g: 0.34 },
  { x: 8400, g: 0.26 },
  { x: 8700, g: 0.26 },
  { x: 8800, g: 0.58 },
  { x: 9100, g: 0.58 },
  { x: 9200, g: 0.34 },
  { x: 10600, g: 0.25 },
  { x: 10900, g: 0.44 },
  { x: 11200, g: 0.4 },
  { x: 11300, g: 0.25 },
  { x: 11680, g: 0.25 },
  { x: 11850, g: 0.6 },
  { x: 12200, g: 0.6 },
];
```

---

## R5 — The booter rotation test is a zero-margin instrument

**Finding**: the first passing candidate ("D1") eased 5,900–6,100 and broke the test
`booters.test.ts › pays five rotations off the small booter`. The small booter at 7,852
went from 75 ticks of air to 74, so five 15-tick spins no longer fit.

The cause is upstream. **Shelves are built at a fixed height above the piste, so
easing the piste under the Cornice also eases the Cornice shelf.** The rig's tuck
rider left that shelf a little slower, and its lip speed at 7,852 dropped by 0.2%
(4.806 → 4.796). The rig's own comment already records that it has zero margin.

**Decision**: give the speed back on the shelf after the box. The ground rises to 0.46
over 6,300–6,600 and the Flats key at 6,800 goes 0.38 → 0.40. Rig lip speed is then
4.807 and air is 75 ticks.

**Warning carried into tasks**: the rig's response is not monotonic. 6,800 at 0.385 and
at 0.39 both still failed, and 0.40 passed. Any later edit upstream of 7,852, including
the "tick of headroom" suggested in R4, can flip this test again. **Re-run
`tests/sim/booters.test.ts` after every edit to `OFFICIAL_GRADE`.** Adding margin to the
rig itself is out of scope: feature 006 deliberately froze it as the instrument its
baseline was taken with.

**Alternatives considered**: re-solving `BOOTER_MID` power. Rejected, because FR-235
holds the booters to their current behaviour, and a re-solve changes what the rig
measures.

---

## R6 — Ropes and other hazards (FR-237)

Time from each rope entering the frame to the rider reaching it, on the low-line ride:

| Rope at x | Shipped | Candidate + camera |
| --------: | ------: | -----------------: |
|       700 |     900 |                900 |
|     3,020 |     800 |                800 |
|     3,300 |     700 |                800 |
|     3,820 |     417 |                783 |
|     4,340 |     350 |                750 |
|     4,860 |     333 |                450 |
|     6,400 |     567 |                650 |
|     7,300 |     550 |                717 |
|     7,600 |     500 |                700 |
|    11,850 |     350 |                783 |

**No rope loses time, and six gain 100 ms or more.** This confirms the spec's hunch
that the hidden-hazard defect was never only about boxes. Rocks and ice on the shelves
sit at the rider's own level and are not hidden by the bottom edge. They are covered by
the shelf pilots finishing.

---

## R7 — Rules version, operator files, and the feature 005 freeze

**Decision**:

- **`rulesVersion` 2.0.0 → 2.1.0**, on both courses. The database compares strings
  exactly, so any bump behaves identically. MINOR says what happened: the course moved
  and the rules of motion did not. No draft reset is needed, because none holds scores
  (Clarifications Q2). Migration 0004's first-commit freeze adopts 2.1.0 from the next
  official run.
- **`supabase/seed-draft.sql` and `supabase/fix-rules-version.sql`** carry the version
  string an operator seeds or repairs to. They move to 2.1.0 in the same change
  (Principle VII). `supabase/tests/invariants.sql`'s FR-229 block uses 2.0.0 as a
  historical fixture and stays as it is.
- **`tests/unit/tuning-frozen.test.ts`** froze two files for feature 005. It keeps
  `data/tuning.json` frozen, because FR-232 needs exactly that guarantee again. It stops
  freezing `data/courses/official.json`, and is retitled to name feature 007 as the
  current owner of the freeze. It gains a check that the official course's rules
  version differs from the committed one whenever the course's geometry does, so a
  course edit without a bump fails loudly.
- **Determinism goldens** (`tests/e2e/determinism.spec.ts`): these traces die inside
  the first 500 units, where nothing moves. They are expected to be unchanged. If they
  do move, they are regenerated with a dated note, as their header requires.

---

## R8 — The play-pass build needs the real sprite (FR-240)

**Finding**: this container has Git LFS pointer files where
`public/sprites/skier.png` and `assets/sprites/*.png` should be (`git lfs` is not
installed). A single-file build made here would ship the fallback renderer. Commit
`ae54ade` exists because that has happened once already.

**Decision**: before building the play-pass artifact, fetch the real objects. Either
install `git-lfs` and run `git lfs pull`, or fetch the blob by its `oid` through the
GitHub media endpoint. Then assert the PNG signature: the existing
`tests/unit/sprite-palette.test.ts` does exactly this and currently fails for exactly
this reason. **If neither route works, the build is not handed over as a play-pass
build.** The maintainer is told plainly why.

---

## R9 — The warm-up course has a failing box too

**Finding** (found by `/speckit-analyze`, 2026-09-24): FR-231 covers both courses, but
the warm-up had only been measured from a clean start. On the same low-line ride, its
coached box at 1,289 leaves 2,098 ms. Its box at **5,200 leaves 648 ms**, because the
warm-up ramp at 4,600 hops a low-line player into it. The camera does not help: the
box is limited horizontally, not hidden (648 ms with or without it). As first
amended, the spec froze the whole warm-up course, which left no remedy. FR-233 is
amended to allow this one approach.

**Decision**: ease 4,800–5,200 to the 0.25 floor and give the speed back at
5,300–5,400, so the warm-up booter at 5,586 is reached as before. Complete programme:

```ts
[
  { x: 0, g: 0.05 },
  { x: 2780, g: 0.05 },
  { x: 3200, g: 0.26 },
  { x: 4600, g: 0.38 },
  { x: 4700, g: 0.38 },
  { x: 4800, g: 0.25 },
  { x: 5200, g: 0.25 },
  { x: 5300, g: 0.3 },
  { x: 5400, g: 0.31 },
  { x: 6400, g: 0.3 },
  { x: 6600, g: 0.34 },
];
```

The coached section (0–3,200) does not move.

| Measure                                 | Shipped | Candidate |
| --------------------------------------- | ------: | --------: |
| Box 5,200, time to decide               |  648 ms |    698 ms |
| Ramp 4,600, lip speed (tucked)          |   4.785 |     4.799 |
| Booter 5,586, lip speed                 |   4.379 |     4.374 |
| Coached ramp and booter (1,889 / 2,489) |   1.633 |     1.633 |

The box passes with one tick of margin, and both kickers are within 0.3%. The validator
is clean, and the tuck and stay-low pilots finish the warm-up with 1 and 0 shelves, as
before. The whole suite passes with both candidate courses installed (559/562). The
three failures are the two LFS sprite tests (R8) and the frozen-file guard, which T006
retargets.

Two variants were rejected:

- **Easing to 0.28 without a restore**: the box reads only 681 ms.
- **Restoring to 0.34 at 5,300**: the booter lip moves +2.1%, outside FR-235.

---

## R10 — Where the camera constants live (Principle III)

**Finding** (`/speckit-analyze`, D1): the plan first kept `LOOK_MARGIN`,
`SHELF_MARGIN` and `SHELF_EASE_IN` in code beside `AIR_LIFT_MAX`. It justified that
by precedent. Principle III says "magic numbers governing feel MUST NOT be embedded in
code", and these three set how many milliseconds a player gets. Precedent does not
license a MUST.

**Decision**: a new versioned data file, **`data/camera.json`**:

```json
{ "lookMargin": 4, "shelfMargin": 8, "shelfEaseIn": 120 }
```

- It is parsed by a new `parseCamera` in `src/data/load.ts`, which rejects a missing
  key, a non-number, or a negative value, following `parseAudio` and `parseSprites`.
- It is imported in `src/main.ts` beside `sprites.json` and carried on `GameData`.
- It is passed to `cameraFor(state, course, framing)`.

`data/tuning.json` is untouched, so FR-232 holds. The renderer, not the simulation,
reads the file, so determinism is unaffected. Changing a value re-feels the game, so
Principle VIII's play-pass obligation extends to this file, and it is named in the
quickstart.

**What stays in code**: `PLAYER_LOOKAHEAD`, `INTERNAL_HEIGHT` and `AIR_LIFT_MAX`. These
are frame geometry, not tuning: the 320×180 buffer and the headroom ceiling the booter
test derives. They were in code before this feature, and moving them is not this
feature's to do.
