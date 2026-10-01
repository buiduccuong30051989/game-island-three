#!/usr/bin/env bash
# Sinh audio tiếng Việt offline bằng giọng Linh của macOS.
# Dùng: pnpm audio   (hoặc bash scripts/gen-audio.sh)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/audio
TMP=$(mktemp -d)
VOICE=${VOICE:-Linh}
RATE=${RATE:-150}
mkdir -p "$OUT"
n=0
while IFS='|' read -r key text; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  say -v "$VOICE" -r "$RATE" -o "$TMP/$key.aiff" "$text"
  afconvert -f m4af -d aac -b 64000 "$TMP/$key.aiff" "$OUT/$key.m4a"
  n=$((n+1))
done < scripts/audio-manifest.txt
rm -rf "$TMP"
echo "generated $n clips -> $OUT"
