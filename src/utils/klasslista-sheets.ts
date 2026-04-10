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

function isFilm1Header(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'film 1' || t === 'film1';
}

function isFilm2Header(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'film 2' || t === 'film2';
}

function isAnyHeader(text: string): boolean {
  return isFilm1Header(text) || isFilm2Header(text);
}

/**
 * Fetch student names from the "Klasslista" tab in Google Sheets.
 *
 * Supports two layouts:
 * 1) Column-based: Row 0 has "Film 1" and "Film 2" as column headers,
 *    names listed below in their respective columns.
 * 2) Section-based: "Film 1" and "Film 2" appear as section headers
 *    anywhere in the data, with names listed below each header until
 *    the next header or end of data.
 *
 * The parser auto-detects which layout is used.
 */
export async function fetchKlasslista(): Promise<Klasslista> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Klasslista`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const csv = await response.text();
  const rows = parseCSV(csv);

  if (rows.length === 0) {
    return { film1: [], film2: [] };
  }

  // Strategy 1: Check if first row has both "Film 1" and "Film 2" as column headers
  const headers = rows[0];
  let film1Col = -1;
  let film2Col = -1;

  for (let c = 0; c < headers.length; c++) {
    if (isFilm1Header(headers[c])) film1Col = c;
    else if (isFilm2Header(headers[c])) film2Col = c;
  }

  if (film1Col !== -1 && film2Col !== -1) {
    // Both headers found in row 0 — use column-based parsing
    const film1: string[] = [];
    const film2: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const name1 = (rows[i][film1Col] || '').trim();
      const name2 = (rows[i][film2Col] || '').trim();
      if (name1 && !isAnyHeader(name1)) film1.push(name1);
      if (name2 && !isAnyHeader(name2)) film2.push(name2);
    }
    return { film1, film2 };
  }

  // Strategy 2: Section-based — scan all cells for "Film 1" / "Film 2" markers
  // and collect names that follow each marker (per column)
  const film1: string[] = [];
  const film2: string[] = [];

  // Track the current group assignment per column
  const colGroup: Record<number, 'film1' | 'film2' | null> = {};

  for (let i = 0; i < rows.length; i++) {
    for (let c = 0; c < rows[i].length; c++) {
      const cell = (rows[i][c] || '').trim();
      if (!cell) continue;

      if (isFilm1Header(cell)) {
        colGroup[c] = 'film1';
      } else if (isFilm2Header(cell)) {
        colGroup[c] = 'film2';
      } else if (colGroup[c]) {
        // This is a name under a known group header
        if (colGroup[c] === 'film1') {
          film1.push(cell);
        } else {
          film2.push(cell);
        }
      }
    }
  }

  return { film1, film2 };
}
