import { describe, it, expect } from 'vitest';
import { finalScore } from '../../src/sim/scoring.js';
import { ride } from './pilots.js';
import { official, warmup, scoring } from './fixtures.js';

/**
 * The upper track has to be a CHOICE, and this is where that is proved.
 *
 * CV-13 checks the arithmetic of it against the data — a ramp's apex at base
 * speed against the shelf height — but arithmetic on the tuning file is not the
 * same claim as "two pilots actually ride two different lines and both get
 * down". Only the simulation can say that, so it is asserted here against the
 * shipped courses rather than against a fixture.
 *
 * If a future tuning change makes ramps stronger, the cautious pilot starts
 * being thrown onto a shelf he never asked for and the second test fails. If it
 * makes them weaker, the upper track quietly becomes scenery and the first one
 * does. Both directions are caught.
 */
describe('the upper track is a choice, not a toll gate', () => {
  it('a pilot who never tucks rides the whole official course on the piste', () => {
    // The cautious pilot of SC-015 and FR-035. He must finish, and he must
    // never find himself on a shelf he did not earn.
    const r = ride(official, 'stay-low', 19860214);
    expect(r.state.wipeoutReason).toBe(null);
    expect(r.state.outcome).toBe('finished');
    expect(r.ticksOnShelf).toBe(0);
  });

  it('a pilot who carries speed into the ramps rides every shelf and finishes', () => {
    const r = ride(official, 'tuck', 19860214);
    expect(r.state.wipeoutReason).toBe(null);
    expect(r.state.outcome).toBe('finished');
    expect(r.shelvesRidden).toBe(official.ledges.length);
  });

  it('the upper line pays materially better than the lower one', () => {
    // Without this the fork is a graphic, not a decision. The gap is what the
    // player is actually choosing between when he decides whether to tuck.
    const low = ride(official, 'stay-low', 19860214);
    const high = ride(official, 'tuck', 19860214);
    expect(high.largePickups).toBeGreaterThan(low.largePickups);
    expect(finalScore(high.state, scoring)).toBeGreaterThan(finalScore(low.state, scoring));
  });

  it('both lines get down the warm-up course too', () => {
    for (const pilot of ['stay-low', 'tuck'] as const) {
      const r = ride(warmup, pilot, 20250901);
      expect(r.state.outcome).toBe('finished');
    }
  });
});
