#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/node-v22.16.0-darwin-arm64/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLOT="${1:-}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/chiaptco_inventory_pages_deploy}"
GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes"
export GIT_SSH_COMMAND

cd "$ROOT"

wait_for_inventory_sync() {
  local n8n_api_url="${N8N_API_URL:-http://127.0.0.1:5678/api/v1}"
  local workflow_id="${INVENTORY_SYNC_WORKFLOW_ID:-lndM2rwgc4b3NaAZ}"
  local max_wait_seconds="${INVENTORY_SYNC_WAIT_SECONDS:-5400}"
  local poll_seconds="${INVENTORY_SYNC_POLL_SECONDS:-30}"

  local n8n_key
  n8n_key="$(security find-generic-password -a openclaw -s n8n-api-key -w | tr -d "\n")"

  node - "$n8n_api_url" "$workflow_id" "$n8n_key" "$max_wait_seconds" "$poll_seconds" <<'NODE'
const [apiUrl, workflowId, apiKey, maxWaitRaw, pollRaw] = process.argv.slice(2);
const maxWaitMs = Number(maxWaitRaw || 5400) * 1000;
const pollMs = Number(pollRaw || 30) * 1000;
const now = new Date();
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  hour: 'numeric',
  hour12: false,
}).formatToParts(now);
const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
const slotStartLocal = hour >= 18 ? { hour: 19, minute: 30 } : { hour: 6, minute: 0 };

function chicagoParts(date) {
  const values = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return values;
}

function chicagoSlotStartUtc() {
  const p = chicagoParts(now);
  const guess = new Date(Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    slotStartLocal.hour,
    slotStartLocal.minute,
    0,
  ));
  const actual = chicagoParts(guess);
  const actualMinutes = Number(actual.hour) * 60 + Number(actual.minute);
  const targetMinutes = slotStartLocal.hour * 60 + slotStartLocal.minute;
  return new Date(guess.getTime() + (targetMinutes - actualMinutes) * 60 * 1000);
}

const slotStart = chicagoSlotStartUtc();
const deadline = Date.now() + maxWaitMs;

async function latestTriggerExecution() {
  const url = `${apiUrl.replace(/\/$/, '')}/executions?workflowId=${encodeURIComponent(workflowId)}&limit=20`;
  const response = await fetch(url, { headers: { 'X-N8N-API-KEY': apiKey } });
  if (!response.ok) {
    throw new Error(`n8n executions request failed: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  return (json.data || [])
    .filter(e => e.mode === 'trigger' && e.startedAt && new Date(e.startedAt) >= slotStart)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0] || null;
}

async function main() {
  while (Date.now() <= deadline) {
    const execution = await latestTriggerExecution();
    if (execution?.status === 'success' && execution.stoppedAt) {
      console.log(`Inventory sync complete for publish slot: execution ${execution.id} finished at ${execution.stoppedAt}`);
      return;
    }
    if (execution?.status === 'error' || execution?.status === 'crashed') {
      throw new Error(`Inventory sync execution ${execution.id} ended with status ${execution.status}; refusing to publish stale inventory`);
    }
    const status = execution ? `${execution.id} (${execution.status || 'unknown'})` : 'none yet';
    console.log(`Waiting for inventory sync after ${slotStart.toISOString()}; latest trigger execution: ${status}`);
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  throw new Error(`Timed out waiting for Inventory Sync to sheets after ${slotStart.toISOString()}`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
NODE
}

wait_for_inventory_sync

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
