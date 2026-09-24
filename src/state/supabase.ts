/**
 * Shared storage client.
 *
 * Every rule that matters is enforced by the database, not here — see
 * supabase/migrations and contracts/storage-api.md. This module is a typed
 * surface over those operations plus the classification of errors into
 * "retry" versus "permanently rejected", which the outbox depends on.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { bestAttempt, type AttemptRecord, type EntryView } from './ordering.js';
import type { PendingCommit, SubmitResult } from './outbox.js';

export interface DraftView {
  id: string;
  deadline: string;
  courseSeed: number;
  rulesVersion: string;
  finalizedAt: string | null;
}

export interface DraftSnapshot {
  draft: DraftView;
  entries: EntryView[];
}

/** Postgres codes that mean "this will never succeed, stop retrying". */
const PERMANENT_CODES = new Set(['23505', '23514', '23503', '42501']);

export function classifyError(err: { code?: string; message?: string } | null): SubmitResult {
  if (err === null) return { kind: 'confirmed' };
  if (err.code !== undefined && PERMANENT_CODES.has(err.code))
    return { kind: 'rejected', reason: err.message ?? `rejected (${err.code})` };
  // Anything else — offline, timeout, 5xx — is transient. Keep it queued.
  return { kind: 'retry' };
}

/**
 * Finds the draft when the link carries no `?draft=`.
 *
 * The bare site URL is what people actually type and bookmark, and what gets
 * pasted back into a group chat once the query string is lost. Failing it with
 * "no draft found for local-draft" blames the player for the organizer's link
 * hygiene. There is almost always exactly one draft, so look.
 *
 * Not a security boundary: the draft id was never secret (FR-040 makes the
 * board public to link holders), and the organizer secret is a separate
 * revoked column.
 */
export async function discoverDraft(
  url: string,
  anonKey: string,
): Promise<
  | { kind: 'found'; id: string }
  | { kind: 'none' }
  | { kind: 'many'; drafts: { id: string; deadline: string }[] }
> {
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('draft')
    .select('id, deadline')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;

  const drafts = (data ?? []).map((d) => ({ id: d.id as string, deadline: d.deadline as string }));
  if (drafts.length === 0) return { kind: 'none' };
  if (drafts.length === 1) return { kind: 'found', id: drafts[0]!.id };
  return { kind: 'many', drafts };
}

export class DraftStore {
  private readonly db: SupabaseClient;

  constructor(
    url: string,
    anonKey: string,
    private readonly draftId: string,
    /**
     * FR-006: present only for a holder of the organizer URL, and required by
     * every organizer action below. Secrecy, not authentication - anyone who
     * obtains the URL has these powers, exactly as src/state/links.ts says.
     */
    private readonly organizerSecret: string | null = null,
  ) {
    this.db = createClient(url, anonKey, { auth: { persistSession: false } });
  }

  /** Reads the whole draft. The leaderboard is public to link holders (FR-040). */
  async snapshot(): Promise<DraftSnapshot> {
    const [draftRes, entryRes, scoreRes] = await Promise.all([
      // Explicit column list, never select('*'). organizer_secret is revoked
      // from anon (0002_policies.sql) and a wildcard select would fail against
      // it - but more importantly, naming the columns is what stops a future
      // column being exposed to players by accident. See FR-006.
      this.db
        .from('draft')
        .select('id, deadline, course_seed, rules_version, finalized_at')
        .eq('id', this.draftId)
        .single(),
      this.db.from('roster_entry').select('*').eq('draft_id', this.draftId),
      // ORDER BY is not decoration: the reduction below must not depend on the
      // order rows happen to come back in (research R4).
      this.db
        .from('committed_score')
        .select('*')
        .eq('draft_id', this.draftId)
        .order('attempt_no', { ascending: true }),
    ]);
    // A misconfigured project is the likeliest real failure, and a raw
    // PostgrestError tells the organizer nothing actionable. Name the cause and
    // the fix instead.
    const setupError = draftRes.error ?? entryRes.error ?? scoreRes.error;
    if (setupError) {
      const code = setupError.code ?? '';
      const msg = setupError.message ?? '';

      if (code === '42P01' || /relation .* does not exist/i.test(msg)) {
        throw new Error(
          'The database has no tables yet. Run supabase/setup.sql in the Supabase ' +
            'SQL editor, then supabase/seed-draft.sql to create a draft.',
        );
      }
      if (code === '42501' || /permission denied/i.test(msg)) {
        throw new Error(
          'The database refused access. supabase/setup.sql grants the anon role what ' +
            'it needs - re-run it, and check the anon key in VITE_SUPABASE_ANON_KEY.',
        );
      }
      if (
        code === 'PGRST116' ||
        code === '22P02' ||
        /invalid input syntax for type uuid/i.test(msg)
      ) {
        throw new Error(
          `No draft found for id "${this.draftId}". Run supabase/seed-draft.sql to ` +
            'create one, then use the link it prints — it ends in ?draft=<id>. ' +
            'A link with no ?draft= cannot find a draft.',
        );
      }
      throw setupError;
    }

    // MANY rows per entry now, not one. This used to be
    // `new Map(rows.map((s) => [s.entry_id, s]))`, which keeps the LAST value
    // per key - fine when an entry could only have one score, and silently the
    // wrong bed order the moment it can have three (research R4).
    const attempts = new Map<string, AttemptRecord[]>();
    for (const row of scoreRes.data ?? []) {
      const entryId = row.entry_id as string;
      const list = attempts.get(entryId) ?? [];
      list.push({
        attemptNo: (row.attempt_no as number | null) ?? 1,
        score: row.score as number,
        commitAt: row.commit_at as string,
        outcome: row.outcome as 'finished' | 'wiped_out',
      });
      attempts.set(entryId, list);
    }

    const entries: EntryView[] = (entryRes.data ?? []).map((e) => {
      // FR-232: the best attempt is what stands, and FR-236 takes its timestamp
      // with it rather than the latest attempt's.
      const best = bestAttempt(attempts.get(e.id as string) ?? []);
      return {
        id: e.id as string,
        name: e.name as string,
        origin: e.origin as 'organizer' | 'self_created',
        claimed: e.claimed_at !== null,
        practiceRunsUsed: e.practice_runs_used as number,
        officialAttemptsUsed: (e.official_attempts_used as number | null) ?? 0,
        removed: e.removed_at !== null,
        score: best ? best.score : null,
        commitAt: best ? best.commitAt : null,
        outcome: best ? best.outcome : null,
      };
    });

    const d = draftRes.data;
    if (!d) {
      throw new Error(
        `No draft found for id "${this.draftId}". Run supabase/seed-draft.sql to create ` +
          'one, then use the link it prints — it ends in ?draft=<id>.',
      );
    }
    return {
      draft: {
        id: d.id as string,
        deadline: d.deadline as string,
        courseSeed: Number(d.course_seed),
        rulesVersion: d.rules_version as string,
        finalizedAt: (d.finalized_at as string | null) ?? null,
      },
      entries,
    };
  }

  /** FR-070: self-serve creation, claimed in the same action (FR-008). */
  async createEntry(
    name: string,
  ): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
    const { data, error } = await this.db
      .from('roster_entry')
      .insert({
        draft_id: this.draftId,
        name: name.trim(),
        origin: 'self_created',
        claimed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505')
        return { ok: false, reason: 'That name is already on the roster.' };
      if (error.message.includes('roster is full'))
        return { ok: false, reason: 'The roster is full (16). Ask the organizer.' };
      return { ok: false, reason: error.message };
    }
    return { ok: true, id: data.id as string };
  }

  /** FR-012: first confirmed claim wins; the loser is told plainly. */
  async claimEntry(entryId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const { data, error } = await this.db
      .from('roster_entry')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', entryId)
      .is('claimed_at', null)
      .select('id');
    if (error) return { ok: false, reason: error.message };
    if (!data || data.length === 0)
      return { ok: false, reason: 'Someone else just claimed that name.' };
    return { ok: true };
  }

  /** Only a COMPLETED practice run increments the counter (FR-066). */
  async recordPracticeRun(entryId: string, used: number): Promise<void> {
    await this.db.from('roster_entry').update({ practice_runs_used: used }).eq('id', entryId);
  }

  /**
   * Spends an official attempt at the instant the run STARTS (FR-233, FR-234).
   *
   * THIS REPLACES markOfficialRunEnded, AND THE TIMING IS THE POINT. Spending
   * at run end could only ever charge for a run that reached a finish or a
   * wipeout; an abandoned run - tab closed, phone dead - cost nothing, which is
   * the unfairness feature 007 exists to close. Moving the write to the start
   * charges for the attempt without anyone having to DETECT the abandonment,
   * which is impossible to do reliably when the tab is killed.
   *
   * BEST EFFORT, AND IT FAILS OPEN. Every other write in this system does, so a
   * bad connection cannot cost a player his run, and an earlier design that
   * failed closed here would have made this the first network round-trip in the
   * product to gate gameplay. The organizer ruled the count honour-system
   * (research R2), so an offline attempt that goes uncounted is an accepted
   * cost, not a hole to plug. The caller starts the run either way.
   *
   * The allowance is passed in rather than assumed: it is a tuning value, and
   * shared storage carries only a loose sanity rail (FR-245, research R10).
   */
  async startOfficialAttempt(
    entryId: string,
    officialAttempts: number,
    attemptsUsed: number,
  ): Promise<{ ok: true; attemptNo: number } | { ok: false; reason: string }> {
    if (attemptsUsed >= officialAttempts)
      return { ok: false, reason: `All ${officialAttempts} official attempts are used.` };
    const attemptNo = attemptsUsed + 1;
    const { error } = await this.db
      .from('roster_entry')
      .update({ official_attempts_used: attemptNo })
      .eq('id', entryId);
    // A failed write does NOT stop the run. The count reconciles from shared
    // storage on the next load; reporting it lets the caller say so if it wants.
    if (error) return { ok: false, reason: error.message };
    return { ok: true, attemptNo };
  }

  /**
   * The one irreversible write. Called only by the outbox, never directly, so
   * that a failure is queued rather than lost (FR-046).
   */
  async submitCommit(c: PendingCommit): Promise<SubmitResult> {
    const { error } = await this.db.from('committed_score').insert({
      draft_id: c.draftId,
      entry_id: c.entryId,
      attempt_no: c.attemptNo,
      score: c.score,
      outcome: c.outcome,
      rules_version: c.rulesVersion,
      // commit_at deliberately omitted: the server assigns it (FR-037).
    });
    // The attempt counter is NOT touched here. startOfficialAttempt() moved it
    // to the START of the run, which is what makes an abandoned attempt cost
    // one. A 23505 from UNIQUE (draft_id, entry_id, attempt_no) means this exact
    // attempt is already recorded - the correct outcome for a retry whose first
    // response was lost, and what keeps the outbox idempotent (research R1).
    return classifyError(error);
  }

  // ---- Organizer operations (FR-006) ----
  //
  // Through security-definer functions, NOT table writes. The RLS policies
  // deliberately deny every client role the update on `draft`, the update on
  // roster_entry's removal columns, and the delete on committed_score - and
  // that denial is what makes FR-018 hold for the player holding the same anon
  // key. The organizer carries no service role and this project has no server
  // to put one behind, so these three actions were simply denied: verified
  // against Postgres 16, each came back "permission denied", and the throw
  // below reached the global unhandledrejection handler and replaced the page.
  //
  // supabase/migrations/0003_organizer.sql is the door. It takes the secret and
  // runs as the schema owner; the table grants are unchanged, so nothing a
  // player can reach has widened.

  async setDeadline(iso: string): Promise<void> {
    const { error } = await this.db.rpc('organizer_set_deadline', {
      p_draft: this.draftId,
      p_secret: this.organizerSecret,
      p_deadline: iso,
    });
    if (error) throw error;
  }

  async releaseClaim(entryId: string): Promise<void> {
    const { error } = await this.db
      .from('roster_entry')
      .update({ claimed_at: null })
      .eq('id', entryId);
    if (error) throw error;
  }

  /** FR-074: recorded and left visible, never a silent deletion. */
  async removeEntry(entryId: string, discardedScore: number | null): Promise<void> {
    const { error } = await this.db.rpc('organizer_remove_entry', {
      p_draft: this.draftId,
      p_secret: this.organizerSecret,
      p_entry: entryId,
      // What the organizer confirmed discarding is what gets recorded as
      // discarded, rather than whatever the row happens to say at write time.
      p_score: discardedScore,
    });
    if (error) throw error;
  }

  async resetDraft(): Promise<void> {
    // Destructive and irreversible; the UI confirms before calling it. One call
    // rather than two writes, so a reset cannot half-happen and leave scores
    // cleared against run counters that were not.
    const { error } = await this.db.rpc('organizer_reset_draft', {
      p_draft: this.draftId,
      p_secret: this.organizerSecret,
    });
    if (error) throw error;
  }

  /** FR-042: a commit must reach other viewers within 10 seconds. */
  subscribe(onChange: () => void): () => void {
    const channel = this.db
      .channel(`draft:${this.draftId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'committed_score' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roster_entry' }, onChange)
      .subscribe();
    // Polling fallback where the socket cannot be established.
    const poll = setInterval(onChange, 15_000);
    return () => {
      clearInterval(poll);
      void this.db.removeChannel(channel);
    };
  }
}
