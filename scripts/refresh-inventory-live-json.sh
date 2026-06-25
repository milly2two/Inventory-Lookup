#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REFRESH_URL="${REFRESH_URL:-http://127.0.0.1:5678/webhook/chiaptco-inventory-refresh-now}"
SNAPSHOT_URL="${SNAPSHOT_URL:-http://127.0.0.1:5678/webhook/myapt-inventory-live}"
TMP_JSON="$(mktemp)"
TMP_REFRESH="$(mktemp)"
UPDATE_SLOT=""
trap 'rm -f "$TMP_JSON" "$TMP_REFRESH"' EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slot)
      UPDATE_SLOT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

curl -sS -m 120 -X POST "$REFRESH_URL" > "$TMP_REFRESH"
curl -sS -m 60 "$SNAPSHOT_URL" > "$TMP_JSON"

node - "$TMP_JSON" "$UPDATE_SLOT" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
let updateSlot = process.argv[3] || '';
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const units = json?.data?.units || json?.units || json?.inventory || [];
if (!json?.ok || !Array.isArray(units) || units.length === 0) {
  throw new Error('Inventory snapshot did not return ok:true with units');
}
const visibleUnits = units.filter(unit => String(unit.working_with_brokers || '').trim().toLowerCase() !== 'no');
if (json?.data?.units) {
  json.data.units = visibleUnits;
} else if (json?.units) {
  json.units = visibleUnits;
} else {
  json.inventory = visibleUnits;
}
if (!updateSlot) {
  const d = new Date(json.updated_at || Date.now());
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }).format(d));
  updateSlot = hour >= 19 ? '7PM' : '6AM';
}
json.update_slot = updateSlot;
console.log(JSON.stringify({
  updated_at: json.updated_at || null,
  update_slot: json.update_slot || null,
  source_sheet: json.source_sheet || null,
  count: visibleUnits.length,
  removed_working_with_brokers_no: units.length - visibleUnits.length,
  neighborhood_count: visibleUnits.filter(unit => unit.neighborhood).length,
}));
fs.writeFileSync(file, JSON.stringify(json));
NODE

cp "$TMP_JSON" "$ROOT/src/inventory-live.json"
cp "$TMP_JSON" "$ROOT/docs/inventory-live.json"
