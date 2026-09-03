import { describe, it, expect } from 'vitest';
import {
  resolveConfig,
  isNetworkFailure,
  describeUnreachable,
  classifyKey,
} from '../../src/state/config.js';

// Real-shaped legacy keys: header.payload.signature, payload carrying the role claim.
const ANON_JWT =
  'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJpc3MiOiAic3VwYWJhc2UiLCAicmVmIjogImFiY2RlZmdoaWprbCIsICJyb2xlIjogImFub24iLCAiaWF0IjogMSwgImV4cCI6IDJ9.signature';
const SERVICE_ROLE_JWT =
  'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJpc3MiOiAic3VwYWJhc2UiLCAicmVmIjogImFiY2RlZmdoaWprbCIsICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpYXQiOiAxLCAiZXhwIjogMn0.signature';

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

  it('refuses a secret key before it can reach the browser', () => {
    // Supabase itself answers "Forbidden use of secret API key in browser", but
    // only after the key has shipped inside a public bundle. Catch it here.
    const r = resolveConfig('https://abcdefghijkl.supabase.co', 'sb_secret_AbCdEf123456');
    expect(r.kind).toBe('invalid');
    if (r.kind === 'invalid') {
      expect(r.problem).toContain('SECRET');
      expect(r.fix).toContain('Delete that key');
    }
  });

  it('refuses a legacy service_role JWT, which is the same mistake in the old key format', () => {
    const r = resolveConfig('https://abcdefghijkl.supabase.co', SERVICE_ROLE_JWT);
    expect(r.kind).toBe('invalid');
  });

  it('accepts both publishable key formats', () => {
    expect(
      resolveConfig('https://abcdefghijkl.supabase.co', 'sb_publishable_AbC123'),
    ).toMatchObject({ kind: 'configured' });
    expect(resolveConfig('https://abcdefghijkl.supabase.co', ANON_JWT)).toMatchObject({
      kind: 'configured',
    });
  });

  it('classifies keys it does not recognise as unknown rather than guessing', () => {
    expect(classifyKey('some-opaque-key')).toBe('unknown');
    expect(classifyKey('a.b.c')).toBe('unknown'); // not decodable base64 JSON
    expect(classifyKey('')).toBe('unknown');
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
