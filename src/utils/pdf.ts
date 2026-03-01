import jsPDF from 'jspdf';
import type { CartItem } from '../types';
import { calculatePrice } from '../context/CartContext';

interface PdfInfo {
  name: string;
  email: string;
  className: string;
  project: string;
  dateFrom: string;
  dateTo: string;
}

export function generatePDF(
  items: CartItem[],
  info: PdfInfo,
  totalPrice: number,
  rentalDays: number
): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Equipment Booking Inquiry', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Molkom Rental House', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Divider
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Borrower info
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Borrower Information', 20, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${info.name}`, 20, y);
  y += 6;
  doc.text(`Email: ${info.email}`, 20, y);
  y += 6;
  doc.text(`Class: ${info.className}`, 20, y);
  y += 6;
  doc.text(`Project: ${info.project || 'N/A'}`, 20, y);
  y += 6;
  doc.text(`Rental Period: ${info.dateFrom} to ${info.dateTo} (${rentalDays} days)`, 20, y);
  y += 12;

  // Inquiry disclaimer
  doc.setFontSize(8);
  doc.setTextColor(100);
  const disclaimerText =
    'This is an inquiry and does not guarantee that all items are accepted or available. The borrower is responsible for properly handling, storing, and transporting all loaned equipment. Any damage must be reported immediately.';
  const disclaimerLines = doc.splitTextToSize(disclaimerText, pageWidth - 40);
  doc.text(disclaimerLines, 20, y);
  y += disclaimerLines.length * 4 + 8;

  // Divider
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Table header
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Equipment List', 20, y);
  y += 10;

  // Table columns
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(30, 30, 30);
  doc.setTextColor(255);
  doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
  doc.text('Item', 22, y);
  doc.text('Qty', 110, y);
  doc.text('Category', 122, y);
  doc.text('Price', 165, y, { align: 'right' });
  y += 8;

  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');

  // Table rows
  items.forEach((item, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(20, y - 4, pageWidth - 40, 7, 'F');
    }

    const qty = item.quantity || 1;
    const name = item.equipment.name.length > 50
      ? item.equipment.name.substring(0, 47) + '...'
      : item.equipment.name;

    doc.text(name, 22, y);
    doc.text(String(qty), 110, y);
    doc.text(item.equipment.category, 122, y);

    const price = calculatePrice(item.equipment.priceExclVat, rentalDays) * qty;
    doc.text(
      item.equipment.priceExclVat > 0 ? `${price} kr` : 'Free',
      165,
      y,
      { align: 'right' }
    );
    y += 7;
  });

  y += 5;

  // Total
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 8;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Total (excl. VAT):', 100, y);
  doc.text(`${totalPrice} kr`, 165, y, { align: 'right' });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('sv-SE')} | Molkom Rental House - Equipment Booking Inquiry`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  return doc.output('blob');
}
