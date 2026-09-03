import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The bare site URL — no `?draft=` — is what people bookmark, and what survives
 * a link being pasted into a group chat. Before this, it resolved to the
 * fallback id "local-draft" and died with "No draft found", which reads as the
 * player's fault and is not.
 */
const state = vi.hoisted(() => ({
  result: { data: [] as { id: string; deadline: string }[], error: null as unknown },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve(state.result),
        }),
      }),
    }),
  }),
}));

const { discoverDraft } = await import('../../src/state/supabase.js');

const URL_ = 'https://abcdefghijkl.supabase.co';
const KEY = 'sb_publishable_test';

describe('a link with no ?draft= finds the draft instead of failing', () => {
  beforeEach(() => {
    state.result = { data: [], error: null };
  });

  it('uses the only draft, which is the whole point', async () => {
    state.result = { data: [{ id: 'uuid-1', deadline: '2026-03-14T23:59:00Z' }], error: null };
    await expect(discoverDraft(URL_, KEY)).resolves.toEqual({ kind: 'found', id: 'uuid-1' });
  });

  it('reports an empty database as empty, not as a missing draft id', async () => {
    await expect(discoverDraft(URL_, KEY)).resolves.toEqual({ kind: 'none' });
  });

  it('refuses to guess when several drafts exist, and lists them', async () => {
    state.result = {
      data: [
        { id: 'uuid-1', deadline: '2026-03-14T23:59:00Z' },
        { id: 'uuid-2', deadline: '2027-01-02T00:00:00Z' },
      ],
      error: null,
    };
    const found = await discoverDraft(URL_, KEY);
    expect(found.kind).toBe('many');
    if (found.kind === 'many') expect(found.drafts).toHaveLength(2);
  });

  it('surfaces a database error rather than reporting an empty database', async () => {
    // A permission failure returns no rows too. Reporting "no draft exists"
    // would send the organizer to re-run seed-draft.sql for nothing.
    state.result = { data: null as never, error: { code: '42501', message: 'permission denied' } };
    await expect(discoverDraft(URL_, KEY)).rejects.toMatchObject({ code: '42501' });
  });
});
