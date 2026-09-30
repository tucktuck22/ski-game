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

/** A gain whose ramps land at once, recording the last target it was sent to. */
class FakeParam {
  value = -1;
  ramps: number[] = [];
  cancelScheduledValues(): void {}
  setValueAtTime(v: number): void {
    this.value = v;
  }
  linearRampToValueAtTime(v: number): void {
    this.ramps.push(v);
    this.value = v;
  }
}

class FakeGain {
  gain = new FakeParam();
  connectedTo: unknown = null;
  connect(node: unknown): unknown {
    this.connectedTo = node;
    return node;
  }
}

class FakeAudioContext {
  static latest: FakeAudioContext | null = null;
  state: 'suspended' | 'running' = 'suspended';
  sampleRate = 48000;
  currentTime = 0;
  gains: FakeGain[] = [];
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
  suspendCalls = 0;
  suspend(): Promise<void> {
    this.suspendCalls++;
    this.state = 'suspended';
    return Promise.resolve();
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
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
    // One output node for everything, so leaving the page can fade it all (FR-160).
    const out = s.target?.destination as unknown as FakeGain;
    expect(out.connectedTo, 'the shared output never reaches the speaker').toBe(ctx().destination);
  });
});

/**
 * FR-159: the iPhone's Ring/Silent switch must not mute the game.
 *
 * iOS gives Web Audio the category the silent switch mutes, and an ordinary
 * <audio> element the one it does not. Found at the feature 010 play pass on
 * Chrome for iOS: silent on the board after DROP IN, then audible for the rest
 * of the session once a practice run's course music - an <audio> element - had
 * moved the page into playback. These fakes model both ways out.
 */
class FakeMediaElement {
  static made: FakeMediaElement[] = [];
  static refuse = false;
  played = 0;
  constructor(public src: string) {
    FakeMediaElement.made.push(this);
  }
  play(): Promise<void> {
    this.played++;
    return FakeMediaElement.refuse
      ? Promise.reject(new Error('NotAllowedError'))
      : Promise.resolve();
  }
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('Synth.start plays as media, so the silent switch cannot mute it (FR-159)', () => {
  beforeEach(() => {
    FakeMediaElement.made = [];
    FakeMediaElement.refuse = false;
  });

  it('sets the audio session to playback before the context exists (iOS 17+)', () => {
    const session = { type: 'auto' };
    let typeWhenContextMade = '';
    class RecordingContext extends FakeAudioContext {
      constructor() {
        super();
        typeWhenContextMade = session.type;
      }
    }
    vi.stubGlobal('AudioContext', RecordingContext);
    vi.stubGlobal('navigator', { audioSession: session });

    const s = new Synth();
    s.start();

    expect(session.type).toBe('playback');
    expect(typeWhenContextMade, 'the context was made before the session was set').toBe('playback');
    expect(s.running).toBe(true);
  });

  it('plays silence through a media element where there is no session API', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('Audio', FakeMediaElement);

    const s = new Synth();
    s.start();

    expect(FakeMediaElement.made, 'no media element was played in the gesture').toHaveLength(1);
    expect(FakeMediaElement.made[0]?.played).toBe(1);
    expect(FakeMediaElement.made[0]?.src).toMatch(/^data:audio\/wav;base64,/);
    // Not done until the element has actually played.
    expect(s.running, 'claimed done before the media element played').toBe(false);
    await settle();
    expect(s.running).toBe(true);
  });

  it('keeps trying when a gesture iOS does not count refuses the element', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('Audio', FakeMediaElement);
    FakeMediaElement.refuse = true;

    const s = new Synth();
    s.start(); // a touch's pointerdown: refused
    await settle();
    expect(s.running, 'the gate would unbind with the switch still muting').toBe(false);

    FakeMediaElement.refuse = false;
    s.start(); // the touchend that follows
    await settle();
    expect(FakeMediaElement.made).toHaveLength(2);
    expect(s.running).toBe(true);
  });

  it('plays the media element once, not on every later start', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('Audio', FakeMediaElement);

    const s = new Synth();
    s.start();
    await settle();
    s.start();
    s.start();
    expect(FakeMediaElement.made).toHaveLength(1);
  });
});

/**
 * FR-160: nothing plays while the player is out of the browser. Needed because
 * of FR-159: playing as media is what lets iOS keep a page sounding in the
 * background.
 */
describe('Synth.suspend silences everything while the page is away (FR-160)', () => {
  afterEach(() => vi.useRealTimers());

  const out = (s: Synth): FakeGain => s.target?.destination as unknown as FakeGain;

  /**
   * Suspending at once cut the output mid-waveform, which the iPhone played back
   * as a beep on leaving Chrome. The output must reach zero first.
   */
  it('fades the output to silence, then suspends', () => {
    vi.useFakeTimers();
    const s = new Synth();
    s.start();
    out(s).gain.value = 1;

    s.suspend();
    expect(out(s).gain.ramps, 'the output was not faded').toEqual([0]);
    expect(ctx().suspendCalls, 'suspended before the fade finished').toBe(0);

    vi.advanceTimersByTime(100);
    expect(ctx().suspendCalls).toBe(1);
    expect(ctx().state).toBe('suspended');
  });

  it('start() brings it back and fades the output in again', () => {
    vi.useFakeTimers();
    const s = new Synth();
    s.start();
    s.suspend();
    vi.advanceTimersByTime(100);

    s.start(); // the page is visible again (FR-157)
    expect(ctx().state).toBe('running');
    expect(out(s).gain.value, 'came back silent').toBe(1);
  });

  it('comes back audible even if it returns before the suspend landed', () => {
    vi.useFakeTimers();
    const s = new Synth();
    s.start();
    s.suspend();
    s.start(); // back within the fade

    vi.advanceTimersByTime(100);
    expect(ctx().suspendCalls, 'suspended a page that was already back').toBe(0);
    expect(out(s).gain.value).toBe(1);
  });

  it('does nothing before the first gesture, and suspends once when called twice', () => {
    vi.useFakeTimers();
    const s = new Synth();
    s.suspend(); // no context yet: must not create one (FR-054)
    expect(FakeAudioContext.latest).toBeNull();

    s.start();
    s.suspend();
    s.suspend();
    vi.advanceTimersByTime(100);
    expect(ctx().suspendCalls).toBe(1);
  });
});
