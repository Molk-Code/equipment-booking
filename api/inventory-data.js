// Serverless API endpoint for inventory data (projects & items)
// Stores data in Google Sheets tabs: "InventoryProjects" and "InventoryItems"
// Supports GET (fetch all data) and POST (save all data)

import { readSheet, replaceSheetData } from './sheets-auth.js';

const PROJECTS_TAB = 'InventoryProjects';
const ITEMS_TAB = 'InventoryItems';

// Project columns: id, name, borrowers (JSON), equipmentManager, checkoutDate, returnDate, status, createdAt, updatedAt
const PROJECT_HEADERS = ['id', 'name', 'borrowers', 'equipmentManager', 'checkoutDate', 'returnDate', 'status', 'createdAt', 'updatedAt'];

// Item columns: projectId, equipmentName, checkoutTimestamp, checkinTimestamp, status, damageNotes
const ITEM_HEADERS = ['projectId', 'equipmentName', 'checkoutTimestamp', 'checkinTimestamp', 'status', 'damageNotes'];

function projectToRow(p) {
  return [
    p.id || '',
    p.name || '',
    JSON.stringify(p.borrowers || []),
    p.equipmentManager || '',
    p.checkoutDate || '',
    p.returnDate || '',
    p.status || 'active',
    p.createdAt || '',
    p.updatedAt || '',
  ];
}

function rowToProject(row) {
  let borrowers = [];
  try { borrowers = JSON.parse(row[2] || '[]'); } catch { borrowers = []; }
  return {
    id: row[0] || '',
    name: row[1] || '',
    borrowers,
    equipmentManager: row[3] || '',
    checkoutDate: row[4] || '',
    returnDate: row[5] || '',
    status: row[6] || 'active',
    createdAt: row[7] || '',
    updatedAt: row[8] || '',
  };
}

function itemToRow(item) {
  return [
    item.projectId || '',
    item.equipmentName || '',
    item.checkoutTimestamp || '',
    item.checkinTimestamp || '',
    item.status || 'checked-out',
    item.damageNotes || '',
  ];
}

function rowToItem(row) {
  return {
    projectId: row[0] || '',
    equipmentName: row[1] || '',
    checkoutTimestamp: row[2] || '',
    checkinTimestamp: row[3] || '',
    status: row[4] || 'checked-out',
    damageNotes: row[5] || '',
  };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Fetch all projects and items from Sheets
      const [projectRows, itemRows] = await Promise.all([
        readSheet(`${PROJECTS_TAB}!A:I`).catch(() => []),
        readSheet(`${ITEMS_TAB}!A:F`).catch(() => []),
      ]);

      // Skip header row (first row)
      const projects = projectRows.slice(1).filter(r => r[0]).map(rowToProject);
      const items = itemRows.slice(1).filter(r => r[0]).map(rowToItem);

      return res.status(200).json({
        projects,
        items,
        timestamp: Date.now(),
      });
    }

    if (req.method === 'POST') {
      const { projects, items } = req.body;

      if (!Array.isArray(projects) || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid data: projects and items must be arrays' });
      }

      // Write both tabs in parallel
      await Promise.all([
        replaceSheetData(
          `${PROJECTS_TAB}!A:I`,
          PROJECT_HEADERS,
          projects.map(projectToRow)
        ),
        replaceSheetData(
          `${ITEMS_TAB}!A:F`,
          ITEM_HEADERS,
          items.map(itemToRow)
        ),
      ]);

      return res.status(200).json({
        success: true,
        projectCount: projects.length,
        itemCount: items.length,
        timestamp: Date.now(),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Inventory data error:', err.message || err);
    return res.status(500).json({
      error: 'Failed to access inventory data: ' + (err.message || 'unknown error'),
    });
  }
}
