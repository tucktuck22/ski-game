# 4. Accept client-reported scores without verification

**Status**: Accepted
**Date**: 2026-09-01
**Deciders**: tucktuck22
**Relates to**: [spec.md](../../specs/001-shredpocalypse-bed-draft/spec.md) FR-064, FR-069; constitution Principle V

## Context

Constitution v1.0.0, Principle V, is unambiguous: "Submitted scores MUST be
validated by replay verification before publication. Client-reported scores MUST
NEVER be trusted as authoritative."

The first feature is a web game shared by one link, with no accounts and no
replays, that decides which bed each of eight friends gets. Every score is computed
on the player's own device and reported to shared storage. Anyone willing to open
developer tools can post any number he likes.

Three ways out were considered: build server-side validation into v1, capture an
input trace with every commit so a disputed run could be checked later, or accept
client-reported scores and record the deviation.

Server-side validation means the simulation has to run somewhere trusted, which is
a materially larger product than the one being built for a weekend trip. Trace
capture is cheap but only pays off if someone later writes the verifier, and it
does not prevent forgery — it only makes forgery require faking a plausible trace.

## Decision

Official scores are accepted as reported by the player's device. No verification is
performed in v1.

The determinism requirements are retained in full — fixed timestep, seeded
randomness, identical course, reproducible score from identical inputs — so that
verification remains buildable later without redesigning the simulation.

Because the standings are unverified, the product must not claim otherwise. Copy
in the game, the README, and project documentation describing standings as
verified, validated, trustworthy, or tamper-proof is corrected rather than left
standing.

## Consequences

v1 stays the size of the problem it solves. A private draft among eight people who
will be sharing a cabin does not need an adversarial threat model, and building one
would have cost more than the entire rest of the feature.

The standings are forgeable and undetectably so. There is no audit trail, no replay,
and nothing to point at if someone posts an implausible number — only the group's
own read on whether it happened.

Determinism is preserved, so this is a deferral rather than a dead end. Adding
verification later is new work on top of an unchanged simulation, not a rewrite.

This is a documented deviation from a ratified constitutional principle. The
deviation record — rationale, scope, owner, remediation date — lives in the spec's
Constitutional Compliance Notes, as the Governance section requires. The record's
remediation date is 2026-09-01, which is today, meaning it is due at the moment it
is written. That is not an accident: the intent is to change the rule rather than
satisfy it, which is what [ADR-0005](0005-trust-the-players.md) proposes. If that
amendment is accepted this record stops being a deviation and becomes ordinary
compliance. If it is rejected, this record is overdue and needs a real remediation
plan.
