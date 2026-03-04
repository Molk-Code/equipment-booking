import type { InventoryProject, ProjectItem, ItemStatus, ProjectStatus } from '../types';

const API_URL = '/api/sheets-write';

async function apiCall(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

function generateId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `proj_${hex}`;
}

export async function createProject(data: {
  name: string;
  borrowers: string[];
  checkoutDate: string;
  returnDate: string;
}): Promise<InventoryProject> {
  const id = generateId();
  const now = new Date().toISOString();
  const project: InventoryProject = {
    id,
    name: data.name,
    borrowers: data.borrowers,
    checkoutDate: data.checkoutDate,
    returnDate: data.returnDate,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await apiCall({
    action: 'appendRow',
    sheetName: 'Projects',
    values: [
      project.id,
      project.name,
      project.borrowers.join(', '),
      project.checkoutDate,
      project.returnDate,
      project.status,
      project.createdAt,
      project.updatedAt,
    ],
  });

  return project;
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus,
  rowIndex: number
): Promise<void> {
  const now = new Date().toISOString();
  await apiCall({
    action: 'updateCell',
    sheetName: 'Projects',
    range: `F${rowIndex}:H${rowIndex}`,
    values: [status, '', now],
  });
}

export async function addProjectItem(item: {
  projectId: string;
  equipmentName: string;
  checkoutTimestamp: string;
}): Promise<void> {
  await apiCall({
    action: 'appendRow',
    sheetName: 'Project Items',
    values: [
      item.projectId,
      item.equipmentName,
      item.checkoutTimestamp,
      '', // checkinTimestamp
      'checked-out',
      '', // damageNotes
    ],
  });
}

export async function updateProjectItem(
  projectId: string,
  equipmentName: string,
  updates: {
    checkinTimestamp?: string;
    status?: ItemStatus;
    damageNotes?: string;
  },
  rowIndex: number
): Promise<void> {
  // Update columns D-F (checkin, status, damage)
  await apiCall({
    action: 'updateCell',
    sheetName: 'Project Items',
    range: `D${rowIndex}:F${rowIndex}`,
    values: [
      updates.checkinTimestamp || '',
      updates.status || 'checked-out',
      updates.damageNotes || '',
    ],
  });
}

export async function batchUpdateItems(
  updates: Array<{
    rowIndex: number;
    checkinTimestamp: string;
    status: ItemStatus;
    damageNotes: string;
  }>
): Promise<void> {
  await apiCall({
    action: 'batchUpdate',
    sheetName: 'Project Items',
    updates: updates.map(u => ({
      range: `D${u.rowIndex}:F${u.rowIndex}`,
      values: [u.checkinTimestamp, u.status, u.damageNotes],
    })),
  });
}
