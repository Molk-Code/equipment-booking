import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Archive,
  Calendar, Users, Package, Download, AlertTriangle,
  CheckCircle, XCircle, Wrench, Plus, Trash2, Search, X,
  Pencil, Save, UserPlus, Clock
} from 'lucide-react';
import InventoryHeader from '../components/inventory/InventoryHeader';
import ScanMonitor from '../components/inventory/ScanMonitor';
import EquipmentDetailModal, { findEquipmentByName } from '../components/inventory/EquipmentDetailModal';
import { useInventory } from '../context/InventoryContext';
import { generateContractPDF } from '../utils/inventory-pdf';
import { calculatePrice } from '../context/CartContext';
import type { AddonSession, ProjectItem, Equipment } from '../types';

// Strip ISO time portion: "2026-04-12T22:00:00.000Z" → "2026-04-12"
function formatDate(d: string): string {
  if (!d) return '';
  return d.includes('T') ? d.split('T')[0] : d;
}

// Normalize timestamp for display: strip manual_ prefix, extract just HH:MM
function formatTimestamp(ts: string): string {
  let clean = ts.startsWith('manual_') ? ts.replace('manual_', '') : ts;
  // Convert dot-separated time (22.34.09) to colon format
  clean = clean.replace(/(\d{1,2})\.(\d{2})\.(\d{2})/, '$1:$2');
  // Drop seconds if present
  clean = clean.replace(/(\d{1,2}:\d{2}):\d{2}/, '$1');
  // Extract just the time part (HH:MM) — drop the date prefix
  const timeMatch = clean.match(/(\d{1,2}:\d{2})(?:\s*$)/);
  if (timeMatch) return timeMatch[1];
  // If the string has a space (date + time), take the time part
  const parts = clean.trim().split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/\d{1,2}:\d{2}/.test(last)) return last;
  }
  return clean.trim();
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    projects, isScanning, scanMode, recentScans,
    getProjectItems, startScanning, stopScanning,
    addItemFromScan, updateProject, updateProjectStatus, updateItemStatus,
    removeProjectItem, allEquipment, klasslista,
  } = useInventory();

  const [manualItemName, setManualItemName] = useState('');
  const [equipPickerOpen, setEquipPickerOpen] = useState(false);
  const [equipSearch, setEquipSearch] = useState('');
  const [equipCategory, setEquipCategory] = useState('ALL');
  const equipSearchRef = useRef<HTMLInputElement>(null);
  const [showDamageInput, setShowDamageInput] = useState<Record<string, boolean>>({});
  const [damageNotes, setDamageNotes] = useState<Record<string, string>>({});
  const [showMissingInput, setShowMissingInput] = useState<Record<string, boolean>>({});
  const [missingNotes, setMissingNotes] = useState<Record<string, string>>({});
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [expandedNote, setExpandedNote] = useState<{ name: string; notes: string } | null>(null);
  const [detailItem, setDetailItem] = useState<Equipment | null>(null);

  // Addon session state
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [addonDate, setAddonDate] = useState('');
  const [addonCollectedBy, setAddonCollectedBy] = useState('');
  const [addonManualCollector, setAddonManualCollector] = useState('');
  const [addonManager, setAddonManager] = useState('');
  const [currentAddonSession, setCurrentAddonSession] = useState<AddonSession | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBorrowers, setEditBorrowers] = useState<string[]>([]);
  const [editManualBorrower, setEditManualBorrower] = useState('');
  const [editManager, setEditManager] = useState('');
  const [editCheckoutDate, setEditCheckoutDate] = useState('');
  const [editReturnDate, setEditReturnDate] = useState('');

  const project = projects.find(p => p.id === projectId);
  const items = getProjectItems(projectId || '');

  // Auto-start scanning for active projects (skip the "Start Scanning" button step)
  useEffect(() => {
    if (project && project.status === 'active' && projectId && !isScanning) {
      startScanning(projectId, 'checkout');
    }
    // Only run once when project loads as active
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, project?.status]);

  // Merge items by (equipmentName, addonSessionId) into quantity groups
  type ItemGroup = {
    name: string; quantity: number; displayName: string;
    representative: ProjectItem; allItems: ProjectItem[];
  };

  const mergeItemsIntoGroups = (itemList: typeof items): ItemGroup[] => {
    const groups = new Map<string, { items: typeof items; quantity: number }>();
    itemList.forEach(item => {
      const key = item.equipmentName;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
        existing.quantity++;
      } else {
        groups.set(key, { items: [item], quantity: 1 });
      }
    });
    return Array.from(groups.entries()).map(([name, { items: groupItems, quantity }]) => ({
      name,
      quantity,
      displayName: quantity > 1 ? `${quantity}x ${name}` : name,
      representative: groupItems[0],
      allItems: groupItems,
    }));
  };

  // Separate items into: original checkout + addon sessions
  const originalItems = items.filter(i => !i.addonSessionId);
  const mergedItems = mergeItemsIntoGroups(originalItems);

  // Group addon items by session
  const addonSessionsMap = new Map<string, typeof items>();
  items.filter(i => i.addonSessionId).forEach(i => {
    const sid = i.addonSessionId!;
    const existing = addonSessionsMap.get(sid);
    if (existing) existing.push(i);
    else addonSessionsMap.set(sid, [i]);
  });
  // Build ordered list of unique sessions (ordered by date of first item)
  const addonSessions = Array.from(addonSessionsMap.entries()).map(([sid, sessionItems]) => ({
    sessionId: sid,
    date: sessionItems[0].addonDate || '',
    collectedBy: sessionItems[0].addonCollectedBy || '',
    manager: sessionItems[0].addonManager || '',
    mergedItems: mergeItemsIntoGroups(sessionItems),
  }));

  // Count missing items for archived projects
  const missingCount = items.filter(i => i.status === 'missing').length;
  const returnedCount = items.filter(i => i.status === 'returned').length;
  const checkedOutCount = items.filter(i => i.status === 'checked-out').length;

  // Price lookup: match item names to equipment list for day rates
  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    allEquipment.forEach(eq => {
      const norm = eq.name.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').trim();
      if (!map.has(norm)) map.set(norm, eq.priceExclVat);
    });
    return map;
  }, [allEquipment]);

  function getDayRate(itemName: string): number {
    const norm = itemName.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').trim();
    return priceMap.get(norm) ?? -1; // -1 means not found
  }

  // Rental days from project dates
  const rentalDays = useMemo(() => {
    if (!project) return 0;
    const from = new Date(project.checkoutDate);
    const to = new Date(project.returnDate);
    const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 1);
  }, [project]);

  // Total price for all items (original + addon sessions)
  const allMergedGroups = useMemo(() => {
    const addonGroups: ItemGroup[] = [];
    addonSessionsMap.forEach(sessionItems => {
      mergeItemsIntoGroups(sessionItems).forEach(g => addonGroups.push(g));
    });
    return [...mergedItems, ...addonGroups];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, priceMap]);

  const totalPrice = useMemo(() => {
    let total = 0;
    allMergedGroups.forEach(group => {
      const rate = getDayRate(group.name);
      if (rate > 0) {
        total += calculatePrice(rate, rentalDays) * group.quantity;
      }
    });
    return total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMergedGroups, rentalDays]);

  // Auto-add scanned items during checkout
  useEffect(() => {
    if (!isScanning || scanMode !== 'checkout' || !projectId) return;
    recentScans.forEach(scan => {
      // Consider the item already present if it exists with a non-returned status
      // within the same session (original checkout OR the current addon session).
      // Intentionally NOT matching on checkoutTimestamp — format differences between
      // the scan sheet and localStorage would otherwise cause the same item to be
      // added again on every render cycle.
      const sessionId = currentAddonSession?.sessionId;
      const alreadyAdded = items.some(
        i => i.equipmentName === scan.equipmentName &&
             i.status !== 'returned' &&
             (sessionId ? i.addonSessionId === sessionId : !i.addonSessionId)
      );
      if (!alreadyAdded) {
        addItemFromScan(projectId, scan, currentAddonSession ?? undefined);
      }
    });
  }, [recentScans, isScanning, scanMode, projectId, items, addItemFromScan, currentAddonSession]);

  const handleStopScanning = useCallback(() => {
    if (scanMode === 'checkout' && projectId && !isAddingItems) {
      // Only update status on initial checkout, not when adding items later
      updateProjectStatus(projectId, 'checked-out');
    }
    setIsAddingItems(false);
    setCurrentAddonSession(null);
    stopScanning();
  }, [scanMode, projectId, isAddingItems, updateProjectStatus, stopScanning]);

  // Start adding items — show addon session modal first
  const handleStartAddItems = useCallback(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    setAddonDate(today);
    setAddonCollectedBy('');
    setAddonManualCollector('');
    setAddonManager(project?.equipmentManager || '');
    setShowAddonModal(true);
  }, [project]);

  // Confirm addon session and begin scanning
  const handleConfirmAddItems = useCallback(() => {
    if (!projectId) return;
    const collector = addonCollectedBy || addonManualCollector.trim();
    const session: AddonSession = {
      sessionId: `addon_${Date.now()}`,
      date: addonDate,
      collectedBy: collector,
      manager: addonManager,
    };
    setCurrentAddonSession(session);
    setShowAddonModal(false);
    setIsAddingItems(true);
    startScanning(projectId, 'checkout');
  }, [projectId, addonDate, addonCollectedBy, addonManualCollector, addonManager, startScanning]);

  // Available categories from equipment
  const availableCategories = (() => {
    const cats = new Set<string>();
    allEquipment.forEach(eq => cats.add(eq.category || 'OTHER'));
    const order = ['CAMERA', 'GRIP', 'LIGHTS', 'SOUND', 'LOCATION', 'BOOKS'];
    return order.filter(c => cats.has(c)).concat([...cats].filter(c => !order.includes(c)));
  })();

  // Filter equipment for the picker modal
  const filteredPickerEquipment = (() => {
    let list = allEquipment;
    if (equipCategory !== 'ALL') {
      list = list.filter(eq => (eq.category || 'OTHER') === equipCategory);
    }
    if (equipSearch.trim()) {
      const q = equipSearch.toLowerCase();
      list = list.filter(eq => eq.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Handle picker item selection
  const handlePickerSelect = useCallback((eqName: string) => {
    if (!projectId || !eqName) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('sv-SE') + ' ' + now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const timestamp = `manual_${dateStr}`;
    addItemFromScan(projectId, { timestamp, equipmentName: eqName }, currentAddonSession ?? undefined);
    setEquipPickerOpen(false);
  }, [projectId, addItemFromScan, currentAddonSession]);

  // Focus search when picker opens
  useEffect(() => {
    if (equipPickerOpen && equipSearchRef.current) {
      setTimeout(() => equipSearchRef.current?.focus(), 100);
    }
  }, [equipPickerOpen]);

  // Lock body scroll when picker is open
  useEffect(() => {
    if (equipPickerOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [equipPickerOpen]);

  // Manual item add during checkout (free text)
  const handleAddManualItem = useCallback(() => {
    if (!projectId || !manualItemName.trim()) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('sv-SE') + ' ' + now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    const timestamp = `manual_${dateStr}`;
    addItemFromScan(projectId, { timestamp, equipmentName: manualItemName.trim() }, currentAddonSession ?? undefined);
    setManualItemName('');
  }, [projectId, manualItemName, addItemFromScan, currentAddonSession]);

  // Remove item during checkout
  const handleRemoveItem = useCallback((equipmentName: string, checkoutTimestamp: string) => {
    if (!projectId) return;
    if (confirm(`Remove "${equipmentName}" from this project?`)) {
      removeProjectItem(projectId, equipmentName, checkoutTimestamp);
    }
  }, [projectId, removeProjectItem]);

  // Mark single item as returned
  const handleMarkReturned = useCallback((equipmentName: string) => {
    if (projectId) {
      updateItemStatus(projectId, equipmentName, 'returned');
    }
  }, [projectId, updateItemStatus]);

  // Mark single item as missing with notes
  const handleMarkMissing = useCallback((equipmentName: string) => {
    if (!projectId) return;
    const notes = missingNotes[equipmentName]?.trim();
    updateItemStatus(projectId, equipmentName, 'missing', notes || undefined);
    setShowMissingInput(prev => ({ ...prev, [equipmentName]: false }));
    setMissingNotes(prev => ({ ...prev, [equipmentName]: '' }));
  }, [projectId, missingNotes, updateItemStatus]);

  // Mark item as damaged with notes
  const handleMarkDamaged = useCallback((equipmentName: string) => {
    if (!projectId) return;
    const notes = damageNotes[equipmentName]?.trim();
    if (notes) {
      updateItemStatus(projectId, equipmentName, 'damaged', notes);
      setShowDamageInput(prev => ({ ...prev, [equipmentName]: false }));
      setDamageNotes(prev => ({ ...prev, [equipmentName]: '' }));
    }
  }, [projectId, damageNotes, updateItemStatus]);

  // Complete return: archive project, mark remaining checked-out items as missing
  const handleCompleteReturn = useCallback(() => {
    if (!projectId) return;
    const remaining = items.filter(i => i.status === 'checked-out');
    if (remaining.length > 0) {
      if (!confirm(`${remaining.length} item${remaining.length > 1 ? 's are' : ' is'} still checked out. They will be marked as missing. Continue?`)) {
        return;
      }
      remaining.forEach(item => {
        updateItemStatus(projectId, item.equipmentName, 'missing');
      });
    }
    updateProjectStatus(projectId, 'archived');
  }, [projectId, items, updateItemStatus, updateProjectStatus]);

  const handleDownloadPDF = useCallback((mode: 'checkout' | 'checkin') => {
    if (!project) return;
    const blob = generateContractPDF(project, items, mode, allEquipment, rentalDays);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_${mode}_contract.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project, items, allEquipment, rentalDays]);

  if (!project) {
    return (
      <div className="app">
        <InventoryHeader />
        <main className="main">
          <div className="inv-empty">
            Project not found.
            <Link to="/inventory">Back to Dashboard</Link>
          </div>
        </main>
      </div>
    );
  }

  const isArchived = project.status === 'archived' || project.status === 'returned';
  const isCheckedOut = project.status === 'checked-out';

  // Determine film class from borrowers
  const filmClass = useMemo(() => {
    if (!klasslista || !project) return '';
    const film1Set = new Set(klasslista.film1.map(n => n.toLowerCase()));
    const film2Set = new Set(klasslista.film2.map(n => n.toLowerCase()));
    let hasFilm1 = false;
    let hasFilm2 = false;
    for (const b of project.borrowers) {
      const lower = b.toLowerCase();
      if (film1Set.has(lower)) hasFilm1 = true;
      if (film2Set.has(lower)) hasFilm2 = true;
    }
    if (hasFilm1 && hasFilm2) return 'Film 1 & 2';
    if (hasFilm1) return 'Film 1';
    if (hasFilm2) return 'Film 2';
    return '';
  }, [klasslista, project]);

  const hasKlasslista = klasslista && (klasslista.film1.length > 0 || klasslista.film2.length > 0);

  const startEditing = useCallback(() => {
    if (!project) return;
    setEditName(project.name);
    setEditBorrowers([...project.borrowers]);
    setEditManager(project.equipmentManager);
    setEditCheckoutDate(project.checkoutDate);
    setEditReturnDate(project.returnDate);
    setEditManualBorrower('');
    setEditing(true);
  }, [project]);

  const saveEdits = useCallback(async () => {
    if (!projectId || !editName.trim()) return;
    await updateProject(projectId, {
      name: editName.trim(),
      borrowers: editBorrowers,
      equipmentManager: editManager,
      checkoutDate: editCheckoutDate,
      returnDate: editReturnDate,
    });
    setEditing(false);
  }, [projectId, editName, editBorrowers, editManager, editCheckoutDate, editReturnDate, updateProject]);

  const addEditBorrower = (name: string) => {
    if (name && !editBorrowers.includes(name)) {
      setEditBorrowers(prev => [...prev, name]);
    }
  };

  const removeEditBorrower = (name: string) => {
    setEditBorrowers(prev => prev.filter(b => b !== name));
  };

  return (
    <div className="app">
      <InventoryHeader />
      <main className="main">
        <button className="back-btn" onClick={() => navigate('/inventory')}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        {/* Project Header */}
        {editing ? (
          <div className="project-edit-form">
            <div className="form-group">
              <label>Project Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Borrowers</label>
              {editBorrowers.length > 0 && (
                <div className="borrower-chips">
                  {editBorrowers.map(b => (
                    <span key={b} className="borrower-chip">
                      {b}
                      <button type="button" onClick={() => removeEditBorrower(b)} className="borrower-chip-x">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {hasKlasslista && (
                <select
                  className="form-select borrower-dropdown"
                  value=""
                  onChange={e => { addEditBorrower(e.target.value); e.target.value = ''; }}
                >
                  <option value="">Select borrower...</option>
                  {klasslista!.film1.length > 0 && (
                    <optgroup label="Film 1">
                      {klasslista!.film1.map(n => (
                        <option key={`f1-${n}`} value={n} disabled={editBorrowers.includes(n)}>
                          {n}{editBorrowers.includes(n) ? ' (added)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {klasslista!.film2.length > 0 && (
                    <optgroup label="Film 2">
                      {klasslista!.film2.map(n => (
                        <option key={`f2-${n}`} value={n} disabled={editBorrowers.includes(n)}>
                          {n}{editBorrowers.includes(n) ? ' (added)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
              <div className="borrower-manual-row">
                <input
                  type="text"
                  value={editManualBorrower}
                  onChange={e => setEditManualBorrower(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = editManualBorrower.trim();
                      if (trimmed) { addEditBorrower(trimmed); setEditManualBorrower(''); }
                    }
                  }}
                  placeholder="Type name manually..."
                />
                <button type="button" className="borrower-add" onClick={() => {
                  const trimmed = editManualBorrower.trim();
                  if (trimmed) { addEditBorrower(trimmed); setEditManualBorrower(''); }
                }}>
                  <UserPlus size={14} /> Add
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Equipment Manager</label>
              <select value={editManager} onChange={e => setEditManager(e.target.value)} className="form-select">
                <option value="">Select manager...</option>
                <option value="Fredrik">Fredrik</option>
                <option value="Karl">Karl</option>
                <option value="Mats">Mats</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Checkout Date</label>
                <input type="date" value={editCheckoutDate} onChange={e => setEditCheckoutDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Return Date</label>
                <input type="date" value={editReturnDate} onChange={e => setEditReturnDate(e.target.value)} min={editCheckoutDate} />
              </div>
            </div>
            <div className="checkout-buttons">
              <button className="primary-btn" onClick={saveEdits}>
                <Save size={16} /> Save Changes
              </button>
              <button className="secondary-btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
        <div className="project-detail-header">
          <div>
            <h2 className="inv-page-title">
              {project.name}
              {filmClass && (
                <span className={`film-class-tag ${filmClass === 'Film 1' ? 'film1' : filmClass === 'Film 2' ? 'film2' : 'film1'}`} style={{ marginLeft: '0.75rem', fontSize: '0.7rem', verticalAlign: 'middle' }}>
                  {filmClass}
                </span>
              )}
            </h2>
            <div className="project-detail-meta">
              <span><Users size={14} /> {project.borrowers.join(', ')}</span>
              {project.equipmentManager && (
                <span><Wrench size={14} /> Manager: {project.equipmentManager}</span>
              )}
              <span><Calendar size={14} /> {formatDate(project.checkoutDate)} — {formatDate(project.returnDate)}</span>
              <span><Package size={14} /> {items.length} items</span>
            </div>
          </div>
          <div className="project-header-actions">
            {!isScanning && (
              <button className="edit-project-btn" onClick={startEditing} title="Edit project">
                <Pencil size={14} />
              </button>
            )}
            <span className={`project-status-badge status-${project.status === 'checked-out' ? 'checkout' : project.status}`}>
              {project.status === 'checked-out' ? 'Checked Out' : project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </span>
          </div>
        </div>
        )}

        {/* Missing items warning for archived projects */}
        {isArchived && missingCount > 0 && (
          <div className="missing-warning-banner">
            <AlertTriangle size={18} />
            <span>
              <strong>{missingCount} item{missingCount > 1 ? 's' : ''} missing</strong> from check-in
            </span>
          </div>
        )}

        {/* Actions */}
        {!isArchived && !isScanning && isCheckedOut && (
          <div className="project-actions">
            <button className="primary-btn" onClick={handleStartAddItems}>
              <Plus size={16} />
              Add Items
            </button>
            <button className="secondary-btn" onClick={() => handleDownloadPDF('checkout')}>
              <Download size={16} />
              Download Contract PDF
            </button>
          </div>
        )}

        {/* Addon session banner when scanning in add-items mode */}
        {isScanning && currentAddonSession && (
          <div className="addon-session-banner">
            <Clock size={14} />
            <span>
              <strong>Add Items Session</strong> &mdash; {currentAddonSession.date}
              {currentAddonSession.collectedBy && <> &middot; Collected by: <strong>{currentAddonSession.collectedBy}</strong></>}
              {currentAddonSession.manager && <> &middot; Manager: <strong>{currentAddonSession.manager}</strong></>}
            </span>
          </div>
        )}

        {/* Scan Monitor (checkout only) */}
        {isScanning && (
          <ScanMonitor
            isScanning={isScanning}
            recentScans={recentScans}
            mode={scanMode || 'checkout'}
          />
        )}

        {/* Manual add + remove during checkout scanning */}
        {isScanning && scanMode === 'checkout' && (
          <div className="manual-add-section">
            {allEquipment.length > 0 && (
              <button
                className="equip-picker-open-btn"
                onClick={() => { setEquipPickerOpen(true); setEquipSearch(''); setEquipCategory('ALL'); }}
              >
                <Package size={16} />
                Open Inventory
              </button>
            )}
            <div className="manual-add-row">
              <input
                type="text"
                className="manual-add-input"
                placeholder="Or type item name manually..."
                value={manualItemName}
                onChange={e => setManualItemName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddManualItem(); }}
              />
              <button
                className="manual-add-btn"
                onClick={handleAddManualItem}
                disabled={!manualItemName.trim()}
              >
                <Plus size={16} />
                Add
              </button>
            </div>
          </div>
        )}

        {/* Return summary for checked-out projects */}
        {isCheckedOut && !isScanning && items.length > 0 && (
          <div className="return-summary-bar">
            <span className="return-stat returned">
              <CheckCircle size={14} /> {returnedCount} returned
            </span>
            <span className="return-stat checked-out">
              <Package size={14} /> {checkedOutCount} still out
            </span>
            {missingCount > 0 && (
              <span className="return-stat missing">
                <XCircle size={14} /> {missingCount} missing
              </span>
            )}
          </div>
        )}

        {/* Item List — interactive for checked-out projects */}
        {items.length > 0 && (
          <section className="inv-section" style={{ marginTop: '1rem' }}>
            <h3 className="inv-section-title">
              <Package size={18} />
              Equipment ({items.length})
            </h3>

            {/* ── Render helper for item rows ── */}
            {(() => {
              const renderItemRow = (group: ItemGroup, i: number) => {
                const item = group.representative;
                const ts = item.checkoutTimestamp;
                const dayRate = getDayRate(group.name);
                const itemPrice = dayRate > 0 ? calculatePrice(dayRate, rentalDays) * group.quantity : 0;
                const matchedEquip = findEquipmentByName(group.name, allEquipment);
                const hasDetail = matchedEquip && (matchedEquip.image || (matchedEquip.included && matchedEquip.included.length > 0));
                return (
                  <div key={i}>
                    <div className={`project-item-row status-row-${item.status}`}>
                      <span
                        className={`project-item-name ${hasDetail ? 'equip-grid-name-clickable' : ''}`}
                        onClick={() => { if (hasDetail && matchedEquip) setDetailItem(matchedEquip); }}
                      >
                        {group.displayName}
                        {matchedEquip?.location && <span className="equip-location-tag">{matchedEquip.location}</span>}
                      </span>
                      {rentalDays > 0 && (
                        <span className="project-item-price">
                          {dayRate === 0 ? 'Free' : dayRate > 0 ? `${itemPrice} kr` : ''}
                        </span>
                      )}
                      <span className="project-item-time">{formatTimestamp(ts)}</span>
                      <span className={`project-item-status item-status-${item.status}`}>
                        {item.status}
                      </span>

                      {/* Damage notes indicator (clickable to expand) */}
                      {item.damageNotes && (
                        <span
                          className="damaged-item-notes clickable-note"
                          onClick={() => setExpandedNote({ name: group.displayName, notes: item.damageNotes })}
                          title="Click to read damage report"
                        >
                          {item.damageNotes}
                        </span>
                      )}

                      {/* Action buttons for checked-out projects */}
                      {isCheckedOut && !isScanning && item.status === 'checked-out' && (
                        <div className="item-action-btns">
                          <button
                            className="item-return-btn"
                            onClick={() => handleMarkReturned(item.equipmentName)}
                            title="Mark as returned"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            className="item-damage-toggle-btn"
                            onClick={() => setShowDamageInput(prev => ({ ...prev, [item.equipmentName]: !prev[item.equipmentName] }))}
                            title="Report damage"
                          >
                            <Wrench size={14} />
                          </button>
                          <button
                            className="item-missing-btn"
                            onClick={() => setShowMissingInput(prev => ({ ...prev, [item.equipmentName]: !prev[item.equipmentName] }))}
                            title="Mark as missing"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      )}

                      {/* Remove button during scanning */}
                      {isScanning && scanMode === 'checkout' && (
                        <button
                          className="item-remove-btn"
                          onClick={() => handleRemoveItem(item.equipmentName, item.checkoutTimestamp)}
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Inline damage input */}
                    {showDamageInput[item.equipmentName] && item.status === 'checked-out' && (
                      <div className="checkin-inline-damage">
                        <input
                          type="text"
                          className="checkin-damage-input"
                          placeholder="Describe the damage..."
                          value={damageNotes[item.equipmentName] || ''}
                          onChange={e => setDamageNotes(prev => ({ ...prev, [item.equipmentName]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleMarkDamaged(item.equipmentName); }}
                          autoFocus
                        />
                        <button
                          className="checkin-damage-save-btn"
                          onClick={() => handleMarkDamaged(item.equipmentName)}
                          disabled={!damageNotes[item.equipmentName]?.trim()}
                        >
                          <AlertTriangle size={14} />
                          Mark Damaged
                        </button>
                      </div>
                    )}

                    {/* Inline missing input */}
                    {showMissingInput[item.equipmentName] && item.status === 'checked-out' && (
                      <div className="checkin-inline-damage checkin-inline-missing">
                        <input
                          type="text"
                          className="checkin-damage-input"
                          placeholder="Explain the situation (optional)..."
                          value={missingNotes[item.equipmentName] || ''}
                          onChange={e => setMissingNotes(prev => ({ ...prev, [item.equipmentName]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleMarkMissing(item.equipmentName); }}
                          autoFocus
                        />
                        <button
                          className="checkin-damage-save-btn checkin-missing-save-btn"
                          onClick={() => handleMarkMissing(item.equipmentName)}
                        >
                          <XCircle size={14} />
                          Mark Missing
                        </button>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <>
                  {/* Original checkout items */}
                  {mergedItems.length > 0 && (
                    <div className="project-items-list">
                      {mergedItems.map((group, i) => renderItemRow(group, i))}
                    </div>
                  )}

                  {/* Addon session sections */}
                  {addonSessions.map(session => (
                    <div key={session.sessionId} className="addon-session-section">
                      <div className="addon-session-header">
                        <Clock size={14} />
                        <span className="addon-session-title">Added {session.date}</span>
                        {session.collectedBy && (
                          <span className="addon-session-meta">Collected by: <strong>{session.collectedBy}</strong></span>
                        )}
                        {session.manager && (
                          <span className="addon-session-meta">Manager: <strong>{session.manager}</strong></span>
                        )}
                      </div>
                      <div className="project-items-list">
                        {session.mergedItems.map((group, i) => renderItemRow(group, i))}
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
          </section>
        )}

        {/* Price total bar */}
        {rentalDays > 0 && items.length > 0 && (
          <div className="checkout-price-total">
            <span className="checkout-price-label">{items.length} items &middot; {rentalDays} days</span>
            <span className="checkout-price-amount">{totalPrice > 0 ? `${totalPrice} kr` : 'Free'}</span>
          </div>
        )}

        {/* Complete Return & Archive Button */}
        {isCheckedOut && !isScanning && items.length > 0 && (
          <div className="project-actions" style={{ marginTop: '0.5rem' }}>
            <button className="primary-btn danger-btn" onClick={handleCompleteReturn}>
              <Archive size={16} />
              Complete Return & Archive Project
            </button>
          </div>
        )}

        {/* Done button at the bottom of checkout process */}
        {isScanning && (
          <div className="project-actions" style={{ marginTop: '0.5rem' }}>
            <button className="scan-done-btn" onClick={handleStopScanning}>
              <CheckCircle size={16} />
              Done
            </button>
          </div>
        )}

        {/* Archived project PDF download */}
        {isArchived && items.length > 0 && (
          <div className="project-actions" style={{ marginTop: '1rem' }}>
            <button className="secondary-btn" onClick={() => handleDownloadPDF('checkin')}>
              <Download size={16} />
              Download Return Receipt PDF
            </button>
            <button className="secondary-btn" onClick={() => handleDownloadPDF('checkout')}>
              <FileText size={16} />
              Download Original Contract PDF
            </button>
          </div>
        )}
        {/* Addon session modal */}
        {showAddonModal && (
          <div className="note-popup-overlay" onClick={() => setShowAddonModal(false)}>
            <div className="note-popup addon-modal" onClick={e => e.stopPropagation()}>
              <div className="note-popup-header">
                <h4>Add Items Session</h4>
                <button className="note-popup-close" onClick={() => setShowAddonModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="note-popup-body addon-modal-body">
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={addonDate}
                    onChange={e => setAddonDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Collected by (student)</label>
                  {hasKlasslista && (
                    <select
                      className="form-select"
                      value={addonCollectedBy}
                      onChange={e => { setAddonCollectedBy(e.target.value); if (e.target.value) setAddonManualCollector(''); }}
                    >
                      <option value="">Select from list...</option>
                      {klasslista!.film1.length > 0 && (
                        <optgroup label="Film 1">
                          {klasslista!.film1.map(n => <option key={n} value={n}>{n}</option>)}
                        </optgroup>
                      )}
                      {klasslista!.film2.length > 0 && (
                        <optgroup label="Film 2">
                          {klasslista!.film2.map(n => <option key={n} value={n}>{n}</option>)}
                        </optgroup>
                      )}
                    </select>
                  )}
                  {!addonCollectedBy && (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Or type name manually..."
                      value={addonManualCollector}
                      onChange={e => setAddonManualCollector(e.target.value)}
                      style={{ marginTop: hasKlasslista ? '0.4rem' : '0' }}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label>Equipment Manager</label>
                  <select
                    className="form-select"
                    value={addonManager}
                    onChange={e => setAddonManager(e.target.value)}
                  >
                    <option value="">Select manager...</option>
                    <option value="Fredrik">Fredrik</option>
                    <option value="Karl">Karl</option>
                    <option value="Mats">Mats</option>
                  </select>
                </div>
                <div className="checkout-buttons" style={{ marginTop: '1rem' }}>
                  <button
                    className="primary-btn"
                    onClick={handleConfirmAddItems}
                    disabled={!addonDate}
                  >
                    <Plus size={16} />
                    Start Scanning
                  </button>
                  <button className="secondary-btn" onClick={() => setShowAddonModal(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Note popup overlay */}
        {expandedNote && (
          <div className="note-popup-overlay" onClick={() => setExpandedNote(null)}>
            <div className="note-popup" onClick={e => e.stopPropagation()}>
              <div className="note-popup-header">
                <h4>{expandedNote.name}</h4>
                <button className="note-popup-close" onClick={() => setExpandedNote(null)}>
                  <XCircle size={18} />
                </button>
              </div>
              <div className="note-popup-body">
                <p className="note-popup-label">Damage Report:</p>
                <p className="note-popup-text">{expandedNote.notes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Equipment detail popup */}
        {detailItem && (
          <EquipmentDetailModal equipment={detailItem} onClose={() => setDetailItem(null)} />
        )}

        {/* Equipment Picker Modal */}
        {equipPickerOpen && (
          <div className="equip-picker-overlay" onClick={() => setEquipPickerOpen(false)}>
            <div className="equip-picker-modal" onClick={e => e.stopPropagation()}>
              <div className="equip-picker-header">
                <h3>Add Equipment</h3>
                <button className="equip-picker-close" onClick={() => setEquipPickerOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="equip-picker-search">
                <Search size={16} />
                <input
                  ref={equipSearchRef}
                  type="text"
                  placeholder="Search equipment..."
                  value={equipSearch}
                  onChange={e => setEquipSearch(e.target.value)}
                />
                {equipSearch && (
                  <button className="equip-picker-clear" onClick={() => setEquipSearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="equip-picker-categories">
                <button
                  className={`equip-picker-cat-btn ${equipCategory === 'ALL' ? 'active' : ''}`}
                  onClick={() => setEquipCategory('ALL')}
                >
                  All
                </button>
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    className={`equip-picker-cat-btn ${equipCategory === cat ? 'active' : ''}`}
                    onClick={() => setEquipCategory(cat)}
                  >
                    {cat.charAt(0) + cat.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              <div className="equip-picker-grid">
                {filteredPickerEquipment.length === 0 ? (
                  <div className="equip-picker-empty">No equipment found</div>
                ) : (
                  filteredPickerEquipment.map(eq => {
                    const eqDayRate = getDayRate(eq.name);
                    const eqPrice = eqDayRate > 0 && rentalDays > 0 ? calculatePrice(eqDayRate, rentalDays) : 0;
                    return (
                    <button
                      key={eq.id}
                      className="equip-picker-card"
                      onClick={() => handlePickerSelect(eq.name)}
                    >
                      <div className="equip-picker-img">
                        {eq.image ? (
                          <img src={eq.image} alt={eq.name} loading="lazy" />
                        ) : (
                          <div className="equip-picker-placeholder">{eq.name}</div>
                        )}
                        <span className="equip-picker-cat-tag">{eq.category}</span>
                        {eqPrice > 0 && (
                          <span className="equip-picker-price-tag">{eqPrice} kr</span>
                        )}
                        {eqDayRate === 0 && (
                          <span className="equip-picker-price-tag equip-picker-price-free">Free</span>
                        )}
                      </div>
                      <div className="equip-picker-info">
                        <span className="equip-picker-name">
                          {eq.name}
                          {eq.location && <span className="equip-location-tag">{eq.location}</span>}
                        </span>
                      </div>
                    </button>
                    );
                  }))
                }
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
