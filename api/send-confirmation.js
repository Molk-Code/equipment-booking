export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured. RESEND_API_KEY missing.' });
  }

  try {
    const { to, subject, html, pdfBase64, filename } = req.body;

    if (!to || !subject || !pdfBase64 || !filename) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, pdfBase64, filename' });
    }

    const emailPayload = {
      from: 'Molkom Rental House <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html || '<p>Your booking has been confirmed. See attached PDF.</p>',
      attachments: [
        {
          filename: filename,
          content: pdfBase64,
        },
      ],
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', JSON.stringify(data));
      const msg = data.message || data.name || 'Failed to send confirmation email';
      return res.status(response.status).json({ error: msg });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Send confirmation error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error: ' + (err.message || 'unknown') });
  }
}
