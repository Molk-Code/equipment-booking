import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Radio, FileText, Archive,
  Calendar, Users, Package, Download, AlertTriangle,
  CheckCircle, XCircle, Wrench, Plus, Trash2
} from 'lucide-react';
import InventoryHeader from '../components/inventory/InventoryHeader';
import ScanMonitor from '../components/inventory/ScanMonitor';
import { useInventory } from '../context/InventoryContext';
import { generateContractPDF } from '../utils/inventory-pdf';

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    projects, isScanning, scanMode, recentScans,
    getProjectItems, startScanning, stopScanning,
    addItemFromScan, updateProjectStatus, updateItemStatus,
    removeProjectItem,
  } = useInventory();

  const [manualItemName, setManualItemName] = useState('');
  const [showDamageInput, setShowDamageInput] = useState<Record<string, boolean>>({});
  const [damageNotes, setDamageNotes] = useState<Record<string, string>>({});

  const project = projects.find(p => p.id === projectId);
  const items = getProjectItems(projectId || '');

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

  const handleStartCheckout = useCallback(() => {
    if (projectId) startScanning(projectId, 'checkout');
  }, [projectId, startScanning]);

  const handleStopScanning = useCallback(() => {
    if (scanMode === 'checkout' && projectId) {
      updateProjectStatus(projectId, 'checked-out');
    }
    stopScanning();
  }, [scanMode, projectId, updateProjectStatus, stopScanning]);

  // Manual item add during checkout
  const handleAddManualItem = useCallback(() => {
    if (!projectId || !manualItemName.trim()) return;
    const timestamp = `manual_${Date.now()}`;
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
    const blob = generateContractPDF(project, items, mode);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_${mode}_contract.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project, items]);

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
        {!isArchived && !isScanning && (
          <div className="project-actions">
            {project.status === 'active' && (
              <button className="primary-btn" onClick={handleStartCheckout}>
                <Radio size={16} />
                Start Check-Out Scanning
              </button>
            )}
            {isCheckedOut && (
              <button className="secondary-btn" onClick={() => handleDownloadPDF('checkout')}>
                <Download size={16} />
                Download Contract PDF
              </button>
            )}
          </div>
        )}

        {/* Scan Monitor (checkout only) */}
        {isScanning && (
          <ScanMonitor
            isScanning={isScanning}
            recentScans={recentScans}
            mode={scanMode || 'checkout'}
            onStop={handleStopScanning}
          />
        )}

        {/* Manual add + remove during checkout scanning */}
        {isScanning && scanMode === 'checkout' && (
          <div className="manual-add-section">
            <div className="manual-add-row">
              <input
                type="text"
                className="manual-add-input"
                placeholder="Add item manually..."
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
            <div className="project-items-list">
              {items.map((item, i) => (
                <div key={i}>
                  <div className={`project-item-row status-row-${item.status}`}>
                    <span className="project-item-name">{item.equipmentName}</span>
                    <span className="project-item-time">{item.checkoutTimestamp.startsWith('manual_') ? 'Manual' : item.checkoutTimestamp}</span>
                    <span className={`project-item-status item-status-${item.status}`}>
                      {item.status}
                    </span>

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
              ))}
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
            <button className="secondary-btn" onClick={() => handleDownloadPDF('checkin')}>
              <FileText size={16} />
              Download Return Receipt PDF
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
      </main>
    </div>
  );
}
