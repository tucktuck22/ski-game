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

/** Mountains: a far purple range behind, a near snow ridge in front. */
function mountains(): string {
  return `
    <path d="M0 104 L26 78 L44 90 L70 62 L98 92 L124 74 L152 100 L184 68 L208 88 L238 64 L266 92 L288 80 L320 102 L320 106 L0 106 Z"
          fill="var(--purple)"/>
    <path d="M70 62 L79 75 L61 75 Z M184 68 L193 80 L175 80 Z M238 64 L248 78 L228 78 Z"
          fill="var(--snow)" opacity="0.85"/>`;
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

/** Snow, as still points. Nothing here animates — FR-057 and the flash ceiling. */
function snowfall(): string {
  const flakes = [
    [22, 14],
    [58, 30],
    [96, 9],
    [128, 24],
    [196, 16],
    [238, 28],
    [278, 11],
    [302, 34],
    [44, 46],
    [262, 52],
    [148, 40],
    [186, 58],
  ];
  return `<g fill="var(--snow)" opacity="0.7">${flakes
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1"/>`)
    .join('')}</g>`;
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
      ${snowfall()}
      ${sun()}
      ${mountains()}
      ${grid()}
      ${slope()}
      ${skier()}
    </svg>`;
}
