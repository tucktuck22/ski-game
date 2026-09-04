import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  Outbox,
  indexedDbStore,
  type PendingCommit,
  type SubmitResult,
} from '../../src/state/outbox.js';
import { OutboxRunner, type RunnerEnvironment } from '../../src/state/outboxRunner.js';

const commit = {
  id: 'e1-official',
  draftId: 'd1',
  entryId: 'e1',
  score: 51234,
  outcome: 'finished' as const,
  rulesVersion: '1.5.0',
};

/** No timers and no network for these; the point here is what survives. */
const inertEnv: RunnerEnvironment = {
  setTimer: () => 0,
  clearTimer: () => {},
  onOnline: () => () => {},
};

let db = 0;
const freshDbName = (): string => `outbox-test-${++db}`;

/**
 * FR-048: "A queued commit MUST survive page reload and browser restart."
 *
 * indexedDbStore() was written for this and then wired to nothing - main.ts
 * built the outbox on an in-memory Map in BOTH modes, so a score queued on a
 * dead connection lasted exactly as long as the tab. The player was told to
 * keep the tab open and that the score would post when he had a signal; a
 * reload, a crash, or iOS reclaiming the tab discarded it silently.
 *
 * A new store over the same database is how a restart looks from the code's
 * point of view: nothing in memory, everything on disk.
 */
describe('a queued commit survives a restart (FR-048)', () => {
  it('is still there when a new store opens the same database', async () => {
    const name = freshDbName();
    await new Outbox(indexedDbStore(name), async () => ({ kind: 'retry' })).enqueue(commit);

    // The restart. Nothing carried over but the database itself.
    const afterRestart = await new Outbox(indexedDbStore(name), async () => ({
      kind: 'retry',
    })).pending();

    expect(afterRestart).toHaveLength(1);
    expect(afterRestart[0]).toMatchObject({ entryId: 'e1', score: 51234, rulesVersion: '1.5.0' });
  });

  it('is submitted by the next session that can reach the server', async () => {
    const name = freshDbName();
    await new Outbox(indexedDbStore(name), async () => ({ kind: 'retry' })).enqueue(commit);

    const submitted: PendingCommit[] = [];
    const outbox = new Outbox(indexedDbStore(name), async (c): Promise<SubmitResult> => {
      submitted.push(c);
      return { kind: 'confirmed' };
    });
    const runner = new OutboxRunner(outbox, inertEnv);

    expect(await runner.hasPending()).toBe(true);
    const result = await runner.drainNow();

    expect(result.confirmed).toBe(1);
    expect(submitted.map((c) => c.entryId)).toEqual(['e1']);
    // Confirmed means gone. A second session must not post it again - the
    // unique index would reject it, but the player would watch it happen.
    expect(await runner.hasPending()).toBe(false);
  });

  it('keeps the attempt count across the restart, so backoff does not reset', async () => {
    const name = freshDbName();
    const failing = new Outbox(indexedDbStore(name), async () => ({ kind: 'retry' }));
    await failing.enqueue(commit);
    await failing.drain();
    await failing.drain();

    const afterRestart = await new Outbox(indexedDbStore(name), async () => ({
      kind: 'retry',
    })).pending();

    expect(afterRestart[0]?.attempts).toBe(2);
  });

  it('a rejection clears it permanently, restart or not', async () => {
    const name = freshDbName();
    const outbox = new Outbox(indexedDbStore(name), async (): Promise<SubmitResult> => ({
      kind: 'rejected',
      reason: 'That name has already committed its official run.',
    }));
    await outbox.enqueue(commit);
    await outbox.drain();

    const afterRestart = await new Outbox(indexedDbStore(name), async () => ({
      kind: 'retry',
    })).pending();

    expect(afterRestart).toHaveLength(0);
  });
});

/**
 * The wiring itself, guarded.
 *
 * This defect was never in outbox.ts. Every unit test of the outbox passed, the
 * IndexedDB store worked, `backoffFor` returned the right numbers - and none of
 * it was connected to the application, so the product had neither durability
 * nor retry. A module written and left unwired fails no test that tests the
 * module.
 *
 * So this reads main.ts. It is a coarse check and it is deliberately coarse:
 * its job is to fail loudly if the durable store or the retry driver is ever
 * quietly dropped again, not to describe how they are used.
 */
describe('the application actually uses the durable outbox', () => {
  const main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');

  it('imports the IndexedDB store rather than only the in-memory Map', () => {
    expect(main).toMatch(/import\s*\{[^}]*indexedDbStore[^}]*\}\s*from\s*'\.\/state\/outbox\.js'/);
  });

  it('chooses the durable store when a real draft is configured (FR-048)', () => {
    // Some conditional on the configured backend must select indexedDbStore.
    // Both modes on the Map is the bug this file exists for.
    expect(main).toMatch(/config\.kind === 'configured'\s*\?\s*indexedDbStore\(\)/);
  });

  it('drives retries rather than draining once (FR-046)', () => {
    expect(main).toMatch(/new OutboxRunner\(/);
    expect(main).toMatch(/outboxRunner\.start\(\)/);
    // The single unconditional `outbox.drain()` was the whole of the old retry
    // policy. Draining must go through the runner, which schedules the next go.
    expect(main).not.toMatch(/\boutbox\.drain\(\)/);
  });
});
