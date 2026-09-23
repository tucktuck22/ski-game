import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyError } from '../../src/state/supabase.js';
import { LocalDraftStore } from '../../src/state/localDraft.js';

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

/**
 * FR-023 freezes the rules at the first commit, and the trigger enforces it by
 * comparing the submission's rules_version against the draft's. That makes the
 * seeded value part of the contract rather than a comment: if it does not match
 * what the client actually sends, EVERY official run is rejected with "rules
 * version mismatch" and each of eight players is told his one run did not count.
 *
 * That is not hypothetical. rulesVersion was bumped six times (1.0.0 -> 1.6.0)
 * while seed-draft.sql kept saying '1.0.0', and nothing failed until a player
 * tried to commit. Grepping the seed is cheap; discovering this from the cabin
 * is not.
 */
describe('the seeded rules version matches the rules the client sends (FR-023)', () => {
  const seed = readFileSync(new URL('../../supabase/seed-draft.sql', import.meta.url), 'utf8');
  const course = (f: string): { rulesVersion: string } =>
    JSON.parse(readFileSync(new URL(`../../data/courses/${f}`, import.meta.url), 'utf8')) as {
      rulesVersion: string;
    };

  const seeded = /rules_version[\s\S]*?values\s*\([\s\S]*?'([\d.]+)',/.exec(seed)?.[1];

  it('seeds a rules_version at all', () => {
    expect(seeded).toBeDefined();
  });

  it('seeds exactly the version the official course declares', () => {
    expect(seeded).toBe(course('official.json').rulesVersion);
  });

  it('is the version both courses agree on, since one draft covers both', () => {
    expect(course('warmup.json').rulesVersion).toBe(course('official.json').rulesVersion);
  });

  /**
   * The repair script has to be right for exactly the same reason the seed
   * does, and it is the more dangerous of the two: it is reached by somebody
   * whose draft is already broken, so a stale value there fails to fix the
   * thing it was opened to fix.
   *
   * It used to demand the version be filled in by hand and refuse to run until
   * it was, which is not a safeguard - it is a puzzle handed to someone already
   * unblocking a draft. The value is baked in and this test is what keeps it
   * honest.
   */
  it('the repair script targets that same version', () => {
    const fix = readFileSync(
      new URL('../../supabase/fix-rules-version.sql', import.meta.url),
      'utf8',
    );
    const target = /target\s+text\s*:=\s*'([^']+)'/.exec(fix)?.[1];
    expect(target).toBe(course('official.json').rulesVersion);
  });

  it('the repair script asks the operator to edit nothing', () => {
    const fix = readFileSync(
      new URL('../../supabase/fix-rules-version.sql', import.meta.url),
      'utf8',
    );
    // A CHANGE ME in an executable line is a script that stops rather than runs.
    expect(fix).not.toMatch(/:=\s*'CHANGE ME'/);
  });
});

/**
 * THE LOCAL BACKEND HELD TO THE SAME CONTRACT.
 *
 * `LocalDraftStore` is what runs with no Supabase project configured, and it is
 * what the built-artifact smoke journey drives. A local mode that hands out
 * unlimited attempts would make that gate assert the wrong behaviour, which
 * Principle VI is explicit about: verification against a convenient
 * approximation is not verification.
 *
 * The Supabase half of these rules is proven by the `storage` job against real
 * Postgres, not here — grepping SQL can only say a statement is present.
 */
describe('the local backend obeys the attempt rules too (FR-233, FR-235, research R6)', () => {
  const store = (): LocalDraftStore =>
    new LocalDraftStore({
      id: 'local-draft',
      deadline: new Date(Date.now() + 86_400_000).toISOString(),
      courseSeed: 1986,
      rulesVersion: '3.0.0',
      finalizedAt: null,
    });

  it('spends attempts one at a time and refuses past the allowance (FR-233)', async () => {
    const s = store();
    const id = await s.seedOrganizerEntry('Dave');
    for (let n = 1; n <= 3; n++) {
      const r = await s.startOfficialAttempt(id, 3);
      expect(r).toEqual({ ok: true, attemptNo: n });
    }
    const fourth = await s.startOfficialAttempt(id, 3);
    expect(fourth.ok).toBe(false);
  });

  it('honours the allowance it is given rather than a hardcoded 3 (FR-245)', async () => {
    const s = store();
    const id = await s.seedOrganizerEntry('Dave');
    expect((await s.startOfficialAttempt(id, 1)).ok).toBe(true);
    expect((await s.startOfficialAttempt(id, 1)).ok).toBe(false);
  });

  it('charges an abandoned attempt, which posts no score at all (FR-233)', async () => {
    const s = store();
    const id = await s.seedOrganizerEntry('Dave');
    await s.startOfficialAttempt(id, 3); // started, never committed — the tab died
    const [entry] = (await s.snapshot()).entries;
    expect(entry?.officialAttemptsUsed).toBe(1);
    expect(entry?.score).toBeNull();
  });

  it('exposes no way to lower the counter (FR-235)', () => {
    const surface = Object.getOwnPropertyNames(LocalDraftStore.prototype);
    expect(surface.filter((k) => /refund|restore|resetAttempt|decrement/i.test(k))).toEqual([]);
  });

  /**
   * R1's idempotency trap. A commit that succeeded but whose response was lost
   * gets retried by the outbox, which has no other way to tell a retry from a
   * new submission. The SAME attempt must be rejected; a DIFFERENT one must not.
   */
  it('rejects a duplicate attempt but accepts the next one (research R1)', async () => {
    const s = store();
    const id = await s.seedOrganizerEntry('Dave');
    const commit = (attemptNo: number, score: number) => ({
      id: `${id}-official-${attemptNo}`,
      draftId: 'local-draft',
      entryId: id,
      attemptNo,
      score,
      outcome: 'finished' as const,
      rulesVersion: '3.0.0',
      queuedAt: Date.now(),
      attempts: 0,
    });
    expect(await s.submitCommit(commit(1, 4000))).toEqual({ kind: 'confirmed' });
    expect((await s.submitCommit(commit(1, 4000))).kind).toBe('rejected');
    expect(await s.submitCommit(commit(2, 6100))).toEqual({ kind: 'confirmed' });

    // FR-232: the best stands, not the latest.
    const [entry] = (await s.snapshot()).entries;
    expect(entry?.score).toBe(6100);
  });
});
