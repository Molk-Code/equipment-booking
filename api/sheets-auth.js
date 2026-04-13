// Google Sheets API authentication using service account
// Uses only Node.js built-in crypto module — no external dependencies needed

import crypto from 'crypto';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Cache the access token to avoid re-fetching on every request
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Create a JWT and exchange it for a Google access token using a service account.
 * Requires GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY env vars.
 */
export async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY env vars');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // Create JWT header and claim set
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat: now,
    exp: expiry,
  };

  // Base64url encode
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const headerB64 = b64url(header);
  const claimB64 = b64url(claimSet);
  const signInput = `${headerB64}.${claimB64}`;

  // Sign with RSA-SHA256
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(privateKey, 'base64url');

  const jwt = `${signInput}.${signature}`;

  // Exchange JWT for access token
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${err}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}

// Spreadsheet ID (same one used for equipment, klasslista, etc.)
export const SPREADSHEET_ID = '1rKKqBm0jRJ_KixzhIXZrwJk7UbuqWFWtJzdBCk91sv4';
const SHEETS_API = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

/**
 * Read values from a sheet range.
 */
export async function readSheet(range) {
  const token = await getAccessToken();
  const url = `${SHEETS_API}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets read error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.values || [];
}

/**
 * Write values to a sheet range (overwrites existing data).
 */
export async function writeSheet(range, values) {
  const token = await getAccessToken();
  const url = `${SHEETS_API}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets write error: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Append rows to a sheet.
 */
export async function appendSheet(range, values) {
  const token = await getAccessToken();
  const url = `${SHEETS_API}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets append error: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Clear a sheet range.
 */
export async function clearSheet(range) {
  const token = await getAccessToken();
  const url = `${SHEETS_API}/values/${encodeURIComponent(range)}:clear`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets clear error: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Batch update: clear and rewrite entire sheet data.
 * Used to save full state (projects or items) in one call.
 */
export async function replaceSheetData(range, headerRow, dataRows) {
  const token = await getAccessToken();
  // Use batchUpdate to clear + write in one request
  const url = `${SHEETS_API}/values:batchUpdate`;

  // First clear everything
  await clearSheet(range);

  // Then write header + data
  const allRows = [headerRow, ...dataRows];
  if (allRows.length > 0) {
    await writeSheet(range, allRows);
  }
}
