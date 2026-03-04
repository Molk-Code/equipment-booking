import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { InventoryProject, ProjectItem, QRScanEntry, Equipment, ProjectStatus, ItemStatus } from '../types';
import { fetchProjects, fetchProjectItems, fetchContractScans, startScanPolling } from '../utils/inventory-sheets';
import { fetchEquipment } from '../utils/sheets';
import * as api from '../utils/inventory-api';

// GIDs for the new tabs - these need to be set after creating the tabs in Google Sheets
// For now, we store projects/items in localStorage as fallback and in sheets when API is available
const PROJECTS_GID = localStorage.getItem('inventory_projects_gid') || '';
const ITEMS_GID = localStorage.getItem('inventory_items_gid') || '';

interface InventoryContextType {
  projects: InventoryProject[];
  projectItems: ProjectItem[];
  allEquipment: Equipment[];
  isScanning: boolean;
  scanMode: 'checkout' | 'checkin' | null;
  recentScans: QRScanEntry[];
  loading: boolean;

  loadProjects: () => Promise<void>;
  loadProjectItems: () => Promise<void>;
  loadEquipment: () => Promise<void>;
  createProject: (data: { name: string; borrowers: string[]; checkoutDate: string; returnDate: string }) => Promise<InventoryProject>;
  updateProjectStatus: (id: string, status: ProjectStatus) => Promise<void>;
  startScanning: (projectId: string, mode: 'checkout' | 'checkin') => void;
  stopScanning: () => void;
  addItemFromScan: (projectId: string, scan: QRScanEntry) => Promise<void>;
  updateItemStatus: (projectId: string, equipmentName: string, status: ItemStatus, damageNotes?: string) => Promise<void>;
  markCheckinItem: (projectId: string, equipmentName: string, checkinTimestamp: string) => Promise<void>;
  getProjectItems: (projectId: string) => ProjectItem[];
  getActiveProjects: () => InventoryProject[];
  getArchivedProjects: () => InventoryProject[];
  getDamagedItems: () => ProjectItem[];
  getMostBorrowed: () => { name: string; count: number }[];
  getCheckedOutEquipment: () => { item: ProjectItem; project: InventoryProject }[];
  setProjectsGid: (gid: string) => void;
  setItemsGid: (gid: string) => void;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

const LS_PROJECTS = 'inventory_projects';
const LS_ITEMS = 'inventory_items';

function loadLocalProjects(): InventoryProject[] {
  try {
    return JSON.parse(localStorage.getItem(LS_PROJECTS) || '[]');
  } catch { return []; }
}

function saveLocalProjects(projects: InventoryProject[]) {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
}

function loadLocalItems(): ProjectItem[] {
  try {
    return JSON.parse(localStorage.getItem(LS_ITEMS) || '[]');
  } catch { return []; }
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
  const [activeScanProjectId, setActiveScanProjectId] = useState<string | null>(null);

  // Persist to localStorage whenever projects/items change
  useEffect(() => { saveLocalProjects(projects); }, [projects]);
  useEffect(() => { saveLocalItems(projectItems); }, [projectItems]);

  const loadProjects = useCallback(async () => {
    if (!PROJECTS_GID) return;
    try {
      const data = await fetchProjects(PROJECTS_GID);
      if (data.length > 0) {
        setProjects(data);
      }
    } catch {
      // use local data
    }
  }, []);

  const loadProjectItems = useCallback(async () => {
    if (!ITEMS_GID) return;
    try {
      const data = await fetchProjectItems(ITEMS_GID);
      if (data.length > 0) {
        setProjectItems(data);
      }
    } catch {
      // use local data
    }
  }, []);

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
  useEffect(() => {
    loadEquipment();
    loadProjects();
    loadProjectItems();
  }, [loadEquipment, loadProjects, loadProjectItems]);

  const createProjectFn = useCallback(async (data: { name: string; borrowers: string[]; checkoutDate: string; returnDate: string }) => {
    try {
      const project = await api.createProject(data);
      setProjects(prev => [...prev, project]);
      return project;
    } catch {
      // Fallback: save locally
      const id = `proj_${Math.random().toString(16).slice(2, 10)}`;
      const now = new Date().toISOString();
      const project: InventoryProject = {
        id, ...data, status: 'active', createdAt: now, updatedAt: now,
      };
      setProjects(prev => [...prev, project]);
      return project;
    }
  }, []);

  const updateProjectStatusFn = useCallback(async (id: string, status: ProjectStatus) => {
    setProjects(prev => prev.map(p =>
      p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p
    ));
    try {
      const idx = projects.findIndex(p => p.id === id);
      if (idx >= 0) {
        await api.updateProjectStatus(id, status, idx + 2); // +2 for header row + 1-indexed
      }
    } catch {
      // local update already done
    }
  }, [projects]);

  const startScanning = useCallback((projectId: string, mode: 'checkout' | 'checkin') => {
    // Build set of known scans
    const known = new Set<string>();
    const existingScans = projectItems.filter(i => i.projectId === projectId);
    existingScans.forEach(i => {
      if (i.checkoutTimestamp) known.add(`${i.checkoutTimestamp}|${i.equipmentName}`);
      if (i.checkinTimestamp) known.add(`${i.checkinTimestamp}|${i.equipmentName}`);
    });

    // Also mark all currently known contract scans as known to only catch new ones
    fetchContractScans().then(scans => {
      scans.forEach(s => known.add(`${s.timestamp}|${s.equipmentName}`));
    }).catch(() => {});

    setIsScanning(true);
    setScanMode(mode);
    setRecentScans([]);
    setActiveScanProjectId(projectId);

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
    setActiveScanProjectId(null);
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
    try {
      await api.addProjectItem({
        projectId,
        equipmentName: scan.equipmentName,
        checkoutTimestamp: scan.timestamp,
      });
    } catch {
      // local update already done
    }
  }, []);

  const markCheckinItem = useCallback(async (projectId: string, equipmentName: string, checkinTimestamp: string) => {
    setProjectItems(prev => prev.map(i =>
      i.projectId === projectId && i.equipmentName === equipmentName && !i.checkinTimestamp
        ? { ...i, checkinTimestamp, status: 'returned' as ItemStatus }
        : i
    ));
    // API call would go here with row index
  }, []);

  const updateItemStatusFn = useCallback(async (projectId: string, equipmentName: string, status: ItemStatus, damageNotes?: string) => {
    setProjectItems(prev => prev.map(i =>
      i.projectId === projectId && i.equipmentName === equipmentName
        ? { ...i, status, damageNotes: damageNotes || i.damageNotes }
        : i
    ));
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

  const setProjectsGid = useCallback((gid: string) => {
    localStorage.setItem('inventory_projects_gid', gid);
  }, []);

  const setItemsGid = useCallback((gid: string) => {
    localStorage.setItem('inventory_items_gid', gid);
  }, []);

  return (
    <InventoryContext.Provider value={{
      projects, projectItems, allEquipment, isScanning, scanMode, recentScans, loading,
      loadProjects, loadProjectItems, loadEquipment,
      createProject: createProjectFn,
      updateProjectStatus: updateProjectStatusFn,
      startScanning, stopScanning,
      addItemFromScan, updateItemStatus: updateItemStatusFn, markCheckinItem,
      getProjectItems, getActiveProjects, getArchivedProjects,
      getDamagedItems, getMostBorrowed, getCheckedOutEquipment,
      setProjectsGid, setItemsGid,
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
