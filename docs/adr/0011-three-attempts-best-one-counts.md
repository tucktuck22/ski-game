# 11. Three attempts on the official course, best one counts

**Status**: Accepted
**Date**: 2026-09-23
**Deciders**: tucktuck22
**Relates to**: [spec.md](../../specs/007-best-of-three-official/spec.md) FR-231 to FR-245;
supersedes part of [ADR-0002](./0002-abandoned-official-runs-are-discarded.md); consistent
with [ADR-0004](./0004-accept-client-reported-scores.md)

> **Numbering note**: this is 0011 because `docs/adr/` already contains **two** files
> numbered 0010 — `0010-a-ninth-colour.md` and
> `0010-organizer-actions-as-secret-gated-functions.md`. That collision predates this
> record and wants a change of its own.

## Context

Each player got one official run. The score committed the instant the run reached a
finish or a wipeout, and that half was enforced in shared storage. The other half was not:
a run whose session ended before either was discarded entirely, and FR-019 said so
explicitly — "no limit on how many times an official run may be restarted this way".

Feature 001 recorded what those two rules cost together, in its own Accepted Consequences:

> The official run therefore stops being a cold read for anyone willing to do this, while
> remaining a cold read for the players who take the rules at face value. **The cost of
> the combination falls hardest on the honest and on the non-gamers.**

The intended mitigation, FR-065, was to count abandonments and publish them so scouting
carried a social price. The organizer withdrew it on 2026-09-08. The cost stood unaddressed
until now.

Separately, the organizer put the design question plainly: "rarely in life is it just one
run and done."

## Decision

**Three official attempts on the official course. The best single attempt counts. Starting
an attempt spends it.**

Best-single rather than aggregate because the competitive analogue is slopestyle — which
takes the best of two or three runs — rather than alpine racing, which sums two. This is a
trick-and-pickup scoring game, not a race against a clock.

The three practice runs on the warm-up slope are unchanged, and the official course stays
unreachable in practice and free play until every attempt is spent.

## Why this reverses part of ADR-0002, and why that is safe now

ADR-0002 refused to charge for an abandoned run. Its reasoning was specific, and the
operative clause is the last one:

> …punish a dead battery or a dropped chairlift connection exactly as hard as they punish
> a rage-quit — with no appeal, **on a run that cannot be retaken**.

That was correct when a player had one run: a dead phone ended his draft with nothing on
the board and no remedy. Under three attempts the same dead phone costs **one of three**.
The penalty ADR-0002 declined to impose is now proportionate, because the thing it falls
on is no longer irreplaceable.

The two halves are a package. Three attempts without the charge would be strictly more
permissive than the old rule and would leave the unfairness above untouched; the charge
without the extra attempts would be ADR-0002's objection, unanswered. Neither ships alone.

The organizer ruled the cost acceptable on 2026-09-23: _"Losing a run to a crashed tab is
acceptable."_ Recorded honestly as **acceptance in advance rather than a finding from
play** — it is the one judgement here a real session could still overturn, and FR-233 is
the requirement to revisit if it does.

## The trust decision

An earlier design put attempt allocation behind a `security definer` function with the
counter revoked from `anon`, so the count could not be tampered with. The organizer
rejected it on 2026-09-14:

> "We should not build this with cheaters in mind. This is a friends ski trip and we can
> count on honorable behavior."

That is consistent with ADR-0004, which already accepts whatever score the client reports.
Hardening the attempt counter while the score beside it is taken on trust buys nothing —
anyone willing to edit one would edit the other, and would not bother with the counter
when the score is right there.

Dropping it was a straight improvement for everyone who is not cheating. The dispenser had
to be a precondition of starting, which would have made it **the first network round-trip
in this product to gate gameplay**: no connection, no run. It now fails open like every
other write here, so offline play works and a whole failure screen does not exist.

**What this does and does not buy.** The count is honour-system. What is _not_ honour-system
is that one attempt cannot be recorded twice — `UNIQUE (draft_id, entry_id, attempt_no)` —
and that constraint is about **idempotency, not trust**: it is what stops a retried commit
posting a phantom attempt after a lost response, which hits an honest player on bad wifi.
It would exist even if the product trusted its players completely. Which it now does.

## Consequences

- **A player who abandons all three attempts forfeits**, indistinguishably from one who
  never played, with no in-product remedy. He goes to the organizer. Right for eight
  friends with a group chat; wrong for strangers.
- **Sessions roughly triple** — up to three practice runs plus three attempts on the
  12,000-unit course. Accepted by the organizer on 2026-09-23: _"3 and 3 sounds fine."_
- **The cold read is diluted by design.** Attempt one is still a genuine first look;
  attempts two and three are informed by it. That is the point, and the direct cost of
  FR-068's surprise.
- **Scores remain unverified** (ADR-0004). Three attempts triple the number of
  client-reported values and change nothing about the trust model.
- **The allowance is a tuning value**, not a constant, so play can move it with a one-line
  edit to `data/tuning.json` and a rules-version bump — no migration. The schema carries a
  loose sanity rail rather than the number, deliberately, so a re-tuned allowance is
  honoured end to end instead of half-vetoed.
