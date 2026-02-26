import type { CartItem, CheckoutInfo } from '../types';
import { calculatePrice } from '../context/CartContext';

const RECIPIENT_EMAIL = 'fredrik.fridlund@regionvarmland.se';

export function getPdfFilename(info: CheckoutInfo): string {
  const name = info.name.replace(/\s+/g, '');
  const today = new Date().toISOString().split('T')[0];
  return `${name}_Equipment_${today}.pdf`;
}

function buildConfirmPageUrl(items: CartItem[], info: CheckoutInfo, totalPrice: number): string {
  const confirmData = {
    name: info.name,
    email: info.email,
    className: info.className,
    project: info.project,
    dateFrom: info.dateFrom,
    dateTo: info.dateTo,
    totalPrice,
    items: items.map(item => ({
      name: item.equipment.name,
      category: item.equipment.category,
      days: item.days,
      priceExclVat: item.equipment.priceExclVat,
    })),
  };
  const encoded = btoa(encodeURIComponent(JSON.stringify(confirmData)));
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://equipment-booking-pi.vercel.app';
  return `${baseUrl}/confirm?data=${encoded}`;
}

export async function sendEmail(
  pdfBlob: Blob,
  items: CartItem[],
  info: CheckoutInfo,
  totalPrice: number
): Promise<void> {
  const filename = getPdfFilename(info);

  const itemsList = items
    .map(item => {
      const price = calculatePrice(item.equipment.priceExclVat, item.days);
      return `<li>${item.equipment.name} (${item.equipment.category}) — ${item.days} days — ${item.equipment.priceExclVat > 0 ? `${price} kr` : 'Free'}</li>`;
    })
    .join('\n');

  const confirmPageUrl = buildConfirmPageUrl(items, info, totalPrice);

  const html = `
    <h2>Equipment Booking Inquiry</h2>
    <p><strong>Student:</strong> ${info.name}</p>
    <p><strong>Student Email:</strong> ${info.email}</p>
    <p><strong>Class:</strong> ${info.className}</p>
    <p><strong>Project:</strong> ${info.project || 'N/A'}</p>
    <p><strong>Period:</strong> ${info.dateFrom} to ${info.dateTo}</p>
    <p><strong>Items:</strong> ${items.length}</p>
    <p><strong>Total (excl. VAT):</strong> ${totalPrice} kr</p>
    <h3>Equipment List</h3>
    <ul>${itemsList}</ul>
    <p><em>See attached PDF for the full booking inquiry document.</em></p>
    <hr/>
    <p><strong>To confirm this booking, click the button below:</strong></p>
    <p><a href="${confirmPageUrl}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">Confirm Booking &amp; Send PDF to ${info.email}</a></p>
    <p style="color:#888;font-size:12px;">This will open a confirmation page where you can send the approval email with the booking PDF attached.</p>
  `;

  // Confirmation email HTML for the student/booker
  const confirmationHtml = `
    <h2>Booking Inquiry Received</h2>
    <p>Hi ${info.name},</p>
    <p>Thank you for your equipment booking inquiry at <strong>Molkom Rental House</strong>. Your request has been received and is being reviewed.</p>
    <h3>Booking Details</h3>
    <p><strong>Class:</strong> ${info.className}</p>
    <p><strong>Project:</strong> ${info.project || 'N/A'}</p>
    <p><strong>Rental Period:</strong> ${info.dateFrom} to ${info.dateTo}</p>
    <p><strong>Items Requested:</strong> ${items.length}</p>
    <p><strong>Total (excl. VAT):</strong> ${totalPrice} kr</p>
    <h3>Equipment List</h3>
    <ul>${itemsList}</ul>
    <p><em>A full booking inquiry PDF is attached to this email for your records.</em></p>
    <hr/>
    <p style="color: #888; font-size: 12px;">This is an inquiry confirmation and does not guarantee that all items are accepted or available. You will be contacted by the equipment manager regarding your booking.</p>
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
      confirmationTo: info.email,
      confirmationHtml,
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
