/**
 * An in-memory draft store for local development and end-to-end tests.
 *
 * It implements the same operations and the same invariants as the Postgres
 * schema, so the app can be run and driven without provisioning a project.
 *
 * IT IS NOT A FALLBACK FOR PRODUCTION. FR-021 requires shared storage: run
 * counts held on a device would hand every player a fresh official run per
 * browser. This module is selected only when no Supabase URL is configured,
 * and the UI says so plainly on screen so nobody mistakes a local session for
 * a real draft.
 */
import { bestAttempt, type AttemptRecord, type EntryView } from './ordering.js';
import type { DraftSnapshot, DraftView } from './supabase.js';
import type { PendingCommit, SubmitResult } from './outbox.js';

export class LocalDraftStore {
  private entries = new Map<string, EntryView>();
  /** Many attempts per entry now, mirroring committed_score's new shape. */
  private commits = new Map<string, AttemptRecord[]>();
  private listeners = new Set<() => void>();
  private seq = 0;

  constructor(private readonly draft: DraftView) {}

  private notify(): void {
    for (const l of this.listeners) l();
  }

  async snapshot(): Promise<DraftSnapshot> {
    const entries = [...this.entries.values()].map((e) => {
      // Same reduction the Supabase client uses, from the same function, so the
      // two backends agree by construction rather than by coincidence (R6).
      const best = bestAttempt(this.commits.get(e.id) ?? []);
      return {
        ...e,
        score: best?.score ?? null,
        commitAt: best?.commitAt ?? null,
        outcome: best?.outcome ?? null,
      };
    });
    return { draft: this.draft, entries };
  }

  async createEntry(
    name: string,
  ): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
    const trimmed = name.trim();
    if (trimmed.length === 0) return { ok: false, reason: 'Enter a name.' };
    // Mirrors the unique index: case-insensitive exact match only (FR-003).
    for (const e of this.entries.values()) {
      if (e.name.toLowerCase() === trimmed.toLowerCase())
        return { ok: false, reason: 'That name is already on the roster.' };
    }
    // Mirrors the roster cap trigger (FR-002, FR-072).
    if (this.entries.size >= 16)
      return { ok: false, reason: 'The roster is full (16). Ask the organizer.' };

    const id = `local-${++this.seq}`;
    this.entries.set(id, {
      id,
      name: trimmed,
      origin: 'self_created',
      claimed: true,
      practiceRunsUsed: 0,
      officialAttemptsUsed: 0,
      removed: false,
      score: null,
      commitAt: null,
      outcome: null,
    });
    this.notify();
    return { ok: true, id };
  }

  async seedOrganizerEntry(name: string): Promise<string> {
    const id = `local-${++this.seq}`;
    this.entries.set(id, {
      id,
      name,
      origin: 'organizer',
      claimed: false,
      practiceRunsUsed: 0,
      officialAttemptsUsed: 0,
      removed: false,
      score: null,
      commitAt: null,
      outcome: null,
    });
    this.notify();
    return id;
  }

  async claimEntry(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const e = this.entries.get(id);
    if (!e) return { ok: false, reason: 'No such name.' };
    if (e.claimed) return { ok: false, reason: 'Someone else just claimed that name.' };
    this.entries.set(id, { ...e, claimed: true });
    this.notify();
    return { ok: true };
  }

  async recordPracticeRun(id: string, used: number): Promise<void> {
    const e = this.entries.get(id);
    if (e) this.entries.set(id, { ...e, practiceRunsUsed: used });
    this.notify();
  }

  /**
   * Spends an attempt at the moment the run STARTS (FR-233, FR-234).
   *
   * Mirrors DraftStore. Returns the attempt number so the commit can carry it,
   * and refuses past the allowance - which is the client's job now, since the
   * allowance is a tuning value the schema deliberately does not pin (R10).
   */
  async startOfficialAttempt(
    id: string,
    officialAttempts: number,
  ): Promise<{ ok: true; attemptNo: number } | { ok: false; reason: string }> {
    const e = this.entries.get(id);
    if (!e) return { ok: false, reason: 'No such name.' };
    if (e.officialAttemptsUsed >= officialAttempts)
      return { ok: false, reason: `All ${officialAttempts} official attempts are used.` };
    if (Date.now() > Date.parse(this.draft.deadline))
      return { ok: false, reason: 'The deadline has passed.' };
    const attemptNo = e.officialAttemptsUsed + 1;
    this.entries.set(id, { ...e, officialAttemptsUsed: attemptNo });
    this.notify();
    return { ok: true, attemptNo };
  }

  /**
   * Mirrors UNIQUE (draft_id, entry_id, attempt_no): a second commit for the
   * SAME attempt is rejected, which is what keeps an outbox retry idempotent
   * (R1). A different attempt number is a new row, not a duplicate.
   */
  async submitCommit(c: PendingCommit): Promise<SubmitResult> {
    const existing = this.commits.get(c.entryId) ?? [];
    if (existing.some((a) => a.attemptNo === c.attemptNo))
      return { kind: 'rejected', reason: `Attempt ${c.attemptNo} is already recorded.` };
    if (Date.now() > Date.parse(this.draft.deadline))
      return { kind: 'rejected', reason: 'The deadline has passed.' };
    existing.push({
      attemptNo: c.attemptNo,
      score: c.score,
      outcome: c.outcome,
      // Assigned here, not by the caller — mirroring commit_at DEFAULT now().
      commitAt: new Date().toISOString(),
    });
    this.commits.set(c.entryId, existing);
    this.notify();
    return { kind: 'confirmed' };
  }

  // Organizer operations (FR-006, FR-007, FR-074). Present here so the flow can
  // be exercised locally; in production these run through the service role,
  // which the player bundle does not carry.
  async setDeadline(iso: string): Promise<void> {
    (this.draft as { deadline: string }).deadline = iso;
    this.notify();
  }

  async releaseClaim(id: string): Promise<void> {
    const e = this.entries.get(id);
    if (e && !this.commits.has(id)) this.entries.set(id, { ...e, claimed: false });
    this.notify();
  }

  /** FR-074: the entry stays visible as removed rather than disappearing. */
  async removeEntry(id: string, _discardedScore: number | null): Promise<void> {
    const e = this.entries.get(id);
    if (e) this.entries.set(id, { ...e, removed: true });
    this.notify();
  }

  async resetDraft(): Promise<void> {
    this.commits.clear();
    for (const [id, e] of this.entries) {
      this.entries.set(id, {
        ...e,
        claimed: false,
        practiceRunsUsed: 0,
        officialAttemptsUsed: 0,
      });
    }
    this.notify();
  }

  subscribe(onChange: () => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }
}
