import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Regression test for a blank-page bug.
 *
 * main.ts read sessionStorage unguarded at module top level. Accessing web
 * storage THROWS (not returns null) when site data is blocked — a sandboxed
 * frame, strict privacy settings, some private modes — so the whole module
 * failed to initialise and the page rendered blank with nothing on screen to
 * explain it.
 */
describe('safeStorage survives a browser that denies storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('reports unavailable and returns null instead of throwing when access is denied', async () => {
    vi.stubGlobal('sessionStorage', {
      get getItem() {
        throw new DOMException('Access is denied for this document', 'SecurityError');
      },
    });
    vi.stubGlobal('localStorage', undefined);
    const { safeSession } = await import('../../src/state/safeStorage.js');

    expect(safeSession.available).toBe(false);
    expect(() => safeSession.get('anything')).not.toThrow();
    expect(safeSession.get('anything')).toBeNull();
    expect(() => safeSession.set('k', 'v')).not.toThrow();
    expect(() => safeSession.remove('k')).not.toThrow();
  });

  it('detects storage that exists but throws only on write, as Safari does', async () => {
    // Presence is not enough: the object can be there and still refuse writes,
    // which is why the wrapper probes with a real setItem.
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
      removeItem: () => undefined,
    });
    const { safeSession } = await import('../../src/state/safeStorage.js');
    expect(safeSession.available).toBe(false);
    expect(safeSession.get('k')).toBeNull();
  });

  it('reads and writes normally when storage works', async () => {
    const backing = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    });
    const { safeSession } = await import('../../src/state/safeStorage.js');

    expect(safeSession.available).toBe(true);
    safeSession.set('claim:draft-1', 'entry-9');
    expect(safeSession.get('claim:draft-1')).toBe('entry-9');
    safeSession.remove('claim:draft-1');
    expect(safeSession.get('claim:draft-1')).toBeNull();
  });
});

describe('describeError renders what actually gets thrown', () => {
  it('reads a PostgrestError-shaped plain object instead of showing [object Object]', async () => {
    // The first real failure the boundary caught displayed "[object Object]",
    // which told nobody anything. Supabase rejects with a plain object.
    const { describeError } = await import('../../src/ui/errorBoundary.js');
    const r = describeError({
      message: 'relation "public.draft" does not exist',
      code: '42P01',
      details: null,
      hint: null,
    });
    expect(r.message).toBe('relation "public.draft" does not exist');
    expect(r.detail).toContain('code: 42P01');
    expect(r.message).not.toContain('[object Object]');
  });

  it('handles Errors, strings, and shapes with no recognised keys', async () => {
    const { describeError } = await import('../../src/ui/errorBoundary.js');
    expect(describeError(new Error('boom')).message).toBe('boom');
    expect(describeError('plain string').message).toBe('plain string');
    expect(describeError({ weird: 1 }).message).toBe('{"weird":1}');
    expect(describeError(undefined).message).toBe('undefined');
  });
});
