import { describe, it, expect } from 'vitest';
import { renderLeaderboard, escapeHtml } from '../../src/ui/leaderboard.js';
import type { EntryView } from '../../src/state/ordering.js';

const e = (o: Partial<EntryView> & { name: string }): EntryView => ({
  id: o.name,
  origin: 'organizer',
  claimed: true,
  practiceRunsUsed: 3,
  abandonedOfficialRuns: 0,
  removed: false,
  score: null,
  commitAt: null,
  outcome: null,
  ...o,
});

describe('leaderboard view (SC-010)', () => {
  const entries = [
    e({ name: 'Sam', score: 62000, commitAt: '2026-09-01T09:00:00Z', outcome: 'finished' }),
    e({
      name: 'Dave',
      score: 1400,
      commitAt: '2026-09-01T10:00:00Z',
      outcome: 'wiped_out',
      abandonedOfficialRuns: 3,
    }),
    e({ name: 'Zach', origin: 'self_created', claimed: false, practiceRunsUsed: 0 }),
    e({ name: 'Al', practiceRunsUsed: 1 }),
  ];

  it('says plainly that rank 1 picks first (FR-041)', () => {
    expect(renderLeaderboard(entries, true)).toContain('Rank 1 picks a bed first');
    expect(renderLeaderboard(entries, true)).toContain('PICKS FIRST');
  });

  it('marks the board FINAL after the deadline (FR-043)', () => {
    expect(renderLeaderboard(entries, true)).toContain('FINAL — BED ORDER');
    expect(renderLeaderboard(entries, false)).toContain('STANDINGS');
  });

  it('shows forfeits under a coin-flip instruction and gives them no pick number (FR-045)', () => {
    const html = renderLeaderboard(entries, true);
    expect(html).toContain('coin flip at the cabin');
    expect(html).toContain('FORFEIT');
    // Zach must not be assigned a numbered pick.
    expect(html).not.toMatch(/PICK 3[\s\S]*Zach/);
  });

  it('publishes the abandonment count (FR-065, SC-013)', () => {
    expect(renderLeaderboard(entries, false)).toContain('3 bailed');
  });

  it('marks self-created entries (FR-073)', () => {
    expect(renderLeaderboard(entries, false)).toContain('self-created');
  });

  it('does not convey status by colour alone (FR-055)', () => {
    const html = renderLeaderboard(entries, true);
    // Every state has a word, not just a class.
    for (const word of ['FINISHED', 'WIPED OUT', 'FORFEIT', 'UNCLAIMED', 'PRACTISING']) {
      expect(html).toContain(word);
    }
  });

  it('escapes names, so a roster entry cannot inject markup', () => {
    const html = renderLeaderboard([e({ name: '<img src=x onerror=alert(1)>' })], false);
    expect(html).not.toContain('<img');
    expect(escapeHtml('<b>&"')).toBe('&lt;b&gt;&amp;&quot;');
  });
});
