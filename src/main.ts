/**
 * Application entry point: roster -> practice -> official -> standings.
 *
 * The flow enforces the run economy from shared storage, never from this
 * device (FR-021), and routes the one irreversible write through the outbox so
 * a dropped connection queues rather than loses it (FR-046).
 */
import { assembleGameData, type GameData } from './data/load.js';
import { LocalDraftStore } from './state/localDraft.js';
import { DraftStore, type DraftSnapshot } from './state/supabase.js';
import { Outbox, type OutboxStore, type PendingCommit } from './state/outbox.js';
import { availability, courseFor, PRACTICE_RUNS, type RunKind } from './state/runEconomy.js';
import { renderLeaderboard, escapeHtml } from './ui/leaderboard.js';
import { GameView, type RunReport } from './ui/game.js';
import { popTrickBadge } from './ui/trickBadge.js';
import { showYouDied } from './ui/youDied.js';
import { Synth } from './audio/synth.js';
import { resolveMotion, setMotion, REDUCED_MOTION } from './render/reducedMotion.js';
import { deadlineState, canStartOfficialRun, formatRemaining } from './state/deadline.js';
import { organizerSecretFromUrl } from './state/links.js';
import { renderOrganizer, removalConfirmationText } from './ui/organizer.js';

import tuningJson from '../data/tuning.json';
import scoringJson from '../data/scoring.json';
import warmupJson from '../data/courses/warmup.json';
import officialJson from '../data/courses/official.json';
import insultsJson from '../data/insults.json';

type Backend = LocalDraftStore | DraftStore;

const app = document.getElementById('app') as HTMLDivElement;

const data: GameData = assembleGameData({
  tuning: tuningJson,
  scoring: scoringJson,
  warmup: warmupJson,
  official: officialJson,
  insults: insultsJson,
});

const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
const key = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;
const isLocal = !url || !key;

const DRAFT_ID = new URLSearchParams(location.search).get('draft') ?? 'local-draft';
// FR-006: organizer controls appear only for a holder of the organizer URL.
// Secrecy, not authentication - see src/state/links.ts.
const isOrganizer = organizerSecretFromUrl(location.search) !== null;
const localDeadlineIso = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

const backend: Backend = isLocal
  ? new LocalDraftStore({
      id: DRAFT_ID,
      deadline: localDeadlineIso,
      courseSeed: 19860214,
      rulesVersion: data.official.rulesVersion,
      finalizedAt: null,
    })
  : new DraftStore(url, key, DRAFT_ID);

// The outbox needs somewhere to persist. In local mode it is in memory, because
// a local session is already not a real draft.
const memory = new Map<string, PendingCommit>();
const store: OutboxStore = {
  all: async () => [...memory.values()],
  put: async (c) => {
    memory.set(c.id, c);
  },
  remove: async (id) => {
    memory.delete(id);
  },
};
const outbox = new Outbox(store, (c) => backend.submitCommit(c));

let snapshot: DraftSnapshot;
let myEntryId: string | null = sessionStorage.getItem(`claim:${DRAFT_ID}`);
let game: GameView | null = null;
let commitStatus: 'idle' | 'pending' | 'confirmed' | 'rejected' = 'idle';
let commitMessage = '';
// Held in state rather than written straight to the DOM: refresh() re-renders,
// and an error painted directly onto the node was wiped before anyone read it.
let rosterError = '';

const synth = new Synth();
let reducedMotion = resolveMotion() === REDUCED_MOTION;

/**
 * FR-054 and style-bible A-3: no AudioContext until a deliberate gesture. Bound
 * to the first pointer or key the player produces, then removed.
 */
function armAudioOnFirstGesture(): void {
  const arm = (): void => {
    synth.start();
    window.removeEventListener('pointerdown', arm);
    window.removeEventListener('keydown', arm);
  };
  window.addEventListener('pointerdown', arm, { once: false });
  window.addEventListener('keydown', arm, { once: false });
}
armAudioOnFirstGesture();

if (isLocal) {
  for (const n of ['Tucker', 'Dave', 'Sam', 'Al', 'Zach', 'Marty', 'Rob', 'Cheeks']) {
    await (backend as LocalDraftStore).seedOrganizerEntry(n);
  }
}

async function refresh(): Promise<void> {
  snapshot = await backend.snapshot();
  render();
}

const myEntry = (): DraftSnapshot['entries'][number] | undefined =>
  snapshot.entries.find((e) => e.id === myEntryId);

const deadline = (): ReturnType<typeof deadlineState> =>
  deadlineState(snapshot.draft.deadline, snapshot.draft.finalizedAt, Date.now(), null);

const draftIsFinal = (): boolean => deadline().final;

function render(): void {
  if (game) return; // a run owns the screen
  const me = myEntry();
  app.innerHTML = `
    ${
      isLocal
        ? `<div class="panel" style="border-color:var(--yellow)">
      <strong style="color:var(--yellow)">LOCAL SESSION — NOT A REAL DRAFT.</strong>
      No shared storage is configured, so nothing here is visible to anyone else
      and run counts do not survive a reload. Set VITE_SUPABASE_URL to run a real draft.
    </div>`
        : ''
    }
    <div class="panel">
      <h1 class="title">SHREDPOCALYPSE '86</h1>
      <p class="subtitle">The leaderboard IS the bed order. One official run. It counts the moment it ends.</p>
      <div class="row" style="margin-bottom:12px">
        <span style="color:var(--yellow)">${escapeHtml(formatRemaining(deadline().msRemaining))}</span>
        <button id="mute" style="min-height:36px;padding:6px 10px">${synth.isMuted ? 'SOUND OFF' : 'SOUND ON'}</button>
        <button id="motion" style="min-height:36px;padding:6px 10px">${reducedMotion ? 'REDUCED MOTION' : 'FULL MOTION'}</button>
      </div>
      ${me ? renderPlayer(me) : renderRoster()}
    </div>
    ${renderLeaderboard(snapshot.entries, draftIsFinal())}
    ${isOrganizer ? renderOrganizer(snapshot.entries, snapshot.draft.deadline) : ''}`;
  wire();
}

function renderRoster(): string {
  const unclaimed = snapshot.entries.filter((e) => !e.claimed && !e.removed);
  return `
    <p>Pick your name:</p>
    <div class="row">
      ${
        unclaimed
          .map((e) => `<button data-claim="${e.id}">${escapeHtml(e.name)}</button>`)
          .join('') || '<em>Every name is claimed.</em>'
      }
    </div>
    <p style="margin-top:16px">Not on the list? Add yourself:</p>
    <div class="row">
      <input id="new-name" maxlength="24" placeholder="Your name"
        style="padding:10px;background:var(--ink);color:var(--snow);border:1px solid var(--purple);min-height:44px" />
      <button id="add-name">ADD ME</button>
    </div>
    <p id="roster-error" style="color:var(--yellow)">${escapeHtml(rosterError)}</p>`;
}

function renderPlayer(me: NonNullable<ReturnType<typeof myEntry>>): string {
  const a = availability(me, !canStartOfficialRun(deadline()));
  return `
    <p>You are <strong style="color:var(--magenta)">${escapeHtml(me.name)}</strong>.</p>
    <div class="stack">
      <div class="row">
        <button id="practice" ${a.practiceRemaining === 0 || a.freePlayOnly ? 'disabled' : ''}>
          PRACTICE RUN (${a.practiceRemaining} left)
        </button>
        <button id="official" class="danger" ${a.officialAvailable ? '' : 'disabled'}>OFFICIAL RUN</button>
        <button id="free" ${a.freePlayOnly ? '' : 'disabled'}>FREE PLAY</button>
      </div>
      ${a.blockedReason ? `<p id="blocked-reason" style="color:var(--yellow)">${escapeHtml(a.blockedReason)}</p>` : ''}
      ${commitStatus === 'pending' ? `<p class="pending">SCORE PENDING — not on the leaderboard until the server confirms it.</p>` : ''}
      ${commitStatus === 'confirmed' ? `<p class="confirmed">SCORE CONFIRMED. ${escapeHtml(commitMessage)}</p>` : ''}
      ${commitStatus === 'rejected' ? `<p style="color:var(--yellow)">${escapeHtml(commitMessage)}</p>` : ''}
      <p style="color:var(--cyan);font-size:12px">
        Practice is the warm-up slope. The official run is a course you have not seen.
        Hold to tuck and go faster — let go to jump. Let go under something low and you eat it.
      </p>
    </div>`;
}

function wire(): void {
  app.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((b) => {
    b.onclick = async (): Promise<void> => {
      const id = b.dataset['claim'] as string;
      const r = await backend.claimEntry(id);
      if (r.ok) {
        myEntryId = id;
        rosterError = '';
        sessionStorage.setItem(`claim:${DRAFT_ID}`, id);
      } else {
        rosterError = r.reason;
      }
      await refresh();
    };
  });

  const add = app.querySelector<HTMLButtonElement>('#add-name');
  if (add) {
    add.onclick = async (): Promise<void> => {
      const input = app.querySelector<HTMLInputElement>('#new-name');
      const r = await backend.createEntry(input?.value ?? '');
      if (r.ok) {
        myEntryId = r.id;
        rosterError = '';
        sessionStorage.setItem(`claim:${DRAFT_ID}`, r.id);
      } else {
        rosterError = r.reason;
      }
      await refresh();
    };
  }

  const bind = (sel: string, kind: RunKind): void => {
    const el = app.querySelector<HTMLButtonElement>(sel);
    if (el)
      el.onclick = (): void => {
        void startRun(kind);
      };
  };
  bind('#practice', 'practice');
  bind('#free', 'free');

  const official = app.querySelector<HTMLButtonElement>('#official');
  if (official)
    official.onclick = (): void => {
      confirmOfficial();
    };

  const mute = app.querySelector<HTMLButtonElement>('#mute');
  if (mute)
    mute.onclick = (): void => {
      synth.setMuted(!synth.isMuted);
      render();
    };

  if (isOrganizer) wireOrganizer();

  const motion = app.querySelector<HTMLButtonElement>('#motion');
  if (motion)
    motion.onclick = (): void => {
      reducedMotion = !reducedMotion;
      setMotion(reducedMotion);
      render();
    };
}

/** FR-016: an explicit confirmation, stating unambiguously that it counts once. */
function wireOrganizer(): void {
  app.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((b) => {
    b.onclick = async (): Promise<void> => {
      const id = b.dataset['remove'] as string;
      const raw = b.dataset['score'] ?? '';
      const score = raw === '' ? null : Number(raw);
      const entry = snapshot.entries.find((e) => e.id === id);
      // FR-074: the confirmation names the score being discarded. A generic
      // "are you sure?" is what people click through without reading, and what
      // is being destroyed is somebody's bed pick.
      if (!confirm(removalConfirmationText(entry?.name ?? 'this entry', score))) return;
      await backend.removeEntry(id, score);
      await refresh();
    };
  });

  app.querySelectorAll<HTMLButtonElement>('[data-release]').forEach((b) => {
    b.onclick = async (): Promise<void> => {
      await backend.releaseClaim(b.dataset['release'] as string);
      await refresh();
    };
  });

  const save = app.querySelector<HTMLButtonElement>('#save-deadline');
  if (save)
    save.onclick = async (): Promise<void> => {
      const input = app.querySelector<HTMLInputElement>('#deadline');
      if (!input?.value) return;
      const iso = new Date(input.value).toISOString();
      // FR-004: warn before applying a deadline that has already elapsed.
      if (
        Date.parse(iso) < Date.now() &&
        !confirm(
          'That time has already passed. Applying it finalises the draft immediately. Continue?',
        )
      )
        return;
      await backend.setDeadline(iso);
      await refresh();
    };

  const reset = app.querySelector<HTMLButtonElement>('#reset');
  if (reset)
    reset.onclick = async (): Promise<void> => {
      if (!confirm('Reset the draft? Every committed score is destroyed. There is no undo.'))
        return;
      await backend.resetDraft();
      await refresh();
    };
}

function confirmOfficial(): void {
  app.innerHTML = `
    <div class="panel">
      <h2 class="title">THIS IS THE ONE</h2>
      <p class="subtitle">Read it before you tap.</p>
      <ul style="line-height:1.7">
        <li>This run <strong>counts</strong>. You get exactly one.</li>
        <li>It commits the instant the run ends — <strong>including if you wipe out</strong>.</li>
        <li>There is no retake, on any device, ever.</li>
        <li>You have not seen this course before.</li>
      </ul>
      <div class="row" style="margin-top:16px">
        <button id="go" class="danger">SEND IT</button>
        <button id="back">NOT YET</button>
      </div>
    </div>`;
  (app.querySelector('#go') as HTMLButtonElement).onclick = (): void => {
    void startRun('official');
  };
  (app.querySelector('#back') as HTMLButtonElement).onclick = (): void => {
    render();
  };
}

async function startRun(kind: RunKind): Promise<void> {
  const me = myEntry();
  if (!me) return;
  const which = courseFor(kind, me.score !== null);
  const course = which === 'official' ? data.official : data.warmup;

  app.innerHTML = `
    <div class="game-wrap">
      <canvas id="screen"></canvas>
      <div class="hud">
        <span class="kind ${kind === 'official' ? 'official' : ''}">${kind.toUpperCase()}${kind === 'official' ? ' — THIS COUNTS' : ' — DOES NOT COUNT'}</span>
        <span class="score-group">
          <span class="mult" id="live-mult" hidden>2× HIGH LINE</span>
          <span class="score" id="live-score">0</span>
        </span>
      </div>
      <div class="badges" id="badges"></div>
    </div>`;

  const canvas = app.querySelector('#screen') as HTMLCanvasElement;
  const badges = app.querySelector('#badges') as HTMLDivElement;
  const motion = resolveMotion();
  game = new GameView(
    canvas,
    course,
    data.tuning,
    data.scoring,
    snapshot.draft.courseSeed,
    kind,
    (report) => {
      void endRun(report);
    },
    (trick) => popTrickBadge(badges, trick, motion),
    () => showYouDied(app, motion),
  );
  game.start();

  const hud = app.querySelector('#live-score') as HTMLSpanElement;
  const mult = app.querySelector('#live-mult') as HTMLSpanElement;
  const hudTimer = setInterval(() => {
    if (!game) {
      clearInterval(hudTimer);
      return;
    }
    hud.textContent = game.liveScore.toLocaleString();
    // A standing indicator rather than a flash: the zone persists through a
    // whole air, and the player needs to know he is still in it while he
    // decides whether to spin (FR-129).
    mult.hidden = game.liveMultiplier <= 1;
  }, 100);
}

async function endRun(report: RunReport): Promise<void> {
  // The view stays alive and stays on screen while the wipeout plays out.
  // `game` is deliberately NOT cleared yet: refresh() treats a live run as
  // owning the screen, and clearing it here would let a background refresh
  // paint over the mountain mid-sequence.
  const view = game;
  const finale = view?.finale ?? Promise.resolve();
  const me = myEntry();
  if (!me) {
    view?.destroy();
    game = null;
    return;
  }

  const insult = data.insults[Math.floor(Math.random() * data.insults.length)] as string;
  // FR-058: the cue has a visible equivalent - the headline and the insult -
  // so audio is never the only channel carrying the outcome.
  synth.cue(report.outcome === 'finished' ? 'land' : 'wipeout');
  const headline = report.outcome === 'finished' ? 'FINISHED' : 'WIPEOUT';

  if (report.kind === 'practice') {
    await backend.recordPracticeRun(me.id, Math.min(PRACTICE_RUNS, me.practiceRunsUsed + 1));
  }

  if (report.kind === 'official') {
    commitStatus = 'pending';
    await outbox.enqueue({
      id: `${me.id}-official`,
      draftId: snapshot.draft.id,
      entryId: me.id,
      score: report.score,
      outcome: report.outcome,
      rulesVersion: data.official.rulesVersion,
    });
    const result = await outbox.drain();
    if (result.confirmed > 0) {
      commitStatus = 'confirmed';
      commitMessage = `${report.score.toLocaleString()} is locked in.`;
    } else if (result.rejected.length > 0) {
      commitStatus = 'rejected';
      commitMessage = result.rejected[0] as string;
    } else {
      commitStatus = 'pending';
    }
  }

  // Everything above committed the run. Only the screen waits.
  await finale;
  view?.destroy();
  game = null;

  app.innerHTML = `
    <div class="panel">
      <h2 class="sfx">${headline}</h2>
      ${report.outcome === 'wiped_out' ? `<p class="subtitle">${escapeHtml(insult)}</p>` : ''}
      <p style="font-size:22px;color:var(--yellow)">${report.score.toLocaleString()}</p>
      <p>${
        report.kind === 'official'
          ? commitStatus === 'confirmed'
            ? 'Committed. That is your bed pick.'
            : commitStatus === 'rejected'
              ? escapeHtml(commitMessage)
              : 'Queued — it will post as soon as you have a signal. Do not close this tab.'
          : 'Practice. Nothing was recorded.'
      }</p>
      <button id="done">BACK TO THE BOARD</button>
    </div>`;
  (app.querySelector('#done') as HTMLButtonElement).onclick = (): void => {
    void refresh();
  };
}

backend.subscribe(() => {
  void refresh();
});
await refresh();
