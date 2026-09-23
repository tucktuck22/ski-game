import { describe, it, expect } from 'vitest';
import { renderLeaderboard, escapeHtml } from '../../src/ui/leaderboard.js';
import type { EntryView } from '../../src/state/ordering.js';

const ATTEMPTS = 3;

const e = (o: Partial<EntryView> & { name: string }): EntryView => ({
  id: o.name,
  origin: 'organizer',
  claimed: true,
  practiceRunsUsed: 3,
  officialAttemptsUsed: 0,
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
    }),
    e({ name: 'Zach', origin: 'self_created', claimed: false, practiceRunsUsed: 0 }),
    e({ name: 'Al', practiceRunsUsed: 1 }),
  ];

  it('says plainly that rank 1 picks first (FR-041)', () => {
    expect(renderLeaderboard(entries, true, ATTEMPTS)).toContain('Rank 1 picks a bed first');
    expect(renderLeaderboard(entries, true, ATTEMPTS)).toContain('PICKS FIRST');
  });

  it('marks the board FINAL after the deadline (FR-043)', () => {
    expect(renderLeaderboard(entries, true, ATTEMPTS)).toContain('FINAL — BED ORDER');
    expect(renderLeaderboard(entries, false, ATTEMPTS)).toContain('STANDINGS');
  });

  it('shows forfeits under a coin-flip instruction and gives them no pick number (FR-045)', () => {
    const html = renderLeaderboard(entries, true, ATTEMPTS);
    expect(html).toContain('coin flip at the cabin');
    expect(html).toContain('FORFEIT');
    // Zach must not be assigned a numbered pick.
    expect(html).not.toMatch(/PICK 3[\s\S]*Zach/);
  });

  /**
   * FR-065 is withdrawn. The Bails column counted official runs abandoned
   * mid-descent, and it never counted anything: nothing in the app ever wrote
   * the column it read, so it displayed a permanent zero for the whole life of
   * the project. The organizer's decision is that mid-run bailing is not a
   * problem worth policing among eight friends, so the column is gone rather
   * than finished. This asserts it stays gone.
   */
  it('does not carry a bails column (FR-065 withdrawn)', () => {
    const html = renderLeaderboard(entries, false, ATTEMPTS);
    expect(html).not.toContain('Bails');
    expect(html).not.toContain('bailed');
  });

  it('marks self-created entries (FR-073)', () => {
    expect(renderLeaderboard(entries, false, ATTEMPTS)).toContain('self-created');
  });

  it('does not convey status by colour alone (FR-055)', () => {
    const html = renderLeaderboard(entries, true, ATTEMPTS);
    // Every state has a word, not just a class.
    for (const word of ['FINISHED', 'WIPED OUT', 'FORFEIT', 'UNCLAIMED', 'PRACTISING']) {
      expect(html).toContain(word);
    }
  });

  it('escapes names, so a roster entry cannot inject markup', () => {
    const html = renderLeaderboard([e({ name: '<img src=x onerror=alert(1)>' })], false, ATTEMPTS);
    expect(html).not.toContain('<img');
    expect(escapeHtml('<b>&"')).toBe('&lt;b&gt;&amp;&quot;');
  });
});

/**
 * FR-239. The score column shows a player's BEST attempt, which before the
 * deadline may not be his last word — so the board has to make "still going"
 * and "done" impossible to confuse. A best-so-far presented as a result is the
 * specific way this board could lie by omission.
 */
describe('the board distinguishes mid-competition from finished (FR-239, SC-085)', () => {
  const midway = e({
    name: 'Dave',
    score: 4000,
    commitAt: '2026-09-01T10:00:00Z',
    outcome: 'finished',
    officialAttemptsUsed: 1,
  });
  const done = e({
    name: 'Sam',
    score: 6100,
    commitAt: '2026-09-01T11:00:00Z',
    outcome: 'finished',
    officialAttemptsUsed: 3,
  });

  it('marks a player with attempts left as not final', () => {
    const html = renderLeaderboard([midway, done], false, ATTEMPTS);
    expect(html).toContain('BEST OF 1 of 3 SO FAR');
    expect(html).toContain('FINISHED — 3 of 3');
  });

  it('reports attempts used at every count (SC-085)', () => {
    for (let used = 1; used <= ATTEMPTS; used++) {
      const html = renderLeaderboard(
        [
          e({
            name: 'Dave',
            score: 4000,
            commitAt: 'z',
            outcome: 'finished',
            officialAttemptsUsed: used,
          }),
        ],
        false,
        ATTEMPTS,
      );
      expect(html).toContain(`${used} of 3`);
    }
  });

  it('drops the "so far" qualifier once the draft is FINAL (FR-241)', () => {
    // After the deadline an unused attempt is moot, so nobody is still going.
    const html = renderLeaderboard([midway], true, ATTEMPTS);
    expect(html).toContain('FINISHED — 1 of 3');
    expect(html).not.toContain('SO FAR');
  });

  it('shows a spent attempt that scored nothing, rather than hiding it (FR-233)', () => {
    // Abandoned his first attempt: in the competition, down one, no score.
    const html = renderLeaderboard([e({ name: 'Al', officialAttemptsUsed: 1 })], false, ATTEMPTS);
    expect(html).toContain('IN PROGRESS — 1 of 3 USED');
  });

  it('does not distinguish an all-abandoned forfeit from never playing (FR-242)', () => {
    const abandonedAll = renderLeaderboard(
      [e({ name: 'Al', officialAttemptsUsed: 3 })],
      true,
      ATTEMPTS,
    );
    const neverPlayed = renderLeaderboard([e({ name: 'Al' })], true, ATTEMPTS);
    // Both sit in the unordered forfeit group with no rank and no score.
    for (const html of [abandonedAll, neverPlayed]) {
      expect(html).toContain('FORFEIT');
      expect(html).not.toContain('PICK 1');
    }
  });

  it('carries attempt state as text, not by colour alone (FR-055)', () => {
    const html = renderLeaderboard([midway], false, ATTEMPTS);
    // Strip every style/class attribute; the state must survive it.
    const textOnly = html.replace(/(class|style)="[^"]*"/g, '');
    expect(textOnly).toContain('1 of 3');
  });
});
