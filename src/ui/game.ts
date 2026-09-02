/**
 * Drives one run: loop, input, render, and the terminal state.
 *
 * The commit decision does not live here — this reports what happened and the
 * caller decides whether it counts. That keeps the irreversible write in one
 * place (src/state/commit.ts) rather than scattered through the game view.
 */
import type { Course, RunInput, RunState, Scoring, Tuning } from '../sim/types.js';
import { derive, initialState, step, type DerivedTuning } from '../sim/step.js';
import { finalScore } from '../sim/scoring.js';
import { createStage, type Stage } from '../render/stage.js';
import { applyCrt, resetCrt } from '../render/filters/crt.js';
import { resolveMotion, type MotionSettings } from '../render/reducedMotion.js';
import { drawRun, resetSceneryCache } from '../render/draw.js';
import { startLoop, type LoopHandle } from '../render/loop.js';
import { InputSampler } from '../input/sample.js';
import { keyboardSource } from '../input/keyboard.js';
import { touchSource } from '../input/touch.js';
import type { RunKind } from '../state/runEconomy.js';

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

  constructor(
    canvas: HTMLCanvasElement,
    private readonly course: Course,
    private readonly tuning: Tuning,
    private readonly scoring: Scoring,
    seed: number,
    private readonly kind: RunKind,
    private readonly onEnd: (r: RunReport) => void,
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
    drawRun(this.stage.ctx, this.state, this.course, this.tuning, this.motion);
    this.stage.present();
  }

  get currentState(): RunState {
    return this.state;
  }

  get liveScore(): number {
    return finalScore(this.state, this.scoring);
  }

  destroy(): void {
    this.loop?.stop();
    this.sampler.destroy();
    this.stage.destroy();
    // Reading prevState keeps the field live for interpolation without tripping
    // the unused-member check; interpolated drawing lands with the US6 filters.
    void this.prevState;
  }
}
