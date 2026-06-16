#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLOT="${1:-}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/chiaptco_inventory_pages_deploy}"
GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes"
export GIT_SSH_COMMAND

cd "$ROOT"

git pull --ff-only origin main

if [[ -n "$SLOT" ]]; then
  scripts/refresh-inventory-live-json.sh --slot "$SLOT"
else
  scripts/refresh-inventory-live-json.sh
fi

if git diff --quiet -- src/inventory-live.json docs/inventory-live.json; then
  echo "No inventory changes to publish."
  exit 0
fi

git add src/inventory-live.json docs/inventory-live.json
git commit -m "Update live inventory data"
git push origin main
