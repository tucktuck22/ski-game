/**
 * Shared storage client.
 *
 * Every rule that matters is enforced by the database, not here — see
 * supabase/migrations and contracts/storage-api.md. This module is a typed
 * surface over those operations plus the classification of errors into
 * "retry" versus "permanently rejected", which the outbox depends on.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { EntryView } from './ordering.js';
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
      this.db.from('committed_score').select('*').eq('draft_id', this.draftId),
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

    const scores = new Map((scoreRes.data ?? []).map((s) => [s.entry_id as string, s]));

    const entries: EntryView[] = (entryRes.data ?? []).map((e) => {
      const s = scores.get(e.id as string);
      return {
        id: e.id as string,
        name: e.name as string,
        origin: e.origin as 'organizer' | 'self_created',
        claimed: e.claimed_at !== null,
        practiceRunsUsed: e.practice_runs_used as number,
        abandonedOfficialRuns: e.abandoned_official_runs as number,
        removed: e.removed_at !== null,
        score: s ? (s.score as number) : null,
        commitAt: s ? (s.commit_at as string) : null,
        outcome: s ? (s.outcome as 'finished' | 'wiped_out') : null,
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

  /** FR-065: abandonment is permitted, and public. */
  async recordAbandonedRun(entryId: string, count: number): Promise<void> {
    await this.db.from('roster_entry').update({ abandoned_official_runs: count }).eq('id', entryId);
  }

  /**
   * The one irreversible write. Called only by the outbox, never directly, so
   * that a failure is queued rather than lost (FR-046).
   */
  async submitCommit(c: PendingCommit): Promise<SubmitResult> {
    const { error } = await this.db.from('committed_score').insert({
      draft_id: c.draftId,
      entry_id: c.entryId,
      score: c.score,
      outcome: c.outcome,
      rules_version: c.rulesVersion,
      // commit_at deliberately omitted: the server assigns it (FR-037).
    });
    const result = classifyError(error);
    if (result.kind === 'confirmed') {
      await this.db
        .from('roster_entry')
        .update({ official_status: 'committed' })
        .eq('id', c.entryId);
    }
    return result;
  }

  // ---- Organizer operations (FR-006) ----
  //
  // These are reachable only from the organizer URL. In production they should
  // run through a service-role endpoint rather than the anon key, because the
  // RLS policies deliberately revoke UPDATE and DELETE on committed_score from
  // every client role - that revocation is what makes FR-018 hold for players,
  // and the organizer must not be given a client-side way around it.

  async setDeadline(iso: string): Promise<void> {
    const { error } = await this.db.from('draft').update({ deadline: iso }).eq('id', this.draftId);
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
    const { error } = await this.db
      .from('roster_entry')
      .update({ removed_at: new Date().toISOString(), removed_score: discardedScore })
      .eq('id', entryId);
    if (error) throw error;
  }

  async resetDraft(): Promise<void> {
    // Destructive and irreversible; the UI confirms before calling it.
    await this.db.from('committed_score').delete().eq('draft_id', this.draftId);
    await this.db
      .from('roster_entry')
      .update({
        claimed_at: null,
        practice_runs_used: 0,
        abandoned_official_runs: 0,
        official_status: 'unused',
      })
      .eq('draft_id', this.draftId);
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
