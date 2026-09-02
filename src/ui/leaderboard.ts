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

export function renderLeaderboard(entries: readonly EntryView[], final: boolean): string {
  const s = computeStandings(entries, final);

  const row = (e: RankedEntry): string => `
    <tr class="${e.forfeit ? 'forfeit' : ''}">
      <td class="pick">${escapeHtml(pickLabel(e, final))}</td>
      <td class="${e.origin === 'self_created' ? 'self-created' : ''}${e.unresolvedTie ? ' tie' : ''}">${escapeHtml(e.name)}</td>
      <td>${e.score === null ? '—' : e.score.toLocaleString()}</td>
      <td>${e.outcome === 'wiped_out' ? 'WIPED OUT' : e.outcome === 'finished' ? 'FINISHED' : statusOf(e)}</td>
      <td>${e.abandonedOfficialRuns > 0 ? `${e.abandonedOfficialRuns} bailed` : ''}</td>
    </tr>`;

  return `
    <div class="panel">
      <h2 class="title">${final ? 'FINAL — BED ORDER' : 'STANDINGS'}</h2>
      <p class="subtitle">Rank 1 picks a bed first.${final ? '' : ' Not final until the deadline.'}</p>
      <table>
        <thead>
          <tr><th>Pick</th><th>Name</th><th>Score</th><th>Run</th><th>Bails</th></tr>
        </thead>
        <tbody>
          ${s.ranked.map(row).join('')}
          ${
            s.forfeits.length > 0
              ? `<tr><td colspan="5" style="color:var(--yellow);padding-top:14px">
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

/** FR-040: status for every roster member, not only those who scored. */
function statusOf(e: RankedEntry): string {
  if (!e.claimed) return 'UNCLAIMED';
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
