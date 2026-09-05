/**
 * Drives one run: loop, input, render, and the terminal state.
 *
 * The commit decision does not live here — this reports what happened and the
 * caller decides whether it counts. That keeps the irreversible write in one
 * place (src/state/commit.ts) rather than scattered through the game view.
 */
import type { Course, RunInput, RunState, Scoring, Tuning } from '../sim/types.js';
import { derive, initialState, step, type DerivedTuning } from '../sim/step.js';
import { slopeAt } from '../sim/terrain.js';
import { TAU } from '../sim/trig.js';
import { finalScore } from '../sim/scoring.js';
import { createStage, type Stage } from '../render/stage.js';
import { applyCrt, resetCrt } from '../render/filters/crt.js';
import { resolveMotion, type MotionSettings } from '../render/reducedMotion.js';
import { drawRun, resetSceneryCache, type SkierSkin } from '../render/draw.js';
import { LeanState, PoseTimers, selectPose } from '../render/skierPose.js';
import type { SpriteSheets } from '../render/sprites.js';
import { LandingEffect } from '../render/landing.js';
import { DeathSequence } from '../render/death.js';
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
  private skipListener: (() => void) | null = null;
  private readonly landing = new LandingEffect();
  private readonly death = new DeathSequence();
  /**
   * Render-owned pose state (FR-164). Advanced on the tick alongside the
   * landing effect, for the same reason: a landing must last the same
   * wall-clock time on a 60 Hz phone and a 120 Hz desktop. Nothing here is a
   * simulation field and nothing here changes the state hash.
   */
  private readonly poseTimers = new PoseTimers();
  private readonly lean = new LeanState();
  private resolveFinale: () => void = () => {};
  /**
   * Resolves when the mountain is finished being looked at.
   *
   * The caller commits the run the moment it ends and awaits this only to know
   * when to change the screen, so a wipeout holds the frame without holding the
   * score (feature 001's FR-020).
   */
  readonly finale: Promise<void>;

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
    /** Fired once when a run ends in a wipeout, so the caller can letter it. */
    private readonly onDeath: () => void = () => {},
    /**
     * The loaded sprite sheets, or null where none were supplied.
     *
     * Optional by design: a run must never depend on decoration having arrived
     * (FR-172), so every path that cannot produce sheets simply passes nothing
     * and gets the primitive renderer.
     */
    private readonly sheets: SpriteSheets | null = null,
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
    this.finale = new Promise<void>((resolve) => {
      this.resolveFinale = resolve;
    });
  }

  start(): void {
    this.loop = startLoop({
      // The loop outlives the simulation. Once the run has ended the tick stops
      // advancing state and only drives the wipeout's timing, which is what
      // keeps the frame on the mountain instead of cutting away from it.
      isRunning: () => !this.finished,
      tick: () => this.tick(),
      render: () => {
        if (this.finished) {
          this.death.advance();
          if (this.death.done) this.resolveFinale();
        }
        this.render();
      },
    });
  }

  /**
   * Any input during the wipeout cuts it short.
   *
   * The beat is for the first few runs. By the twentieth it is a wait, and a
   * player who is already reaching for the keyboard has said as much.
   */
  private armSkip(): void {
    const skip = (): void => {
      this.death.skip();
      this.resolveFinale();
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
    this.skipListener = skip;
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
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

    // Landing compression, the launch extension and the crouch latch, all
    // derived from the two states either side of this tick rather than from a
    // field the simulation had to carry (FR-164, FR-168).
    this.poseTimers.advance(this.prevState, this.state);
    this.lean.update(slopeAt(this.course.terrain, this.state.x));

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
      if (this.state.outcome === 'wiped_out') {
        this.death.start(this.motion);
        this.onDeath();
        this.armSkip();
      } else {
        this.resolveFinale();
      }
      this.onEnd({
        outcome: this.state.outcome,
        score: finalScore(this.state, this.scoring),
        state: this.state,
        kind: this.kind,
      });
    }
  }

  /**
   * The pose to draw this frame, or null when there is no sheet to draw it
   * from. Recomputed per frame rather than cached: it is a switch over a
   * handful of fields and caching it would mean a second place for the pose to
   * be wrong.
   */
  private skin(): SkierSkin | null {
    if (this.sheets === null) return null;
    return {
      sheets: this.sheets,
      pose: selectPose(this.state, this.poseTimers, this.lean.bucket),
      tick: this.state.tick,
    };
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
      this.death.tumble(),
      this.skin(),
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
    if (this.skipListener) {
      window.removeEventListener('keydown', this.skipListener);
      window.removeEventListener('pointerdown', this.skipListener);
      this.skipListener = null;
    }
    // Nothing may be left waiting on a view that has been torn down.
    this.resolveFinale();
  }
}
