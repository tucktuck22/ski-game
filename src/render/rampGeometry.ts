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
import type { Course, Kicker, Tuning } from '../sim/types.js';
import { terrainYAt } from '../sim/terrain.js';

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
export const AIR_LIFT_MAX = 74;

/** The camera's vertical offset for a skier `h` units above the piste. */
export const cameraAirLift = (h: number): number =>
  h <= 0 ? 0 : Math.min(h * AIR_LIFT, AIR_LIFT_MAX);

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
  const impulse = Math.min(k.power * tuning.tuckSpeedMax, tuning.kickerImpulseMax);
  const rad = ((k.launchAngle ?? 90) * Math.PI) / 180;
  const airTicks = (2 * impulse * Math.sin(rad)) / (tuning.gravity * (k.gravityScale ?? 1));
  const reach = airTicks * (tuning.tuckSpeedMax + impulse * Math.cos(rad));
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
