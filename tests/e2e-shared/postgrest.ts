import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * A PostgREST stand-in, good enough to drive the whole player journey.
 *
 * Faithful in the two places the app depends on the wire format: `.single()`
 * asks for `application/vnd.pgrst.object+json` and gets a bare object rather
 * than an array, and an error comes back as `{ code, message }` with the
 * Postgres SQLSTATE, which is what `classifyError()` sorts into "retry" versus
 * "permanently rejected".
 */

export const DRAFT_ID = '11111111-1111-1111-1111-111111111111';
export const ENTRY_ID = '22222222-2222-2222-2222-222222222222';

/**
 * The rules version the SHIPPED course carries, read rather than written down.
 *
 * It was a literal '1.6.0' in two places here, and feature 006 moved the real one
 * to 2.0.0 and broke this suite on CI — the one gate a local run of `npm test`,
 * `test:build` and `test:determinism` does not cover. A frozen literal is exactly
 * the defect these specs exist to catch (see 0004_rules_freeze.sql), so it has no
 * business being one of them. Derive it, and the next bump cannot break this file.
 */
export const SHIPPED_RULES_VERSION: string = (
  JSON.parse(
    readFileSync(new URL('../../data/courses/official.json', import.meta.url), 'utf8'),
  ) as { rulesVersion: string }
).rulesVersion;

export interface PostgrestError {
  code: string;
  message: string;
}

export interface Fixture {
  /** Answer to POST /committed_score. Null means "accept it". */
  commitError: PostgrestError | null;
  /** Every roster_entry PATCH the app sent, in order. */
  patches: Record<string, unknown>[];
  /** Every committed_score row the app managed to insert. */
  posts: Record<string, unknown>[];
  entry: Record<string, unknown>;
  scores: Record<string, unknown>[];
}

export function fixture(over: Partial<Fixture> = {}): Fixture {
  return {
    commitError: null,
    patches: [],
    posts: [],
    scores: [],
    entry: {
      id: ENTRY_ID,
      draft_id: DRAFT_ID,
      name: 'Tucker',
      origin: 'organizer',
      claimed_at: null,
      practice_runs_used: 0,
      official_status: 'unused',
      official_run_started_at: null,
      removed_at: null,
      removed_score: null,
    },
    ...over,
  };
}

/**
 * The rules version the SHIPPED official course carries, read from the course
 * rather than typed here.
 *
 * It was hard-coded as '1.6.0' and went stale the moment feature 006 bumped it
 * to '2.0.0' for the physics change, which left `official-run-is-spent.spec.ts`
 * red on the branch. A test constant that has to be edited every time the
 * product legitimately changes is a test that will be wrong more often than the
 * product is, so it reads the value instead.
 */
export const SHIPPED_RULES_VERSION: string = (
  JSON.parse(
    readFileSync(new URL('../../data/courses/official.json', import.meta.url), 'utf8'),
  ) as { rulesVersion: string }
).rulesVersion;

export async function mockPostgrest(
  page: Page,
  f: Fixture,
  draftRulesVersion = SHIPPED_RULES_VERSION,
): Promise<void> {
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const table = new URL(req.url()).pathname.split('/').pop();
    const method = req.method();
    const json = (body: unknown, status = 200): Promise<void> =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (method === 'GET' && table === 'draft') {
      const row = {
        id: DRAFT_ID,
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
        course_seed: 19860214,
        rules_version: draftRulesVersion,
        finalized_at: null,
      };
      const single = (req.headers()['accept'] ?? '').includes('pgrst.object');
      return json(single ? row : [row]);
    }
    if (method === 'GET' && table === 'roster_entry') return json([f.entry]);
    if (method === 'GET' && table === 'committed_score') return json(f.scores);

    if (method === 'PATCH' && table === 'roster_entry') {
      const body = req.postDataJSON() as Record<string, unknown>;
      f.patches.push(body);
      Object.assign(f.entry, body);
      return json([{ id: ENTRY_ID }]);
    }

    if (method === 'POST' && table === 'committed_score') {
      if (f.commitError) return json(f.commitError, 400);
      const body = req.postDataJSON() as Record<string, unknown>;
      f.posts.push(body);
      f.scores.push({
        entry_id: ENTRY_ID,
        draft_id: DRAFT_ID,
        score: body['score'],
        outcome: body['outcome'],
        commit_at: new Date().toISOString(),
      });
      return json([], 201);
    }
    return json([]);
  });

  // No realtime socket to a project that does not exist. The 15s poll behind it
  // is what keeps the board fresh, and it needs nothing from here.
  await page.routeWebSocket('**/realtime/**', (ws) => ws.close());
}

/** Claim a name and take the one run that counts, through to its last frame. */
export async function takeOfficialRun(page: Page): Promise<void> {
  await page.goto(`/?draft=${DRAFT_ID}`);
  await page.locator('#drop-in').click();
  await page.locator('button[data-claim]').first().click();
  await page.locator('#official').click();
  await page.locator('#go').click();
  await page.locator('.sfx').waitFor({ timeout: 90_000 });
  await page.locator('#done').click();
}
