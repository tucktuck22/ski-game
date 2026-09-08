import { describe, it, expect } from 'vitest';
import { explainRejection } from '../../src/ui/commitFailure.js';

describe('a refused official commit is explained, not just quoted', () => {
  /**
   * The message that actually shipped. It names the cause precisely and tells
   * the person reading it nothing they can do, which is how "the draft is
   * pinned to an old rules version" reached us as "the commit is not working".
   */
  it('names the fix for a rules version mismatch, and who runs it', () => {
    const f = explainRejection('rules version mismatch: draft is 1.0.0, submission is 1.6.0');
    expect(f.headline).toContain('NOT YOUR FAULT');
    expect(f.detail).toContain('organizer');
    expect(f.detail).toContain('0004_rules_freeze.sql');
  });

  it('keeps the raw message verbatim, for whoever has to fix it', () => {
    const raw = 'rules version mismatch: draft is 1.0.0, submission is 1.6.0';
    expect(explainRejection(raw).raw).toBe(raw);
  });

  it('tells a second commit apart from a broken draft (FR-018)', () => {
    expect(explainRejection('duplicate key value violates unique constraint').headline).toContain(
      'ALREADY POSTED',
    );
  });

  it('tells a passed deadline apart from a broken draft (FR-043)', () => {
    expect(explainRejection('draft deadline has passed').headline).toContain('DEADLINE');
  });

  it('points a permission failure at setup.sql rather than at the player', () => {
    expect(explainRejection('permission denied for table committed_score').detail).toContain(
      'setup.sql',
    );
  });

  it('still says retrying will not help for anything it does not recognise', () => {
    const f = explainRejection('something nobody has seen before');
    expect(f.detail).toContain('Retrying will not help');
    expect(f.raw).toBe('something nobody has seen before');
  });
});
