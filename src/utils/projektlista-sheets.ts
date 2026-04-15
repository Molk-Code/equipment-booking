const SHEET_ID = '1rKKqBm0jRJ_KixzhIXZrwJk7UbuqWFWtJzdBCk91sv4';

/**
 * Fetch project name suggestions from the "Projektlista" tab in Google Sheets.
 * Reads column A starting at A1, returns non-empty values as an array.
 */
export async function fetchProjektlista(): Promise<string[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Projektlista`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const csv = await response.text();

  // Parse CSV — each row is a project name (column A)
  const names: string[] = [];
  const lines = csv.split('\n');
  for (const line of lines) {
    // Remove CSV quoting
    let name = line.trim();
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.slice(1, -1).replace(/""/g, '"');
    }
    // Also handle comma-separated multiple columns — just take the first
    const firstComma = name.indexOf(',');
    if (firstComma > -1 && !name.startsWith('"')) {
      name = name.substring(0, firstComma).trim();
    }
    if (name) {
      names.push(name);
    }
  }

  return names;
}
