# 10. Organizer actions run as secret-gated database functions

**Status**: Accepted
**Date**: 2026-09-04
**Deciders**: tucktuck22
**Relates to**: [ADR-0004](0004-accept-client-reported-scores.md);
[ADR-0007](0007-keep-the-free-database-awake.md); FR-006, FR-007, FR-074, FR-018

## Context

The organizer panel offers four actions: release a claim, remove an entry, change
the deadline, and reset the draft. Three of the four did not work. Verified
against Postgres 16 with the shipped `setup.sql` applied and each operation run
as the `anon` role:

| Action                                     | Result                                        |
| ------------------------------------------ | --------------------------------------------- |
| release a claim (update `claimed_at`)      | OK                                            |
| remove an entry (update `removed_at`)      | `permission denied for table roster_entry`    |
| change the deadline (update `draft`)       | `permission denied for table draft`           |
| reset the draft (delete `committed_score`) | `permission denied for table committed_score` |

This was not an oversight in the policies. The denials are exactly right and
load-bearing: revoking update and delete on `committed_score` from every client
role is what makes FR-018's one-immutable-score rule hold against a player
holding the anon key, and the same reasoning covers `removed_at` and the draft
row. `0002_policies.sql` says so, and adds that organizer removal "goes through
the service role, which the player bundle does not carry."

The gap is that no such path was ever built. The organizer holds the _same anon
key as every player_ — his link differs only by a secret in the query string —
and there is no server to put a service role behind. The client wrote to the
tables directly, was refused, threw, and the rejection reached the global
`unhandledrejection` handler: the organizer confirmed a removal and watched the
page be replaced by the error boundary.

The test suite could not see this. `invariants.sql` proved at length that a
player _cannot_ perform these operations, and never asserted that the organizer
_can_. It proved the lockdown worked and never noticed the product was locked
out with it.

Three options were available:

1. **A service-role endpoint** — a Supabase Edge Function holding the service
   key, called with the organizer secret. Correct, and the conventional answer.
   It adds a deploy target, a second set of secrets, and a runtime that must be
   kept alive, to a project whose entire reason for being on a free tier is that
   nobody wants to operate it after the trip.
2. **Security-definer database functions** taking the organizer secret as an
   argument and running as the schema owner. No new runtime, no new secret
   store, and the table grants stay exactly as restrictive as they are today.
3. **Remove the three controls** and do organizer work in the Supabase SQL
   editor. Honest, and it makes the organizer a developer again — which is the
   thing FR-006 and US3 exist to stop.

## Decision

Option 2. Each organizer action is a `security definer` function that takes the
draft id and the organizer secret, verifies the secret against
`draft.organizer_secret`, and then performs the write as the schema owner.
`execute` is granted to `anon`; the table grants are unchanged.

The verification helper (`organizer_ok`) is deliberately **not** granted to any
client role. The action functions call it internally as the owner, so there is
no bare "is this the secret?" oracle to probe.

`search_path` is pinned on every one of them, so a caller cannot shadow a
referenced object with a temp table and have a function resolve to it while
running with the owner's rights.

Claim release keeps its existing path for now: it works, and the claim mechanic
is itself under review — see the follow-up to soften it so players simply select
themselves each time, which removes the action rather than re-plumbing it.

## Consequences

The organizer panel works, without a server, and nothing a player can reach has
widened: the grants and policies that make FR-018 hold are untouched. A player
holding only the player link is now refused these actions by the _secret_ rather
than by a table grant, which is what FR-006 actually asked for and what grants
alone could not express — grants cannot distinguish two holders of the same key.

`invariants.sql` now asserts both directions: that the actions are refused
without the secret, and that they succeed with it. The second half is the one
that was missing, and it is the half that would have caught this.

**The costs.**

This is still secrecy, not authentication, exactly as FR-006 and
`src/state/links.ts` already say. Anyone who obtains the organizer URL has every
organizer power. Given ADR-0004 already accepts unverified scores, a stronger
claim would be theatre — but it is worth being plain that these functions
authenticate nothing. They check a shared string.

Security-definer functions are genuinely dangerous constructs and now exist in
this schema. They run with the owner's rights, and a future edit that forgets the
`organizer_ok` call, or widens a parameter, hands a player owner-level reach into
these tables. They are short and each begins with the same line for exactly that
reason, and it is a standing invitation to review any change to that file
carefully.

The secret travels in a function argument, so it lands in the database's
statement logs where a service-role call would not have. For a private draft
among eight friends on a free-tier project this is accepted; it would not be on
anything public.

If this product ever grows real accounts, this decision should be superseded
rather than extended. The right shape then is proper authorization, not a longer
list of functions each checking a string.
