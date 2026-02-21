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

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build image lookup from old equipment.json
const imageMap = new Map<string, string>();
const baseImageMap = new Map<string, string>();

(fallbackData as Equipment[]).forEach(item => {
  if (!item.image) return;
  const norm = normalizeName(item.name);
  if (!imageMap.has(norm)) {
    imageMap.set(norm, item.image);
  }
  const base = norm.replace(/\s*#\d+\s*$/, '').trim();
  if (base !== norm && !baseImageMap.has(base)) {
    baseImageMap.set(base, item.image);
  }
});

function findImage(sheetName: string): string {
  const norm = normalizeName(sheetName);

  if (imageMap.has(norm)) return imageMap.get(norm)!;

  const rangeStripped = norm.replace(/\s*#\d+-#\d+\s*$/, '').trim();
  if (rangeStripped !== norm) {
    if (baseImageMap.has(rangeStripped)) return baseImageMap.get(rangeStripped)!;
    if (imageMap.has(rangeStripped)) return imageMap.get(rangeStripped)!;
  }

  const baseNorm = norm.replace(/\s*#\d+\s*$/, '').trim();
  if (baseNorm !== norm && baseImageMap.has(baseNorm)) return baseImageMap.get(baseNorm)!;

  for (const [key, img] of imageMap) {
    if (key.startsWith(norm) || norm.startsWith(key)) return img;
  }

  return '';
}

// Get the base name without #N or #N-#M suffix for deduplication
function getBaseName(name: string): string {
  return name
    .replace(/\s*#\d+-#\d+\s*/g, '')   // "#1-#8" anywhere in name
    .replace(/\s*#\d+\s*/g, '')         // "#1" anywhere in name
    .replace(/\s*\(.*?\)\s*$/, '')      // "(contents)" at the end
    .replace(/\s+/g, ' ')              // collapse multiple spaces
    .trim();
}

export async function fetchEquipment(): Promise<Equipment[]> {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csv = await response.text();
    const rows = parseCSV(csv);

    const rawItems: Equipment[] = [];
    let currentCategory = 'CAMERA';
    let id = 1;
    let isFirstRow = true;

    const validCategories = new Set(['CAMERA', 'GRIP', 'LIGHTS', 'SOUND', 'LOCATION', 'BOOKS']);

    for (const row of rows) {
      const colB = (row[1] || '').trim();
      const colC = (row[2] || '').trim();
      const colD = (row[3] || '').trim();
      const colE = (row[4] || '').trim();
      const colF = (row[5] || '').trim();
      const colG = (row[6] || '').trim();

      if (isFirstRow) {
        isFirstRow = false;
        continue;
      }

      const catUpper = colB.toUpperCase().trim();
      if (validCategories.has(catUpper)) {
        currentCategory = catUpper;
        if (!colD) continue;
      }

      if (!colD || colD === 'Product:' || colD === 'Contains:') continue;
      if (!currentCategory) continue;

      const dayRate = parsePrice(colF);
      const weeklyRate = parsePrice(colG);
      const priceInclVat = weeklyRate || (dayRate > 0 ? Math.round(dayRate * 5 * 0.85) : 0);

      const filmYear2 = colC.toLowerCase().includes('film year 2');
      const image = findImage(colD);

      rawItems.push({
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

    // Deduplicate: merge items with same base name + category into one
    // Only the #1 variant (or the first non-numbered variant) is kept for display
    const deduped = new Map<string, Equipment>();
    const countMap = new Map<string, number>();

    for (const item of rawItems) {
      const base = getBaseName(item.name);
      const key = `${item.category}::${base.toLowerCase()}`;

      const existing = deduped.get(key);
      if (existing) {
        countMap.set(key, (countMap.get(key) || 1) + 1);
        // Prefer the #1 variant's image (or the first item with an image)
        const isNumber1 = /\s*#1(\s|$|\()/.test(item.name) || item.name.endsWith('#1');
        if (isNumber1 && item.image) {
          existing.image = item.image;
        } else if (!existing.image && item.image) {
          existing.image = item.image;
        }
        // Keep filmYear2 if any variant has it
        if (item.filmYear2) {
          existing.filmYear2 = true;
        }
        // Keep better description
        if (!existing.description && item.description) {
          existing.description = item.description;
        }
      } else {
        deduped.set(key, { ...item, name: base || item.name });
        countMap.set(key, 1);
      }
    }

    // Build final list with quantity in name
    const items: Equipment[] = [];
    let finalId = 1;
    for (const [key, item] of deduped) {
      const count = countMap.get(key) || 1;
      items.push({
        ...item,
        id: finalId++,
        name: count > 1 ? `${item.name} (${count} available)` : item.name,
      });
    }

    return items.length > 0 ? items : (fallbackData as Equipment[]);
  } catch (err) {
    console.error('Failed to fetch from Google Sheets, using fallback data:', err);
    return fallbackData as Equipment[];
  }
}
