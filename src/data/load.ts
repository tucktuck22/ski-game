/**
 * Loads the versioned data files. Courses, tuning, scoring, and insults are all
 * data rather than code (FR-036), so feel can be changed without a recompile.
 */
import type { Course, Scoring, Tuning } from '../sim/types.js';
import { assertCourseValid } from '../course/validate.js';

export interface GameData {
  tuning: Tuning;
  scoring: Scoring;
  warmup: Course;
  official: Course;
  insults: string[];
}

const REQUIRED_TUNING_KEYS: ReadonlyArray<keyof Tuning> = [
  'baseSpeed',
  'tuckSpeedMax',
  'tuckAccel',
  'tuckDecel',
  'slopeAccelFactor',
  'gravity',
  'launchImpulseMin',
  'launchImpulseMax',
  'chargeTicksToMax',
  'rotationRateMax',
  'airControlFactor',
  'landingAngleTolerance',
  'landingAngleToleranceForgiving',
  'collisionSpeedThreshold',
  'standHeight',
  'crouchHeight',
  'crouchTransitionTicks',
  'safeReleaseWindowMin',
  'branchThickness',
  'kickerImpulseMax',
];

const REQUIRED_SCORING_KEYS: ReadonlyArray<keyof Scoring> = [
  'completionBase',
  'progressPerUnit',
  'pickupSmall',
  'pickupLarge',
  'trickPerRotation',
];

export function parseTuning(raw: unknown): Tuning {
  const o = raw as Record<string, unknown>;
  for (const k of REQUIRED_TUNING_KEYS) {
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k]))
      throw new Error(`tuning.json: "${k}" must be a finite number`);
  }
  return o as unknown as Tuning;
}

export function parseScoring(raw: unknown): Scoring {
  const o = raw as Record<string, unknown>;
  for (const k of REQUIRED_SCORING_KEYS) {
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k]))
      throw new Error(`scoring.json: "${k}" must be a finite number`);
  }
  return o as unknown as Scoring;
}

export function parseCourse(raw: unknown): Course {
  const o = raw as Partial<Course>;
  if (typeof o.id !== 'string') throw new Error('course: "id" must be a string');
  if (typeof o.rulesVersion !== 'string')
    throw new Error(`course ${o.id}: "rulesVersion" must be a string`);
  if (typeof o.length !== 'number') throw new Error(`course ${o.id}: "length" must be a number`);
  if (!Array.isArray(o.terrain)) throw new Error(`course ${o.id}: "terrain" must be an array`);
  return {
    id: o.id,
    rulesVersion: o.rulesVersion,
    length: o.length,
    terrain: o.terrain,
    obstacles: o.obstacles ?? [],
    pickups: o.pickups ?? [],
    // Both default to empty: a course with no upper track and no ramps is still
    // a valid course, and the warm-up deliberately has fewer of each.
    ledges: o.ledges ?? [],
    kickers: o.kickers ?? [],
  };
}

/** Assembles and validates everything. Throws rather than shipping a bad course. */
export function assembleGameData(input: {
  tuning: unknown;
  scoring: unknown;
  warmup: unknown;
  official: unknown;
  insults: unknown;
}): GameData {
  const tuning = parseTuning(input.tuning);
  const scoring = parseScoring(input.scoring);
  const warmup = parseCourse(input.warmup);
  const official = parseCourse(input.official);
  if (!Array.isArray(input.insults) || input.insults.length === 0)
    throw new Error('insults.json must be a non-empty array');

  assertCourseValid(warmup, tuning, scoring);
  assertCourseValid(official, tuning, scoring);

  if (warmup.id === official.id)
    throw new Error('warm-up and official courses must be distinct (FR-028)');

  return { tuning, scoring, warmup, official, insults: input.insults as string[] };
}
