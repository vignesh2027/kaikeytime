#!/bin/bash
# Usage: ./scripts/publish.sh <YOUR_AZURE_PAT>
set -e
PAT="${1:-}"
if [ -z "$PAT" ]; then
  echo "Usage: ./scripts/publish.sh <YOUR_AZURE_PAT>"
  exit 1
fi
npm run compile
npx @vscode/vsce publish --allow-missing-repository -p "$PAT"
echo "✓ Published: https://marketplace.visualstudio.com/items?itemName=vignesh2027.kaikeytime"
