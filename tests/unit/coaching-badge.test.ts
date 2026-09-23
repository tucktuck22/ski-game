/**
 * The coaching badge's lifetime and its slot (FR-191, FR-194, research R6).
 *
 * WHY A HAND-BUILT DOM RATHER THAN jsdom. This repository has no DOM test
 * environment and no test that touches `document` — vitest runs with
 * `environment: 'node'` — and the plan for this feature states plainly that it
 * adds no dependencies. So the seam is stubbed the same way
 * `tests/unit/rope-geometry.test.ts` stubs a canvas: a recorder that implements
 * exactly the handful of operations the module uses and nothing else, so an
 * operation added later is absent rather than silently absorbed.
 *
 * What this file proves is the LOGIC: one badge at a time, cleared only by
 * position, reduced motion honoured, copy passed through untouched. What it
 * cannot prove is that the thing renders — that a real browser draws the arrow
 * glyphs as glyphs rather than tofu is FR-190b, it needs real fonts, and it is
 * asserted against the built artifact in `tests/e2e-build/coached-run.spec.ts`.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mountCoachingBadge } from '../../src/ui/coachingBadge.js';
import { CUES } from '../../src/render/coachingCue.js';
import { FULL_MOTION, REDUCED_MOTION } from '../../src/render/reducedMotion.js';

/** The smallest element that `coachingBadge.ts` can tell apart from a real one. */
class FakeEl {
  className = '';
  textContent = '';
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  constructor(readonly tag: string) {}
  append(...kids: FakeEl[]): void {
    for (const k of kids) {
      k.parent = this;
      this.children.push(k);
    }
  }
  prepend(...kids: FakeEl[]): void {
    for (const k of kids.reverse()) {
      k.parent = this;
      this.children.unshift(k);
    }
  }
  replaceChildren(...kids: FakeEl[]): void {
    for (const c of this.children) c.parent = null;
    this.children = [];
    this.append(...kids);
  }
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  /** Every element at or under this one, for counting badges. */
  all(): FakeEl[] {
    return this.children.flatMap((c) => [c, ...c.all()]);
  }
}

function withFakeDom<T>(run: (host: FakeEl) => T): T {
  const prior = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: (tag: string) => new FakeEl(tag),
  };
  try {
    return run(new FakeEl('div'));
  } finally {
    (globalThis as { document?: unknown }).document = prior;
  }
}

const badges = (host: FakeEl): FakeEl[] =>
  host.all().filter((e) => e.className.includes('coach-badge'));

describe('FR-191: at most one coaching badge exists at any moment', () => {
  it('shows one badge, and replaces rather than accumulates', () => {
    withFakeDom((host) => {
      const badge = mountCoachingBadge(host as unknown as HTMLElement, FULL_MOTION);
      expect(badges(host)).toHaveLength(0);

      for (const cue of CUES) {
        badge.set(cue);
        expect(badges(host), `showing ${cue.id} did not replace its predecessor`).toHaveLength(1);
        expect(badges(host)[0]?.all()[0]?.textContent).toBe(cue.text);
      }
    });
  });

  it('clears on set(null), and clearing twice is not an error', () => {
    withFakeDom((host) => {
      const badge = mountCoachingBadge(host as unknown as HTMLElement, FULL_MOTION);
      badge.set(CUES[0] as (typeof CUES)[number]);
      expect(badges(host)).toHaveLength(1);
      badge.set(null);
      expect(badges(host)).toHaveLength(0);
      badge.set(null);
      expect(badges(host)).toHaveLength(0);
    });
  });

  it('setting the same cue again does not rebuild the element', () => {
    withFakeDom((host) => {
      const badge = mountCoachingBadge(host as unknown as HTMLElement, FULL_MOTION);
      const cue = CUES[0] as (typeof CUES)[number];
      badge.set(cue);
      const first = badges(host)[0];
      badge.set(cue);
      expect(badges(host)[0], 'the badge was rebuilt on a no-op tick').toBe(first);
    });
  });
});

describe('R6: the badge is never removed by a timer', () => {
  it('survives any amount of wall-clock time while its cue still applies', () => {
    vi.useFakeTimers();
    try {
      withFakeDom((host) => {
        const badge = mountCoachingBadge(host as unknown as HTMLElement, FULL_MOTION);
        badge.set(CUES[0] as (typeof CUES)[number]);
        // A trick badge would be gone after 1100ms. This one describes an object
        // that is still ahead of the player, on the simulation tick — clearing
        // it on a slow frame is the one failure he cannot recover from, because
        // the cue never comes again.
        vi.advanceTimersByTime(60_000);
        expect(badges(host), 'a timer cleared a coaching badge').toHaveLength(1);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('the module contains no timer at all', () => {
    // Belt and braces on the clause above: the guarantee is structural, so the
    // absence is asserted rather than the behaviour alone.
    const text = readFileSync(new URL('../../src/ui/coachingBadge.ts', import.meta.url), 'utf8');
    for (const tell of ['setTimeout', 'setInterval', 'requestAnimationFrame', 'Date.now']) {
      expect(text, `coachingBadge.ts uses ${tell}; R6 forbids a wall clock here`).not.toContain(
        tell,
      );
    }
  });
});

describe('FR-194: reduced motion drops the movement, never the message', () => {
  it('keeps the badge and its text, and takes the still class', () => {
    withFakeDom((host) => {
      const badge = mountCoachingBadge(host as unknown as HTMLElement, REDUCED_MOTION);
      const cue = CUES[3] as (typeof CUES)[number];
      badge.set(cue);
      const el = badges(host)[0] as FakeEl;
      expect(el.className).toContain('badge-still');
      expect(el.all()[0]?.textContent, 'reduced motion dropped the message').toBe(cue.text);
    });
  });

  it('full motion does not take the still class', () => {
    withFakeDom((host) => {
      const badge = mountCoachingBadge(host as unknown as HTMLElement, FULL_MOTION);
      badge.set(CUES[0] as (typeof CUES)[number]);
      expect((badges(host)[0] as FakeEl).className).not.toContain('badge-still');
    });
  });
});

describe('the coaching slot and the trick badges do not displace each other', () => {
  it('the coaching slot is the first child, so applause stacks under instruction', () => {
    withFakeDom((host) => {
      const trick = new FakeEl('div');
      trick.className = 'badge';
      host.append(trick);
      mountCoachingBadge(host as unknown as HTMLElement, FULL_MOTION);
      expect(host.children[0]?.className).toBe('coach-slot');
      expect(host.children[1]).toBe(trick);
    });
  });

  it('destroy() removes the slot and leaves any trick badge alone', () => {
    withFakeDom((host) => {
      const badge = mountCoachingBadge(host as unknown as HTMLElement, FULL_MOTION);
      const trick = new FakeEl('div');
      trick.className = 'badge';
      host.append(trick);
      badge.set(CUES[0] as (typeof CUES)[number]);
      badge.destroy();
      expect(badges(host)).toHaveLength(0);
      expect(host.children).toContain(trick);
    });
  });
});
