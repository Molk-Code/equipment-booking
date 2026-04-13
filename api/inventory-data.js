// Serverless API endpoint for inventory data (projects & items)
// Proxies to a Google Apps Script web app that reads/writes the spreadsheet.
// No service account needed — the Apps Script runs under your Google account.
//
// Set APPS_SCRIPT_URL env var in Vercel to your deployed Apps Script web app URL.

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
  if (!APPS_SCRIPT_URL) {
    return res.status(500).json({ error: 'APPS_SCRIPT_URL not configured in Vercel env vars' });
  }

  try {
    if (req.method === 'GET') {
      // Fetch all data from Apps Script
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      // Apps Script redirects (302) when deployed — fetch follows automatically
      if (!response.ok) {
        throw new Error(`Apps Script GET failed: ${response.status}`);
      }

      const data = await response.json();
      return res.status(200).json({
        projects: data.projects || [],
        items: data.items || [],
        timestamp: Date.now(),
      });
    }

    if (req.method === 'POST') {
      const { projects, items } = req.body;

      if (!Array.isArray(projects) || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid data: projects and items must be arrays' });
      }

      // Post data to Apps Script
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects, items }),
      });

      if (!response.ok) {
        throw new Error(`Apps Script POST failed: ${response.status}`);
      }

      const data = await response.json();
      return res.status(200).json({
        success: true,
        projectCount: projects.length,
        itemCount: items.length,
        timestamp: Date.now(),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Inventory data error:', err.message || err);
    return res.status(500).json({
      error: 'Failed to access inventory data: ' + (err.message || 'unknown error'),
    });
  }
}
