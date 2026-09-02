/**
 * Authors data/courses/*.json.
 *
 * This is a BUILD-TIME tool, not runtime generation. research R4 rejected
 * generating geometry from the seed at run time: it would turn CV-4 into a
 * property to be proven over a generator rather than checked over data, and a
 * bad seed could produce an unfinishable official course with no review step
 * to catch it. The output is committed and validated in CI.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

type P = { x: number; y: number };

// Local seeded RNG so course shapes are reproducible from this file alone.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Terrain profile.
 *
 * Gradient change between adjacent segments is capped so the slope never bends
 * by more than the landing tolerance (CV-10). Standing up after a duck IS a
 * launch, so a cautious player is airborne whether he meant to be or not; a
 * sharp bend under him would wipe him out through no fault of his own.
 */
function terrain(length: number, seed: number, step = 200): P[] {
  const r = rng(seed);
  const pts: P[] = [{ x: 0, y: 0 }];
  let y = 0;
  let gradient = 0.3;
  // atan(0.42 rad tolerance) worth of bend, kept well under it for margin.
  const MAX_GRADIENT_DELTA = 0.16;
  for (let x = step; x <= length + step; x += step) {
    const wanted = 0.16 + r() * 0.46;
    const delta = Math.max(-MAX_GRADIENT_DELTA, Math.min(MAX_GRADIENT_DELTA, wanted - gradient));
    gradient += delta;
    y += gradient * step;
    pts.push({ x, y: Math.round(y * 100) / 100 });
  }
  return pts;
}

interface Built {
  id: string;
  rulesVersion: string;
  length: number;
  terrain: P[];
  obstacles: { x: number; kind: 'low' | 'solid'; width: number; clearance: number }[];
  barriers: { x: number; width: number; bypassCostTicks: number }[];
  pickups: { x: number; y: number; value: 'small' | 'large' }[];
  ledges: { x0: number; x1: number; height: number }[];
  kickers: { x: number; width: number; power: number }[];
}

/**
 * Shape of one repeating stretch of mountain, measured from the bough that
 * opens it. The layout is deliberate rather than random: every offset here
 * exists to satisfy a validator rule with margin, and a generator that rolled
 * dice for placement would fail CV-15 on some seeds and pass on others.
 *
 *   +0    bough        duck under it, or clear it from above
 *   +400  ramp         far clear of the bough's release window (CV-15)
 *   +496  shelf begins 40 past the lip, inside CV-13's entry reach
 *   +800  deadfall or barrier, on the piste and under the shelf
 *   +1374 shelf ends   having sailed over the NEXT bough
 */
const BOUGH_WIDTH = 40;
const RAMP_AT = 400;
const RAMP_WIDTH = 56;
const SHELF_FROM_LIP = 40;
const SHELF_LENGTH = 900;
const GROUND_HAZARD_AT = 800;

/**
 * Height of the upper track above the piste, and the ramp power that reaches it.
 *
 * These two numbers are one decision, not two. At baseSpeed 2.6 a ramp of
 * power 1.9 has an apex of 38 - short of the shelf, so the cautious pilot is
 * hopped and set back down on his own line. At tuckSpeedMax 4.2 the apex is 99,
 * comfortably over it. That gap IS the upper track's entry fee, and CV-13
 * asserts both halves of it against tuning.json rather than trusting this
 * comment.
 */
const SHELF_HEIGHT = 50;
const RAMP_POWER = 1.9;

function build(
  id: string,
  length: number,
  seed: number,
  firstLowAt: number,
  spacing: number,
): Built {
  const r = rng(seed + 7);
  const obstacles: Built['obstacles'] = [];
  const barriers: Built['barriers'] = [];
  const pickups: Built['pickups'] = [];
  const ledges: Built['ledges'] = [];
  const kickers: Built['kickers'] = [];

  // Boughs are the course's punctuation, not its texture. Spacing is now far
  // wider than safeReleaseWindowMin (140) rather than merely clear of it: the
  // mountain should read as a mountain with obstacles on it, not as a corridor
  // of them. Fewer, further apart, each one a decision.
  const boughXs: number[] = [];
  for (let x = firstLowAt; x < length - 500; x += spacing) {
    obstacles.push({ x, kind: 'low', width: BOUGH_WIDTH, clearance: 11 + Math.floor(r() * 3) });
    boughXs.push(x);
  }

  // Ramps and the shelves they feed, one pair per stretch. A shelf runs on past
  // the next bough so that taking the upper line skips an obstacle - which is
  // what makes the two tracks a real choice rather than a cosmetic fork.
  for (let i = 0; i < boughXs.length; i++) {
    const base = boughXs[i] as number;
    const rampX = base + RAMP_AT;
    const lip = rampX + RAMP_WIDTH;
    const x0 = lip + SHELF_FROM_LIP;
    const x1 = x0 + SHELF_LENGTH;

    // The piste keeps its own hazard: whoever stayed low has something to do
    // while the upper line is sailing over it. Alternating deadfall and barrier
    // keeps both verbs - jump and attack - in rotation. Placed before the shelf
    // check, because a stretch too near the finish for a shelf still gets its
    // hazard; the first cut put this after the `continue` and quietly dropped
    // the last obstacle of every course.
    const hazardX = base + GROUND_HAZARD_AT;
    if (i % 2 === 0) obstacles.push({ x: hazardX, kind: 'solid', width: 24, clearance: 0 });
    else barriers.push({ x: hazardX, width: 30, bypassCostTicks: 18 + Math.floor(r() * 14) });

    if (x1 > length - 40) continue; // no shelf that outruns the finish (CV-12)
    kickers.push({ x: rampX, width: RAMP_WIDTH, power: RAMP_POWER });
    ledges.push({ x0, x1, height: SHELF_HEIGHT });

    // The reward for taking the upper line, spread along it so it pays for the
    // whole shelf rather than for one hop onto it.
    for (let k = 1; k <= 5; k++) {
      pickups.push({
        x: Math.round(x0 + (SHELF_LENGTH * k) / 6),
        y: -(SHELF_HEIGHT + 6),
        value: 'large',
      });
    }
  }

  // Piste pickups: small, low, and frequent enough to mark the racing line.
  for (let x = 300; x < length - 200; x += 320) {
    pickups.push({ x, y: -(4 + Math.floor(r() * 8)), value: 'small' });
  }

  return {
    id,
    rulesVersion: '1.1.0',
    length,
    terrain: terrain(length, seed),
    obstacles,
    barriers,
    pickups,
    ledges,
    kickers,
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../data/courses');
mkdirSync(out, { recursive: true });

// Distinct terrain, identical schema and physics - FR-028 and FR-067.
const warmup = build('warmup', 3200, 20250901, 700, 1200);
const official = build('official', 12000, 19860214, 1000, 1200);

writeFileSync(resolve(out, 'warmup.json'), JSON.stringify(warmup, null, 2) + '\n');
writeFileSync(resolve(out, 'official.json'), JSON.stringify(official, null, 2) + '\n');
for (const c of [warmup, official]) {
  console.log(
    `${c.id}: ${c.terrain.length} pts, ${c.obstacles.length} obstacles, ` +
      `${c.barriers.length} barriers, ${c.pickups.length} pickups, ` +
      `${c.ledges.length} ledges, ${c.kickers.length} ramps`,
  );
}
