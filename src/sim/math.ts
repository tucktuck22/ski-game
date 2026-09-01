/**
 * Deterministic arithmetic helpers for the simulation.
 *
 * Everything here uses only +, -, *, / and integer-exact operations, which
 * ECMAScript specifies exactly and every conforming engine rounds identically.
 * See research.md R2.
 */

const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);

/**
 * Deterministic square root.
 *
 * Math.sqrt is correctly rounded on every mainstream engine, but ECMAScript
 * lists it among the implementation-approximated functions, so relying on it
 * would make our determinism claim rest on convention rather than on the spec.
 *
 * Instead: halve the exponent via exact bit manipulation for an initial guess,
 * then run a FIXED number of Newton-Raphson iterations. Fixed count matters —
 * a convergence-based loop could iterate a different number of times if any
 * intermediate differed, which is the thing we are trying to rule out.
 */
export function sqrtDet(x: number): number {
  if (!(x > 0)) return 0;
  if (x === Infinity) return Infinity;

  F64[0] = x;
  const hi = U32[1] as number;
  const lo = U32[0] as number;
  // Halve the biased exponent: (e - 1023)/2 + 1023 === (e + 1023) >>> 1.
  const exp = (hi >>> 20) & 0x7ff;
  U32[1] = (((exp + 1023) >>> 1) << 20) | ((hi & 0x000fffff) >>> 1);
  U32[0] = lo >>> 1;
  let g = F64[0] as number;

  // 6 iterations take a half-exponent guess to full float64 precision for any
  // finite positive input; 8 is belt and braces and still costs nothing.
  for (let i = 0; i < 8; i++) g = 0.5 * (g + x / g);

  // Newton lands within 1 ULP but can settle on either side of the correctly
  // rounded result. Step to both float neighbours and keep whichever squares
  // closest to x. Bit stepping and comparison are exact, so this is still
  // deterministic - it just also happens to agree with a correct sqrt.
  return nearestRoot(g, x);
}

/**
 * Picks whichever of g and its two float64 neighbours squares closest to x.
 *
 * The comparison has to be done on the EXACT square, not on `c * c` — that
 * product is itself rounded, and the rounding swamps the 1-ULP difference we
 * are trying to resolve. A naive `c * c` comparison here disagreed with a
 * correct sqrt on ~17% of random inputs. Dekker's two-product recovers the
 * exact result as an unevaluated (hi, lo) pair using only + - *, all exactly
 * specified, so the whole routine stays deterministic.
 */
function nearestRoot(g: number, x: number): number {
  let best = g;
  let bestErr = squareError(g, x);
  for (const candidate of [neighbour(g, -1), neighbour(g, 1)]) {
    if (!(candidate > 0) || candidate === Infinity) continue;
    const err = squareError(candidate, x);
    if (err < bestErr) {
      best = candidate;
      bestErr = err;
    }
  }
  return best;
}

const SPLIT = 134217729; // 2^27 + 1, Veltkamp's splitting constant for float64

/** |a*a - x|, computed exactly via Dekker two-product rather than on the rounded product. */
function squareError(a: number, x: number): number {
  const hi = a * a;
  const c = SPLIT * a;
  const ah = c - (c - a);
  const al = a - ah;
  const lo = ah * ah - hi + 2 * ah * al + al * al; // exact residual of a*a
  const err = hi - x + lo;
  return err < 0 ? -err : err;
}

/** Steps a positive finite double by `dir` units in the last place. */
function neighbour(v: number, dir: 1 | -1): number {
  F64[0] = v;
  let lo = U32[0] as number;
  let hi = U32[1] as number;
  if (dir === 1) {
    lo = (lo + 1) >>> 0;
    if (lo === 0) hi = (hi + 1) >>> 0;
  } else {
    if (lo === 0) hi = (hi - 1) >>> 0;
    lo = (lo - 1) >>> 0;
  }
  U32[0] = lo;
  U32[1] = hi;
  return F64[0] as number;
}

/** Squared magnitude. Prefer this to a length comparison — it avoids sqrt entirely. */
export const mag2 = (x: number, y: number): number => x * x + y * y;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Move `from` toward `to` by at most `step`. */
export function approach(from: number, to: number, step: number): number {
  if (from < to) {
    const next = from + step;
    return next > to ? to : next;
  }
  const next = from - step;
  return next < to ? to : next;
}

/** Wrap an angle into [0, TAU). Uses only division and subtraction. */
export function wrapAngle(a: number, tau: number): number {
  const turns = Math.floor(a / tau);
  return a - turns * tau;
}

/** Smallest signed difference between two angles, in (-tau/2, tau/2]. */
export function angleDelta(a: number, b: number, tau: number): number {
  let d = wrapAngle(a - b, tau);
  if (d > tau / 2) d -= tau;
  return d;
}
