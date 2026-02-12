import type { Equipment } from '../types';
import fallbackData from '../data/equipment.json';

const SHEET_ID = '1rKKqBm0jRJ_KixzhIXZrwJk7UbuqWFWtJzdBCk91sv4';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

function parsePrice(raw: string): number {
  if (!raw) return 0;
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

// Normalize a product name for matching: lowercase, strip parenthetical content, trim
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '') // remove (contents in parens)
    .replace(/\s+/g, ' ')
    .trim();
}

// Build image lookup from old equipment.json
// Maps: exact normalized name -> image, and base name (without #N) -> image
const imageMap = new Map<string, string>();
const baseImageMap = new Map<string, string>();

(fallbackData as Equipment[]).forEach(item => {
  if (!item.image) return;
  const norm = normalizeName(item.name);
  if (!imageMap.has(norm)) {
    imageMap.set(norm, item.image);
  }
  // Also store base name: "bmpcc 6k #1" -> "bmpcc 6k" for matching consolidated entries
  const base = norm.replace(/\s*#\d+\s*$/, '').trim();
  if (base !== norm && !baseImageMap.has(base)) {
    baseImageMap.set(base, item.image);
  }
});

function findImage(sheetName: string): string {
  const norm = normalizeName(sheetName);

  // 1. Exact match
  if (imageMap.has(norm)) return imageMap.get(norm)!;

  // 2. Sheet has range like "#1-#8" — extract base and look up
  const rangeStripped = norm.replace(/\s*#\d+-#\d+\s*$/, '').trim();
  if (rangeStripped !== norm) {
    if (baseImageMap.has(rangeStripped)) return baseImageMap.get(rangeStripped)!;
    if (imageMap.has(rangeStripped)) return imageMap.get(rangeStripped)!;
  }

  // 3. Base name match (strip #N suffix)
  const baseNorm = norm.replace(/\s*#\d+\s*$/, '').trim();
  if (baseNorm !== norm && baseImageMap.has(baseNorm)) return baseImageMap.get(baseNorm)!;

  // 4. Prefix match — find first item in imageMap whose key starts with norm or vice versa
  for (const [key, img] of imageMap) {
    if (key.startsWith(norm) || norm.startsWith(key)) return img;
  }

  return '';
}

export async function fetchEquipment(): Promise<Equipment[]> {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csv = await response.text();
    const rows = parseCSV(csv);

    const items: Equipment[] = [];
    let currentCategory = '';
    let id = 1;

    const validCategories = new Set(['CAMERA', 'GRIP', 'LIGHTS', 'SOUND', 'LOCATION', 'BOOKS']);

    for (const row of rows) {
      const colB = (row[1] || '').trim();
      const colC = (row[2] || '').trim();
      const colD = (row[3] || '').trim();
      const colE = (row[4] || '').trim();
      const colF = (row[5] || '').trim();
      const colG = (row[6] || '').trim();

      // Check if this row is a category header
      const catUpper = colB.toUpperCase();
      if (validCategories.has(catUpper) && !colD) {
        currentCategory = catUpper;
        continue;
      }

      // Skip header rows
      if (!colD || colD === 'Product:' || colD === 'Contains:') continue;
      if (!currentCategory) continue;

      const dayRate = parsePrice(colF);
      const weeklyRate = parsePrice(colG);
      const priceInclVat = weeklyRate || (dayRate > 0 ? Math.round(dayRate * 5 * 0.85) : 0);

      const filmYear2 = colC.toLowerCase().includes('film year 2');
      const image = findImage(colD);

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
