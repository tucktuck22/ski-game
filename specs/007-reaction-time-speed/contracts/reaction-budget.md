# Contract: Reaction Budget

**Governs**: the official and warm-up courses as generated, together with the camera.
**Requirements**: FR-231, FR-233–FR-238, SC-081, SC-084.
**Enforced by**: `tests/sim/reaction-budget.test.ts` (new), plus the existing
`tests/course/validate.test.ts`, `tests/sim/booters.test.ts`, `tests/sim/tracks.test.ts`
and `tests/unit/scoring-dominance.test.ts`.

## The measuring ride

Measurement uses one deterministic ride, the **low-line tucked rider**
([research § R1](../research.md#r1--how-is-time-to-decide-measured)). It holds a tuck,
stands for the 260 units before each pop ramp so it stays on the piste, and jumps each
box at the pilots' `releaseWithin(vx)` point. The rider lives in `tests/sim/pilots.ts`
beside the existing pilots, so there is one definition of how a test rider jumps.

## Assertions

| #   | Assertion                                                                               | Threshold                                              |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| B1  | For every `solid` obstacle on both courses, time to decide under the real `cameraFor`   | ≥ 680 ms                                               |
| B2  | The low-line rider and both existing pilots finish the official course                  | outcome `finished`                                     |
| B3  | At every box after the first, the rider is grounded on the tick that box enters view    | true (FR-236)                                          |
| B4  | For every rope, the time from entering view to arrival                                  | ≥ the rules-2.0.0 value in the baseline table (FR-237) |
| B5  | Tucked high-line pilot's speed at each kicker lip                                       | within ±2% of the 2.0.0 baseline (FR-235)              |
| B6  | Booter rotations: the existing booter test, unmodified                                  | passes (SC-084)                                        |
| B7  | Shelves ridden by the tuck pilot and by the stay-low pilot                              | 3 and 0, as on 2.0.0                                   |
| B8  | The gentlest gradient on the official course                                            | = 0.25 (FR-234)                                        |
| B9  | Failure messages name the box's x, the measured ms, and the horizontal speed on arrival | —                                                      |

## Baseline table (rules 2.0.0, committed in the test)

| Kicker | Lip speed |     |   Rope | Lead (ms) |
| -----: | --------: | --- | -----: | --------: |
|  1,400 |     4.371 |     |    700 |       900 |
|  5,200 |     5.730 |     |  3,020 |       800 |
|  7,852 |     5.045 |     |  3,300 |       700 |
|  9,188 |     5.169 |     |  3,820 |       417 |
| 11,000 |     5.188 |     |  4,340 |       350 |
|        |           |     |  4,860 |       333 |
|        |           |     |  6,400 |       567 |
|        |           |     |  7,300 |       550 |
|        |           |     |  7,600 |       500 |
|        |           |     | 11,850 |       350 |
