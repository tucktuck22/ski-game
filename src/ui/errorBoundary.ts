/**
 * Renders startup failures on screen instead of leaving a blank page.
 *
 * A blank page is the worst failure this product can have. Nothing is on
 * screen, nothing is in the UI to explain it, and the only way to learn
 * anything is to open developer tools - which is not something you can ask
 * seven friends on a ski trip to do. It also cost several rounds of debugging
 * from the outside, because "blank" is the same symptom for a 404 asset, a
 * throw during module init, and a browser that denies storage.
 *
 * Any of those now produce a readable panel naming what failed.
 */
import { escapeHtml } from './leaderboard.js';

const PANEL_ID = 'fatal-error';

export function showFatalError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? error.stack : '';

  const host = document.getElementById('app') ?? document.body;
  // Never stack panels: the first failure is the useful one, later ones are
  // usually consequences of it.
  if (document.getElementById(PANEL_ID)) return;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'panel';
  panel.style.borderColor = 'var(--magenta)';
  panel.innerHTML = `
    <h2 class="sfx">WIPEOUT — BUT NOT THE FUN KIND</h2>
    <p class="subtitle">The game failed to start. This is a bug, not something you did.</p>
    <p><strong style="color:var(--yellow)">${escapeHtml(context)}</strong></p>
    <p style="color:var(--snow)">${escapeHtml(message)}</p>
    ${stack ? `<pre style="overflow-x:auto;font-size:11px;color:var(--cyan);max-height:180px">${escapeHtml(stack)}</pre>` : ''}
    <p style="color:var(--cyan);font-size:12px">
      Send this text to whoever set the draft up. Reloading is worth one try; if it
      says the same thing twice, it will keep saying it.
    </p>`;
  host.appendChild(panel);
}

/**
 * Catches failures that escape the initial await - a late import, an event
 * handler, a rejected promise - which would otherwise leave the page looking
 * fine but frozen.
 */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (e) => {
    showFatalError('Something broke while the game was running.', e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    showFatalError('A background task failed.', e.reason);
  });
}
