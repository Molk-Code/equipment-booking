import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { InventoryProject, ProjectItem, QRScanEntry, Equipment, ProjectStatus, ItemStatus, Klasslista, AddonSession } from '../types';
import { fetchContractScans, startScanPolling } from '../utils/inventory-sheets';
import { fetchEquipment } from '../utils/sheets';
import { fetchKlasslista } from '../utils/klasslista-sheets';
import { fetchProjektlista } from '../utils/projektlista-sheets';
import * as api from '../utils/inventory-api';
import { fetchFromServer } from '../utils/inventory-api';

export interface BorrowerStat {
  name: string;
  group: 'Film 1' | 'Film 2';
  projectCount: number;
  damagedCount: number;
  missingCount: number;
  taskCount: number;
}

interface InventoryContextType {
  projects: InventoryProject[];
  projectItems: ProjectItem[];
  allEquipment: Equipment[];
  isScanning: boolean;
  scanMode: 'checkout' | 'checkin' | null;
  recentScans: QRScanEntry[];
  loading: boolean;
  klasslista: Klasslista | null;
  klasslistaLoading: boolean;
  projektlista: string[];

  createProject: (data: { name: string; borrowers: string[]; equipmentManager: string; checkoutDate: string; returnDate: string }) => Promise<InventoryProject>;
  updateProject: (id: string, updates: { name?: string; borrowers?: string[]; equipmentManager?: string; checkoutDate?: string; returnDate?: string }) => Promise<void>;
  updateProjectStatus: (id: string, status: ProjectStatus) => Promise<void>;
  deleteProject: (id: string) => void;
  startScanning: (projectId: string, mode: 'checkout' | 'checkin') => void;
  stopScanning: () => void;
  addItemFromScan: (projectId: string, scan: QRScanEntry, addonSession?: AddonSession) => Promise<void>;
  removeProjectItem: (projectId: string, equipmentName: string, checkoutTimestamp: string) => void;
  updateItemStatus: (projectId: string, equipmentName: string, status: ItemStatus, damageNotes?: string, assignedTo?: string) => Promise<void>;
  markCheckinItem: (projectId: string, equipmentName: string, checkinTimestamp: string) => Promise<void>;
  getProjectItems: (projectId: string) => ProjectItem[];
  getActiveProjects: () => InventoryProject[];
  getArchivedProjects: () => InventoryProject[];
  getDamagedItems: () => ProjectItem[];
  getMissingItems: () => { item: ProjectItem; project: InventoryProject }[];
  getMostBorrowed: () => { name: string; count: number }[];
  getCheckedOutEquipment: () => { item: ProjectItem; project: InventoryProject }[];
  getOverdueEquipment: () => { item: ProjectItem; project: InventoryProject; daysOverdue: number }[];
  getBorrowerStats: () => BorrowerStat[];
  loadEquipment: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

const LS_PROJECTS = 'inventory_projects';
const LS_ITEMS = 'inventory_items';

// Quick localStorage reads for initial render (before server data arrives)
function loadLocalProjects(): InventoryProject[] {
  try { return JSON.parse(localStorage.getItem(LS_PROJECTS) || '[]'); }
  catch { return []; }
}

function loadLocalItems(): ProjectItem[] {
  try { return JSON.parse(localStorage.getItem(LS_ITEMS) || '[]'); }
  catch { return []; }
}

const SYNC_INTERVAL = 15000; // Poll every 15 seconds

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<InventoryProject[]>(loadLocalProjects);
  const [projectItems, setProjectItems] = useState<ProjectItem[]>(loadLocalItems);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'checkout' | 'checkin' | null>(null);
  const [recentScans, setRecentScans] = useState<QRScanEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [stopPoll, setStopPoll] = useState<(() => void) | null>(null);
  const [klasslista, setKlasslista] = useState<Klasslista | null>(null);
  const [klasslistaLoading, setKlasslistaLoading] = useState(false);
  const [projektlista, setProjektlista] = useState<string[]>([]);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load data from server on mount (Google Sheets), fall back to localStorage
  useEffect(() => {
    let cancelled = false;
    fetchFromServer().then(data => {
      // data is null if local changes are pending (dirty) — skip
      if (!cancelled && data) {
        setProjects(data.projects);
        setProjectItems(data.items);
      }
    }).catch(err => {
      console.warn('Server fetch failed, using local cache:', err.message);
    });
    return () => { cancelled = true; };
  }, []);

  // Poll server for updates every SYNC_INTERVAL ms
  // fetchFromServer() returns null when local edits are unsaved,
  // so we never overwrite in-progress work.
  useEffect(() => {
    syncTimerRef.current = setInterval(() => {
      fetchFromServer().then(data => {
        if (data) {
          setProjects(data.projects);
          setProjectItems(data.items);
        }
      }).catch(() => {
        // Silently fail — local cache is still valid
      });
    }, SYNC_INTERVAL);
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
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
  useEffect(() => { loadEquipment(); }, [loadEquipment]);

  // Load klasslista on mount
  const loadKlasslista = useCallback(async () => {
    setKlasslistaLoading(true);
    try {
      const data = await fetchKlasslista();
      setKlasslista(data);
    } catch {
      console.warn('Failed to load klasslista');
    } finally {
      setKlasslistaLoading(false);
    }
  }, []);

  useEffect(() => { loadKlasslista(); }, [loadKlasslista]);

  // Load projektlista on mount
  useEffect(() => {
    fetchProjektlista()
      .then(names => setProjektlista(names))
      .catch(() => console.warn('Failed to load projektlista'));
  }, []);

  const createProjectFn = useCallback(async (data: { name: string; borrowers: string[]; equipmentManager: string; checkoutDate: string; returnDate: string }) => {
    const project = await api.createProject(data);
    setProjects(prev => [...prev, project]);
    return project;
  }, []);

  const updateProjectFn = useCallback(async (id: string, updates: { name?: string; borrowers?: string[]; equipmentManager?: string; checkoutDate?: string; returnDate?: string }) => {
    setProjects(prev => prev.map(p =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    ));
    await api.updateProject(id, updates);
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
    setIsScanning(true);
    setScanMode(mode);
    setRecentScans([]);

    // Use a plain object so we can mutate it from inside the async callback
    // without stale closure issues.
    const state: { cancelled: boolean; stopPolling: (() => void) | null } = {
      cancelled: false,
      stopPolling: null,
    };

    // Set a stop function immediately so the user can cancel even while
    // fetchContractScans is still in-flight.
    const stopFn = () => {
      state.cancelled = true;
      if (state.stopPolling) state.stopPolling();
    };
    setStopPoll(() => stopFn);

    // ── Key fix: await the initial sheet state BEFORE starting the poll ──
    // Without this, the poll fires (3 s interval) before `known` is populated
    // and treats every existing scan as "new", re-adding all items on each
    // page load / Vercel deploy.
    fetchContractScans()
      .catch(() => [] as QRScanEntry[])
      .then(scans => {
        if (state.cancelled) return; // scanning was stopped while fetching

        const known = new Set<string>();
        scans.forEach(s => known.add(`${s.timestamp}|${s.equipmentName}`));

        state.stopPolling = startScanPolling(
          // On new scans added to sheets
          (newScans) => {
            setRecentScans(prev => [...newScans, ...prev]);
          },
          // On scans removed from sheets
          (removedScans) => {
            setRecentScans(prev => prev.filter(s => {
              const key = `${s.timestamp}|${s.equipmentName}`;
              return !removedScans.some(r => `${r.timestamp}|${r.equipmentName}` === key);
            }));
            removedScans.forEach(removed => {
              setProjectItems(prevItems => prevItems.filter(i =>
                !(i.projectId === projectId && i.equipmentName === removed.equipmentName && i.checkoutTimestamp === removed.timestamp)
              ));
              api.removeProjectItem(projectId, removed.equipmentName, removed.timestamp);
            });
          },
          known
        );
      });
  }, []);

  const stopScanning = useCallback(() => {
    if (stopPoll) stopPoll();
    setIsScanning(false);
    setScanMode(null);
    setStopPoll(null);
  }, [stopPoll]);

  const addItemFromScan = useCallback(async (projectId: string, scan: QRScanEntry, addonSession?: AddonSession) => {
    const newItem: ProjectItem = {
      projectId,
      equipmentName: scan.equipmentName,
      checkoutTimestamp: scan.timestamp,
      checkinTimestamp: '',
      status: 'checked-out',
      damageNotes: '',
      addonSessionId: addonSession?.sessionId,
      addonDate: addonSession?.date,
      addonCollectedBy: addonSession?.collectedBy,
      addonManager: addonSession?.manager,
    };
    setProjectItems(prev => [...prev, newItem]);
    await api.addProjectItem({
      projectId,
      equipmentName: scan.equipmentName,
      checkoutTimestamp: scan.timestamp,
      addonSessionId: addonSession?.sessionId,
      addonDate: addonSession?.date,
      addonCollectedBy: addonSession?.collectedBy,
      addonManager: addonSession?.manager,
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

  const updateItemStatusFn = useCallback(async (projectId: string, equipmentName: string, status: ItemStatus, damageNotes?: string, assignedTo?: string) => {
    setProjectItems(prev => prev.map(i =>
      i.projectId === projectId && i.equipmentName === equipmentName
        ? { ...i, status, damageNotes: damageNotes ?? i.damageNotes, assignedTo: assignedTo !== undefined ? (assignedTo || undefined) : i.assignedTo }
        : i
    ));
    await api.updateProjectItem(projectId, equipmentName, { status, damageNotes, assignedTo });
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

  const getOverdueEquipment = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'checked-out');
    const overdueProjects = activeProjects.filter(p => p.returnDate < today);
    const overdueProjectMap = new Map(overdueProjects.map(p => [p.id, p]));

    return projectItems
      .filter(i => overdueProjectMap.has(i.projectId) && i.status === 'checked-out')
      .map(item => {
        const proj = overdueProjectMap.get(item.projectId)!;
        const returnDate = new Date(proj.returnDate);
        const now = new Date();
        const daysOverdue = Math.ceil((now.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24));
        return { item, project: proj, daysOverdue };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [projects, projectItems]);

  const getBorrowerStats = useCallback((): BorrowerStat[] => {
    if (!klasslista) return [];

    const stats: BorrowerStat[] = [];

    const processGroup = (names: string[], group: 'Film 1' | 'Film 2') => {
      for (const name of names) {
        const nameLower = name.toLowerCase();
        // Find projects where this person is a borrower
        const involvedProjects = projects.filter(p =>
          p.borrowers.some(b => b.toLowerCase() === nameLower)
        );
        const involvedProjectIds = new Set(involvedProjects.map(p => p.id));

        // Count damaged and missing items in those projects
        const damagedCount = projectItems.filter(
          i => involvedProjectIds.has(i.projectId) && i.status === 'damaged'
        ).length;
        const missingCount = projectItems.filter(
          i => involvedProjectIds.has(i.projectId) && i.status === 'missing'
        ).length;
        // Count missing items assigned to this student (from any project)
        const taskCount = projectItems.filter(
          i => i.status === 'missing' && i.assignedTo && i.assignedTo.toLowerCase() === nameLower
        ).length;

        stats.push({
          name,
          group,
          projectCount: involvedProjects.length,
          damagedCount,
          missingCount,
          taskCount,
        });
      }
    };

    processGroup(klasslista.film1, 'Film 1');
    processGroup(klasslista.film2, 'Film 2');

    // Sort by project count descending
    stats.sort((a, b) => b.projectCount - a.projectCount);
    return stats;
  }, [klasslista, projects, projectItems]);

  return (
    <InventoryContext.Provider value={{
      projects, projectItems, allEquipment, isScanning, scanMode, recentScans, loading,
      klasslista, klasslistaLoading, projektlista,
      loadEquipment,
      createProject: createProjectFn,
      updateProject: updateProjectFn,
      updateProjectStatus: updateProjectStatusFn,
      deleteProject: deleteProjectFn,
      startScanning, stopScanning,
      addItemFromScan,
      removeProjectItem: removeProjectItemFn,
      updateItemStatus: updateItemStatusFn, markCheckinItem,
      getProjectItems, getActiveProjects, getArchivedProjects,
      getDamagedItems, getMissingItems, getMostBorrowed, getCheckedOutEquipment,
      getOverdueEquipment, getBorrowerStats,
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
