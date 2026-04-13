export default async function handler(req, res) {
  // CORS headers
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

    // Note: Resend free tier (onboarding@resend.dev) can only send to the
    // account owner's email. CC to other addresses causes the entire send to
    // fail. So we send the primary email first, then try CC as a separate
    // email that silently fails if Resend rejects it.

    const emailPayload = {
      from: 'Molkom Rental House <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html || '<p>See attached booking PDF.</p>',
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
      const msg = data.message || data.name || 'Failed to send email';
      return res.status(response.status).json({ error: msg });
    }

    // Try to also send a copy to Karl (best-effort, won't block primary email)
    const CC_EMAIL = 'karl.sparre@regionvarmland.se';
    if (to.toLowerCase() !== CC_EMAIL.toLowerCase()) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Molkom Rental House <onboarding@resend.dev>',
            to: [CC_EMAIL],
            subject: `[CC] ${subject}`,
            html: html || '<p>See attached booking PDF.</p>',
            attachments: [{ filename, content: pdfBase64 }],
          }),
        });
      } catch (ccErr) {
        // CC failed silently — free tier may not allow sending to this address
        console.warn('CC email to Karl failed (free tier restriction):', ccErr.message || ccErr);
      }
    }

    // To enable sending to any recipient (including CC and student confirmations),
    // verify a domain at resend.com/domains and update the "from" address above.

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Send email error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error: ' + (err.message || 'unknown') });
  }
}
