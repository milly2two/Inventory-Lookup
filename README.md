# myAPT Inventory Searcher

Mobile-friendly static web app inspired by the myAPT Field Ops / Media + Partner Tracker UI.

## Filters

- Bed count
- Bath count
- Neighborhood
- Min/max price
- Move date by/before
- Search by property, unit, floorplan, address
- Sort by lowest price, soonest move date, most beds, or largest sqft

## Data source

The static app expects a Google Apps Script endpoint that returns Inventory LIVE rows:

```json
{ "ok": true, "data": { "units": [] } }
```

Use `apps-script/Code.gs`, deploy it as a Web App, then paste the `/exec` URL into the app Settings drawer.

Inventory LIVE sheet ID is prefilled in the Apps Script:
`1THzRvETIeCVzPmc81LXFQ7MmyksmRfqunTNhMlu_N3s`
