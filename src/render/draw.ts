/**
 * Draws a run into the 320x180 buffer.
 *
 * Reads simulation state and never mutates it — the separation the constitution's
 * Technical Standards require. Colours come only from the style bible palette.
 */
import type { Course, RunState, Tuning } from '../sim/types.js';
import { terrainYAt } from '../sim/terrain.js';
import { PALETTE, type PaletteToken } from './palette.js';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './stage.js';

const css = (t: PaletteToken): string => {
  const [r, g, b] = PALETTE[t];
  return `rgb(${r},${g},${b})`;
};

/** The skier sits a third of the way across, so most of the buffer is lookahead. */
const CAMERA_X_OFFSET = INTERNAL_WIDTH / 3;

export interface Camera {
  x: number;
  y: number;
}

export const cameraFor = (state: RunState): Camera => ({
  x: state.x - CAMERA_X_OFFSET,
  y: state.y - INTERNAL_HEIGHT * 0.6,
});

export function drawRun(
  ctx: CanvasRenderingContext2D,
  state: RunState,
  course: Course,
  tuning: Tuning,
): void {
  const cam = cameraFor(state);

  // Sky: purple to blue, style bible P-3.
  const sky = ctx.createLinearGradient(0, 0, 0, INTERNAL_HEIGHT);
  sky.addColorStop(0, css('blue'));
  sky.addColorStop(1, css('purple'));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

  // Terrain: ink fill under a 1px cyan edge. LW-4 — that edge is the contact
  // line the physics actually uses, so it must never be decorative.
  ctx.beginPath();
  ctx.moveTo(0, INTERNAL_HEIGHT);
  for (let px = 0; px <= INTERNAL_WIDTH; px++) {
    const worldX = cam.x + px;
    ctx.lineTo(px, terrainYAt(course.terrain, worldX) - cam.y);
  }
  ctx.lineTo(INTERNAL_WIDTH, INTERNAL_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = css('ink');
  ctx.fill();

  ctx.beginPath();
  for (let px = 0; px <= INTERNAL_WIDTH; px++) {
    const y = terrainYAt(course.terrain, cam.x + px) - cam.y;
    if (px === 0) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }
  ctx.strokeStyle = css('cyan');
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pickups
  for (let i = 0; i < course.pickups.length; i++) {
    if (state.pickupsTaken[i] === 1) continue;
    const p = course.pickups[i]!;
    const px = p.x - cam.x;
    if (px < -10 || px > INTERNAL_WIDTH + 10) continue;
    const py = terrainYAt(course.terrain, p.x) + p.y - cam.y;
    ctx.fillStyle = css(p.value === 'large' ? 'yellow' : 'cyan');
    ctx.fillRect(px - 2, py - 2, 4, 4);
    ctx.strokeStyle = css('ink');
    ctx.strokeRect(px - 2.5, py - 2.5, 5, 5);
  }

  // Barriers — orange, hazard colour P-4. Marked with a break line so they read
  // as destructible rather than solid, which P-5 requires: not colour alone.
  for (let i = 0; i < course.barriers.length; i++) {
    if (state.barriersBroken[i] === 1) continue;
    const b = course.barriers[i]!;
    const px = b.x - cam.x;
    if (px < -40 || px > INTERNAL_WIDTH + 40) continue;
    const groundY = terrainYAt(course.terrain, b.x) - cam.y;
    ctx.fillStyle = css('orange');
    ctx.fillRect(px, groundY - 20, b.width, 20);
    ctx.strokeStyle = css('ink');
    ctx.beginPath();
    ctx.moveTo(px, groundY - 10);
    ctx.lineTo(px + b.width, groundY - 10);
    ctx.stroke();
  }

  // Obstacles
  for (const o of course.obstacles) {
    const px = o.x - cam.x;
    if (px < -60 || px > INTERNAL_WIDTH + 60) continue;
    const groundY = terrainYAt(course.terrain, o.x) - cam.y;
    ctx.fillStyle = css('orange');
    if (o.kind === 'low') {
      // A ceiling. Drawn hanging, so the gap beneath it reads as the way through.
      const underside = groundY - o.clearance;
      ctx.fillRect(px, underside - 26, o.width, 26);
      ctx.strokeStyle = css('snow');
      ctx.beginPath();
      ctx.moveTo(px, underside);
      ctx.lineTo(px + o.width, underside);
      ctx.stroke();
    } else {
      ctx.fillRect(px, groundY - tuning.standHeight, o.width, tuning.standHeight);
      ctx.strokeStyle = css('ink');
      ctx.strokeRect(
        px + 0.5,
        groundY - tuning.standHeight + 0.5,
        o.width - 1,
        tuning.standHeight - 1,
      );
    }
  }

  drawSkier(ctx, state, tuning, cam);
}

function drawSkier(
  ctx: CanvasRenderingContext2D,
  state: RunState,
  tuning: Tuning,
  cam: Camera,
): void {
  const px = state.x - cam.x;
  const py = state.y - cam.y;
  const height =
    tuning.standHeight - (tuning.standHeight - tuning.crouchHeight) * state.crouchProfile;

  ctx.save();
  ctx.translate(px, py);
  // Orientation is a unit vector; atan2 is fine HERE because rendering is not
  // the simulation and nothing here feeds back into the score.
  ctx.rotate(Math.atan2(state.oy, state.ox));

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

  // Skis
  ctx.fillStyle = css('snow');
  ctx.fillRect(-8, 0, 16, 2);
  ctx.restore();
}
