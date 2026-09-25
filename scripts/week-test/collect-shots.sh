#!/usr/bin/env bash
# Copies the takeScreenshot output of the newest Maestro run into
# ~/Desktop/kolibi-week-test/<tag>/ (Maestro only writes inside its run folder).
set -euo pipefail
OUT="${WEEK_TEST_OUT:-$HOME/Desktop/kolibi-week-test}"
RUN=$(ls -td "$OUT"/20*/ 2>/dev/null | head -1)
[ -n "$RUN" ] || { echo "no Maestro run in $OUT"; exit 1; }
find "$RUN" -path '*/takeScreenshot/*' -name '*.png' | while read -r f; do
  rel="${f#*takeScreenshot/}"
  mkdir -p "$OUT/$(dirname "$rel")"
  cp "$f" "$OUT/$rel"
  echo "$rel"
done
