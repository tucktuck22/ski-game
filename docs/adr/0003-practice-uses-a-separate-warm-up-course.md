# 3. Practice runs use a separate warm-up course

**Status**: Accepted
**Date**: 2026-09-01
**Deciders**: tucktuck22
**Relates to**: [spec.md](../../specs/001-shredpocalypse-bed-draft/spec.md) FR-028, FR-067, FR-068

## Context

Every official run must present an identical course with identically seeded
randomness, so that all eight players face the same mountain. What the three
practice runs should present was open.

Practising on the official course gives everyone three looks at the exact terrain
they will be scored on. Memorisation helps, but it helps all eight equally, and it
is the friendlier option for players who do not play games — they can learn the
line before it counts.

Practising elsewhere makes the official run a first look at the scored terrain. It
tests reading the mountain rather than recalling it.

## Decision

Practice runs use a warm-up course distinct from the official course. The warm-up
is identical and identically seeded for every player, and runs the same physics,
control response, and scoring rules as the official course, so it rehearses
everything except the terrain.

The official course is unreachable in practice and in free play until that player's
official run has committed.

## Consequences

Practice teaches the controls. The official descent asks the player to read terrain
he has not seen, which is a different and more interesting test than recall.

It is harder on non-gamers, and that runs against the grain of the hybrid scoring
design, which exists so somebody who has never played can survive the course and
post a real number. Survival on unfamiliar terrain is a taller order than survival
on terrain you have skied three times. The generous completion bonus is now doing
more work than originally intended.

**The interaction with [ADR-0002](0002-abandoned-official-runs-are-discarded.md) is
the real cost.** Because an abandoned official run is free and unlimited, a player
can start the official run, ski two hundred metres of unfamiliar course, close the
tab, and repeat until he knows it. The cold read this record exists to create
survives only for players who take the rules at face value — which is precisely the
non-gamers it is already hardest on. The player who reads the confirmation dialog
and believes it gets one look; the player who does not gets as many as he wants.

We are accepting that rather than engineering around it, on the grounds that these
are eight friends and the abandonment counter makes scouting visible. It is worth
being clear that this is a bet on the group's behaviour, not a property of the
system. If the bet is wrong, the cheapest correction is superseding ADR-0002 with
a one-resume cap, not changing this record.
