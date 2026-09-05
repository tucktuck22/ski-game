import { describe, it, expect, vi } from 'vitest';
import {
  Outbox,
  type OutboxStore,
  type PendingCommit,
  type SubmitResult,
} from '../../src/state/outbox.js';
import { OutboxRunner, type RunnerEnvironment } from '../../src/state/outboxRunner.js';

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

/**
 * A controllable clock and network.
 *
 * The real backoff runs to sixty seconds, so a test that used real timers would
 * either take a minute or prove nothing. Firing the timer by hand also makes
 * the DELAY an assertion rather than a side effect nobody looks at.
 */
function fakeEnv(): {
  env: RunnerEnvironment;
  delays: number[];
  fire: () => void;
  goOnline: () => void;
  pending: () => number;
} {
  const timers = new Map<number, () => void>();
  const delays: number[] = [];
  let next = 1;
  let online: (() => void) | null = null;
  return {
    delays,
    pending: () => timers.size,
    fire: () => {
      const [id, fn] = [...timers.entries()][0] ?? [];
      if (id === undefined || fn === undefined) throw new Error('no timer scheduled');
      timers.delete(id);
      fn();
    },
    goOnline: () => {
      if (!online) throw new Error('not listening for online');
      online();
    },
    env: {
      setTimer: (fn, ms) => {
        const id = next++;
        delays.push(ms);
        timers.set(id, fn);
        return id;
      },
      clearTimer: (h) => {
        timers.delete(h as number);
      },
      onOnline: (fn) => {
        online = fn;
        return () => {
          online = null;
        };
      },
    },
  };
}

const commit = {
  id: 'e1-official',
  draftId: 'd1',
  entryId: 'e1',
  score: 51234,
  outcome: 'finished' as const,
  rulesVersion: '1.5.0',
};

/**
 * FR-046: "queued locally and retried until confirmed. It MUST NOT be silently
 * discarded."
 *
 * The queue was real and the retry was not. `drain()` ran once, immediately
 * after the enqueue, and a result of `retry` left the score sitting there for
 * the rest of the session while the screen promised it would post as soon as
 * the player had a signal. `backoffFor` was exported and tested and called by
 * nothing. These tests are about the half that was missing.
 */
describe('the outbox is drained until it is empty (FR-046)', () => {
  it('schedules another attempt after a transient failure', async () => {
    const store = memoryStore();
    const submit = vi.fn(async (): Promise<SubmitResult> => ({ kind: 'retry' }));
    const outbox = new Outbox(store, submit);
    await outbox.enqueue(commit);
    const clock = fakeEnv();

    const runner = new OutboxRunner(outbox, clock.env);
    await runner.drainNow();

    expect(submit).toHaveBeenCalledTimes(1);
    // The score is still queued, and something is going to try again.
    expect(store.items.size).toBe(1);
    expect(clock.pending()).toBe(1);
  });

  it('backs off further with each failure rather than hammering', async () => {
    const store = memoryStore();
    const outbox = new Outbox(store, async () => ({ kind: 'retry' }));
    await outbox.enqueue(commit);
    const clock = fakeEnv();
    const runner = new OutboxRunner(outbox, clock.env);

    await runner.drainNow();
    await runner.drainNow();
    await runner.drainNow();

    expect(clock.delays.slice(0, 3)).toEqual([1000, 2000, 4000]);
  });

  it('keeps retrying until the commit is confirmed, then stops', async () => {
    const store = memoryStore();
    let attempt = 0;
    const outbox = new Outbox(store, async (): Promise<SubmitResult> => {
      attempt += 1;
      return attempt < 3 ? { kind: 'retry' } : { kind: 'confirmed' };
    });
    await outbox.enqueue(commit);
    const clock = fakeEnv();
    const settled: number[] = [];
    const runner = new OutboxRunner(outbox, clock.env, (r) => settled.push(r.confirmed));

    // Sequentially: drainNow() joins a pass already in flight rather than
    // starting a second one, so overlapping calls would prove nothing here.
    await runner.drainNow();
    await runner.drainNow();
    await runner.drainNow();

    expect(attempt).toBe(3);
    expect(store.items.size).toBe(0);
    expect(settled.at(-1)).toBe(1);
    // Nothing left to come back for.
    expect(clock.pending()).toBe(0);
  });

  it('drains the moment the network returns, without waiting out the backoff', async () => {
    const store = memoryStore();
    const submit = vi.fn(async (): Promise<SubmitResult> => ({ kind: 'retry' }));
    const outbox = new Outbox(store, submit);
    await outbox.enqueue(commit);
    const clock = fakeEnv();

    const runner = new OutboxRunner(outbox, clock.env);
    runner.start();
    await runner.drainNow();
    const attemptsBefore = submit.mock.calls.length;

    clock.goOnline();
    await runner.drainNow();

    expect(submit.mock.calls.length).toBeGreaterThan(attemptsBefore);
  });

  it('a permanent rejection is reported and dropped, not retried forever', async () => {
    const store = memoryStore();
    const outbox = new Outbox(store, async (): Promise<SubmitResult> => ({
      kind: 'rejected',
      reason: 'rules version mismatch',
    }));
    await outbox.enqueue(commit);
    const clock = fakeEnv();
    const settled: string[][] = [];

    const runner = new OutboxRunner(outbox, clock.env, (r) => settled.push(r.rejected));
    await runner.drainNow();

    expect(settled[0]).toEqual(['rules version mismatch']);
    expect(store.items.size).toBe(0);
    // A duplicate or a rules mismatch will never succeed. Coming back for it
    // would leave the player watching "pending" for a verdict already reached.
    expect(clock.pending()).toBe(0);
  });

  it('never runs two drains at once, so a commit is not submitted twice', async () => {
    const store = memoryStore();
    let inFlight = 0;
    let overlapped = false;
    const outbox = new Outbox(store, async (): Promise<SubmitResult> => {
      inFlight += 1;
      if (inFlight > 1) overlapped = true;
      await Promise.resolve();
      inFlight -= 1;
      return { kind: 'retry' };
    });
    await outbox.enqueue(commit);
    const clock = fakeEnv();
    const runner = new OutboxRunner(outbox, clock.env);

    await Promise.all([runner.drainNow(), runner.drainNow(), runner.drainNow()]);

    expect(overlapped).toBe(false);
  });

  it('a store that cannot be read does not end the retry loop', async () => {
    // IndexedDB denied, a blocked origin, a private mode that throws on use.
    // Losing the player's one official run to a browser setting is not an
    // option; coming back for it is.
    const broken: OutboxStore = {
      all: async () => {
        throw new Error('site data blocked');
      },
      put: async () => {},
      remove: async () => {},
    };
    const clock = fakeEnv();
    const runner = new OutboxRunner(new Outbox(broken, async () => ({ kind: 'retry' })), clock.env);

    const result = await runner.drainNow();

    expect(result.retrying).toBe(1);
    expect(clock.pending()).toBe(1);
  });

  it('stop() ends the retries, so a torn-down page leaves no timer behind', async () => {
    const store = memoryStore();
    const outbox = new Outbox(store, async (): Promise<SubmitResult> => ({ kind: 'retry' }));
    await outbox.enqueue(commit);
    const clock = fakeEnv();
    const runner = new OutboxRunner(outbox, clock.env);

    runner.start();
    await runner.drainNow();
    runner.stop();

    expect(clock.pending()).toBe(0);
  });

  it('reports whether anything is still waiting, so the screen can say so', async () => {
    const store = memoryStore();
    const outbox = new Outbox(store, async (): Promise<SubmitResult> => ({ kind: 'retry' }));
    const clock = fakeEnv();
    const runner = new OutboxRunner(outbox, clock.env);

    expect(await runner.hasPending()).toBe(false);
    await outbox.enqueue(commit);
    expect(await runner.hasPending()).toBe(true);
  });
});
