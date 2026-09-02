import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyError } from '../../src/state/supabase.js';

const sql = (f: string): string =>
  readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');

const init = sql('0001_init.sql');
const policies = sql('0002_policies.sql');

/**
 * A FAST PRE-CHECK, not the proof.
 *
 * These read the migrations and assert the rules are declared there rather than
 * in client code a curious player can step around. They run in milliseconds and
 * catch a rule being deleted.
 *
 * The actual proof is the `storage` job in .github/workflows/ci.yml, which
 * applies supabase/setup.sql to a real Postgres 16 and runs
 * supabase/tests/invariants.sql — deliberately violating each invariant and
 * requiring the violation to be rejected. Grepping SQL text can only tell you a
 * statement is present; only executing it tells you it works. Three defects
 * here were found that way, including a grant referencing a column that did not
 * exist yet, which made setup.sql fail outright.
 */
describe('storage invariants are database constraints, not client code', () => {
  it('one committed score per entry, forever (FR-017, FR-018)', () => {
    expect(init).toMatch(
      /create unique index committed_score_one_per_entry\s+on committed_score \(draft_id, entry_id\)/,
    );
  });

  it('grants no UPDATE or DELETE on committed_score to any client role', () => {
    expect(policies).not.toMatch(/create policy \w+ on committed_score for (update|delete)/);
    expect(policies).toMatch(/revoke update, delete on committed_score from anon, authenticated/);
  });

  it('roster names are unique per draft, case-insensitively (FR-003)', () => {
    expect(init).toMatch(
      /create unique index roster_entry_unique_name on roster_entry \(draft_id, lower\(name\)\)/,
    );
  });

  it('the roster cap is a trigger, not a UI check (FR-002, FR-072)', () => {
    expect(init).toMatch(/create trigger roster_cap before insert on roster_entry/);
    expect(init).toMatch(/>= 16 then/);
  });

  it('commit_at is server-assigned and not client-writable (FR-037)', () => {
    expect(init).toMatch(/commit_at\s+timestamptz not null default now\(\)/);
  });

  it('commits are rejected after the deadline and on a rules mismatch (FR-043, FR-023)', () => {
    expect(init).toMatch(/create trigger commit_deadline before insert on committed_score/);
    expect(init).toMatch(/draft deadline has passed/);
    expect(init).toMatch(/rules version mismatch/);
  });

  it('the organizer secret is not readable by players (FR-006)', () => {
    // draft_read is `using (true)`, so without a column-level revoke any link
    // holder could read the secret and gain reset and removal powers.
    expect(policies).toMatch(
      /revoke select \(organizer_secret\) on draft from anon, authenticated/,
    );
  });

  it('the client never selects * from draft, so a new column cannot leak by accident', () => {
    const client = readFileSync(new URL('../../src/state/supabase.ts', import.meta.url), 'utf8');
    expect(client).not.toMatch(/from\('draft'\)\s*\.?\s*\n?\s*\.select\('\*'\)/);
    expect(client).toMatch(/select\('id, deadline, course_seed, rules_version, finalized_at'\)/);
  });

  it('players cannot rewrite a name, origin, or removal (FR-075)', () => {
    expect(policies).toMatch(
      /revoke update \(name, origin, removed_at, removed_score, draft_id\)\s+on roster_entry/,
    );
  });
});

describe('error classification decides retry versus give up', () => {
  it('treats a unique violation as permanent, so a duplicate commit stops retrying', () => {
    expect(classifyError({ code: '23505', message: 'duplicate key' })).toMatchObject({
      kind: 'rejected',
    });
  });

  it('treats a check violation (deadline, cap) as permanent', () => {
    expect(classifyError({ code: '23514', message: 'deadline passed' })).toMatchObject({
      kind: 'rejected',
    });
  });

  it('treats an unknown or network error as transient, so the score is never lost', () => {
    expect(classifyError({ message: 'Failed to fetch' })).toMatchObject({ kind: 'retry' });
    expect(classifyError({ code: '08006', message: 'connection failure' })).toMatchObject({
      kind: 'retry',
    });
  });

  it('treats no error as confirmed', () => {
    expect(classifyError(null)).toMatchObject({ kind: 'confirmed' });
  });
});
