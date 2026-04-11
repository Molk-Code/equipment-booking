/**
 * Fetch the booking page password from the Google Sheet.
 *
 * Reads from a "Settings" tab in the spreadsheet.
 * Expected layout: Row 0 = header ("Password"), Row 1 = the password value.
 * If the cell is empty or the tab doesn't exist, no password is required.
 */

const SHEET_ID = '1rKKqBm0jRJ_KixzhIXZrwJk7UbuqWFWtJzdBCk91sv4';

function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

export async function fetchBookingPassword(): Promise<string> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Settings`;
    const response = await fetch(url);
    if (!response.ok) return '';
    const csv = await response.text();

    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) return '';

    // Row 1 (index 1) should contain the password
    const row = parseCSVRow(lines[1]);
    const pw = (row[0] || '').trim();
    return pw;
  } catch {
    return '';
  }
}
