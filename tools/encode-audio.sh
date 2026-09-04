#!/usr/bin/env bash
#
# Transcode the music masters into the assets that actually ship.
#
# The masters in assets/audio/masters/ are ~192 kbps stereo and total 7.09 MiB,
# which is 3.5x the constitution's entire 2 MB gzipped payload budget. MP3 is
# already compressed, so gzip recovers nothing. Mono at 96 kbps halves the
# channel count while preserving the per-channel bitrate, and lands the pair
# near 3.5 MiB (FR-150, SC-049).
#
# The shipped files go to public/, which Vite copies verbatim without adding
# them to the bundle graph. That is what keeps them out of the initial payload
# (FR-146). They are fetched at runtime from import.meta.env.BASE_URL.
#
# Principle VII: this script is a deliverable. Read what it prints. An exit code
# of zero while emitting a 6 MiB file is a failure, which is why it checks the
# total itself and fails loudly rather than leaving that to a human's attention.
#
# Re-encoding INVALIDATES the loopStart/loopEnd offsets in data/audio.json:
# they are measurements of a specific encode's silence padding, not of the
# music. Re-measure after running this. See specs/003-recorded-music-tracks/
# research.md R3.

set -euo pipefail

cd "$(dirname "$0")/.."

readonly MASTERS="assets/audio/masters"
readonly SHIPPED="public/audio"
readonly BITRATE="96k"
# SC-049: 4 MiB for the pair, raised from 2 MiB on 2026-09-04 so that neither
# piece has to be trimmed. Headroom is ~13%, which is enough for encoder
# variance and not enough for a third piece.
readonly CEILING_BYTES=$((4 * 1024 * 1024))

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is not installed. It is needed only for this script, not for the" >&2
  echo "build or the tests. Install it and re-run." >&2
  exit 1
fi

mkdir -p "$SHIPPED"

encode() {
  local src="$1" dst="$2"
  if [ ! -f "$src" ]; then
    echo "missing master: $src" >&2
    exit 1
  fi
  # -ac 1        mono
  # -b:a 96k     constant bitrate, so size is predictable from duration
  # -map_metadata -1 / -write_xing 0
  #              strip tags and the Xing header. Neither is needed at runtime,
  #              and both add bytes to a file measured against a ceiling.
  ffmpeg -hide_banner -loglevel error -y \
    -i "$src" -ac 1 -b:a "$BITRATE" -map_metadata -1 -write_xing 0 \
    "$dst"
  printf '  %-28s %8s KiB  ->  %-24s %8s KiB\n' \
    "$(basename "$src")" "$(( $(stat -c%s "$src") / 1024 ))" \
    "$(basename "$dst")" "$(( $(stat -c%s "$dst") / 1024 ))"
}

echo "Transcoding masters to mono ${BITRATE} (FR-150):"
encode "$MASTERS/look-out-below.master.mp3" "$SHIPPED/look-out-below.mp3"
encode "$MASTERS/powder-rush.master.mp3"    "$SHIPPED/powder-rush.mp3"

total=0
for f in "$SHIPPED"/look-out-below.mp3 "$SHIPPED"/powder-rush.mp3; do
  total=$((total + $(stat -c%s "$f")))
done

printf '\nShipped total: %s KiB of %s KiB (SC-049)\n' \
  "$((total / 1024))" "$((CEILING_BYTES / 1024))"

if [ "$total" -gt "$CEILING_BYTES" ]; then
  echo >&2
  echo "FAIL: over the SC-049 ceiling by $(( (total - CEILING_BYTES) / 1024 )) KiB." >&2
  echo "Trim powder-rush rather than dropping the bitrate: the longest possible" >&2
  echo "run is 76.9 s and the piece is 220.1 s, so no player can perceive the" >&2
  echo "loss. See specs/003-recorded-music-tracks/research.md R1." >&2
  exit 1
fi

printf 'PASS: %s KiB of headroom.\n\n' "$(( (CEILING_BYTES - total) / 1024 ))"
echo "Next: re-measure the loop offsets in data/audio.json against the files just"
echo "written. They are properties of this encode, not of the masters, and shipping"
echo "stale ones produces the audible seam SC-040 forbids."
