# Research: Three Attempts, Best One Counts

**Phase 0** for [plan.md](./plan.md). Nine decisions. Three of them (R1, R3, R4) are
latent defects in code that ships today and would become live bugs under a naive
implementation of this feature.

---

## R1 — How three attempts are stored

**Decision**: Append one immutable row per completed attempt, numbered, with
`UNIQUE (draft_id, entry_id, attempt_no)` and `CHECK (attempt_no between 1 and 3)`.
The leaderboard score is derived by reduction, never stored.

**Rationale**: this satisfies three requirements at once that pull in different
directions.

- **FR-237 (immutability)** holds trivially: nothing is ever updated or deleted, so
  `0002_policies.sql`'s deliberate absence of UPDATE and DELETE grants survives intact.
  That absence is documented in the policy file as "this absence is the feature".
- **The three-attempt cap stays in the schema**, where the one-run rule lives today.
  `0001_init.sql` calls its unique index "THE ONE-RUN RULE... a uniqueness constraint no
  client bug and no curious player can route around". A `CHECK` on `attempt_no` is the
  same kind of object doing the same job.
- **Insert idempotency is preserved**, which is the part that is easy to miss. See below.

**The idempotency trap**: today `UNIQUE (draft_id, entry_id)` means a second insert for
the same entry raises `23505`, which `classifyError` maps to `rejected`, which the
outbox treats as a terminal outcome and drops. That is the correct behaviour for the
case that actually happens: **the insert succeeded and the response was lost**. The
outbox retries "until confirmed" (FR-046) and has no other way to distinguish a retry
from a fresh submission. Drop the unique index without replacing it and that retry
inserts a phantom second attempt, silently spending one of the player's three and
possibly overwriting his standing with a stale score. Keying on `(entry, attempt_no)`
restores the collision, so the retry is rejected exactly as it is today and the outbox's
existing logic needs no change in kind.

**Alternatives considered**:

- _One mutable row, updated when a better score arrives._ Rejected: requires granting
  UPDATE on `committed_score` to the anon role, which `0002_policies.sql` explicitly
  revokes and explains at length. It would also let a client lower its own score, and
  destroys the audit trail that makes a disputed bed order settleable.
- _Three nullable score columns on `roster_entry`._ Rejected: `roster_entry` is
  player-updatable by policy, so the scores would become client-writable. It also makes
  the server-assigned `commit_at` per attempt (FR-037, FR-236) awkward to the point of
  needing three more timestamp columns.
- _Drop the unique index, allow unlimited rows, cap in the client._ Rejected on both
  counts above: no idempotency, and a cap the client enforces is not a cap.

---

## R2 — Where "starting spends it" is enforced

**Decision**: A `security definer` function — `start_official_attempt(p_draft, p_entry)`
— increments the attempt counter and returns the allocated attempt number, refusing
beyond three. Direct UPDATE on the attempt counter column is revoked from `anon`.

**Rationale**: this is the decision the feature stands or falls on. FR-233 and FR-234
make "starting spends it" the mechanism that closes the unfairness recorded at
`specs/001-shredpocalypse-bed-draft/spec.md:400`, and the justification for reversing
ADR-0002 is that **everyone now gets the same three attempts**. A counter the player's
own bundle can decrement makes that claim false: the honest player takes three, the
curious one takes as many as he likes, and the feature has moved the loophole rather
than closed it.

The pattern is already established here. `0003_organizer.sql` and
[ADR-0010](../../docs/adr/0010-organizer-actions-as-secret-gated-functions.md) use
`security definer` functions for exactly this reason — a rule the client must not be
able to route around, implemented as a function rather than as a table write with a
policy. This feature reuses it without inventing anything.

**Note on what this does and does not buy.** It makes the attempt _count_ honest. It
does not make the score honest — ADR-0004 still accepts client-reported values, and a
player willing to open developer tools can still post whatever he likes. The two are
separate holes and only one is in scope. Stating that plainly matters, because "the
attempt limit is server-enforced" could otherwise be misread as "the leaderboard is
now trustworthy". It is not.

**Alternatives considered**:

- _Plain column update, as `official_status` works today._ Rejected: reversible by the
  same grant that sets it. Today that is tolerable because the _score_ is protected by
  the unique index regardless of what `official_status` says; under this feature the
  abandonment count has no such backstop and is the thing being enforced.
- _Trust the client, as ADR-0004 does for scores._ Rejected: ADR-0004 accepts unverified
  _values_ among friends. This is a _rule_, and feature 001 already found that leaving
  this particular rule social rather than enforced cost the honest players specifically
  (spec.md:400). Repeating that choice while claiming to fix it would be incoherent.

---

## R3 — The outbox key collides across attempts

**Decision**: `PendingCommit` gains `attemptNo`, and `main.ts` enqueues under
`` `${entryId}-official-${attemptNo}` ``.

**Rationale**: `src/main.ts:735` currently enqueues with
`` id: `${me.id}-official` `` — a fixed key per entry. The IndexedDB store uses
`keyPath: 'id'` and `put()`, so **a second attempt queued while the first is still
pending overwrites the first**. On lodge wifi, which is the exact scenario the outbox
exists for (FR-046, FR-048), a player takes attempt one, the commit queues, he takes
attempt two, and attempt one's score is gone before it was ever sent. If attempt one was
his best, the feature has silently destroyed the thing it promises to keep.

This is not a new bug — it is correct today, because one entry can only ever have one
official commit. It becomes a bug the moment the feature lands, which is why it is
Phase 0 work and not an implementation detail.

**Alternatives considered**: a random UUID per commit. Rejected — it works, but it loses
the property that the key is derivable from `(entry, attempt)`, which is what lets a
reload reason about what is already queued without reading the rows. The composite key
is both unique and meaningful.

---

## R4 — The snapshot silently keeps the wrong score

**Decision**: `snapshot()` reduces each entry's score rows to the best attempt — highest
score, ties broken by earliest `commit_at` — rather than building a map keyed by entry.

**Rationale**: `src/state/supabase.ts:137` builds
`new Map((scoreRes.data ?? []).map((s) => [s.entry_id, s]))`. A `Map` constructed from
pairs keeps the **last** value for a duplicated key. With one row per entry that is
exact; with three it silently ranks the player on whichever row PostgREST happened to
return last — no error, no warning, just the wrong bed order. Ordering without an
`ORDER BY` is unspecified, so it would not even be consistently wrong, which is worse
than being reliably wrong because it will not reproduce.

The reduction also implements **FR-236**: the timestamp carried forward is the one from
the best attempt, not the most recent, which is what makes the tiebreak refuse to punish
a player for taking attempts he was entitled to.

**Alternatives considered**: sorting server-side and taking the first row per entry.
Rejected — PostgREST has no clean per-group limit, and pushing it into a view means
another database object to migrate and keep in step. The reduction is four lines of
pure TypeScript that `tests/unit/ordering.test.ts` can exercise directly, which fits how
this project already tests the bed-order rules ("they get their own unit tests rather
than being verified through the UI" — `ordering.ts:6`).

---

## R5 — What ranks, and how ties break

**Decision**: Rank on the best attempt's score. Ties break by that attempt's
`commit_at`. Ties surviving both remain unresolved for a coin flip, unchanged.

**Rationale**: settled in the spec (FR-232, FR-236) with the reasoning recorded there —
using the most recent attempt's timestamp would let a player lose a tiebreak he had
already won by taking an attempt he was entitled to. Noted here only because it
constrains R4: the reduction must carry the timestamp along with the score, so a later,
lower attempt cannot drag the tiebreak with it.

`computeStandings` (`src/state/ordering.ts:64`) already sorts by
`b.score - a.score || a.commitAt.localeCompare(b.commitAt)` and needs **no change at
all** once `EntryView.score` and `EntryView.commitAt` describe the best attempt rather
than the only one. That is a deliberate consequence of doing the reduction upstream in
R4 rather than teaching the ranker about attempts.

---

## R6 — Local mode must mirror every rule

**Decision**: `src/state/localDraft.ts` implements the attempt dispenser, the 1..3
refusal, and the best-of reduction, matching the database exactly.

**Rationale**: local mode is what runs when no Supabase project is configured, and it is
what the `test:build` smoke journey drives. It already mirrors the unique index
(`submitCommit` refuses a second commit) and the roster cap, with comments naming the
constraint each one mirrors. A local mode that grants unlimited attempts would make the
smoke gate assert the wrong behaviour, and Principle VI is explicit that verification
against a convenient approximation is not verification.

**Risk accepted**: two implementations of one rule can drift. Mitigated by
`tests/contract/storage.test.ts`, which exists to hold both backends to one contract,
and by the invariant tests running the real schema in CI.

---

## R7 — Migration strategy

**Decision**: One new migration, `supabase/migrations/0005_best_of_three.sql`, additive
and safe to run on its own against an existing project. Appended to
`supabase/setup.sql`, which is a hand-maintained concatenation.

**Shape**:

1. Add the attempt counter column to `roster_entry`, defaulting from today's binary
   status so an existing row converts correctly.
2. Add `attempt_no` to `committed_score`, backfilling existing rows to 1.
3. Drop `committed_score_one_per_entry`; create `UNIQUE (draft_id, entry_id, attempt_no)`
   and the `CHECK (attempt_no between 1 and 3)`.
4. Create `start_official_attempt(...)` as `security definer`; grant execute to `anon`.
5. Revoke direct UPDATE on the attempt counter column from `anon`.

**Rationale**: the organizer pastes SQL by hand — the README documents exactly this for
`0003_organizer.sql` and `0004_rules_freeze.sql` — so the migration must be correct when
run alone, not only as part of a fresh `setup.sql`. Steps 1 and 2 backfill rather than
assume an empty table, because "the draft is not live" is true today and will not be
true for the next one.

**Verification**: CI's "Storage invariants against real Postgres" job applies
`supabase/setup.sql` exactly as an organizer would paste it and then runs
`supabase/tests/invariants.sql`. This is the Principle VII gate and it already exists;
the work is extending `invariants.sql` with the new violations, in the
deliberate-violation style that file already uses.

---

## R8 — The rules version

**Decision**: `2.0.0` → `3.0.0`, set in `tools/gen-courses.ts` for both courses and
regenerated into `data/courses/*.json` via `npm run gen:courses`.

**Rationale**: FR-243 and FR-023. A score earned with one attempt and a score earned as
the best of three are not comparable, which is precisely what the rules version exists
to express. Major rather than minor because the change is to what a score _means_, not
to how it is computed.

**Sequencing hazard**: the freeze trigger compares a submission's version against the
draft's. A draft seeded before the bump refuses every commit after it, with the yellow
"rules version mismatch" line the README already documents as a known trap. The draft is
not live (spec Assumptions), so this is safe — but the bump and the rule must ship
together, and any draft seeded from an older `seed-draft.sql` must be reseeded.

---

## R9 — What the player is told

**Decision**: The menu states attempts remaining before the first attempt is taken, and
after each. The leaderboard distinguishes a player with attempts remaining from one who
is finished (FR-239).

**Rationale**: FR-234 introduces a failure the player has never seen — an attempt that
refuses to start because shared storage could not record it as spent. Principle VI
requires every reachable failure state to be produced deliberately in a test and to
render a message naming the cause and the remedy. "Could not start your attempt — you
have not lost it. Check your connection and try again" is the shape; the remedy matters
because the player's instinct on a failed start will otherwise be to assume he has been
charged for it.

The leaderboard already carries live run state (`PRACTISING (n/3)`,
`READY — NOT YET OFFICIAL` in `src/ui/leaderboard.ts:59`), so attempt state extends an
existing idiom rather than adding one. FR-055 applies: attempts remaining must not be
carried by colour alone.
