# Research: Finish Line

All figures were measured on rules 3.1.0 at commit 8c8d817.

## R1. Ground past the line: drawn, not data

**Decision**: The finish area's ground is a drawing function, `groundY(course, x)`.

- It equals `terrainYAt` for every x ≤ L, where L is the course's length, exactly and
  not approximately.
- Past L it eases from the course's slope at L to flat over `runoutEase` units (160),
  then stays flat.

The course files do not change.

**Rationale**:

- Both courses end on 0.6 ground whose last terrain point is 200 units past L. Beyond
  that point `terrainYAt` is already flat, so the data already has a sharp kink at L+200.
  A skier coasting into it would appear to hit a wall.
- Putting a flat run-out into the course data fails validator CV-23 (no segment too
  shallow to overcome friction) and test B8 (no ground below 0.25). Both check every
  terrain segment, including those past L. Carving L out of both is possible, but it
  also moves the official course's recorded geometry fingerprint. That is a
  rules-version event for ground no run can ever reach.
- On its final tick the simulation moves at most one tick's travel past L (under 8
  units at `speedMax` 7.5) before clamping. The drawn ease differs from the data by
  `g·u²/(2·runoutEase)` there, under 0.25 units (the warm-up's data itself turns 0.30 → 0.32 at its line). Nothing in `src/sim` ever reads
  `groundY`.

**Alternatives considered**:

- Extend the course data past L+200 with a flattening curve, and carve L out of CV-23
  and B8. Rejected: it moves the rules-version fingerprint and the validator for
  presentation's sake.
- Keep the data's existing kink. Rejected: a 31° corner under a coasting skier reads as
  a crash.

## R2. The coast: a presentation integrator seeded from the final state

**Decision**: `FinishSequence` takes the final `RunState` (x = L, plus y, vx, vy,
grounded, ledge and orientation) and advances once per simulation tick. The steps below
are one clean arrival: no bounce, no tumble, no score.

1. **In the air**, including a shelf rider past the shelf's end at L: fall
   ballistically at the tuning's gravity until reaching `groundY`. The orientation
   eases linearly toward the ground's slope over the remaining air, so the landing is
   always clean. A minimum of 8 ticks applies when the landing is sooner.
2. **On the snow**, follow `groundY` and decelerate uniformly. At first contact the
   rate is set to whichever stops the skier sooner: within `stopDistance` (200) units,
   or by `stopWithinTicks` (90) ticks after the crossing, counting any time in the air.
   Both are measured from the line: `a = max(v²/(2·max(L + 200 − x, 40)), v/max(90 − t_air, 20))`,
   so a late landing ends in a short hockey stop in the open snow, not a slide into the crowd.
   - A spray of snow particles comes off the skis while braking. It is removed under
     reduced motion.
   - The pose is the standing pose once below 1 u/tick.

**Rationale**:

- The simulation has stopped, as it has during the wipeout, whose tumble is also drawn
  only (`death.ts`).
- Measured speed at the line, over all three pilots on both courses, runs from
  2.75 u/tick (stay-low, warm-up) to 6.89 u/tick (low-line, warm-up).
- A distance cap alone would stop the slowest rider 145 ticks into a 156-tick hold, so
  the stop would barely be seen. A time cap alone would slide the fastest 310 units,
  out of the framing. Taking whichever brakes harder:
  - 6.89 u/tick stops in 200 units and 58 ticks;
  - 2.75 u/tick stops in 124 units and 90 ticks.
    Every rider has stopped with at least 66 ticks, over a second, of the hold left to
    be seen stopped.
- The stay-low pilot crosses the official line in the air, so the airborne path is a
  measured case, not a hypothetical. No pilot crosses on the shelf; that case comes
  from a synthetic state in the tests.
- A shelf rider at 7 u/tick falls 50 units in 25 ticks and covers 175 units doing it,
  which reads as a jump off the end of the shelf into the finish area.
- Mid-rotation: the simulation pays a trick only on landing, and the run has already
  finished, so an unpaid spin shows no bonus. Easing to a clean landing therefore does
  not contradict the score, and a crash animation would.

**Alternatives considered**:

- Keep stepping the real simulation past L on a run-out. Rejected: it changes `src/sim`
  and invites a wipeout after a finish.
- Draw a ramp down from the shelf's end. Rejected: that adds course geometry for one
  case, and the drop reads well.

## R3. Timing: per tick, same length as the wipeout

**Decision**:

- The hold lasts `holdTicks` 156 (2.6 s), which equals the wipeout's `TOTAL`, and
  `reducedHoldTicks` 54 under reduced motion, which equals `REDUCED_TOTAL`.
- `GameView`'s loop keeps calling `tick()` while the finish sequence is active, and
  `tick()` advances the sequence instead of the simulation.
- The results appear when the sequence is done or skipped.

**Rationale**: FR-266 caps the finish at the wipeout's length. Advancing per tick keeps
the beat fixed on any refresh rate.

**Found, not fixed**: `DeathSequence.advance()` is called from `render()`, once per
display frame, although its own comment says it advances per simulation tick. On a
120 Hz display the wipeout plays in half its designed time. That is feature 002's
behaviour; correcting it changes FR-131's timing and belongs in its own change. It is
recorded in the spec's edge cases next to the key-repeat skip.

## R4. Skip: new presses only

**Decision**: The finish's skip listener ends the hold on `pointerdown`, or on a
`keydown` whose `repeat` is false. It is armed on the tick of the crossing.

**Rationale**: Most players are holding the tuck key (Space, ArrowDown or S) when they
cross. Browsers send repeating `keydown` events with `repeat: true` while a key stays
held. The first press of a key held since before the crossing was sent before the
listener existed, so ignoring repeats is exactly "a new press".

**Alternative**: Track key state from the input sampler. Rejected as more coupling for
the same answer.

## R5. Look: gantry, silhouettes, rim light

**Decision**, added to the style bible as FN-1 to FN-4:

- **FN-1, the gantry.** A `snow` post standing on the piste at L, tall enough to clear
  the highest shelf and a standing skier (`gantryHeight` 100). A banner hangs from its
  crossbar: 4-unit `ink`/`snow` checks with a 1-unit `cyan` border. A 6-unit checkered
  strip lies across the snow at L, on the piste and on any shelf that reaches L. There
  is no in-world lettering (L-0); the words are the overlay's.
- **FN-2, the crowd.** Backlit silhouettes in `ink`, with a 1-unit `cyan` rim along
  their upper edges (T-3 bloom-eligible).
  - They stand on the far side of the snow edge. Their feet are hidden 2 units below
    the drawn ground, so they read as behind a snowbank and never on the racing line.
  - About one in five carries a flag in `yellow` or `cyan`.
  - No `skin`, which keeps P-6 unchanged; no `orange` (P-4); no `magenta`, which is
    the player (P-4).
  - Figures are 11 to 14 units tall, against the player's 16, so they read as further
    away. They are placed by a hash of their slot, as the scenery is, so the crowd
    never re-rolls.
- **FN-3, the celebration.**
  - Idle: arms down, a slow sway at 0.5 Hz or less.
  - At the crossing, arms go up and figures jump. Each figure hops at most 3 units at
    1.5 to 2.5 Hz with its own phase, flags wave, and a few hats are thrown.
  - Reduced motion: arms up and flags up, with no hopping, no thrown hats and no sway.
    That is still unmistakably a cheering crowd, satisfying FR-274 and SC-099.
- **FN-4, the results transition.** The results panel arrives by a horizontal panel
  wipe (F-4) of 300 ms, or instantly under reduced motion. It applies to both endings,
  because the results panel is one screen.

**Rationale**: `ink` against `snow` and `purple` is the strongest contrast the palette
has, and silhouettes were the maintainer's choice (Q1). The rim light ties them to the
game's neon, and flags give colour without implying people's skin.

## R6. Feel values in data

**Decision**: `data/finish.json`, parsed by `parseFinish` in `src/data/load.ts`, with
the same number and negativity checks as `parseCamera`, plus integer checks for tick
counts. Keys:

- `holdTicks` 156 and `reducedHoldTicks` 54
- `runoutEase` 160, `stopDistance` 200 and `stopWithinTicks` 90
- `frameLead` 60 and `frameFollow` 240 (R7)
- `gantryHeight` 100 and `bannerWidth` 60
- `crowdFrom` −160, `crowdTo` 480, `crowdSpacing` 11, and a gap from `crowdGapFrom` 90 to `crowdGapTo` 340 where nobody stands (the skier stops there)

`crowdFrom` may be negative, since it is measured relative to L.

## R7. The camera during the hold

**Decision**: `camX = max(min(skierX − 107, L − frameLead), skierX − frameFollow)`, with
`frameLead` 60 and `frameFollow` 240. The vertical camera is `cameraFor` on the coasting
state, with the look-down followed as in a run (FR-261).

**Rationale**:

- Until the skier is 47 units past L, the camera follows as usual.
- It then holds with the gantry in the left third and the crowd across the middle, and
  the skier crosses the frame towards the right.
- If he would pass 240 units into the frame, as the shelf drop can, it follows again.
- The expression is continuous at both switch points, so there is no snap (the FR-261
  standard).

## R8. End-to-end on the built artifact

**Decision**: Evidence for Principle VI works as follows.

- Record the `tuck` pilot's per-tick inputs on the warm-up course. The pilot observer
  gains the input, and the trace is 2,395 ticks, committed as a fixture.
- On the built artifact, start a practice run, which uses the warm-up course. Under
  Playwright's clock API, step one tick at a time, pressing and releasing the mapped
  keys to match the trace.
- The run reaches the line exactly as the pilot does, because `initialState` ignores
  its seed today ("exists so seeded variation can be added").
- The test then asserts the FINISH overlay while Space is still held, which is FR-268's
  held-key case for free. It also asserts the results panel with its wipe class, and a
  score equal to the pilot's.

**Rationale**: No existing test reaches a finish, because the wipeout tests rely on the
crash that happens by doing nothing. A replay is the only way to drive the shipped
build to the line.

**Stated gap**: Audio output is not asserted, only that `cue('finish')` was called
through the existing synth spy pattern, if one exists; otherwise that is stated. If
Playwright's clock cannot step the loop deterministically in the build harness, this
test fails and the gap is raised at review rather than skipped.

## Implementation notes

- **R1, as built (T006, T008).** The run-out is a copy of the course, `withRunout`,
  carrying 4-unit points that follow the quadratic past the line. The renderer, the
  camera, the reaction measure and the course map all draw from it; the simulation
  rides the original. This took one argument at the view instead of a new parameter on
  every ground lookup in the renderer.
- **T009.** The course map summary is identical before and after, including every
  lead time near the line. The camera seeing the drawn run-out moved no reading.
- **F2's bound.** Past the line the drawn ground differs from the data by at most
  0.256 units within one tick at `speedMax`. Most of that is the warm-up's own data
  turning from 0.30 to 0.32 at its line.
- **The finale bug E1 caught (T019).** The run view's render callback resolved the
  finale whenever the run had ended and the wipeout's sequence reported done. A
  `DeathSequence` that never started reports done, so a finish ended its own hold on
  the first frame. The unit tests could not see it; the built-artifact replay did. The
  death branch now runs for wipeouts only.
- **First look at the hold (T023).** Two defects, both fixed before handing over:
  - Following the skier down onto the run-out carried the banner off the top of the
    frame. The camera now holds the banner in view during the hold.
  - The crowd read as a cyan fence and swallowed the skier (FR-275). Heads are now
    round with a lit rim, raised arms are lit, and spacing went from 9 to 11.
    `crowdGapFrom` and `crowdGapTo` (90 to 340) leave open snow where every rider stops.
  - The stopping distance is now measured from the line, so late landings end in a
    40-unit-minimum hockey stop inside that gap rather than sliding into the crowd.
    Riders stop 125 to 211 units past the line; the synthetic shelf and rising-jump
    cases stop by 340.
- **Stated gap (Principle VI).** The cheer is not asserted in a browser.
  `cue('finish')` is wired in `endRun` for finished runs, verified by review. The FINISH
  lettering and the crowd are its visible equivalents (A-4).
