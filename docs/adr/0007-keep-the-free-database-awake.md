# 7. Keep the free database awake with a scheduled Action

**Status**: Accepted
**Date**: 2026-09-01
**Deciders**: tucktuck22
**Relates to**: [ADR-0006](0006-platform-baseline-and-budgets.md);
[research.md](../../specs/001-shredpocalypse-bed-draft/research.md) R5; FR-021, FR-046

## Context

The draft's shared state lives in a Supabase free-tier project. The free tier is
comfortably large for eight players — 500 MB of storage and unlimited API
requests against perhaps sixty runs in total — but it carries one condition that
matters far more than any of the size limits: **a free project pauses after
seven days with no database activity, and restoring it requires a human to click
a button in the dashboard.**

That interacts badly with how this product is actually used. The realistic
timeline for a ski trip is that somebody sets the draft up three weeks out,
drops the link in the group chat, everybody ignores it, and then seven people
try to play on the Wednesday before departure. A seven-day gap with no database
queries is not an edge case in that story — it is the expected middle of it.

The failure mode is the worst available one. It is not slow or degraded; the
link is simply dead, at the exact moment the group finally engages, and it stays
dead until the organiser notices and intervenes. Nothing in the product can
detect or recover from it, because the thing that would do the detecting is the
database.

The question that prompted this was whether GitHub could host the shared state
instead and avoid the problem. It cannot: every GitHub write path requires a
credential, so the only options are shipping a token in a public bundle — which
would let any link holder rewrite the course, the scoring table, or the git
history, a far wider blast radius than the score forgery
[ADR-0004](0004-accept-client-reported-scores.md) already accepts — or requiring
every player to sign in to GitHub, which breaks FR-009 and is not something
eight people will do to pick a bunk.

## Decision

Keep Supabase, and add a scheduled GitHub Actions workflow
(`.github/workflows/keepalive.yml`) that issues one real `SELECT` against the
`draft` table daily. That resets the seven-day pause timer.

The workflow:

- Runs at 07:17 UTC rather than on the hour, because GitHub delays scheduled
  runs under load and `:00` is the most congested minute of every hour.
- Performs an actual row read, not a health check. A request that only reaches
  the API gateway does not count as database activity, which is the whole point.
- **Exits green with a notice when the secrets are unset.** A repository with no
  draft configured is a normal state, and a workflow that fails red every
  morning trains everyone to ignore it — which is exactly the wrong habit for
  the thing keeping the draft alive.
- **Fails loudly when the query fails.** A red run is the only warning anyone
  gets that the link is about to stop working.

## Consequences

The pause stops being an operational risk and becomes a cron job. It costs
nothing, lives in the repository that already exists, and uses GitHub for the
thing GitHub is genuinely good at here — running a scheduled task — rather than
for the thing it cannot do, which is anonymous writes.

A failed run is now a real signal. If the workflow goes red, somebody should
look, because the draft link is on its way to being dead.

**The mitigation has its own inactivity rule, and this is the part most likely
to bite.** GitHub disables scheduled workflows in a repository with no activity
for sixty days. So the keep-alive can itself be switched off by the same kind of
neglect it exists to defend against — a repository that goes quiet after the
game is finished, with a draft still meant to be live. Sixty days is much longer
than any single trip's window, so this is acceptable, but it is a real
dependency and not a hypothetical one. If a draft ever needs to stay live longer
than that, the schedule alone will not carry it.

Switching to Cloudflare Workers with D1 was the alternative that removes the
pause entirely rather than working around it, and it remains the better answer
if this ever serves more than one trip. It was rejected here on scope: it means
another account, and writing the API surface by hand instead of getting PostgREST
and Row Level Security for free — and those RLS policies are currently what make
the one-official-run rule a database invariant rather than a promise. That is
not a trade worth making to avoid one cron job.
