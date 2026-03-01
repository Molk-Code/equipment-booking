import type { CartItem } from '../types';
import { calculatePrice } from '../context/CartContext';

const RECIPIENT_EMAIL = 'fredrik.fridlund@regionvarmland.se';

interface EmailInfo {
  name: string;
  email: string;
  className: string;
  project: string;
  dateFrom: string;
  dateTo: string;
}

export function getPdfFilename(info: EmailInfo): string {
  const name = info.name.replace(/\s+/g, '');
  const today = new Date().toISOString().split('T')[0];
  return `${name}_Equipment_${today}.pdf`;
}

function buildMailtoLink(items: CartItem[], info: EmailInfo, totalPrice: number, rentalDays: number): string {
  const itemLines = items
    .map(item => {
      const qty = item.quantity || 1;
      const price = calculatePrice(item.equipment.priceExclVat, rentalDays) * qty;
      const qtyLabel = qty > 1 ? ` x${qty}` : '';
      return `- ${item.equipment.name}${qtyLabel} (${item.equipment.category}) — ${rentalDays} days — ${item.equipment.priceExclVat > 0 ? `${price} kr` : 'Free'}`;
    })
    .join('\n');

  const subject = `Booking Confirmed — ${info.name} (${info.className}) — ${info.dateFrom}`;

  const body = `Hi ${info.name},

Your equipment booking at Molkom Rental House has been approved.

Booking Details:
Class: ${info.className}
Project: ${info.project || 'N/A'}
Rental Period: ${info.dateFrom} to ${info.dateTo} (${rentalDays} days)
Items: ${items.length}
Total (excl. VAT): ${totalPrice} kr

Equipment List:
${itemLines}

Please pick up the equipment at the scheduled time.

Best regards,
Molkom Rental House`;

  return `mailto:${encodeURIComponent(info.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function sendEmail(
  pdfBlob: Blob,
  items: CartItem[],
  info: EmailInfo,
  totalPrice: number,
  rentalDays: number
): Promise<void> {
  const filename = getPdfFilename(info);

  const itemsList = items
    .map(item => {
      const qty = item.quantity || 1;
      const price = calculatePrice(item.equipment.priceExclVat, rentalDays) * qty;
      const qtyLabel = qty > 1 ? ` x${qty}` : '';
      return `<li>${item.equipment.name}${qtyLabel} (${item.equipment.category}) — ${rentalDays} days — ${item.equipment.priceExclVat > 0 ? `${price} kr` : 'Free'}</li>`;
    })
    .join('\n');

  const mailtoLink = buildMailtoLink(items, info, totalPrice, rentalDays);

  const html = `
    <h2>Equipment Booking Inquiry</h2>
    <p><strong>Student:</strong> ${info.name}</p>
    <p><strong>Student Email:</strong> ${info.email}</p>
    <p><strong>Class:</strong> ${info.className}</p>
    <p><strong>Project:</strong> ${info.project || 'N/A'}</p>
    <p><strong>Period:</strong> ${info.dateFrom} to ${info.dateTo} (${rentalDays} days)</p>
    <p><strong>Items:</strong> ${items.length}</p>
    <p><strong>Total (excl. VAT):</strong> ${totalPrice} kr</p>
    <h3>Equipment List</h3>
    <ul>${itemsList}</ul>
    <hr/>
    <p><strong>To confirm this booking, click below to open a pre-filled email:</strong></p>
    <p><a href="${mailtoLink}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">Confirm Booking — Email ${info.email}</a></p>
    <p style="color:#888;font-size:12px;">This will open your email client with a pre-filled confirmation email to the student.</p>
  `;

  const pdfBase64 = await blobToBase64(pdfBlob);

  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: RECIPIENT_EMAIL,
      subject: `Equipment Booking Inquiry — ${info.name} (${info.className}) — ${info.dateFrom}`,
      html,
      pdfBase64,
      filename,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to send email');
  }
}

export function downloadPdf(pdfBlob: Blob, filename: string) {
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
