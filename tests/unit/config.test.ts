import { describe, it, expect } from 'vitest';
import { resolveConfig, isNetworkFailure, describeUnreachable } from '../../src/state/config.js';

describe('Supabase configuration is validated before use', () => {
  it('runs local when nothing is configured', () => {
    expect(resolveConfig('', '')).toMatchObject({ kind: 'local' });
    expect(resolveConfig(undefined, undefined)).toMatchObject({ kind: 'local' });
  });

  it('catches the placeholder from .env.example, which produces "Failed to fetch"', () => {
    // This is not hypothetical: the example file ships this exact value, and
    // pasting it into a repository secret gives an opaque network error that
    // says nothing about the cause.
    const r = resolveConfig('https://your-project.supabase.co', 'real-looking-key');
    expect(r.kind).toBe('invalid');
    if (r.kind === 'invalid') {
      expect(r.problem).toContain('placeholder');
      expect(r.fix).toContain('Project Settings');
    }
  });

  it('catches a half-configured pair rather than failing later', () => {
    expect(resolveConfig('https://abc.supabase.co', '')).toMatchObject({ kind: 'invalid' });
    expect(resolveConfig('', 'key')).toMatchObject({ kind: 'invalid' });
  });

  it('rejects a malformed or non-https URL', () => {
    expect(resolveConfig('not a url', 'k')).toMatchObject({ kind: 'invalid' });
    expect(resolveConfig('http://abc.supabase.co', 'k')).toMatchObject({ kind: 'invalid' });
  });

  it('accepts a real-looking configuration and trims stray whitespace', () => {
    const r = resolveConfig('  https://abcdefghijkl.supabase.co  ', ' key123 ');
    expect(r).toMatchObject({
      kind: 'configured',
      url: 'https://abcdefghijkl.supabase.co',
      anonKey: 'key123',
    });
  });

  it('recognises the browser opaque network failure', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkFailure(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
      true,
    );
    expect(isNetworkFailure(new TypeError('Load failed'))).toBe(true); // Safari
    expect(isNetworkFailure(new Error('Failed to fetch'))).toBe(false);
    expect(isNetworkFailure({ message: 'Failed to fetch' })).toBe(false);
  });

  it('explains an unreachable host without blaming the database', () => {
    const text = describeUnreachable('https://abc.supabase.co');
    expect(text).toContain('not a database error');
    expect(text).toContain('paused');
    expect(text).toContain('remove the VITE_SUPABASE_URL');
  });
});
