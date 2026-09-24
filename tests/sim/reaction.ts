import { terrainYAt } from '../../src/sim/terrain.js';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '../../src/render/stage.js';
import type { Course, RunState } from '../../src/sim/types.js';
import { tuning } from './fixtures.js';
import { ride, type Pilot } from './pilots.js';

/**
 * How long a player has to react, measured on rides rather than assumed.
 *
 * Feature 007. The first attempt at these numbers divided the view ahead by the
 * slope's terminal speed, and it was wrong three ways: it used speed along the
 * slope where only horizontal speed brings a box closer, it forgot the bottom of
 * the frame hides steep ground, and it forgot there is no drag in the air, so a
 * rider who has just jumped arrives faster than the slope he lands on is worth.
 * Each correction made the worst box worse. Rides through the real simulation,
 * under the real camera, are the only measure all three can't escape.
 *
 * And no single ride is enough. The worst box on the shipped course was not the
 * tucked rider's but the cautious one's - 315 ms against 365 - because a rider
 * who never tucks sees the steep boxes no sooner and charges his jump later. So
 * every hazard is read on every pilot that meets it on its own surface, and the
 * worst reading is the one that counts.
 *
 * Nothing here is shipped. See specs/007-reaction-time-speed/research.md R1.
 */

/** Maps a state to the top-left of the frame the player would see. */
export type Camera = (state: RunState, course: Course) => { x: number; y: number };

/** Every pilot a hazard is read on. `passive` presses nothing and meets nothing on purpose. */
export const MEASURING_PILOTS: readonly Pilot[] = ['tuck', 'stay-low', 'low-line'];

const TICK_MS = 1000 / 60;

/**
 * Ticks a max-charge release needs to climb one standHeight - the smaller root of
 * impulse*t - gravity*t^2/2 = standHeight. A release later than this before the
 * box arrives cannot clear it, so it comes off the time a player has to decide.
 */
export const CLIMB_TICKS = (() => {
  const b = tuning.launchImpulseMax;
  const disc = b * b - 2 * tuning.gravity * tuning.standHeight;
  return (b - Math.sqrt(disc)) / tuning.gravity;
})();

interface Target {
  kind: 'box' | 'rope' | 'rock' | 'ice';
  x: number;
  /** World y of the point that must be on screen for the hazard to count as seen. */
  y: number;
  /** The surface it sits on: a ledge index, or -1 for the piste. */
  surface: number;
}

export interface Reading {
  kind: Target['kind'];
  x: number;
  pilot: Pilot;
  seenTick: number;
  arriveTick: number;
  vxAtArrival: number;
  groundedWhenSeen: boolean;
  /** First tick after arrival on which he is back on the snow. NaN if never. */
  landedTick: number;
  /**
   * For a box, entering view to the last release that still clears it. For
   * anything else, entering view to arrival.
   */
  ms: number;
}

const inFrame = (cam: { x: number; y: number }, x: number, y: number): boolean =>
  x - cam.x <= INTERNAL_WIDTH && y - cam.y <= INTERNAL_HEIGHT && y - cam.y >= 0;

function targets(course: Course): Target[] {
  const ledgeAt = (x: number): number => course.ledges.findIndex((l) => x >= l.x0 && x < l.x1);
  const shelfY = (x: number): number => {
    const l = course.ledges[ledgeAt(x)];
    return terrainYAt(course.terrain, x) - (l ? l.height : 0);
  };
  const ground = (x: number): number => terrainYAt(course.terrain, x);
  return [
    ...course.obstacles.map((o) =>
      o.kind === 'solid'
        ? { kind: 'box' as const, x: o.x, y: ground(o.x) - tuning.standHeight, surface: -1 }
        : // The slab's lower face is what has to be seen to know to duck under it.
          { kind: 'rope' as const, x: o.x, y: ground(o.x) - o.clearance, surface: -1 },
    ),
    ...course.rocks.map((r) => ({
      kind: 'rock' as const,
      x: r.x,
      y: shelfY(r.x) - r.height,
      surface: ledgeAt(r.x),
    })),
    ...course.ice.map((i) => ({
      kind: 'ice' as const,
      x: i.x0,
      y: shelfY(i.x0),
      surface: ledgeAt(i.x0),
    })),
  ];
}

/** Every hazard as one pilot met it. Hazards he never met on their surface are left out. */
function readRide(course: Course, pilot: Pilot, camera: Camera): Reading[] {
  const ts = targets(course);
  const seen = new Map<Target, { tick: number; grounded: boolean }>();
  const met = new Map<Target, { tick: number; vx: number; onSurface: boolean }>();
  const landed = new Map<Target, number>();
  // Where his feet last were. A rider who has just jumped a rock is airborne over
  // it, and still met it on the shelf; one riding the piste beneath never did.
  let lastSurface = -1;
  ride(course, pilot, 1, (_before, after) => {
    if (after.grounded) lastSurface = after.ledge;
    const cam = camera(after, course);
    for (const t of ts) {
      if (!seen.has(t) && after.x < t.x && inFrame(cam, t.x, t.y)) {
        seen.set(t, { tick: after.tick, grounded: after.grounded });
      }
      if (!met.has(t) && after.x + after.vx >= t.x) {
        met.set(t, { tick: after.tick, vx: after.vx, onSurface: lastSurface === t.surface });
      }
      if (met.has(t) && !landed.has(t) && after.grounded && after.x > t.x) {
        landed.set(t, after.tick);
      }
    }
  });
  const out: Reading[] = [];
  for (const t of ts) {
    const s = seen.get(t);
    const m = met.get(t);
    if (!s || !m || !m.onSurface) continue;
    const lead = m.tick - s.tick - (t.kind === 'box' ? CLIMB_TICKS : 0);
    out.push({
      kind: t.kind,
      x: t.x,
      pilot,
      seenTick: s.tick,
      arriveTick: m.tick,
      vxAtArrival: m.vx,
      groundedWhenSeen: s.grounded,
      landedTick: landed.get(t) ?? NaN,
      ms: lead * TICK_MS,
    });
  }
  return out;
}

/** Every reading, on every measuring pilot. */
export function readings(course: Course, camera: Camera): Reading[] {
  return MEASURING_PILOTS.flatMap((p) => readRide(course, p, camera));
}

/** The worst reading per hazard, which is the one each requirement is held to. */
export function worstPerHazard(all: Reading[]): Reading[] {
  const worst = new Map<string, Reading>();
  for (const r of all) {
    const key = `${r.kind}@${r.x}`;
    const w = worst.get(key);
    if (!w || r.ms < w.ms) worst.set(key, r);
  }
  return [...worst.values()].sort((a, b) => a.x - b.x || a.kind.localeCompare(b.kind));
}

/** Speed at each kicker lip on the tuck ride, taken grounded on the piste (FR-235). */
export function kickerLipSpeeds(course: Course): { x: number; speed: number }[] {
  const lips = new Map<number, number>();
  ride(course, 'tuck', 1, (before) => {
    if (!before.grounded || before.ledge >= 0) return;
    for (const k of course.kickers) {
      const lip = k.x + k.width;
      if (!lips.has(k.x) && before.x < lip && before.x + before.vx >= lip) {
        lips.set(k.x, Math.hypot(before.vx, before.vy));
      }
    }
  });
  return course.kickers.map((k) => ({ x: k.x, speed: lips.get(k.x) ?? NaN }));
}
