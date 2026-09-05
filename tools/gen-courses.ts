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
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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

const BOUGH_W = 40;
const DEADFALL_W = 24;
const RAMP_W = 56;

/**
 * The ordinary ramp, and the shelf height it is tuned against.
 *
 * These two numbers are one decision. At baseSpeed 2.6 a ramp of power 1.9 has
 * an apex of 38 - short of a 50-unit shelf, so the cautious pilot is hopped and
 * set back down on his own line. At tuckSpeedMax 4.2 the apex is 99. That gap IS
 * the upper track's entry fee, and CV-13 asserts both halves of it against
 * tuning.json rather than trusting this comment.
 */
const RAMP_POWER = 1.9;
const SHELF_H = 50;

/**
 * The Cornice's ramp and shelf, which charge a steeper fee than the ordinary
 * pair above. Power 1.5 onto 55: base-speed apex 23.8 (far under it) but
 * full-tuck apex only 62.0, so entry needs about 3.96 of the 4.2 available
 * rather than the 2.73 the ordinary ramp asks. Same rule, harder sum.
 */
const CORNICE_POWER = 1.5;
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
const BOOTER_MID = 0.7;
const BOOTER_BIG = 0.75;

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
const BOOTER_MID_FLOAT = 0.12;
/**
 * The warm-up floats less, because it has less hill. Its booter would otherwise
 * still be in the air at the finish line, and a jump the player never lands is
 * a poor way to teach him what landing one feels like.
 */
const BOOTER_WARMUP_FLOAT = 0.25;
const BOOTER_BIG_FLOAT = 0.085;

function official(): Built {
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
  kickers.push({ x: 1400, width: RAMP_W, power: RAMP_POWER });
  ledges.push({ x0: 1496, x1: 2396, height: SHELF_H });
  ice.push({ x0: 1876, x1: 1924 });
  rocks.push({ x: 2076, width: 16, height: 12 });
  deadfall(1800);
  shelfPickups(1496, 2396, SHELF_H, 5);
  bough(2600, 13);

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
  kickers.push({ x: 5200, width: RAMP_W, power: CORNICE_POWER });
  ledges.push({ x0: 5296, x1: 6596, height: CORNICE_H });
  ice.push({ x0: 5546, x1: 5594 });
  ice.push({ x0: 5746, x1: 5794 });
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
  bough(7600, 12);
  kickers.push({
    x: 7852,
    width: BOOTER_W_MID,
    power: BOOTER_MID,
    launchAngle: BOOTER_MID_ANGLE,
    gravityScale: BOOTER_MID_FLOAT,
  });

  // ---- VI. THE LAST PITCH (8,800 - 12,000). Ask: everything, at speed. ----
  // Steepest sustained grade of the course, the big booter, and a shelf that
  // runs to the line - CV-12 permits x1 = length exactly, and nothing has ever
  // used it. The high line crosses the finish still up on the shelf with the
  // largest pickup cluster on the mountain behind it; the low line crosses on
  // the piste beneath it. The two tracks resolve AT the line instead of petering
  // out 600 units short of it, which is where the old course stopped.
  bough(9000, 11);
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
    gravityScale: BOOTER_BIG_FLOAT,
  });
  kickers.push({ x: 11000, width: RAMP_W, power: RAMP_POWER });
  ledges.push({ x0: 11100, x1: 12000, height: SHELF_H });
  ice.push({ x0: 11350, x1: 11398 });
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
    rulesVersion: '1.6.0',
    length: 12000,
    terrain: terrain(
      [
        { x: 0, g: 0.2 }, // Drop In: mellow enough to read
        { x: 1200, g: 0.26 },
        { x: 3200, g: 0.42 }, // Shelf School builds
        { x: 5000, g: 0.6 }, // The Narrows: steep AND technical
        { x: 5400, g: 0.5 }, // The Cornice eases, so shelf work is readable
        { x: 7400, g: 0.44 },
        { x: 7800, g: 0.2 }, // The Flats: speed bleeds
        { x: 8900, g: 0.2 }, // held flat across booter 1's whole flight, so it
        { x: 9200, g: 0.2 }, // takes off and lands on the same angle
        // The Last Pitch stays SHALLOW under the big booter. A steep runway does
        // not show a floating skier more ground, it pulls the ground away from
        // him faster and puts it out of frame sooner.
        { x: 10900, g: 0.2 }, // shallow the whole way under the big float
        { x: 11200, g: 0.5 }, // and the steepest ground goes where it pays: the
        { x: 12200, g: 0.66 }, // run to the line, on the final shelf
      ],
      12000,
    ),
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
function warmup(): Built {
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
    rulesVersion: '1.6.0',
    length: 3200,
    terrain: terrain(
      [
        { x: 0, g: 0.22 },
        { x: 1400, g: 0.36 },
        { x: 2200, g: 0.3 }, // held flat across the booter's flight
        { x: 3200, g: 0.3 },
        { x: 3400, g: 0.34 },
      ],
      3200,
    ),
    obstacles,
    pickups,
    ledges: [{ x0: 1496, x1: 2196, height: SHELF_H }],
    kickers: [
      { x: 1400, width: RAMP_W, power: RAMP_POWER },
      {
        // Clear of the shelf that ends at 2196: a kicker under a ledge never
        // fires, because the skier rides off the shelf already airborne.
        x: 2386,
        width: BOOTER_W_WARMUP,
        power: BOOTER_MID,
        launchAngle: BOOTER_MID_ANGLE,
        gravityScale: BOOTER_WARMUP_FLOAT,
      },
    ],
    rocks: [{ x: 1926, width: 16, height: 12 }],
    ice: [{ x0: 1726, x1: 1774 }],
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
