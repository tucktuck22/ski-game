/**
 * Draws a run into the 320x180 buffer.
 *
 * Reads simulation state and never mutates it — the separation the constitution's
 * Technical Standards require. Colours come only from the style bible palette.
 *
 * The scene is built back to front: sky, sun, ridges, three ranks of pines,
 * snowfall, the piste, the upper track, then hazards and the skier. Everything
 * behind the piste is scenery in the strict sense — it is derived from the
 * camera and the tick, never from run state, so it cannot influence or be
 * confused with anything the simulation cares about.
 */
import type { Course, RunState, Tuning } from '../sim/types.js';
import { terrainYAt, surfaceYAt, iceIndexAt, slopeAt } from '../sim/terrain.js';
import { PALETTE, type PaletteToken } from './palette.js';
import { CAMERA_X_OFFSET, INTERNAL_HEIGHT, INTERNAL_WIDTH } from './stage.js';
import { cameraAirLift, rampLift, rampRise } from './rampGeometry.js';
import type { MotionSettings } from './reducedMotion.js';
import type { Shake } from './landing.js';
import type { Tumble } from './death.js';
import { FULL_MOTION } from './reducedMotion.js';
import type { SpriteSheets } from './sprites.js';
import type { PoseKey } from './skierPose.js';

const css = (t: PaletteToken): string => {
  const [r, g, b] = PALETTE[t];
  return `rgb(${r},${g},${b})`;
};

const rgba = (t: PaletteToken, a: number): string => {
  const [r, g, b] = PALETTE[t];
  return `rgba(${r},${g},${b},${a})`;
};

export interface Camera {
  x: number;
  y: number;
}

/**
 * Measured from the piste rather than from whatever he is standing on, so the
 * lift is continuous. Keyed to the shelf instead, it would snap by 25 pixels
 * the instant he rode off one - and a camera that jumps on landing trades one
 * unreadable moment for another.
 */
export const cameraFor = (state: RunState, course: Course): Camera => {
  const above = terrainYAt(course.terrain, state.x) - state.y;
  const lift = cameraAirLift(above);
  return {
    x: state.x - CAMERA_X_OFFSET,
    y: state.y - INTERNAL_HEIGHT * 0.6 + lift,
  };
};

/**
 * Scenery placement hash.
 *
 * Trees must stand still. Anything that picked positions from a running RNG
 * would re-roll them every frame and the whole forest would boil, so each
 * feature's position comes from a hash of its own integer slot — the same slot
 * gives the same tree forever, whichever direction the camera arrives from.
 * This is presentation only and never touches the simulation, so the
 * determinism rules in src/sim do not apply to it.
 */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------

/** The sunset disc: P-3's magenta -> orange gradient, slit by ink bars. */
function drawSun(ctx: CanvasRenderingContext2D, cam: Camera, motion: MotionSettings): void {
  // Barely-there parallax. The sun is a very long way off; move it any faster
  // and it reads as a balloon travelling with the player rather than as the sun.
  const drift = motion.parallax ? (cam.x * 0.012) % 40 : 0;
  const cx = 236 - drift;
  const cy = 52;
  const r = 40;

  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, css('yellow'));
  g.addColorStop(1, css('magenta'));

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // The slits: thin at the top, widening downward. This is the single most
  // recognisable mark of the period and it costs six rectangles.
  ctx.fillStyle = rgba('purple', 0.85);
  let y = cy - 4;
  let gapH = 2;
  while (y < cy + r) {
    ctx.fillRect(cx - r, Math.round(y), r * 2, gapH);
    y += gapH + 4;
    gapH += 0.9;
  }
  ctx.restore();

  ctx.strokeStyle = rgba('magenta', 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
  ctx.stroke();
}

/** Screen y of the piste under a given column. The anchor for everything else. */
const pisteScreenY = (course: Course, cam: Camera, px: number): number =>
  terrainYAt(course.terrain, cam.x + px) - cam.y;

/**
 * Screen y of a backdrop layer under a given column.
 *
 * The layer is anchored to the piste ON SCREEN and lifted above it, rather than
 * to the terrain sampled at the layer's own parallax position. That distinction
 * is the whole of it: the piste descends by thousands of world units over a
 * run, so sampling terrain at `cam.x * 0.3` and subtracting the real camera y
 * put the far country hundreds of pixels off the top of the frame within
 * seconds, and the first cut of this drew a purple wall over the sky and the
 * sun with it. Anchoring to the visible slope keeps the far country parallel to
 * the ground under the player's skis, which is what a mountainside does; the
 * parallax then lives in the SHAPE — the wobble and the tree positions — which
 * is the part the eye actually reads as depth.
 */
function backdropY(
  course: Course,
  cam: Camera,
  px: number,
  parallax: number,
  lift: number,
  relief: number,
): number {
  const pWorld = cam.x * parallax + px;
  // Two out-of-phase sines give peaks without a repeat that reads as a repeat.
  const wobble = (Math.sin(pWorld * 0.0071) * 1.9 + Math.sin(pWorld * 0.0183 + 1.7)) * relief;
  return pisteScreenY(course, cam, px) - lift + wobble;
}

function drawRidge(
  ctx: CanvasRenderingContext2D,
  course: Course,
  cam: Camera,
  parallax: number,
  lift: number,
  relief: number,
  fill: string,
  capped: boolean,
): void {
  ctx.beginPath();
  ctx.moveTo(0, INTERNAL_HEIGHT);
  for (let px = 0; px <= INTERNAL_WIDTH; px += 4) {
    ctx.lineTo(px, backdropY(course, cam, px, parallax, lift, relief));
  }
  ctx.lineTo(INTERNAL_WIDTH, INTERNAL_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  if (!capped) return;
  // Snow caps: the lit edge of the ridge, one pixel of snow along the top.
  ctx.beginPath();
  for (let px = 0; px <= INTERNAL_WIDTH; px += 4) {
    const y = backdropY(course, cam, px, parallax, lift, relief);
    if (px === 0) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }
  ctx.strokeStyle = rgba('snow', 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** One conifer: three tiers of branches over a stub of trunk. */
function pine(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  h: number,
  body: string,
  snowCap: boolean,
): void {
  const w = h * 0.42;
  ctx.fillStyle = body;
  ctx.beginPath();
  for (let tier = 0; tier < 3; tier++) {
    const t = tier / 3;
    const top = baseY - h + h * t * 0.62;
    const halfW = w * (0.45 + t * 0.55);
    const bottom = top + h * 0.46;
    ctx.moveTo(x, top);
    ctx.lineTo(x + halfW, bottom);
    ctx.lineTo(x - halfW, bottom);
    ctx.closePath();
  }
  ctx.fill();
  ctx.fillRect(x - 1, baseY - h * 0.18, 2, h * 0.18);

  if (!snowCap) return;
  // Snow sits on the windward side of each tier. This is the detail that turns
  // a green triangle into a tree in a blizzard, and it is one line per tier.
  ctx.strokeStyle = rgba('snow', 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let tier = 0; tier < 3; tier++) {
    const t = tier / 3;
    const top = baseY - h + h * t * 0.62;
    const halfW = w * (0.45 + t * 0.55);
    ctx.moveTo(x - 0.5, top + 0.5);
    ctx.lineTo(x - halfW + 1, top + h * 0.46);
  }
  ctx.stroke();
}

/**
 * A rank of conifers at one parallax depth.
 *
 * Trees are placed on a fixed world grid so that the set on screen is a
 * function of position alone — no spawning, no despawning, no list to keep.
 */
function drawPineRank(
  ctx: CanvasRenderingContext2D,
  course: Course,
  cam: Camera,
  opts: {
    parallax: number;
    lift: number;
    relief: number;
    spacing: number;
    height: number;
    body: string;
    salt: number;
    snow: boolean;
  },
): void {
  const worldLeft = cam.x * opts.parallax - opts.spacing;
  const first = Math.floor(worldLeft / opts.spacing);
  const last = Math.ceil((worldLeft + INTERNAL_WIDTH + opts.spacing * 2) / opts.spacing);

  for (let i = first; i <= last; i++) {
    const jitter = hash(i * 2654435761 + opts.salt);
    const worldX = i * opts.spacing + (jitter - 0.5) * opts.spacing * 0.8;
    const px = worldX - cam.x * opts.parallax;
    if (px < -20 || px > INTERNAL_WIDTH + 20) continue;
    const baseY = backdropY(course, cam, px, opts.parallax, opts.lift, opts.relief);
    const h = opts.height * (0.7 + hash(i * 40503 + opts.salt) * 0.6);
    pine(ctx, Math.round(px), Math.round(baseY), h, opts.body, opts.snow);
  }
}

/**
 * Snowfall, in three depths.
 *
 * Flakes are not simulated. Each one is a fixed world-space column that falls
 * on a loop of its own length, so the field costs no state and never
 * accumulates drift over a five-minute run. Under reduced motion the whole
 * effect is dropped rather than slowed: T-5 requires the run to be fully
 * playable without it, and a slow blizzard is still a blizzard in front of the
 * obstacles the player has to read.
 */
function drawSnowfall(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  tick: number,
  motion: MotionSettings,
): void {
  if (!motion.parallax) return;
  const layers = [
    { count: 26, parallax: 0.3, speed: 0.5, size: 1, alpha: 0.4 },
    { count: 22, parallax: 0.6, speed: 0.95, size: 1, alpha: 0.65 },
    { count: 16, parallax: 0.95, speed: 1.6, size: 2, alpha: 0.9 },
  ];
  for (let l = 0; l < layers.length; l++) {
    const layer = layers[l]!;
    ctx.fillStyle = rgba('snow', layer.alpha);
    for (let i = 0; i < layer.count; i++) {
      const seed = l * 977 + i;
      const spanY = INTERNAL_HEIGHT + 24;
      const fall = (hash(seed) * spanY + tick * layer.speed) % spanY;
      // A gentle lateral sway, out of phase per flake, sold as wind.
      const sway = Math.sin(tick * 0.03 + hash(seed + 51) * 6.28) * (2 + l);
      const px =
        (hash(seed + 13) * (INTERNAL_WIDTH + 40) - cam.x * layer.parallax * 0.25 + sway) %
        (INTERNAL_WIDTH + 40);
      const x = px < 0 ? px + INTERNAL_WIDTH + 40 : px;
      ctx.fillRect(Math.round(x - 20), Math.round(fall - 12), layer.size, layer.size);
    }
  }
}

// ---------------------------------------------------------------------------
// The mountain itself
// ---------------------------------------------------------------------------

/** Snow depth drawn under the contact line, in pixels. */
const SNOW_BAND = 7;

let halftone: CanvasPattern | null = null;

/** T-1: a 2x2 ordered dither in one accent over ink, under the snow band. */
function halftonePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (halftone) return halftone;
  const tile = document.createElement('canvas');
  tile.width = 2;
  tile.height = 2;
  const t = tile.getContext('2d');
  if (!t) return null;
  t.fillStyle = css('ink');
  t.fillRect(0, 0, 2, 2);
  t.fillStyle = css('purple');
  t.fillRect(0, 0, 1, 1);
  t.fillRect(1, 1, 1, 1);
  halftone = ctx.createPattern(tile, 'repeat');
  return halftone;
}

/** Reset between runs so a stale pattern is not bound to a destroyed context. */
export function resetSceneryCache(): void {
  halftone = null;
}

function drawPiste(ctx: CanvasRenderingContext2D, course: Course, cam: Camera): void {
  const surface: number[] = [];
  for (let px = 0; px <= INTERNAL_WIDTH; px++) {
    surface.push(terrainYAt(course.terrain, cam.x + px) - cam.y);
  }

  const body = (from: number): void => {
    ctx.beginPath();
    ctx.moveTo(0, INTERNAL_HEIGHT);
    for (let px = 0; px <= INTERNAL_WIDTH; px++) ctx.lineTo(px, (surface[px] as number) + from);
    ctx.lineTo(INTERNAL_WIDTH, INTERNAL_HEIGHT);
    ctx.closePath();
  };

  // Snowpack first, then the rock and shadow under it. Two fills, no clipping:
  // the deeper shape simply paints over the lower part of the shallower one,
  // which leaves exactly SNOW_BAND pixels of snow along the contact line. The
  // first cut did this with a clip whose region was the intersection rather
  // than the difference, and painted the entire mountain white.
  body(0);
  ctx.fillStyle = css('snow');
  ctx.fill();

  body(SNOW_BAND);
  const dither = halftonePattern(ctx);
  ctx.fillStyle = dither ?? css('ink');
  ctx.fill();

  // LW-4: the 1px cyan edge IS the contact line the physics uses. It is drawn
  // last so nothing can cover it, and it is never decorative.
  ctx.beginPath();
  for (let px = 0; px <= INTERNAL_WIDTH; px++) {
    const y = surface[px] as number;
    if (px === 0) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }
  ctx.strokeStyle = css('cyan');
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * The upper track: a snow shelf with an iced underside.
 *
 * Drawn in runs rather than as one slab, because ice that has given way leaves
 * a hole and the shelf must not be painted across it. The simulation will not
 * catch anybody over a broken section either — a picture that disagreed with
 * that would be worse than no picture, since the player would aim a landing at
 * snow that is not there.
 */
function drawLedges(
  ctx: CanvasRenderingContext2D,
  course: Course,
  cam: Camera,
  state: RunState,
): void {
  const holed = (worldX: number): boolean => {
    const i = iceIndexAt(course, worldX);
    return i >= 0 && state.iceBroken[i] === 1;
  };

  for (const l of course.ledges) {
    if (l.x1 - cam.x < -8 || l.x0 - cam.x > INTERNAL_WIDTH + 8) continue;
    const from = Math.max(0, Math.floor(l.x0 - cam.x));
    const to = Math.min(INTERNAL_WIDTH, Math.ceil(l.x1 - cam.x));

    const yAt = (px: number): number => terrainYAt(course.terrain, cam.x + px) - l.height - cam.y;
    const THICK = 6;

    // Contiguous stretches of shelf that still exist.
    const runs: Array<[number, number]> = [];
    let runStart: number | null = null;
    for (let px = from; px <= to; px++) {
      const solid = !holed(cam.x + px);
      if (solid && runStart === null) runStart = px;
      if (!solid && runStart !== null) {
        runs.push([runStart, px - 1]);
        runStart = null;
      }
    }
    if (runStart !== null) runs.push([runStart, to]);

    for (const [a, b] of runs) {
      if (b <= a) continue;
      ctx.beginPath();
      ctx.moveTo(a, yAt(a));
      for (let px = a; px <= b; px++) ctx.lineTo(px, yAt(px));
      for (let px = b; px >= a; px--) ctx.lineTo(px, yAt(px) + THICK);
      ctx.closePath();
      ctx.fillStyle = css('snow');
      ctx.fill();

      // Iced underside, so the shelf reads as a solid thing with a bottom
      // rather than as a floating line.
      ctx.beginPath();
      for (let px = a; px <= b; px++) {
        const y = yAt(px) + THICK;
        if (px === a) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.strokeStyle = css('cyan');
      ctx.lineWidth = 1;
      ctx.stroke();

      // The torn edge where a section gave way.
      for (const edge of [a, b]) {
        if (!holed(cam.x + edge - 1) && !holed(cam.x + edge + 1)) continue;
        ctx.fillStyle = css('cyan');
        ctx.fillRect(Math.round(edge), Math.round(yAt(edge)), 1, THICK);
      }
    }

    // Icicles. Spaced on the world grid so they belong to the shelf, not the
    // camera.
    ctx.fillStyle = rgba('cyan', 0.8);
    for (let wx = Math.ceil(l.x0 / 14) * 14; wx < l.x1; wx += 14) {
      const px = wx - cam.x;
      if (px < -2 || px > INTERNAL_WIDTH + 2) continue;
      if (holed(wx)) continue;
      const drop = 2 + Math.floor(hash(wx) * 4);
      ctx.fillRect(Math.round(px), Math.round(yAt(px) + THICK), 1, drop);
    }

    // Both ends get a cut face, so the player can see where the shelf runs out.
    ctx.fillStyle = css('cyan');
    if (l.x0 - cam.x >= 0) ctx.fillRect(Math.round(from), Math.round(yAt(from)), 1, THICK);
    if (l.x1 - cam.x <= INTERNAL_WIDTH)
      ctx.fillRect(Math.round(to) - 1, Math.round(yAt(to)), 1, THICK);
  }
}

/**
 * Crumbling ice, drawn over the shelf it is part of.
 *
 * It has to read from across the frame, because the whole point of the
 * countdown is that a player can decide to hop it — and he cannot decide about
 * something he only sees once he is standing on it. So the section is a
 * different material rather than a marked one: translucent cyan over the ink
 * below instead of packed snow, cross-hatched with fractures.
 */
function drawIce(
  ctx: CanvasRenderingContext2D,
  course: Course,
  state: RunState,
  cam: Camera,
): void {
  for (let i = 0; i < course.ice.length; i++) {
    const sec = course.ice[i]!;
    if (sec.x1 - cam.x < -8 || sec.x0 - cam.x > INTERNAL_WIDTH + 8) continue;
    // A broken section is a hole: nothing is drawn, because nothing is there
    // and the simulation will not catch anybody here either.
    if (state.iceBroken[i] === 1) continue;
    const shelf = course.ledges.findIndex((l) => sec.x0 >= l.x0 && sec.x0 < l.x1);
    if (shelf < 0) continue;

    const from = Math.max(-2, Math.floor(sec.x0 - cam.x));
    const to = Math.min(INTERNAL_WIDTH + 2, Math.ceil(sec.x1 - cam.x));
    const yAt = (px: number): number => surfaceYAt(course, cam.x + px, shelf) - cam.y;
    const THICK = 6;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(from, yAt(from));
    for (let px = from; px <= to; px++) ctx.lineTo(px, yAt(px));
    for (let px = to; px >= from; px--) ctx.lineTo(px, yAt(px) + THICK);
    ctx.closePath();
    // Opaque, not a tint. Translucent cyan laid over the shelf's packed snow
    // came out a shade of white and was invisible from more than a few metres
    // away - fatal for a hazard whose entire design is that the player decides
    // to hop it BEFORE he reaches it. Ice is a different material from snow, so
    // it is drawn as one.
    ctx.fillStyle = css('cyan');
    ctx.fill();
    ctx.clip();

    // Fractures, widening while the countdown runs: the last warning is the one
    // the player is standing on.
    const standing = state.crumbleTicks > 0 && state.x >= sec.x0 && state.x < sec.x1;
    ctx.strokeStyle = css('ink');
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let wx = Math.ceil(sec.x0 / 7) * 7; wx < sec.x1; wx += 7) {
      const px = wx - cam.x;
      const lean = (hash(wx) - 0.5) * 5;
      ctx.moveTo(px, yAt(px) - 1);
      ctx.lineTo(px + lean, yAt(px) + THICK + 1);
      if (standing) {
        ctx.moveTo(px - 3, yAt(px) + 2);
        ctx.lineTo(px + 3, yAt(px) + 3);
      }
    }
    ctx.stroke();
    ctx.restore();

    // A marker post at each end, standing proud of the shelf in the hazard
    // colour (P-4). This is the part that carries at distance: the ice itself
    // is only six pixels of shelf edge-on, but a post breaks the shelf's
    // silhouette and reads as far as the shelf does. P-5 is satisfied by the
    // shape, not the colour - nothing else on the upper track stands up off it.
    for (const edge of [sec.x0, sec.x1]) {
      const px = Math.round(edge - cam.x);
      if (px < -1 || px > INTERNAL_WIDTH + 1) continue;
      const y = Math.round(yAt(px));
      ctx.fillStyle = css('orange');
      ctx.fillRect(px, y - 7, 1, 7 + THICK);
      ctx.fillRect(px - 1, y - 7, 3, 2);
    }
  }
}

/**
 * A rock breaking up through the shelf. Ink mass, orange hazard edge (P-4),
 * snow caught on the windward face.
 *
 * Deliberately unlike the deadfall it rhymes with: the log is a horizontal
 * orange barrel and this is a vertical dark wedge, so at speed the two never
 * trade places in the player's head (P-5, style bible TR-2).
 */
function drawRocks(ctx: CanvasRenderingContext2D, course: Course, cam: Camera): void {
  for (const rock of course.rocks) {
    const px = rock.x - cam.x;
    if (px < -30 || px > INTERNAL_WIDTH + 30) continue;
    const shelf = course.ledges.findIndex((l) => rock.x >= l.x0 && rock.x < l.x1);
    if (shelf < 0) continue;
    const baseY = surfaceYAt(course, rock.x, shelf) - cam.y;
    const top = baseY - rock.height;
    const w = rock.width;

    ctx.fillStyle = css('ink');
    ctx.beginPath();
    ctx.moveTo(px - 1, baseY + 1);
    ctx.lineTo(px + w * 0.24, top + rock.height * 0.18);
    ctx.lineTo(px + w * 0.52, top);
    ctx.lineTo(px + w * 0.78, top + rock.height * 0.3);
    ctx.lineTo(px + w + 1, baseY + 1);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = css('orange');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 1, baseY + 0.5);
    ctx.lineTo(px + w * 0.52, top + 0.5);
    ctx.lineTo(px + w + 1, baseY + 0.5);
    ctx.stroke();

    // Snow packed against the uphill face, which also marks where the rock
    // meets the shelf.
    ctx.strokeStyle = css('snow');
    ctx.beginPath();
    ctx.moveTo(px + w * 0.52, top + 1.5);
    ctx.lineTo(px + w * 0.8, top + rock.height * 0.45);
    ctx.stroke();
  }
}

/**
 * A ramp: a wedge of packed snow with a striped face and a marked lip.
 *
 * Snow on snow is invisible, which is the whole problem with drawing a kicker
 * on a piste. The first cut was a plain white wedge and it read as a fold in
 * the terrain — unacceptable for the one object on the course that launches the
 * player without being asked. So the wedge carries hazard stripes and a hard
 * ink face, and the lip gets the same emphatic treatment LW-4 gives the contact
 * line, because the lip is exactly where the launch fires.
 */

function drawKickers(
  ctx: CanvasRenderingContext2D,
  course: Course,
  cam: Camera,
  tuning: Tuning,
): void {
  for (const k of course.kickers) {
    const px = k.x - cam.x;
    // Culled against the ramp's OWN width, not a fixed 80. A booter is 96 wide
    // against a 320-wide screen, so a fixed margin dropped it while its lip was
    // still on camera - it popped into existence under the player's feet.
    if (px < -(k.width + 40) || px > INTERNAL_WIDTH + 80) continue;
    const groundAt = (wx: number): number => terrainYAt(course.terrain, wx) - cam.y;
    const lipRise = rampRise(k, tuning, course);
    // Straight for a booter, curved for a pop - and taken from rampLift rather
    // than repeated here, so the shape the skier rides and the shape drawn under
    // him are the same shape by construction.
    const rampTop = (i: number): number =>
      groundAt(k.x + i) - rampLift(course, tuning, k.x + i, -1);

    const face = (): void => {
      ctx.beginPath();
      ctx.moveTo(px, groundAt(k.x));
      for (let i = 0; i <= k.width; i++) ctx.lineTo(px + i, rampTop(i));
      ctx.lineTo(px + k.width, groundAt(k.x + k.width));
      ctx.closePath();
    };

    face();
    ctx.fillStyle = css('snow');
    ctx.fill();

    // Hazard stripes, clipped to the wedge. P-5: the stripes carry the meaning
    // in pattern, so nothing here depends on telling yellow from white.
    ctx.save();
    face();
    ctx.clip();
    ctx.strokeStyle = css('yellow');
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = -lipRise; i < k.width + lipRise; i += 9) {
      // Each stripe is anchored to the ground UNDER it, not to the ramp's left
      // edge. Anchoring them all to one x put every stripe above the wedge on a
      // steep pitch, where the clip then removed the lot of them.
      ctx.moveTo(px + i, groundAt(k.x + i) + 4);
      ctx.lineTo(px + i + lipRise, groundAt(k.x + i + lipRise) - lipRise - 4);
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = css('ink');
    ctx.lineWidth = 1;
    face();
    ctx.stroke();

    // Chevrons up the ramp, then the lip. Both say the same thing twice, in
    // shape and in position, which is what a one-shot launch warrants.
    ctx.strokeStyle = css('ink');
    ctx.beginPath();
    for (let c = 1; c <= 3; c++) {
      const i = (k.width * c) / 4;
      const by = rampTop(i);
      ctx.moveTo(px + i - 5, by + 9);
      ctx.lineTo(px + i, by + 3);
      ctx.lineTo(px + i + 5, by + 9);
    }
    ctx.stroke();

    const lipX = px + k.width;
    const lipY = rampTop(k.width);
    ctx.fillStyle = css('cyan');
    ctx.fillRect(lipX - 4, Math.round(lipY) - 1, 5, 2);
    ctx.strokeStyle = css('ink');
    ctx.beginPath();
    ctx.moveTo(lipX, lipY);
    ctx.lineTo(lipX, groundAt(k.x + k.width));
    ctx.stroke();
  }
}

/**
 * A ski boundary rope: a twisted cord carrying pennants that hang to the floor
 * of the collision slab.
 *
 * It replaces the overhanging limb the `low` obstacle was drawn as until feature
 * 005, and the reason is rule L-0 rather than taste. TR-1 fills the frame with
 * five ranks of pine, so the old limb was a tree in
 * a forest of trees — same vocabulary, same greens and darks, same scale — and
 * a player could not pick out the one that kills him until he was on it. The
 * rope separates on three axes at once: no forest contains a rope (vocabulary),
 * `magenta` and `cyan` are the PLAYER's colours here and not the backdrop's
 * (palette), and a horizontal line with regular vertical teeth is a shape the
 * pine ranks never make (geometry). P-5 holds without leaning on any one of
 * them.
 *
 * THE CONTRACT IS CLAUSE 1 AND IT IS STRUCTURAL. The lowest mark this routine
 * emits is the orange edge at `bottom`, flat across the full span, and `bottom`
 * IS the collision floor `step.ts` reads. The pennant tips come down to meet it.
 * So "the shape the player sees is the shape he has to get under" (TR-2) is
 * true by construction rather than by care.
 *
 * WHY THE SAG LIVES IN THE CORD BAND ONLY. The supplied reference sags between
 * high points, and a sag that carried the pennant tips down with it would make
 * the lowest visible mark vary across the span — so a player would judge his
 * duck against a silhouette that dips lower in the middle than the thing that
 * actually kills him. That is precisely the misread this object exists to
 * remove, so the cord sags within its own band and the teeth stay flat.
 */
export function drawBoundaryRope(
  ctx: CanvasRenderingContext2D,
  x: number,
  width: number,
  bottom: number,
  thickness: number,
): void {
  const top = bottom - thickness;
  // The cord takes the top fifth of the slab and the pennants take the rest.
  // Proportional rather than a flat 4 units so the object still fits if
  // `branchThickness` is ever re-tuned — FR-196 freezes it at 18 for this
  // feature, but a drawing that only works at one thickness is a trap for the
  // next one.
  const cordBand = thickness * 0.22;
  const corePen = Math.max(1, cordBand * 0.5);
  // The cord's centre sits half a pen below the ceiling, so the TOP EDGE of the
  // stroke lands exactly on `top`. A stroke is centred on its path, so placing
  // the path on the ceiling would put half the pen above it — the same
  // off-by-half-a-pen that clause 2 exists to catch, in the other direction.
  const cordTop = top + corePen / 2;
  // Sag is bounded by what is left of the band after the pen, so the cord's
  // lower edge cannot reach past its own band and into the pennants.
  const sag = Math.max(0, Math.min(cordBand * 0.3, cordBand - corePen));
  /** Centre of the cord at t across the span, sagging inside its own band. */
  const cordY = (t: number): number => cordTop + Math.sin(t * Math.PI) * sag;

  // Purple core first, magenta twist over it: the barber stripe of the
  // reference sheet, drawn as alternating segments rather than as a texture,
  // because at this scale a texture is noise.
  const SEGS = 24;
  ctx.lineCap = 'butt';
  ctx.lineWidth = corePen;
  ctx.strokeStyle = css('purple');
  ctx.beginPath();
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS;
    const px = x + width * t;
    const py = cordY(t);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.strokeStyle = css('magenta');
  ctx.lineWidth = Math.max(1, cordBand * 0.34);
  for (let i = 0; i < SEGS; i += 2) {
    const t0 = i / SEGS;
    const t1 = (i + 1) / SEGS;
    ctx.beginPath();
    ctx.moveTo(x + width * t0, cordY(t0));
    ctx.lineTo(x + width * t1, cordY(t1));
    ctx.stroke();
  }

  // Pennants: regular teeth, point-down, every one reaching the slab floor.
  // Regular rather than wobbled on purpose — the repetition is half of what
  // makes the silhouette unmistakable against the pines, which are irregular
  // by construction.
  const count = Math.max(2, Math.round(width / 9));
  const step = width / count;
  const half = step * 0.36;
  const FLAGS: PaletteToken[] = ['magenta', 'cyan', 'blue'];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const cx = x + step * (i + 0.5);
    const hangY = cordY(t) + cordBand * 0.3;
    ctx.fillStyle = css(FLAGS[i % FLAGS.length] as PaletteToken);
    ctx.beginPath();
    ctx.moveTo(cx - half, hangY);
    ctx.lineTo(cx + half, hangY);
    ctx.lineTo(cx, bottom);
    ctx.closePath();
    ctx.fill();
  }

  // TR-3: the killing surface gets an EDGE, never a fill over the silhouette.
  // Drawn last so nothing covers it, and drawn flat across the whole span
  // because the whole span is what kills — the gaps between pennants are not a
  // way through. This is the lowest mark in the object and it sits exactly on
  // the collision floor.
  ctx.fillStyle = css('orange');
  ctx.fillRect(x, bottom - 1, width, 1);
}
/** Deadfall: a snow-capped log lying across the piste, with its end grain out. */
function drawDeadfall(
  ctx: CanvasRenderingContext2D,
  x: number,
  width: number,
  groundY: number,
  height: number,
): void {
  const top = groundY - height;
  const r = height / 2;
  const cy = top + r;

  ctx.fillStyle = css('orange');
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + width, top);
  ctx.lineTo(x + width, groundY);
  ctx.lineTo(x, groundY);
  ctx.closePath();
  ctx.fill();

  // End grain: the rings are what make it a log rather than a crate, and they
  // read at 12px where a wood texture along the barrel would not.
  ctx.strokeStyle = css('ink');
  ctx.lineWidth = 1;
  for (const rr of [r - 1.5, r * 0.6, r * 0.25]) {
    ctx.beginPath();
    ctx.ellipse(x + 4, cy, Math.max(1, rr * 0.55), Math.max(1, rr), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeRect(x + 0.5, top + 0.5, width - 1, height - 1);

  // A sawn-off stub, so it reads as fallen rather than placed.
  ctx.beginPath();
  ctx.moveTo(x + width - 5, top + 2);
  ctx.lineTo(x + width + 3, top - 4);
  ctx.stroke();

  ctx.fillStyle = css('snow');
  ctx.fillRect(x, top, width, 2);
  ctx.fillRect(x + width - 6, top - 5, 4, 2);
}

// ---------------------------------------------------------------------------

export function drawRun(
  ctx: CanvasRenderingContext2D,
  state: RunState,
  course: Course,
  tuning: Tuning,
  motion: MotionSettings = FULL_MOTION,
  shake: Shake = { x: 0, y: 0 },
  flashAlpha = 0,
  tumble: Tumble = { spin: 0, slide: 0 },
  skin: SkierSkin | null = null,
): void {
  const cam = cameraFor(state, course);
  // The kick is applied to the CAMERA, not to the finished frame. Translating
  // the buffer afterwards would drag the sky with it and leave a bare strip at
  // the edge; moving the camera shakes the world inside a frame that still
  // fills.
  cam.x += shake.x;
  cam.y += shake.y;

  // Sky: purple to blue, style bible P-3.
  const sky = ctx.createLinearGradient(0, 0, 0, INTERNAL_HEIGHT);
  sky.addColorStop(0, css('blue'));
  sky.addColorStop(1, css('purple'));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

  drawSun(ctx, cam, motion);

  // Four depths of country, each lifted a little further above the piste than
  // the last. Under reduced motion the far ranks are dropped rather than
  // frozen: a still backdrop at the wrong parallax is more confusing than no
  // backdrop, and T-5 requires the run to work without it.
  if (motion.parallax) {
    drawRidge(ctx, course, cam, 0.22, 60, 7, rgba('purple', 0.95), true);
    drawPineRank(ctx, course, cam, {
      parallax: 0.36,
      lift: 44,
      relief: 6,
      spacing: 17,
      height: 9,
      body: rgba('purple', 0.85),
      salt: 11,
      snow: false,
    });
    drawRidge(ctx, course, cam, 0.5, 30, 4, css('purple'), false);
    drawPineRank(ctx, course, cam, {
      parallax: 0.62,
      lift: 22,
      relief: 3,
      spacing: 26,
      height: 15,
      body: rgba('ink', 0.7),
      salt: 77,
      snow: false,
    });
  }
  // The near rank stands on the piste itself and is drawn before it, so the
  // trunks are buried in the snowpack rather than floating on top of it.
  drawPineRank(ctx, course, cam, {
    parallax: 0.94,
    lift: 0,
    relief: 0,
    spacing: 44,
    height: 27,
    body: css('ink'),
    salt: 909,
    snow: true,
  });

  drawSnowfall(ctx, cam, state.tick, motion);

  drawPiste(ctx, course, cam);
  drawKickers(ctx, course, cam, tuning);
  drawLedges(ctx, course, cam, state);
  drawIce(ctx, course, state, cam);
  drawRocks(ctx, course, cam);

  // Pickups. Shape differs by value as well as colour (P-5): a small pickup is
  // a square, a large one a diamond, so the two are told apart without hue.
  for (let i = 0; i < course.pickups.length; i++) {
    if (state.pickupsTaken[i] === 1) continue;
    const p = course.pickups[i]!;
    const px = p.x - cam.x;
    if (px < -10 || px > INTERNAL_WIDTH + 10) continue;
    const py = terrainYAt(course.terrain, p.x) + p.y - cam.y;
    if (p.value === 'large') {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = css('yellow');
      ctx.fillRect(-3, -3, 6, 6);
      ctx.strokeStyle = css('ink');
      ctx.lineWidth = 1;
      ctx.strokeRect(-3.5, -3.5, 7, 7);
      ctx.restore();
    } else {
      ctx.fillStyle = css('cyan');
      ctx.fillRect(px - 2, py - 2, 4, 4);
      ctx.strokeStyle = css('ink');
      ctx.strokeRect(px - 2.5, py - 2.5, 5, 5);
    }
  }

  // Obstacles.
  for (const o of course.obstacles) {
    const px = o.x - cam.x;
    if (px < -60 || px > INTERNAL_WIDTH + 60) continue;
    const groundY = terrainYAt(course.terrain, o.x) - cam.y;
    if (o.kind === 'low')
      drawBoundaryRope(ctx, px, o.width, groundY - o.clearance, tuning.branchThickness);
    else drawDeadfall(ctx, px, o.width, groundY, tuning.standHeight);
  }

  drawSkier(ctx, state, course, tuning, cam, motion, tumble, skin);

  // FR-111's whiteout, over everything and after the skier. Capped well below a
  // full white frame and rate-limited by the caller (FR-057).
  if (flashAlpha > 0) {
    ctx.fillStyle = rgba('snow', flashAlpha);
    ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
  }
}

/**
 * What the sprite path needs from the caller. Null means "no sheet", which is
 * the normal state until the art loads and the permanent state if it never
 * does - see drawSkier's two branches.
 */
export interface SkierSkin {
  sheets: SpriteSheets;
  pose: PoseKey;
  /** Drives cycling within a multi-cell pose. Simulation ticks, never frames. */
  tick: number;
}

/** The sheet id the manifest declares for the player. */
const SKIER_SHEET = 'skier';

function drawSkier(
  ctx: CanvasRenderingContext2D,
  state: RunState,
  course: Course,
  tuning: Tuning,
  cam: Camera,
  motion: MotionSettings,
  tumble: Tumble,
  skin: SkierSkin | null,
): void {
  // A wipeout carries the body a little further down the slope before it
  // stops. The slide follows the ground rather than the screen, so he ends up
  // lying on the snow instead of drifting off it.
  const slope = slopeAt(course.terrain, state.x);
  const px = state.x - cam.x + slope.ux * tumble.slide;
  const py =
    state.y - cam.y + slope.uy * tumble.slide - rampLift(course, tuning, state.x, state.ledge);
  const height =
    tuning.standHeight - (tuning.standHeight - tuning.crouchHeight) * state.crouchProfile;

  // Rooster tail. Only while carving, only behind him, and only at the depth of
  // the surface he is actually on — spray coming off the piste while he is on
  // the shelf would be a lie about which track he is riding.
  if (state.grounded && motion.parallax && tumble.slide === 0) {
    ctx.fillStyle = rgba('snow', 0.75);
    for (let i = 0; i < 7; i++) {
      const age = ((state.tick * 1.7 + i * 5) % 18) / 18;
      const sx = px - age * 22 - 4;
      const behind = state.x - age * 22;
      const sy =
        surfaceYAt(course, behind, state.ledge) -
        cam.y -
        age * 7 -
        rampLift(course, tuning, behind, state.ledge);
      const s = age < 0.5 ? 2 : 1;
      ctx.fillRect(Math.round(sx), Math.round(sy), s, s);
    }
  }

  // The sprite path (FR-159). Alignment to the slope is carried by WHICH POSE
  // is drawn, not by rotating the image (FR-169), so a skiing character is a
  // plain drawImage at integer coordinates and the pixel grid survives intact.
  //
  // The two exceptions are the two places rotation is itself the subject and
  // grid breakup is acceptable: a spin that is turning, and the wipeout tumble.
  if (skin !== null && skin.sheets.ready(SKIER_SHEET)) {
    const spinning = state.spinTicksLeft > 0;
    const tumbling = tumble.spin !== 0;
    if (spinning || tumbling) {
      ctx.save();
      ctx.translate(Math.round(px), Math.round(py));
      ctx.rotate(Math.atan2(state.oy, state.ox) + tumble.spin);
      skin.sheets.draw(ctx, SKIER_SHEET, skin.pose, skin.tick, 0, 0);
      ctx.restore();
    } else {
      skin.sheets.draw(ctx, SKIER_SHEET, skin.pose, skin.tick, px, py);
    }
    return;
  }

  // The fallback (FR-172, research R4).
  //
  // This is not a placeholder written for the occasion - it is the renderer
  // that has shipped every run so far, kept deliberately rather than deleted.
  // A fallback that has never been played is a second untested path, and
  // Principle VI is explicit that a failure path never executed is untested
  // however carefully it was written. Keeping the incumbent makes its quality a
  // fact rather than a hope, and tests/e2e-build/sprite-never-blocks.spec.ts
  // plays a full run through it.
  //
  // The scarf below is drawn here and NOT in the sprite path, because the sheet
  // draws its own. The two branches are allowed to differ in decoration; what
  // they may not do is disagree about whether the player is visible.
  ctx.save();
  ctx.translate(px, py);
  // Orientation is a unit vector; atan2 is fine HERE because rendering is not
  // the simulation and nothing here feeds back into the score.
  ctx.rotate(Math.atan2(state.oy, state.ox) + tumble.spin);

  // Body — magenta, the player colour (P-4: hazards are never magenta).
  ctx.fillStyle = css('magenta');
  ctx.fillRect(-4, -height, 8, height);
  ctx.strokeStyle = css('ink');
  ctx.lineWidth = 1;
  ctx.strokeRect(-3.5, -height + 0.5, 7, height - 1);

  // Headband and shades — LW-3: the silhouette reads without interior detail,
  // this is the bonus at rest.
  ctx.fillStyle = css('yellow');
  ctx.fillRect(-4, -height, 8, 2);
  ctx.fillStyle = css('ink');
  ctx.fillRect(-3, -height + 3, 6, 2);

  // Scarf, streaming back. Pure decoration, and the only thing on him that
  // moves when he does not.
  ctx.fillStyle = css('cyan');
  const flap = motion.parallax ? Math.sin(state.tick * 0.25) * 1.5 : 0;
  ctx.beginPath();
  ctx.moveTo(-4, -height + 4);
  ctx.lineTo(-11, -height + 3 + flap);
  ctx.lineTo(-11, -height + 6 + flap);
  ctx.lineTo(-4, -height + 7);
  ctx.closePath();
  ctx.fill();

  // Skis
  ctx.fillStyle = css('snow');
  ctx.fillRect(-8, 0, 16, 2);
  ctx.strokeStyle = css('ink');
  ctx.strokeRect(-8.5, -0.5, 17, 3);
  ctx.restore();
}
