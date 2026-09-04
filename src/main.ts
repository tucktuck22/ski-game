/**
 * Application entry point: roster -> practice -> official -> standings.
 *
 * The flow enforces the run economy from shared storage, never from this
 * device (FR-021), and routes the one irreversible write through the outbox so
 * a dropped connection queues rather than loses it (FR-046).
 */
import { assembleGameData, type GameData } from './data/load.js';
import { LocalDraftStore } from './state/localDraft.js';
import { DraftStore, discoverDraft, type DraftSnapshot } from './state/supabase.js';
import { Outbox, type OutboxStore, type PendingCommit } from './state/outbox.js';
import { availability, courseFor, PRACTICE_RUNS, type RunKind } from './state/runEconomy.js';
import { renderLeaderboard, escapeHtml } from './ui/leaderboard.js';
import { GameView, type RunReport } from './ui/game.js';
import { popTrickBadge } from './ui/trickBadge.js';
import { showYouDied } from './ui/youDied.js';
import { Synth } from './audio/synth.js';
import { MusicPlayer } from './audio/music.js';
import { resolveMotion, setMotion, REDUCED_MOTION } from './render/reducedMotion.js';
import { deadlineState, canStartOfficialRun, formatRemaining } from './state/deadline.js';
import { organizerSecretFromUrl } from './state/links.js';
import { renderOrganizer, removalConfirmationText } from './ui/organizer.js';
import { safeSession } from './state/safeStorage.js';
import { showFatalError, installGlobalErrorHandlers } from './ui/errorBoundary.js';
import { titleScene } from './ui/title.js';
import { resolveConfig, describeUnreachable, isNetworkFailure } from './state/config.js';

import tuningJson from '../data/tuning.json';
import scoringJson from '../data/scoring.json';
import warmupJson from '../data/courses/warmup.json';
import officialJson from '../data/courses/official.json';
import insultsJson from '../data/insults.json';
import audioJson from '../data/audio.json';

type Backend = LocalDraftStore | DraftStore;

const app = document.getElementById('app') as HTMLDivElement;

// Installed before anything else runs, so even a failure during module
// evaluation reaches the screen.
installGlobalErrorHandlers();

const data: GameData = assembleGameData({
  tuning: tuningJson,
  scoring: scoringJson,
  warmup: warmupJson,
  official: officialJson,
  insults: insultsJson,
  audio: audioJson,
});

// Validated up front: a bad URL otherwise surfaces as an opaque
// "TypeError: Failed to fetch" that names neither the cause nor the fix.
const config = resolveConfig(
  import.meta.env['VITE_SUPABASE_URL'],
  import.meta.env['VITE_SUPABASE_ANON_KEY'],
);
const isLocal = config.kind === 'local';

// May be absent: the bare site URL is what people bookmark and re-share once
// the query string is lost. bootstrap() then asks the database which draft is
// meant rather than failing on a fallback id nobody chose.
const DRAFT_ID_FROM_URL = new URLSearchParams(location.search).get('draft');
let DRAFT_ID = DRAFT_ID_FROM_URL ?? 'local-draft';
// FR-006: organizer controls appear only for a holder of the organizer URL.
// Secrecy, not authentication - see src/state/links.ts.
const isOrganizer = organizerSecretFromUrl(location.search) !== null;
const localDeadlineIso = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

// Assigned in bootstrap(), once DRAFT_ID is settled. Every read of it happens
// inside a handler that cannot run before then.
let backend!: Backend;

function makeBackend(): Backend {
  return config.kind === 'configured'
    ? new DraftStore(config.url, config.anonKey, DRAFT_ID)
    : new LocalDraftStore({
        id: DRAFT_ID,
        deadline: localDeadlineIso,
        courseSeed: 19860214,
        rulesVersion: data.official.rulesVersion,
        finalizedAt: null,
      });
}

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
// Guarded: an unguarded read here threw when site data was blocked, which
// killed module initialisation and rendered a blank page. See safeStorage.ts.
let myEntryId: string | null = null;
let game: GameView | null = null;
let commitStatus: 'idle' | 'pending' | 'confirmed' | 'rejected' = 'idle';
let commitMessage = '';
// Held in state rather than written straight to the DOM: refresh() re-renders,
// and an error painted directly onto the node was wiped before anyone read it.
let rosterError = '';
/**
 * FR-151: the title screen is the first thing a player sees, and DROP IN is the
 * gesture that starts the music.
 *
 * Browsers block audio before a user gesture - iOS Safari without exception - and
 * FR-054 requires the same thing independently. Before this screen existed the
 * gesture was still required but invisible, so the music appeared not to start until
 * the player happened to click something. The requirement did not change; what
 * changed is that the game now asks for the gesture out loud.
 */
let entered = false;

const synth = new Synth();
// FR-135/FR-136: which piece is audible follows one rule - on the course, or not.
// Set before the first gesture; arm() honours it when the gesture arrives.
const music = new MusicPlayer(data.audio, import.meta.env.BASE_URL);
music.setContext('frontEnd');
let reducedMotion = resolveMotion() === REDUCED_MOTION;

/**
 * FR-054 and style-bible A-3: no AudioContext until a deliberate gesture. Bound
 * to the first pointer or key the player produces, then removed.
 *
 * The music arms from this same handler rather than a listener of its own. Two
 * gates for the same rule drift apart, and the one that drifts is the one nobody
 * is testing.
 */
function armAudioOnFirstGesture(): void {
  const arm = (): void => {
    synth.start();
    const target = synth.target;
    if (target) music.arm(target);
    window.removeEventListener('pointerdown', arm);
    window.removeEventListener('keydown', arm);
  };
  window.addEventListener('pointerdown', arm, { once: false });
  window.addEventListener('keydown', arm, { once: false });
}
armAudioOnFirstGesture();

/**
 * Paint something before the first await.
 *
 * This module used to end in a top-level `await`, so anything that rejected up
 * there halted evaluation with nothing on screen. That is exactly the blank
 * page that took days to pin down: the audio handler above had already been
 * attached, so the page made a sound on click and rendered nothing, and the
 * error boundary further down had not been reached yet.
 *
 * A shell painted synchronously means the page always has content, and any
 * later failure replaces it rather than leaving a void. The title screen is now
 * that shell, so the first paint is the finished thing rather than a placeholder.
 */
function renderTitle(): void {
  app.innerHTML = `
    <div class="title-screen">
      ${titleScene()}
      <h1 class="title-wordmark">SHREDPOCALYPSE<span class="title-year">'86</span></h1>
      <button id="drop-in" type="button">DROP IN</button>
    </div>`;
  const start = app.querySelector<HTMLButtonElement>('#drop-in');
  if (start)
    start.onclick = (): void => {
      // FR-152: one action does both. The audio was already armed by the
      // pointerdown or keydown that produced this click - see
      // armAudioOnFirstGesture above - so by the time we get here the music has
      // started and all that is left is to move the player on.
      //
      // FR-153: nothing here awaits the music. If it is slow, refused, or
      // missing entirely, the player still lands on the board.
      entered = true;
      render();
    };
  // Focus it, so a keyboard player has one obvious thing to press (FR-154).
  start?.focus();
}

/** Shown when a player drops in before shared storage has answered (FR-153). */
function renderWaiting(): void {
  app.innerHTML = `
    <div class="panel">
      <h1 class="title">SHREDPOCALYPSE '86</h1>
      <p class="subtitle">Loading the mountain…</p>
    </div>`;
}

renderTitle();

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
  // FR-151: nothing else paints until the player has dropped in. A background
  // refresh from the realtime subscription must not skip the title screen.
  if (!entered) return renderTitle();
  // Entering does not wait on the network, so the snapshot may not have arrived.
  if (snapshot === undefined) return renderWaiting();
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
        safeSession.set(`claim:${DRAFT_ID}`, id);
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
        safeSession.set(`claim:${DRAFT_ID}`, r.id);
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
      // One call site for both paths. Two mute paths is one too many: they
      // disagree the moment either grows a special case.
      const next = !synth.isMuted;
      synth.setMuted(next);
      music.setMuted(next);
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

  // FR-136: every run kind - practice, official, free play - gets the course piece.
  music.setContext('course');

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
  // FR-135: after the finale, not when the score commits. The score commits before
  // the wipeout finishes playing, and the music belongs to the screen rather than
  // to the transaction.
  music.setContext('frontEnd');

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

/**
 * Everything asynchronous lives here, behind one catch.
 *
 * Deliberately NOT a top-level await: a rejected top-level await halts module
 * evaluation, which leaves whatever was already attached (audio, listeners)
 * working while nothing renders and no handler runs. Kept as a function, a
 * failure lands in the catch and reaches the screen.
 */
async function bootstrap(): Promise<void> {
  // Misconfiguration is a setup mistake, not a runtime fault: say which secret
  // is wrong and how to fix it rather than letting fetch fail opaquely later.
  if (config.kind === 'invalid') {
    throw new Error(`${config.problem}\n\n${config.fix}`);
  }

  // A link with no ?draft= is the common case, not an error case. Ask the
  // database which draft is meant before deciding anything has gone wrong.
  if (config.kind === 'configured' && DRAFT_ID_FROM_URL === null) {
    const found = await discoverDraft(config.url, config.anonKey);
    if (found.kind === 'none') {
      throw new Error(
        'There is no draft in the database yet. Run supabase/seed-draft.sql in the ' +
          'Supabase SQL editor to create one — it prints the link to share.',
      );
    }
    if (found.kind === 'many') {
      const list = found.drafts.map((d) => `?draft=${d.id}  (deadline ${d.deadline})`).join('\n');
      throw new Error(
        `This database holds ${found.drafts.length} drafts, so the bare link is ` +
          `ambiguous — the app will not guess which one eight people meant.\n\n` +
          `To use the bare link, run supabase/cleanup-drafts.sql to leave exactly ` +
          `one draft. To carry on without cleaning up, add one of these to the URL:` +
          `\n\n${list}`,
      );
    }
    DRAFT_ID = found.id;
    // Keep the address bar honest, so a copied link carries the draft with it.
    const url = new URL(location.href);
    url.searchParams.set('draft', DRAFT_ID);
    history.replaceState(null, '', url.toString());
  }

  backend = makeBackend();
  myEntryId = safeSession.get(`claim:${DRAFT_ID}`);

  if (isLocal) {
    for (const n of ['Tucker', 'Dave', 'Sam', 'Al', 'Zach', 'Marty', 'Rob', 'Cheeks']) {
      await (backend as LocalDraftStore).seedOrganizerEntry(n);
    }
  }
  backend.subscribe(() => {
    void refresh();
  });
  await refresh();
}

void bootstrap().catch((error: unknown) => {
  // "Failed to fetch" carries no status and no Postgres code — the request
  // never reached a server — so it needs translating into something actionable.
  if (config.kind === 'configured' && isNetworkFailure(error)) {
    showFatalError('Shared storage is unreachable.', new Error(describeUnreachable(config.url)));
    return;
  }
  showFatalError('The game could not start.', error);
});
