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
  audio: AudioManifest;
}

/** The one condition under which a music track is the one that should be audible. */
export type PlaybackContext = 'frontEnd' | 'course';

export interface MusicTrack {
  id: string;
  /** Filename only. The base path is applied at load, never stored here - see below. */
  file: string;
  context: PlaybackContext;
  gain: number;
  /** Seconds. Present only where the loop join is actually heard (research.md R1). */
  loopStart?: number;
  loopEnd?: number;
}

export interface AudioManifest {
  tracks: MusicTrack[];
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
  'spinDurationTicks',
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
  'iceCrumbleTicks',
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

const CONTEXTS: readonly PlaybackContext[] = ['frontEnd', 'course'];

/**
 * FR-149 and data-model.md: the manifest declares the music, and a bad manifest is
 * a build-time defect rather than a runtime fallback.
 *
 * `file` must be a bare filename. Storing a path here would let a manifest carry
 * `/audio/x.mp3`, which works in dev and 404s under the production base path - the
 * exact defect class recorded in vite.config.ts. Keeping the base a single decision
 * in a single place (src/audio/music.ts) is what prevents it.
 */
export function parseAudio(raw: unknown): AudioManifest {
  const o = raw as { tracks?: unknown };
  if (!Array.isArray(o.tracks)) throw new Error('audio.json: "tracks" must be an array');

  const seenIds = new Set<string>();
  const seenContexts = new Set<string>();
  const tracks = o.tracks.map((entry, i): MusicTrack => {
    const t = entry as Partial<MusicTrack>;
    const where = `audio.json: track ${i}`;

    if (typeof t.id !== 'string' || t.id === '') throw new Error(`${where}: "id" must be a string`);
    if (seenIds.has(t.id)) throw new Error(`audio.json: duplicate track id "${t.id}"`);
    seenIds.add(t.id);

    if (typeof t.file !== 'string' || !t.file.endsWith('.mp3'))
      throw new Error(`${where} (${t.id}): "file" must be a filename ending .mp3`);
    if (t.file.includes('/'))
      throw new Error(
        `${where} (${t.id}): "file" must be a bare filename, not a path - the base ` +
          'path is applied at load so it stays one decision in one place',
      );

    if (!CONTEXTS.includes(t.context as PlaybackContext))
      throw new Error(`${where} (${t.id}): "context" must be one of ${CONTEXTS.join(', ')}`);
    if (seenContexts.has(t.context as string))
      throw new Error(
        `audio.json: two tracks claim the "${t.context}" context. Exactly one music ` +
          'track may be audible at a time (FR-138), so each context has exactly one.',
      );
    seenContexts.add(t.context as string);

    if (typeof t.gain !== 'number' || !(t.gain > 0) || t.gain > 1)
      throw new Error(`${where} (${t.id}): "gain" must be a number in (0, 1]`);

    const hasStart = t.loopStart !== undefined;
    const hasEnd = t.loopEnd !== undefined;
    if (hasStart !== hasEnd)
      throw new Error(`${where} (${t.id}): "loopStart" and "loopEnd" must be given together`);
    if (hasStart) {
      const start = t.loopStart as number;
      const end = t.loopEnd as number;
      if (!Number.isFinite(start) || start < 0)
        throw new Error(`${where} (${t.id}): "loopStart" must be a finite number >= 0`);
      if (!Number.isFinite(end) || end <= start)
        throw new Error(
          `${where} (${t.id}): "loopEnd" must be a finite number greater than "loopStart"`,
        );
    }

    return {
      id: t.id,
      file: t.file,
      context: t.context as PlaybackContext,
      gain: t.gain,
      ...(hasStart ? { loopStart: t.loopStart as number, loopEnd: t.loopEnd as number } : {}),
    };
  });

  for (const c of CONTEXTS) {
    if (!seenContexts.has(c))
      throw new Error(`audio.json: no track declares the "${c}" context. Both are required.`);
  }

  return { tracks };
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
    // Both are upper-track features, so a course with no shelves has none of
    // either and the validator says nothing about them.
    rocks: o.rocks ?? [],
    ice: o.ice ?? [],
  };
}

/** Assembles and validates everything. Throws rather than shipping a bad course. */
export function assembleGameData(input: {
  tuning: unknown;
  scoring: unknown;
  warmup: unknown;
  official: unknown;
  insults: unknown;
  audio: unknown;
}): GameData {
  const tuning = parseTuning(input.tuning);
  const scoring = parseScoring(input.scoring);
  const audio = parseAudio(input.audio);
  const warmup = parseCourse(input.warmup);
  const official = parseCourse(input.official);
  if (!Array.isArray(input.insults) || input.insults.length === 0)
    throw new Error('insults.json must be a non-empty array');

  assertCourseValid(warmup, tuning, scoring);
  assertCourseValid(official, tuning, scoring);

  if (warmup.id === official.id)
    throw new Error('warm-up and official courses must be distinct (FR-028)');

  return { tuning, scoring, warmup, official, insults: input.insults as string[], audio };
}
