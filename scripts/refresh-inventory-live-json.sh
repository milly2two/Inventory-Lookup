#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REFRESH_URL="https://ncsniper.app.n8n.cloud/webhook/chiaptco-inventory-refresh-now"
SNAPSHOT_URL="https://ncsniper.app.n8n.cloud/webhook/myapt-inventory-live"
TMP_JSON="$(mktemp)"
TMP_REFRESH="$(mktemp)"
trap 'rm -f "$TMP_JSON" "$TMP_REFRESH"' EXIT

curl -sS -m 120 -X POST "$REFRESH_URL" > "$TMP_REFRESH"
curl -sS -m 60 "$SNAPSHOT_URL" > "$TMP_JSON"

node - "$TMP_JSON" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const units = json?.data?.units || json?.units || json?.inventory || [];
if (!json?.ok || !Array.isArray(units) || units.length === 0) {
  throw new Error('Inventory snapshot did not return ok:true with units');
}
console.log(JSON.stringify({
  updated_at: json.updated_at || null,
  source_sheet: json.source_sheet || null,
  count: units.length,
  neighborhood_count: units.filter(unit => unit.neighborhood).length,
}));
NODE

cp "$TMP_JSON" "$ROOT/src/inventory-live.json"
cp "$TMP_JSON" "$ROOT/docs/inventory-live.json"
