import jsPDF from 'jspdf';
import type { InventoryProject, ProjectItem, Equipment } from '../types';

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
  mode: 'checkout' | 'checkin' = 'checkout',
  equipmentList: Equipment[] = []
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

  // Build a lookup map for equipment "included" items
  // Match by normalized name (lowercase, strip #N suffixes and parenthetical content)
  const includedMap = new Map<string, string[]>();
  equipmentList.forEach(eq => {
    if (eq.included && eq.included.length > 0) {
      const normName = eq.name.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').trim();
      if (!includedMap.has(normName)) {
        includedMap.set(normName, eq.included);
      }
    }
  });

  function findIncluded(itemName: string): string[] | undefined {
    const norm = itemName.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').trim();
    return includedMap.get(norm);
  }

  // Table rows
  mergedItems.forEach((merged, index) => {
    const included = findIncluded(merged.name);
    const includedLineCount = included ? included.length : 0;
    const rowHeight = 7 + includedLineCount * 4;

    if (y + rowHeight > 265) {
      doc.addPage();
      y = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(20, y - 4, pageWidth - 40, rowHeight, 'F');
    }

    const displayName = merged.quantity > 1
      ? `${merged.quantity}x ${merged.name}`
      : merged.name;
    const truncatedName = displayName.length > 55
      ? displayName.substring(0, 52) + '...'
      : displayName;

    if (mode === 'checkout') {
      const displayTimestamp = formatTimestamp(merged.representative.checkoutTimestamp);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      doc.text(String(index + 1), 22, y);
      doc.text(truncatedName, 30, y);
      doc.text(displayTimestamp || '', 140, y);
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
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

    // Show included items below the equipment name
    if (included && included.length > 0) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100);
      const includesText = 'Includes: ' + included.join(', ');
      const includesLines = doc.splitTextToSize(includesText, pageWidth - 60);
      includesLines.forEach((line: string) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 34, y);
        y += 4;
      });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
    }
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

// ---- User Guide PDF ----

export function generateUserGuidePDF(): Blob {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pw - margin * 2;
  let y = 20;

  function checkPage(needed: number) {
    if (y + needed > 275) {
      doc.addPage();
      y = 20;
    }
  }

  function heading(text: string, size = 16) {
    checkPage(20);
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(text, margin, y);
    y += size * 0.5 + 4;
  }

  function subheading(text: string) {
    checkPage(16);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(text, margin, y);
    y += 8;
  }

  function paragraph(text: string) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(text, contentWidth);
    checkPage(lines.length * 5 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  function bulletList(items: string[]) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    items.forEach(item => {
      const lines = doc.splitTextToSize(item, contentWidth - 8);
      checkPage(lines.length * 5 + 3);
      doc.text('\u2022', margin + 2, y);
      doc.text(lines, margin + 8, y);
      y += lines.length * 5 + 3;
    });
  }

  function numberedList(items: string[]) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    items.forEach((item, i) => {
      const lines = doc.splitTextToSize(item, contentWidth - 10);
      checkPage(lines.length * 5 + 3);
      doc.text(`${i + 1}.`, margin + 1, y);
      doc.text(lines, margin + 10, y);
      y += lines.length * 5 + 3;
    });
  }

  function divider() {
    y += 3;
    checkPage(8);
    doc.setDrawColor(200);
    doc.line(margin, y, pw - margin, y);
    y += 8;
  }

  // ====== COVER ======
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Molkom Rental House', pw / 2, 60, { align: 'center' });

  doc.setFontSize(18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text('Inventory System', pw / 2, 72, { align: 'center' });

  doc.setFontSize(14);
  doc.text('User Guide', pw / 2, 84, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Version 2.0  |  ${new Date().toLocaleDateString('sv-SE')}`, pw / 2, 100, { align: 'center' });

  // ====== TABLE OF CONTENTS ======
  doc.addPage();
  y = 20;
  heading('Table of Contents', 18);
  y += 4;

  const tocItems = [
    '1. Overview',
    '2. Logging In',
    '3. Dashboard',
    '4. Creating a New Project',
    '5. Checkout Process (Scanning Equipment)',
    '6. Managing a Checked-Out Project',
    '7. Returning Equipment (Check-In)',
    '8. Statistics & Equipment Status',
    '9. Booking Page Password',
    '10. Data Backup',
    '11. Downloading PDF Contracts',
    '12. Tips & Troubleshooting',
  ];
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30);
  tocItems.forEach(item => {
    doc.text(item, margin + 5, y);
    y += 7;
  });

  // ====== 1. OVERVIEW ======
  doc.addPage();
  y = 20;
  heading('1. Overview', 18);
  paragraph('The Molkom Rental House Inventory System is a web-based tool for managing film equipment check-out and check-in. It works together with a mobile QR scanning app that reads equipment barcodes.');
  y += 2;
  paragraph('The system lets you:');
  bulletList([
    'Create projects with borrower names and dates',
    'Select borrowers from the student list (Klasslista) or type names manually',
    'Scan equipment in and out using a mobile QR scanner',
    'Add equipment manually using a visual equipment picker with images',
    'Track which equipment is currently checked out, damaged, or missing',
    'Generate PDF contracts for borrowers to sign',
    'View statistics on most-borrowed and damaged equipment, plus borrower history',
    'Control booking page access with a password managed from Google Sheets',
    'Backup and restore all data',
  ]);

  divider();

  // ====== 2. LOGGING IN ======
  heading('2. Logging In', 18);
  paragraph('When you first visit the inventory system, you will see a password prompt. Enter the password to access the system. The password is the same for all users and is given to you by the equipment managers.');
  y += 2;
  paragraph('Once logged in, the session stays active until you close the browser tab. You do not need to log in again while the tab is open.');
  y += 2;
  paragraph('Note: The inventory system password is separate from the booking page password. The inventory password is hardcoded, while the booking page password can be changed from Google Sheets (see section 9).');

  divider();

  // ====== 3. DASHBOARD ======
  heading('3. Dashboard', 18);
  paragraph('The Dashboard is the main overview page. At the top you see quick statistics:');
  bulletList([
    'Active Projects: number of projects currently being set up',
    'Items Out: total number of equipment items currently checked out (clickable)',
    'Damaged: number of items reported as damaged (clickable)',
    'Missing: number of items marked as missing (only shown if > 0, clickable)',
  ]);
  y += 2;
  paragraph('Clicking the Items Out, Damaged, or Missing stat cards takes you directly to the corresponding tab in the Statistics page.');
  y += 2;
  paragraph('Below the stats you find:');
  bulletList([
    'Active Projects: cards for each project. Click a card to open the project.',
    'Currently Checked Out Equipment: a quick list of all items that are currently out.',
    'Archived Projects: collapsed section with old/completed projects. Click to expand.',
  ]);
  y += 2;
  paragraph('You can delete a project by clicking the red trash icon on the project card. This permanently removes the project and all its items.');
  y += 2;
  subheading('Settings area:');
  paragraph('At the bottom of the Dashboard, a separate settings area contains Data Backup controls and the User Guide download button. These are visually separated from the project content above.');

  divider();

  // ====== 4. CREATING A NEW PROJECT ======
  heading('4. Creating a New Project', 18);
  paragraph('Click "New Project" in the navigation bar to create a new checkout project.');
  y += 2;
  subheading('Required fields:');
  numberedList([
    'Project Name: give the project a descriptive name (e.g. "Documentary Short Film")',
    'Borrowers: select from the student list or type names manually (see below)',
    'Equipment Manager: select who is responsible for this checkout (Fredrik, Karl, or Mats)',
    'Checkout Date: today\'s date is pre-filled, change if needed',
    'Return Date: when the equipment should be returned',
  ]);

  y += 2;
  subheading('Selecting borrowers (Klasslista):');
  paragraph('If a student list (Klasslista) is set up in the Google Sheet, a dropdown appears with students grouped by Film 1 and Film 2. Select a student from the dropdown to add them as a borrower. Already-added students appear greyed out.');
  y += 2;
  paragraph('You can also type a name manually in the text field below the dropdown and press Enter or click "Add". This is useful for borrowers not on the student list. Selected borrowers appear as removable chips above the input.');
  y += 2;
  paragraph('Click "Create Project" to save. You will be taken directly to the project page where scanning begins automatically.');

  divider();

  // ====== 5. CHECKOUT PROCESS ======
  heading('5. Checkout Process (Scanning Equipment)', 18);
  paragraph('After creating a project, the scanning mode starts automatically. The system now listens for QR scans from the mobile scanning app.');
  y += 2;
  subheading('How scanning works:');
  numberedList([
    'Open the mobile QR scanning app on a phone or tablet',
    'Scan equipment QR codes one by one',
    'Each scanned item appears in real-time on the web page under "Scanned Items"',
    'If you scan the same item multiple times, it will be grouped (e.g. "3x Sandbag")',
  ]);

  y += 2;
  subheading('Adding items manually with the equipment picker:');
  paragraph('Click the "Add Equipment" button to open the visual equipment picker. This opens a full-screen modal showing all equipment as cards with images, organized by category (Camera, Grip, Lights, Sound, Location, Books). Use the search bar to filter items. Click a card to select it, then confirm to add it to the project.');
  y += 2;
  paragraph('You can also type an equipment name directly in the "Add item manually..." text field and press Enter.');

  y += 2;
  subheading('Removing items during scanning:');
  paragraph('If an item was scanned by mistake, click the red trash icon next to it to remove it from the list.');

  y += 2;
  subheading('Finishing the checkout:');
  paragraph('When all items are scanned, click the "Done" button at the bottom. The project status changes to "Checked Out" and you can now download the PDF contract.');

  divider();

  // ====== 6. MANAGING A CHECKED-OUT PROJECT ======
  heading('6. Managing a Checked-Out Project', 18);
  paragraph('Once a project is checked out, you can open it from the Dashboard to manage the equipment. You will see:');
  bulletList([
    'A summary bar showing how many items are returned, still out, and missing',
    'The full equipment list with action buttons for each item',
    '"Add Items" button to scan or pick more equipment into the project',
    '"Download Contract PDF" button',
  ]);

  y += 2;
  subheading('Item actions (per item):');
  bulletList([
    'Green checkmark: Mark the item as returned',
    'Wrench icon: Report damage (opens a text field for damage description)',
    'Red X: Mark the item as missing (with optional notes)',
  ]);

  y += 2;
  paragraph('Damage and missing notes can be viewed later by clicking on the note text next to the item.');

  divider();

  // ====== 7. RETURNING EQUIPMENT ======
  heading('7. Returning Equipment (Check-In)', 18);
  paragraph('When borrowers return equipment, open the project and use the item action buttons to mark items as returned one by one.');
  y += 2;
  numberedList([
    'Open the checked-out project from the Dashboard',
    'For each returned item, click the green checkmark button',
    'For damaged items, click the wrench icon and describe the damage',
    'For items that are not returned, click the red X to mark as missing',
    'When done, click "Complete Return & Archive Project" at the bottom',
  ]);
  y += 2;
  paragraph('If any items are still marked as "checked out" when you archive, the system will warn you and automatically mark them as missing.');
  y += 2;
  paragraph('After archiving, you can download a Return Receipt PDF that shows which items were returned, damaged, or missing.');

  divider();

  // ====== 8. STATISTICS ======
  heading('8. Statistics & Equipment Status', 18);
  paragraph('Click "Statistics" in the navigation to see an overview of all equipment and borrowing history. The page shows stat cards at the top and has six tabs:');
  y += 2;
  subheading('Tabs:');
  bulletList([
    'Most Borrowed: shows which equipment has been borrowed the most times, ranked by frequency.',
    'Equipment Status: a grid of all equipment from the master list. Checked-out items appear first. Shows which project each item is in.',
    'Damaged Items: list of all damaged items with damage notes and project links. Click the checkmark to mark as resolved.',
    'Missing Items: list of all missing items with project links. Click the icon to mark as found/returned.',
    'Borrowers: a table of all students from the Klasslista, showing their class (Film 1 or Film 2), number of projects, damaged items, and missing items. Click the numbers to see which projects are involved.',
    'Projects: a list of all projects (active and archived) with borrower names and dates. Click any project to open it.',
  ]);
  y += 2;
  paragraph('You can also access specific tabs by clicking the stat cards on the Dashboard or on the Statistics page itself.');

  divider();

  // ====== 9. BOOKING PAGE PASSWORD ======
  heading('9. Booking Page Password', 18);
  paragraph('The booking page (where students browse and book equipment) can be optionally password-protected. This password is managed from Google Sheets and is separate from the inventory system password.');

  y += 2;
  subheading('How it works:');
  bulletList([
    'The booking password is stored in the Google Sheet, in the "Losenord Booking" tab, cell A2.',
    'If A2 contains a password, visitors must enter it to access the booking page.',
    'If A2 is empty, the booking page is open to everyone without a password.',
    'When the password is changed, all previously authenticated sessions are invalidated. Users must enter the new password.',
  ]);

  y += 2;
  subheading('Viewing and changing the password:');
  numberedList([
    'In the inventory system, click "Password" in the top navigation bar.',
    'A panel shows the current booking page password (or "no password set").',
    'Click "Open Losenord Booking" to go directly to the correct tab in Google Sheets.',
    'In Google Sheets, edit cell A2 to set a new password, or clear it to remove the password.',
  ]);
  y += 2;
  paragraph('The password panel refreshes every time you open it, so you always see the current value.');

  divider();

  // ====== 10. DATA BACKUP ======
  heading('10. Data Backup', 18);
  paragraph('All data is stored in the browser\'s localStorage. This means data can be lost if the browser data is cleared. Use the backup features to protect your data. The backup controls are in the settings area at the bottom of the Dashboard.');
  y += 2;
  subheading('Auto-Backup (recommended):');
  numberedList([
    'On the Dashboard, find the "Data Backup" section in the settings area at the bottom',
    'Click "Enable Auto-Backup"',
    'Choose a location on your computer to save the backup file',
    'The system will automatically save a backup every hour',
    'If browser data is cleared, the backup file is restored automatically on next visit',
    'To stop auto-backup, click "Disable"',
  ]);
  y += 2;
  paragraph('Note: Auto-Backup uses the File System Access API and is only available in Chrome and Edge browsers.');

  y += 2;
  subheading('Manual Backup:');
  bulletList([
    'Manual Export: click to download a JSON file with all current data',
    'Manual Import: click to restore data from a previously exported JSON file. This replaces all current data.',
  ]);

  divider();

  // ====== 11. PDF CONTRACTS ======
  heading('11. Downloading PDF Contracts', 18);
  paragraph('The system can generate two types of PDF documents:');
  y += 2;
  subheading('Equipment Contract (checkout):');
  paragraph('Generated when equipment is checked out. Contains project info, borrower names, the legal agreement text, the full equipment list, and signature lines for borrower and equipment manager.');
  y += 2;
  subheading('Return Receipt (check-in):');
  paragraph('Generated after a project is archived. Shows which items were returned, damaged, or missing, along with any damage notes.');
  y += 2;
  paragraph('To download: open the project page and click the download buttons. For active projects, the contract PDF is available. For archived projects, both the original contract and the return receipt are available.');

  divider();

  // ====== 12. TIPS ======
  heading('12. Tips & Troubleshooting', 18);
  y += 2;
  subheading('Navigation:');
  bulletList([
    'Use the top navigation bar to switch between Dashboard, New Project, Statistics, and Password',
    'Click the "Booking" link to go back to the main booking system',
    'Click the Molkom Rental House logo to return to the Dashboard',
  ]);

  y += 2;
  subheading('Common issues:');
  bulletList([
    'Scanned items not appearing? Make sure the mobile scanner is writing to the correct Google Sheet tab and the web page is open.',
    'Lost data after clearing browser? If auto-backup was enabled, just visit the page again and data will be restored. Otherwise, use Manual Import with a backup file.',
    'Duplicate items? The system automatically merges items with the same name (e.g. 3x Sandbag).',
    'Need to add items to a checked-out project? Open the project and click "Add Items" to start scanning or use the equipment picker.',
    'Cannot see auto-backup option? This feature only works in Chrome and Edge. Use Manual Export/Import in other browsers.',
    'Student list not showing? Make sure the Klasslista tab in Google Sheets has student names organized by Film 1 and Film 2.',
    'Booking password not working? Make sure cell A2 in the "Losenord Booking" tab is filled in. Users may need to refresh the page.',
  ]);

  y += 4;
  subheading('Quick reference:');
  bulletList([
    'Inventory password: provided by equipment managers (hardcoded)',
    'Booking password: set in Google Sheets > Losenord Booking > A2',
    'URL: the /inventory path on the booking website',
    'Supported browsers: Chrome, Edge (full features), Safari, Firefox (no auto-backup)',
  ]);

  // Footer on last page
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Molkom Rental House - Inventory System User Guide v2.0  |  Generated: ${new Date().toLocaleDateString('sv-SE')}`,
    pw / 2, footerY, { align: 'center' }
  );

  return doc.output('blob');
}
