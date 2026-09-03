# Contract: Controls

**Governs**: FR-029 to FR-032, FR-078, FR-080, FR-085

Two inputs. Collapsing jump and crouch into one charge-and-release verb is what
makes one-handed phone play possible (FR-085) and is the game's core skill
(FR-088).

> **Attack is withdrawn.** This contract described three verbs until feature
> 002's FR-114 removed the attack verb and the destructible barriers it acted
> on. FR-081 is suspended, not deleted — the row below records what the verb was
> so that restoring it does not have to be reconstructed from git history, and
> whoever restores it needs CV-6 and the barrier entity back at the same time.

## The verbs

| Verb                | Keyboard (default)  | Touch                             | Simulation effect                                                                                                                                                                        |
| ------------------- | ------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crouch / launch** | Space or Down, held | Hold anywhere on the screen       | Held + grounded: accelerate toward `tuckSpeedMax`, lower profile. Released + grounded: launch scaled by charge (FR-078). Released under a low obstacle: launch into it, wipeout (FR-088) |
| **Rotate**          | Left / Right, held  | Drag left or right, or tilt zones | Airborne only: angular velocity toward ±`rotationRateMax` (FR-079)                                                                                                                       |
| ~~**Attack**~~      | ~~Shift or Up~~     | ~~Tap the upper third~~           | _Withdrawn by FR-114._ Destroyed a barrier within `attackReach`, with a cooldown (FR-081)                                                                                                |

## Parity requirements

- **Equivalent capability** (FR-029). Every verb is reachable with the same
  precision and timing on both. Neither surface gets a verb the other lacks, and
  neither gets finer control — touch rotate is quantised to the same −1/0/+1 the
  keyboard produces, so a desktop player cannot rotate more precisely.
- **One-handed on a phone** (FR-085). No verb requires a second finger. Crouch and
  spin can overlap because a spin only applies airborne, when crouch does
  nothing.
- **The press is the commitment.** Spin reads the rising edge, not the held
  state, so holding the key does not chain turns. Held input would restart a
  spin the instant one finished, which makes the last one always incomplete on
  landing and turns leaning on the key into a way to die.
- **Fully remappable keyboard** (FR-030). Touch zones are not remappable; their
  contract is the region, not the key.
- **Never inverted between devices** (FR-032). Hold means charge everywhere.

## Latency

Input to visible response ≤ 2 simulation frames, 33.4 ms (FR-031). Measured from
the browser event to the first frame showing the state change, on reference
hardware, asserted in CI.

Input is sampled once per simulation tick, not per animation frame. A press and
release inside a single tick registers as a release at that tick's boundary — the
alternative, sampling per frame, would make a 120 Hz desktop capable of finer
timing than a 60 Hz phone and break SC-006.

## Accessibility

- No verb requires simultaneous inputs (FR-085)
- No information about control state conveyed by colour alone (FR-055)
- Reduced motion disables scanlines, shake, flashing, and parallax without changing
  any timing above, so the run stays equally playable and scoreable (FR-056)
