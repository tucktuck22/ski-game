/**
 * Runtime chiptune and synthwave synthesis.
 *
 * Style bible A-1 and FR-053: all audio is original by construction. Nothing is
 * sampled and nothing is licensed, because it is generated here from
 * oscillators. It also costs kilobytes rather than the megabytes an audio file
 * would take out of the 2 MB payload budget - and it is how the music of the
 * period was actually made.
 *
 * A-2 fixes the instrument set: two pulse leads, one triangle bass, one noise
 * percussion. That constraint is the sound.
 */
import { PALETTE } from '../render/palette.js';

const A_MINOR_PENTATONIC = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0];

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private loopTimer: number | null = null;
  private step = 0;
  private muted = false;

  /**
   * A-3 and FR-054: no AudioContext exists until a deliberate gesture. This is
   * both the style-bible rule and what browser autoplay policy requires, so the
   * correct behaviour and the compliant behaviour are the same thing.
   */
  start(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
    this.scheduleLoop();
  }

  get started(): boolean {
    return this.ctx !== null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.18;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private scheduleLoop(): void {
    if (!this.ctx) return;
    // 128 BPM sixteenths - period-appropriate and steady enough to ski to.
    this.loopTimer = window.setInterval(() => this.tick(), 117);
  }

  private tick(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const s = this.step++;

    if (s % 4 === 0) this.bass(t, 55 * (s % 16 === 8 ? 1.5 : 1));
    if (s % 2 === 0) this.noise(t, s % 8 === 4 ? 0.16 : 0.05);
    if (s % 3 === 0) {
      const note = A_MINOR_PENTATONIC[(s / 3) % A_MINOR_PENTATONIC.length | 0] as number;
      this.pulse(t, note, 0.09);
    }
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
      case 'launch': this.pulse(t, 660, 0.08); break;
      case 'land': this.noise(t, 0.12); break;
      case 'pickup': this.pulse(t, 880, 0.06); break;
      case 'wipeout':
        this.noise(t, 0.3);
        this.bass(t, 40);
        break;
    }
  }

  destroy(): void {
    if (this.loopTimer !== null) clearInterval(this.loopTimer);
    void this.ctx?.close();
    this.ctx = null;
  }
}

/** Exposed so the palette stays the single source of truth for the mute button. */
export const MUTE_COLOR = PALETTE.yellow;
