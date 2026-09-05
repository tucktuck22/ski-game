# 10. A ninth colour

Date: 2026-09-04

## Status

Accepted. Amends `assets/style-bible.md` section 1. Governing feature:
[specs/004-skier-sprite-animation](../../specs/004-skier-sprite-animation/spec.md).

## Context

The style bible has said the same thing since ratification:

> Eight colours. Nothing outside this set appears in any asset.

That was not an accident or a rough guide. It is enforced: `tests/unit/palette.test.ts`
asserts the token set **exhaustively**, so a ninth colour could not be added to
`src/render/palette.ts` without a test failing and somebody having to decide.

Feature 004 replaces the player — six rectangles and a polygon — with a drawn pixel-art
character supplied by the maintainer. The character carries shading ramps and a skin
tone that are not among the eight. Constitution Principle IV makes the style bible the
single source of truth for palette, and FR-052 requires every asset to cite the rule it
satisfies at review. This sheet could cite no such rule.

That left two honest exits, and one dishonest one. The dishonest exit — ship the asset
and quietly not apply the rule to it — was never on the table, because a rule that is
enforced everywhere except where it is inconvenient is not a rule.

## Decision

**Section 1 gains exactly one token: `skin`, `#ECB291`.** Everything else in the sheet
is quantised to the resulting nine. The palette remains an exhaustive enumeration, and
the test that asserts it is **tightened to nine, never loosened**.

A new rule **P-6** confines the token to player sprites: never a ground, never text,
never a terrain edge, never a hazard marking, never UI.

The value is **sampled from the supplied art**, not invented — the mean of the sheet's
warm face pixels, measured off the committed source. A colour picked to look right and
then written down forever, with nobody able to say where it came from, is how palettes
rot.

## Alternatives considered

**Quantise the face to the existing eight.** Genuinely simpler, and it stays available
if this is ever reversed. It was offered and declined: the face would have had to
become `snow` or `yellow`, which is a visible cost to the one thing in the game drawn
as a person.

**Admit a bounded shading ramp for the player sprite.** Rejected, and this is the
reasoning worth keeping. A ramp allowance is a rule about _how many tones is too many_,
and nobody can enforce that at review — it turns a machine-checkable property into a
judgement call, and judgement calls drift asset by asset, which is exactly what
Principle IV exists to prevent. A ninth **named** colour either appears in a file or it
does not.

That distinction is what makes the enforcement possible at all: sheets ship as 8-bit
indexed PNG, so `tests/unit/sprite-palette.test.ts` reads the `PLTE` chunk and a tenth
colour is _unrepresentable in the file_ rather than merely absent from the pixels
anyone happened to look at.

## Consequences

- The palette is nine colours. `PALETTE`, the section 1 table, and the exhaustive test
  all move together, and FR-180 requires them to ship in one change set — a bible that
  disagrees with a shipped asset is a defect under Principle I.
- `skin` is held to the same CVD separation from `orange` as `magenta` is (FR-182). A
  skin tone that collapsed into the hazard colour would reintroduce the confusion P-4
  exists to prevent. `#ECB291` clears the threshold by a wide margin — its separation
  from `orange` is _greater_ than `magenta`'s under all three simulated deficiencies.
  If a future sheet's skin tone fails that check, **the art changes, not the
  threshold.** The bible already records `orange` being darkened from `#FF7A29` for
  precisely this reason; that precedent is the one to follow.
- This does not authorise a tenth colour anywhere. Every other asset stays inside the
  original eight, and P-6 keeps the ninth on the player.
- The precedent this sets is procedural, not permissive: the palette may change, in
  public, with a recorded reason and its enforcement updated in the same breath. It
  follows [ADR-0009](./0009-recorded-music.md), which did the same for rule A-1's ban on
  sampled audio.
