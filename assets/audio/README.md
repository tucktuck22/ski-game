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
in `src/` loads them, and no build step reads them.

| Asset          | Duration | Size         | Encoding                          |
| -------------- | -------- | ------------ | --------------------------------- |
| Look Out Below | 1:28     | 2.05 MiB     | MP3, VBR ~196 kbps, 48 kHz stereo |
| Powder Rush    | 3:40     | 5.04 MiB     | MP3, VBR ~192 kbps, 48 kHz stereo |
| **Total**      | **5:08** | **7.09 MiB** |                                   |

They are retained because the constitution requires it — _"Source files for derived
assets MUST be retained"_ — and because the shipped assets are transcodes that cannot
be regenerated without them.

What ships is re-encoded to mono at roughly 96 kbps and fetched on demand, so that
neither piece enters the initial payload. The masters at full size are 3.5× the
constitution's entire 2 MB gzipped payload budget; MP3 is already compressed, so gzip
recovers nothing. See FR-146, FR-150 and SC-049.

**The shipped assets do not exist yet.** Feature 003 is specified, not built.

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
