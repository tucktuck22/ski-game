# 5. Trust the players — amend Principle V rather than add a sixth principle

**Status**: Proposed — awaiting approval under the constitution's amendment procedure
**Date**: 2026-09-01
**Deciders**: tucktuck22
**Relates to**: constitution Principle V; [ADR-0004](0004-accept-client-reported-scores.md)

## Context

[ADR-0004](0004-accept-client-reported-scores.md) accepts client-reported scores and
records it as a deviation from Principle V. Its remediation date is today, which
makes it due on arrival. The stated intent is not to remediate but to change the
rule: people will play the game and let the chips fall where they may, and the
project should say so.

The proposal as raised was to add a sixth principle — "trust the players not to
cheat."

**That framing has a problem.** Principle V currently says client-reported scores
"MUST NEVER be trusted as authoritative." A sixth principle saying to trust players
would sit in the same binding document, at the same authority, contradicting it
outright. The constitution's Governance section establishes that this document
supersedes every other document, habit, and convenience — but it says nothing about
which principle wins when two principles disagree. A reviewer facing both would get
to choose, which in practice means neither is binding and the document has quietly
stopped governing the one question it was most specific about.

The instinct is right. Trust _is_ the position. It belongs inside Principle V,
replacing the clause it contradicts, rather than beside it as a rival.

There is also a real distinction worth keeping. "Never trust the client" is
excellent advice for a public leaderboard open to strangers and poor advice for
eight friends deciding bunk assignments. The principle was written without that
distinction because at ratification there was no product to make it concrete.

## Decision

Amend Principle V so that required verification scales with who is competing, and
state the trust posture explicitly as part of it. Do not add a sixth principle.

### Exact text change

In `.specify/memory/constitution.md`, Principle V, **replace**:

> - Submitted scores MUST be validated by replay verification before publication.
>   Client-reported scores MUST NEVER be trusted as authoritative.

**with**:

> - Verification MUST be proportionate to who competes. Where a leaderboard's
>   participants are mutually known to one another and its stakes are private,
>   scores MAY be accepted as reported by the client, and trust is the default
>   posture: technical enforcement MUST NOT be imposed on players in this setting
>   without evidence of an actual problem. Where a leaderboard is public or open, or
>   its participants are not mutually known, submitted scores MUST be validated by
>   replay verification before publication and client-reported scores MUST NEVER be
>   trusted as authoritative.
> - Run reproducibility MUST be preserved under either tier, so that verification
>   can be added to a trusted leaderboard later without redesigning the simulation.
> - A product that does not verify scores MUST NOT describe its standings as
>   verified, validated, or tamper-proof.

**And append** to that principle's Rationale:

> Trust is a design position, not an oversight. Among people who know each other,
> policing costs everyone something in order to defend against something that mostly
> does not happen, and the surveillance itself reads as an accusation. The hard rule
> is kept exactly where it earns its cost — leaderboards open to strangers, where
> there is no social contract to lean on and no way to know who is at the other end.

### Version

**1.0.0 → 2.0.0** (MAJOR). The versioning policy assigns MAJOR to a principle
"redefined in a backward-incompatible way." A `MUST NEVER` becoming conditional is
exactly that, even though the change relaxes rather than tightens the requirement.

### Impact on existing specs and code

- `specs/001-shredpocalypse-bed-draft/spec.md` FR-064 becomes compliant. The
  deviation record in its Constitutional Compliance Notes dissolves — there is
  nothing left to deviate from — and should be replaced by a note citing this
  amendment.
- FR-069 (no claims of verified standings) is unchanged, and is now backed by a
  constitutional clause rather than only by a deviation record.
- Determinism requirements FR-024 through FR-027 are unchanged and remain load-bearing.
- `README.md`'s principle summary table describes Principle V as "Client scores are
  never trusted" and must be updated to match.
- No code exists. No migration is required.

### Migration plan

None. The amendment ratifies what the first feature already specifies; no shipped
behaviour changes.

## Consequences

The constitution stops contradicting the product. Principle V becomes something the
project actually follows rather than something it formally violates on day one,
which matters more than it sounds: a governing document with a standing exception
teaches everyone that its rules are negotiable.

The trust posture becomes binding rather than incidental. A future contributor who
proposes anti-cheat telemetry, device fingerprinting, or a lockout for a private
draft now has a principle to argue against, not just a preference.

The hard rule survives where it matters. Anything public still requires replay
verification, and reproducibility is required under both tiers, so the door stays
open.

The cost is that "mutually known participants" and "private stakes" are judgement
calls, and the boundary will eventually be argued over — a friend-of-a-friend
joining the trip, a leaderboard shared one link too far. A bright-line rule needs no
interpretation; this one does. That is the price of having a rule that fits more
than one situation, and it is worth paying, but it should be paid knowingly.

A MAJOR version bump on a constitution eleven days into its life is not a great look
in the abstract. It is the honest classification, and pretending a redefinition is a
clarification would be the worse outcome.

## Alternative considered: add Principle VI

Rejected. Described in Context above: a sixth principle asserting trust would
directly contradict Principle V's existing clause, and the document has no mechanism
for resolving a conflict between two of its own principles. The result would be a
constitution that appears to govern this question and does not.
