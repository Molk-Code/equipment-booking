import jsPDF from 'jspdf';
import type { InventoryProject, ProjectItem } from '../types';

// Normalize timestamp for display: strip manual_ prefix, convert dots to colons, drop seconds
function formatTimestamp(ts: string): string {
  // Strip manual_ prefix
  let clean = ts.startsWith('manual_') ? ts.replace('manual_', '') : ts;
  // If it looks like a time with dots (22.34.09), convert to colon format
  clean = clean.replace(/(\d{1,2})\.(\d{2})\.(\d{2})/, '$1:$2');
  // If it looks like a time with colons and seconds (22:34:09), drop seconds
  clean = clean.replace(/(\d{1,2}:\d{2}):\d{2}/, '$1');
  return clean.trim();
}

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

  // Merge duplicate items by equipment name
  const mergedItems: { name: string; quantity: number; representative: ProjectItem; }[] = [];
  const itemGroups = new Map<string, { items: ProjectItem[]; quantity: number }>();
  items.forEach(item => {
    const key = item.equipmentName;
    const existing = itemGroups.get(key);
    if (existing) {
      existing.items.push(item);
      existing.quantity++;
    } else {
      itemGroups.set(key, { items: [item], quantity: 1 });
    }
  });
  itemGroups.forEach((group, name) => {
    mergedItems.push({ name, quantity: group.quantity, representative: group.items[0] });
  });

  // Table rows
  mergedItems.forEach((merged, index) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(20, y - 4, pageWidth - 40, 7, 'F');
    }

    const displayName = merged.quantity > 1
      ? `${merged.quantity}x ${merged.name}`
      : merged.name;
    const truncatedName = displayName.length > 55
      ? displayName.substring(0, 52) + '...'
      : displayName;

    if (mode === 'checkout') {
      const displayTimestamp = formatTimestamp(merged.representative.checkoutTimestamp);
      doc.text(String(index + 1), 22, y);
      doc.text(truncatedName, 30, y);
      doc.text(displayTimestamp || '', 140, y);
    } else {
      doc.text(String(index + 1), 22, y);
      doc.text(truncatedName, 30, y);

      const statusText = merged.representative.status === 'returned' ? 'OK'
        : merged.representative.status === 'damaged' ? 'DAMAGED'
        : merged.representative.status === 'missing' ? 'MISSING'
        : 'OUT';

      if (merged.representative.status === 'damaged' || merged.representative.status === 'missing') {
        doc.setTextColor(200, 0, 0);
      } else {
        doc.setTextColor(0, 150, 0);
      }
      doc.text(statusText, 130, y);
      doc.setTextColor(0);

      if (merged.representative.damageNotes) {
        const truncated = merged.representative.damageNotes.length > 25
          ? merged.representative.damageNotes.substring(0, 22) + '...'
          : merged.representative.damageNotes;
        doc.text(truncated, 155, y);
      }
    }
    y += 7;
  });

  // Count total individual items for summary
  const totalItemCount = items.length;

  y += 5;

  // Summary
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total items: ${totalItemCount}`, 20, y);

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
