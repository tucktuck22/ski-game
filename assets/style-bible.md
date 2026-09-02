# Shredpocalypse '86 — Style Bible

**Status**: Authoritative. Constitution Principle IV makes this the single source of
truth for palette, linework, tone, lettering, framing, and audio character.

**How to use it**: every asset cites the rule it satisfies at review (FR-052). An
asset that cannot cite a rule is rejected, not merged with a promise to fix later.

> **Rule L-0 — legibility outranks style.** Any treatment in this document may be
> reduced where it obscures information a player needs to complete a run or read
> the standings. This rule wins against every other rule here. It is first because
> period-authentic treatment — heavy halftone, dense scanlines, saturated neon on
> saturated neon — actively harms readability at speed, which is precisely when
> this game is read.

---

## 1. Palette (rules P-*)

Eight colours. Nothing outside this set appears in any asset.

| Token     | Hex       | Role                                                   |
| --------- | --------- | ------------------------------------------------------ |
| `ink`     | `#0B0616` | Ground. Backdrop, panel fill, gutter                   |
| `purple`  | `#2B1055` | Secondary ground. Sky gradient base, panel border      |
| `magenta` | `#FF2D95` | Primary accent. Player, active state, title lettering  |
| `cyan`    | `#22E8F5` | Secondary accent. Terrain edge, pickups, confirmations |
| `blue`    | `#4361FF` | Tertiary. Sky gradient top, inactive UI                |
| `orange`  | `#FC6008` | Warning. Obstacles, barriers, hazard edges             |
| `yellow`  | `#FFD23F` | Alert and score. Wipeout lettering, HUD score          |
| `snow`    | `#F2F0FF` | Body text, snow surface, high-contrast marks           |

- **P-1** — Grounds are `ink` and `purple` only. Accents never fill a full background.
- **P-2** — Body text is `snow` on `ink` or `purple`. Never accent-on-accent.
- **P-3** — Gradients run `purple` → `blue` (sky) or `magenta` → `orange` (sunset)
  only. No three-stop gradients.
- **P-4** — Hazards are `orange`; they are never `magenta`, which is the player.
  `orange` is a deep vermilion rather than the brighter tone first drafted: at
  `#FF7A29` it sat at the same red value as `magenta` and the two collapsed under
  tritanopia, which `tests/unit/palette.test.ts` caught. Do not lighten it back
  toward yellow-orange without re-running that test.
- **P-5** — No information is carried by hue alone (FR-055). Every colour-coded
  state also differs in shape, position, or lettering. A player with any colour
  vision deficiency loses nothing. Verified by `tests/unit/palette.test.ts`.

### Colour vision validation

`tests/unit/palette.test.ts` asserts, and CI enforces:

- Every text pairing permitted by P-2 meets WCAG AA (≥ 4.5:1) for normal text.
- Player `magenta` and hazard `orange` remain distinguishable under simulated
  protanopia, deuteranopia, and tritanopia — **and** P-5 makes that redundant by
  requiring a shape difference anyway.

---

## 2. Linework (rules LW-*)

- **LW-1** — Outlines are 1 device pixel at the 320 × 180 internal resolution.
  Never 2. The upscale does the weight.
- **LW-2** — Every sprite carries a full outline in `ink` or `snow`. No open silhouettes.
- **LW-3** — The player silhouette reads at 16 × 16 with no interior detail. Interior
  detail is a bonus at rest, never a requirement in motion.
- **LW-4** — Terrain gets a 1px `cyan` top edge over an `ink` fill. That edge is the
  contact line the physics actually uses; it must never be decorative.

---

## 3. Tone and texture (rules T-*)

- **T-1** — Halftone is a 2 × 2 ordered dither in a single accent over `ink`. No
  photographic gradients.
- **T-2** — Scanlines are 1px alternating rows at ≤ 18% opacity. Above that they eat
  the 1px linework of LW-1 and violate L-0.
- **T-3** — Bloom applies to `magenta`, `cyan`, and `yellow` only, at ≤ 30% and
  never on text.
- **T-4** — Chromatic fringing is ≤ 1px and never applied to HUD or menu text.
- **T-5** — Every effect in this section is disabled by reduced motion (FR-056) and
  the game must remain fully playable and scoreable without them.

---

## 4. Lettering (rules LT-*)

- **LT-1** — Titles are chrome: `snow` core, `cyan` upper bevel, `magenta` lower
  bevel, `ink` outline. Titles only — never body copy.
- **LT-2** — Body and HUD text is a 5 × 7 pixel face in `snow`, unbevelled, unbloomed.
- **LT-3** — Sound-effect lettering (WIPEOUT, SEND IT) is `yellow` on `ink` with a
  hard `magenta` drop at 1px offset.
- **LT-4** — Insult copy is R-rated in register and never uses slurs or content
  targeting protected characteristics (FR-059). Profane, not hateful.
- **LT-5** — Minimum rendered text height is 7 device pixels post-upscale.

---

## 5. Framing (rules F-*)

- **F-1** — Menus, results, and transitions use comic panels: `purple` 1px border,
  `ink` fill, 4px `ink` gutter (FR-053).
- **F-2** — Captions sit in boxes in the panel's top-left, `snow` on `ink`.
- **F-3** — The run itself is unpanelled. The mountain fills the frame; panels are
  for everything around it.
- **F-4** — Transitions are panel wipes, never fades. A fade is not a comic idiom.

---

## 6. Audio (rules A-*)

- **A-1** — All audio is synthesised at runtime via Web Audio (FR-053). No sampled
  or licensed material of any kind.
- **A-2** — Voices: two pulse leads, one triangle bass, one noise percussion. This
  is the whole instrument set.
- **A-3** — Silent until a deliberate player gesture, with a persistent mute toggle
  thereafter (FR-054).
- **A-4** — Every cue carrying gameplay information has a visible equivalent
  (FR-058). Audio is never the only channel.

---

## 7. Original work only (rule O-1)

- **O-1** — All art and audio are original works in period style. No third-party
  characters, logos, trademarks, wordmarks, or musical material appears, and no
  existing artist's work is reproduced. Period-_style_, never period-_property_.
