/**
 * Runtime synthesis of the sound effects.
 *
 * This class used to carry the music too, and its comment argued that all audio
 * should be synthesised: original by construction, kilobytes instead of the
 * megabytes an audio file costs, and how the music of the period was actually
 * made. Style-bible A-1 was written from that argument.
 *
 * Half of it was overturned on 2026-09-04. A-1 now permits an original recorded
 * MUSIC piece, which lives in music.ts; ADR-0009 records what changed and why.
 * The rest of the argument still holds here, and one part of it is load-bearing
 * for effects in a way it never was for music: a cue carries gameplay
 * information (A-4) and has to fire the instant the event happens, which a file
 * that has not finished downloading cannot do.
 *
 * So: every sound effect is synthesised, without exception. A-2 fixes the
 * instrument set - two pulse leads, one triangle bass, one noise percussion -
 * and that constraint is the sound.
 *
 * Nothing mechanical now stops a future change routing a cue through the music
 * loader instead. That gap is named in ADR-0009 rather than left to be
 * discovered.
 */
import { PALETTE } from '../render/palette.js';

/** Master level for the synthesised cues. */
const LEVEL = 0.18;

/**
 * A tenth of a second of silence as a WAV data URI: 8 kHz, mono, 8-bit, every
 * sample at the midpoint. Built here rather than shipped as a file, so it
 * cannot 404 and adds nothing to the payload.
 */
function silentWav(): string {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const tag = (at: number, text: string): void => {
    for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i);
  };
  tag(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true); // sample rate
  view.setUint32(28, 8000, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  tag(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** The Audio Session API: Safari and every iOS browser from iOS 17. */
interface AudioSessionNavigator {
  audioSession?: { type: string };
}

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  /** Whether the page is playing as media, so the silent switch cannot mute it. */
  private asMedia = false;

  /**
   * A-3 and FR-054: no AudioContext exists until a deliberate gesture. This is
   * both the style-bible rule and what browser autoplay policy requires, so the
   * correct behaviour and the compliant behaviour are the same thing.
   */
  start(): void {
    // Before the context exists, so it is created under the media category.
    this.playAsMedia();
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : LEVEL;
      this.master.connect(this.ctx.destination);
    }
    // WebKit hands back a SUSPENDED context even when it was created inside
    // the gesture handler. Without this the graph exists, nothing throws, and
    // nothing is ever audible. Chromium resumes it for us, which is exactly
    // why this was invisible in every test.
    //
    // This matters on every iOS browser, not just Safari. Apple requires all
    // of them to render with WebKit, so Chrome on an iPhone is a WebKit shell
    // and behaves the same way.
    //
    // Safe to call repeatedly: the gate does, until `running` is true.
    if (this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => undefined);
      this.unlock();
    }
  }

  /**
   * Open the audio hardware by playing one silent frame.
   *
   * `resume()` alone is frequently not enough on WebKit: the context reports
   * itself running and still produces no sound, because the audio route was
   * never actually opened. Starting a buffer source INSIDE the user gesture is
   * what opens it, and a one-frame silent buffer is the cheapest way to do
   * that - it costs nothing and is inaudible by construction.
   *
   * Every failure here is swallowed. This is best-effort unlocking, and a
   * browser that refuses must cost the player silence and nothing else
   * (FR-143).
   */
  private unlock(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // No unlock. The gate will try again on the next gesture.
    }
  }

  /**
   * FR-159: sound plays with the iPhone's Ring/Silent switch set to silent.
   *
   * iOS gives Web Audio the "ambient" audio category by default, the one the
   * silent switch mutes, while an ordinary <audio> element gets "playback",
   * which it does not. Every sound here is Web Audio except the course music.
   * So with the switch on silent the board was mute after DROP IN, and the
   * first practice run "fixed" it: the course music's <audio> element moved the
   * whole page to playback, and it stayed there. Reported at the feature 010
   * play pass on Chrome for iOS, which is WebKit like every iOS browser.
   *
   * This does on purpose, in the first gesture, what that run did by accident.
   * iOS 17 exposes the category directly. Older versions have no API for it,
   * so a moment of silence is played through an <audio> element instead. Its
   * play() can be refused on a gesture iOS does not count (a touch's
   * pointerdown), so `asMedia` is set only once it succeeds and the gate keeps
   * trying until then.
   *
   * A browser with neither has no silent-switch problem to solve. Every failure
   * is swallowed (FR-143).
   */
  private playAsMedia(): void {
    if (this.asMedia) return;
    const session = (globalThis.navigator as AudioSessionNavigator | undefined)?.audioSession;
    if (session) {
      try {
        session.type = 'playback';
        this.asMedia = true;
        return;
      } catch {
        // Fall through to the element.
      }
    }
    if (typeof Audio === 'undefined') {
      this.asMedia = true;
      return;
    }
    try {
      const el = new Audio(silentWav());
      void el.play().then(
        () => {
          this.asMedia = true;
        },
        () => undefined,
      );
    } catch {
      // No media element. The gate will try again on the next gesture.
    }
  }

  /**
   * FR-160: silence everything while the page is out of view.
   *
   * Suspending the one shared context stops every cue and the board music
   * together, and keeps the board music's place: resuming carries on from the
   * same instant. start() is what resumes it, on the way back (FR-157).
   *
   * Needed because of FR-159. Playing as media is what lets iOS keep the page
   * sounding in the background, so without this the music followed a player
   * out to the home screen.
   */
  suspend(): void {
    const ctx = this.ctx;
    if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
  }

  get started(): boolean {
    return this.ctx !== null;
  }

  /**
   * Whether audio can actually be HEARD, not merely whether it was set up.
   * The gate stays bound until this is true: a running context is not enough
   * while the silent switch can still mute it (FR-159).
   */
  get running(): boolean {
    return this.ctx?.state === 'running' && this.asMedia;
  }

  /**
   * The context and node the music player attaches to, or null before the first
   * gesture. Shared deliberately: a second AudioContext would be a second set of
   * hardware buffers for no gain, and the two would gate independently.
   */
  get target(): { context: AudioContext; destination: AudioNode } | null {
    return this.ctx && this.master
      ? { context: this.ctx, destination: this.ctx.destination }
      : null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : LEVEL;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private pulse(at: number, freq: number, dur: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /**
   * A crowd's roar from the noise voice (A-2): band-limited noise that swells and
   * dies over `dur` seconds, with a ragged edge of claps on top. Feature 009.
   */
  private swell(at: number, dur: number, level: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let low = 0;
    for (let i = 0; i < frames; i++) {
      const u = i / frames;
      // Rises fast, holds, falls away: a cheer, not a hiss.
      const env = Math.min(1, u * 8) * (1 - u) ** 1.5;
      // A one-pole low-pass takes the edge off white noise, so it reads as voices.
      low += 0.18 * (Math.random() * 2 - 1 - low);
      const clap = Math.random() < 0.0009 ? Math.random() * 0.8 : 0;
      data[i] = (low * 2.2 + clap) * env;
    }
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = level;
    src.connect(gain).connect(master);
    src.start(at);
  }

  private bass(at: number, freq: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.45, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + 0.24);
  }

  private noise(at: number, level: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const frames = Math.floor(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = level;
    src.connect(gain).connect(master);
    src.start(at);
  }

  /** A-4 / FR-058: every audio cue has a visible equivalent, so this is colour
   *  for the ear only - never the sole carrier of information. */
  cue(kind: 'launch' | 'land' | 'pickup' | 'wipeout' | 'finish'): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    switch (kind) {
      case 'launch':
        this.pulse(t, 660, 0.08);
        break;
      case 'land':
        this.noise(t, 0.12);
        break;
      case 'pickup':
        this.pulse(t, 880, 0.06);
        break;
      case 'wipeout':
        this.noise(t, 0.3);
        this.bass(t, 40);
        break;
      case 'finish':
        // Feature 009, FR-273: a rising three-note fanfare on the pulse lead,
        // and the crowd underneath it. The FINISH lettering and the crowd on
        // screen are its visible equivalent (A-4).
        this.pulse(t, 523, 0.12);
        this.pulse(t + 0.12, 659, 0.12);
        this.pulse(t + 0.24, 784, 0.32);
        this.bass(t + 0.24, 98);
        this.swell(t + 0.05, 2.2, 0.35);
        break;
    }
  }

  destroy(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

/** Exposed so the palette stays the single source of truth for the mute button. */
export const MUTE_COLOR = PALETTE.yellow;
