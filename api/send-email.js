export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const { to, subject, html, pdfBase64, filename } = req.body;

    if (!to || !subject || !pdfBase64 || !filename) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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
      console.error('Resend error:', data);
      return res.status(response.status).json({ error: data.message || 'Failed to send email' });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Send email error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
