/**
 * The two music tracks and the rule for which one is audible.
 *
 * Style-bible A-1 permitted no sampled audio of any kind until 2026-09-04. It now
 * permits original recorded MUSIC while keeping every sound effect synthesised - see
 * ADR-0009 for why that line is where it is. Sound effects stay in synth.ts.
 *
 * Two playback mechanisms, chosen per piece rather than for symmetry. The reason is
 * one measurement (research.md R1): the longest possible official run is 76.9 s and
 * Powder Rush is 220.1 s, so the course piece can never reach its loop point.
 *
 *   Look Out Below  decoded AudioBuffer, looped between measured offsets.
 *                   It plays on the board while people read the standings, so its
 *                   join is heard constantly and must be gapless (SC-040). The
 *                   shipped encode opens with 0.67 s of silence and ends with
 *                   0.83 s, so an edge-to-edge loop would drop ~1.5 s of dead air
 *                   into every lap. Costs ~16.9 MB of decoded audio.
 *
 *   Powder Rush     streamed HTMLAudioElement, loop = true.
 *                   Its join is unreachable, so gaplessness buys nothing. Streaming
 *                   costs almost no memory, which matters most during a run when the
 *                   frame budget is tightest. Decoding it too would put 59.2 MB
 *                   against a 150 MB heap ceiling for a seam nobody hears.
 *
 * FR-143 is the rule that shapes every method here: music is the first thing to give
 * up and the run is never the thing that breaks. Every operation returns void and
 * cannot throw. A caller that needs to know whether music is playing has a design
 * problem - see contracts/audio.md.
 */
import type { AudioManifest, MusicTrack, PlaybackContext } from '../data/load.js';

/**
 * The single place the production base path is applied (research.md R5).
 *
 * `base` is '/ski-game/' in production and '/' in dev. A relative path already
 * shipped a blank page to players from this repository, and audio 404s SILENTLY -
 * there is no blank page to notice it. The manifest therefore stores bare filenames
 * and this is the only construction of a URL from one.
 */
export function trackUrl(base: string, track: MusicTrack): string {
  return `${base}audio/${track.file}`;
}

/** Just enough of the Web Audio surface to be faked in a test. */
interface AudioTarget {
  readonly context: BaseAudioContext & { resume?: () => Promise<void> };
  readonly destination: AudioNode;
}

export class MusicPlayer {
  private readonly byContext = new Map<PlaybackContext, MusicTrack>();
  private readonly base: string;

  private armed = false;
  private muted = false;
  private context: PlaybackContext | null = null;

  /** The streamed piece. Created lazily, on the first run, then reused. */
  private element: HTMLAudioElement | null = null;
  private elementTrack: MusicTrack | null = null;

  /** The decoded piece. */
  private target: AudioTarget | null = null;
  private buffer: AudioBuffer | null = null;
  private bufferTrack: MusicTrack | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private decoding = false;

  constructor(manifest: AudioManifest, base: string) {
    for (const t of manifest.tracks) this.byContext.set(t.context, t);
    this.base = base;
  }

  /**
   * FR-140 and style-bible A-3: nothing is audible until a deliberate gesture. Called
   * from the same handler that starts the Synth, never a second listener of its own -
   * two gates drift apart.
   *
   * `target` carries the AudioContext the Synth already created. A second context
   * would be a second set of hardware buffers for no gain.
   */
  arm(target: AudioTarget): void {
    this.armed = true;
    this.target = target;
    this.ensureRunning();
    // A context set before arming is honoured now rather than dropped, so the caller
    // may set it during boot without ordering against the first gesture.
    //
    // Safe to call more than once, and the gate does exactly that: on iOS the
    // first gesture can leave the context suspended, and a later gesture has to
    // be able to finish the job. Nothing restarts if a piece is already going.
    if (this.context !== null && !this.sounding) this.play(this.context);
  }

  /** Whether a source is currently attached and not paused. */
  private get sounding(): boolean {
    if (this.source) return true;
    return this.element !== null && !this.element.paused;
  }

  /**
   * Resume a suspended context.
   *
   * Safari on iOS suspends the context when the page is backgrounded, and hands
   * back a suspended one at construction, so this runs before every start
   * rather than once at arm time. A source started on a suspended context is
   * silent until it resumes - a failure with no error attached to it.
   */
  private ensureRunning(): void {
    const ctx = this.target?.context;
    if (ctx && ctx.state !== 'running') void ctx.resume?.().catch(() => undefined);
  }

  /**
   * FR-138: exactly one piece audible. FR-139: re-entering the current context does
   * nothing, so moving between screens that are all outside a run never restarts the
   * music.
   */
  setContext(context: PlaybackContext): void {
    if (this.context === context) return;
    this.context = context;
    if (!this.armed) return;
    this.stopAll();
    this.play(context);
  }

  /**
   * SC-047. Silences music and resumes it where it was, rather than restarting.
   * Session-scoped: the preference does not survive a reload, a known deviation from
   * FR-054 and style-bible A-3 recorded in the feature's spec.
   */
  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    if (this.element) this.element.muted = muted;
    if (this.gain && this.bufferTrack) {
      this.gain.gain.value = muted ? 0 : this.bufferTrack.gain;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Called when the page comes back into view; iOS suspends audio meanwhile. */
  resume(): void {
    if (!this.armed) return;
    this.ensureRunning();
    if (this.context !== null && !this.sounding) this.play(this.context);
  }

  destroy(): void {
    this.stopAll();
    this.element = null;
    this.elementTrack = null;
    this.buffer = null;
    this.bufferTrack = null;
    this.target = null;
    this.armed = false;
    this.context = null;
  }

  // ---- internals -------------------------------------------------------------

  private play(context: PlaybackContext): void {
    const track = this.byContext.get(context);
    if (!track) return;
    this.ensureRunning();
    // The decoded path is for the piece that carries loop offsets, which is the
    // piece whose join is actually heard. The manifest decides, not this class.
    if (track.loopStart !== undefined) this.playDecoded(track);
    else this.playStreamed(track);
  }

  /**
   * FR-138 again, structurally: every start path goes through here first, so two
   * sources cannot be audible at once even if a caller does something unexpected.
   */
  private stopAll(): void {
    if (this.source) {
      // A stopped source is single-use; the next start builds a new one.
      try {
        this.source.stop();
      } catch {
        // Already stopped. Nothing here may throw (FR-143).
      }
      this.source.disconnect();
      this.source = null;
    }
    if (this.element) {
      this.element.pause();
      this.element.currentTime = 0;
    }
  }

  private playStreamed(track: MusicTrack): void {
    if (this.elementTrack !== track) {
      const el = new Audio(trackUrl(this.base, track));
      el.loop = true; // FR-137
      el.preload = 'auto';
      el.volume = track.gain;
      this.element = el;
      this.elementTrack = track;
    }
    const el = this.element;
    if (!el) return;
    el.muted = this.muted;
    // FR-143: play() rejects when autoplay policy refuses, and an unhandled rejection
    // would reach installGlobalErrorHandlers() and put an error boundary over a
    // working game because the music did not start.
    void el.play().catch(() => {
      /* No music. The run is unaffected. */
    });
  }

  private playDecoded(track: MusicTrack): void {
    if (this.buffer && this.bufferTrack === track) {
      this.startBuffer(track, this.buffer);
      return;
    }
    if (this.decoding) return;
    this.decoding = true;
    void this.load(track)
      .then((buffer) => {
        this.decoding = false;
        if (!buffer) return;
        this.buffer = buffer;
        this.bufferTrack = track;
        // The player may have moved on to a run while this was in flight. FR-138:
        // arriving late must not start a second piece over the top of the first.
        if (this.context === track.context) this.startBuffer(track, buffer);
      })
      .catch(() => {
        this.decoding = false;
        /* No music. */
      });
  }

  private async load(track: MusicTrack): Promise<AudioBuffer | null> {
    const target = this.target;
    if (!target) return null;
    try {
      const response = await fetch(trackUrl(this.base, track));
      if (!response.ok) return null; // A 404 is silence, not an error (FR-143).
      return await target.context.decodeAudioData(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  private startBuffer(track: MusicTrack, buffer: AudioBuffer): void {
    const target = this.target;
    if (!target) return;
    const source = target.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true; // FR-137
    // SC-040: loop inside the silence rather than edge to edge. Playback still
    // starts at 0, so the intro is heard once and every lap after is seamless.
    source.loopStart = track.loopStart ?? 0;
    source.loopEnd = Math.min(track.loopEnd ?? buffer.duration, buffer.duration);

    const gain = target.context.createGain();
    gain.gain.value = this.muted ? 0 : track.gain;
    source.connect(gain).connect(target.destination);
    source.start();

    this.source = source;
    this.gain = gain;
  }
}
