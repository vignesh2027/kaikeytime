#!/bin/bash
# Usage: ./scripts/publish.sh <YOUR_AZURE_PAT>
# Requires Node 20+ (nvm use 20)

set -e

PAT="${1:-}"
if [ -z "$PAT" ]; then
  echo "Usage: ./scripts/publish.sh <YOUR_AZURE_PAT>"
  echo ""
  echo "Get your PAT at: https://dev.azure.com → User Settings → Personal Access Tokens"
  echo "Scopes needed:   Marketplace → Manage"
  echo ""
  echo "Publisher page:  https://marketplace.visualstudio.com/manage/publishers/vignesh2027"
  exit 1
fi

echo "→ Compiling TypeScript..."
npm run compile

echo "→ Publishing to VS Code Marketplace..."
npx @vscode/vsce publish --allow-missing-repository -p "$PAT"

echo ""
echo "✓ Published! View at: https://marketplace.visualstudio.com/items?itemName=vignesh2027.keystrand"
