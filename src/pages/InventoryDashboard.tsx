import { useState, useRef, useEffect } from 'react';
import { FolderOpen, Archive, Package, AlertTriangle, ChevronDown, ChevronUp, Trash2, XCircle, Download, Upload, RefreshCw, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import InventoryHeader from '../components/inventory/InventoryHeader';
import ProjectCard from '../components/inventory/ProjectCard';
import EquipmentDetailModal, { findEquipmentByName } from '../components/inventory/EquipmentDetailModal';
import { useInventory } from '../context/InventoryContext';
import type { Equipment } from '../types';
import {
  isFileSystemAccessSupported,
  setupAutoBackup,
  disableAutoBackup,
  isAutoBackupConfigured,
  startAutoExportTimer,
  tryAutoImportOnStartup,
  getLastExportTime,
} from '../utils/auto-backup';
import { generateUserGuidePDF } from '../utils/inventory-pdf';

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const { getActiveProjects, getArchivedProjects, getProjectItems, getCheckedOutEquipment, getDamagedItems, getMissingItems, deleteProject, klasslista, allEquipment } = useInventory();
  const [detailItem, setDetailItem] = useState<Equipment | null>(null);

  // Determine film class for a project based on borrower names
  function getFilmClass(borrowers: string[]): string {
    if (!klasslista) return '';
    const film1Set = new Set(klasslista.film1.map(n => n.toLowerCase()));
    const film2Set = new Set(klasslista.film2.map(n => n.toLowerCase()));
    let hasFilm1 = false;
    let hasFilm2 = false;
    for (const b of borrowers) {
      const lower = b.toLowerCase();
      if (film1Set.has(lower)) hasFilm1 = true;
      if (film2Set.has(lower)) hasFilm2 = true;
    }
    if (hasFilm1 && hasFilm2) return 'Film 1 & 2';
    if (hasFilm1) return 'Film 1';
    if (hasFilm2) return 'Film 2';
    return '';
  }
  const [showArchived, setShowArchived] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [lastAutoExport, setLastAutoExport] = useState<string | null>(null);
  const fsSupported = isFileSystemAccessSupported();

  // Check auto-backup status and start timer on mount
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init() {
      // Try to import from backup file if localStorage is empty
      const imported = await tryAutoImportOnStartup();
      if (imported) {
        window.location.reload();
        return;
      }

      const configured = await isAutoBackupConfigured();
      setAutoBackupEnabled(configured);
      setLastAutoExport(getLastExportTime());

      if (configured) {
        cleanup = startAutoExportTimer();
        // Update display after a potential export
        setTimeout(() => setLastAutoExport(getLastExportTime()), 3000);
      }
    }
    init();

    return () => { if (cleanup) cleanup(); };
  }, []);

  const active = getActiveProjects();
  const archived = getArchivedProjects();
  const checkedOut = getCheckedOutEquipment();
  const damaged = getDamagedItems();
  const missingItems = getMissingItems();

  const handleDeleteProject = (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.preventDefault(); // Prevent navigating to project detail
    e.stopPropagation();
    if (confirm(`Delete "${projectName}" and all its items? This cannot be undone.`)) {
      deleteProject(projectId);
    }
  };

  // Export all inventory data as JSON backup
  const handleExportBackup = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: 1,
      projects: JSON.parse(localStorage.getItem('inventory_projects') || '[]'),
      items: JSON.parse(localStorage.getItem('inventory_items') || '[]'),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `molkom_inventory_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import backup from JSON file
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.projects || !data.items) {
          setImportMsg('Invalid backup file format.');
          return;
        }
        if (!confirm(`This will replace ALL current data with the backup from ${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('sv-SE') : 'unknown date'}. Are you sure?`)) {
          return;
        }
        localStorage.setItem('inventory_projects', JSON.stringify(data.projects));
        localStorage.setItem('inventory_items', JSON.stringify(data.items));
        setImportMsg('Backup restored! Reloading...');
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        setImportMsg('Failed to read backup file.');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Enable auto-backup: user picks a file location
  const handleEnableAutoBackup = async () => {
    const success = await setupAutoBackup();
    if (success) {
      setAutoBackupEnabled(true);
      setLastAutoExport(getLastExportTime());
      const cleanup = startAutoExportTimer();
      // Store cleanup for later if needed
      window.__autoBackupCleanup = cleanup;
      setImportMsg('Auto-backup enabled! Saves every hour.');
    }
  };

  // Disable auto-backup
  const handleDisableAutoBackup = async () => {
    await disableAutoBackup();
    setAutoBackupEnabled(false);
    setLastAutoExport(null);
    if (window.__autoBackupCleanup) {
      window.__autoBackupCleanup();
    }
    setImportMsg('Auto-backup disabled.');
  };

  // Download user guide PDF
  const handleDownloadGuide = () => {
    const blob = generateUserGuidePDF();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Molkom_Inventory_User_Guide.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get missing item count per project
  const getMissingCountForProject = (projectId: string) => {
    return getProjectItems(projectId).filter(i => i.status === 'missing').length;
  };

  return (
    <div className="app">
      <InventoryHeader />
      <main className="main">
        {/* Quick Stats */}
        <div className="inv-stats-row">
          <div className="inv-stat-card">
            <FolderOpen size={20} />
            <div>
              <span className="inv-stat-value">{active.length}</span>
              <span className="inv-stat-label">Active Projects</span>
            </div>
          </div>
          <div className="inv-stat-card clickable" onClick={() => navigate('/inventory/stats?tab=equipment')}>
            <Package size={20} />
            <div>
              <span className="inv-stat-value">{checkedOut.length}</span>
              <span className="inv-stat-label">Items Out</span>
            </div>
          </div>
          <div className="inv-stat-card warning clickable" onClick={() => navigate('/inventory/stats?tab=damaged')}>
            <AlertTriangle size={20} />
            <div>
              <span className="inv-stat-value">{damaged.length}</span>
              <span className="inv-stat-label">Damaged</span>
            </div>
          </div>
          {missingItems.length > 0 && (
            <div className="inv-stat-card danger clickable" onClick={() => navigate('/inventory/stats?tab=missing')}>
              <XCircle size={20} />
              <div>
                <span className="inv-stat-value">{missingItems.length}</span>
                <span className="inv-stat-label">Missing</span>
              </div>
            </div>
          )}
        </div>

        {/* Active Projects */}
        <section className="inv-section">
          <h2 className="inv-section-title">
            <FolderOpen size={20} />
            Active Projects
          </h2>
          {active.length === 0 ? (
            <div className="inv-empty">
              No active projects. Create one to start scanning equipment.
            </div>
          ) : (
            <div className="project-grid">
              {active.map(p => (
                <div key={p.id} className="archived-project-wrapper">
                  <ProjectCard
                    project={p}
                    itemCount={getProjectItems(p.id).length}
                    filmClass={getFilmClass(p.borrowers)}
                  />
                  <button
                    className="archived-delete-btn"
                    onClick={(e) => handleDeleteProject(e, p.id, p.name)}
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Currently Checked Out */}
        {checkedOut.length > 0 && (
          <section className="inv-section">
            <h2 className="inv-section-title">
              <Package size={20} />
              Currently Checked Out Equipment
            </h2>
            <div className="checked-out-list">
              {checkedOut.slice(0, 20).map((co, i) => {
                const matchedEquip = findEquipmentByName(co.item.equipmentName, allEquipment);
                const hasDetail = matchedEquip && (matchedEquip.image || (matchedEquip.included && matchedEquip.included.length > 0));
                return (
                  <div key={i} className="checked-out-item">
                    <span
                      className={`co-name ${hasDetail ? 'equip-grid-name-clickable' : ''}`}
                      onClick={() => { if (hasDetail && matchedEquip) setDetailItem(matchedEquip); }}
                    >
                      {co.item.equipmentName}
                    </span>
                    <span className="co-project">{co.project.name}</span>
                    <span className="co-date">Since {co.item.checkoutTimestamp.split(' ')[0]}</span>
                  </div>
                );
              })}
              {checkedOut.length > 20 && (
                <div className="checked-out-more">
                  ...and {checkedOut.length - 20} more items
                </div>
              )}
            </div>
          </section>
        )}

        {/* Archived Projects */}
        {archived.length > 0 && (
          <section className="inv-section">
            <button
              className="inv-section-toggle"
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive size={20} />
              <span>Archived Projects ({archived.length})</span>
              {showArchived ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showArchived && (
              <div className="project-grid">
                {archived.map(p => (
                  <div key={p.id} className="archived-project-wrapper">
                    <ProjectCard
                      project={p}
                      itemCount={getProjectItems(p.id).length}
                      missingCount={getMissingCountForProject(p.id)}
                      filmClass={getFilmClass(p.borrowers)}
                    />
                    <button
                      className="archived-delete-btn"
                      onClick={(e) => handleDeleteProject(e, p.id, p.name)}
                      title="Delete project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {/* Settings & Tools — visually separated */}
        <div className="inv-settings-area">
          {/* Backup / Restore */}
          <section className="inv-section">
            <h2 className="inv-section-title" style={{ fontSize: '0.85rem' }}>
              Data Backup
            </h2>

            {/* Auto-backup controls */}
            {fsSupported && (
              <div className="auto-backup-section">
                {autoBackupEnabled ? (
                  <div className="auto-backup-status">
                    <span className="auto-backup-active">
                      <RefreshCw size={14} />
                      Auto-backup active
                    </span>
                    {lastAutoExport && (
                      <span className="auto-backup-time">
                        Last saved: {new Date(lastAutoExport).toLocaleString('sv-SE')}
                      </span>
                    )}
                    <button className="secondary-btn small-btn" onClick={handleDisableAutoBackup}>
                      Disable
                    </button>
                  </div>
                ) : (
                  <div className="auto-backup-setup">
                    <button className="primary-btn" onClick={handleEnableAutoBackup}>
                      <RefreshCw size={14} />
                      Enable Auto-Backup
                    </button>
                    <span className="auto-backup-desc">
                      Saves automatically every hour to a file on this computer. Restores on startup if browser data is cleared.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="backup-actions">
              <button className="secondary-btn" onClick={handleExportBackup}>
                <Download size={14} />
                Manual Export
              </button>
              <button className="secondary-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} />
                Manual Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportBackup}
              />
            </div>
            {importMsg && <p className="backup-msg">{importMsg}</p>}
            {!fsSupported && (
              <p className="backup-hint">
                Data is stored in this browser's localStorage. Export a backup regularly to avoid data loss if browser data is cleared.
              </p>
            )}
          </section>

          {/* User Guide */}
          <section className="inv-section" style={{ marginTop: '0.5rem' }}>
            <div className="backup-actions">
              <button className="secondary-btn" onClick={handleDownloadGuide}>
                <BookOpen size={14} />
                Download User Guide (PDF)
              </button>
            </div>
          </section>
        </div>

        {/* Equipment detail popup */}
        {detailItem && (
          <EquipmentDetailModal equipment={detailItem} onClose={() => setDetailItem(null)} />
        )}
      </main>
    </div>
  );
}
