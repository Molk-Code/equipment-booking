import type { Equipment } from '../types';
import fallbackData from '../data/equipment.json';

const SHEET_ID = '1rKKqBm0jRJ_KixzhIXZrwJk7UbuqWFWtJzdBCk91sv4';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

function parsePrice(raw: string): number {
  if (!raw) return 0;
  // Prices come as "7 500kr" or "900kr" — strip spaces, "kr", commas
  const cleaned = raw.replace(/\s/g, '').replace(/kr$/i, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

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

// Map old equipment.json images by product name for fallback
const imageMap = new Map<string, string>();
(fallbackData as Equipment[]).forEach(item => {
  if (item.image) {
    imageMap.set(item.name.toLowerCase(), item.image);
  }
});

export async function fetchEquipment(): Promise<Equipment[]> {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csv = await response.text();
    const rows = parseCSV(csv);

    const items: Equipment[] = [];
    let currentCategory = '';
    let id = 1;

    // Valid categories
    const validCategories = new Set(['CAMERA', 'GRIP', 'LIGHTS', 'SOUND', 'LOCATION', 'BOOKS']);

    for (const row of rows) {
      // Column B (index 1) has category names or "List of content:"
      const colB = (row[1] || '').trim();
      // Column C (index 2) has "Film Year 2" restriction
      const colC = (row[2] || '').trim();
      // Column D (index 3) has product name
      const colD = (row[3] || '').trim();
      // Column E (index 4) has description
      const colE = (row[4] || '').trim();
      // Column F (index 5) has day rate price excl VAT
      const colF = (row[5] || '').trim();
      // Column G (index 6) has weekly rate / price incl VAT
      const colG = (row[6] || '').trim();

      // Check if this row is a category header
      const catUpper = colB.toUpperCase();
      if (validCategories.has(catUpper) && !colD) {
        currentCategory = catUpper;
        continue;
      }

      // Skip header rows, "List of content" rows, etc.
      if (!colD || colD === 'Product:' || colD === 'Contains:') continue;
      if (!currentCategory) continue;

      const dayRate = parsePrice(colF);
      const weeklyRate = parsePrice(colG);
      // Use weekly rate from sheet if available, otherwise calculate
      const priceInclVat = weeklyRate || (dayRate > 0 ? Math.round(dayRate * 5 * 0.85) : 0);

      const filmYear2 = colC.toLowerCase().includes('film year 2');

      // Try to match image from existing data
      const image = imageMap.get(colD.toLowerCase()) || '';

      items.push({
        id: id++,
        name: colD,
        category: currentCategory,
        description: colE,
        priceExclVat: dayRate,
        priceInclVat: priceInclVat,
        image,
        filmYear2,
      });
    }

    return items.length > 0 ? items : (fallbackData as Equipment[]);
  } catch (err) {
    console.error('Failed to fetch from Google Sheets, using fallback data:', err);
    return fallbackData as Equipment[];
  }
}
