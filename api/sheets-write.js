export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Google service account not configured' });
  }

  const SHEET_ID = '1rKKqBm0jRJ_KixzhIXZrwJk7UbuqWFWtJzdBCk91sv4';

  try {
    const { google } = await import('googleapis');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const { action, sheetName, values, range, updates } = req.body;

    switch (action) {
      case 'appendRow': {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: `'${sheetName}'!A:Z`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [values] },
        });
        return res.status(200).json({ success: true });
      }

      case 'updateCell': {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `'${sheetName}'!${range}`,
          valueInputOption: 'RAW',
          requestBody: { values: [values] },
        });
        return res.status(200).json({ success: true });
      }

      case 'batchUpdate': {
        const data = updates.map((u) => ({
          range: `'${sheetName}'!${u.range}`,
          values: [u.values],
        }));
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            valueInputOption: 'RAW',
            data,
          },
        });
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Sheets write error:', err.message || err);
    return res.status(500).json({ error: 'Failed to write to sheets: ' + (err.message || 'unknown') });
  }
}
