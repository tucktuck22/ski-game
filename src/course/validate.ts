/**
 * Course validator. Rules CV-1 to CV-9 of contracts/course-data.md, run in CI
 * over every course file. The build fails on any violation.
 *
 * CV-4 is the reason this file exists. FR-088 makes releasing a crouch under a
 * low obstacle fatal, and ducking requires crouching, so a cautious player
 * cannot opt out of the mechanic. A single low obstacle placed just before a
 * long tunnel makes the course unfinishable for exactly the players FR-035
 * protects — and it is invisible to review. It would surface as one friend
 * saying the game is broken, after the draft had already started.
 */
import type { Course, Obstacle, Scoring, TerrainPoint, Tuning } from '../sim/types.js';
import { overheadClearanceAt, ledgeIndexAt } from '../sim/terrain.js';
import { maxAchievableBonus } from '../sim/scoring.js';

export interface Violation {
  rule: string;
  message: string;
}

function unit(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  return len === 0 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

/** Steepest segment the contact solver resolves cleanly: 60 degrees, as a gradient. */
const MAX_GRADIENT = 1.732;

/** Ceiling on rotations a single maximum-charge air could plausibly produce. */
const TRICK_CEILING = 4;

/**
 * Apex height of a launch, in world units: v^2 / 2g under constant gravity.
 *
 * Used by CV-13 to decide, from data alone, whether a ramp can and cannot put a
 * given player on a given shelf. Math.sqrt and friends are fine here — the
 * validator is a build-time check, not the simulation.
 */
const apexOf = (impulse: number, gravity: number): number => (impulse * impulse) / (2 * gravity);

/** Minimum vertical margin between a shelf and the boughs it sails over (CV-14). */
const LEDGE_BRANCH_MARGIN = 8;

/** How far past a ramp's lip a shelf may begin and still be enterable (CV-13). */
const LEDGE_ENTRY_REACH = 220;

/** Clear shelf a player must get after arriving on it before the first hazard. */
const SHELF_RUN_IN = 200;

/** Clear shelf required between two upper-track hazards, so each reads alone. */
const SHELF_HAZARD_GAP = 120;

export function validateCourse(course: Course, tuning: Tuning, scoring: Scoring): Violation[] {
  const v: Violation[] = [];
  const t = course.terrain;

  // CV-1: terrain well-formed
  if (t.length < 2) v.push({ rule: 'CV-1', message: 'terrain needs at least two points' });
  if (t.length > 0 && (t[0] as TerrainPoint).x !== 0)
    v.push({ rule: 'CV-1', message: 'terrain must start at x = 0' });
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1] as TerrainPoint;
    const b = t[i] as TerrainPoint;
    if (b.x <= a.x)
      v.push({
        rule: 'CV-1',
        message: `terrain x must strictly increase (index ${i}: ${a.x} -> ${b.x})`,
      });
  }
  const last = t[t.length - 1] as TerrainPoint | undefined;
  if (last && last.x < course.length)
    v.push({
      rule: 'CV-1',
      message: `terrain ends at x=${last.x}, before the finish at ${course.length}`,
    });

  // CV-2: no segment too steep to resolve
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1] as TerrainPoint;
    const b = t[i] as TerrainPoint;
    const dx = b.x - a.x;
    if (dx <= 0) continue;
    const gradient = Math.abs((b.y - a.y) / dx);
    if (gradient > MAX_GRADIENT)
      v.push({
        rule: 'CV-2',
        message: `segment at x=${a.x} has gradient ${gradient.toFixed(2)}, over ${MAX_GRADIENT}`,
      });
  }

  // CV-10: adjacent segments must not differ in slope by more than the landing
  // tolerance. This rule was added after the simulation proved it was needed.
  // FR-089 guarantees somewhere to stand up after a low obstacle, but standing
  // up IS a launch (FR-078), so the cautious player who ducks is airborne
  // whether he wants to be or not. If the next segment tilts away from the one
  // he launched from by more than landingAngleTolerance, he wipes out on
  // landing through no fault of his own - and CV-7's promise that the course is
  // completable at base speed would be false.
  const cosLandingTolerance = Math.cos(tuning.landingAngleTolerance);
  for (let i = 2; i < t.length; i++) {
    const a = t[i - 2] as TerrainPoint;
    const b = t[i - 1] as TerrainPoint;
    const c = t[i] as TerrainPoint;
    const u1 = unit(b.x - a.x, b.y - a.y);
    const u2 = unit(c.x - b.x, c.y - b.y);
    const alignment = u1.x * u2.x + u1.y * u2.y;
    if (alignment < cosLandingTolerance)
      v.push({
        rule: 'CV-10',
        message:
          `terrain bends too sharply at x=${b.x}: adjacent segments differ by more than ` +
          `landingAngleTolerance (${tuning.landingAngleTolerance} rad), so a player launched ` +
          'from the first cannot land cleanly on the second (FR-089, CV-7).',
      });
  }

  const lows = course.obstacles
    .filter((o): o is Obstacle => o.kind === 'low')
    .slice()
    .sort((a, b) => a.x - b.x);

  // CV-3: a low obstacle must be passable crouched and impassable standing
  for (const o of lows) {
    if (o.clearance <= tuning.crouchHeight)
      v.push({
        rule: 'CV-3',
        message: `low obstacle at x=${o.x} has clearance ${o.clearance} <= crouchHeight ${tuning.crouchHeight}: impassable`,
      });
    if (o.clearance >= tuning.standHeight)
      v.push({
        rule: 'CV-3',
        message: `low obstacle at x=${o.x} has clearance ${o.clearance} >= standHeight ${tuning.standHeight}: pointless, it never forces a crouch`,
      });
  }

  // CV-4: every low obstacle is followed by a safe release window
  for (const o of lows) {
    const windowStart = o.x + o.width;
    const windowEnd = windowStart + tuning.safeReleaseWindowMin;
    let blockedAt: number | null = null;
    for (let x = windowStart; x <= windowEnd; x += 1) {
      if (overheadClearanceAt(course, x) < tuning.standHeight) {
        blockedAt = x;
        break;
      }
    }
    if (blockedAt !== null)
      v.push({
        rule: 'CV-4',
        message:
          `low obstacle at x=${o.x} has no safe release window: overhead is blocked again at ` +
          `x=${blockedAt}, only ${blockedAt - windowStart} units clear, needs ${tuning.safeReleaseWindowMin}. ` +
          'A player who ducks here has nowhere to stand up (FR-089).',
      });
  }

  // CV-5: low obstacles not packed closer than the release window
  for (let i = 1; i < lows.length; i++) {
    const prev = lows[i - 1] as Obstacle;
    const cur = lows[i] as Obstacle;
    // Footprints are half-open, matching overheadClearanceAt and step.ts.
    const gap = cur.x - (prev.x + prev.width);
    if (gap < tuning.safeReleaseWindowMin)
      v.push({
        rule: 'CV-5',
        message: `low obstacles at x=${prev.x} and x=${cur.x} are ${gap} apart, under ${tuning.safeReleaseWindowMin}`,
      });
  }

  // CV-7: completable at base speed, crouching only where CV-3 demands it
  for (const o of course.obstacles) {
    if (o.kind !== 'solid') continue;
    const overlapping = lows.find((l) => o.x < l.x + l.width && l.x < o.x + o.width);
    if (overlapping)
      v.push({
        rule: 'CV-7',
        message: `solid obstacle at x=${o.x} overlaps a low obstacle: no survivable line`,
      });
  }

  // CV-11: a solid obstacle must be jumpable by someone who is not already
  // committed elsewhere. Solid obstacles are cleared by launching over them,
  // and launching means charging a crouch first - so a solid placed inside the
  // release window after a tunnel would force the player to choose between
  // standing up (FR-088 kills him) and staying ducked (he hits the block).
  // Neither is survivable, and CV-7's promise would be false.
  for (const o of course.obstacles) {
    if (o.kind !== 'solid') continue;
    for (const l of lows) {
      const windowEnd = l.x + l.width + tuning.safeReleaseWindowMin;
      if (o.x < windowEnd && o.x + o.width > l.x - tuning.safeReleaseWindowMin)
        v.push({
          rule: 'CV-11',
          message:
            `solid obstacle at x=${o.x} sits within the safe release window of the low obstacle ` +
            `at x=${l.x}. The player would have to either stand up under the tunnel (FR-088) or ` +
            'stay ducked into the block. Neither is survivable.',
        });
    }
  }

  // CV-12: ledge geometry. Shelves may not overlap each other, may not run off
  // the end of the course, and may not sit so high that nothing could reach
  // them. Overlap is banned so that a descending skier has exactly one shelf to
  // resolve against, which is what keeps resolveLanding order-independent.
  const ledges = course.ledges.slice().sort((a, b) => a.x0 - b.x0);
  for (const l of ledges) {
    if (l.x1 <= l.x0)
      v.push({
        rule: 'CV-12',
        message: `ledge at x=${l.x0} ends at ${l.x1}: zero or negative span`,
      });
    if (l.x0 < 0 || l.x1 > course.length)
      v.push({ rule: 'CV-12', message: `ledge ${l.x0}..${l.x1} runs outside the course` });
    if (l.height <= 0)
      v.push({
        rule: 'CV-12',
        message: `ledge at x=${l.x0} has height ${l.height}: not above the piste`,
      });
    const bestApex = apexOf(tuning.launchImpulseMax, tuning.gravity);
    if (l.height > bestApex)
      v.push({
        rule: 'CV-12',
        message:
          `ledge at x=${l.x0} sits ${l.height} above the piste, beyond the ${bestApex.toFixed(1)} ` +
          'apex of a maximum-charge launch. Nothing could ever get onto it.',
      });
  }
  for (let i = 1; i < ledges.length; i++) {
    const prev = ledges[i - 1]!;
    const cur = ledges[i]!;
    if (cur.x0 < prev.x1)
      v.push({
        rule: 'CV-12',
        message: `ledges ${prev.x0}..${prev.x1} and ${cur.x0}..${cur.x1} overlap: a descending skier would have two shelves to land on at once`,
      });
  }

  // CV-13: every shelf must be a CHOICE - enterable by a player carrying speed,
  // and NOT enterable by one who is not.
  //
  // Both halves matter. Without the first the upper track is scenery. Without
  // the second it is a toll gate: a ramp that launches the cautious base-speed
  // pilot onto the shelf whether he wanted it or not takes the line SC-015 and
  // FR-035 promise him and replaces it with one he never chose. The upper track
  // is a reward for tucking, so the rule is written as the reward's precondition.
  for (const l of ledges) {
    const entries = course.kickers.filter((k) => {
      const lip = k.x + k.width;
      return lip <= l.x0 && l.x0 - lip <= LEDGE_ENTRY_REACH;
    });
    if (entries.length === 0) {
      v.push({
        rule: 'CV-13',
        message:
          `ledge at x=${l.x0} has no ramp within ${LEDGE_ENTRY_REACH} units before it. ` +
          'There is no way onto it, so it is decoration the player can see and never use.',
      });
      continue;
    }
    const reachable = entries.some((k) => {
      const impulse = Math.min(k.power * tuning.tuckSpeedMax, tuning.kickerImpulseMax);
      return apexOf(impulse, tuning.gravity) > l.height;
    });
    if (!reachable)
      v.push({
        rule: 'CV-13',
        message: `ledge at x=${l.x0} is ${l.height} up, but no ramp before it clears that height even at full tuck`,
      });
    for (const k of entries) {
      const impulse = Math.min(k.power * tuning.baseSpeed, tuning.kickerImpulseMax);
      if (apexOf(impulse, tuning.gravity) >= l.height)
        v.push({
          rule: 'CV-13',
          message:
            `ramp at x=${k.x} throws a BASE-SPEED skier onto the ledge at x=${l.x0}. ` +
            'The upper track must be earned by carrying speed, not imposed on the ' +
            'cautious pilot FR-035 protects.',
        });
    }
  }

  // CV-14: a shelf must clear every bough beneath it. A bough hangs from
  // ground - clearance - branchThickness; a skier on the shelf has his feet at
  // ground - height. If the shelf is not clear above the boughs it crosses, the
  // upper track is a corridor of collisions.
  for (const l of ledges) {
    for (const o of lows) {
      if (o.x + o.width <= l.x0 || o.x >= l.x1) continue;
      const boughTop = o.clearance + tuning.branchThickness;
      if (l.height < boughTop + LEDGE_BRANCH_MARGIN)
        v.push({
          rule: 'CV-14',
          message:
            `ledge at x=${l.x0} runs ${l.height} above the piste but crosses the bough at ` +
            `x=${o.x}, whose top is at ${boughTop}. A skier on the shelf would ride straight ` +
            `into it; it needs at least ${boughTop + LEDGE_BRANCH_MARGIN}.`,
        });
    }
  }

  // CV-15: ramps launch unconditionally, so they need the same clear air a
  // crouch release needs. A ramp under or beside a bough throws the player into
  // it with no input he could have given differently, which is exactly the
  // unwinnable situation CV-4 and CV-11 exist to prevent.
  for (const k of course.kickers) {
    if (k.power <= 0)
      v.push({ rule: 'CV-15', message: `ramp at x=${k.x} has power ${k.power}: it is not a ramp` });
    if (k.width <= 0) v.push({ rule: 'CV-15', message: `ramp at x=${k.x} has width ${k.width}` });
    for (const o of lows) {
      const windowEnd = o.x + o.width + tuning.safeReleaseWindowMin;
      if (k.x < windowEnd && k.x + k.width > o.x - tuning.safeReleaseWindowMin)
        v.push({
          rule: 'CV-15',
          message:
            `ramp at x=${k.x} sits within the safe release window of the bough at x=${o.x}. ` +
            'A ramp launches whether the player asked for it or not (FR-088).',
        });
    }
    for (const o of course.obstacles) {
      if (o.kind !== 'solid') continue;
      if (k.x < o.x + o.width && k.x + k.width > o.x)
        v.push({ rule: 'CV-15', message: `ramp at x=${k.x} overlaps the deadfall at x=${o.x}` });
    }
  }

  // CV-16: rocks and ice belong to a shelf. Anything outside one is anchored to
  // a surface that is not there - it would be drawn in mid-air and collide with
  // nothing, or worse, with a player on the piste who has no way to see why.
  for (const rock of course.rocks) {
    if (ledgeIndexAt(course, rock.x) < 0 || ledgeIndexAt(course, rock.x + rock.width - 1) < 0)
      v.push({
        rule: 'CV-16',
        message: `rock at x=${rock.x} is not wholly on a shelf: it has nothing to stand on`,
      });
  }
  for (const sec of course.ice) {
    if (sec.x1 <= sec.x0)
      v.push({
        rule: 'CV-16',
        message: `ice at x=${sec.x0} ends at ${sec.x1}: zero or negative span`,
      });
    if (ledgeIndexAt(course, sec.x0) < 0 || ledgeIndexAt(course, sec.x1 - 1) < 0)
      v.push({
        rule: 'CV-16',
        message: `ice ${sec.x0}..${sec.x1} is not wholly on a shelf: there is no surface for it to be part of`,
      });
    if (ledgeIndexAt(course, sec.x0) !== ledgeIndexAt(course, sec.x1 - 1))
      v.push({
        rule: 'CV-16',
        message: `ice ${sec.x0}..${sec.x1} spans two shelves`,
      });
  }

  // CV-17: a rock must be jumpable and must not be duckable. Ducking lowers the
  // head, never the feet, so a rock the player could crouch under would be a
  // rock he simply rides through - and one taller than a launch clears is a
  // wall on a track he cannot leave except by falling off it.
  for (const rock of course.rocks) {
    if (rock.height <= 0 || rock.width <= 0)
      v.push({ rule: 'CV-17', message: `rock at x=${rock.x} has no extent` });
    if (rock.height > tuning.standHeight)
      v.push({
        rule: 'CV-17',
        message:
          `rock at x=${rock.x} stands ${rock.height} above the shelf, over standHeight ` +
          `${tuning.standHeight}. Nothing on the upper track could clear it.`,
      });
  }

  // CV-18: a stretch of ice must be escapable and must not be outrunnable.
  //
  // Both halves, for the same reason CV-13 has two. Too long and a player who
  // reacts correctly still goes through, which makes the countdown decoration.
  // Too SHORT and he simply rides across before it gives way, which makes the
  // ice decoration instead - the first cut had exactly that, a 48-unit span
  // against a 20-tick countdown, and the shelf's only real hazard fired on
  // nobody. The span has to sit in the window between what the countdown lets
  // him cover and what one weak launch lets him clear.
  const escapeAir = (2 * tuning.launchImpulseMin) / tuning.gravity;
  const escapeReach = escapeAir * tuning.baseSpeed;
  const outrunReach = tuning.iceCrumbleTicks * tuning.tuckSpeedMax;
  for (const sec of course.ice) {
    const span = sec.x1 - sec.x0;
    if (span > escapeReach)
      v.push({
        rule: 'CV-18',
        message:
          `ice ${sec.x0}..${sec.x1} is ${span} long, past the ${escapeReach.toFixed(0)} ` +
          'a minimum-charge launch covers at base speed. A player who reacts correctly still ' +
          'goes through it, which makes the countdown decoration.',
      });
    if (span <= outrunReach)
      v.push({
        rule: 'CV-18',
        message:
          `ice ${sec.x0}..${sec.x1} is only ${span} long, inside the ${outrunReach.toFixed(0)} ` +
          `a player at tuck speed covers in the ${tuning.iceCrumbleTicks} ticks before it gives ` +
          'way. He rides straight across and the hazard fires on nobody.',
      });
  }

  // CV-19: the piste under a stretch of ice must be clear.
  //
  // Falling through is involuntary and unannounced - the player gave no input
  // that chose it. Dropping him onto a bough or a log would make an unavoidable
  // transition fatal, which is the same unfairness CV-4 and CV-15 exist to
  // prevent, arriving from above instead.
  for (const sec of course.ice) {
    const shelf = ledgeIndexAt(course, sec.x0);
    const height = shelf >= 0 ? (course.ledges[shelf] as { height: number }).height : 0;
    // How far he travels while falling the height of the shelf.
    const fallTicks = Math.sqrt((2 * height) / tuning.gravity);
    const landsBy = sec.x1 + fallTicks * tuning.tuckSpeedMax;
    for (const o of course.obstacles) {
      if (o.x + o.width < sec.x0 || o.x > landsBy) continue;
      v.push({
        rule: 'CV-19',
        message:
          `ice ${sec.x0}..${sec.x1} drops the player onto the ${o.kind} obstacle at x=${o.x}. ` +
          'Falling through is not a choice he made, so it must not be a choice that kills him.',
      });
    }
  }

  // CV-20: upper-track hazards must be spaced, and must never greet a player at
  // the moment he arrives. A rock in the landing zone of a ramp is a rock he is
  // committed to before he can see it.
  const shelfHazards = [
    ...course.rocks.map((r) => ({ x0: r.x, x1: r.x + r.width, what: `rock at x=${r.x}` })),
    ...course.ice.map((i) => ({ x0: i.x0, x1: i.x1, what: `ice at x=${i.x0}` })),
  ].sort((a, b) => a.x0 - b.x0);
  for (const h of shelfHazards) {
    const shelf = ledgeIndexAt(course, h.x0);
    if (shelf < 0) continue;
    const l = course.ledges[shelf] as { x0: number };
    if (h.x0 - l.x0 < SHELF_RUN_IN)
      v.push({
        rule: 'CV-20',
        message:
          `${h.what} sits ${h.x0 - l.x0} into the shelf that starts at x=${l.x0}, inside the ` +
          `${SHELF_RUN_IN} of run-in a player needs to land, recover and read it.`,
      });
  }
  for (let i = 1; i < shelfHazards.length; i++) {
    const prev = shelfHazards[i - 1]!;
    const cur = shelfHazards[i]!;
    if (ledgeIndexAt(course, prev.x0) !== ledgeIndexAt(course, cur.x0)) continue;
    if (cur.x0 - prev.x1 < SHELF_HAZARD_GAP)
      v.push({
        rule: 'CV-20',
        message: `${prev.what} and ${cur.what} are ${cur.x0 - prev.x1} apart, under ${SHELF_HAZARD_GAP}`,
      });
  }

  // CV-8: FR-034 dominance — a finish must beat any wipeout
  const maxBonus = maxAchievableBonus(course, scoring, TRICK_CEILING);
  if (scoring.completionBase <= maxBonus)
    v.push({
      rule: 'CV-8',
      message:
        `completionBase ${scoring.completionBase} does not exceed the maximum achievable bonus ` +
        `${maxBonus}. FR-034 requires every finisher to outrank every non-finisher.`,
    });

  // CV-9: nothing placed off the reachable surface. The ceiling rises with the
  // upper track: a pickup sitting on a shelf is measured from the piste, so a
  // fixed limit would have made every upper-track pickup a violation.
  const highestLedge = course.ledges.reduce((h, l) => (l.height > h ? l.height : h), 0);
  const pickupCeiling = -(highestLedge + 60);
  for (const p of course.pickups) {
    if (p.x < 0 || p.x > course.length)
      v.push({ rule: 'CV-9', message: `pickup at x=${p.x} is outside the course` });
    if (p.y > 0)
      v.push({
        rule: 'CV-9',
        message: `pickup at x=${p.x} has y=${p.y}: below the surface, unreachable`,
      });
    if (p.y < pickupCeiling)
      v.push({
        rule: 'CV-9',
        message: `pickup at x=${p.x} is ${-p.y} above the piste: beyond any launch from either track`,
      });
  }

  return v;
}

export function assertCourseValid(course: Course, tuning: Tuning, scoring: Scoring): void {
  const violations = validateCourse(course, tuning, scoring);
  if (violations.length > 0) {
    const detail = violations.map((x) => `  [${x.rule}] ${x.message}`).join('\n');
    throw new Error(`Course "${course.id}" failed validation:\n${detail}`);
  }
}
