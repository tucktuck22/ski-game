# Architecture Decision Records

Decisions that shape this project are recorded here as ADRs, in
[Michael Nygard's format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
**Context** (the forces in play), **Decision** (what we chose, in active voice),
**Consequences** (what becomes easier and what becomes harder).

## Why these exist alongside the specs

Specs say what the product does. ADRs say why it does it that way, and what was
given up. A spec that changes loses its history; an ADR is immutable once accepted
and is superseded by a later ADR rather than edited.

## Rules

- One decision per record. Numbered sequentially, never reused.
- Filenames are `NNNN-title-in-kebab-case.md`.
- Status is one of **Proposed**, **Accepted**, **Superseded by ADR-NNNN**, or
  **Rejected**. Accepted records are not rewritten — supersede them instead.
- Consequences must include the costs. A record listing only benefits is incomplete.
- A decision that changes the project constitution is proposed here first, then
  applied through the constitution's own amendment procedure once approved.

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | 2026-09-01 |
| [0002](0002-abandoned-official-runs-are-discarded.md) | Abandoned official runs are discarded, not committed | Accepted | 2026-09-01 |
| [0003](0003-practice-uses-a-separate-warm-up-course.md) | Practice runs use a separate warm-up course | Accepted | 2026-09-01 |
| [0004](0004-accept-client-reported-scores.md) | Accept client-reported scores without verification | Accepted | 2026-09-01 |
| [0005](0005-trust-the-players.md) | Trust the players — amend Principle V | **Proposed** | 2026-09-01 |
| [0006](0006-platform-baseline-and-budgets.md) | Evergreen mobile web, hand-written simulation, mid-range phone as reference | Accepted | 2026-09-01 |
| [0007](0007-keep-the-free-database-awake.md) | Keep the free database awake with a scheduled Action | Accepted | 2026-09-01 |
