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

/**
 * Turns anything throwable into readable text.
 *
 * `String(error)` gives "[object Object]" for a plain object, and Supabase
 * rejects with a PostgrestError - a plain object carrying message, code,
 * details and hint - not an Error. The first real failure this boundary caught
 * displayed "[object Object]", which told nobody anything and wasted a round
 * trip. Whatever arrives here is the only evidence anyone gets, so it has to
 * survive being an unusual shape.
 */
export function describeError(error: unknown): { message: string; detail: string } {
  if (error instanceof Error) {
    return { message: error.message, detail: error.stack ?? '' };
  }
  if (typeof error === 'string') return { message: error, detail: '' };

  if (error !== null && typeof error === 'object') {
    const o = error as Record<string, unknown>;
    const parts: string[] = [];
    // PostgrestError shape, and most API error objects.
    for (const key of [
      'message',
      'code',
      'details',
      'hint',
      'error',
      'error_description',
      'status',
    ]) {
      const v = o[key];
      if (typeof v === 'string' || typeof v === 'number') parts.push(`${key}: ${v}`);
    }
    if (parts.length > 0) {
      return { message: String(o['message'] ?? parts[0]), detail: parts.join('\n') };
    }
    try {
      return { message: JSON.stringify(error), detail: '' };
    } catch {
      return { message: Object.prototype.toString.call(error), detail: '' };
    }
  }
  return { message: String(error), detail: '' };
}

export function showFatalError(context: string, error: unknown): void {
  const { message, detail } = describeError(error);
  const stack = detail;

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
