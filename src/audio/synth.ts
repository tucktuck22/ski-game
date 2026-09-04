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

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  /**
   * A-3 and FR-054: no AudioContext exists until a deliberate gesture. This is
   * both the style-bible rule and what browser autoplay policy requires, so the
   * correct behaviour and the compliant behaviour are the same thing.
   */
  start(): void {
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

  get started(): boolean {
    return this.ctx !== null;
  }

  /**
   * Whether audio can actually be HEARD, not merely whether it was set up.
   * The gate stays bound until this is true.
   */
  get running(): boolean {
    return this.ctx?.state === 'running';
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
  cue(kind: 'launch' | 'land' | 'pickup' | 'wipeout'): void {
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
