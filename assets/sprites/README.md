# Sprite provenance

**Status**: current. Nothing in `public/sprites/` may ship without an entry here.

Style-bible rule **A-5** requires a recorded music asset to cite its provenance in a
README establishing it as an original work the project owns. The reasoning is not
specific to audio — rule **O-1** covers art in the same breath — so sprites are held
to the same standard, and feature 004's **FR-170** makes it explicit: an asset whose
provenance is not recorded here cannot pass review under FR-052.

A statement in a chat message is the right claim in the wrong place. It has to live in
the repository, next to the thing it describes, where a reviewer two years from now
can find it.

## The register

| Sheet       | Source                          | Supplies                                   | Author     | Recorded   |
| ----------- | ------------------------------- | ------------------------------------------ | ---------- | ---------- |
| `skier.png` | `skier.source.png`              | The three carve leans                      | Maintainer | 2026-09-04 |
| `skier.png` | `skier-poses.source.png`        | Launch, air, tuck, spin, the three absorbs | Maintainer | 2026-09-04 |
| `skier.png` | `skier-crouch-leans.source.png` | The three crouch leans                     | Maintainer | 2026-09-04 |
| `skier.png` | `skier-wipeout.source.png`      | The wipeout                                | Maintainer | 2026-09-04 |

**Claim of origin**: every source above is an original work created by the project
maintainer for this product. They reproduce no third-party character, logo, trademark,
wordmark, or existing artist's work. Period-_style_, never period-_property_ (O-1).

## How the shipped sheet is made

`public/sprites/skier.png` is **derived**, never hand-edited. Rebuild it with:

```bash
npm run build:sprites
```

`tools/build-sprite-sheet.mjs` composes the shipped sheet from all four sources. It is
deterministic, and `tests/unit/sprite-palette.test.ts` runs it and compares bytes — so
a sheet edited by hand, or a source changed without a rebuild, fails CI rather than
drifting quietly.

**Frames are found, not indexed by grid.** The first version measured a pixel grid off
one sheet and cut on those constants; that worked for exactly one file and broke on the
next, because every generated sheet lays its cells out differently. The tool now finds
each character by connected components over "saturated or near-black" pixels. Greys —
the backing, the cell fill, the ground line, any caption text — are neither, so they
fall out for free, and **a new source needs no new constants**. Frames come out in
reading order, which is what the `SOURCES` table indexes into.

Two details that are load-bearing rather than incidental:

- **Colour is a majority vote over already-quantised pixels, never an average.**
  Averaging is the obvious approach and it is wrong for high-contrast pixel art
  outlined in near-black: the mean of an outline and the bright suit beside it is a mid
  purple. An earlier build did exactly that and turned the magenta helmet purple.
- **`orange` is excluded from the player sheet's quantisation set**, so P-4 — hazards
  are orange, the player never is — holds by construction rather than by review. An
  earlier build put the hazard colour on the skier's face.

### About the sources

All four are 1399x752 RGBA renders rather than native indexed pixel-art exports, so
they carry lossy compression noise — the first one measured 102,393 distinct colours
with its flat grey backing smeared across `#c9c9c9`-`#d1d1d1`. The pipeline copes, and
a **native export from the drawing tool would still produce a cleaner sheet**; re-running
`npm run build:sprites` against one is the cheapest quality win available here.

### Coverage

All fourteen poses are drawn art. Nothing is a stand-in and nothing is derived by
rotating another frame (FR-185). Carve and crouch each have three separate drawings at
different ski angles, which is what FR-183 asks for.

The one honest limitation: at the crouch's 13px height the three lean variants differ
by well under a pixel across most of the body, so the distinction is real in the source
and only marginally visible in the game. That is a consequence of matching
`crouchHeight` rather than a defect in the art, and it costs nothing — the pose still
reads as a crouch at every angle.

## What a new sprite must do

1. Retain its editable source here (FR-171, and the constitution's asset-management
   clause: source files for derived assets MUST be retained).
2. Add a row to the register above.
3. Ship as 8-bit indexed PNG in `public/sprites/`. `tests/unit/sprite-palette.test.ts`
   reads the `PLTE` chunk and fails on any colour outside the palette declared in
   [`assets/style-bible.md`](../style-bible.md) section 1 — the directory is scanned,
   so a new sheet inherits the gate by existing rather than by being registered.
4. Declare itself in [`data/sprites.json`](../../data/sprites.json), with a **bare
   filename**: the base path is applied in `src/render/sprites.ts` and nowhere else.
5. Cite the style-bible rules it satisfies at review (FR-052).
