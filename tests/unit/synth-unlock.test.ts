import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Synth } from '../../src/audio/synth.js';

/**
 * The Synth had no tests at all until this file, which is part of why the iOS
 * silence shipped: the class that owns the AudioContext was the one piece of
 * audio nothing exercised.
 *
 * The fake below is a WebKit-shaped context, not a Chromium-shaped one. It
 * starts SUSPENDED and stays that way unless resumed, because that is the
 * behaviour the deployed defect depended on. This matters on every iOS
 * browser: Apple requires them all to render with WebKit, so Chrome on an
 * iPhone is a WebKit shell and behaves identically.
 */

class FakeBufferSource {
  buffer: unknown = null;
  started = false;
  connectedTo: unknown = null;
  connect(node: unknown): unknown {
    this.connectedTo = node;
    return node;
  }
  start(): void {
    this.started = true;
  }
  stop(): void {}
  disconnect(): void {}
}

class FakeGain {
  gain = { value: -1 };
  connect(node: unknown): unknown {
    return node;
  }
}

class FakeAudioContext {
  static latest: FakeAudioContext | null = null;
  state: 'suspended' | 'running' = 'suspended';
  sampleRate = 48000;
  destination = { kind: 'destination' };
  resumeCalls = 0;
  sources: FakeBufferSource[] = [];
  buffers: Array<[number, number, number]> = [];
  /** Model a context that reports running but never actually opens the route. */
  refuseResume = false;

  constructor() {
    FakeAudioContext.latest = this;
  }
  resume(): Promise<void> {
    this.resumeCalls++;
    if (!this.refuseResume) this.state = 'running';
    return Promise.resolve();
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
  createBufferSource(): FakeBufferSource {
    const s = new FakeBufferSource();
    this.sources.push(s);
    return s;
  }
  createBuffer(channels: number, frames: number, rate: number): unknown {
    this.buffers.push([channels, frames, rate]);
    return { channels, frames, rate };
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

beforeEach(() => {
  FakeAudioContext.latest = null;
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => vi.unstubAllGlobals());

const ctx = (): FakeAudioContext => FakeAudioContext.latest as FakeAudioContext;

describe('Synth.start on a WebKit-shaped context', () => {
  it('creates nothing until it is started (FR-054)', () => {
    const s = new Synth();
    expect(s.started).toBe(false);
    expect(s.running).toBe(false);
    expect(FakeAudioContext.latest).toBeNull();
  });

  it('resumes a suspended context rather than assuming it started', () => {
    const s = new Synth();
    s.start();
    expect(ctx().resumeCalls, 'a suspended context was never resumed').toBeGreaterThan(0);
    expect(ctx().state).toBe('running');
    expect(s.running).toBe(true);
  });

  /**
   * The piece `resume()` alone does not buy. WebKit can report a context as
   * running while never having opened the audio route; starting a buffer inside
   * the gesture is what opens it.
   */
  it('plays one silent frame to open the audio route', () => {
    const s = new Synth();
    s.start();
    expect(ctx().buffers, 'no unlock buffer was created').toContainEqual([1, 1, 48000]);
    const unlock = ctx().sources[0];
    expect(unlock?.started, 'the unlock buffer was never started').toBe(true);
    expect(unlock?.connectedTo, 'the unlock buffer never reached the output').toBe(
      ctx().destination,
    );
  });

  it('keeps trying while the context refuses to run, and reports it is not running', () => {
    const s = new Synth();
    s.start();
    ctx().refuseResume = true;
    ctx().state = 'suspended';

    s.start();
    s.start();

    expect(s.running, 'claimed to be running while the context was suspended').toBe(false);
    expect(ctx().resumeCalls).toBeGreaterThan(2);
    // One unlock attempt per try: the gate calls start() until it works.
    expect(ctx().sources.length).toBeGreaterThan(2);
  });

  it('builds the graph once, however many times it is started', () => {
    const s = new Synth();
    s.start();
    const first = ctx();
    s.start();
    s.start();
    expect(FakeAudioContext.latest).toBe(first);
  });

  it('does not resume or unlock a context that is already running', () => {
    const s = new Synth();
    s.start();
    const before = { resumes: ctx().resumeCalls, sources: ctx().sources.length };
    s.start();
    expect(ctx().resumeCalls).toBe(before.resumes);
    expect(ctx().sources.length).toBe(before.sources);
  });

  it('honours a mute set before the graph existed', () => {
    const s = new Synth();
    s.setMuted(true);
    s.start();
    expect(s.isMuted).toBe(true);
  });

  it('exposes the context and output the music player attaches to', () => {
    const s = new Synth();
    expect(s.target).toBeNull();
    s.start();
    expect(s.target?.context).toBe(ctx());
    expect(s.target?.destination).toBe(ctx().destination);
  });
});
