/**
 * Which coaching instruction is legible at a given point on the mountain.
 *
 * Feature 005. This is the selection half of the coaching badge, and it is
 * deliberately separated from the DOM that presents it: the numbers this
 * feature's teaching value rests on — where each cue starts and stops — are
 * then testable without a browser, which is where this project's slowest
 * feedback already lives.
 *
 * NOTHING HERE IS SIMULATION STATE. `cueAt` is a total pure function of one
 * number. It reads no clock, no storage and no `RunState`, and it holds nothing
 * between calls, so there is no path by which a cue can reach the state hash
 * (FR-204). It is a pure function of position in the same way `selectPose` is a
 * pure function of state.
 *
 * WHY THE CUE BINDS TO ITS OBJECT'S VISIBILITY. A badge appears exactly when
 * the thing it describes crests the frame edge, one `PLAYER_LOOKAHEAD` ahead —
 * which is FR-191 as the maintainer approved it, and which he chose in those
 * words: "it is simpler and harder to break". Research R2 once measured that
 * this capped the flip cue at 0.95 s and proposed a 389-unit authored lead
 * instead; feature 006 then made gradient the speed control, the coached
 * section slowed to a third of the speed R2 measured, and R7 withdrew the lead
 * as machinery nothing needed. At gradient 0.05 the flip cue is legible for
 * 2.19 s tucked and 3.38 s standing.
 *
 * THE TABLE IS A COPY, AND `tests/unit/coaching-cue.test.ts` IS WHY THAT IS
 * SAFE. The object positions below also live in `tools/gen-courses.ts`, which
 * is the authority. A renderer cannot read course JSON at module scope, so the
 * duplication is unavoidable; what is avoidable is the drift, and the test
 * asserts every entry here against the generated `warmup.json`. Move an object
 * without moving its cue and the build fails rather than the badge quietly
 * describing something that is no longer there.
 */
import { PLAYER_LOOKAHEAD } from './stage.js';

export interface Cue {
  readonly id: 'crouch' | 'jump' | 'stayCrouched' | 'flip';
  /** World x at which the cue becomes legible — its object crests the frame. */
  readonly from: number;
  /** World x at which it clears: its object is now behind the player. */
  readonly to: number;
  /** Verbatim copy, FR-190. Not a template, not localised, not device-aware. */
  readonly text: string;
}

/**
 * Builds one cue from the object it describes.
 *
 * `to` is the object's trailing edge, so a cue never clears while the thing it
 * names is still ahead of the player (FR-191).
 */
const cueFor = (id: Cue['id'], x: number, width: number, text: string): Cue =>
  Object.freeze({ id, from: x - PLAYER_LOOKAHEAD, to: x + width, text });

/**
 * The four lessons, in the order FR-188 fixes: rope, deadfall, ramp, booter.
 *
 * The strings are FR-190 verbatim, arrows included. The arrows are U+2190 and
 * U+2192 and they carry both verbs in one string on every device (FR-190a):
 * there is no input detection here and there must not be, because a product
 * that guesses wrong tells a player to perform a gesture his hardware cannot.
 */
export const CUES: readonly Cue[] = Object.freeze([
  cueFor('crouch', 689, 40, 'HOLD TO CROUCH!'),
  cueFor('jump', 1289, 24, 'RELEASE TO JUMP!'),
  cueFor('stayCrouched', 1889, 56, 'STAY CROUCHED!'),
  cueFor('flip', 2489, 110, 'SWIPE OR ← → TO FLIP!'),
]);

/**
 * The cue legible at world x, or null.
 *
 * Total: any finite x is legal, including negative and past the finish.
 *
 * IT DOES NOT KNOW WHICH COURSE IS LOADED, AND THAT MATTERS. Both courses start
 * at x=0, so an official run rides straight through every interval below and
 * would be coached through a scored descent. FR-197 is enforced by a branch on
 * the RUN KIND in `src/main.ts`, not here and not by the course routing — free
 * play is served the warm-up course until the official run commits, so the
 * course alone cannot answer the question either.
 */
export function cueAt(x: number): Cue | null {
  for (const c of CUES) if (x >= c.from && x < c.to) return c;
  return null;
}
