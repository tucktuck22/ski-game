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
  pickups: { x: number; y: number; value: 'small' | 'large' }[];
  ledges: { x0: number; x1: number; height: number }[];
  kickers: { x: number; width: number; power: number }[];
  rocks: { x: number; width: number; height: number }[];
  ice: { x0: number; x1: number }[];
}

/**
 * Upper-track hazards, laid out from the shelf's own start.
 *
 * The shelf is 900 long and a player lands somewhere around 140 into it, so the
 * run-in CV-20 demands is already spent by the time these begin. Ice comes
 * first because it is the cheaper mistake - falling through costs the line, not
 * the run - and the rock comes after, once he has seen what the shelf does.
 *
 * Neither offset is free to move. The ice sits PAST the deadfall on the piste
 * below and lands the player short of the next bough, because CV-19 will not
 * accept an involuntary drop onto either; the first cut put it at 300 and the
 * validator rejected the course for dropping him straight onto a log. Its
 * length is bounded by CV-18: 48 is inside the ~55 a minimum-charge launch
 * covers at base speed, so a player who reacts can always hop it.
 */
const SHELF_ICE_AT = 380;
const SHELF_ICE_LENGTH = 48;
const SHELF_ROCK_AT = 580;
const SHELF_ROCK_WIDTH = 16;
const SHELF_ROCK_HEIGHT = 12;

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
  const pickups: Built['pickups'] = [];
  const ledges: Built['ledges'] = [];
  const kickers: Built['kickers'] = [];
  const rocks: Built['rocks'] = [];
  const ice: Built['ice'] = [];

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
    // while the upper line is sailing over it. Deadfall throughout now that the
    // attack verb and the barriers it broke are withdrawn (FR-114) - a barrier
    // nothing can break is just a differently drawn log. Placed before the
    // shelf check, because a stretch too near the finish for a shelf still gets
    // its hazard; the first cut put this after the `continue` and quietly
    // dropped the last obstacle of every course.
    obstacles.push({ x: base + GROUND_HAZARD_AT, kind: 'solid', width: 24, clearance: 0 });

    if (x1 > length - 40) continue; // no shelf that outruns the finish (CV-12)
    kickers.push({ x: rampX, width: RAMP_WIDTH, power: RAMP_POWER });
    ledges.push({ x0, x1, height: SHELF_HEIGHT });

    // What the upper line costs. Ice first, then a rock: the shelf is no longer
    // a free ride over the piste's hazards, it has its own.
    ice.push({ x0: x0 + SHELF_ICE_AT, x1: x0 + SHELF_ICE_AT + SHELF_ICE_LENGTH });
    rocks.push({
      x: x0 + SHELF_ROCK_AT,
      width: SHELF_ROCK_WIDTH,
      height: SHELF_ROCK_HEIGHT,
    });

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
    rulesVersion: '1.3.0',
    length,
    terrain: terrain(length, seed),
    obstacles,
    pickups,
    ledges,
    kickers,
    rocks,
    ice,
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
      `${c.pickups.length} pickups, ${c.ledges.length} ledges, ${c.kickers.length} ramps, ` +
      `${c.rocks.length} rocks, ${c.ice.length} ice`,
  );
}
