import { useState, useEffect } from 'react';
import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';

interface ConfirmData {
  name: string;
  email: string;
  className: string;
  project: string;
  dateFrom: string;
  dateTo: string;
  totalPrice: number;
  items: {
    name: string;
    category: string;
    days: number;
    priceExclVat: number;
  }[];
}

function calculatePrice(dayRate: number, days: number): number {
  if (dayRate === 0) return 0;
  const fullWeeks = Math.floor(days / 5);
  const remainingDays = days % 5;
  const weeklyRate = dayRate * 5 * 0.85;
  return Math.round(fullWeeks * weeklyRate + remainingDays * dayRate);
}

function generateConfirmationPDF(data: ConfirmData): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Booking Confirmation', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Molkom Rental House', pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Borrower Information', 20, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${data.name}`, 20, y); y += 6;
  doc.text(`Email: ${data.email}`, 20, y); y += 6;
  doc.text(`Class: ${data.className}`, 20, y); y += 6;
  doc.text(`Project: ${data.project || 'N/A'}`, 20, y); y += 6;
  doc.text(`Rental Period: ${data.dateFrom} to ${data.dateTo}`, 20, y); y += 12;

  doc.setFontSize(8);
  doc.setTextColor(100);
  const disclaimerText =
    'This booking has been confirmed. The borrower is responsible for properly handling, storing, and transporting all loaned equipment. Any damage must be reported immediately.';
  const disclaimerLines = doc.splitTextToSize(disclaimerText, pageWidth - 40);
  doc.text(disclaimerLines, 20, y);
  y += disclaimerLines.length * 4 + 8;

  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Equipment List', 20, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(30, 30, 30);
  doc.setTextColor(255);
  doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
  doc.text('Item', 22, y);
  doc.text('Category', 110, y);
  doc.text('Days', 140, y);
  doc.text('Price', 165, y, { align: 'right' });
  y += 8;

  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');

  data.items.forEach((item, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(20, y - 4, pageWidth - 40, 7, 'F');
    }

    const name = item.name.length > 50 ? item.name.substring(0, 47) + '...' : item.name;
    doc.text(name, 22, y);
    doc.text(item.category, 110, y);
    doc.text(String(item.days), 140, y);

    const price = calculatePrice(item.priceExclVat, item.days);
    doc.text(item.priceExclVat > 0 ? `${price} kr` : 'Free', 165, y, { align: 'right' });
    y += 7;
  });

  y += 5;
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 8;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Total (excl. VAT):', 100, y);
  doc.text(`${data.totalPrice} kr`, 165, y, { align: 'right' });

  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Confirmed: ${new Date().toLocaleDateString('sv-SE')} | Molkom Rental House - Equipment Booking Confirmation`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  return doc.output('blob');
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ConfirmBooking() {
  const [data, setData] = useState<ConfirmData | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('data');
      if (!encoded) {
        setError('No booking data found in the URL.');
        return;
      }
      const decoded = JSON.parse(decodeURIComponent(atob(encoded)));
      setData(decoded);
    } catch {
      setError('Invalid booking data. The link may be corrupted.');
    }
  }, []);

  const handleSendConfirmation = async () => {
    if (!data) return;
    setSending(true);
    setError('');

    try {
      const pdfBlob = generateConfirmationPDF(data);
      const pdfBase64 = await blobToBase64(pdfBlob);
      const filename = `${data.name.replace(/\s+/g, '')}_Booking_Confirmed_${new Date().toISOString().split('T')[0]}.pdf`;

      const itemsList = data.items
        .map(item => {
          const price = calculatePrice(item.priceExclVat, item.days);
          return `<li>${item.name} (${item.category}) — ${item.days} days — ${item.priceExclVat > 0 ? `${price} kr` : 'Free'}</li>`;
        })
        .join('\n');

      const confirmationHtml = `
        <h2>Booking Confirmed!</h2>
        <p>Hi ${data.name},</p>
        <p>Your equipment booking at <strong>Molkom Rental House</strong> has been <strong>approved</strong>.</p>
        <h3>Booking Details</h3>
        <p><strong>Class:</strong> ${data.className}</p>
        <p><strong>Project:</strong> ${data.project || 'N/A'}</p>
        <p><strong>Rental Period:</strong> ${data.dateFrom} to ${data.dateTo}</p>
        <p><strong>Items Confirmed:</strong> ${data.items.length}</p>
        <p><strong>Total (excl. VAT):</strong> ${data.totalPrice} kr</p>
        <h3>Equipment List</h3>
        <ul>${itemsList}</ul>
        <p>Please pick up the equipment at the scheduled time.</p>
        <p><em>A booking confirmation PDF is attached for your records.</em></p>
        <hr/>
        <p style="color: #888; font-size: 12px;">Best regards,<br/>Molkom Rental House</p>
      `;

      const response = await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: data.email,
          subject: `Booking Confirmed — ${data.name} (${data.className}) — ${data.dateFrom}`,
          html: confirmationHtml,
          pdfBase64,
          filename,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to send confirmation email');
      }

      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to send: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  if (error && !data) {
    return (
      <div className="checkout-success">
        <div className="success-icon" style={{ color: '#ef4444' }}>
          <AlertCircle size={48} />
        </div>
        <h2>Invalid Link</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="checkout-success">
        <div className="success-icon" style={{ color: '#22c55e' }}>
          <CheckCircle size={48} />
        </div>
        <h2>Confirmation Sent!</h2>
        <p>The booking confirmation email with PDF has been sent to <strong>{data?.email}</strong>.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="checkout-success">
        <p>Loading booking data...</p>
      </div>
    );
  }

  return (
    <div className="checkout">
      <h2>Confirm Booking</h2>
      <p>Review the booking details below and click the button to send the confirmation email with the PDF attachment to the student.</p>

      <div className="checkout-layout">
        <div className="checkout-form" style={{ maxWidth: '100%' }}>
          <h3>Borrower Information</h3>
          <p><strong>Name:</strong> {data.name}</p>
          <p><strong>Email:</strong> {data.email}</p>
          <p><strong>Class:</strong> {data.className}</p>
          <p><strong>Project:</strong> {data.project || 'N/A'}</p>
          <p><strong>Rental Period:</strong> {data.dateFrom} to {data.dateTo}</p>

          <h3>Equipment ({data.items.length} items)</h3>
          <div className="summary-items">
            {data.items.map((item, i) => (
              <div key={i} className="summary-item">
                <div>
                  <span className="summary-name">{item.name}</span>
                  <span className="summary-days">{item.days} {item.days === 1 ? 'day' : 'days'}</span>
                </div>
                <span className="summary-price">
                  {item.priceExclVat > 0
                    ? `${calculatePrice(item.priceExclVat, item.days)} kr`
                    : 'Free'}
                </span>
              </div>
            ))}
          </div>

          <div className="summary-total">
            <span>Total (excl. VAT)</span>
            <strong>{data.totalPrice} kr</strong>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="checkout-buttons" style={{ marginTop: '1.5rem' }}>
            <button
              className="primary-btn"
              onClick={handleSendConfirmation}
              disabled={sending}
              style={{ width: '100%' }}
            >
              {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              {sending ? 'Sending...' : `Send Confirmation Email with PDF to ${data.email}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
