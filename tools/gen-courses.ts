/**
 * Authors data/courses/*.json.
 *
 * This is a BUILD-TIME tool, not runtime generation. research R4 rejected
 * generating geometry from the seed at run time: it would turn CV-4 into a
 * property to be proven over a generator rather than checked over data, and a
 * bad seed could produce an unfinishable official course with no review step
 * to catch it. The output is committed and validated in CI.
 *
 * WHAT CHANGED, AND WHY IT IS NOW WRITTEN OUT LONGHAND
 *
 * The previous cut laid one 1,200-unit stretch - bough, ramp at +400, shelf at
 * +496, deadfall at +800 - and repeated it nine times down the official course.
 * Every validator rule passed and both robot pilots finished, because "the same
 * thing nine times" is not a property any of those checks look for. Only a
 * person riding it notices, which is the case Principle VIII now makes.
 *
 * So the loop is gone. The course is written out section by section, because a
 * course with a shape cannot be expressed as a repeat count. Terrain is authored
 * too: the gradient used to be a uniform roll in [0.16, 0.62] per segment, which
 * gives a mountain with no memory - no sustained pitch, no flat, statistically
 * identical everywhere. It is now a programme of keyed gradients, so the hill
 * itself does some of the pacing.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Feature 006 made every "how fast will he be going here" question local.
 *
 * The generator used to author one RAMP_POWER for every ordinary ramp, because
 * carried speed was the same everywhere: baseSpeed 2.6 standing, tuckSpeedMax
 * 4.2 tucked, on a nursery slope and on a headwall alike. It no longer is, so a
 * single power cannot hold CV-13's entry fee across ramps sitting on different
 * pitches — and it did not: the ramp at x=11,000 sits on gradient 0.400 and its
 * UNTUCKED impulse rose from 4.94 to 5.67, which threw the cautious pilot onto
 * a shelf he never asked for.
 *
 * So powers and ice spans are DERIVED here from the gradient each feature
 * actually stands on. Tuning is read from the same file the game reads, rather
 * than copied, because two copies of a feel constant is how they drift.
 */
const TUNING = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../data/tuning.json'), 'utf8'),
) as {
  gravity: number;
  slopeFriction: number;
  dragStanding: number;
  dragTucked: number;
  launchImpulseMin: number;
  iceCrumbleTicks: number;
};

/** Terminal speed on a gradient — the same model as src/sim/slopeResponse.ts. */
function terminalAt(gradient: number, tucked: boolean): number {
  const len = Math.sqrt(1 + gradient * gradient);
  const ux = 1 / len;
  const uy = gradient / len;
  const net = TUNING.gravity * (uy - TUNING.slopeFriction * ux);
  if (net <= 0) return 0;
  return Math.sqrt(net / (tucked ? TUNING.dragTucked : TUNING.dragStanding));
}

type P = { x: number; y: number };

interface Built {
  id: string;
  rulesVersion: string;
  length: number;
  terrain: P[];
  obstacles: { x: number; kind: 'low' | 'solid'; width: number; clearance: number }[];
  pickups: { x: number; y: number; value: 'small' | 'large' }[];
  ledges: { x0: number; x1: number; height: number }[];
  kickers: {
    x: number;
    width: number;
    power: number;
    launchAngle?: number;
    gravityScale?: number;
  }[];
  rocks: { x: number; width: number; height: number }[];
  ice: { x0: number; x1: number }[];
}

/** Gradient keyed at a distance. Between keys the gradient is interpolated. */
type GradeKey = { x: number; g: number };

/**
 * Terrain from a gradient programme.
 *
 * Interpolating between keys rather than stepping between them is what keeps
 * CV-10 satisfied for free: the rule caps how much two adjacent segments may
 * differ in angle, and a 200-unit sample of a ramp spread over a whole section
 * moves by a fraction of a degree. Standing up after a duck IS a launch
 * (FR-078), so a cautious player is airborne whether he meant to be or not, and
 * a hill that kinked under him would wipe him out for nothing.
 */
function terrain(keys: GradeKey[], length: number, step = 200): P[] {
  const gradeAt = (x: number): number => {
    if (x <= (keys[0] as GradeKey).x) return (keys[0] as GradeKey).g;
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1] as GradeKey;
      const b = keys[i] as GradeKey;
      if (x <= b.x) return a.g + (b.g - a.g) * ((x - a.x) / (b.x - a.x));
    }
    return (keys[keys.length - 1] as GradeKey).g;
  };
  const pts: P[] = [{ x: 0, y: 0 }];
  let y = 0;
  for (let x = 0; x < length + step; x += step) {
    y += gradeAt(x + step / 2) * step;
    pts.push({ x: x + step, y: Math.round(y * 100) / 100 });
  }
  return pts;
}

/**
 * Gradient of the generated segment containing x — the same value `slopeAt`
 * will read at run time.
 *
 * Derived from the emitted POINTS rather than from the gradient programme, so
 * the generator and the validator cannot disagree by the half-step terrain()
 * samples at. That half-step is not academic: at x=11,000 the programme
 * interpolates to 0.300 and the emitted segment is 0.400, and CV-13's entry fee
 * is decided on the second of those.
 */
function gradeAtPoints(pts: P[], x: number): number {
  let i = 0;
  for (let k = 1; k < pts.length - 1; k++) {
    if ((pts[k] as P).x <= x) i = k;
    else break;
  }
  const a = pts[i] as P;
  const b = pts[i + 1] as P | undefined;
  if (!b || b.x === a.x) return 0;
  return (b.y - a.y) / (b.x - a.x);
}

/**
 * The power a ramp needs to keep CV-13's entry fee on the pitch it stands on.
 *
 * CV-13 wants both halves: a tucking player reaches the shelf, an untucked one
 * does NOT. For a vertical launch the apex is impulse^2 / 2g, so reaching a
 * shelf of height H needs an impulse of sqrt(2gH), and impulse is power times
 * carried speed. That brackets power:
 *
 *     sqrt(2gH)/tucked  <  power  <  sqrt(2gH)/standing
 *
 * We take the geometric mean of the two bounds, which sits centrally in the
 * window on the ratio scale the bounds are defined on — so the fee has the same
 * proportional margin on both sides however steep the pitch is. Authoring a
 * single number for every ramp cannot do this: on a gentle pitch the window is
 * wide, on a steep one it is narrow, and 1.9 fell outside it.
 */
function rampPowerFor(height: number, gradient: number, gravityScale = 1): number {
  const need = Math.sqrt(2 * TUNING.gravity * gravityScale * height);
  const lo = need / terminalAt(gradient, true);
  const hi = need / terminalAt(gradient, false);
  return Math.round(Math.sqrt(lo * hi) * 1000) / 1000;
}

/**
 * How long a stretch of ice has to be on this pitch.
 *
 * CV-18 has two bounds and they both move with speed now: the span must exceed
 * what a tucking player covers in iceCrumbleTicks (or he outruns the countdown
 * and the hazard fires on nobody), and stay under what one minimum-charge hop
 * carries (or he cannot escape it at all). Sized at 1.35x the outrun floor,
 * which lands mid-window on both courses.
 */
function iceSpanFor(gradient: number): number {
  const outrun = TUNING.iceCrumbleTicks * terminalAt(gradient, true);
  const escape = ((2 * TUNING.launchImpulseMin) / TUNING.gravity) * terminalAt(gradient, false);
  // Sized off the OUTRUN floor, not the middle of the window.
  //
  // It used to be the geometric mean of the two bounds. That was fine while they
  // sat close together, and stopped being fine when gravity halved on
  // 2026-09-11: escape is (2*launchImpulseMin/gravity) * standing, so halving
  // gravity DOUBLED the ceiling, the mean drifted up with it, and the spans grew
  // until two of them on the Cornice were 115 apart against CV-20's 120.
  //
  // The floor is the meaningful bound anyway — the span exists so the countdown
  // cannot be outrun — and the ceiling is a safety check that it stays
  // escapable. 1.25x the floor is comfortably inside both.
  const want = outrun * 1.25;
  if (!(want > outrun && want < escape)) {
    throw new Error(
      `no legal ice span at gradient ${gradient.toFixed(3)}: outrun floor ${outrun.toFixed(1)} ` +
        `is not comfortably under the escape ceiling ${escape.toFixed(1)}`,
    );
  }
  return Math.round(want);
}

const BOUGH_W = 40;
const DEADFALL_W = 24;
const RAMP_W = 56;

/**
 * The ordinary shelf height. Its ramp's power is no longer a constant.
 *
 * These used to be one decision: at baseSpeed 2.6 a power-1.9 ramp apexed at 38,
 * short of a 50-unit shelf, and at tuckSpeedMax 4.2 it apexed at 99. That gap
 * WAS the upper track's entry fee. Feature 006 made carried speed depend on the
 * pitch, so one power can no longer hold that fee everywhere — rampPowerFor()
 * solves for it per ramp instead, and CV-13 still asserts both halves against
 * tuning.json rather than trusting any comment here.
 */
const SHELF_H = 50;

/**
 * The Cornice's shelf, which charges a steeper fee than the ordinary one above
 * simply by standing higher — 55 against 50. Its ramp power is derived like
 * every other, so the fee scales with the pitch rather than being re-authored.
 */
const CORNICE_H = 55;

/**
 * The booters, which exist to sell hang time rather than to reach anything.
 *
 * Measured against the simulation, not derived: at kickerImpulseMax 8.0 a launch
 * bought exactly 50 ticks of air, and a spin costs 15, so a triple landed with
 * five ticks to spare and a quarter-second of hesitation was fatal. That is a
 * ceiling pretending to be a trick. At the raised cap a power-2.5 booter buys 66
 * ticks: a triple lands with 21 ticks of margin and a quad is there for whoever
 * wants it. The cap had to move because power alone could not - every ramp on
 * the course was already saturating the old one.
 *
 * A booter must have NO shelf within CV-13's reach after it, or the rule that
 * keeps the upper track voluntary would read this launch as a way onto one.
 */
/**
 * Booter widths. Width is the size knob, because height is not free: the
 * renderer derives a wedge's rise from its width and the angle the launch
 * appears to leave at ON SCREEN, so the face a skier rides up is the line he is
 * then seen to fly along.
 *
 * They grew again here. The drawn face has to be built against the flight as
 * DRAWN, and the camera compresses a flight's apparent rise by half while it
 * lifts him up the frame - so a correct face is half as steep as the world
 * angle, and a wedge only keeps its size by getting longer. Which is, again,
 * how a bigger one gets built on a real hill.
 *
 * The x values carry each change so every LIP stays exactly where it was, and
 * with it every flight the course was measured against.
 */
const BOOTER_W_WARMUP = 110;
const BOOTER_W_MID = 144;
const BOOTER_W_BIG = 208;
/**
 * The booters. Power is a RAW multiplier on carried speed, deliberately, and
 * they now fly under REAL GRAVITY.
 *
 * A launch is power x carried speed, so leaving these fixed is what makes a
 * booter pay for its run-in: hit the lip off the steep and the impulse is
 * bigger, because you rode faster. An earlier cut normalised them against a
 * fixed carried speed, which made them completely indifferent to how you rode
 * in — the defect the first playtest reported.
 *
 * gravityScale is GONE. Both booters used to fly at a tenth of gravity (0.085
 * on the big one), which bought 214 ticks of hang and twelve rotations off a
 * single jump: three and a half seconds of airtime, which is cartoon physics
 * rather than skiing. The second playtest asked for real gravity and accepted
 * what it costs, which is the trick ceiling: 12 rotations -> 4.
 *
 * Powers came down on 2026-09-11 when gravity was halved (0.32 -> 0.16). Apex is
 * up^2/2g, so halving gravity doubles the height a given launch reaches, and
 * hang time is 2*up/g, so trading power back for gravity buys flight time at the
 * same height. That is the whole reason the gravity moved.
 *
 * 1/sqrt(2) was the algebra's answer and it came out 13% too strong, because the
 * apex that matters is measured above the GROUND and the ground keeps falling
 * away underneath a longer flight. Height above the launch point was preserved
 * exactly; clearance over the snow still grew 180 -> 207. So these are solved
 * against the simulation instead: 1.55 lands the big one at apex 173 with 91
 * ticks of air, and 1.35 the small one at 116 with 74.
 *
 * The frame still sets the ceiling. The camera can follow a climb to 184 units
 * (AIR_LIFT_MAX 92 over AIR_LIFT 0.5) and the big one apexes just under that.
 */
const BOOTER_MID = 1.35;
const BOOTER_BIG = 1.55;

/**
 * Booters throw FORWARD, not up. This is the whole shape of them.
 *
 * Reported from play, and correct: a launch of 12.5 straight up against a
 * forward speed of 4.2 leaves the lip at 71 degrees and comes back down at 71
 * degrees. It tosses the skier up and drops him more or less where he stood,
 * which reads as a fall no matter how much air it technically buys - and it
 * does not feel like he keeps his speed, because next to a vertical 12.5 his
 * forward 4.2 is nothing to see. (vx itself is untouched in flight; only air
 * control nudges it, by 0.0025 a tick.)
 *
 * Tilting the launch forward spends the same impulse on distance. Measured on a
 * constant 0.45 pitch, the same ramp at 62 degrees instead of 90 travels 459
 * units instead of 207 and carries the skier over the lip at 7.8 rather than
 * 3.8. It also buys MORE air, not less - a flatter arc stays above a descending
 * hill longer - which is the part that is not obvious from the algebra.
 *
 * The impulses came down at the same time, and that is deliberate. Height is
 * the one thing the game cannot show: the buffer is 180 tall, and at the old
 * cap the snow was out of frame for two thirds of the flight even after the
 * camera was taught to lift. At these numbers it is in frame for all of it.
 */
const BOOTER_MID_ANGLE = 45;
const BOOTER_BIG_ANGLE = 45;

/**
 * How much of gravity a booter flight falls under, and why the launches that go
 * with it are so weak.
 *
 * Hang time and height are the same number. Any arc under constant gravity
 * peaks h = g*t^2/8 above its launch line, so four times the air costs SIXTEEN
 * times the height: at full gravity 225 ticks puts the skier 2,025 units up
 * against a render buffer 180 tall. Eleven screens. No camera fits that, and
 * zooming out until one does leaves him a pixel and a half wide, which LW-3
 * does not allow.
 *
 * The identity has a second reading, though, and it is the one that solves
 * this. Hold the HEIGHT fixed and it says t = sqrt(8h/g): at a given altitude,
 * air time is bought with lower gravity, without limit. So four seconds of hang
 * is not a bigger launch, it is a WEAKER one - a small pop that barely leaves
 * the snow, falling under a twentieth of gravity, across a shallow runway.
 * Measured: 225 ticks, 3.8 seconds, apex 111, and the ground in frame for every
 * tick of it. The obvious version - a huge launch off a steep drop - measures
 * 302 ticks with 69% of the flight showing no ground at all.
 *
 * The runways are shallow for the same reason, which is the counter-intuitive
 * half: a steep drop under a floating skier does not show him more ground, it
 * pulls the ground away from him faster and takes it out of frame sooner.
 */
/**
 * The warm-up floats less, because it has less hill. Its booter would otherwise
 * still be in the air at the finish line, and a jump the player never lands is
 * a poor way to teach him what landing one feels like.
 */

const OFFICIAL_GRADE: GradeKey[] = [
  // Re-paced 2026-09-10 against slope-driven speed, after the first playtest.
  //
  // The old programme ran 0.20 to 0.66 and was authored when speed was the same
  // everywhere, so a gradient only ever meant "how the hill looks". Under
  // feature 006 a gradient IS a speed, and that range mapped to 3.41 up to 5.86
  // tucked — so the two booters, which both sat down in the 0.20 floor, were
  // reached having shed 42% of the speed the steeps had just given, and had to
  // be flown on gravityScale 0.085 rather than on carried speed.
  //
  // The range is now 0.25 to 0.60, which is 4.00 to 5.91 tucked. The FLOOR came
  // up, because the floor is what a player feels as "slow"; the ceiling stayed
  // where it was, because 213 units of lookahead at 5.9 is already only 0.6s of
  // reaction and the frame cannot show more.
  //
  // The booter run-ins are the other half. A steep pitch is held RIGHT TO THE
  // LIP and dropped immediately after it: the speed is bought on the steep and
  // spent at the lip, and the shallow ground beyond is what keeps a floating
  // skier inside a 180-tall frame. Steep before, shallow after — the two jobs
  // want opposite things, and they happen 100 units apart.
  { x: 0, g: 0.25 }, // Drop In: the gentlest ground on the hill, and still moving
  { x: 1200, g: 0.3 }, // Shelf School: pitch enough to pay the ramp's entry fee
  { x: 3000, g: 0.34 },
  { x: 3200, g: 0.46 }, // The Narrows: steep and technical at the same time
  { x: 4600, g: 0.6 }, // the steepest ground on the course
  { x: 5000, g: 0.52 }, // the Cornice ramp is taken with real speed under you
  { x: 5400, g: 0.42 }, // eases, so shelf work up there stays readable
  { x: 6800, g: 0.38 },
  { x: 7300, g: 0.56 }, // RUN-IN to the first booter: the pitch that buys the air
  { x: 7700, g: 0.56 }, // held steep to the foot of the ramp
  // ...and eased ACROSS the ramp itself rather than at its lip. The drawn wedge
  // is built from the gradient at the lip (rampGeometry.gradeAtLip), and that
  // formula was derived on shallow ground: put the lip on 0.58 and the face
  // comes out 9 degrees off the flight leaving it. Easing here costs a little
  // of the speed the steep just bought — he reaches the lip near 5.0 instead of
  // 5.8 — and keeps the ramp drawn as the jump it actually gives.
  { x: 7800, g: 0.34 },
  { x: 8400, g: 0.26 }, // and shallow beyond, so the flight stays in frame
  { x: 8700, g: 0.26 }, // landing and roll-out
  { x: 8800, g: 0.58 }, // RUN-IN to the big booter, on the same bargain
  { x: 9100, g: 0.58 }, // held steep to the foot of its ramp
  { x: 9200, g: 0.34 }, // eased across the ramp, same reason
  { x: 10600, g: 0.25 }, // the long shallow landing the big one needs
  { x: 10900, g: 0.44 }, // the Last Pitch builds again
  { x: 11200, g: 0.52 },
  { x: 12200, g: 0.6 }, // and the run to the line
];

function official(): Built {
  // Terrain is built FIRST now, because the features below are derived against
  // the pitch they stand on rather than against a global carried speed.
  const pts = terrain(OFFICIAL_GRADE, 12000);
  const grade = (x: number): number => gradeAtPoints(pts, x);

  const obstacles: Built['obstacles'] = [];
  const pickups: Built['pickups'] = [];
  const ledges: Built['ledges'] = [];
  const kickers: Built['kickers'] = [];
  const rocks: Built['rocks'] = [];
  const ice: Built['ice'] = [];

  const bough = (x: number, clearance: number): void => {
    obstacles.push({ x, kind: 'low', width: BOUGH_W, clearance });
  };
  const deadfall = (x: number): void => {
    obstacles.push({ x, kind: 'solid', width: DEADFALL_W, clearance: 0 });
  };
  const shelfPickups = (x0: number, x1: number, height: number, n: number): void => {
    for (let k = 1; k <= n; k++) {
      pickups.push({
        x: Math.round(x0 + ((x1 - x0) * k) / (n + 1)),
        y: -(height + 6),
        value: 'large',
      });
    }
  };

  // ---- I. DROP IN (0 - 1,200). Ask: can you duck? ----
  // The old course opened with a thousand units of nothing before its first
  // obstacle. One generously-cleared bough at low speed instead, so the verb
  // that FR-088 makes fatal to get wrong is taught where it cannot cost a run.
  bough(700, 14);

  // ---- II. SHELF SCHOOL (1,200 - 3,200). Ask: will you pay for the high line? ----
  // The two-track idea, taught once and cleanly: ramp, shelf, its two hazards,
  // and a log on the piste for whoever stayed low.
  kickers.push({ x: 1400, width: RAMP_W, power: rampPowerFor(SHELF_H, grade(1400)) });
  ledges.push({ x0: 1496, x1: 2396, height: SHELF_H });
  ice.push({ x0: 1876, x1: 1876 + iceSpanFor(grade(1876)) });
  rocks.push({ x: 2076, width: 16, height: 12 });
  // Was 1800, and it has a narrow window now. The ramp at 1,400 throws to 1,812
  // since gravity halved, so CV-21 wants the log past that; the ice on the shelf
  // starts at 1,876 and CV-19 will not drop a player through it onto a log, so it
  // wants the log to end before that. 1,830 is the middle of the 40 units left.
  deadfall(1830);
  shelfPickups(1496, 2396, SHELF_H, 5);
  // Was 2,600, which put it 204 units past the shelf's lip - under the arc of
  // anyone who jumped off the end of it, and out of sight when he committed.
  // CV-24 refuses that now, and wants nothing before 2,937; CV-5 keeps 140
  // clear of the Narrows' opening bough at 3,300, which caps it at 3,120. The
  // middle of that window is 3,020, so Shelf School no longer gets a closing
  // obstacle - this reads as the Narrows' pickup note instead. That is a real
  // cost and it is the right one: the section boundary is a comment, and the
  // shelf exit is the best air in the first half of the course.
  //
  // 280 to the next bough is tighter than the Narrows' own 520 beat, and safe
  // for the reason that beat exists: 520 is what a bough-then-LOG needs, because
  // the player has to stand up and charge between them. Two boughs in a row ask
  // for one held crouch, which is the cheapest thing in the game.
  bough(3020, 13);

  // ---- III. THE NARROWS (3,200 - 5,000). Ask: how clean is your piste craft? ----
  // No shelf at all, and dense - but NOT as dense as the validator would allow,
  // which is the whole lesson of this section.
  //
  // The first cut read the rules off and took their floor: CV-5 wants 140 clear
  // between boughs and CV-11 keeps a log 140 clear of a bough on both sides, so
  // bough -> log at +190 -> bough at +380 passes. It passed, and the cautious
  // base-speed pilot died on the first log of the section every time. CV-11's
  // window says where standing up stops being fatal; it says nothing about
  // having room to then charge a launch, and 190 leaves ten units between the
  // two. A skilled player can duck the bough and release the duck itself as the
  // jump. The minimum-skill player SC-015 and FR-035 protect cannot, and the
  // course must be completable by him.
  //
  // So the beat is set by what the floor needs, not by what the rule permits:
  // 180 to stand, ~90 to charge, and margin. Log at +300, next bough at +520.
  // Still a decision every 520 units against the old course's 1,200.
  const NARROWS_BEAT = 520;
  const NARROWS_LOG_AT = 300;
  for (let i = 0; i < 4; i++) {
    const x = 3300 + i * NARROWS_BEAT;
    bough(x, 12 + (i % 3));
    if (i < 3) deadfall(x + NARROWS_LOG_AT);
  }

  // ---- IV. THE CORNICE (5,000 - 7,400). Ask: can you HOLD the high line? ----
  // The upper track returns and finally bites. Harder entry, a longer shelf, and
  // two ice bands instead of one, so the shelf asks something after the moment
  // you arrive on it - which the old one never did.
  kickers.push({ x: 5200, width: RAMP_W, power: rampPowerFor(CORNICE_H, grade(5200)) });
  ledges.push({ x0: 5296, x1: 6596, height: CORNICE_H });
  ice.push({ x0: 5546, x1: 5546 + iceSpanFor(grade(5546)) });
  ice.push({ x0: 5746, x1: 5746 + iceSpanFor(grade(5746)) });
  rocks.push({ x: 5996, width: 16, height: 12 });
  // Kept clear of BOTH ice drop zones: CV-19 will not have an involuntary fall
  // land on an obstacle, and a shelf 55 up throws the drop a long way downhill.
  deadfall(6100);
  bough(6400, 13);
  shelfPickups(5296, 6596, CORNICE_H, 7);

  // ---- V. THE FLATS (7,400 - 8,800). Ask: did you keep your speed? ----
  // Grade falls away and speed bleeds against tuckDecel. Sparse on purpose - it
  // is the only breath in the run - but not empty, because the booter that ends
  // it pays in proportion to the speed carried into it. A launch is power times
  // carried speed, so coasting here is not a rest, it is a smaller trick.
  // The Cornice throws a jumped lip to 6,958, and a bough at 7,000 stood in it
  // - the one a playtester called cheap and unfair, and the reason CV-24 exists.
  // Riding off the end of a shelf and spinning is the best air on the mountain
  // and the course should be asking for it, so the landing gets its full
  // run-out: CV-24's floor is 7,171, CV-5's ceiling against the bough below is
  // 7,420, and 7,300 sits between them. He lands around 6,900 on open snow and
  // the bough rises into frame some 185 units later, on his skis, with time to
  // duck it.
  bough(7300, 12);
  bough(7600, 12);
  kickers.push({
    x: 7852,
    width: BOOTER_W_MID,
    power: BOOTER_MID,
    launchAngle: BOOTER_MID_ANGLE,
  });

  // ---- VI. THE LAST PITCH (8,800 - 12,000). Ask: everything, at speed. ----
  // Steepest sustained grade of the course, the big booter, and a shelf that
  // runs to the line - CV-12 permits x1 = length exactly, and nothing has ever
  // used it. The high line crosses the finish still up on the shelf with the
  // largest pickup cluster on the mountain behind it; the low line crosses on
  // the piste beneath it. The two tracks resolve AT the line instead of petering
  // out 600 units short of it, which is where the old course stopped.
  // No log between the bough and the booter. Jumping one launches the skier,
  // and a skier already in the air crosses the lip without the ramp firing -
  // he simply flies over his own jump and never gets it. CV-22 now refuses
  // that layout; this is the course that taught it.
  // The big booter needs a RUNWAY, not a gap. It now covers some 640 units of
  // mountain, where the vertical toss it replaces covered 300, so the obstacles
  // that used to sit after it have moved ahead of it instead.
  // A floated launch covers a THOUSAND units now, so everything downhill of it
  // moved to give it a runway. The final ramp and its shelf start where the
  // flight has already landed.
  kickers.push({
    x: 9188,
    width: BOOTER_W_BIG,
    power: BOOTER_BIG,
    launchAngle: BOOTER_BIG_ANGLE,
  });
  kickers.push({ x: 11000, width: RAMP_W, power: rampPowerFor(SHELF_H, grade(11000)) });
  ledges.push({ x0: 11100, x1: 12000, height: SHELF_H });
  ice.push({ x0: 11350, x1: 11350 + iceSpanFor(grade(11350)) });
  rocks.push({ x: 11600, width: 16, height: 12 });
  deadfall(11600);
  bough(11850, 13);
  shelfPickups(11100, 12000, SHELF_H, 6);

  // Piste pickups: small, low, and frequent enough to mark the racing line.
  // Skipped across the booters' run-ups and landings, so nothing invites the
  // player to duck into a launch he cannot see the far side of.
  const booterZones = [
    [7880, 8800],
    [9280, 10900],
  ];
  for (let x = 300; x < 11900; x += 320) {
    if (booterZones.some(([a, b]) => x >= (a as number) && x <= (b as number))) continue;
    pickups.push({ x, y: -(4 + (x % 7)), value: 'small' });
  }

  return {
    id: 'official',
    rulesVersion: '2.0.0',
    length: 12000,
    terrain: pts,
    obstacles,
    pickups,
    ledges,
    kickers,
    rocks,
    ice,
  };
}

/**
 * The warm-up: the same schema and the same physics on distinct terrain
 * (FR-028, FR-067, ADR-0003). One of each thing the official course does -
 * a bough, a shelf with its hazards, a booter - and nothing repeated, because
 * its job is to introduce the verbs rather than to test them.
 */
const WARMUP_GRADE: GradeKey[] = [
  // Same band as the official course, so practice teaches the speeds the scored
  // run is actually ridden at. It used to open at 0.22, below the new floor.
  { x: 0, g: 0.26 },
  { x: 1400, g: 0.38 },
  { x: 2200, g: 0.3 }, // held steady across the booter's flight
  { x: 3200, g: 0.3 },
  { x: 3400, g: 0.34 },
];

function warmup(): Built {
  // Terrain first, for the same reason as official(): ramp power and ice span
  // are derived against the pitch they stand on.
  const pts = terrain(WARMUP_GRADE, 3200);
  const grade = (x: number): number => gradeAtPoints(pts, x);

  const obstacles: Built['obstacles'] = [
    { x: 700, kind: 'low', width: BOUGH_W, clearance: 14 },
    { x: 2000, kind: 'solid', width: DEADFALL_W, clearance: 0 },
  ];
  const pickups: Built['pickups'] = [];
  for (let k = 1; k <= 4; k++) {
    pickups.push({ x: Math.round(1496 + (700 * k) / 5), y: -(SHELF_H + 6), value: 'large' });
  }
  for (let x = 300; x < 3000; x += 320) {
    if (x >= 2380 && x <= 3100) continue; // the booter's run-up and landing
    pickups.push({ x, y: -(4 + (x % 7)), value: 'small' });
  }
  return {
    id: 'warmup',
    rulesVersion: '2.0.0',
    length: 3200,
    terrain: pts,
    obstacles,
    pickups,
    ledges: [{ x0: 1496, x1: 2196, height: SHELF_H }],
    kickers: [
      { x: 1400, width: RAMP_W, power: rampPowerFor(SHELF_H, grade(1400)) },
      {
        // Clear of the shelf that ends at 2196: a kicker under a ledge never
        // fires, because the skier rides off the shelf already airborne.
        x: 2386,
        width: BOOTER_W_WARMUP,
        power: BOOTER_MID,
        launchAngle: BOOTER_MID_ANGLE,
      },
    ],
    rocks: [{ x: 1926, width: 16, height: 12 }],
    ice: [{ x0: 1726, x1: 1726 + iceSpanFor(grade(1726)) }],
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../data/courses');
mkdirSync(out, { recursive: true });

const courses = [warmup(), official()];
for (const c of courses) {
  writeFileSync(resolve(out, `${c.id}.json`), JSON.stringify(c, null, 2) + '\n');
  console.log(
    `${c.id}: ${c.terrain.length} pts, ${c.obstacles.length} obstacles, ` +
      `${c.pickups.length} pickups, ${c.ledges.length} ledges, ${c.kickers.length} ramps, ` +
      `${c.rocks.length} rocks, ${c.ice.length} ice`,
  );
}
