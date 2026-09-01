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
import type { EntryView } from './ordering.js';
import type { DraftSnapshot, DraftView } from './supabase.js';
import type { PendingCommit, SubmitResult } from './outbox.js';

export class LocalDraftStore {
  private entries = new Map<string, EntryView>();
  private commits = new Map<string, { score: number; outcome: 'finished' | 'wiped_out'; at: string }>();
  private listeners = new Set<() => void>();
  private seq = 0;

  constructor(private readonly draft: DraftView) {}

  private notify(): void {
    for (const l of this.listeners) l();
  }

  async snapshot(): Promise<DraftSnapshot> {
    const entries = [...this.entries.values()].map((e) => {
      const c = this.commits.get(e.id);
      return { ...e, score: c?.score ?? null, commitAt: c?.at ?? null, outcome: c?.outcome ?? null };
    });
    return { draft: this.draft, entries };
  }

  async createEntry(name: string): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
    const trimmed = name.trim();
    if (trimmed.length === 0) return { ok: false, reason: 'Enter a name.' };
    // Mirrors the unique index: case-insensitive exact match only (FR-003).
    for (const e of this.entries.values()) {
      if (e.name.toLowerCase() === trimmed.toLowerCase())
        return { ok: false, reason: 'That name is already on the roster.' };
    }
    // Mirrors the roster cap trigger (FR-002, FR-072).
    if (this.entries.size >= 16) return { ok: false, reason: 'The roster is full (16). Ask the organizer.' };

    const id = `local-${++this.seq}`;
    this.entries.set(id, {
      id, name: trimmed, origin: 'self_created', claimed: true,
      practiceRunsUsed: 0, abandonedOfficialRuns: 0, removed: false,
      score: null, commitAt: null, outcome: null,
    });
    this.notify();
    return { ok: true, id };
  }

  async seedOrganizerEntry(name: string): Promise<string> {
    const id = `local-${++this.seq}`;
    this.entries.set(id, {
      id, name, origin: 'organizer', claimed: false,
      practiceRunsUsed: 0, abandonedOfficialRuns: 0, removed: false,
      score: null, commitAt: null, outcome: null,
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

  async recordAbandonedRun(id: string, count: number): Promise<void> {
    const e = this.entries.get(id);
    if (e) this.entries.set(id, { ...e, abandonedOfficialRuns: count });
    this.notify();
  }

  /** Mirrors the unique index: a second commit for the same entry is rejected. */
  async submitCommit(c: PendingCommit): Promise<SubmitResult> {
    if (this.commits.has(c.entryId))
      return { kind: 'rejected', reason: 'That name has already committed its official run.' };
    if (Date.now() > Date.parse(this.draft.deadline))
      return { kind: 'rejected', reason: 'The deadline has passed.' };
    this.commits.set(c.entryId, {
      score: c.score,
      outcome: c.outcome,
      // Assigned here, not by the caller — mirroring commit_at DEFAULT now().
      at: new Date().toISOString(),
    });
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
      this.entries.set(id, { ...e, claimed: false, practiceRunsUsed: 0, abandonedOfficialRuns: 0 });
    }
    this.notify();
  }

  subscribe(onChange: () => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }
}
