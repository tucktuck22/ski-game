# Audio assets

## Provenance (FR-148, FR-053, style-bible O-1)

FR-053 and style-bible rule O-1 permit only original work: no third-party music, and
no reproduction of an existing artist's work. FR-148 requires that claim to be
recorded here rather than left in a conversation, so that a reviewer can check it
later.

| Asset                               | Piece          | Origin                                   | Recorded   |
| ----------------------------------- | -------------- | ---------------------------------------- | ---------- |
| `masters/look-out-below.master.mp3` | Look Out Below | Original work owned by the project owner | 2026-09-03 |
| `masters/powder-rush.master.mp3`    | Powder Rush    | Original work owned by the project owner | 2026-09-03 |

Attested by the project owner on 2026-09-03, in the clarification session recorded in
[`specs/003-recorded-music-tracks/spec.md`](../../specs/003-recorded-music-tracks/spec.md).
No third-party or licensed material is included in either piece.

## Masters versus shipped assets

`masters/` holds the files exactly as delivered. They are **archive only** — nothing
in `src/` loads them, and no build step reads them. They are retained because the
constitution requires it — _"Source files for derived assets MUST be retained"_ — and
because the shipped assets are transcodes that cannot be regenerated without them.

| Piece          | Master (192 kbps stereo) | Shipped (96 kbps mono) | Duration |
| -------------- | ------------------------ | ---------------------- | -------- |
| Look Out Below | 2099 KiB                 | 1239 KiB               | 87.79 s  |
| Powder Rush    | 5162 KiB                 | 2688 KiB               | 220.08 s |
| **Total**      | **7261 KiB**             | **3927 KiB**           | 5:08     |

Measured 2026-09-04. The shipped pair is **3927 KiB against SC-049's 4096 KiB
ceiling — 168 KiB of headroom, about 4%.** That is enough for encoder variance and
nothing else: a longer piece, a stereo encode, or a third track breaches it. Anyone
changing the music must re-run the script and read what it prints.

`tools/encode-audio.sh` produces the shipped files and fails loudly if the pair
exceeds the ceiling. Run it verbatim and read its output — Principle VII, and an exit
code of zero while emitting an oversized file would otherwise pass unnoticed.

**Nothing in the initial payload.** The shipped files live in `public/audio/`, which
Vite copies verbatim without adding them to the bundle graph, and they are fetched at
runtime from `import.meta.env.BASE_URL`. The constitution's 2 MB gzipped ceiling
governs the _initial_ payload and is untouched; SC-049 is a separate self-imposed
budget on the music itself (FR-146, FR-150).

## Loop offsets are properties of the encode

`data/audio.json` carries `loopStart` and `loopEnd` for Look Out Below, measured
against the **shipped** file rather than the master.

They matter more than the usual encoder-padding case. Look Out Below opens with
**0.666 s** of silence and ends with **0.825 s** of it, so looping edge to edge would
insert roughly **1.5 seconds of dead air** at every join — on the one piece a player
hears loop repeatedly, since it plays on the board while everyone reads the standings.
Playback starts at 0 so the intro is heard once; every lap after runs between the
offsets.

**Re-running `tools/encode-audio.sh` invalidates them.** Re-measure with
`ffmpeg -i public/audio/look-out-below.mp3 -af silencedetect=noise=-50dB:d=0.15 -f null -`
and update `data/audio.json`. Shipping stale offsets produces exactly the audible seam
SC-040 forbids.

Powder Rush has no offsets, deliberately: it is 220.08 s and the longest possible run
is 76.9 s, so nobody ever reaches its loop point.

## Large-file handling — outstanding

The constitution requires binary assets to be version-controlled _with large-file
handling configured_. **That half is not done.** These two files are committed as
ordinary Git objects.

They were added from an environment whose network policy denies `lfs.github.com` at
the gateway, so an LFS pointer could be committed locally but never pushed — the
objects themselves had nowhere to go. Committing them plainly was chosen over losing
them, since the masters cannot be regenerated and the environment holding them was
ephemeral.

The fix is `git lfs migrate import --include='*.mp3'` from a machine with LFS
access. It **rewrites history**, so it is much cheaper now — one branch, one
contributor, 7 MiB — than after the repository grows. Whoever does it should also
re-add the LFS filter lines to `.gitattributes`, which were deliberately left out
rather than committed in a state that could not be honoured.

Once LFS is in use, anything checking out this repository needs `git lfs install`
before these files resolve to audio rather than pointer text — CI included:
`actions/checkout` does **not** fetch LFS objects unless `lfs: true` is set. No
workflow needs the masters today, since nothing builds from them, but the workflow
that eventually builds the shipped assets will.

## Sound effects are not here

The launch, land, pickup and wipeout cues remain synthesised at runtime in
`src/audio/synth.ts`, under style-bible rules A-2 and A-4. Feature 003 changes the
music only. A cue carries gameplay information and is paired with a visible
equivalent under FR-058; music carries none and is atmosphere alone.
