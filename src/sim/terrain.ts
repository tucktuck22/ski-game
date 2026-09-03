/**
 * Terrain sampling. Lives in src/sim because it is part of the simulation and
 * must obey the same determinism rules as the rest of it.
 *
 * The profile is piecewise linear (research R3). That choice is what makes the
 * course validator's safe-release-window rule a scan over data rather than a
 * root-finding problem, and it keeps contact resolution to a segment lookup
 * plus a normalisation.
 */
import type { Course, TerrainPoint } from './types.js';
import { sqrtDet } from './math.js';

/** Index of the terrain segment containing x. Binary search — deterministic. */
export function segmentIndexAt(terrain: readonly TerrainPoint[], x: number): number {
  let lo = 0;
  let hi = terrain.length - 2;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((terrain[mid] as TerrainPoint).x <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Terrain surface height at x. */
export function terrainYAt(terrain: readonly TerrainPoint[], x: number): number {
  const i = segmentIndexAt(terrain, x);
  const a = terrain[i] as TerrainPoint;
  const b = terrain[i + 1] as TerrainPoint | undefined;
  if (b === undefined) return a.y;
  const span = b.x - a.x;
  if (span <= 0) return a.y;
  const t = (x - a.x) / span;
  return a.y + (b.y - a.y) * t;
}

export interface SlopeUnit {
  /** Unit vector pointing downhill along the surface. */
  ux: number;
  uy: number;
}

/**
 * Downhill unit vector of the segment containing x.
 *
 * uy is the sine of the slope angle, which is exactly what the downhill
 * acceleration term needs — so no trigonometry is required to get it.
 */
export function slopeAt(terrain: readonly TerrainPoint[], x: number): SlopeUnit {
  const i = segmentIndexAt(terrain, x);
  const a = terrain[i] as TerrainPoint;
  const b = terrain[i + 1] as TerrainPoint | undefined;
  if (b === undefined) return { ux: 1, uy: 0 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = sqrtDet(dx * dx + dy * dy);
  if (len === 0) return { ux: 1, uy: 0 };
  return { ux: dx / len, uy: dy / len };
}

/**
 * Overhead clearance available at x, or Infinity where nothing is overhead.
 *
 * Footprints are half-open, [x, x + width). The closed form put the obstacle's
 * trailing edge inside the safe-release window that starts there, so CV-4
 * flagged every low obstacle on both courses. Collision tests in step.ts use
 * the same convention, so a skier standing exactly on the trailing edge is
 * clear rather than ambiguously both.
 */
export function overheadClearanceAt(course: Course, x: number): number {
  let clearance = Infinity;
  for (const o of course.obstacles) {
    if (o.kind !== 'low') continue;
    if (x >= o.x && x < o.x + o.width && o.clearance < clearance) clearance = o.clearance;
  }
  return clearance;
}

/**
 * Surface height at x for a given track.
 *
 * `ledge` is -1 for the piste, otherwise an index into course.ledges. Because a
 * ledge is a constant offset above the piste, this is one subtraction — and the
 * slope of a ledge is the slope of the piste, so slopeAt needs no track
 * argument at all. That symmetry is the reason ledges were modelled this way
 * rather than as free polylines (see the Ledge doc comment).
 */
export function surfaceYAt(course: Course, x: number, ledge: number): number {
  const base = terrainYAt(course.terrain, x);
  if (ledge < 0) return base;
  const l = course.ledges[ledge];
  return l === undefined ? base : base - l.height;
}

/** True while x lies within the ledge's span. Half-open, like every footprint here. */
export function onLedgeSpan(course: Course, x: number, ledge: number): boolean {
  if (ledge < 0) return false;
  const l = course.ledges[ledge];
  return l !== undefined && x >= l.x0 && x < l.x1;
}

/**
 * Index of the ledge spanning x, or -1 where none does.
 *
 * Rocks and ice are anchored to "the shelf here" rather than to a named ledge,
 * which is only unambiguous because CV-12 forbids ledges from overlapping. The
 * validator earns this function.
 */
export function ledgeIndexAt(course: Course, x: number): number {
  for (let i = 0; i < course.ledges.length; i++) {
    const l = course.ledges[i] as { x0: number; x1: number };
    if (x >= l.x0 && x < l.x1) return i;
  }
  return -1;
}

/** Index of the ice section containing x, or -1. */
export function iceIndexAt(course: Course, x: number): number {
  for (let i = 0; i < course.ice.length; i++) {
    const sec = course.ice[i] as { x0: number; x1: number };
    if (x >= sec.x0 && x < sec.x1) return i;
  }
  return -1;
}
