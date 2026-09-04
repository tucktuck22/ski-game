import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MusicPlayer, trackUrl } from '../../src/audio/music.js';
import { parseAudio } from '../../src/data/load.js';
import audioJson from '../../data/audio.json';

/**
 * The environment is 'node', so neither HTMLAudioElement nor Web Audio exists. Both
 * are faked here rather than pulled in: what is being tested is the state machine and
 * the failure semantics in contracts/audio.md, not the browser's decoder.
 *
 * The guarantees under test are G1, G2, G5, G6 and G7. G3's loop flags are asserted
 * structurally; G4 (a gapless join) is audible only and belongs to T047.
 */

const manifest = parseAudio(audioJson);
const BASE = '/ski-game/';

// ---- fakes ------------------------------------------------------------------

class FakeAudioElement {
  static instances: FakeAudioElement[] = [];
  src: string;
  loop = false;
  preload = '';
  volume = 1;
  muted = false;
  currentTime = 0;
  playing = false;
  playCalls = 0;
  pauseCalls = 0;
  /** Set to make play() reject, as autoplay policy does. */
  refusePlay = false;

  constructor(src: string) {
    this.src = src;
    FakeAudioElement.instances.push(this);
  }
  play(): Promise<void> {
    this.playCalls++;
    if (this.refusePlay) return Promise.reject(new Error('NotAllowedError'));
    this.playing = true;
    return Promise.resolve();
  }
  pause(): void {
    this.pauseCalls++;
    this.playing = false;
  }
}

class FakeSource {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  started = false;
  stopped = false;
  connectedTo: unknown = null;
  start(): void {
    this.started = true;
  }
  stop(): void {
    if (this.stopped) throw new Error('already stopped');
    this.stopped = true;
  }
  disconnect(): void {}
  connect(node: unknown): unknown {
    this.connectedTo = node;
    return node;
  }
}

class FakeGain {
  gain = { value: 1 };
  connect(node: unknown): unknown {
    return node;
  }
}

class FakeContext {
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  decodeCalls = 0;
  failDecode = false;
  destination = { kind: 'destination' };
  /** iOS hands back a suspended context even inside the gesture handler. */
  state: 'suspended' | 'running' = 'running';
  resumeCalls = 0;
  /** Set true to model a context that refuses to resume on the first ask. */
  stayStuck = false;
  resume(): Promise<void> {
    this.resumeCalls++;
    if (!this.stayStuck) this.state = 'running';
    return Promise.resolve();
  }
  createBufferSource(): FakeSource {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  decodeAudioData(): Promise<unknown> {
    this.decodeCalls++;
    if (this.failDecode) return Promise.reject(new Error('EncodingError'));
    return Promise.resolve({ duration: 87.792 });
  }
}

let ctx: FakeContext;

const target = (): { context: never; destination: never } =>
  ({ context: ctx, destination: ctx.destination }) as never;

/** Lets the fetch/decode promise chain inside playDecoded settle. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

const fetchOk = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    ),
  );
};

beforeEach(() => {
  ctx = new FakeContext();
  FakeAudioElement.instances = [];
  vi.stubGlobal('Audio', FakeAudioElement);
  fetchOk();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const front = (): FakeSource | undefined => ctx.sources[ctx.sources.length - 1];
const element = (): FakeAudioElement | undefined =>
  FakeAudioElement.instances[FakeAudioElement.instances.length - 1];

// ---- G1: silent until armed --------------------------------------------------

describe('G1 — nothing is audible before the first gesture (FR-140, A-3)', () => {
  it('creates no source and fetches nothing before arm()', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.setContext('frontEnd');
    await settle();
    expect(ctx.sources).toHaveLength(0);
    expect(FakeAudioElement.instances).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('honours a context set before arming, once the gesture arrives', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.setContext('frontEnd');
    p.arm(target());
    await settle();
    expect(front()?.started).toBe(true);
  });

  it('ignores a second arm()', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.setContext('frontEnd');
    p.arm(target());
    await settle();
    p.arm(target());
    await settle();
    expect(ctx.sources).toHaveLength(1);
  });
});

// ---- URL construction: research.md R5 ---------------------------------------

describe('the production base path is applied in exactly one place (R5)', () => {
  it('builds a URL under the base, never relative to the current directory', () => {
    const t = manifest.tracks.find((x) => x.context === 'frontEnd');
    expect(trackUrl('/ski-game/', t!)).toBe('/ski-game/audio/look-out-below.mp3');
    expect(trackUrl('/', t!)).toBe('/audio/look-out-below.mp3');
  });

  it('fetches the front-end piece from under the base', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    expect(fetch).toHaveBeenCalledWith('/ski-game/audio/look-out-below.mp3');
  });

  it('points the course element at a URL under the base', () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('course');
    expect(element()?.src).toBe('/ski-game/audio/powder-rush.mp3');
  });
});

// ---- G3: loops forever -------------------------------------------------------

describe('G3 — both pieces loop, indefinitely (FR-137)', () => {
  it('loops the front-end piece between the measured offsets, not edge to edge', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    const s = front();
    expect(s?.loop).toBe(true);
    // SC-040: the shipped encode opens with 0.666 s of silence and ends with 0.825 s.
    // An edge-to-edge loop would drop ~1.5 s of dead air into every lap.
    expect(s?.loopStart).toBeGreaterThan(0);
    expect(s?.loopEnd).toBeLessThan(87.792);
  });

  it('never sets loopEnd past the buffer, whatever the manifest says', async () => {
    const short = { tracks: [{ ...manifest.tracks[0]!, loopEnd: 9999 }, manifest.tracks[1]!] };
    const p = new MusicPlayer(short, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    expect(front()?.loopEnd).toBe(87.792);
  });

  it('loops the course piece', () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('course');
    expect(element()?.loop).toBe(true);
  });
});

// ---- G2 / G5: exactly one piece, and context is sticky -----------------------

describe('G2 — exactly one piece is audible (FR-138)', () => {
  it('stops the front-end piece before starting the course piece', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    const buffered = front()!;
    p.setContext('course');
    expect(buffered.stopped).toBe(true);
    expect(element()?.playing).toBe(true);
  });

  it('stops the course piece before returning to the front-end piece', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('course');
    const el = element()!;
    p.setContext('frontEnd');
    await settle();
    expect(el.playing).toBe(false);
    expect(el.pauseCalls).toBe(1);
    expect(front()?.started).toBe(true);
  });

  // A slow first fetch that lands after the player has already entered a run must
  // not start a second piece over the top of the first.
  it('does not start a late-arriving piece if the context has moved on', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    p.setContext('course');
    await settle();
    expect(ctx.sources).toHaveLength(0);
    expect(element()?.playing).toBe(true);
  });
});

describe('G5 — re-entering the current context changes nothing (FR-139)', () => {
  it('does not restart the front-end piece when a screen changes', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    const s = front()!;
    // The board -> confirmation -> board journey, ten times over (SC-042).
    for (let i = 0; i < 10; i++) p.setContext('frontEnd');
    await settle();
    expect(ctx.sources).toHaveLength(1);
    expect(s.stopped).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('restarts the course piece on a second run (US2 scenario 5)', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('course');
    const el = element()!;
    p.setContext('frontEnd');
    await settle();
    p.setContext('course');
    expect(el.currentTime).toBe(0);
    expect(el.playCalls).toBe(2);
    // Reused rather than rebuilt: one element, not one per run.
    expect(FakeAudioElement.instances).toHaveLength(1);
  });

  it('reuses the decoded buffer rather than re-fetching on return from a run', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    p.setContext('course');
    p.setContext('frontEnd');
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(ctx.decodeCalls).toBe(1);
    expect(ctx.sources).toHaveLength(2);
  });
});

// ---- G6: failure is silence --------------------------------------------------

describe('G6 — every failure resolves to silence, never an error (FR-143)', () => {
  it('survives a refused play(), which is what autoplay policy does', () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    FakeAudioElement.prototype.refusePlay = true;
    expect(() => p.setContext('course')).not.toThrow();
    FakeAudioElement.prototype.refusePlay = false;
  });

  it('survives a 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }),
      ),
    );
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    expect(ctx.sources).toHaveLength(0);
  });

  it('survives a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Failed to fetch'))),
    );
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    expect(ctx.sources).toHaveLength(0);
  });

  it('survives a decode failure', async () => {
    ctx.failDecode = true;
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    expect(ctx.sources).toHaveLength(0);
  });

  it('retries nothing after a failure, so a dead URL cannot become a request storm', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Failed to fetch'))),
    );
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    p.setContext('course');
    p.setContext('frontEnd');
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does nothing at all when the manifest has no track for a context', () => {
    const only = { tracks: [manifest.tracks.find((t) => t.context === 'course')!] };
    const p = new MusicPlayer(only, BASE);
    p.arm(target());
    expect(() => p.setContext('frontEnd')).not.toThrow();
    expect(ctx.sources).toHaveLength(0);
  });

  it('destroys safely twice, and from any state', async () => {
    const p = new MusicPlayer(manifest, BASE);
    expect(() => p.destroy()).not.toThrow();
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    expect(() => p.destroy()).not.toThrow();
    expect(() => p.destroy()).not.toThrow();
  });
});

// ---- G7: mute ----------------------------------------------------------------

describe('G7 — mute is total, and resumes rather than restarts (SC-047)', () => {
  it('silences the decoded piece without stopping it', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    const s = front()!;
    const gain = ctx.gains[ctx.gains.length - 1]!;
    p.setMuted(true);
    expect(gain.gain.value).toBe(0);
    // Resumes rather than restarts: the source is still the one that was playing.
    expect(s.stopped).toBe(false);
    p.setMuted(false);
    expect(gain.gain.value).toBeCloseTo(manifest.tracks[0]!.gain);
    expect(ctx.sources).toHaveLength(1);
  });

  it('silences the streamed piece without restarting it', () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('course');
    const el = element()!;
    p.setMuted(true);
    expect(el.muted).toBe(true);
    expect(el.pauseCalls).toBe(0);
    p.setMuted(false);
    expect(el.muted).toBe(false);
    expect(el.playCalls).toBe(1);
  });

  it('starts silent when muted before the piece begins', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.setMuted(true);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    expect(ctx.gains[0]?.gain.value).toBe(0);
    p.setContext('course');
    expect(element()?.muted).toBe(true);
  });

  it('reports its own state', () => {
    const p = new MusicPlayer(manifest, BASE);
    expect(p.isMuted).toBe(false);
    p.setMuted(true);
    expect(p.isMuted).toBe(true);
  });
});

// ---- the iOS regression -----------------------------------------------------

/**
 * Chromium resumes a context created inside a gesture on its own. Safari on iOS
 * does not: the graph builds, nothing throws, and nothing is ever audible. That
 * shipped, and every test here passed while it did — because the fake context
 * above used to be permanently 'running'.
 */
describe('a suspended context is resumed, not assumed (iOS)', () => {
  it('resumes on arm', async () => {
    ctx.state = 'suspended';
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    await settle();
    expect(ctx.resumeCalls, 'a suspended context was never resumed').toBeGreaterThan(0);
    expect(ctx.state).toBe('running');
  });

  it('does not resume a context that is already running', () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    expect(ctx.resumeCalls).toBe(0);
  });

  it('lets a second gesture finish what the first could not', async () => {
    ctx.state = 'suspended';
    ctx.stayStuck = true;
    const p = new MusicPlayer(manifest, BASE);
    p.setContext('frontEnd');

    // First gesture: resumed, refused, nothing audible.
    p.arm(target());
    await settle();
    const afterFirst = ctx.resumeCalls;
    expect(afterFirst).toBeGreaterThan(0);

    // Second gesture must try again rather than short-circuit on `armed`.
    ctx.stayStuck = false;
    p.arm(target());
    await settle();
    expect(ctx.resumeCalls, 'arming twice did nothing the second time').toBeGreaterThan(afterFirst);
    expect(ctx.state).toBe('running');
  });

  it('does not start a second source when armed again while already sounding', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();
    expect(ctx.sources).toHaveLength(1);

    p.arm(target());
    p.arm(target());
    await settle();
    expect(ctx.sources, 'arming again started the piece over the top of itself').toHaveLength(1);
  });

  it('resume() picks the music back up after the page was backgrounded', async () => {
    const p = new MusicPlayer(manifest, BASE);
    p.arm(target());
    p.setContext('frontEnd');
    await settle();

    // iOS suspends the context while the page is away.
    ctx.state = 'suspended';
    p.resume();
    await settle();
    expect(ctx.resumeCalls).toBeGreaterThan(0);
    expect(ctx.state).toBe('running');
  });

  it('resume() does nothing before the player has ever been armed', () => {
    const p = new MusicPlayer(manifest, BASE);
    ctx.state = 'suspended';
    p.resume();
    expect(ctx.resumeCalls).toBe(0);
  });
});
