import jsPDF from 'jspdf';
import type { InventoryProject, ProjectItem } from '../types';

const LEGAL_TEXT = 'The following items are loaned to the above-mentioned borrower. The borrowers are aware that by signing this agreement, they are responsible for handling, storing, and transporting the equipment in such a way that no damage or abnormal wear and tear occurs. If any damage occurs, it must be reported immediately to the school\'s representatives for loaned equipment. If the equipment is stolen or lost, it will be reported to the police immediately, followed by investigations from the police, the school, and the insurance company. The borrower may be required to cover all or part of the costs to compensate the school, which should be kept free of costs in the event of an incident. Molkom Folk High School applies full-value compensation if an item needs to be replaced, i.e., if damage occurs or the item is lost, the borrower will be charged the same cost as it would take to replace it with a new purchase.';

export function generateContractPDF(
  project: InventoryProject,
  items: ProjectItem[],
  mode: 'checkout' | 'checkin' = 'checkout'
): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(
    mode === 'checkout' ? 'Equipment Contract' : 'Equipment Return Receipt',
    pageWidth / 2, y, { align: 'center' }
  );
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

  // Project info
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Project Information', 20, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.name}`, 20, y);
  y += 6;
  doc.text(`Borrowers: ${project.borrowers.join(', ')}`, 20, y);
  y += 6;
  if (project.equipmentManager) {
    doc.text(`Equipment Manager: ${project.equipmentManager}`, 20, y);
    y += 6;
  }
  doc.text(`Checkout Date: ${project.checkoutDate}`, 20, y);
  y += 6;
  doc.text(`Return Date: ${project.returnDate}`, 20, y);
  y += 12;

  // Legal terms
  doc.setFontSize(8);
  doc.setTextColor(80);
  const legalLines = doc.splitTextToSize(LEGAL_TEXT, pageWidth - 40);
  doc.text(legalLines, 20, y);
  y += legalLines.length * 3.5 + 8;

  // Divider
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Equipment table header
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(mode === 'checkout' ? 'Equipment List' : 'Return Summary', 20, y);
  y += 10;

  // Table header row
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(30, 30, 30);
  doc.setTextColor(255);
  doc.rect(20, y - 4, pageWidth - 40, 8, 'F');

  if (mode === 'checkout') {
    doc.text('#', 22, y);
    doc.text('Equipment', 30, y);
    doc.text('Scanned At', 140, y);
  } else {
    doc.text('#', 22, y);
    doc.text('Equipment', 30, y);
    doc.text('Status', 130, y);
    doc.text('Notes', 155, y);
  }
  y += 8;

  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');

  // Table rows
  items.forEach((item, index) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(20, y - 4, pageWidth - 40, 7, 'F');
    }

    const name = item.equipmentName.length > 55
      ? item.equipmentName.substring(0, 52) + '...'
      : item.equipmentName;

    if (mode === 'checkout') {
      doc.text(String(index + 1), 22, y);
      doc.text(name, 30, y);
      doc.text(item.checkoutTimestamp || '', 140, y);
    } else {
      doc.text(String(index + 1), 22, y);
      doc.text(name, 30, y);

      const statusText = item.status === 'returned' ? 'OK'
        : item.status === 'damaged' ? 'DAMAGED'
        : item.status === 'missing' ? 'MISSING'
        : 'OUT';

      if (item.status === 'damaged' || item.status === 'missing') {
        doc.setTextColor(200, 0, 0);
      } else {
        doc.setTextColor(0, 150, 0);
      }
      doc.text(statusText, 130, y);
      doc.setTextColor(0);

      if (item.damageNotes) {
        const truncated = item.damageNotes.length > 25
          ? item.damageNotes.substring(0, 22) + '...'
          : item.damageNotes;
        doc.text(truncated, 155, y);
      }
    }
    y += 7;
  });

  y += 5;

  // Summary
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total items: ${items.length}`, 20, y);

  if (mode === 'checkin') {
    const returned = items.filter(i => i.status === 'returned').length;
    const damaged = items.filter(i => i.status === 'damaged').length;
    const missing = items.filter(i => i.status === 'missing').length;
    y += 6;
    doc.text(`Returned: ${returned}  |  Damaged: ${damaged}  |  Missing: ${missing}`, 20, y);
  }

  // Signature lines
  y += 25;
  if (y > 255) {
    doc.addPage();
    y = 30;
  }

  doc.setDrawColor(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  doc.line(20, y, 90, y);
  doc.text('Borrower Signature', 20, y + 5);
  doc.line(110, y, 180, y);
  doc.text('Equipment Manager Signature', 110, y + 5);
  y += 15;
  doc.line(20, y, 90, y);
  doc.text('Date', 20, y + 5);
  doc.line(110, y, 180, y);
  doc.text('Date', 110, y + 5);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('sv-SE')} | Molkom Rental House - Equipment ${mode === 'checkout' ? 'Contract' : 'Return Receipt'}`,
    pageWidth / 2, footerY, { align: 'center' }
  );

  return doc.output('blob');
}
