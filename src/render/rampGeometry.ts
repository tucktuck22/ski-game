/**
 * Ramp geometry: how big a kicker is drawn, and the line a skier rides up it.
 *
 * Split out of draw.ts because it is pure arithmetic that has been wrong three
 * times, each time caught only by a person playing the game. It is the seam
 * between what the simulation does and what the screen shows, and every error
 * in it looked like "the ramp does not match the jump". Here it can be
 * asserted against the simulation directly - see tests/sim/booters.test.ts -
 * instead of re-derived by hand and shipped hopefully.
 *
 * Nothing here touches the DOM or the simulation. drawRun only ever reads run
 * state, so none of this can reach determinism.
 */
import type { Course, Kicker, RunState, Tuning } from '../sim/types.js';
import type { CameraFraming } from '../data/load.js';
import { terrainYAt } from '../sim/terrain.js';
import { terminalSpeedAtGradient } from '../sim/slopeResponse.js';
import { INTERNAL_HEIGHT, PLAYER_LOOKAHEAD } from './stage.js';

/**
 * How far up the frame the skier rides per unit of air beneath him, and the
 * ceiling on it.
 *
 * The camera used to pin him at a fixed 60% down the buffer whatever he was
 * doing, which is fine on snow and actively hides a jump: the buffer is 180
 * tall and he sat 108 down it, so the ground left the bottom of the frame the
 * moment he was 72 units up, against a booter apex of 261. Measured, the snow
 * was out of shot for 85% of that flight. Lifting him up the frame as he climbs
 * keeps it in view to about 145 units, and makes him visibly RISE.
 *
 * It also compresses his apparent height by exactly this factor, which is why
 * rampRise below has to know about it.
 */
export const AIR_LIFT = 0.5;
/**
 * How far the camera will follow a climb, 74 -> 90 on 2026-09-10.
 *
 * 74 meant the lift stopped at 148 units up. That was ample while every launch
 * apexed under it, and it stopped being ample the moment the booters went to
 * real gravity: the big one now peaks at 180.
 *
 * Past the cap the camera freezes while the skier keeps climbing, so he sits
 * PINNED at the same screen row for 24 ticks either side of the apex and then
 * falls 63 pixels in the next 18 as the lift re-engages. Reported from play as
 * the flip causing a drop, which it does not — a flip never touches vy, and the
 * trajectory is identical tick for tick with and without one. The two only
 * coincide: a flip thrown near the apex finishes its 15 ticks just as the camera
 * lets go.
 *
 * 92 is the ceiling, and it is now touching both walls at once. The big booter
 * apexes at 180.7 and so needs 90.3 of lift; the skier's feet sit at 108 - lift
 * and he stands 16 tall, so a lift past 92 puts his head out of the top of the
 * buffer. 90 was tried first and the new camera test caught it short by a third
 * of a unit — which is the whole reason that test exists.
 *
 * That leaves 1.7 units of slack. It is thin on purpose rather than by neglect:
 * four rotations at real gravity spends the frame, and that was the trade taken
 * knowingly. A taller launch than this one cannot be drawn, and the test above
 * fails rather than letting it ship as a freeze.
 *
 * What this does NOT fix, because nothing can: the ground still leaves the
 * bottom of the frame above 144 units, which is inherent to a 180-unit apex in
 * a buffer 180 tall. Keeping the snow in shot up there would need a lift of 108,
 * and that puts the skier at screen row zero.
 */
export const AIR_LIFT_MAX = 92;

/** The camera's vertical offset for a skier `h` units above the piste. */
export const cameraAirLift = (h: number): number =>
  h <= 0 ? 0 : Math.min(h * AIR_LIFT, AIR_LIFT_MAX);

/**
 * How far the camera drops to show the slope ahead on steep ground. Feature 008.
 *
 * The skier sits 60% of the way down the frame, which leaves 72 units below him.
 * Every device is promised 213 units of course ahead (PLAYER_LOOKAHEAD), but on
 * ground steeper than about 0.41 the piste that far ahead is more than 72 below
 * him - so a log was still under the bottom edge when it was close enough to
 * see, and on the Narrows a player lost up to a third of the time the lookahead
 * was meant to buy (specs/008-reaction-time-speed/research.md R2). This drops the
 * view by exactly enough to show the piste across that 213 units, plus a margin,
 * and never more: it only makes visible what the horizontal lookahead already
 * promises, so every device still sees the same course (FR-257).
 *
 * Capped at AIR_LIFT_MAX, the ceiling the booters' headroom is already held to.
 * The camera adds it to the air lift and holds the sum to that same ceiling, so
 * the skier's head never leaves the frame (FR-258) and neither term's motion is
 * ever discarded (FR-261; see cameraFor).
 *
 * On the piste beneath an upper shelf it is capped again, so the shelf's top edge
 * stays inside the frame - the shelf reading as a choice outranks seeing a
 * little further down (research R3). That cap blends in over `shelfEaseIn` before
 * the shelf and out over the same distance after it, so it never snaps.
 *
 * Pure: a function of the course and an x. The piste is continuous, so this is
 * too, and the camera cannot jump because of it.
 */
export function lookDown(
  course: Course,
  x: number,
  onPiste: boolean,
  framing: CameraFraming,
): number {
  const drop = terrainYAt(course.terrain, x + PLAYER_LOOKAHEAD) - terrainYAt(course.terrain, x);
  const below = INTERNAL_HEIGHT * 0.4;
  let look = Math.min(Math.max(drop - below + framing.lookMargin, 0), AIR_LIFT_MAX);
  if (!onPiste) return look;

  const ease = framing.shelfEaseIn;
  for (const l of course.ledges) {
    if (x < l.x0 - ease || x >= l.x1 + ease) continue;
    const cap = INTERNAL_HEIGHT * 0.6 - l.height - framing.shelfMargin;
    // 0 outside the shelf's reach, 1 across it, linear in between.
    const weight =
      ease <= 0 ? 1 : x < l.x0 ? (x - (l.x0 - ease)) / ease : x >= l.x1 ? 1 - (x - l.x1) / ease : 1;
    look = Math.min(look, AIR_LIFT_MAX + (cap - AIR_LIFT_MAX) * weight);
  }
  return Math.max(look, 0);
}

/**
 * The look-down as the camera actually shows it: `lookDown`, followed at a
 * limited rate. Feature 008, FR-261.
 *
 * `lookDown` is a pure function of x, and on the ground that is all it needs.
 * In the air it is not: landing the small booter, the piste 213 ahead reaches the
 * big booter's steep run-in four ticks before touchdown, just as the air lift runs
 * out, and the camera's descent doubled in a tick. The ground looked as if it fell
 * away under a player timing his landing. So in the air it never grows, and
 * settles by at most `lookRateAir` a tick; on the snow it follows the target at up
 * to `lookRateGround`, which spreads that change over the roll-out instead.
 *
 * Advanced once per SIMULATION tick, never per frame, so the view is the same on
 * every display (FR-257). Deterministic: it reads only the states it is given. It
 * restarts at the target whenever the tick does not follow on from the last one,
 * which is what a new run looks like.
 */
export class LookFollower {
  private value = 0;
  private lastTick = Number.NaN;
  /** Ticks on the snow before this one; 0 in the air and on touchdown. */
  private groundedFor = Number.POSITIVE_INFINITY;

  constructor(
    private readonly course: Course,
    private readonly framing: CameraFraming,
  ) {}

  advance(state: RunState): number {
    const target = lookDown(this.course, state.x, state.ledge < 0, this.framing);
    if (state.tick !== this.lastTick + 1) {
      this.value = target;
    } else {
      // In the air it may settle but never grow: growing there adds to a fall the
      // air lift was absorbing, which is exactly the lurch. On the snow the
      // skier's own descent is slow, and that is where it catches up.
      // Nor on the tick of touchdown, which still carries the last of the fall,
      // and after it the rate builds over `lookRampTicks` while the landing settles.
      const settled = Math.min(this.groundedFor / Math.max(this.framing.lookRampTicks, 1), 1);
      const up = this.framing.lookRateGround * settled;
      const down = state.grounded ? this.framing.lookRateGround : this.framing.lookRateAir;
      this.value += Math.min(Math.max(target - this.value, -down), up);
    }
    this.lastTick = state.tick;
    this.groundedFor = state.grounded ? this.groundedFor + 1 : 0;
    return this.value;
  }

  /** The look-down as of the last tick advanced. */
  get current(): number {
    return this.value;
  }
}

/** A booter is a wedge you ride ALONG. A pop ramp is a lip you unweight off. */
export const isBooter = (k: Kicker): boolean => (k.launchAngle ?? 90) < 90;

/**
 * The angle a launch actually leaves the lip at, above horizontal, in radians.
 *
 * The skier arrives already travelling DOWNHILL - applyGroundedMotion sets his
 * velocity along the slope, not along the horizon - so the impulse has to spend
 * part of itself cancelling that descent before any of it becomes height. Leave
 * the term out and the answer comes back too steep, by 2.8 degrees on a pop ramp
 * and 6.6 on a booter, which is a wedge visibly steeper than the flight leaving
 * it. That was shipped once.
 *
 * Speed still cancels, which is what makes this usable as a drawn shape: the
 * carried speed and the impulse both scale with it. The slope does not cancel,
 * so a wedge is only correct for the gradient it stands on.
 */
export function flightAngle(k: Kicker, grade: number): number {
  const rad = ((k.launchAngle ?? 90) * Math.PI) / 180;
  const phi = Math.atan(grade);
  return Math.atan(
    (k.power * Math.sin(rad) - Math.sin(phi)) / (Math.cos(phi) + k.power * Math.cos(rad)),
  );
}

/** Terrain gradient at the lip, so a wedge can be built on the hill it stands on. */
export function gradeAtLip(course: Course, lip: number): number {
  return (terrainYAt(course.terrain, lip + 4) - terrainYAt(course.terrain, lip - 4)) / 8;
}

/**
 * How tall a ramp is DRAWN.
 *
 * Two rules, because there are two structures here. A shelf ramp is a POP: it
 * throws a skier off at 62 degrees to lift him a shelf's height in ninety-six
 * units, and no wedge with a 62-degree face could be built or ridden - it is a
 * lip he unweights off, and it keeps the modest bump it has always had, sized
 * by the ground its flight covers against the 210 units of an ordinary one.
 *
 * A booter is a WEDGE, and its face is the whole point. Height is not chosen
 * here at all: it falls out of the width and the angle the launch leaves at, so
 * the face the player rides up is the line he then flies along. Width is the
 * size knob, which is also how a real one is built bigger - longer and taller
 * at the same takeoff angle, not steeper.
 */
export function rampRise(k: Kicker, tuning: Tuning, course: Course): number {
  if (isBooter(k)) {
    const m = gradeAtLip(course, k.x + k.width);
    // Built against the flight AS DRAWN, not as flown, because the two are not
    // the same line and only one of them is ever seen.
    //
    // The camera lifts the skier up the frame as he gains height (AIR_LIFT), so
    // his rise ABOVE THE SNOW is compressed on screen by exactly that factor
    // while he is under the lift cap - which is all of the flight that matters
    // here. The wedge is drawn from the terrain and gets no such compression.
    // Match the world angles and the ramp comes out looking 2.2x steeper than
    // the launch leaving it, which it did: 22.9 degrees of wedge against 10.2
    // degrees of visible flight. Measured, twice, after twice being wrong about
    // it from algebra alone.
    //
    // Past the lift cap the compression stops and the apparent climb steepens
    // again, but that is deep in the flight; the seam that reads is the lip.
    const climb = m + Math.tan(flightAngle(k, m));
    return Math.round(k.width * climb * (1 - AIR_LIFT));
  }
  // Feature 006: carried speed is the terminal speed of whatever pitch the ramp
  // sits on, not a global constant. The ramp is DRAWN the size of the jump it
  // gives, so the same ramp on a steeper pitch is now drawn bigger — which is
  // correct, and is the whole point.
  const carried = terminalSpeedAtGradient(gradeAtLip(course, k.x + k.width), tuning, true);
  const impulse = Math.min(k.power * carried, tuning.kickerImpulseMax);
  const rad = ((k.launchAngle ?? 90) * Math.PI) / 180;
  const airTicks = (2 * impulse * Math.sin(rad)) / (tuning.gravity * (k.gravityScale ?? 1));
  const reach = airTicks * (carried + impulse * Math.cos(rad));
  return Math.round(19 * (reach / 210) ** 0.55);
}

/** How far past the lip the ramp's visual lift blends away. */
export const RAMP_FADE = 200;

/**
 * The lift a skier gets from RIDING a ramp, which the simulation does not model.
 *
 * The physics launches him from the terrain: a ramp is a lip test and its face
 * is not a surface, so drawn honestly he slides through the wedge at snow level
 * and is fired off the ground beside it. The renderer carries him up instead.
 *
 * Two things here exist to keep that from LOOKING disjointed, which is what it
 * did on the first cut. The face is straight for a booter, so the drawn climb
 * holds one angle - the flight's own - rather than a curve steepening to 49
 * degrees at the lip and then handing over to a 19-degree parabola. And the
 * blend past the lip is a smoothstep, which leaves the lip at zero rate: the
 * drawn slope at takeoff is exactly the real one, so there is no second kink
 * hiding where the lift starts coming off. A linear fade has a corner there,
 * and it was visible.
 *
 * None of this reaches the simulation - drawRun only ever reads state.
 */
export function rampLift(course: Course, tuning: Tuning, x: number, ledge: number): number {
  if (ledge >= 0) return 0; // ramps are built on the piste; a shelf sails over them
  let lift = 0;
  for (const k of course.kickers) {
    const lip = k.x + k.width;
    if (x < k.x || x > lip + RAMP_FADE) continue;
    const rise = rampRise(k, tuning, course);
    let here: number;
    if (x <= lip) {
      const t = (x - k.x) / k.width;
      here = isBooter(k) ? rise * t : rise * t * t;
    } else {
      const u = (x - lip) / RAMP_FADE;
      here = rise * (1 - (3 * u * u - 2 * u * u * u));
    }
    if (here > lift) lift = here;
  }
  return lift;
}
