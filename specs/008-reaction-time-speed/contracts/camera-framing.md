# Contract: Camera Framing

**Governs**: `cameraFor(state, course)` in `src/render/draw.ts`, and the new
`lookDown` helper beside `cameraAirLift` in `src/render/rampGeometry.ts`.
**Requirements**: FR-257, FR-258, FR-259, SC-093.

## Signature

```ts
cameraFor(state: RunState, course: Course, framing: CameraFraming): { x: number; y: number }
lookDown(course: Course, x: number, onPiste: boolean, framing: CameraFraming): number   // new, pure
// CameraFraming = { lookMargin, shelfMargin, shelfEaseIn }, parsed from data/camera.json
```

## Guarantees

| #   | Guarantee                                                                                                                                                                          | Checked by                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| C1  | `camera.x` is exactly `state.x − CAMERA_X_OFFSET`, as today. The horizontal view ahead stays 213 units on every device                                                             | unit test                                                  |
| C2  | On level or gentle ground (where `drop ≤ 68`), `camera.y` equals today's value exactly                                                                                             | unit test on the gentle sections, both courses             |
| C3  | On the piste, any point of piste within 213 units ahead is inside the frame vertically, with ≥ 4 units margin. This holds everywhere except under a shelf cap                      | unit test sweeping x along both courses                    |
| C4  | `shift ≥ cameraAirLift(h)` always, and `shift ≤ AIR_LIFT_MAX`. So no airborne frame shows less below the skier than today, and the skier's head never leaves the top               | unit test; existing booter headroom test                   |
| C5  | Riding the piste under or approaching a shelf, the shelf's top edge stays ≥ 8 units inside the frame                                                                               | unit test on the low-line ride                             |
| C6  | Continuity: over a full low-line ride and a full tuck-pilot ride, the camera never moves more than 4 units vertically between consecutive ticks (today's worst: 3.76)              | unit test                                                  |
| C7  | Pure and render-only. It reads state and course, writes nothing, and the simulation never imports it                                                                               | existing `sim-isolation` test; determinism tests unchanged |
| C8  | Over each booter, on the tuck and low-line rides, the largest tick-to-tick change in the camera's vertical move is no more than the 2.0.0 camera's on the same jump + 0.5 (FR-261) | unit test                                                  |
| C9  | `LookFollower` restarts at the target on a new run and never moves faster than its rate                                                                                            | unit test                                                  |

_C7 amended 2026-09-24: the look-down is now followed by `LookFollower`, which keeps one number between ticks. It is advanced once per simulation tick and reads only the states it is given, so it is still render-only and the same on every device. `cameraFor` itself stays pure and takes the followed value as an argument._

## Non-guarantees

- The camera does not look **up** hills. The course only descends, and CV-23 keeps it
  that way.
- The camera does not anticipate the airborne lift. At takeoff the shift is whichever
  of look-down and lift is larger, and it hands over continuously as the lift grows.
