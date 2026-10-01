#!/usr/bin/env bash
# Sinh audio tiếng Việt offline bằng giọng Linh của macOS.
# Dùng: pnpm audio                 (chỉ sinh clip CHƯA có – đổi chữ thì xoá m4a cũ cùng tên trước)
#       FORCE=1 pnpm audio         (sinh lại tất cả)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/audio
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
VOICE=${VOICE:-Linh}
RATE=${RATE:-150}
FORCE=${FORCE:-0}
mkdir -p "$OUT"
n=0; skip=0
while IFS='|' read -r key text; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  if [[ "$FORCE" != "1" && -s "$OUT/$key.m4a" ]]; then skip=$((skip+1)); continue; fi
  say -v "$VOICE" -r "$RATE" -o "$TMP/$key.aiff" "$text"
  afconvert -f m4af -d aac -b 64000 "$TMP/$key.aiff" "$OUT/$key.m4a"
  n=$((n+1))
done < scripts/audio-manifest.txt
echo "generated $n clips, skipped $skip existing -> $OUT"
