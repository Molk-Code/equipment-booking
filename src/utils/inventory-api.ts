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

// ===== Timestamp normalisation =====
// The Apps Script / Google Sheets round-trip can alter timestamp strings
// (e.g. "manual_2026-04-12 14:30:05" → "2026-04-12T14:30:05.000Z", or
// locale-formatted dates).  We normalise to "YYYY-MM-DD HH:MM" (16 chars)
// so that format differences don't make identical moments look like different keys.
function normTs(ts: string): string {
  return ts
    .replace(/^manual_/, '')          // strip manual_ prefix
    .replace('T', ' ')                // ISO T separator → space
    .replace(/\.\d+Z?$/, '')          // strip milliseconds + Z
    .replace(/(\d{1,2})\.(\d{2})\.\d{2}$/, '$1:$2') // HH.MM.SS → HH:MM
    .trim()
    .slice(0, 16);                    // keep only YYYY-MM-DD HH:MM
}

function itemKey(i: ProjectItem): string {
  return `${i.projectId}|${i.equipmentName}|${normTs(i.checkoutTimestamp)}`;
}
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

  // Use normalised keys so timestamp format differences don't create phantom duplicates
  const serverItemKeys = new Set(serverItems.map(itemKey));
  const localOnlyItems = localItems.filter(i => !serverItemKeys.has(itemKey(i)));

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

  // Prefer local item if it has more progress (checked-in, damage notes, etc.)
  // Also prefer local when it carries fields the server doesn't store
  // (addonSessionId, addonCollectedBy, addonManager, addonDate, assignedTo).
  const localItemMap = new Map(localItems.map(i => [itemKey(i), i]));
  const mergedServerItems = serverItems.map(si => {
    const li = localItemMap.get(itemKey(si));
    if (li) {
      if (li.checkinTimestamp && !si.checkinTimestamp) return li;
      if (li.status !== si.status && li.status !== 'checked-out') return li;
      if (li.damageNotes && !si.damageNotes) return li;
      // Preserve addon session metadata that the server (Apps Script) doesn't persist
      if (li.addonSessionId && !si.addonSessionId) return li;
      // Preserve task assignment that the server doesn't persist
      if (li.assignedTo && !si.assignedTo) return li;
    }
    return si;
  });

  // ── Deduplicate projects by id ──
  const seenProjectIds = new Set<string>();
  const mergedProjects = [...mergedServerProjects, ...localOnlyProjects].filter(p => {
    if (seenProjectIds.has(p.id)) return false;
    seenProjectIds.add(p.id);
    return true;
  });

  // ── Deduplicate items ──
  // QR-scanned items (no manual_ prefix): deduplicate by (projectId, name) to
  // collapse phantom duplicates the Apps Script may have appended.
  // Manually added items (manual_ prefix): deduplicate by (projectId, name, timestamp)
  // so the user can legitimately add 3× the same item via the picker.
  // Add-on session items: scoped by addonSessionId so they aren't merged with
  // the original checkout items or items from other sessions.
  const nameKeyMap = new Map<string, ProjectItem>();
  for (const i of [...mergedServerItems, ...localOnlyItems]) {
    const nk = i.addonSessionId
      ? `${i.projectId}|${i.equipmentName}|addon_${i.addonSessionId}`
      : i.checkoutTimestamp.startsWith('manual_')
        ? `${i.projectId}|${i.equipmentName}|${i.checkoutTimestamp}` // allow multi-qty
        : `${i.projectId}|${i.equipmentName}`; // QR-scanned: collapse duplicates
    const existing = nameKeyMap.get(nk);
    if (!existing) {
      nameKeyMap.set(nk, i);
    } else {
      // Prefer the item with more progress
      const betterStatus = existing.status === 'checked-out' && i.status !== 'checked-out';
      const betterCheckin = !existing.checkinTimestamp && i.checkinTimestamp;
      const betterNotes = !existing.damageNotes && i.damageNotes;
      if (betterStatus || betterCheckin || betterNotes) {
        nameKeyMap.set(nk, i);
      }
    }
  }
  const mergedItems = [...nameKeyMap.values()];

  // Update local cache
  writeLocalProjects(mergedProjects);
  writeLocalItems(mergedItems);
  localStorage.setItem(LS_LAST_SYNC, String(data.timestamp || Date.now()));

  // Always push merged (clean) data back to repair any server-side duplicates
  const serverItemCount = serverItems.length;
  const needsRepair = localOnlyProjects.length > 0 || localOnlyItems.length > 0 ||
                      serverItemCount > mergedItems.length; // server had more = had duplicates
  if (needsRepair) {
    console.log(`[sync] Repairing server data — server had ${serverItemCount} items, clean set has ${mergedItems.length}`);
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

export async function updateProject(
  projectId: string,
  updates: {
    name?: string;
    borrowers?: string[];
    equipmentManager?: string;
    checkoutDate?: string;
    returnDate?: string;
  }
): Promise<void> {
  markDirty();
  const projects = readLocalProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx >= 0) {
    if (updates.name !== undefined) projects[idx].name = updates.name;
    if (updates.borrowers !== undefined) projects[idx].borrowers = updates.borrowers;
    if (updates.equipmentManager !== undefined) projects[idx].equipmentManager = updates.equipmentManager;
    if (updates.checkoutDate !== undefined) projects[idx].checkoutDate = updates.checkoutDate;
    if (updates.returnDate !== undefined) projects[idx].returnDate = updates.returnDate;
    projects[idx].updatedAt = new Date().toISOString();
    writeLocalProjects(projects);
    debouncedSave();
  }
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
  addonSessionId?: string;
  addonDate?: string;
  addonCollectedBy?: string;
  addonManager?: string;
}): Promise<void> {
  markDirty();
  const items = readLocalItems();
  // Guard: prevent scan race-condition duplicates for QR-scanned items.
  // Manually added items (manual_ timestamp) are allowed multiple times so the
  // user can check out 3× the same item via the equipment picker.
  const isManual = item.checkoutTimestamp.startsWith('manual_');
  const alreadyStored = !isManual && items.some(
    i => i.projectId === item.projectId &&
         i.equipmentName === item.equipmentName &&
         i.status !== 'returned' &&
         (item.addonSessionId
           ? i.addonSessionId === item.addonSessionId
           : !i.addonSessionId)
  );
  if (alreadyStored) return;
  items.push({
    projectId: item.projectId,
    equipmentName: item.equipmentName,
    checkoutTimestamp: item.checkoutTimestamp,
    checkinTimestamp: '',
    status: 'checked-out',
    damageNotes: '',
    addonSessionId: item.addonSessionId,
    addonDate: item.addonDate,
    addonCollectedBy: item.addonCollectedBy,
    addonManager: item.addonManager,
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
    assignedTo?: string;
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
    if (updates.assignedTo !== undefined) items[idx].assignedTo = updates.assignedTo || undefined;
    writeLocalItems(items);
    debouncedSave();
  }
}
