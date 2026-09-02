import { describe, it, expect, vi } from 'vitest';
import {
  Outbox,
  backoffFor,
  type OutboxStore,
  type PendingCommit,
  type SubmitResult,
} from '../../src/state/outbox.js';
import * as outboxModule from '../../src/state/outbox.js';

function memoryStore(): OutboxStore & { items: Map<string, PendingCommit> } {
  const items = new Map<string, PendingCommit>();
  return {
    items,
    all: async () => [...items.values()],
    put: async (c) => {
      items.set(c.id, c);
    },
    remove: async (id) => {
      items.delete(id);
    },
  };
}

const commit = {
  id: 'c1',
  draftId: 'd1',
  entryId: 'e1',
  score: 51234,
  outcome: 'finished' as const,
  rulesVersion: '1.0.0',
};

describe('commit outbox (FR-046, FR-048)', () => {
  it('queues before the first network attempt, so a crash mid-request loses nothing', async () => {
    const store = memoryStore();
    const submit = vi.fn(async (): Promise<SubmitResult> => ({ kind: 'confirmed' }));
    const outbox = new Outbox(store, submit);
    await outbox.enqueue(commit);
    expect(submit).not.toHaveBeenCalled();
    expect(store.items.size).toBe(1);
  });

  it('keeps retrying a transient failure and clears on confirmation', async () => {
    const store = memoryStore();
    let calls = 0;
    const outbox = new Outbox(store, async () =>
      ++calls < 3 ? { kind: 'retry' } : { kind: 'confirmed' },
    );
    await outbox.enqueue(commit);

    expect(await outbox.drain()).toMatchObject({ retrying: 1, confirmed: 0 });
    expect(await outbox.drain()).toMatchObject({ retrying: 1, confirmed: 0 });
    expect((await outbox.pending())[0]!.attempts).toBe(2);

    expect(await outbox.drain()).toMatchObject({ confirmed: 1 });
    expect(await outbox.pending()).toHaveLength(0);
  });

  it('drops a permanently rejected commit instead of retrying forever', async () => {
    // A duplicate rejection is a CORRECT outcome - the score is already safely
    // recorded. Retrying would leave the player staring at "pending" forever.
    const store = memoryStore();
    const outbox = new Outbox(store, async () => ({
      kind: 'rejected',
      reason: 'already committed',
    }));
    await outbox.enqueue(commit);
    const result = await outbox.drain();
    expect(result.rejected).toEqual(['already committed']);
    expect(await outbox.pending()).toHaveLength(0);
  });

  it('never silently discards a commit on a transient failure (FR-046)', async () => {
    const store = memoryStore();
    const outbox = new Outbox(store, async () => ({ kind: 'retry' }));
    await outbox.enqueue(commit);
    for (let i = 0; i < 50; i++) await outbox.drain();
    expect(await outbox.pending()).toHaveLength(1);
    expect((await outbox.pending())[0]!.score).toBe(51234);
  });

  it('survives a restart: a fresh Outbox over the same store sees the queue', async () => {
    const store = memoryStore();
    await new Outbox(store, async () => ({ kind: 'retry' })).enqueue(commit);
    const revived = new Outbox(store, async () => ({ kind: 'confirmed' }));
    expect(await revived.pending()).toHaveLength(1);
    expect(await revived.drain()).toMatchObject({ confirmed: 1 });
  });

  it('backs off exponentially and caps at 60 seconds', () => {
    expect(backoffFor(0)).toBe(1000);
    expect(backoffFor(1)).toBe(2000);
    expect(backoffFor(3)).toBe(8000);
    expect(backoffFor(99)).toBe(60000);
  });
});

describe('the outbox is not authoritative (FR-021)', () => {
  it('exposes no reader for run counts, claims, or standings', () => {
    // The tempting shortcut is to answer "has he used his official run?" from
    // local state. That would hand a player a fresh run per device, which is
    // precisely what FR-021 forbids. The module must offer no such affordance.
    const surface = Object.keys(outboxModule);
    const forbidden = surface.filter((k) =>
      /runcount|claim|standing|leaderboard|hasCommitted/i.test(k),
    );
    expect(forbidden).toEqual([]);
  });

  it('a pending commit carries no authority over whether a run happened', async () => {
    const store = memoryStore();
    const outbox = new Outbox(store, async () => ({ kind: 'retry' }));
    await outbox.enqueue(commit);
    const [item] = await outbox.pending();
    // It records what was submitted. It does not record, and cannot answer,
    // whether the server accepted it - that answer only comes from the server.
    expect(Object.keys(item!).sort()).toEqual([
      'attempts',
      'draftId',
      'entryId',
      'id',
      'outcome',
      'queuedAt',
      'rulesVersion',
      'score',
    ]);
    expect(item).not.toHaveProperty('confirmed');
  });
});
