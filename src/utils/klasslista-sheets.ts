import type { Klasslista } from '../types';

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

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  const lines = csv.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      rows.push(parseCSVRow(line));
    }
  }
  return rows;
}

/**
 * Fetch student names from the "Klasslista" tab in Google Sheets.
 * Expected layout: Row 0 = headers ("Film 1", "Film 2"), rows 1+ = student names.
 * Columns: A = Film 1 names, B = Film 2 names
 */
export async function fetchKlasslista(): Promise<Klasslista> {
  // Try using sheet name parameter first
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Klasslista`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const csv = await response.text();
  const rows = parseCSV(csv);

  if (rows.length === 0) {
    return { film1: [], film2: [] };
  }

  // Find which columns are Film 1 and Film 2 from headers
  const headers = rows[0];
  let film1Col = -1;
  let film2Col = -1;

  for (let c = 0; c < headers.length; c++) {
    const h = headers[c].trim().toLowerCase();
    if (h.includes('film 1') || h.includes('film1')) {
      film1Col = c;
    } else if (h.includes('film 2') || h.includes('film2')) {
      film2Col = c;
    }
  }

  // Fallback: if headers not found, assume col 0 = Film 1, col 1 = Film 2
  if (film1Col === -1) film1Col = 0;
  if (film2Col === -1) film2Col = 1;

  const film1: string[] = [];
  const film2: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const name1 = (rows[i][film1Col] || '').trim();
    const name2 = (rows[i][film2Col] || '').trim();
    if (name1) film1.push(name1);
    if (name2) film2.push(name2);
  }

  return { film1, film2 };
}
