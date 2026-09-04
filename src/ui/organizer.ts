/**
 * Organizer controls. Reachable only from the organizer URL (FR-006).
 *
 * The one that matters is removal of a COMMITTED entry (FR-074). Self-serve
 * roster creation means an entry may belong to somebody who is not on the trip,
 * so an escape hatch is required — but a committed score decides where a real
 * person sleeps, so it is never silent: the confirmation names the score being
 * discarded, and the entry stays visible on the board as removed.
 */
import type { EntryView } from '../state/ordering.js';
import { escapeHtml } from './leaderboard.js';

export interface OrganizerActions {
  setDeadline(iso: string): Promise<void>;
  releaseClaim(entryId: string): Promise<void>;
  removeEntry(entryId: string, discardedScore: number | null): Promise<void>;
  resetDraft(): Promise<void>;
}

export function renderOrganizer(
  entries: readonly EntryView[],
  deadlineIso: string,
  /** Why the last action did not happen. Empty when it did. */
  error = '',
): string {
  const live = entries.filter((e) => !e.removed);
  return `
    <div class="panel" style="border-color:var(--magenta)">
      <h2 class="title" style="font-size:20px">ORGANIZER</h2>
      <p class="subtitle">Only you have this link. Anyone who gets it has these powers too.</p>

      <div class="row" style="margin-bottom:12px">
        <label for="deadline">Deadline</label>
        <input id="deadline" type="datetime-local" value="${escapeHtml(toLocalInput(deadlineIso))}"
          style="padding:8px;background:var(--ink);color:var(--snow);border:1px solid var(--purple);min-height:44px" />
        <button id="save-deadline">SAVE</button>
      </div>

      <table>
        <thead><tr><th>Name</th><th>Added by</th><th>State</th><th></th></tr></thead>
        <tbody>
          ${live.map(rowFor).join('')}
        </tbody>
      </table>

      ${error ? `<p id="organizer-error" style="color:var(--yellow)">${escapeHtml(error)}</p>` : ''}

      <div class="row" style="margin-top:16px">
        <button id="reset" class="danger">RESET THE WHOLE DRAFT</button>
      </div>
      <p style="color:var(--yellow);font-size:12px">
        Reset destroys every committed score. There is no undo.
      </p>
    </div>`;
}

function rowFor(e: EntryView): string {
  const committed = e.score !== null;
  return `
    <tr>
      <td>${escapeHtml(e.name)}</td>
      <td>${e.origin === 'organizer' ? 'you' : 'themselves'}</td>
      <td>${committed ? `COMMITTED ${e.score!.toLocaleString()}` : e.claimed ? 'CLAIMED' : 'UNCLAIMED'}</td>
      <td>
        ${e.claimed && !committed ? `<button data-release="${e.id}" style="min-height:36px">RELEASE</button>` : ''}
        <button data-remove="${e.id}" data-score="${e.score ?? ''}" class="${committed ? 'danger' : ''}" style="min-height:36px">REMOVE</button>
      </td>
    </tr>`;
}

/**
 * FR-074: removing a committed entry requires a confirmation that NAMES the
 * score. A generic "are you sure?" is what people click through without
 * reading, and the thing being destroyed is somebody's bed pick.
 */
export function removalConfirmationText(name: string, score: number | null): string {
  if (score === null) return `Remove ${name} from the roster?`;
  return (
    `Remove ${name} AND DISCARD their committed score of ${score.toLocaleString()}?\n\n` +
    `This cannot be undone. Do this only if ${name} is not actually on the trip.\n` +
    'The removal will stay visible on the leaderboard.'
  );
}

/** FR-075: a wrong name on a committed result is fixed by removal, not renaming. */
export const RENAME_REFUSAL =
  'A committed score cannot be renamed. If the name is wrong, remove the entry — ' +
  'relabelling a result would let the board say something that did not happen.';

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
