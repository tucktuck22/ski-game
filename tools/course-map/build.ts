/**
 * The course map: both courses drawn to scale from their data, with the three
 * measuring pilots ridden through the real simulation and the real camera.
 *
 *   npm run map        -> dist/course-map.html
 *
 * A design surface, so a course change can be looked at before it is played.
 * Everything on the page comes from here - the page itself only draws. Run with
 * vite-node because the pilots live in tests/sim and import with .js suffixes.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { official, scoring, tuning, warmup } from '../../tests/sim/fixtures.js';
import { ride, type Pilot } from '../../tests/sim/pilots.js';
import { readings, worstPerHazard, type Reading } from '../../tests/sim/reaction.js';
import { cameraFor } from '../../src/render/draw.js';
import { isBooter, LookFollower, rampLift, rampRise } from '../../src/render/rampGeometry.js';
import { parseCamera } from '../../src/data/load.js';
import {
  CAMERA_X_OFFSET,
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  PLAYER_LOOKAHEAD,
} from '../../src/render/stage.js';
import { finalScore } from '../../src/sim/scoring.js';
import { terrainYAt } from '../../src/sim/terrain.js';
import type { Course, RunState } from '../../src/sim/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const framing = parseCamera(JSON.parse(readFileSync(join(root, 'data/camera.json'), 'utf8')));

const PILOTS: Pilot[] = ['tuck', 'stay-low', 'low-line'];
const BUDGET_MS = 680;
const ROPE_AFTER_BOX_MS = 300;

/** Section names, from the headings in tools/gen-courses.ts. */
const SECTIONS: Record<string, { x0: number; x1: number; name: string; ask: string }[]> = {
  official: [
    { x0: 0, x1: 1200, name: 'Drop In', ask: 'Can you duck?' },
    { x0: 1200, x1: 3200, name: 'Shelf School', ask: 'Will you pay for the high line?' },
    { x0: 3200, x1: 5000, name: 'The Narrows', ask: 'How clean is your piste craft?' },
    { x0: 5000, x1: 7400, name: 'The Cornice', ask: 'Can you hold the high line?' },
    { x0: 7400, x1: 8800, name: 'The Flats', ask: 'Did you keep your speed?' },
    { x0: 8800, x1: 12000, name: 'The Last Pitch', ask: 'Everything, at speed.' },
  ],
  warmup: [
    { x0: 0, x1: 3200, name: 'Coached Opening', ask: 'One verb at a time.' },
    { x0: 3200, x1: 6400, name: 'Free Run', ask: 'Put it together.' },
  ],
};

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** The camera the game draws, followed tick by tick (FR-261). */
function cameraOf(course: Course): (s: RunState, c: Course) => { x: number; y: number } {
  const f = new LookFollower(course, framing);
  return (s, c) => cameraFor(s, c, framing, f.advance(s));
}

function trace(course: Course, pilot: Pilot) {
  const cam = cameraOf(course);
  // Columns rather than objects: a few thousand ticks a ride, six rides.
  const cols = {
    x: [] as number[],
    y: [] as number[],
    vx: [] as number[],
    cy: [] as number[],
    f: [] as number[],
    ledge: [] as number[],
  };
  const out = ride(course, pilot, 1, (_b, s) => {
    cols.x.push(r1(s.x));
    // Drawn the way the game draws him: carried up the face of a ramp he is on.
    cols.y.push(r1(s.y - rampLift(course, tuning, s.x, s.ledge)));
    cols.vx.push(Math.round(s.vx * 100) / 100);
    cols.cy.push(r1(cam(s, course).y));
    cols.f.push((s.grounded ? 1 : 0) | (s.crouchHeld ? 2 : 0));
    cols.ledge.push(s.ledge);
  });
  return {
    pilot,
    ...cols,
    outcome: out.state.outcome,
    ticks: out.state.tick,
    score: finalScore(out.state, scoring),
    shelves: out.shelvesRidden,
  };
}

const reading = (r: Reading) => ({
  kind: r.kind,
  x: r.x,
  pilot: r.pilot,
  ms: Math.round(r.ms),
  seenTick: r.seenTick,
  arriveTick: r.arriveTick,
  landedTick: Number.isNaN(r.landedTick) ? null : r.landedTick,
});

function courseData(key: 'official' | 'warmup', course: Course) {
  const all = readings(course, cameraOf(course));
  const pairs: { box: number; rope: number; pilot: Pilot; ms: number }[] = [];
  for (const b of all.filter((r) => r.kind === 'box')) {
    const rope = all
      .filter((r) => r.kind === 'rope' && r.pilot === b.pilot && r.x > b.x)
      .sort((a, z) => a.x - z.x)[0];
    if (!rope || rope.x - b.x > 400) continue;
    pairs.push({
      box: b.x,
      rope: rope.x,
      pilot: b.pilot,
      ms: Math.round(((rope.arriveTick - b.landedTick) * 1000) / 60),
    });
  }
  const grade: number[] = [];
  for (let x = 0; x <= course.length; x += 20)
    grade.push(
      Math.round(
        ((terrainYAt(course.terrain, x + 10) - terrainYAt(course.terrain, x - 10)) / 20) * 1000,
      ) / 1000,
    );
  return {
    id: key,
    rulesVersion: course.rulesVersion,
    length: course.length,
    sections: SECTIONS[key],
    terrain: course.terrain,
    grade,
    ledges: course.ledges,
    kickers: course.kickers.map((k) => ({
      ...k,
      booter: isBooter(k),
      rise: rampRise(k, tuning, course),
    })),
    obstacles: course.obstacles,
    rocks: course.rocks,
    ice: course.ice,
    pickups: course.pickups,
    pilots: PILOTS.map((p) => trace(course, p)),
    worst: worstPerHazard(all).map(reading),
    readings: all.map(reading),
    pairs,
  };
}

const commit = (() => {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'data', 'src', 'tools'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    return dirty ? `${sha}+local` : sha;
  } catch {
    return 'unknown';
  }
})();

const data = {
  generated: new Date().toISOString(),
  head: commit,
  frame: {
    width: INTERNAL_WIDTH,
    height: INTERNAL_HEIGHT,
    xOffset: CAMERA_X_OFFSET,
    lookahead: PLAYER_LOOKAHEAD,
  },
  tuning: {
    standHeight: tuning.standHeight,
    crouchHeight: tuning.crouchHeight,
    branchThickness: tuning.branchThickness,
  },
  budgets: { boxMs: BUDGET_MS, ropeAfterBoxMs: ROPE_AFTER_BOX_MS },
  courses: [courseData('official', official), courseData('warmup', warmup)],
};

const template = readFileSync(join(root, 'tools/course-map/map.html'), 'utf8');
// A regex, not a string: formatters are free to put a space after the comment.
const PLACEHOLDER = /\/\*__MAP_DATA__\*\/\s*null/;
if (!PLACEHOLDER.test(template))
  throw new Error('map.html has lost its /*__MAP_DATA__*/ placeholder');
const html = template.replace(PLACEHOLDER, () => JSON.stringify(data));
mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist/course-map.html');
writeFileSync(out, html);
console.log(`${out}  ${Math.round(html.length / 1024)} KiB`);
