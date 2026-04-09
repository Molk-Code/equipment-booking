import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Archive,
  Calendar, Users, Package, Download, AlertTriangle,
  CheckCircle, XCircle, Wrench, Plus, Trash2, Search, X
} from 'lucide-react';
import InventoryHeader from '../components/inventory/InventoryHeader';
import ScanMonitor from '../components/inventory/ScanMonitor';
import { useInventory } from '../context/InventoryContext';
import { generateContractPDF } from '../utils/inventory-pdf';

// Normalize timestamp for display: strip manual_ prefix, convert dots to colons, drop seconds
function formatTimestamp(ts: string): string {
  let clean = ts.startsWith('manual_') ? ts.replace('manual_', '') : ts;
  clean = clean.replace(/(\d{1,2})\.(\d{2})\.(\d{2})/, '$1:$2');
  clean = clean.replace(/(\d{1,2}:\d{2}):\d{2}/, '$1');
  return clean.trim();
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    projects, isScanning, scanMode, recentScans,
    getProjectItems, startScanning, stopScanning,
    addItemFromScan, updateProjectStatus, updateItemStatus,
    removeProjectItem, allEquipment,
  } = useInventory();

  const [manualItemName, setManualItemName] = useState('');
  const [equipPickerOpen, setEquipPickerOpen] = useState(false);
  const [equipSearch, setEquipSearch] = useState('');
  const [equipCategory, setEquipCategory] = useState('ALL');
  const equipSearchRef = useRef<HTMLInputElement>(null);
  const [showDamageInput, setShowDamageInput] = useState<Record<string, boolean>>({});
  const [damageNotes, setDamageNotes] = useState<Record<string, string>>({});
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [expandedNote, setExpandedNote] = useState<{ name: string; notes: string } | null>(null);

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

  // Merge duplicate items by equipment name into quantity groups
  const mergedItems = (() => {
    const groups = new Map<string, { items: typeof items; quantity: number }>();
    items.forEach(item => {
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
      // Use the first item for status/timestamp display
      representative: groupItems[0],
      allItems: groupItems,
    }));
  })();

  // Count missing items for archived projects
  const missingCount = items.filter(i => i.status === 'missing').length;
  const returnedCount = items.filter(i => i.status === 'returned').length;
  const checkedOutCount = items.filter(i => i.status === 'checked-out').length;

  // Auto-add scanned items during checkout
  useEffect(() => {
    if (!isScanning || scanMode !== 'checkout' || !projectId) return;
    recentScans.forEach(scan => {
      const alreadyAdded = items.some(
        i => i.equipmentName === scan.equipmentName && i.checkoutTimestamp === scan.timestamp
      );
      if (!alreadyAdded) {
        addItemFromScan(projectId, scan);
      }
    });
  }, [recentScans, isScanning, scanMode, projectId, items, addItemFromScan]);

  const handleStopScanning = useCallback(() => {
    if (scanMode === 'checkout' && projectId && !isAddingItems) {
      // Only update status on initial checkout, not when adding items later
      updateProjectStatus(projectId, 'checked-out');
    }
    setIsAddingItems(false);
    stopScanning();
  }, [scanMode, projectId, isAddingItems, updateProjectStatus, stopScanning]);

  // Start adding items to an already checked-out project
  const handleStartAddItems = useCallback(() => {
    if (projectId) {
      setIsAddingItems(true);
      startScanning(projectId, 'checkout');
    }
  }, [projectId, startScanning]);

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
    addItemFromScan(projectId, { timestamp, equipmentName: eqName });
    setEquipPickerOpen(false);
  }, [projectId, addItemFromScan]);

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
    addItemFromScan(projectId, { timestamp, equipmentName: manualItemName.trim() });
    setManualItemName('');
  }, [projectId, manualItemName, addItemFromScan]);

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

  // Mark single item as missing
  const handleMarkMissing = useCallback((equipmentName: string) => {
    if (projectId) {
      updateItemStatus(projectId, equipmentName, 'missing');
    }
  }, [projectId, updateItemStatus]);

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
    const blob = generateContractPDF(project, items, mode, allEquipment);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_${mode}_contract.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project, items, allEquipment]);

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

  return (
    <div className="app">
      <InventoryHeader />
      <main className="main">
        <button className="back-btn" onClick={() => navigate('/inventory')}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        {/* Project Header */}
        <div className="project-detail-header">
          <div>
            <h2 className="inv-page-title">{project.name}</h2>
            <div className="project-detail-meta">
              <span><Users size={14} /> {project.borrowers.join(', ')}</span>
              {project.equipmentManager && (
                <span><Wrench size={14} /> Manager: {project.equipmentManager}</span>
              )}
              <span><Calendar size={14} /> {project.checkoutDate} — {project.returnDate}</span>
              <span><Package size={14} /> {items.length} items</span>
            </div>
          </div>
          <span className={`project-status-badge status-${project.status === 'checked-out' ? 'checkout' : project.status}`}>
            {project.status === 'checked-out' ? 'Checked Out' : project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </span>
        </div>

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
        {mergedItems.length > 0 && (
          <section className="inv-section" style={{ marginTop: '1rem' }}>
            <h3 className="inv-section-title">
              <Package size={18} />
              Equipment ({items.length})
            </h3>
            <div className="project-items-list">
              {mergedItems.map((group, i) => {
                const item = group.representative;
                const ts = item.checkoutTimestamp;
                return (
                  <div key={i}>
                    <div className={`project-item-row status-row-${item.status}`}>
                      <span className="project-item-name">{group.displayName}</span>
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
                            onClick={() => handleMarkMissing(item.equipmentName)}
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
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Complete Return & Archive Button */}
        {isCheckedOut && !isScanning && items.length > 0 && (
          <div className="project-actions" style={{ marginTop: '1rem' }}>
            <button className="primary-btn danger-btn" onClick={handleCompleteReturn}>
              <Archive size={16} />
              Complete Return & Archive Project
            </button>
          </div>
        )}

        {/* Done button at the bottom of checkout process */}
        {isScanning && (
          <div className="project-actions" style={{ marginTop: '1rem' }}>
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
                  filteredPickerEquipment.map(eq => (
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
                      </div>
                      <div className="equip-picker-info">
                        <span className="equip-picker-name">{eq.name}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
