// Inventory API — uses Google Sheets via serverless endpoints for persistent storage
// localStorage is used as a fast cache and offline fallback

import type { InventoryProject, ProjectItem, ItemStatus, ProjectStatus } from '../types';

const API_URL = '/api/inventory-data';
const LS_PROJECTS = 'inventory_projects';
const LS_ITEMS = 'inventory_items';
const LS_LAST_SYNC = 'inventory_last_sync';

// ===== localStorage cache helpers =====

function readLocalProjects(): InventoryProject[] {
  try { return JSON.parse(localStorage.getItem(LS_PROJECTS) || '[]'); }
  catch { return []; }
}

function writeLocalProjects(projects: InventoryProject[]) {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
}

function readLocalItems(): ProjectItem[] {
  try { return JSON.parse(localStorage.getItem(LS_ITEMS) || '[]'); }
  catch { return []; }
}

function writeLocalItems(items: ProjectItem[]) {
  localStorage.setItem(LS_ITEMS, JSON.stringify(items));
}

// ===== API communication =====

/** Fetch all data from the server (Google Sheets) */
export async function fetchFromServer(): Promise<{ projects: InventoryProject[]; items: ProjectItem[] }> {
  const res = await fetch(API_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch inventory data: ${res.status}`);
  }
  const data = await res.json();
  // Update local cache
  writeLocalProjects(data.projects);
  writeLocalItems(data.items);
  localStorage.setItem(LS_LAST_SYNC, String(data.timestamp || Date.now()));
  return { projects: data.projects, items: data.items };
}

/** Save all data to the server (Google Sheets) */
async function saveToServer(projects: InventoryProject[], items: ProjectItem[]): Promise<void> {
  // Update local cache immediately
  writeLocalProjects(projects);
  writeLocalItems(items);

  // Then push to server (fire-and-forget, with retry)
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects, items }),
    });
    if (!res.ok) {
      console.error('Failed to save to server:', res.status);
    } else {
      const data = await res.json();
      localStorage.setItem(LS_LAST_SYNC, String(data.timestamp || Date.now()));
    }
  } catch (err) {
    console.error('Failed to save to server (will retry on next action):', err);
  }
}

// Debounce saves to avoid hammering the API on rapid changes
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSave = false;

function debouncedSave() {
  pendingSave = true;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (pendingSave) {
      pendingSave = false;
      const projects = readLocalProjects();
      const items = readLocalItems();
      saveToServer(projects, items);
    }
  }, 1000); // Wait 1s after last change before saving
}

// ===== ID generation =====

function generateId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `proj_${hex}`;
}

// ===== Public API (same interface as before) =====

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
  const projects = readLocalProjects();
  projects.push(project);
  writeLocalProjects(projects);
  debouncedSave();
  return project;
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  const projects = readLocalProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx >= 0) {
    projects[idx].status = status;
    projects[idx].updatedAt = new Date().toISOString();
    writeLocalProjects(projects);
    debouncedSave();
  }
}

export function deleteProject(projectId: string): void {
  const projects = readLocalProjects();
  writeLocalProjects(projects.filter(p => p.id !== projectId));
  const items = readLocalItems();
  writeLocalItems(items.filter(i => i.projectId !== projectId));
  debouncedSave();
}

export async function addProjectItem(item: {
  projectId: string;
  equipmentName: string;
  checkoutTimestamp: string;
}): Promise<void> {
  const items = readLocalItems();
  items.push({
    projectId: item.projectId,
    equipmentName: item.equipmentName,
    checkoutTimestamp: item.checkoutTimestamp,
    checkinTimestamp: '',
    status: 'checked-out',
    damageNotes: '',
  });
  writeLocalItems(items);
  debouncedSave();
}

export function removeProjectItem(
  projectId: string,
  equipmentName: string,
  checkoutTimestamp: string
): void {
  const items = readLocalItems();
  writeLocalItems(items.filter(i =>
    !(i.projectId === projectId && i.equipmentName === equipmentName && i.checkoutTimestamp === checkoutTimestamp)
  ));
  debouncedSave();
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
  const items = readLocalItems();
  const idx = items.findIndex(
    i => i.projectId === projectId && i.equipmentName === equipmentName
  );
  if (idx >= 0) {
    if (updates.checkinTimestamp !== undefined) items[idx].checkinTimestamp = updates.checkinTimestamp;
    if (updates.status !== undefined) items[idx].status = updates.status;
    if (updates.damageNotes !== undefined) items[idx].damageNotes = updates.damageNotes;
    writeLocalItems(items);
    debouncedSave();
  }
}
