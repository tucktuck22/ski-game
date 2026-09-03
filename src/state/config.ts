/**
 * Validates the Supabase configuration before the app tries to use it.
 *
 * A bad URL surfaces as `TypeError: Failed to fetch` with no status code and no
 * Postgres error — the request never reaches a server, so there is nothing to
 * report. That is one of the least informative errors a browser produces, and
 * it says nothing about the actual cause, which is almost always a placeholder
 * or a typo in a repository secret.
 *
 * The placeholder case is real: .env.example ships
 * `https://your-project.supabase.co`, and pasting that verbatim into the secret
 * produces exactly this failure.
 */

export type ConfigResult =
  | { kind: 'local'; reason: string }
  | { kind: 'configured'; url: string; anonKey: string }
  | { kind: 'invalid'; problem: string; fix: string };

const PLACEHOLDERS = ['your-project', 'your-anon-key', 'YOUR_', 'example.supabase.co', 'changeme'];

export function resolveConfig(rawUrl: unknown, rawKey: unknown): ConfigResult {
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';

  if (url === '' && key === '') {
    return { kind: 'local', reason: 'No shared storage is configured.' };
  }
  if (url === '' || key === '') {
    return {
      kind: 'invalid',
      problem: url === '' ? 'VITE_SUPABASE_URL is empty.' : 'VITE_SUPABASE_ANON_KEY is empty.',
      fix: 'Set both repository secrets, or remove both to run in local mode.',
    };
  }

  for (const marker of PLACEHOLDERS) {
    if (url.includes(marker) || key.includes(marker)) {
      return {
        kind: 'invalid',
        problem: `The configuration still contains the placeholder "${marker}".`,
        fix:
          'Copy the real Project URL and anon key from Supabase (Project Settings → API) ' +
          'into the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY repository secrets.',
      };
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      kind: 'invalid',
      problem: `VITE_SUPABASE_URL is not a valid URL: "${url}".`,
      fix: 'It should look like https://abcdefghijkl.supabase.co — no quotes, no trailing path.',
    };
  }
  if (parsed.protocol !== 'https:') {
    return {
      kind: 'invalid',
      problem: `VITE_SUPABASE_URL must use https, got "${parsed.protocol}".`,
      fix: 'Use the Project URL exactly as Supabase shows it.',
    };
  }

  return { kind: 'configured', url, anonKey: key };
}

/** Turns an unreachable-host failure into something a person can act on. */
export function describeUnreachable(url: string): string {
  return (
    `Could not reach ${url}. The request never got a response, so this is not a ` +
    'database error — the address is wrong, or the project is paused or deleted. ' +
    'Check the Project URL in Supabase, and that the project is not paused ' +
    '(free projects pause after 7 days idle). To play without shared storage, ' +
    'remove the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY repository secrets.'
  );
}

/** True for the browser's opaque network failure, which carries no status. */
export const isNetworkFailure = (error: unknown): boolean =>
  error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message);
