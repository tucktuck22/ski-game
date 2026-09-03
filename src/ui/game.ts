/**
 * Drives one run: loop, input, render, and the terminal state.
 *
 * The commit decision does not live here — this reports what happened and the
 * caller decides whether it counts. That keeps the irreversible write in one
 * place (src/state/commit.ts) rather than scattered through the game view.
 */
import type { Course, RunInput, RunState, Scoring, Tuning } from '../sim/types.js';
import { derive, initialState, step, type DerivedTuning } from '../sim/step.js';
import { TAU } from '../sim/trig.js';
import { finalScore } from '../sim/scoring.js';
import { createStage, type Stage } from '../render/stage.js';
import { applyCrt, resetCrt } from '../render/filters/crt.js';
import { resolveMotion, type MotionSettings } from '../render/reducedMotion.js';
import { drawRun, resetSceneryCache } from '../render/draw.js';
import { LandingEffect } from '../render/landing.js';
import { startLoop, type LoopHandle } from '../render/loop.js';
import { InputSampler } from '../input/sample.js';
import { keyboardSource } from '../input/keyboard.js';
import { touchSource } from '../input/touch.js';
import type { RunKind } from '../state/runEconomy.js';
import type { TrickEvent } from './trickBadge.js';

export interface RunReport {
  outcome: 'finished' | 'wiped_out';
  score: number;
  state: RunState;
  kind: RunKind;
}

export class GameView {
  private stage: Stage;
  private loop: LoopHandle | null = null;
  private sampler: InputSampler;
  private derived: DerivedTuning;
  private state: RunState;
  private prevState: RunState;
  private finished = false;
  private readonly motion: MotionSettings;
  private readonly landing = new LandingEffect();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly course: Course,
    private readonly tuning: Tuning,
    private readonly scoring: Scoring,
    seed: number,
    private readonly kind: RunKind,
    private readonly onEnd: (r: RunReport) => void,
    /** Fired the moment a trick is paid, so the HUD can say so (FR-128). */
    private readonly onTrick: (t: TrickEvent) => void = () => {},
  ) {
    const motion = resolveMotion();
    this.motion = motion;
    resetCrt();
    resetSceneryCache();
    this.stage = createStage(canvas, (ctx, buffer) => applyCrt(ctx, buffer, motion));
    this.sampler = new InputSampler([keyboardSource(), touchSource(canvas)]);
    this.derived = derive(tuning);
    this.state = initialState(course, tuning, seed);
    this.prevState = this.state;
  }

  start(): void {
    this.loop = startLoop({
      isRunning: () => !this.finished,
      tick: () => this.tick(),
      render: () => this.render(),
    });
  }

  private tick(): void {
    const input: RunInput = this.sampler.sample();
    this.prevState = this.state;
    this.state = step(this.state, input, this.course, this.tuning, this.scoring, this.derived);

    // FR-111: the piste-to-shelf transition, read from two consecutive states
    // rather than from a field the simulation had to carry. Advanced on the
    // tick rather than the frame so the effect lasts the same wall-clock time
    // whatever the display refresh rate.
    this.landing.advance();
    if (this.prevState.ledge < 0 && this.state.ledge >= 0) {
      this.landing.trigger(performance.now(), this.motion);
    }

    // A trick is paid in the tick the skier lands: rotationAccum is converted to
    // score and cleared. Reading the transition here rather than adding a field
    // keeps the payout out of the simulation state, the same way the landing
    // flash does - and the points come from the score delta, so what the badge
    // says and what the player was paid cannot drift apart.
    if (this.prevState.rotationAccum > 0 && this.state.rotationAccum === 0 && this.state.grounded) {
      const points = this.state.score - this.prevState.score;
      if (points > 0) {
        this.onTrick({
          points,
          rotations: Math.floor(this.prevState.rotationAccum / TAU),
          multiplier: this.prevState.scoreMultiplier,
        });
      }
    }

    if (this.state.outcome !== 'running' && !this.finished) {
      this.finished = true;
      this.onEnd({
        outcome: this.state.outcome,
        score: finalScore(this.state, this.scoring),
        state: this.state,
        kind: this.kind,
      });
    }
  }

  private render(): void {
    // Interpolation reads the previous state; rendering never mutates either.
    drawRun(
      this.stage.ctx,
      this.state,
      this.course,
      this.tuning,
      this.motion,
      this.landing.shake(),
      this.landing.flashAlpha(),
    );
    this.stage.present();
  }

  get currentState(): RunState {
    return this.state;
  }

  get liveScore(): number {
    return finalScore(this.state, this.scoring);
  }

  /** The zone the skier is scoring in right now, for the HUD indicator (FR-129). */
  get liveMultiplier(): number {
    return this.state.scoreMultiplier;
  }

  destroy(): void {
    this.loop?.stop();
    this.sampler.destroy();
    this.stage.destroy();
  }
}
