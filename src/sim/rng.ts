/**
 * Seeded PRNG. All randomness affecting a run derives from the shared course
 * seed (FR-024), so every player faces the identical mountain.
 *
 * xorshift128 over uint32 lanes: pure integer bit operations, exactly specified
 * by ECMAScript, identical on every engine. Math.imul is permitted in simulation
 * code because it is defined as the exact 32-bit integer product — unlike the
 * transcendental functions, it is not implementation-approximated.
 */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

export function makeRng(seed: number): RngState {
  // SplitMix-style seeding so that adjacent seeds do not produce correlated streams.
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
  };
  const state = { a: next(), b: next(), c: next(), d: next() };
  // A zero state is absorbing for xorshift; nudge it.
  if ((state.a | state.b | state.c | state.d) === 0) state.a = 1;
  return state;
}

/** Advances the state and returns a uint32. */
export function nextU32(r: RngState): number {
  const t = (r.a ^ (r.a << 11)) >>> 0;
  r.a = r.b;
  r.b = r.c;
  r.c = r.d;
  r.d = ((r.d ^ (r.d >>> 19)) ^ (t ^ (t >>> 8))) >>> 0;
  return r.d;
}

/** Uniform in [0, 1). Division by a power of two is exact. */
export const nextFloat = (r: RngState): number => nextU32(r) / 4294967296;

/** Uniform integer in [0, n). */
export const nextInt = (r: RngState, n: number): number => nextU32(r) % n;

export const cloneRng = (r: RngState): RngState => ({ a: r.a, b: r.b, c: r.c, d: r.d });
