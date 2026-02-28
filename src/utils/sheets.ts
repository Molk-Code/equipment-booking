import type { Equipment } from '../types';
import fallbackData from '../data/equipment.json';

const SHEET_ID = '1rKKqBm0jRJ_KixzhIXZrwJk7UbuqWFWtJzdBCk91sv4';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

const POLL_INTERVAL = 10_000; // 10 seconds

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

// --- Google Drive image manifest ---
// Fetched from our /api/drive-images endpoint which reads the public Google Drive folder.
// Maps image base-names (without extension) → direct image URLs on Google's CDN.

let imageManifest: Record<string, string> = {};
let manifestLoaded = false;

async function loadManifest(): Promise<void> {
  if (manifestLoaded) return;
  try {
    const res = await fetch('/api/drive-images');
    if (res.ok) {
      const data = await res.json();
      if (!data.error) {
        imageManifest = data;
        manifestLoaded = true;
      }
    }
  } catch {
    console.warn('Could not load image manifest from Google Drive');
  }
}

// Force re-fetch of manifest (picks up newly added images in Google Drive)
async function reloadManifest(): Promise<void> {
  try {
    const res = await fetch('/api/drive-images?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (!data.error) {
        imageManifest = data;
        manifestLoaded = true;
      }
    }
  } catch {
    // keep existing manifest
  }
}

// Light normalization: lowercase + collapse whitespace
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Aggressive normalization: strips colons, plus signs, normalizes all
// punctuation/spacing differences so sheet names match filenames even when
// they differ in characters like ":" vs " ", "- " vs " - ", "+" etc.
function fuzzyNormalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents: å→a, ö→o
    .replace(/[:\/\\]/g, ' ')       // colons, slashes → space
    .replace(/\+/g, ' ')            // plus signs → space
    .replace(/\s*-\s*/g, ' ')       // normalize dashes with surrounding spaces
    .replace(/[^\w\s()#.,&!]/g, '') // strip remaining special chars
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim();
}

function findImageInManifest(name: string): string {
  // 1. Exact match
  if (imageManifest[name]) return imageManifest[name];
  const trimmed = name.trim();
  if (imageManifest[trimmed]) return imageManifest[trimmed];

  // 2. Case-insensitive
  const lower = normalizeName(name);
  for (const [key, path] of Object.entries(imageManifest)) {
    if (normalizeName(key) === lower) return path;
  }

  // 3. Fuzzy match
  const fuzzy = fuzzyNormalize(name);
  for (const [key, path] of Object.entries(imageManifest)) {
    if (fuzzyNormalize(key) === fuzzy) return path;
  }

  // 4. Strip #N suffix
  const baseNoNum = trimmed.replace(/\s*#\d+\s*$/, '').trim();
  if (baseNoNum !== trimmed) {
    const baseFuzzy = fuzzyNormalize(baseNoNum);
    for (const [key, path] of Object.entries(imageManifest)) {
      if (fuzzyNormalize(key) === baseFuzzy) return path;
    }
  }

  // 5. Strip #N-#M range
  const baseNoRange = trimmed.replace(/\s*#\d+-#\d+\s*$/, '').trim();
  if (baseNoRange !== trimmed && baseNoRange !== baseNoNum) {
    const rangeFuzzy = fuzzyNormalize(baseNoRange);
    for (const [key, path] of Object.entries(imageManifest)) {
      if (fuzzyNormalize(key) === rangeFuzzy) return path;
    }
  }

  // 6. Strip parenthesized content
  const baseNoParens = trimmed.replace(/\s*\(.*?\)\s*$/, '').trim();
  if (baseNoParens !== trimmed) {
    const parenFuzzy = fuzzyNormalize(baseNoParens);
    for (const [key, path] of Object.entries(imageManifest)) {
      if (fuzzyNormalize(key) === parenFuzzy) return path;
    }
  }

  // 7. Combined: strip #N + parenthesized
  const baseStripped = baseNoNum.replace(/\s*\(.*?\)\s*$/, '').trim();
  if (baseStripped !== baseNoNum && baseStripped !== baseNoParens) {
    const strippedFuzzy = fuzzyNormalize(baseStripped);
    for (const [key, path] of Object.entries(imageManifest)) {
      if (fuzzyNormalize(key) === strippedFuzzy) return path;
    }
  }

  // 8. Prefix matching
  for (const [key, path] of Object.entries(imageManifest)) {
    const kf = fuzzyNormalize(key);
    if (kf.startsWith(fuzzy) || fuzzy.startsWith(kf)) return path;
  }

  return '';
}

function findImage(sheetName: string): string {
  return findImageInManifest(sheetName);
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

async function fetchFromSheet(): Promise<Equipment[]> {
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
    const colH = (row[7] || '').trim(); // Notes column

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
    const notes = colH || undefined;

    rawItems.push({
      id: id++,
      name: colD,
      category: currentCategory,
      description: colE,
      priceExclVat: dayRate,
      priceInclVat: priceInclVat,
      image,
      filmYear2,
      notes,
    });
  }

  // Deduplicate: merge items with same base name + category into one
  const deduped = new Map<string, Equipment>();
  const countMap = new Map<string, number>();

  for (const item of rawItems) {
    const base = getBaseName(item.name);
    const key = `${item.category}::${base.toLowerCase()}`;

    const existing = deduped.get(key);
    if (existing) {
      countMap.set(key, (countMap.get(key) || 1) + 1);
      const isNumber1 = /\s*#1(\s|$|\()/.test(item.name) || item.name.endsWith('#1');
      if (isNumber1 && item.image) {
        existing.image = item.image;
      } else if (!existing.image && item.image) {
        existing.image = item.image;
      }
      if (item.filmYear2) {
        existing.filmYear2 = true;
      }
      if (!existing.description && item.description) {
        existing.description = item.description;
      }
      if (!existing.notes && item.notes) {
        existing.notes = item.notes;
      }
    } else {
      deduped.set(key, { ...item, name: base || item.name });
      countMap.set(key, 1);
    }
  }

  const items: Equipment[] = [];
  let finalId = 1;
  for (const [key, item] of deduped) {
    const count = countMap.get(key) || 1;
    items.push({
      ...item,
      id: finalId++,
      name: item.name,
      available: count,
    });
  }

  return items;
}

export async function fetchEquipment(): Promise<Equipment[]> {
  await loadManifest();
  try {
    const items = await fetchFromSheet();
    return items.length > 0 ? items : (fallbackData as Equipment[]);
  } catch (err) {
    console.error('Failed to fetch from Google Sheets, using fallback data:', err);
    return fallbackData as Equipment[];
  }
}

// --- Auto-polling: re-fetch equipment every 10 seconds ---

type EquipmentListener = (items: Equipment[]) => void;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let listeners: EquipmentListener[] = [];
let latestItems: Equipment[] | null = null;

function itemsChanged(a: Equipment[], b: Equipment[]): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i].name !== b[i].name || a[i].image !== b[i].image ||
        a[i].category !== b[i].category || a[i].priceExclVat !== b[i].priceExclVat ||
        a[i].description !== b[i].description) {
      return true;
    }
  }
  return false;
}

async function poll() {
  try {
    await reloadManifest();
    const items = await fetchFromSheet();
    if (items.length > 0) {
      if (!latestItems || itemsChanged(latestItems, items)) {
        latestItems = items;
        listeners.forEach(fn => fn(items));
      }
    }
  } catch {
    // silently retry next interval
  }
}

export function startPolling(onUpdate: EquipmentListener): () => void {
  listeners.push(onUpdate);
  if (!pollTimer) {
    pollTimer = setInterval(poll, POLL_INTERVAL);
  }
  // return unsubscribe function
  return () => {
    listeners = listeners.filter(fn => fn !== onUpdate);
    if (listeners.length === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}
