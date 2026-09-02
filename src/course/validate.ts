/**
 * Course validator. Rules CV-1 to CV-9 of contracts/course-data.md, run in CI
 * over every course file. The build fails on any violation.
 *
 * CV-4 is the reason this file exists. FR-088 makes releasing a crouch under a
 * low obstacle fatal, and ducking requires crouching, so a cautious player
 * cannot opt out of the mechanic. A single low obstacle placed just before a
 * long tunnel makes the course unfinishable for exactly the players FR-035
 * protects — and it is invisible to review. It would surface as one friend
 * saying the game is broken, after the draft had already started.
 */
import type { Course, Obstacle, Scoring, TerrainPoint, Tuning } from '../sim/types.js';
import { overheadClearanceAt } from '../sim/terrain.js';
import { maxAchievableBonus } from '../sim/scoring.js';

export interface Violation {
  rule: string;
  message: string;
}

function unit(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  return len === 0 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

/** Steepest segment the contact solver resolves cleanly: 60 degrees, as a gradient. */
const MAX_GRADIENT = 1.732;

/** Ceiling on rotations a single maximum-charge air could plausibly produce. */
const TRICK_CEILING = 4;

export function validateCourse(
  course: Course,
  tuning: Tuning,
  scoring: Scoring,
): Violation[] {
  const v: Violation[] = [];
  const t = course.terrain;

  // CV-1: terrain well-formed
  if (t.length < 2) v.push({ rule: 'CV-1', message: 'terrain needs at least two points' });
  if (t.length > 0 && (t[0] as TerrainPoint).x !== 0)
    v.push({ rule: 'CV-1', message: 'terrain must start at x = 0' });
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1] as TerrainPoint;
    const b = t[i] as TerrainPoint;
    if (b.x <= a.x)
      v.push({ rule: 'CV-1', message: `terrain x must strictly increase (index ${i}: ${a.x} -> ${b.x})` });
  }
  const last = t[t.length - 1] as TerrainPoint | undefined;
  if (last && last.x < course.length)
    v.push({ rule: 'CV-1', message: `terrain ends at x=${last.x}, before the finish at ${course.length}` });

  // CV-2: no segment too steep to resolve
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1] as TerrainPoint;
    const b = t[i] as TerrainPoint;
    const dx = b.x - a.x;
    if (dx <= 0) continue;
    const gradient = Math.abs((b.y - a.y) / dx);
    if (gradient > MAX_GRADIENT)
      v.push({ rule: 'CV-2', message: `segment at x=${a.x} has gradient ${gradient.toFixed(2)}, over ${MAX_GRADIENT}` });
  }

  // CV-10: adjacent segments must not differ in slope by more than the landing
  // tolerance. This rule was added after the simulation proved it was needed.
  // FR-089 guarantees somewhere to stand up after a low obstacle, but standing
  // up IS a launch (FR-078), so the cautious player who ducks is airborne
  // whether he wants to be or not. If the next segment tilts away from the one
  // he launched from by more than landingAngleTolerance, he wipes out on
  // landing through no fault of his own - and CV-7's promise that the course is
  // completable at base speed would be false.
  const cosLandingTolerance = Math.cos(tuning.landingAngleTolerance);
  for (let i = 2; i < t.length; i++) {
    const a = t[i - 2] as TerrainPoint;
    const b = t[i - 1] as TerrainPoint;
    const c = t[i] as TerrainPoint;
    const u1 = unit(b.x - a.x, b.y - a.y);
    const u2 = unit(c.x - b.x, c.y - b.y);
    const alignment = u1.x * u2.x + u1.y * u2.y;
    if (alignment < cosLandingTolerance)
      v.push({
        rule: 'CV-10',
        message:
          `terrain bends too sharply at x=${b.x}: adjacent segments differ by more than ` +
          `landingAngleTolerance (${tuning.landingAngleTolerance} rad), so a player launched ` +
          'from the first cannot land cleanly on the second (FR-089, CV-7).',
      });
  }

  const lows = course.obstacles
    .filter((o): o is Obstacle => o.kind === 'low')
    .slice()
    .sort((a, b) => a.x - b.x);

  // CV-3: a low obstacle must be passable crouched and impassable standing
  for (const o of lows) {
    if (o.clearance <= tuning.crouchHeight)
      v.push({ rule: 'CV-3', message: `low obstacle at x=${o.x} has clearance ${o.clearance} <= crouchHeight ${tuning.crouchHeight}: impassable` });
    if (o.clearance >= tuning.standHeight)
      v.push({ rule: 'CV-3', message: `low obstacle at x=${o.x} has clearance ${o.clearance} >= standHeight ${tuning.standHeight}: pointless, it never forces a crouch` });
  }

  // CV-4: every low obstacle is followed by a safe release window
  for (const o of lows) {
    const windowStart = o.x + o.width;
    const windowEnd = windowStart + tuning.safeReleaseWindowMin;
    let blockedAt: number | null = null;
    for (let x = windowStart; x <= windowEnd; x += 1) {
      if (overheadClearanceAt(course, x) < tuning.standHeight) {
        blockedAt = x;
        break;
      }
    }
    if (blockedAt !== null)
      v.push({
        rule: 'CV-4',
        message:
          `low obstacle at x=${o.x} has no safe release window: overhead is blocked again at ` +
          `x=${blockedAt}, only ${blockedAt - windowStart} units clear, needs ${tuning.safeReleaseWindowMin}. ` +
          'A player who ducks here has nowhere to stand up (FR-089).',
      });
  }

  // CV-5: low obstacles not packed closer than the release window
  for (let i = 1; i < lows.length; i++) {
    const prev = lows[i - 1] as Obstacle;
    const cur = lows[i] as Obstacle;
    // Footprints are half-open, matching overheadClearanceAt and step.ts.
    const gap = cur.x - (prev.x + prev.width);
    if (gap < tuning.safeReleaseWindowMin)
      v.push({ rule: 'CV-5', message: `low obstacles at x=${prev.x} and x=${cur.x} are ${gap} apart, under ${tuning.safeReleaseWindowMin}` });
  }

  // CV-6: breaking a barrier must beat going around it
  for (const b of course.barriers) {
    if (b.bypassCostTicks <= 0)
      v.push({ rule: 'CV-6', message: `barrier at x=${b.x} has bypassCostTicks ${b.bypassCostTicks}: bypassing costs nothing, so attack has no reason to exist (FR-081)` });
  }

  // CV-7: completable at base speed, crouching only where CV-3 demands it
  for (const o of course.obstacles) {
    if (o.kind !== 'solid') continue;
    const overlapping = lows.find((l) => o.x < l.x + l.width && l.x < o.x + o.width);
    if (overlapping)
      v.push({ rule: 'CV-7', message: `solid obstacle at x=${o.x} overlaps a low obstacle: no survivable line` });
  }

  // CV-11: a solid obstacle must be jumpable by someone who is not already
  // committed elsewhere. Solid obstacles are cleared by launching over them,
  // and launching means charging a crouch first - so a solid placed inside the
  // release window after a tunnel would force the player to choose between
  // standing up (FR-088 kills him) and staying ducked (he hits the block).
  // Neither is survivable, and CV-7's promise would be false.
  for (const o of course.obstacles) {
    if (o.kind !== 'solid') continue;
    for (const l of lows) {
      const windowEnd = l.x + l.width + tuning.safeReleaseWindowMin;
      if (o.x < windowEnd && o.x + o.width > l.x - tuning.safeReleaseWindowMin)
        v.push({
          rule: 'CV-11',
          message:
            `solid obstacle at x=${o.x} sits within the safe release window of the low obstacle ` +
            `at x=${l.x}. The player would have to either stand up under the tunnel (FR-088) or ` +
            'stay ducked into the block. Neither is survivable.',
        });
    }
  }

  // CV-8: FR-034 dominance — a finish must beat any wipeout
  const maxBonus = maxAchievableBonus(course, scoring, TRICK_CEILING);
  if (scoring.completionBase <= maxBonus)
    v.push({
      rule: 'CV-8',
      message:
        `completionBase ${scoring.completionBase} does not exceed the maximum achievable bonus ` +
        `${maxBonus}. FR-034 requires every finisher to outrank every non-finisher.`,
    });

  // CV-9: nothing placed off the reachable surface
  for (const p of course.pickups) {
    if (p.x < 0 || p.x > course.length)
      v.push({ rule: 'CV-9', message: `pickup at x=${p.x} is outside the course` });
    if (p.y > 0)
      v.push({ rule: 'CV-9', message: `pickup at x=${p.x} has y=${p.y}: below the surface, unreachable` });
    if (p.y < -60)
      v.push({ rule: 'CV-9', message: `pickup at x=${p.x} is ${-p.y} above the surface: beyond any launch` });
  }

  return v;
}

export function assertCourseValid(course: Course, tuning: Tuning, scoring: Scoring): void {
  const violations = validateCourse(course, tuning, scoring);
  if (violations.length > 0) {
    const detail = violations.map((x) => `  [${x.rule}] ${x.message}`).join('\n');
    throw new Error(`Course "${course.id}" failed validation:\n${detail}`);
  }
}
