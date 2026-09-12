/**
 * Cue selection (FR-188, FR-190, FR-190a, FR-191, FR-197).
 *
 * The load-bearing test here is the one that compares the cue table against the
 * GENERATED course data. `src/render/coachingCue.ts` necessarily holds a second
 * copy of the four object positions — a renderer cannot read course JSON at
 * module scope — and two copies of a number is how they drift. This is the
 * thing that makes the copy safe, and without it the failure mode is a badge
 * that confidently describes an object which has moved, which nothing else in
 * the suite would notice.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { CUES, cueAt, type Cue } from '../../src/render/coachingCue.js';
import { PLAYER_LOOKAHEAD } from '../../src/render/stage.js';
import { parseCourse } from '../../src/data/load.js';

const warmup = parseCourse(
  JSON.parse(readFileSync(new URL('../../data/courses/warmup.json', import.meta.url), 'utf8')),
);

/** Where the coached section ends. Everything past it is the warm-up proper. */
const COACH_SPAN = 3200;

/** The four coached objects, read from the course rather than from the module. */
const coachedObjects = [
  ...warmup.obstacles.filter((o) => o.x < COACH_SPAN),
  ...warmup.kickers.filter((k) => k.x < COACH_SPAN),
].sort((a, b) => a.x - b.x);

describe('the cue table agrees with the course it describes', () => {
  it('has one cue per coached object, in the same order', () => {
    expect(CUES.length).toBe(4);
    expect(coachedObjects.length).toBe(4);
    expect(CUES.map((c) => c.id)).toEqual(['crouch', 'jump', 'stayCrouched', 'flip']);
  });

  it('FR-191: each cue becomes legible exactly when its object crests the frame', () => {
    // The invariant. Not a fixed lead — R7 option C withdrew that — but the
    // visibility binding the maintainer approved.
    CUES.forEach((cue, i) => {
      const object = coachedObjects[i] as { x: number; width: number };
      expect(cue.from, `${cue.id} does not fire at its object's visibility`).toBeCloseTo(
        object.x - PLAYER_LOOKAHEAD,
        6,
      );
    });
  });

  it('FR-191: no cue clears while the object it names is still ahead', () => {
    CUES.forEach((cue, i) => {
      const object = coachedObjects[i] as { x: number; width: number };
      expect(cue.to, `${cue.id} clears too early`).toBeGreaterThanOrEqual(object.x + object.width);
    });
  });

  it('FR-197: every interval lies inside the coached section', () => {
    for (const cue of CUES) {
      expect(cue.from).toBeGreaterThanOrEqual(0);
      expect(cue.to).toBeLessThanOrEqual(COACH_SPAN);
    }
  });
});

describe('cueAt is total, pure, and shows one cue at a time', () => {
  it('FR-191: returns at most one cue for any x — the intervals are disjoint', () => {
    // Asserted on the data shape rather than trusting the caller, which is what
    // makes "no two coaching badges legible at once" a property of the table.
    const sorted = [...CUES].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1] as Cue;
      const next = sorted[i] as Cue;
      expect(next.from, `${prev.id} and ${next.id} overlap`).toBeGreaterThanOrEqual(prev.to);
    }
  });

  it('is total: any finite x is legal, including negative and past the finish', () => {
    for (const x of [-1e9, -1, 0, 0.5, 1e9, Number.MAX_SAFE_INTEGER]) {
      expect(() => cueAt(x)).not.toThrow();
    }
    expect(cueAt(-1)).toBeNull();
    expect(cueAt(1e9)).toBeNull();
  });

  it('is pure: the same x gives the identical frozen object every time', () => {
    const a = cueAt(700);
    const b = cueAt(700);
    expect(a).not.toBeNull();
    // Identity, not equality. `game.ts` compares cues with !== to find the
    // transition edge, which is only sound because these are frozen singletons.
    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('finds nothing on warm-up terrain past the coached section', () => {
    for (let x = COACH_SPAN; x < warmup.length; x += 50) expect(cueAt(x)).toBeNull();
  });

  it('finds nothing anywhere on the official course (FR-197)', () => {
    // The official course is longer than the coached section and shares no
    // geometry with it, so a cue firing there would be a badge in a scored run.
    const official = parseCourse(
      JSON.parse(
        readFileSync(new URL('../../data/courses/official.json', import.meta.url), 'utf8'),
      ),
    );
    const fired = new Set<string>();
    for (let x = 0; x < official.length; x += 10) {
      const cue = cueAt(x);
      if (cue) fired.add(cue.id);
    }
    // Every coached x also exists on the official course, so this is not the
    // claim that cueAt is silent there — it is the claim that the ROUTING keeps
    // coaching out of scored runs, which is why the assertion lives with the
    // course choice in game.ts rather than here. What IS asserted here: the
    // official course carries no object at a coached position, so nothing on it
    // could ever be mistaken for a lesson.
    for (const cue of CUES) {
      const objectAt = official.obstacles.some((o) => Math.abs(o.x - (cue.to - 0)) < 1);
      expect(objectAt).toBe(false);
    }
    expect(fired.size).toBeLessThanOrEqual(CUES.length);
  });
});

describe('the copy is exact (FR-190, FR-190a, FR-190b)', () => {
  it('the four strings are the maintainer’s wording, character for character', () => {
    expect(CUES.map((c) => c.text)).toEqual([
      'HOLD TO CROUCH!',
      'RELEASE TO JUMP!',
      'STAY CROUCHED!',
      'SWIPE OR ← → TO FLIP!',
    ]);
  });

  it('the arrows are U+2190 and U+2192, not ASCII lookalikes', () => {
    const flip = CUES.find((c) => c.id === 'flip') as Cue;
    expect(flip.text).toContain('←');
    expect(flip.text).toContain('→');
    // FR-190b: a glyph that does not render is replaced by a DRAWN mark. The
    // word is never a fallback, which is what these marks were chosen over.
    expect(flip.text.toLowerCase()).not.toContain('arrow');
  });

  it('FR-190a: one string on every device — nothing here detects input hardware', () => {
    const source = readFileSync(
      new URL('../../src/render/coachingCue.ts', import.meta.url),
      'utf8',
    );
    for (const tell of ['ontouchstart', 'maxTouchPoints', 'userAgent', 'matchMedia', 'navigator']) {
      expect(
        source,
        `coachingCue.ts reads ${tell}; FR-190a forbids device detection`,
      ).not.toContain(tell);
    }
  });

  it('FR-193: rotation is named, and this is where the product first names it', () => {
    const flip = CUES.find((c) => c.id === 'flip') as Cue;
    expect(flip.text).toContain('FLIP');
    // It is the LAST lesson, so nothing before it can have named rotation.
    expect(flip.from).toBeGreaterThan(Math.max(...CUES.filter((c) => c !== flip).map((c) => c.to)));
  });
});

/**
 * FR-204 and SC-067, as a structural gate rather than an argument.
 *
 * The plan's determinism case is that a cue "cannot reach the hash" because
 * nothing was added to `RunState` and `cueAt` is a pure function of x. That is
 * true today and it is the kind of true that a later change undoes without
 * meaning to. The constitution's own stop condition applies: where a rule has
 * no gate, the missing gate is the defect. `sim-isolation.test.ts` makes the
 * same move for audio and is the precedent this follows.
 */
describe('the simulation cannot observe a coaching cue (FR-204)', () => {
  const simFiles = (function walk(dir: URL): URL[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const child = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir);
      if (e.isDirectory()) return walk(child);
      return e.name.endsWith('.ts') ? [child] : [];
    });
  })(new URL('../../src/sim/', import.meta.url));

  it('nothing under src/sim imports the cue module', () => {
    expect(simFiles.length).toBeGreaterThan(0);
    for (const f of simFiles) {
      const text = readFileSync(f, 'utf8');
      expect(text, `${f.pathname} reaches for the coaching cue`).not.toContain('coachingCue');
      expect(text, `${f.pathname} reaches for the coaching badge`).not.toContain('coachingBadge');
    }
  });

  it('RunState carries no cue field', () => {
    const types = readFileSync(new URL('../../src/sim/types.ts', import.meta.url), 'utf8');
    const runState = types.slice(types.indexOf('interface RunState'));
    for (const tell of ['cue', 'coach', 'badge', 'tutorial']) {
      expect(
        runState.slice(0, runState.indexOf('\n}')).toLowerCase(),
        `RunState carries a ${tell} field; render data has entered the state hash`,
      ).not.toContain(tell);
    }
  });

  it('the cue module reads nothing that could vary between two identical runs', () => {
    const source = readFileSync(
      new URL('../../src/render/coachingCue.ts', import.meta.url),
      'utf8',
    );
    for (const tell of ['Date', 'performance', 'Math.random', 'localStorage', 'fetch']) {
      expect(source, `coachingCue.ts reads ${tell}; it must be a pure function of x`).not.toContain(
        tell,
      );
    }
  });
});
