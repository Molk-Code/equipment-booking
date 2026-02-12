import emailjs from '@emailjs/browser';
import type { CartItem, CheckoutInfo } from '../types';
import { calculatePrice } from '../context/CartContext';

// EmailJS configuration - update these with your actual IDs
// Sign up at https://www.emailjs.com/ (free: 200 emails/month)
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';

export async function sendEmail(
  pdfBlob: Blob,
  items: CartItem[],
  info: CheckoutInfo,
  totalPrice: number
): Promise<void> {
  // Build the items list as text for the email body
  const itemsList = items
    .map(item => {
      const price = calculatePrice(item.equipment.priceExclVat, item.days);
      return `- ${item.equipment.name} (${item.equipment.category}) | ${item.days} days | ${item.equipment.priceExclVat > 0 ? `${price} kr` : 'Price TBD'}`;
    })
    .join('\n');

  // Convert PDF blob to base64 for attachment
  const base64 = await blobToBase64(pdfBlob);

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
    pdf_attachment: base64,
    subject: `Equipment Booking - ${info.name} (${info.className}) - ${info.dateFrom}`,
  };

  if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') {
    // Demo mode - just download the PDF instead
    console.warn('EmailJS not configured. Downloading PDF instead.');
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-${info.name.replace(/\s+/g, '-')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    throw new Error('EmailJS is not configured. The PDF has been downloaded instead. Please set up EmailJS credentials in your .env file.');
  }

  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
