/**
 * The fixed-timestep loop.
 *
 * The simulation advances at exactly 60 Hz regardless of display refresh rate,
 * and rendering interpolates between the last two states. This is required by
 * the constitution's Technical Standards, by FR-025, and by FR-026 — and it is
 * what makes SC-006 achievable, since a 120 Hz desktop and a 60 Hz phone
 * advance the simulation identically and differ only in how often they draw.
 */
export const TICK_MS = 1000 / 60;

/** Cap on catch-up ticks per frame, so a background tab does not spiral. */
const MAX_CATCHUP_TICKS = 5;

export interface LoopHandle {
  stop(): void;
}

export function startLoop(opts: {
  tick: () => void;
  render: (alpha: number) => void;
  isRunning: () => boolean;
}): LoopHandle {
  let raf = 0;
  let last = performance.now();
  let accumulator = 0;
  let stopped = false;

  const frame = (now: number): void => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);

    let elapsed = now - last;
    last = now;
    // FR-027: a backgrounded tab must not advance the simulation unattended in
    // a way that alters the outcome. Clamping the delta means a tab that was
    // hidden for a minute resumes rather than fast-forwarding through the run.
    if (elapsed > TICK_MS * MAX_CATCHUP_TICKS) elapsed = TICK_MS;
    accumulator += elapsed;

    let ticks = 0;
    while (accumulator >= TICK_MS && ticks < MAX_CATCHUP_TICKS) {
      if (opts.isRunning()) opts.tick();
      accumulator -= TICK_MS;
      ticks++;
    }
    opts.render(accumulator / TICK_MS);
  };

  raf = requestAnimationFrame(frame);
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}
