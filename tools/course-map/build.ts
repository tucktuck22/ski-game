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
import { parseCamera, parseFinish } from '../../src/data/load.js';
import { withRunout } from '../../src/render/finish.js';
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
const finishCfg = parseFinish(JSON.parse(readFileSync(join(root, 'data/finish.json'), 'utf8')));
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

/**
 * The camera the game draws, followed tick by tick (FR-261), over the ground as
 * drawn - run-out past the line included (feature 009).
 */
function cameraOf(course: Course): (s: RunState, c: Course) => { x: number; y: number } {
  const shown = withRunout(course, finishCfg);
  const f = new LookFollower(shown, framing);
  return (s) => cameraFor(s, shown, framing, f.advance(s));
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
    // As drawn: the run-out past the line included (feature 009).
    terrain: withRunout(course, finishCfg).terrain,
    grade,
    ledges: course.ledges,
    // The finish as the game draws it (feature 009, FR-277): the gantry at the
    // line and the crowd either side of the open snow where riders stop.
    finish: {
      x: course.length,
      gantryHeight: finishCfg.gantryHeight,
      bannerWidth: finishCfg.bannerWidth,
      crowdFrom: finishCfg.crowdFrom,
      crowdTo: finishCfg.crowdTo,
      crowdGapFrom: finishCfg.crowdGapFrom,
      crowdGapTo: finishCfg.crowdGapTo,
    },
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

/**
 * The same numbers as text, for a before/after diff in a change description.
 * Written beside the page and printed. `.claude/skills/course-map` diffs two of these.
 */
const status = (ms: number, budget: number): string =>
  ms < budget ? 'BELOW' : ms < budget * 1.1 ? 'tight' : 'ok';
const lines: string[] = [`course map @ ${commit}, rules ${official.rulesVersion}`];
for (const c of data.courses) {
  lines.push('', `== ${c.id} (${c.length} units)`);
  for (const p of c.pilots)
    lines.push(
      `rider ${p.pilot.padEnd(9)} ${p.outcome.padEnd(10)} ${(p.ticks / 60).toFixed(2).padStart(6)} s  score ${p.score}  shelves ${p.shelves}`,
    );
  for (const r of [...c.worst].sort((a, z) => a.x - z.x))
    lines.push(
      `${r.kind.padEnd(4)} ${String(r.x).padStart(6)}  ${String(r.ms).padStart(5)} ms  ${r.pilot.padEnd(9)}${r.kind === 'box' ? `  ${status(r.ms, BUDGET_MS)}` : ''}`,
    );
  const pairs = new Map<string, (typeof c.pairs)[number]>();
  for (const p of c.pairs) {
    const key = `${p.box}->${p.rope}`;
    const prev = pairs.get(key);
    if (!prev || p.ms < prev.ms) pairs.set(key, p);
  }
  for (const [key, p] of pairs)
    lines.push(
      `pair ${key.padStart(13)}  ${String(p.ms).padStart(5)} ms  ${p.pilot.padEnd(9)}  ${status(p.ms, ROPE_AFTER_BOX_MS)}`,
    );
}
const summary = lines.join('\n') + '\n';
writeFileSync(join(root, 'dist/course-map.summary.txt'), summary);
process.stdout.write(summary);
