import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Radio, RotateCcw, FileText, Archive,
  Calendar, Users, Package, Download, AlertTriangle, Trash2
} from 'lucide-react';
import InventoryHeader from '../components/inventory/InventoryHeader';
import ScanMonitor from '../components/inventory/ScanMonitor';
import CheckinComparison from '../components/inventory/CheckinComparison';
import { useInventory } from '../context/InventoryContext';
import { generateContractPDF } from '../utils/inventory-pdf';
import type { QRScanEntry } from '../types';

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    projects, isScanning, scanMode, recentScans,
    getProjectItems, startScanning, stopScanning,
    addItemFromScan, updateProjectStatus, updateItemStatus,
    removeProjectItem,
  } = useInventory();

  const [checkinScans, setCheckinScans] = useState<QRScanEntry[]>([]);
  const [showMissingWarning, setShowMissingWarning] = useState(false);

  const project = projects.find(p => p.id === projectId);
  const items = getProjectItems(projectId || '');

  // Count missing items for archived projects
  const missingCount = items.filter(i => i.status === 'missing').length;

  // Auto-add scanned items during checkout
  useEffect(() => {
    if (!isScanning || scanMode !== 'checkout' || !projectId) return;
    // Add each new scan to the project items
    recentScans.forEach(scan => {
      const alreadyAdded = items.some(
        i => i.equipmentName === scan.equipmentName && i.checkoutTimestamp === scan.timestamp
      );
      if (!alreadyAdded) {
        addItemFromScan(projectId, scan);
      }
    });
  }, [recentScans, isScanning, scanMode, projectId, items, addItemFromScan]);

  // Track check-in scans
  useEffect(() => {
    if (!isScanning || scanMode !== 'checkin') return;
    setCheckinScans(recentScans);
  }, [recentScans, isScanning, scanMode]);

  const handleStartCheckout = useCallback(() => {
    if (projectId) startScanning(projectId, 'checkout');
  }, [projectId, startScanning]);

  const handleStartCheckin = useCallback(() => {
    if (projectId) {
      setCheckinScans([]);
      startScanning(projectId, 'checkin');
    }
  }, [projectId, startScanning]);

  const handleStopScanning = useCallback(() => {
    if (scanMode === 'checkout' && projectId) {
      updateProjectStatus(projectId, 'checked-out');
    }
    // Show warning if check-in scan has missing items
    if (scanMode === 'checkin' && items.length > 0) {
      const returnedNames = new Set(checkinScans.map(s => s.equipmentName));
      const missingItems = items.filter(i =>
        i.status !== 'damaged' && i.status !== 'returned' && !returnedNames.has(i.equipmentName)
      );
      if (missingItems.length > 0) {
        setShowMissingWarning(true);
      }
    }
    stopScanning();
  }, [scanMode, projectId, updateProjectStatus, stopScanning, items, checkinScans]);

  const handleMarkDamaged = useCallback((equipmentName: string, notes: string) => {
    if (projectId) {
      updateItemStatus(projectId, equipmentName, 'damaged', notes);
    }
  }, [projectId, updateItemStatus]);

  const handleRemoveScan = useCallback((equipmentName: string, timestamp: string) => {
    if (projectId) {
      removeProjectItem(projectId, equipmentName, timestamp);
    }
  }, [projectId, removeProjectItem]);

  const handleRemoveItem = useCallback((equipmentName: string, checkoutTimestamp: string) => {
    if (projectId && confirm(`Remove "${equipmentName}" from this project?`)) {
      removeProjectItem(projectId, equipmentName, checkoutTimestamp);
    }
  }, [projectId, removeProjectItem]);

  const handleCompleteCheckin = useCallback(() => {
    if (!projectId) return;
    // Mark unscanned items as missing
    const returnedNames = new Set(checkinScans.map(s => s.equipmentName));
    items.forEach(item => {
      if (item.status !== 'damaged' && !returnedNames.has(item.equipmentName)) {
        updateItemStatus(projectId, item.equipmentName, 'missing');
      } else if (returnedNames.has(item.equipmentName) && item.status !== 'damaged') {
        updateItemStatus(projectId, item.equipmentName, 'returned');
      }
    });
    updateProjectStatus(projectId, 'archived');
    stopScanning();
    setShowMissingWarning(false);
  }, [projectId, items, checkinScans, updateItemStatus, updateProjectStatus, stopScanning]);

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

        {/* Warning after stopping check-in scan with missing items */}
        {showMissingWarning && (
          <div className="missing-warning-banner">
            <AlertTriangle size={18} />
            <span>
              <strong>Warning:</strong> Some items were not scanned back in. They will be marked as missing when you complete the check-in.
            </span>
            <button className="missing-warning-dismiss" onClick={() => setShowMissingWarning(false)}>×</button>
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
            {project.status === 'checked-out' && (
              <>
                <button className="primary-btn" onClick={handleStartCheckin}>
                  <RotateCcw size={16} />
                  Start Check-In Scanning
                </button>
                <button className="secondary-btn" onClick={() => handleDownloadPDF('checkout')}>
                  <Download size={16} />
                  Download Contract PDF
                </button>
              </>
            )}
          </div>
        )}

        {/* Scan Monitor */}
        {isScanning && (
          <ScanMonitor
            isScanning={isScanning}
            recentScans={recentScans}
            mode={scanMode || 'checkout'}
            onStop={handleStopScanning}
            onRemoveScan={handleRemoveScan}
          />
        )}

        {/* Check-in Comparison */}
        {scanMode === 'checkin' && checkinScans.length > 0 && (
          <CheckinComparison
            checkoutItems={items}
            checkinScans={checkinScans}
            onMarkDamaged={handleMarkDamaged}
          />
        )}

        {/* Complete Check-in Button */}
        {!isScanning && checkinScans.length > 0 && project.status === 'checked-out' && (
          <div className="project-actions" style={{ marginTop: '1rem' }}>
            <button className="primary-btn danger-btn" onClick={handleCompleteCheckin}>
              <Archive size={16} />
              Complete Check-In & Archive Project
            </button>
            <button className="secondary-btn" onClick={() => handleDownloadPDF('checkin')}>
              <FileText size={16} />
              Download Return Receipt PDF
            </button>
          </div>
        )}

        {/* Item List */}
        {items.length > 0 && (
          <section className="inv-section" style={{ marginTop: '1.5rem' }}>
            <h3 className="inv-section-title">
              <Package size={18} />
              Equipment ({items.length})
            </h3>
            <div className="project-items-list">
              {items.map((item, i) => (
                <div key={i} className={`project-item-row status-row-${item.status}`}>
                  <span className="project-item-name">{item.equipmentName}</span>
                  <span className="project-item-time">{item.checkoutTimestamp}</span>
                  <span className={`project-item-status item-status-${item.status}`}>
                    {item.status}
                  </span>
                  {!isArchived && (
                    <button
                      className="project-item-remove-btn"
                      onClick={() => handleRemoveItem(item.equipmentName, item.checkoutTimestamp)}
                      title="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
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
