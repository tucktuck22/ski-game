# Quickstart: Validating Two Recorded Tracks

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-04

How to prove this feature works. Read the warning first — it is the difference between
evidence and a comfortable feeling.

> **The dev server cannot validate this feature.**
> `vite.config.ts` sets `base` to `/` in dev and `/ski-game/` in production. Every
> audio URL is built from that value. Audio that resolves in dev and 404s in production
> is the expected failure mode here, and it fails **silently** — no blank page, no
> console error a player would see, just no music.
> Principle VI: verification is against the built artifact, at its production base
> path, entered through the URL a player uses. A dev-server check must not be offered
> as evidence and must be rejected at review if it is.

## Prerequisites

```bash
npm ci
```

`ffmpeg` is required for the transcode step only, not for the tests.

## 0. Governance gate — check before anything else

This feature cannot merge without these, and none of them is code. Verify first, so a
working implementation is never mistaken for a mergeable one.

```bash
grep -n "A-1\|A-2" assets/style-bible.md      # must permit original recorded music
ls docs/adr/0009-*.md                          # the ADR recording the A-1 reversal
grep -n "T095" specs/001-shredpocalypse-bed-draft/tasks.md   # must no longer be [x]
cat assets/audio/README.md                     # provenance record (FR-148)
```

The T095 line is the one people skip. It is a documentation correction, independent of
the mute-persistence work that was deferred, and it does not go away with it.

Expected: A-1 permits original recorded music and scopes synthesis to sound effects;
A-2's instrument set is explicitly about synthesised audio; ADR-0009 exists; T095 is
`[ ]` with a note saying where the gesture gate actually landed; the provenance table
names both pieces.

**If any of these is missing, stop.** FR-052 rejects an asset that cannot cite a
style-bible rule, so the feature is unmergeable regardless of how well it plays.

## 1. Produce and check the shipped assets

```bash
bash tools/encode-audio.sh
ls -l public/audio/
du -cb public/audio/*.mp3 | tail -1
```

Expected: `look-out-below.mp3` and `powder-rush.mp3` exist, and the total is **at or
under 4 MiB (4194304 bytes)** — SC-049. At mono ~96 kbps expect roughly 3.5 MiB.

> **Only ~13% headroom.** The 4 MiB ceiling was raised from 2 MiB on 2026-09-04 so
> that neither piece needs trimming, and the projection fits with little to spare.
> **Check the actual number** rather than trusting the projection. If it breaches,
> trimming Powder Rush costs nothing a player can perceive
> ([R1](research.md#r1--how-long-is-a-run-and-does-the-course-music-ever-loop)).

Under Principle VII this script is a deliverable: run it verbatim and **inspect its
output**. An exit code of zero while producing a 4 MiB file is a failure.

## 2. Measure the loop offsets and put them in data

`data/audio.json` ships with placeholder `loopStart`/`loopEnd`. They are properties of
the **shipped encode**, not the master, and re-encoding invalidates them.

Measure the leading and trailing silence in `public/audio/look-out-below.mp3`, set the
offsets just inside it, and update `data/audio.json`. Then confirm by ear — step 5,
scenario G4. Shipping the placeholders produces exactly the audible seam SC-040
forbids.

## 3. Fast checks

```bash
npm run lint
npm run test:unit
```

Expected: clean, and `music-player.test.ts` passes. It
cover the state machine, exclusivity, the failure paths, and the mute round trip —
guarantees G1, G2, G5, G6, G7 in [contracts/audio.md](contracts/audio.md).

They do **not** cover the base path, gaplessness, or anything audible. Do not read a
green unit suite as this feature working.

## 4. The real thing

```bash
npm run build
npx vite preview --base /ski-game/ --port 4173
```

Open **`http://localhost:4173/ski-game`** — deliberately **without** the trailing
slash. That is the URL shape that already broke this project once.

| #   | Do this                                                     | Expect                                                                                                    | Proves             |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Load the page. Touch nothing.                               | Silence. Network tab shows **no** request for either `.mp3`.                                              | G1, FR-146         |
| 2   | Open DevTools → Network, filter `mp3`. Click once anywhere. | `/ski-game/audio/look-out-below.mp3` → **200**. Music starts.                                             | G1, R5 base path   |
| 3   | Move board → OFFICIAL RUN confirmation → NOT YET → board.   | Music continues without restarting.                                                                       | G5, FR-139, SC-042 |
| 4   | Start a practice run.                                       | Front-end piece stops, `powder-rush.mp3` → **200** and plays. Never both at once.                         | G2, FR-136         |
| 5   | Wipe out deliberately.                                      | Course piece continues through the finale, stops at the results panel.                                    | US2 scenario 3     |
| 6   | BACK TO THE BOARD.                                          | Front-end piece plays again, from the beginning.                                                          | US2 scenario 4     |
| 7   | Press SOUND ON to mute.                                     | Music and cues both fall silent. (Reload and it returns — mute is session-scoped by decision, not a bug.) | G7, SC-047         |
| 8   | Unmute mid-piece.                                           | Resumes where it was, not from zero.                                                                      | Edge case, mute    |

Then confirm the payload is genuinely unchanged:

```bash
du -cb dist/assets/*.js dist/assets/*.css | tail -1
```

Expected: **no `.mp3` under `dist/assets/`** — they are in `dist/audio/`, copied from
`public/`, and outside the bundle graph. That is FR-146 and SC-044.

## 5. Listen to the loop

Nothing automated proves G4. Leave the board open past **1:28** and listen through the
join, five times. No gap, no click, no stutter (SC-040).

The course piece is exempt and deliberately so: at 220.1 s against a 76.9 s longest
possible run, its loop join is unreachable. See the asymmetry note in
[contracts/audio.md](contracts/audio.md#the-asymmetry-in-g4-stated-deliberately).

## 6. Prove music cannot break a run

```bash
npx playwright test tests/e2e/music-never-blocks.spec.ts tests/e2e/music-base-path.spec.ts
npm run test:determinism
```

The first blocks every `*.mp3` request and drives a full official run: it must start,
play, end, and commit its score in silence, with no error boundary and no fatal
message (FR-143, SC-043, G6). The second asserts both files resolve **200** at
`/ski-game/`, and would have caught the base-path defect this project already shipped.
The third confirms the simulation is untouched (FR-144, SC-046).

## 7. Budgets, by hand

The constitution requires frame-time, heap and payload enforcement and records that
**no such job exists** (open deviation 3). Until it does, measure by hand and record
the numbers in the change description — Definition of Done item 7 requires the command
and environment to be named, and "verified" without them is not a claim.

With DevTools performance profiling on a run, at 4× CPU throttle:

- Frame time p95 ≤ 16.7 ms, ≥ 50 fps sustained, within 5% of the pre-feature figure
  (FR-145, SC-045).
- Simulation step ≤ 2.0 ms per tick (FR-145).
- Peak JS heap ≤ 150 MB. Decoded audio should account for roughly **16.9 MB** — the
  front-end piece only. If it is nearer 59 MB, the course piece is being decoded
  instead of streamed and [R2](research.md#r2--playback-mechanism) has been
  implemented wrongly.

## 8. Playtest

Principle III and Definition of Done item 6: a human plays it end to end and records
findings against this spec. Two questions only listening can settle:

1. **96 kbps or 64 kbps?** Judge on a phone speaker, not headphones on a laptop.
2. **Are the mix gains right?** The `Synth` cues must stay clearly audible over the
   music — they carry gameplay information and the music carries none (FR-141).

Both `gain` values in `data/audio.json` are opening positions for exactly this, in the
same spirit as `data/tuning.json`.
