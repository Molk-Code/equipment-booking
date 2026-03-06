// localStorage-only inventory API
// All data is stored locally in the browser — no server-side writes needed

import type { InventoryProject, ProjectItem, ItemStatus, ProjectStatus } from '../types';

const LS_PROJECTS = 'inventory_projects';
const LS_ITEMS = 'inventory_items';

function readProjects(): InventoryProject[] {
  try { return JSON.parse(localStorage.getItem(LS_PROJECTS) || '[]'); }
  catch { return []; }
}

function writeProjects(projects: InventoryProject[]) {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
}

function readItems(): ProjectItem[] {
  try { return JSON.parse(localStorage.getItem(LS_ITEMS) || '[]'); }
  catch { return []; }
}

function writeItems(items: ProjectItem[]) {
  localStorage.setItem(LS_ITEMS, JSON.stringify(items));
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
  equipmentManager: string;
  checkoutDate: string;
  returnDate: string;
}): Promise<InventoryProject> {
  const now = new Date().toISOString();
  const project: InventoryProject = {
    id: generateId(),
    name: data.name,
    borrowers: data.borrowers,
    equipmentManager: data.equipmentManager || '',
    checkoutDate: data.checkoutDate,
    returnDate: data.returnDate,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  const projects = readProjects();
  projects.push(project);
  writeProjects(projects);
  return project;
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx >= 0) {
    projects[idx].status = status;
    projects[idx].updatedAt = new Date().toISOString();
    writeProjects(projects);
  }
}

// Delete a project and all its items from localStorage
export function deleteProject(projectId: string): void {
  const projects = readProjects();
  writeProjects(projects.filter(p => p.id !== projectId));
  const items = readItems();
  writeItems(items.filter(i => i.projectId !== projectId));
}

export async function addProjectItem(item: {
  projectId: string;
  equipmentName: string;
  checkoutTimestamp: string;
}): Promise<void> {
  const items = readItems();
  items.push({
    projectId: item.projectId,
    equipmentName: item.equipmentName,
    checkoutTimestamp: item.checkoutTimestamp,
    checkinTimestamp: '',
    status: 'checked-out',
    damageNotes: '',
  });
  writeItems(items);
}

// Remove a single item from a project (for correcting scan errors)
export function removeProjectItem(
  projectId: string,
  equipmentName: string,
  checkoutTimestamp: string
): void {
  const items = readItems();
  writeItems(items.filter(i =>
    !(i.projectId === projectId && i.equipmentName === equipmentName && i.checkoutTimestamp === checkoutTimestamp)
  ));
}

export async function updateProjectItem(
  projectId: string,
  equipmentName: string,
  updates: {
    checkinTimestamp?: string;
    status?: ItemStatus;
    damageNotes?: string;
  }
): Promise<void> {
  const items = readItems();
  const idx = items.findIndex(
    i => i.projectId === projectId && i.equipmentName === equipmentName
  );
  if (idx >= 0) {
    if (updates.checkinTimestamp !== undefined) items[idx].checkinTimestamp = updates.checkinTimestamp;
    if (updates.status !== undefined) items[idx].status = updates.status;
    if (updates.damageNotes !== undefined) items[idx].damageNotes = updates.damageNotes;
    writeItems(items);
  }
}
