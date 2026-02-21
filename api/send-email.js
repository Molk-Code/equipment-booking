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
    const { to, subject, html, pdfBase64, filename, confirmationTo, confirmationHtml } = req.body;

    if (!to || !subject || !pdfBase64 || !filename) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, pdfBase64, filename' });
    }

    // Send email to equipment manager
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

    // Send confirmation email with PDF to the booker/student
    if (confirmationTo) {
      const confirmPayload = {
        from: 'Molkom Rental House <onboarding@resend.dev>',
        to: [confirmationTo],
        subject: `Booking Confirmation — ${subject.replace('Equipment Booking Inquiry — ', '')}`,
        html: confirmationHtml || '<p>Thank you for your booking inquiry. See attached PDF for details.</p>',
        attachments: [
          {
            filename: filename,
            content: pdfBase64,
          },
        ],
      };

      try {
        const confirmResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(confirmPayload),
        });

        if (!confirmResponse.ok) {
          const confirmData = await confirmResponse.json();
          console.error('Confirmation email error:', JSON.stringify(confirmData));
          // Don't fail the whole request if confirmation email fails
        }
      } catch (confirmErr) {
        console.error('Confirmation email error:', confirmErr.message || confirmErr);
      }
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Send email error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error: ' + (err.message || 'unknown') });
  }
}
