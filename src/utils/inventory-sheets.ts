import type { QRScanEntry } from '../types';

const SHEET_ID = '1rKKqBm0jRJ_KixzhIXZrwJk7UbuqWFWtJzdBCk91sv4';
const CONTRACT_GID = '1545651444';

const SCAN_POLL_INTERVAL = 3_000;

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

// Fetch scans from Equipment Contract tab (gid=1545651444)
// Rows 1-10 are header, scans start from row 11
export async function fetchContractScans(): Promise<QRScanEntry[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${CONTRACT_GID}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const csv = await response.text();
  const rows = parseCSV(csv);

  const scans: QRScanEntry[] = [];
  // Skip header rows (first 10 rows = indices 0-9), start from index 10
  for (let i = 10; i < rows.length; i++) {
    const timestamp = (rows[i][0] || '').trim();
    const name = (rows[i][1] || '').trim();
    if (timestamp && name) {
      scans.push({ timestamp, equipmentName: name });
    }
  }
  return scans;
}

// Poll for new scans at 3-second intervals
export function startScanPolling(
  onNewScans: (scans: QRScanEntry[]) => void,
  knownScans: Set<string>
): () => void {
  const timer = setInterval(async () => {
    try {
      const allScans = await fetchContractScans();
      const newScans = allScans.filter(s => {
        const key = `${s.timestamp}|${s.equipmentName}`;
        return !knownScans.has(key);
      });
      if (newScans.length > 0) {
        newScans.forEach(s => knownScans.add(`${s.timestamp}|${s.equipmentName}`));
        onNewScans(newScans);
      }
    } catch {
      // silently retry
    }
  }, SCAN_POLL_INTERVAL);

  return () => clearInterval(timer);
}
