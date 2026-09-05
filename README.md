# Ski Game

A 1980s graphic novel-themed skiing and snowboarding game where players compete for
glory.

> **Working title.** "Ski Game" is a placeholder — see `TODO(PRODUCT_TITLE)` in the
> constitution.

## Status

**Planned, not yet built.** The project constitution is at v1.1.0. No game code
exists yet, but the platform baseline is now fixed: the evergreen mobile web, no
game engine, with a 2022-era mid-range phone as reference hardware and binding
performance budgets.

The first feature is specified and planned: **Shredpocalypse '86**, a web-based 2D
side-on skiing platformer whose final leaderboard is the bed-selection draft order
for an eight-person ski trip. See
[`specs/001-shredpocalypse-bed-draft/`](specs/001-shredpocalypse-bed-draft/) for the
spec, research, data model, contracts, and validation guide.

The next step is `/speckit-tasks`.

## What this project is

Two disciplines — skiing and snowboarding — in one coherent world rendered in the
visual language of 1980s graphic novels: limited palette, heavy linework, halftone
screen tone, panel framing, and sound-effect lettering. Players race, trick, and
post scores to leaderboards whose runs are reproducible from their seed and inputs.
How far that reproducibility is enforced depends on who is competing — see the note
on trust below.

## Governing principles

Development is governed by [the project constitution](.specify/memory/constitution.md).
All five principles are binding; the first is non-negotiable.

| #   | Principle                                 | In short                                                                                                 |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| I   | Spec-Driven Delivery **(NON-NEGOTIABLE)** | No production code merges without an approved spec. Every task traces to a numbered requirement.         |
| II  | Stability Before Content                  | Deterministic simulation, no crashes on any input, frame budget held, saves never corrupted.             |
| III | Fun Is a Testable Requirement             | Every mechanic defines measurable feel criteria. Tuning lives in data files, never in code.              |
| IV  | One Coherent 1980s Graphic Novel Voice    | A style bible is the single source of truth. Legibility outranks style.                                  |
| V   | Fair and Verifiable Competition           | Every scored run is reproducible. Public leaderboards are replay-verified and never trust client scores. |

The constitution is at **v1.1.0**; see its Sync Impact Report for what changed.

### A note on trust

The first feature is a private draft among eight friends, and it accepts scores as
reported by the player's device — no replay verification, no accounts, nothing
stopping anyone who opens developer tools. That is a deliberate choice, recorded in
[ADR-0004](docs/adr/0004-accept-client-reported-scores.md), and it is currently a
documented deviation from Principle V as ratified.
[ADR-0005](docs/adr/0005-trust-the-players.md) proposes amending Principle V so that
verification scales with who is competing: trust among people who know each other,
replay verification on anything public. Until that amendment is approved, the summary
row above describes the ratified rule and the shipped product will not follow it.

Determinism is preserved either way, so verification remains buildable later without
redesigning the simulation.

Two of these are load-bearing on each other: **determinism** (II) is what makes
replay verification (V) and reproducible feel-tuning (III) possible at all. It cannot
be retrofitted onto a nondeterministic simulation, which is why it is a constraint
from day one rather than a later concern.

## Workflow

This repository uses [GitHub Spec Kit](https://github.com/github/spec-kit) for
spec-driven development. The normal sequence:

```
/speckit-specify   ->  define a feature's observable behavior
/speckit-plan      ->  choose the technical approach
/speckit-tasks     ->  break the plan into ordered tasks
/speckit-implement ->  execute the tasks
```

Supporting commands: `/speckit-clarify` (resolve spec ambiguity before planning),
`/speckit-analyze` (cross-artifact consistency check), `/speckit-checklist`
(requirements-quality checklist), `/speckit-converge` (find unbuilt work).

The constitution itself is amended with `/speckit-constitution`.

## Layout

```
.specify/
  memory/constitution.md   the governing document
  templates/               spec, plan, tasks, checklist scaffolds
  scripts/bash/            workflow scripts (LF endings enforced)
  workflows/               Spec Kit workflow definitions
.claude/skills/            the speckit-* commands, tracked for collaborators
specs/                     feature specifications and their quality checklists
docs/adr/                  architecture decision records
```

## Working in this repo

Requires [Git](https://git-scm.com/), [Claude Code](https://claude.com/claude-code),
and the Spec Kit CLI:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

Decisions with lasting consequences are recorded as ADRs in
[`docs/adr/`](docs/adr/). Read [ADR-0001](docs/adr/0001-record-architecture-decisions.md)
for when a decision earns one.

### Running a real draft

The shared state lives in a Supabase free-tier project. Set `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY` as **GitHub repository secrets** — the deploy
workflow builds with them, and the keep-alive workflow uses them.

Both values are public by design: there are no accounts, and Row Level Security
is what enforces the rules. Without them the app runs in a clearly-labelled
local session that is not a real draft.

If your project was set up before the organizer functions existed, the organizer
panel's REMOVE, deadline and RESET controls will be refused by the database —
they need `supabase/migrations/0003_organizer.sql`, which is safe to run on its
own against an existing project (it only creates functions and grants). See
[ADR-0010](docs/adr/0010-organizer-actions-as-secret-gated-functions.md) for why
they are functions rather than table writes.

If official runs are refused with a **rules version mismatch**, the draft was
seeded before a change to the simulation and is still holding the old version.
FR-023 freezes the rules per draft and the database enforces it, so the refusal
is the check working rather than a bug in the commit path. Run
`supabase/fix-rules-version.sql` on a draft that has no committed scores yet; it
refuses to touch one that has, because moving the version under scores already
posted would put two rule sets on one leaderboard.

**The keep-alive workflow is not optional.** A free Supabase project pauses
after 7 days without database activity and needs a manual restore, which would
leave the link dead exactly when everyone finally gets round to playing. A daily
scheduled query prevents it — see
[ADR-0007](docs/adr/0007-keep-the-free-database-awake.md).

`.gitattributes` pins `*.sh` to LF endings. This is deliberate: with
`core.autocrlf=true` on Windows, the Spec Kit workflow scripts would otherwise be
checked out with CRLF and fail under bash with `$'\r': command not found`. Do not
remove that rule.
