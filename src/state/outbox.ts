/**
 * The commit outbox.
 *
 * An official score that cannot reach the server is queued here and retried
 * until confirmed (FR-046, FR-048). It survives reload and browser restart.
 *
 * THIS IS A TRANSPORT BUFFER FOR A WRITE ALREADY MADE, NEVER A SOURCE OF TRUTH.
 * FR-021 forbids device-local storage from deciding whether a run happened,
 * because that is exactly the shortcut that would hand a player a fresh official
 * run by switching devices. Reading run counts, claims, or standings from here
 * is a defect. tests/unit/outbox-not-authoritative.test.ts asserts the module
 * exposes no such reader.
 */

export interface PendingCommit {
  id: string;
  draftId: string;
  entryId: string;
  score: number;
  outcome: 'finished' | 'wiped_out';
  rulesVersion: string;
  /** Local time, for display only. The authoritative commit_at is server-assigned. */
  queuedAt: number;
  attempts: number;
}

/** Minimal persistence surface, so the outbox is testable without a browser. */
export interface OutboxStore {
  all(): Promise<PendingCommit[]>;
  put(c: PendingCommit): Promise<void>;
  remove(id: string): Promise<void>;
}

export type SubmitResult =
  | { kind: 'confirmed' }
  /** The server rejected it permanently — already committed, deadline passed,
   *  rules mismatch. Retrying would never succeed, so the entry is dropped. */
  | { kind: 'rejected'; reason: string }
  /** Transient: offline, timeout, 5xx. Keep it and try again. */
  | { kind: 'retry' };

export type Submit = (c: PendingCommit) => Promise<SubmitResult>;

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000, 60000] as const;

/** Backoff for the nth attempt, capped at 60s per contracts/storage-api.md. */
export const backoffFor = (attempts: number): number =>
  BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] as number;

export class Outbox {
  constructor(
    private readonly store: OutboxStore,
    private readonly submit: Submit,
  ) {}

  /** Queues BEFORE the first network attempt, so a crash mid-request loses nothing. */
  async enqueue(c: Omit<PendingCommit, 'queuedAt' | 'attempts'>): Promise<void> {
    await this.store.put({ ...c, queuedAt: Date.now(), attempts: 0 });
  }

  async pending(): Promise<PendingCommit[]> {
    return this.store.all();
  }

  /**
   * One drain pass. Returns what happened to each entry.
   *
   * A `rejected` result clears the entry: a duplicate rejection is a CORRECT
   * outcome, not a transient failure. Retrying it forever would leave the
   * player staring at "pending" for a score that is already safely recorded.
   */
  async drain(): Promise<{ confirmed: number; rejected: string[]; retrying: number }> {
    const items = await this.store.all();
    let confirmed = 0;
    let retrying = 0;
    const rejected: string[] = [];

    for (const item of items) {
      const result = await this.submit(item);
      if (result.kind === 'confirmed') {
        await this.store.remove(item.id);
        confirmed++;
      } else if (result.kind === 'rejected') {
        await this.store.remove(item.id);
        rejected.push(result.reason);
      } else {
        await this.store.put({ ...item, attempts: item.attempts + 1 });
        retrying++;
      }
    }
    return { confirmed, rejected, retrying };
  }
}

/** IndexedDB-backed store. Chosen over localStorage because it survives eviction better. */
export function indexedDbStore(dbName = 'shredpocalypse-outbox'): OutboxStore {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('commits')) db.createObjectStore('commits', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const request = fn(db.transaction('commits', mode).objectStore('commits'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  return {
    all: () => tx('readonly', (s) => s.getAll() as IDBRequest<PendingCommit[]>),
    put: async (c) => { await tx('readwrite', (s) => s.put(c) as IDBRequest<IDBValidKey>); },
    remove: async (id) => { await tx('readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>); },
  };
}
