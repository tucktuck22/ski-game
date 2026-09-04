/**
 * Keeps draining the outbox until nothing is left in it.
 *
 * FR-046 requires a commit that cannot reach shared storage to be "queued
 * locally and retried until confirmed". The queue existed and the retry did
 * not: `drain()` was called exactly once, immediately after the enqueue, and if
 * that attempt came back `retry` the score sat there for the rest of the
 * session. `backoffFor` was written, exported and unit-tested, and no caller
 * ever used it. The screen meanwhile said the score would post as soon as the
 * player had a signal, which nothing was watching for.
 *
 * This is the part that watches. It is a unit rather than a few lines inside
 * main.ts for the reason src/audio/gate.ts is: a retry loop that is not a unit
 * cannot have a unit test, and a retry loop nobody tests is one that quietly
 * stops retrying.
 *
 * IT STILL DECIDES NOTHING. Like the outbox under it, this is transport. It
 * never reads run counts, claims or standings, and FR-021 keeps deciding those
 * from shared storage.
 */
import { Outbox, backoffFor, type PendingCommit } from './outbox.js';

export interface DrainSummary {
  confirmed: number;
  rejected: string[];
  retrying: number;
}

/**
 * The timer and connectivity surface, injected so the runner can be tested
 * without waiting out a real 60-second backoff.
 */
export interface RunnerEnvironment {
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** Subscribes to "the network came back". Returns an unsubscribe. */
  onOnline(fn: () => void): () => void;
}

export const browserEnvironment = (w: Window): RunnerEnvironment => ({
  setTimer: (fn, ms) => w.setTimeout(fn, ms),
  clearTimer: (h) => {
    w.clearTimeout(h as number);
  },
  onOnline: (fn) => {
    w.addEventListener('online', fn);
    return () => {
      w.removeEventListener('online', fn);
    };
  },
});

export class OutboxRunner {
  private timer: unknown = null;
  private unbindOnline: (() => void) | null = null;
  /** One drain at a time. Two in flight would submit the same commit twice. */
  private inFlight: Promise<DrainSummary> | null = null;
  private stopped = false;

  constructor(
    private readonly outbox: Outbox,
    private readonly env: RunnerEnvironment,
    /** Fired after every pass, so the screen can stop saying "pending". */
    private readonly onSettled: (s: DrainSummary) => void = () => {},
  ) {}

  /**
   * Begins draining, and keeps at it.
   *
   * Called once shared storage is reachable. The first pass is what delivers a
   * commit queued in a PREVIOUS session: with the queue in IndexedDB (FR-048),
   * a score taken on a dead connection and then reloaded is submitted here,
   * which is the whole point of persisting it.
   */
  start(): void {
    this.stopped = false;
    this.unbindOnline ??= this.env.onOnline(() => {
      // The signal is back. Do not wait out a backoff that was sized for an
      // outage which has just ended.
      void this.drainNow();
    });
    void this.drainNow();
  }

  /** Drains once, now, and schedules the next attempt if anything is left. */
  async drainNow(): Promise<DrainSummary> {
    if (this.inFlight) return this.inFlight;
    this.cancelTimer();

    const pass = (async (): Promise<DrainSummary> => {
      try {
        const result = await this.outbox.drain();
        if (result.retrying > 0) await this.scheduleRetry();
        this.onSettled(result);
        return result;
      } catch {
        // A store that cannot even be read - IndexedDB denied, a blocked
        // origin - must not end the retry loop. Treat it as one failed pass and
        // come back, rather than losing the score to a browser setting.
        const result: DrainSummary = { confirmed: 0, rejected: [], retrying: 1 };
        await this.scheduleRetry();
        this.onSettled(result);
        return result;
      } finally {
        this.inFlight = null;
      }
    })();

    this.inFlight = pass;
    return pass;
  }

  /** True while a commit is still waiting to be confirmed. */
  async hasPending(): Promise<boolean> {
    try {
      return (await this.outbox.pending()).length > 0;
    } catch {
      return false;
    }
  }

  stop(): void {
    this.stopped = true;
    this.cancelTimer();
    this.unbindOnline?.();
    this.unbindOnline = null;
  }

  /**
   * Next attempt, paced by the LEAST-tried item still queued.
   *
   * Pacing by the most-tried one would punish a commit that had just arrived
   * for the age of one that has been failing all afternoon. In practice there
   * is only ever one item - a player has exactly one official run - so this
   * matters only in that it cannot get the common case wrong.
   */
  private async scheduleRetry(): Promise<void> {
    if (this.stopped) return;
    let attempts = 0;
    try {
      const items: PendingCommit[] = await this.outbox.pending();
      if (items.length === 0) return;
      // `attempts` counts tries ALREADY made - drain() increments it before we
      // get here - so the wait after the first failure is backoffFor(0), the
      // first entry in the table, rather than the second.
      attempts = Math.max(0, Math.min(...items.map((i) => i.attempts)) - 1);
    } catch {
      // Could not read the queue. Come back at the base delay rather than not
      // at all.
    }
    this.cancelTimer();
    this.timer = this.env.setTimer(() => {
      this.timer = null;
      void this.drainNow();
    }, backoffFor(attempts));
  }

  private cancelTimer(): void {
    if (this.timer === null) return;
    this.env.clearTimer(this.timer);
    this.timer = null;
  }
}
