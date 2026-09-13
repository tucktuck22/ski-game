# 2. Abandoned official runs are discarded, not committed

**Status**: Accepted
**Date**: 2026-09-01
**Deciders**: tucktuck22
**Relates to**: [spec.md](../../specs/001-shredpocalypse-bed-draft/spec.md) FR-019, FR-065, FR-066

## Context

Each player gets one official run whose score commits immediately and irreversibly
when the run ends — including when it ends face-first in a snowbank. The rule is
the product's spine: the leaderboard is the bed-pick order, so the one run has to
mean something.

That rule binds only runs that reach an end state. A player having a bad official
run can close the tab a metre before the crash and nothing commits. The question
was what the product should do about it.

Four answers were on the table: commit the score accumulated so far, commit a
forfeit, allow one bounded resume, or discard the run entirely and leave the
official run unused.

The first two close the hole completely and punish a dead battery or a dropped
chairlift connection exactly as hard as they punish a rage-quit — with no appeal,
on a run that cannot be retaken. The third splits the difference at the cost of
more states to build and explain.

## Decision

An official run whose session ends before it reaches a finish or a wipeout is
discarded in full. Nothing commits. The official run remains unused and may be
restarted without limit until the deadline.

We will not block restarts. ~~We will **count** them: every abandonment increments
a counter displayed on the leaderboard next to that player's name, visible to
everyone holding the link.~~ **The counter is gone — corrected 2026-09-12 under
feature 005's FR-210.** FR-065 was withdrawn on 2026-09-08 and the column removed
in `7b2cc8b`. It had never worked: the detection and the storage writer were built
and unit-tested, nothing ever called either, and the leaderboard's Bails column
showed a permanent zero from the first deployment to its removal.

So restarts are neither blocked nor counted. Nothing about this decision is
enforced by the product at all.

The same rule applies symmetrically to practice — an abandoned practice run does
not consume one of the three.

## Consequences

The honest disconnect is fully protected. Nobody loses their one run to a phone
that died on a chairlift, which is the failure mode most likely to actually occur
among eight people playing on mobile in a ski town.

The one-run rule becomes social rather than enforced, and everyone will work that
out. A player who wants to reroll can, as many times as he likes. ~~The deterrent is
that his friends can see the count.~~ **There is no deterrent.** This record rested
its case on a counter that never counted anything, which made the decision look
better supported than it was — the reason FR-210 required the correction rather
than leaving it. What remains is [ADR-0005](0005-trust-the-players.md)'s argument
on its own: eight friends who booked a cabin together, and the organizer's judgement
that policing this is not worth the machinery.

"A face-plant on your official run is your score" now holds only for players who
let the face-plant land. Someone with quick enough reflexes can bail before impact
and lose nothing at all — ~~a tick on a counter~~ not even that. The wipeout rule
keeps its narrative force and loses most of its teeth.

This decision compounds with [ADR-0004](0004-accept-client-reported-scores.md) and
especially with [ADR-0003](0003-practice-uses-a-separate-warm-up-course.md); see
that record for the interaction, which is the more serious cost of this one.

Planning must not introduce a technical block on restarts without superseding this
record. The absence of enforcement is the decision, not an oversight to be
tidied up later by someone who reads FR-017 and assumes a gap.
