# Ski Game

A 1980s graphic novel-themed skiing and snowboarding game where players compete for
glory.

> **Working title.** "Ski Game" is a placeholder — see `TODO(PRODUCT_TITLE)` in the
> constitution.

## Status

**Pre-implementation.** The project constitution is ratified at v1.0.0. No game code
exists yet, and the engine and target platforms are deliberately not yet chosen —
see `TODO(TARGET_PLATFORM_BASELINE)`.

The next step is `/speckit-specify` to define the first playable slice.

## What this project is

Two disciplines — skiing and snowboarding — in one coherent world rendered in the
visual language of 1980s graphic novels: limited palette, heavy linework, halftone
screen tone, panel framing, and sound-effect lettering. Players race, trick, and
post scores to leaderboards where the standings can actually be trusted.

## Governing principles

Development is governed by [the project constitution](.specify/memory/constitution.md).
All five principles are binding; the first is non-negotiable.

| # | Principle | In short |
|---|---|---|
| I | Spec-Driven Delivery **(NON-NEGOTIABLE)** | No production code merges without an approved spec. Every task traces to a numbered requirement. |
| II | Stability Before Content | Deterministic simulation, no crashes on any input, frame budget held, saves never corrupted. |
| III | Fun Is a Testable Requirement | Every mechanic defines measurable feel criteria. Tuning lives in data files, never in code. |
| IV | One Coherent 1980s Graphic Novel Voice | A style bible is the single source of truth. Legibility outranks style. |
| V | Fair and Verifiable Competition | Every scored run is reproducible and replay-verified. Client scores are never trusted. |

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
```

## Working in this repo

Requires [Git](https://git-scm.com/), [Claude Code](https://claude.com/claude-code),
and the Spec Kit CLI:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

`.gitattributes` pins `*.sh` to LF endings. This is deliberate: with
`core.autocrlf=true` on Windows, the Spec Kit workflow scripts would otherwise be
checked out with CRLF and fail under bash with `$'\r': command not found`. Do not
remove that rule.
