# 1. Record architecture decisions

**Status**: Accepted
**Date**: 2026-09-01
**Deciders**: tucktuck22

## Context

The project is governed by a constitution and driven by Spec Kit specs. Both
describe the current state: the constitution says what is binding now, and a spec
says what the product does now. Neither preserves why a choice was made or what
the alternatives cost.

That gap is already visible. The first feature spec resolved three questions where
every available answer had a real cost, and two of those answers interact in a way
that neither creates alone. The reasoning currently survives only in the spec's
prose, which will be rewritten the first time the feature changes.

## Decision

We will record decisions with lasting consequences as ADRs in `docs/adr/`, using
Nygard's Context / Decision / Consequences structure.

An accepted ADR is immutable. When a decision changes, a new ADR supersedes the
old one and the old one's status is updated to point at it. The record of what we
used to think, and why we stopped thinking it, is the point.

Decisions that would change the constitution are drafted as a **Proposed** ADR
carrying the exact text change, then applied through the constitution's own
amendment procedure once approved. The ADR is the "proposed in writing" artifact
that procedure requires.

## Consequences

Reasoning survives its rewrite. A reader six months out can see not just that
abandoned runs are discarded, but that blocking them was considered and rejected
on the grounds that eight friends do not need to be policed.

Constitutional amendments get a paper trail with a rationale attached, which the
Governance section requires and which nothing in the repository currently provides.

The cost is discipline. ADRs are only worth their overhead if they are written
when the decision is made, not reconstructed afterward, and if they honestly
record what was given up. A file full of records that list only upsides is worse
than no file at all, because it looks like diligence.

Not every choice needs one. Reversible, local, or obvious decisions belong in the
spec or the code. The bar is: would someone later reasonably ask "why on earth is
it like this?"
