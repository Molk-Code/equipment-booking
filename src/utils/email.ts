import emailjs from '@emailjs/browser';
import type { CartItem, CheckoutInfo } from '../types';
import { calculatePrice } from '../context/CartContext';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';

export function getPdfFilename(info: CheckoutInfo): string {
  const name = info.name.replace(/\s+/g, '');
  const today = new Date().toISOString().split('T')[0];
  return `${name}_Equipment_${today}.pdf`;
}

export async function sendEmail(
  pdfBlob: Blob,
  items: CartItem[],
  info: CheckoutInfo,
  totalPrice: number
): Promise<void> {
  const itemsList = items
    .map(item => {
      const price = calculatePrice(item.equipment.priceExclVat, item.days);
      return `- ${item.equipment.name} (${item.equipment.category}) | ${item.days} days | ${item.equipment.priceExclVat > 0 ? `${price} kr` : 'Price TBD'}`;
    })
    .join('\n');

  const base64 = await blobToBase64(pdfBlob);
  const filename = getPdfFilename(info);

  const templateParams = {
    to_email: 'fredrik.fridlund@fhsregionvarmland.se',
    from_name: info.name,
    student_name: info.name,
    student_class: info.className,
    date_from: info.dateFrom,
    date_to: info.dateTo,
    items_list: itemsList,
    total_price: `${totalPrice} kr`,
    items_count: items.length.toString(),
    content: base64,
    filename: filename,
    subject: `Equipment Booking - ${info.name} (${info.className}) - ${info.dateFrom}`,
  };

  if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') {
    // Demo mode - download PDF instead
    downloadPdf(pdfBlob, filename);
    throw new Error('EmailJS is not configured. The PDF has been downloaded instead. Please set up EmailJS credentials in your .env file.');
  }

  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
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
