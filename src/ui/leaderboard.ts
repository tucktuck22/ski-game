/**
 * The leaderboard.
 *
 * This is the deliverable: the standings ARE the bed-pick order, so the view
 * has to be unambiguous enough that eight friends can read it and act on it
 * without argument (SC-010).
 */
import {
  computeStandings,
  pickLabel,
  type EntryView,
  type RankedEntry,
} from '../state/ordering.js';

export function renderLeaderboard(
  entries: readonly EntryView[],
  final: boolean,
  officialAttempts: number,
): string {
  const s = computeStandings(entries, final);

  const row = (e: RankedEntry): string => `
    <tr class="${e.forfeit ? 'forfeit' : ''}">
      <td class="pick">${escapeHtml(pickLabel(e, final))}</td>
      <td class="${e.origin === 'self_created' ? 'self-created' : ''}${e.unresolvedTie ? ' tie' : ''}">${escapeHtml(e.name)}</td>
      <td>${e.score === null ? '—' : e.score.toLocaleString()}</td>
      <td>${escapeHtml(attemptCell(e, final, officialAttempts))}</td>
    </tr>`;

  return `
    <div class="panel">
      <h2 class="title">${final ? 'FINAL — BED ORDER' : 'STANDINGS'}</h2>
      <p class="subtitle">Rank 1 picks a bed first.${final ? '' : ' Not final until the deadline.'}</p>
      <table>
        <thead>
          <tr><th>Pick</th><th>Name</th><th>Best</th><th>Attempts</th></tr>
        </thead>
        <tbody>
          ${s.ranked.map(row).join('')}
          ${
            s.forfeits.length > 0
              ? `<tr><td colspan="4" style="color:var(--yellow);padding-top:14px">
            ${
              final
                ? 'DID NOT POST A SCORE — settle the order below by coin flip at the cabin'
                : 'STILL TO POST A SCORE — no order among these until the deadline'
            }
          </td></tr>`
              : ''
          }
          ${s.forfeits.map(row).join('')}
        </tbody>
      </table>
    </div>`;
}

/**
 * FR-239: what the fourth column says, and it now has two jobs.
 *
 * It must report how many official attempts a player has used, AND make a
 * player who is mid-competition impossible to mistake for one who is done. The
 * score beside it is his BEST so far, not his last (FR-232), and a best-so-far
 * presented as a result is the specific way this board could lie by omission.
 *
 * Everything here is carried by text. FR-055: no information by colour alone.
 */
function attemptCell(e: RankedEntry, final: boolean, officialAttempts: number): string {
  if (e.score === null) return statusOf(e, officialAttempts);

  const outcome = e.outcome === 'wiped_out' ? 'WIPED OUT' : 'FINISHED';
  const used = `${e.officialAttemptsUsed} of ${officialAttempts}`;
  // After the deadline every unused attempt is moot (FR-241), so nobody is
  // "still going" and the qualifier would be noise.
  const stillGoing = !final && e.officialAttemptsUsed < officialAttempts;
  return stillGoing ? `${outcome} — BEST OF ${used} SO FAR` : `${outcome} — ${used}`;
}

/** FR-040: status for every roster member, not only those who scored. */
function statusOf(e: RankedEntry, officialAttempts: number): string {
  if (!e.claimed) return 'UNCLAIMED';
  // An attempt spent with no score is an abandoned one (FR-233). Saying only
  // "PRACTISING" there would be wrong: he is in the competition and down an
  // attempt, which is exactly the state the board must not hide.
  if (e.officialAttemptsUsed > 0)
    return e.officialAttemptsUsed >= officialAttempts
      ? `NO SCORE — ${e.officialAttemptsUsed} of ${officialAttempts} USED`
      : `IN PROGRESS — ${e.officialAttemptsUsed} of ${officialAttempts} USED`;
  // "PRACTISING (3/3)" reads as unfinished to someone scanning the board; a
  // player who has used all three is waiting to go official, not mid-practice.
  if (e.practiceRunsUsed >= 3) return 'READY — NOT YET OFFICIAL';
  if (e.practiceRunsUsed > 0) return `PRACTISING (${e.practiceRunsUsed}/3)`;
  return 'CLAIMED';
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}
