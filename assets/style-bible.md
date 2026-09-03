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
| `orange`  | `#FC6008` | Warning. Obstacle and hazard edges                     |
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
- **LW-4** — Terrain gets a 1px `cyan` top edge. That edge is the contact line the
  physics actually uses; it must never be decorative. Beneath it sits a `snow`
  band of a few pixels — the snowpack — and beneath that the `ink` body. The
  band was added when the mountain was a black wedge that read as a cliff; the
  cyan edge is unchanged and still wins against anything drawn near it.
- **LW-5** — The upper track gets the same 1px `cyan` treatment on both its top
  edge and its underside, and a visible cut face at each end. A shelf whose ends
  the player cannot see is a shelf he rides off without warning.

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

## 3a. The mountain (rules TR-*)

The run is a side-on cut through a mountainside at dusk. Everything in this
section serves one hierarchy: **the two contact lines and the hazards on them
outrank every other mark on screen.** Backdrop exists to say where you are, not
to be looked at.

- **TR-0** — The sky carries one sunset disc: a `yellow` → `magenta` gradient
  (P-3) slit by widening `purple` bars, low and to one side, occluded by the
  ridge in front of it. One per frame. It is the period's most recognisable mark
  and it costs six rectangles; a second one would cost the frame its subject.
- **TR-1** — Depth is built from five ranks, each anchored to the piste ON SCREEN
  and lifted above it: a capped ridge, a far pine rank, a near ridge, a mid pine
  rank, and a near pine rank standing on the piste itself. Anchoring to the
  visible slope rather than to terrain sampled at the rank's own parallax is not
  a shortcut — the piste descends thousands of world units over a run, and a
  rank sampled at its own offset leaves the frame within seconds.
- **TR-2** — Obstacles are trees, and each reads as its own kind of tree from its
  silhouette alone. A `low` obstacle is an overhanging bough: a tapered limb with
  filled needle wedges hanging to the collision floor, so the shape the player
  sees IS the shape he has to get under. A `solid` obstacle is deadfall: a
  snow-capped log with its end grain out. Neither may be drawn as a rectangle,
  which is what both were before this rule existed.
- **TR-3** — Hazards keep `orange` (P-4) as an edge on the surface that actually
  kills — the underside of a bough, the body of a log — never as a fill over the
  whole silhouette. A tree painted entirely `orange` reads as a warning sign
  rather than as a tree, and loses the shape TR-2 is buying.
- **TR-4** — A ramp is never drawn in `snow` alone. Snow on snow is invisible, and
  a ramp is the one object that launches the player without being asked, so it
  carries `yellow` hazard stripes, chevrons, and a marked lip.
- **TR-5** — Snowfall is three parallax depths of 1–2px `snow` marks on fixed
  world columns. It is dropped entirely under reduced motion, not slowed: a slow
  blizzard is still a blizzard in front of the things the player must read (L-0,
  T-5).
- **TR-6** — Scenery positions come from a hash of the feature's own slot, never
  from a running RNG. A forest re-rolled each frame boils.
- **TR-7** — Nothing in this section may be derived from run state beyond the
  camera and the tick. Backdrop that reacted to score or outcome would be a
  second, unverifiable channel of gameplay information (A-4's argument, applied
  to pixels).
- **TR-8** — The upper track's hazards must read from across the frame, because
  the decision about each is made before the player reaches it. Ice is drawn as a
  different material from snow — opaque `cyan`, not a tint over the shelf — and
  marked at both ends with `orange` posts standing proud of the shelf. The posts
  are what actually carry: the shelf is six pixels seen edge-on, and a tint on
  six pixels is invisible at speed, which is how the first version shipped a
  hazard nobody could see coming.
- **TR-9** — A rock is a vertical dark wedge with an `orange` crest; deadfall is
  a horizontal `orange` barrel. They are the two obstacles a player clears the
  same way, so they are drawn as differently as the palette allows — at speed,
  two hazards that answer to the same verb must still never trade places in his
  head (P-5).
- **TR-10** — Ice that has given way is drawn as nothing at all. The simulation
  will not catch anybody there, and a picture that disagreed would be worse than
  no picture: the player would aim a landing at snow that is not there.

---

## 4. Lettering (rules LT-*)

- **LT-1** — Titles are chrome: `snow` core, `cyan` upper bevel, `magenta` lower
  bevel, `ink` outline. Titles only — never body copy.
- **LT-2** — Body and HUD text is a 5 × 7 pixel face in `snow`, unbevelled, unbloomed.
- **LT-3** — Sound-effect lettering (WIPEOUT, SEND IT, and the trick badges —
  NICE, COOL, SICK, WHOA) is `yellow` on `ink` with a hard `magenta` drop at 1px
  offset. The points beside a badge are `snow` and the multiplier note `cyan`:
  the shout is the loudest thing on the badge, and the figures are read after
  it, not instead of it.
- **LT-6** — Score feedback survives reduced motion. A badge or indicator that
  carries points is information, not decoration, so what is dropped is its
  movement and never its message (FR-130, and feature 001's FR-056).
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
