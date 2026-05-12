/**
 * myAPT Inventory Searcher — read-only Google Apps Script endpoint.
 * Deploy as Web App: Execute as Me, access Anyone with link.
 * Source: Inventory LIVE / units sheet.
 */
const INVENTORY_SHEET_ID = '1THzRvETIeCVzPmc81LXFQ7MmyksmRfqunTNhMlu_N3s';
const INVENTORY_SHEET_NAME = 'units';

function doGet() {
  try {
    return jsonOutput({ ok: true, data: { units: readInventory() }, updated_at: new Date().toISOString() });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function readInventory() {
  const ss = SpreadsheetApp.openById(INVENTORY_SHEET_ID);
  const sheet = ss.getSheetByName(INVENTORY_SHEET_NAME) || ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).filter(row => row.some(v => v !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h || `col_${i + 1}`] = row[i]);
    return obj;
  });
}

function jsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
