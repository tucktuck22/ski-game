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
}

function build(
  id: string,
  length: number,
  seed: number,
  firstLowAt: number,
  lowSpacing: number,
): Built {
  const r = rng(seed + 7);
  const obstacles: Built['obstacles'] = [];
  const barriers: Built['barriers'] = [];
  const pickups: Built['pickups'] = [];

  // Low obstacles. Spacing far exceeds safeReleaseWindowMin (140) so CV-4 and
  // CV-5 both hold with room to spare - deliberately, because that margin is
  // what keeps the course survivable for a cautious player (FR-035, SC-015).
  const lowXs: number[] = [];
  for (let x = firstLowAt; x < length - 400; x += lowSpacing) {
    obstacles.push({ x, kind: 'low', width: 40, clearance: 11 + Math.floor(r() * 3) });
    lowXs.push(x);
  }

  // Solid obstacles, kept clear of every low obstacle's footprint and its window.
  // Keep solid obstacles and barriers clear of every low obstacle's safe release
  // window, which CV-11 requires: a block inside that window would trap the
  // player between standing up under the tunnel and ducking into the block.
  const SAFE_WINDOW = 140;
  const clearOfLows = (x: number, w: number): boolean =>
    lowXs.every((lx) => x + w < lx - SAFE_WINDOW || x > lx + 40 + SAFE_WINDOW);
  for (
    let x = firstLowAt + Math.floor(lowSpacing / 2);
    x < length - 300;
    x += Math.floor(lowSpacing / 2)
  ) {
    // Solid obstacles are cleared by jumping, so they need approach room.
    const w = 24;
    if (clearOfLows(x, w) && r() < 0.55)
      obstacles.push({ x, kind: 'solid', width: w, clearance: 0 });
  }

  // Barriers: bypassCostTicks > 0 so breaking through beats going around (CV-6).
  for (let x = firstLowAt + 260; x < length - 500; x += lowSpacing * 2) {
    if (clearOfLows(x, 30))
      barriers.push({ x, width: 30, bypassCostTicks: 18 + Math.floor(r() * 14) });
  }

  // Pickups sit above the surface (negative y) and within reach of a launch.
  for (let x = 300; x < length - 200; x += 220) {
    const high = r() < 0.35;
    pickups.push({
      x,
      y: high ? -(24 + Math.floor(r() * 26)) : -(4 + Math.floor(r() * 8)),
      value: high ? 'large' : 'small',
    });
  }

  return {
    id,
    rulesVersion: '1.0.0',
    length,
    terrain: terrain(length, seed),
    obstacles,
    barriers,
    pickups,
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../data/courses');
mkdirSync(out, { recursive: true });

// Distinct terrain, identical schema and physics - FR-028 and FR-067.
const warmup = build('warmup', 3200, 20250901, 700, 640);
const official = build('official', 12000, 19860214, 1000, 620);

writeFileSync(resolve(out, 'warmup.json'), JSON.stringify(warmup, null, 2) + '\n');
writeFileSync(resolve(out, 'official.json'), JSON.stringify(official, null, 2) + '\n');
console.log(
  `warmup: ${warmup.terrain.length} pts, ${warmup.obstacles.length} obstacles, ${warmup.barriers.length} barriers, ${warmup.pickups.length} pickups`,
);
console.log(
  `official: ${official.terrain.length} pts, ${official.obstacles.length} obstacles, ${official.barriers.length} barriers, ${official.pickups.length} pickups`,
);
