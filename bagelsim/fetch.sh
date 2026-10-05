#!/usr/bin/env bash
# Re-download the official BagelSim web build into this directory.
# The result is fully self-contained: no CDN, no external calls at runtime.
#
#   ./fetch.sh
#
set -euo pipefail

BASE="${BAGELSIM_BASE:-https://team-2480.github.io/BagelSim}"
DIR="$(cd "$(dirname "$0")" && pwd)"

FILES=(
  index.js
  index.wasm
  index.data
  coi-serviceworker.min.js
  favicon.ico
)

echo "Fetching from $BASE"
for f in "${FILES[@]}"; do
  printf '  %-26s' "$f"
  curl -sSL -f -o "$DIR/$f" "$BASE/$f"
  printf '%10s bytes\n' "$(wc -c < "$DIR/$f" | tr -d ' ')"
done

echo
echo "Done. Start it with:  python3 serve.py"