import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { InventoryProject, ProjectItem, QRScanEntry, Equipment, ProjectStatus, ItemStatus } from '../types';
import { fetchContractScans, startScanPolling } from '../utils/inventory-sheets';
import { fetchEquipment } from '../utils/sheets';
import * as api from '../utils/inventory-api';

interface InventoryContextType {
  projects: InventoryProject[];
  projectItems: ProjectItem[];
  allEquipment: Equipment[];
  isScanning: boolean;
  scanMode: 'checkout' | 'checkin' | null;
  recentScans: QRScanEntry[];
  loading: boolean;

  createProject: (data: { name: string; borrowers: string[]; checkoutDate: string; returnDate: string }) => Promise<InventoryProject>;
  updateProjectStatus: (id: string, status: ProjectStatus) => Promise<void>;
  deleteProject: (id: string) => void;
  startScanning: (projectId: string, mode: 'checkout' | 'checkin') => void;
  stopScanning: () => void;
  addItemFromScan: (projectId: string, scan: QRScanEntry) => Promise<void>;
  removeProjectItem: (projectId: string, equipmentName: string, checkoutTimestamp: string) => void;
  updateItemStatus: (projectId: string, equipmentName: string, status: ItemStatus, damageNotes?: string) => Promise<void>;
  markCheckinItem: (projectId: string, equipmentName: string, checkinTimestamp: string) => Promise<void>;
  getProjectItems: (projectId: string) => ProjectItem[];
  getActiveProjects: () => InventoryProject[];
  getArchivedProjects: () => InventoryProject[];
  getDamagedItems: () => ProjectItem[];
  getMissingItems: () => { item: ProjectItem; project: InventoryProject }[];
  getMostBorrowed: () => { name: string; count: number }[];
  getCheckedOutEquipment: () => { item: ProjectItem; project: InventoryProject }[];
  loadEquipment: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

const LS_PROJECTS = 'inventory_projects';
const LS_ITEMS = 'inventory_items';

function loadLocalProjects(): InventoryProject[] {
  try { return JSON.parse(localStorage.getItem(LS_PROJECTS) || '[]'); }
  catch { return []; }
}

function saveLocalProjects(projects: InventoryProject[]) {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
}

function loadLocalItems(): ProjectItem[] {
  try { return JSON.parse(localStorage.getItem(LS_ITEMS) || '[]'); }
  catch { return []; }
}

function saveLocalItems(items: ProjectItem[]) {
  localStorage.setItem(LS_ITEMS, JSON.stringify(items));
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<InventoryProject[]>(loadLocalProjects);
  const [projectItems, setProjectItems] = useState<ProjectItem[]>(loadLocalItems);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'checkout' | 'checkin' | null>(null);
  const [recentScans, setRecentScans] = useState<QRScanEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [stopPoll, setStopPoll] = useState<(() => void) | null>(null);

  // Persist to localStorage whenever projects/items change
  useEffect(() => { saveLocalProjects(projects); }, [projects]);
  useEffect(() => { saveLocalItems(projectItems); }, [projectItems]);

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEquipment();
      setAllEquipment(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load equipment on mount
  useEffect(() => { loadEquipment(); }, [loadEquipment]);

  const createProjectFn = useCallback(async (data: { name: string; borrowers: string[]; checkoutDate: string; returnDate: string }) => {
    const project = await api.createProject(data);
    setProjects(prev => [...prev, project]);
    return project;
  }, []);

  const updateProjectStatusFn = useCallback(async (id: string, status: ProjectStatus) => {
    setProjects(prev => prev.map(p =>
      p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p
    ));
    await api.updateProjectStatus(id, status);
  }, []);

  // Delete a project and all its items
  const deleteProjectFn = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setProjectItems(prev => prev.filter(i => i.projectId !== id));
    api.deleteProject(id);
  }, []);

  const startScanning = useCallback((projectId: string, mode: 'checkout' | 'checkin') => {
    // Build set of known scans
    const known = new Set<string>();
    const existingScans = projectItems.filter(i => i.projectId === projectId);
    existingScans.forEach(i => {
      if (i.checkoutTimestamp) known.add(`${i.checkoutTimestamp}|${i.equipmentName}`);
      if (i.checkinTimestamp) known.add(`${i.checkinTimestamp}|${i.equipmentName}`);
    });

    // Mark all currently known contract scans as known to only catch new ones
    fetchContractScans().then(scans => {
      scans.forEach(s => known.add(`${s.timestamp}|${s.equipmentName}`));
    }).catch(() => {});

    setIsScanning(true);
    setScanMode(mode);
    setRecentScans([]);

    const stop = startScanPolling((newScans) => {
      setRecentScans(prev => [...newScans, ...prev]);
    }, known);

    setStopPoll(() => stop);
  }, [projectItems]);

  const stopScanning = useCallback(() => {
    if (stopPoll) stopPoll();
    setIsScanning(false);
    setScanMode(null);
    setStopPoll(null);
  }, [stopPoll]);

  const addItemFromScan = useCallback(async (projectId: string, scan: QRScanEntry) => {
    const newItem: ProjectItem = {
      projectId,
      equipmentName: scan.equipmentName,
      checkoutTimestamp: scan.timestamp,
      checkinTimestamp: '',
      status: 'checked-out',
      damageNotes: '',
    };
    setProjectItems(prev => [...prev, newItem]);
    await api.addProjectItem({
      projectId,
      equipmentName: scan.equipmentName,
      checkoutTimestamp: scan.timestamp,
    });
  }, []);

  // Remove a single item from a project (for correcting scan errors)
  const removeProjectItemFn = useCallback((projectId: string, equipmentName: string, checkoutTimestamp: string) => {
    setProjectItems(prev => prev.filter(i =>
      !(i.projectId === projectId && i.equipmentName === equipmentName && i.checkoutTimestamp === checkoutTimestamp)
    ));
    // Also remove from recent scans display
    setRecentScans(prev => prev.filter(s =>
      !(s.equipmentName === equipmentName && s.timestamp === checkoutTimestamp)
    ));
    api.removeProjectItem(projectId, equipmentName, checkoutTimestamp);
  }, []);

  const markCheckinItem = useCallback(async (projectId: string, equipmentName: string, checkinTimestamp: string) => {
    setProjectItems(prev => prev.map(i =>
      i.projectId === projectId && i.equipmentName === equipmentName && !i.checkinTimestamp
        ? { ...i, checkinTimestamp, status: 'returned' as ItemStatus }
        : i
    ));
    await api.updateProjectItem(projectId, equipmentName, { checkinTimestamp, status: 'returned' });
  }, []);

  const updateItemStatusFn = useCallback(async (projectId: string, equipmentName: string, status: ItemStatus, damageNotes?: string) => {
    setProjectItems(prev => prev.map(i =>
      i.projectId === projectId && i.equipmentName === equipmentName
        ? { ...i, status, damageNotes: damageNotes || i.damageNotes }
        : i
    ));
    await api.updateProjectItem(projectId, equipmentName, { status, damageNotes });
  }, []);

  const getProjectItems = useCallback((projectId: string) => {
    return projectItems.filter(i => i.projectId === projectId);
  }, [projectItems]);

  const getActiveProjects = useCallback(() => {
    return projects.filter(p => p.status === 'active' || p.status === 'checked-out');
  }, [projects]);

  const getArchivedProjects = useCallback(() => {
    return projects.filter(p => p.status === 'archived' || p.status === 'returned');
  }, [projects]);

  const getDamagedItems = useCallback(() => {
    return projectItems.filter(i => i.status === 'damaged');
  }, [projectItems]);

  // Get missing items — items marked 'missing' that haven't been checked out again in a newer project
  const getMissingItems = useCallback(() => {
    const missingItems = projectItems.filter(i => i.status === 'missing');
    // Check if any missing item was later checked out in another project (meaning it came back)
    return missingItems
      .filter(missingItem => {
        const laterCheckouts = projectItems.filter(i =>
          i.equipmentName === missingItem.equipmentName &&
          i.projectId !== missingItem.projectId &&
          i.status === 'checked-out' &&
          i.checkoutTimestamp > missingItem.checkoutTimestamp
        );
        // If the item was checked out again later, it came back — not missing anymore
        return laterCheckouts.length === 0;
      })
      .map(item => ({
        item,
        project: projects.find(p => p.id === item.projectId)!,
      }))
      .filter(x => x.project);
  }, [projects, projectItems]);

  const getMostBorrowed = useCallback(() => {
    const counts: Record<string, number> = {};
    projectItems.forEach(i => {
      counts[i.equipmentName] = (counts[i.equipmentName] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [projectItems]);

  const getCheckedOutEquipment = useCallback(() => {
    const activeProjectIds = new Set(
      projects.filter(p => p.status === 'active' || p.status === 'checked-out').map(p => p.id)
    );
    return projectItems
      .filter(i => activeProjectIds.has(i.projectId) && i.status === 'checked-out')
      .map(item => ({
        item,
        project: projects.find(p => p.id === item.projectId)!,
      }))
      .filter(x => x.project);
  }, [projects, projectItems]);

  return (
    <InventoryContext.Provider value={{
      projects, projectItems, allEquipment, isScanning, scanMode, recentScans, loading,
      loadEquipment,
      createProject: createProjectFn,
      updateProjectStatus: updateProjectStatusFn,
      deleteProject: deleteProjectFn,
      startScanning, stopScanning,
      addItemFromScan,
      removeProjectItem: removeProjectItemFn,
      updateItemStatus: updateItemStatusFn, markCheckinItem,
      getProjectItems, getActiveProjects, getArchivedProjects,
      getDamagedItems, getMissingItems, getMostBorrowed, getCheckedOutEquipment,
    }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory(): InventoryContextType {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}
