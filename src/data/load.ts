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
  sprites: SpriteManifest;
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

/** One pose of a sprite sheet: the cells it cycles, and how long each is held. */
export interface SpritePose {
  /** 0-based cell indices, row-major across the sheet. */
  cells: number[];
  /** Simulation ticks each cell is held. Absent means a static, single-cell pose. */
  holdTicks?: number;
}

export interface SpriteSheet {
  id: string;
  /** Filename only. The base path is applied at load, never stored here - see below. */
  file: string;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  /** Draw origin within a cell, in cell pixels. Integer: a half-pixel anchor resamples. */
  anchorX: number;
  anchorY: number;
  poses: Record<string, SpritePose>;
}

export interface SpriteManifest {
  sheets: SpriteSheet[];
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

/**
 * Every pose the skier renderer can select. The manifest is where this is
 * checkable, because a pose the code asks for and the sheet lacks is otherwise
 * a blank frame at speed rather than an error at build time (FR-165).
 *
 * Kept as a literal list rather than imported from src/render: src/data is
 * loaded by the simulation-side tests too, and this file should not drag the
 * renderer in behind it.
 */
const REQUIRED_SKIER_POSES: readonly string[] = [
  'carveShallow',
  'carveMid',
  'carveSteep',
  'crouchShallow',
  'crouchMid',
  'crouchSteep',
  'launch',
  'air',
  'tuck',
  'spin',
  'absorbShallow',
  'absorbMid',
  'absorbSteep',
  'wipeout',
];

const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0;

const isNonNegativeInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0;

/**
 * FR-160, FR-173 and contracts/sprite-manifest.md: the manifest declares the
 * sprites, and a bad manifest is a build-time defect rather than a runtime
 * fallback. This is parseAudio()'s stance, applied identically and for the same
 * reasons.
 *
 * The bare-filename rule is the one worth reading twice. Storing a path here
 * would let a manifest carry `/sprites/x.png`, which works in dev and 404s
 * under the production base path - and unlike a blank page, a missing sprite
 * fails SILENTLY, because FR-172 requires the run to carry on without it.
 * Keeping the base a single decision in a single place (src/render/sprites.ts)
 * is what prevents it.
 */
export function parseSprites(raw: unknown): SpriteManifest {
  const o = raw as { sheets?: unknown };
  if (!Array.isArray(o.sheets) || o.sheets.length === 0)
    throw new Error('sprites.json: "sheets" must be a non-empty array');

  const seenIds = new Set<string>();
  const sheets = o.sheets.map((entry, i): SpriteSheet => {
    const t = entry as Partial<SpriteSheet>;
    const where = `sprites.json: sheet ${i}`;

    if (typeof t.id !== 'string' || t.id === '') throw new Error(`${where}: "id" must be a string`);
    if (seenIds.has(t.id)) throw new Error(`sprites.json: duplicate sheet id "${t.id}"`);
    seenIds.add(t.id);

    const named = `sprites.json: sheet "${t.id}"`;

    if (typeof t.file !== 'string' || !t.file.endsWith('.png'))
      throw new Error(`${named}: "file" must be a filename ending .png`);
    if (t.file.includes('/'))
      throw new Error(
        `${named}: "file" must be a bare filename, not a path - the base path is ` +
          'applied at load so it stays one decision in one place',
      );

    for (const k of ['cellWidth', 'cellHeight', 'columns'] as const) {
      if (!isPositiveInt(t[k])) throw new Error(`${named}: "${k}" must be a positive integer`);
    }
    // Anchors are integers because a fractional anchor puts the sprite on a
    // half-pixel, which resamples and breaks LW-1's one-device-pixel linework.
    if (!isNonNegativeInt(t.anchorX) || (t.anchorX as number) > (t.cellWidth as number))
      throw new Error(`${named}: "anchorX" must be an integer within the cell`);
    if (!isNonNegativeInt(t.anchorY) || (t.anchorY as number) > (t.cellHeight as number))
      throw new Error(`${named}: "anchorY" must be an integer within the cell`);

    if (typeof t.poses !== 'object' || t.poses === null || Array.isArray(t.poses))
      throw new Error(`${named}: "poses" must be an object`);
    const poseNames = Object.keys(t.poses as Record<string, unknown>);
    if (poseNames.length === 0) throw new Error(`${named}: "poses" must not be empty`);

    const poses: Record<string, SpritePose> = {};
    for (const name of poseNames) {
      const p = (t.poses as Record<string, Partial<SpritePose>>)[name] as Partial<SpritePose>;
      if (!Array.isArray(p.cells) || p.cells.length === 0)
        throw new Error(`${named}: pose "${name}" must list at least one cell`);
      for (const c of p.cells) {
        if (!isNonNegativeInt(c))
          throw new Error(`${named}: pose "${name}" cell index must be an integer >= 0`);
      }
      if (p.holdTicks !== undefined && !isPositiveInt(p.holdTicks))
        throw new Error(`${named}: pose "${name}" "holdTicks" must be a positive integer`);
      poses[name] = {
        cells: [...p.cells],
        ...(p.holdTicks !== undefined ? { holdTicks: p.holdTicks } : {}),
      };
    }

    if (t.id === 'skier') {
      for (const required of REQUIRED_SKIER_POSES) {
        if (poses[required] === undefined)
          throw new Error(`sprites.json: sheet "skier" is missing required pose "${required}"`);
      }
    }

    return {
      id: t.id,
      file: t.file,
      cellWidth: t.cellWidth as number,
      cellHeight: t.cellHeight as number,
      columns: t.columns as number,
      anchorX: t.anchorX as number,
      anchorY: t.anchorY as number,
      poses,
    };
  });

  return { sheets };
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
  sprites: unknown;
}): GameData {
  const tuning = parseTuning(input.tuning);
  const scoring = parseScoring(input.scoring);
  const audio = parseAudio(input.audio);
  const sprites = parseSprites(input.sprites);
  const warmup = parseCourse(input.warmup);
  const official = parseCourse(input.official);
  if (!Array.isArray(input.insults) || input.insults.length === 0)
    throw new Error('insults.json must be a non-empty array');

  assertCourseValid(warmup, tuning, scoring);
  assertCourseValid(official, tuning, scoring);

  if (warmup.id === official.id)
    throw new Error('warm-up and official courses must be distinct (FR-028)');

  return {
    tuning,
    scoring,
    warmup,
    official,
    insults: input.insults as string[],
    audio,
    sprites,
  };
}
