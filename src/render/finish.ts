/**
 * The finish: the ground past the line, the coast to a stop, and the crowd.
 * Feature 009, specs/009-finish-line-crowd.
 *
 * Everything here is drawing. The simulation ends a run on the tick the skier
 * reaches the course's length, exactly as it always has; what happens after
 * that is this file's, in the way the wipeout's tumble is death.ts's. Nothing in
 * src/sim may import it (contract F7), so nothing here can reach a run, a score
 * or the rules version (FR-264).
 */
import type { Course } from '../sim/types.js';
import type { FinishConfig } from '../data/load.js';
import { terrainYAt } from '../sim/terrain.js';

/** The slope of the course where it ends: the segment the line stands on. */
function slopeAtLine(course: Course): number {
  const L = course.length;
  return terrainYAt(course.terrain, L) - terrainYAt(course.terrain, L - 1);
}

/** Spacing of the run-out's points: close enough that no joint reads as a corner. */
const RUNOUT_STEP = 4;
/** How far the flat beyond the run-out is carried, past anything a camera shows. */
const FLAT_REACH = 5000;

const shownCache = new WeakMap<Course, WeakMap<FinishConfig, Course>>();

/**
 * The course as the renderer draws it: identical up to the line, then a run-out
 * that eases to flat (research R1).
 *
 * The data cannot carry the run-out. Both courses end on 0.6 ground that kinks
 * flat 200 units past the line, and flat ground in the data fails CV-23 and B8,
 * which check every segment. So the renderer and the camera draw from this copy
 * and the simulation keeps riding the original, which it only ever reads up to
 * the line. Up to the line the terrain is the course's own points, untouched -
 * exactly, not approximately (F1) - and past it the points follow a quadratic
 * with the course's slope at the line and none at `runoutEase`. On its last tick
 * the simulation can travel one tick past the line before it clamps; over that
 * stretch the two grounds differ by under 0.25 units.
 */
export function withRunout(course: Course, cfg: FinishConfig): Course {
  let byCfg = shownCache.get(course);
  if (!byCfg) shownCache.set(course, (byCfg = new WeakMap()));
  const hit = byCfg.get(cfg);
  if (hit) return hit;

  const L = course.length;
  const y0 = terrainYAt(course.terrain, L);
  const g = slopeAtLine(course);
  const E = cfg.runoutEase;
  const terrain = course.terrain.filter((p) => p.x < L);
  terrain.push({ x: L, y: y0 });
  for (let u = RUNOUT_STEP; u < E; u += RUNOUT_STEP)
    terrain.push({ x: L + u, y: y0 + g * u - (g * u * u) / (2 * E) });
  const yEnd = y0 + (g * E) / 2;
  terrain.push({ x: L + E, y: yEnd }, { x: L + E + FLAT_REACH, y: yEnd });

  const shown: Course = { ...course, terrain };
  byCfg.set(cfg, shown);
  return shown;
}

/** The drawn ground's height at x: the course's own up to the line, the run-out past it. */
export function groundY(course: Course, x: number, cfg: FinishConfig): number {
  return terrainYAt(withRunout(course, cfg).terrain, x);
}
