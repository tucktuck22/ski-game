/**
 * The title card scene.
 *
 * Drawn in markup rather than shipped as an image, for two reasons. Style-bible O-1
 * permits period-_style_ and never period-_property_, so a found or borrowed picture
 * could not cite a rule at review under FR-052. And SC-051 keeps the title screen out
 * of the payload entirely: this is a few hundred bytes of SVG inside the bundle that
 * already ships, not a new request.
 *
 * Every colour is a palette token from style-bible section 1. There are eight, and
 * nothing here reaches outside them.
 *
 * L-0 governs the composition: legibility outranks style. The scene is background,
 * the wordmark and the control sit above it, and the scene never competes with either.
 */

/**
 * A synthwave sun with the horizontal bands cut out of it, the period's most
 * recognisable single image. The bands widen towards the bottom, which is what makes
 * it read as a sunset rather than a striped circle.
 */
function sun(): string {
  const bands = [
    { y: 36, h: 2 },
    { y: 41, h: 2.5 },
    { y: 47, h: 3 },
    { y: 54, h: 4 },
    { y: 62, h: 5 },
  ];
  return `
    <defs>
      <linearGradient id="sun-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--yellow)"/>
        <stop offset="55%" stop-color="var(--orange)"/>
        <stop offset="100%" stop-color="var(--magenta)"/>
      </linearGradient>
      <mask id="sun-bands">
        <rect x="0" y="0" width="320" height="180" fill="#fff"/>
        ${bands.map((b) => `<rect x="0" y="${b.y}" width="320" height="${b.h}" fill="#000"/>`).join('')}
      </mask>
    </defs>
    <circle cx="160" cy="44" r="30" fill="url(#sun-fill)" mask="url(#sun-bands)"/>`;
}

/** The horizon grid — perspective lines converging on the sun, in the period idiom. */
function grid(): string {
  const verticals = [-320, -200, -128, -76, -40, -14, 14, 40, 76, 128, 200, 320]
    .map((x) => `<line x1="${160 + x * 0.12}" y1="104" x2="${160 + x}" y2="180" />`)
    .join('');
  const horizontals = [108, 116, 127, 142, 162]
    .map((y) => `<line x1="0" y1="${y}" x2="320" y2="${y}" />`)
    .join('');
  return `<g stroke="var(--blue)" stroke-width="0.6" opacity="0.55">${verticals}${horizontals}</g>`;
}

/**
 * The ridge silhouette. Named once because three things need to agree on it
 * exactly: the rock fill, the clip that keeps the snow caps inside the rock,
 * and the lit edge stroked along the top.
 */
const RIDGE =
  'M0 104 L26 78 L44 90 L70 62 L98 92 L124 74 L152 100 L184 68 L208 88 ' +
  'L238 64 L266 92 L288 80 L320 102 L320 106 L0 106 Z';

/** Every peak worth capping, as [x, y, half-width, how far the snow reaches down]. */
/**
 * Half-width tracks the drop at roughly 1.4:1, because the ridge falls away at
 * close to 45 degrees. Wider than that and neighbouring caps meet across the
 * saddle between them - the clip cannot prevent it, since the saddle is inside
 * the silhouette too - and six ice caps become one snow blanket.
 */
const PEAKS: ReadonlyArray<[number, number, number, number]> = [
  [26, 78, 10, 7],
  [70, 62, 17, 12],
  [124, 74, 12, 8],
  [184, 68, 15, 10],
  [238, 64, 17, 12],
  [288, 80, 10, 7],
];

/**
 * One ice cap: snow lying on a peak, with a ragged lower edge where it gives
 * way to rock.
 *
 * The shape deliberately runs WIDER and HIGHER than the peak it caps and is
 * then clipped to the ridge. That is what makes it a cap rather than a
 * triangle placed on top of one - it cannot overhang into the sky, and it
 * cannot leave a sliver of bare rock above it, because both edges are the
 * mountain's own outline. The first version drew free-standing triangles and
 * did neither.
 */
function cap([px, py, w, drop]: readonly [number, number, number, number]): string {
  const y = py + drop;
  return `<path d="M${px - w} ${py - 44} L${px + w} ${py - 44} L${px + w} ${y - 3}
    Q${px + w * 0.55} ${y + 3} ${px + w * 0.18} ${y - 2}
    Q${px - w * 0.15} ${y + 4} ${px - w * 0.5} ${y}
    Q${px - w * 0.78} ${y + 3} ${px - w} ${y - 2} Z"/>`;
}

/** Mountains: rock, snow caps clipped to the rock, and the lit edge on top. */
function mountains(): string {
  return `
    <defs>
      <clipPath id="ridge-clip"><path d="${RIDGE}"/></clipPath>
    </defs>
    <path d="${RIDGE}" fill="var(--purple)"/>
    <g clip-path="url(#ridge-clip)" fill="var(--snow)" opacity="0.96">
      ${PEAKS.map(cap).join('')}
    </g>
    <!-- draw.ts strokes the same one-pixel lit edge along the game's ridge.
         It is what separates a silhouette from a mountain. -->
    <path d="${RIDGE}" fill="none" stroke="var(--snow)" stroke-width="0.7" opacity="0.5"/>`;
}

/**
 * A skier mid-air, in silhouette. Deliberately a silhouette: style-bible TR-2 asks
 * for shapes that read from across the frame, and a detailed figure at this size
 * would read as noise.
 */
function skier(): string {
  return `
    <g transform="translate(248 132) rotate(-14)">
      <path d="M-14 6 L16 6" stroke="var(--cyan)" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M-13 10 L15 10" stroke="var(--cyan)" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M0 6 L2 -6 L-4 -12" stroke="var(--magenta)" stroke-width="3.4" stroke-linecap="round" fill="none"/>
      <circle cx="-5" cy="-15" r="3.4" fill="var(--magenta)"/>
      <path d="M2 -6 L11 -13" stroke="var(--magenta)" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M-4 -12 L-14 -17" stroke="var(--yellow)" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M11 -13 L20 -19" stroke="var(--yellow)" stroke-width="1.4" stroke-linecap="round"/>
    </g>`;
}

/** The near slope the skier has just left, sweeping out of frame. */
function slope(): string {
  return `<path d="M0 180 L0 166 C 60 162, 130 172, 190 156 C 242 141, 288 150, 320 142 L320 180 Z"
                fill="var(--snow)" opacity="0.92"/>`;
}

/**
 * The same hash draw.ts uses, so a flake's column is a property of its slot
 * rather than of when the page happened to load. Presentation only; the
 * determinism rules in src/sim do not reach here.
 */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Blowing snow, in three depths — the same model as `drawSnowfall` in
 * `src/render/draw.ts`.
 *
 * Nothing is simulated there and nothing is simulated here. Each flake is a
 * fixed column falling on a loop of its own length, with a lateral sway out of
 * phase per flake that sells it as wind. The game does that with a tick
 * counter; this does it with two CSS animations and a negative delay, which
 * costs no JavaScript at all once the markup exists.
 *
 * Depths, speeds and alphas are scaled from the game's own layer table so the
 * two read as the same weather.
 *
 * Under reduced motion the field is DROPPED rather than slowed. That is the
 * game's rule (T-5) and it is deliberate: a slow blizzard is still a blizzard.
 */
function snowfall(): string {
  const layers = [
    { count: 16, size: 0.6, alpha: 0.38, fall: 16, sway: 5.5, drift: 2.5 },
    { count: 13, size: 0.9, alpha: 0.6, fall: 11, sway: 4.5, drift: 4 },
    { count: 10, size: 1.3, alpha: 0.85, fall: 7, sway: 3.5, drift: 6 },
  ];

  const flakes = layers
    .map((layer, l) =>
      Array.from({ length: layer.count }, (_, i) => {
        const seed = l * 977 + i;
        const x = (hash(seed) * 340 - 10).toFixed(1);
        // A negative delay starts the flake mid-fall, so the field is already
        // full on the first frame rather than sweeping in from the top.
        const fallDelay = (-hash(seed + 13) * layer.fall).toFixed(2);
        const swayDelay = (-hash(seed + 51) * layer.sway).toFixed(2);
        return `<g class="flake" style="
            --fall:${layer.fall}s; --fall-delay:${fallDelay}s;
            --sway:${layer.sway}s; --sway-delay:${swayDelay}s;
            --drift:${layer.drift}px;">
            <circle cx="${x}" cy="0" r="${layer.size}"
                    fill="var(--snow)" opacity="${layer.alpha}"/>
          </g>`;
      }).join(''),
    )
    .join('');

  return `<g class="snowfall">${flakes}</g>`;
}

/**
 * The whole scene, at the same 320x180 the game renders at. It scales with the
 * viewport and carries no text, so it needs no translation and can be hidden from
 * assistive technology outright.
 */
export function titleScene(): string {
  return `
    <svg class="title-scene" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"
         aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="320" height="180" fill="var(--ink)"/>
      ${sun()}
      ${mountains()}
      ${grid()}
      ${slope()}
      ${skier()}
      ${snowfall()}
    </svg>`;
}
