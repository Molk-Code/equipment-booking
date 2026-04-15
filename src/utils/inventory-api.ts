// Inventory API — uses Google Sheets via serverless endpoints for persistent storage
// localStorage is used as a fast cache and offline fallback
//
// SYNC STRATEGY:
// - Local changes update React state + localStorage immediately (optimistic)
// - A debounced save pushes ALL data to the server after 2s of quiet
// - Server polling (every 15s) is SKIPPED while unsaved local changes exist
// - This prevents stale server data from overwriting in-progress edits
// - After a save succeeds, the dirty flag clears and the next poll is safe

import type { InventoryProject, ProjectItem, ItemStatus, ProjectStatus } from '../types';

const API_URL = '/api/inventory-data';
const LS_PROJECTS = 'inventory_projects';
const LS_ITEMS = 'inventory_items';
const LS_LAST_SYNC = 'inventory_last_sync';

// ===== Dirty tracking =====
// Prevents server polls from overwriting unsaved local changes.
// Every local mutation bumps `localVersion`. When a save succeeds,
// `savedVersion` catches up. Polling is blocked while versions differ.

let localVersion = 0;
let savedVersion = 0;
let saving = false;

function markDirty() {
  localVersion++;
}

/** True if there are unsaved local changes or a save is in-flight */
export function isDirty(): boolean {
  return localVersion > savedVersion || saving;
}

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

/**
 * Fetch data from the server (Google Sheets).
 * Returns null if local changes are pending (dirty) — caller should skip the update.
 */
export async function fetchFromServer(): Promise<{ projects: InventoryProject[]; items: ProjectItem[] } | null> {
  // ── Guard 1: skip if local changes haven't been saved yet ──
  if (isDirty()) {
    console.log('[sync] Skipping poll — unsaved local changes');
    return null;
  }

  const res = await fetch(API_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch inventory data: ${res.status}`);
  }
  const data = await res.json();
  const serverProjects: InventoryProject[] = data.projects || [];
  const serverItems: ProjectItem[] = data.items || [];

  // ── Guard 2: re-check after network wait ──
  // A user action may have happened while the GET was in flight.
  if (isDirty()) {
    console.log('[sync] Skipping server data — local change happened during fetch');
    return null;
  }

  // ── Read localStorage FRESH (after the network call) ──
  // This ensures we merge with the very latest local state.
  const localProjects = readLocalProjects();
  const localItems = readLocalItems();

  // Safety: never overwrite local data with an empty server response
  const serverIsEmpty = serverProjects.length === 0 && serverItems.length === 0;
  const localHasData = localProjects.length > 0 || localItems.length > 0;

  if (serverIsEmpty && localHasData) {
    console.warn('[sync] Server empty but local has data — pushing local to server');
    pushToServer(localProjects, localItems);
    return { projects: localProjects, items: localItems };
  }

  // Merge: keep server data + any local-only entries
  const serverProjectIds = new Set(serverProjects.map(p => p.id));
  const localOnlyProjects = localProjects.filter(p => !serverProjectIds.has(p.id));

  const serverItemKeys = new Set(
    serverItems.map(i => `${i.projectId}|${i.equipmentName}|${i.checkoutTimestamp}`)
  );
  const localOnlyItems = localItems.filter(
    i => !serverItemKeys.has(`${i.projectId}|${i.equipmentName}|${i.checkoutTimestamp}`)
  );

  // Also check for locally-updated fields on existing projects (status, dates, etc.)
  const localProjectMap = new Map(localProjects.map(p => [p.id, p]));
  const mergedServerProjects = serverProjects.map(sp => {
    const lp = localProjectMap.get(sp.id);
    if (lp && lp.updatedAt > sp.updatedAt) {
      // Local version is newer — keep local
      return lp;
    }
    return sp;
  });

  // Same for items — prefer local if it has a newer status/checkin
  const localItemMap = new Map(
    localItems.map(i => [`${i.projectId}|${i.equipmentName}|${i.checkoutTimestamp}`, i])
  );
  const mergedServerItems = serverItems.map(si => {
    const key = `${si.projectId}|${si.equipmentName}|${si.checkoutTimestamp}`;
    const li = localItemMap.get(key);
    if (li) {
      // Keep the version with more progress (checked-in > checked-out, has damage notes, etc.)
      if (li.checkinTimestamp && !si.checkinTimestamp) return li;
      if (li.status !== si.status && li.status !== 'checked-out') return li;
      if (li.damageNotes && !si.damageNotes) return li;
    }
    return si;
  });

  const mergedProjects = [...mergedServerProjects, ...localOnlyProjects];
  const mergedItems = [...mergedServerItems, ...localOnlyItems];

  // Update local cache
  writeLocalProjects(mergedProjects);
  writeLocalItems(mergedItems);
  localStorage.setItem(LS_LAST_SYNC, String(data.timestamp || Date.now()));

  // Push merged data back if we had local-only entries
  if (localOnlyProjects.length > 0 || localOnlyItems.length > 0) {
    console.log(`[sync] Merging ${localOnlyProjects.length} local projects + ${localOnlyItems.length} local items → server`);
    pushToServer(mergedProjects, mergedItems);
  }

  return { projects: mergedProjects, items: mergedItems };
}

/**
 * Low-level push to server. Used by both debouncedSave and merge logic.
 * Does NOT mark dirty — that's handled by the caller.
 */
async function pushToServer(projects: InventoryProject[], items: ProjectItem[]): Promise<boolean> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects, items }),
    });
    if (!res.ok) {
      console.error('[sync] Save failed:', res.status);
      return false;
    }
    const data = await res.json();
    localStorage.setItem(LS_LAST_SYNC, String(data.timestamp || Date.now()));
    return true;
  } catch (err) {
    console.error('[sync] Save failed:', err);
    return false;
  }
}

// ===== Debounced save =====

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    // Snapshot the version we're saving
    const versionAtSave = localVersion;
    saving = true;

    // Read the FRESHEST localStorage (not a stale snapshot)
    const projects = readLocalProjects();
    const items = readLocalItems();

    // Update local cache (redundant but ensures consistency)
    writeLocalProjects(projects);
    writeLocalItems(items);

    const ok = await pushToServer(projects, items);
    saving = false;

    if (ok) {
      // Only advance savedVersion if no newer changes came in during the save
      if (versionAtSave >= savedVersion) {
        savedVersion = versionAtSave;
      }
    }

    // If more local changes arrived while we were saving, save again
    if (localVersion > versionAtSave) {
      console.log('[sync] More changes arrived during save — re-saving');
      debouncedSave();
    }
  }, 2000); // 2s debounce — gives user time to finish a burst of actions
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
  markDirty();
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
  markDirty();
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
  markDirty();
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
  markDirty();
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
  markDirty();
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
  markDirty();
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
