import { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, Package, ArrowLeft, XCircle, Trash2, CheckCircle, Users } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import InventoryHeader from '../components/inventory/InventoryHeader';
import EquipmentStatusGrid from '../components/inventory/EquipmentStatusGrid';
import EquipmentDetailModal, { findEquipmentByName } from '../components/inventory/EquipmentDetailModal';
import { useInventory } from '../context/InventoryContext';
import { calculatePrice } from '../context/CartContext';
import type { Equipment } from '../types';

type TabType = 'overview' | 'equipment' | 'damaged' | 'missing' | 'checked-out' | 'borrowers' | 'projects';

export default function InventoryStats() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { allEquipment, getMostBorrowed, getDamagedItems, getMissingItems, getCheckedOutEquipment, projects, projectItems, updateItemStatus, removeProjectItem, getBorrowerStats, klasslista, klasslistaLoading } = useInventory();
  const initialTab = (searchParams.get('tab') as TabType) || 'overview';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [expandedNote, setExpandedNote] = useState<{ name: string; notes: string; label?: string } | null>(null);
  const [borrowerPopup, setBorrowerPopup] = useState<{ name: string; type: 'projects' | 'damaged' | 'missing'; projectIds: string[] } | null>(null);
  const [detailItem, setDetailItem] = useState<Equipment | null>(null);

  // Sync tab with URL param when it changes
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && ['overview', 'equipment', 'damaged', 'missing', 'checked-out', 'borrowers', 'projects'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const mostBorrowed = getMostBorrowed();
  const damaged = getDamagedItems();
  const missingItems = getMissingItems();
  const checkedOut = getCheckedOutEquipment();
  const borrowerStats = getBorrowerStats();

  const totalStudents = klasslista ? klasslista.film1.length + klasslista.film2.length : 0;

  // Price lookup map for project cost calculations
  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    allEquipment.forEach(eq => {
      const norm = eq.name.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').trim();
      if (!map.has(norm)) map.set(norm, eq.priceExclVat);
    });
    return map;
  }, [allEquipment]);

  function getProjectCost(projectId: string): number {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return 0;
    const from = new Date(proj.checkoutDate);
    const to = new Date(proj.returnDate);
    const days = Math.max(Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)), 1);
    const items = projectItems.filter(i => i.projectId === projectId);
    let total = 0;
    items.forEach(item => {
      const norm = item.equipmentName.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').trim();
      const dayRate = priceMap.get(norm) ?? 0;
      if (dayRate > 0) total += calculatePrice(dayRate, days);
    });
    return total;
  }

  const getBorrowerProjects = (borrowerName: string): string[] => {
    const nameLower = borrowerName.toLowerCase();
    return projects
      .filter(p => p.borrowers.some(b => b.toLowerCase() === nameLower))
      .map(p => p.id);
  };

  const getBorrowerDamagedProjects = (borrowerName: string): string[] => {
    const nameLower = borrowerName.toLowerCase();
    const involvedProjectIds = projects
      .filter(p => p.borrowers.some(b => b.toLowerCase() === nameLower))
      .map(p => p.id);
    const idsWithDamage = new Set(
      projectItems
        .filter(i => involvedProjectIds.includes(i.projectId) && i.status === 'damaged')
        .map(i => i.projectId)
    );
    return [...idsWithDamage];
  };

  const getBorrowerMissingProjects = (borrowerName: string): string[] => {
    const nameLower = borrowerName.toLowerCase();
    const involvedProjectIds = projects
      .filter(p => p.borrowers.some(b => b.toLowerCase() === nameLower))
      .map(p => p.id);
    const idsWithMissing = new Set(
      projectItems
        .filter(i => involvedProjectIds.includes(i.projectId) && i.status === 'missing')
        .map(i => i.projectId)
    );
    return [...idsWithMissing];
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'active': case 'checked-out': return 'Active';
      case 'returned': case 'archived': return 'Archived';
      default: return status;
    }
  };

  // Determine film class from borrower names
  function getFilmClass(borrowers: string[]): string {
    if (!klasslista) return '';
    const film1Set = new Set(klasslista.film1.map(n => n.toLowerCase()));
    const film2Set = new Set(klasslista.film2.map(n => n.toLowerCase()));
    let hasFilm1 = false, hasFilm2 = false;
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

  return (
    <div className="app">
      <InventoryHeader />
      <main className="main">
        <button className="back-btn" onClick={() => navigate('/inventory')}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <h2 className="inv-page-title">
          <BarChart3 size={24} />
          Statistics & Inventory
        </h2>

        {/* Stats Overview */}
        <div className="inv-stats-row">
          <div className="inv-stat-card clickable" onClick={() => setActiveTab('equipment')}>
            <Package size={20} />
            <div>
              <span className="inv-stat-value">{allEquipment.length}</span>
              <span className="inv-stat-label">Total Equipment</span>
            </div>
          </div>
          <div className="inv-stat-card clickable" onClick={() => setActiveTab('equipment')}>
            <TrendingUp size={20} />
            <div>
              <span className="inv-stat-value">{checkedOut.length}</span>
              <span className="inv-stat-label">Currently Out</span>
            </div>
          </div>
          <div className="inv-stat-card warning clickable" onClick={() => setActiveTab('damaged')}>
            <AlertTriangle size={20} />
            <div>
              <span className="inv-stat-value">{damaged.length}</span>
              <span className="inv-stat-label">Damaged Items</span>
            </div>
          </div>
          {missingItems.length > 0 && (
            <div className="inv-stat-card danger clickable" onClick={() => setActiveTab('missing')}>
              <XCircle size={20} />
              <div>
                <span className="inv-stat-value">{missingItems.length}</span>
                <span className="inv-stat-label">Missing Items</span>
              </div>
            </div>
          )}
          <div className="inv-stat-card clickable" onClick={() => setActiveTab('projects')}>
            <BarChart3 size={20} />
            <div>
              <span className="inv-stat-value">{projects.length}</span>
              <span className="inv-stat-label">Total Projects</span>
            </div>
          </div>
          {totalStudents > 0 && (
            <div className="inv-stat-card clickable" onClick={() => setActiveTab('borrowers')}>
              <Users size={20} />
              <div>
                <span className="inv-stat-value">{totalStudents}</span>
                <span className="inv-stat-label">Students</span>
              </div>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="inv-tabs">
          <button
            className={`inv-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Most Borrowed
          </button>
          <button
            className={`inv-tab ${activeTab === 'equipment' ? 'active' : ''}`}
            onClick={() => setActiveTab('equipment')}
          >
            Equipment Status
          </button>
          <button
            className={`inv-tab ${activeTab === 'damaged' ? 'active' : ''}`}
            onClick={() => setActiveTab('damaged')}
          >
            Damaged Items ({damaged.length})
          </button>
          <button
            className={`inv-tab ${activeTab === 'missing' ? 'active' : ''}`}
            onClick={() => setActiveTab('missing')}
          >
            Missing Items ({missingItems.length})
          </button>
          <button
            className={`inv-tab ${activeTab === 'checked-out' ? 'active' : ''}`}
            onClick={() => setActiveTab('checked-out')}
          >
            Manual Checkouts
          </button>
          <button
            className={`inv-tab ${activeTab === 'borrowers' ? 'active' : ''}`}
            onClick={() => setActiveTab('borrowers')}
          >
            Borrowers
          </button>
          <button
            className={`inv-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects ({projects.length})
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <section className="inv-section">
            <h3 className="inv-section-title">
              <TrendingUp size={18} />
              Most Borrowed Equipment
            </h3>
            {mostBorrowed.length === 0 ? (
              <div className="inv-empty">No borrowing data yet.</div>
            ) : (
              <div className="most-borrowed-list">
                {mostBorrowed.slice(0, 20).map((item, i) => {
                  const matchedEquip = findEquipmentByName(item.name, allEquipment);
                  const hasDetail = matchedEquip && (matchedEquip.image || (matchedEquip.included && matchedEquip.included.length > 0));
                  return (
                  <div key={item.name} className="most-borrowed-row">
                    <span className="most-borrowed-rank">#{i + 1}</span>
                    <span
                      className={`most-borrowed-name ${hasDetail ? 'equip-grid-name-clickable' : ''}`}
                      onClick={() => { if (hasDetail && matchedEquip) setDetailItem(matchedEquip); }}
                    >
                      {item.name}
                    </span>
                    <div className="most-borrowed-bar-wrap">
                      <div
                        className="most-borrowed-bar"
                        style={{ width: `${(item.count / (mostBorrowed[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="most-borrowed-count">{item.count}x</span>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'equipment' && (
          <section className="inv-section">
            <EquipmentStatusGrid
              equipment={allEquipment}
              checkedOut={checkedOut}
              missingItems={missingItems}
            />
          </section>
        )}

        {activeTab === 'damaged' && (
          <section className="inv-section">
            <h3 className="inv-section-title">
              <AlertTriangle size={18} />
              Damaged Items
            </h3>
            {damaged.length === 0 ? (
              <div className="inv-empty">No damaged items reported.</div>
            ) : (
              <div className="damaged-items-list">
                {damaged.map((item, i) => {
                  const project = projects.find(p => p.id === item.projectId);
                  const matchedEquip = findEquipmentByName(item.equipmentName, allEquipment);
                  const hasDetail = matchedEquip && (matchedEquip.image || (matchedEquip.included && matchedEquip.included.length > 0));
                  return (
                    <div key={i} className="damaged-item-row">
                      <span
                        className={`damaged-item-name ${hasDetail ? 'equip-grid-name-clickable' : ''}`}
                        onClick={() => { if (hasDetail && matchedEquip) setDetailItem(matchedEquip); }}
                      >
                        {item.equipmentName}
                      </span>
                      {project ? (
                        <Link to={`/inventory/project/${project.id}`} className="damaged-item-project clickable-project">
                          {project.name}
                        </Link>
                      ) : (
                        <span className="damaged-item-project">Unknown</span>
                      )}
                      <span
                        className="damaged-item-notes clickable-note"
                        onClick={() => setExpandedNote({ name: item.equipmentName, notes: item.damageNotes || 'No details' })}
                        title="Click to read full note"
                      >
                        {item.damageNotes || 'No details'}
                      </span>
                      <button
                        className="missing-item-remove-btn"
                        onClick={() => {
                          if (confirm(`Mark "${item.equipmentName}" as returned (remove from damaged)?`)) {
                            updateItemStatus(item.projectId, item.equipmentName, 'returned');
                          }
                        }}
                        title="Mark as resolved/returned"
                      >
                        <CheckCircle size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'missing' && (
          <section className="inv-section">
            <h3 className="inv-section-title">
              <XCircle size={18} />
              Missing Items
            </h3>
            {missingItems.length === 0 ? (
              <div className="inv-empty">No missing items. All equipment accounted for.</div>
            ) : (
              <div className="missing-items-list">
                <p className="missing-items-info">
                  Items marked as missing after check-in. If an item is checked out again in a new project, it is automatically removed from this list.
                </p>
                {missingItems.map((mi, i) => {
                  const matchedEquip = findEquipmentByName(mi.item.equipmentName, allEquipment);
                  const hasDetail = matchedEquip && (matchedEquip.image || (matchedEquip.included && matchedEquip.included.length > 0));
                  return (
                  <div key={i} className="missing-item-row">
                    <XCircle size={16} className="missing-item-icon" />
                    <span
                      className={`missing-item-name ${hasDetail ? 'equip-grid-name-clickable' : ''}`}
                      onClick={() => { if (hasDetail && matchedEquip) setDetailItem(matchedEquip); }}
                    >
                      {mi.item.equipmentName}
                    </span>
                    <Link to={`/inventory/project/${mi.project.id}`} className="missing-item-project clickable-project">
                      {mi.project.name}
                    </Link>
                    <span className="missing-item-date">Since {mi.item.checkoutTimestamp.replace(/^manual_/, '').split(' ')[0]}</span>
                    {mi.item.damageNotes && (
                      <span
                        className="damaged-item-notes clickable-note"
                        onClick={() => setExpandedNote({ name: mi.item.equipmentName, notes: mi.item.damageNotes, label: 'Missing Report:' })}
                        title="Click to read details"
                      >
                        {mi.item.damageNotes}
                      </span>
                    )}
                    <button
                      className="missing-item-remove-btn"
                      onClick={() => {
                        if (confirm(`Mark "${mi.item.equipmentName}" as returned/found?`)) {
                          updateItemStatus(mi.item.projectId, mi.item.equipmentName, 'returned');
                        }
                      }}
                      title="Mark as found/returned"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'checked-out' && (() => {
          // Find all items across all projects that don't match any equipment in the inventory
          const equipNameSet = new Set(
            allEquipment.map(eq => eq.name.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').trim())
          );
          const isInInventory = (name: string) => {
            const norm = name.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').trim();
            return equipNameSet.has(norm);
          };

          // Collect all manual items (not in inventory) from all project items
          const manualItems = projectItems.filter(item => !isInInventory(item.equipmentName));

          // Aggregate by name: count occurrences and collect project references
          const aggregated = new Map<string, { count: number; entries: { item: typeof manualItems[0]; project: typeof projects[0] | undefined }[] }>();
          manualItems.forEach(item => {
            const key = item.equipmentName.toLowerCase().trim();
            const existing = aggregated.get(key);
            const project = projects.find(p => p.id === item.projectId);
            const entry = { item, project };
            if (existing) {
              existing.count++;
              existing.entries.push(entry);
            } else {
              aggregated.set(key, { count: 1, entries: [entry] });
            }
          });

          // Sort by count descending
          const sorted = [...aggregated.entries()].sort((a, b) => b[1].count - a[1].count);

          return (
            <section className="inv-section">
              <h3 className="inv-section-title">
                <Package size={18} />
                Manual Checkouts
              </h3>
              {sorted.length === 0 ? (
                <div className="inv-empty">No manually typed items found. All checked-out items match the inventory.</div>
              ) : (
                <div className="checked-out-stats-list">
                  <p className="missing-items-info">
                    Items typed in manually during checkout that don't match any equipment in the inventory. These may need to be added to the spreadsheet.
                  </p>
                  {sorted.map(([, data]) => {
                    const displayName = data.entries[0].item.equipmentName;
                    return (
                      <div key={displayName} className="manual-checkout-group">
                        <div className="manual-checkout-header">
                          <span className="co-stat-name">{displayName}</span>
                          <span className="manual-checkout-count">{data.count}x</span>
                        </div>
                        <div className="manual-checkout-entries">
                          {data.entries.map((entry, j) => (
                            <div key={j} className="manual-checkout-entry">
                              {entry.project ? (
                                <Link to={`/inventory/project/${entry.project.id}`} className="co-stat-project clickable-project">
                                  {entry.project.name}
                                </Link>
                              ) : (
                                <span className="co-stat-project">Unknown project</span>
                              )}
                              <span className="co-stat-date">{entry.item.checkoutTimestamp.replace(/^manual_/, '').split(' ')[0]}</span>
                              <button
                                className="missing-item-remove-btn"
                                onClick={() => {
                                  if (confirm(`Remove "${entry.item.equipmentName}" from project "${entry.project?.name || 'unknown'}"?`)) {
                                    removeProjectItem(entry.item.projectId, entry.item.equipmentName, entry.item.checkoutTimestamp);
                                  }
                                }}
                                title="Remove this entry"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}

        {activeTab === 'borrowers' && (
          <section className="inv-section">
            <h3 className="inv-section-title">
              <Users size={18} />
              Borrower Statistics
            </h3>
            {klasslistaLoading ? (
              <div className="inv-empty">Loading student list...</div>
            ) : borrowerStats.length === 0 ? (
              <div className="inv-empty">No student data available. Add students to the Klasslista tab in the spreadsheet.</div>
            ) : (
              <div className="borrower-stats-table">
                <div className="borrower-stats-header">
                  <span className="bs-col-name">Name</span>
                  <span className="bs-col-group">Class</span>
                  <span className="bs-col-projects">Projects</span>
                  <span className="bs-col-damaged">Damaged</span>
                  <span className="bs-col-missing">Missing</span>
                </div>
                {borrowerStats.map(stat => (
                  <div key={stat.name} className={`borrower-stats-row ${stat.damagedCount > 0 || stat.missingCount > 0 ? 'has-issues' : ''}`}>
                    <span className="bs-col-name">{stat.name}</span>
                    <span className="bs-col-group">
                      <span className={`bs-group-tag ${stat.group === 'Film 1' ? 'film1' : 'film2'}`}>
                        {stat.group}
                      </span>
                    </span>
                    <span className="bs-col-projects">
                      {stat.projectCount > 0 ? (
                        <button
                          className="bs-clickable"
                          onClick={() => setBorrowerPopup({ name: stat.name, type: 'projects', projectIds: getBorrowerProjects(stat.name) })}
                        >
                          {stat.projectCount}
                        </button>
                      ) : (
                        <span className="bs-zero">0</span>
                      )}
                    </span>
                    <span className="bs-col-damaged">
                      {stat.damagedCount > 0 ? (
                        <button
                          className="bs-clickable bs-clickable-warning"
                          onClick={() => setBorrowerPopup({ name: stat.name, type: 'damaged', projectIds: getBorrowerDamagedProjects(stat.name) })}
                        >
                          {stat.damagedCount}
                        </button>
                      ) : (
                        <span className="bs-zero">0</span>
                      )}
                    </span>
                    <span className="bs-col-missing">
                      {stat.missingCount > 0 ? (
                        <button
                          className="bs-clickable bs-clickable-danger"
                          onClick={() => setBorrowerPopup({ name: stat.name, type: 'missing', projectIds: getBorrowerMissingProjects(stat.name) })}
                        >
                          {stat.missingCount}
                        </button>
                      ) : (
                        <span className="bs-zero">0</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'projects' && (
          <section className="inv-section">
            <h3 className="inv-section-title">
              <Package size={18} />
              All Projects
            </h3>
            {projects.length === 0 ? (
              <div className="inv-empty">No projects yet.</div>
            ) : (
              <div className="all-projects-list">
                {(() => {
                  const active = projects.filter(p => p.status === 'active' || p.status === 'checked-out');
                  const archived = projects.filter(p => p.status === 'archived' || p.status === 'returned');
                  return (
                    <>
                      {active.length > 0 && (
                        <div className="all-projects-group">
                          <h4 className="all-projects-group-title">Active ({active.length})</h4>
                          {active.map(proj => {
                            const cost = getProjectCost(proj.id);
                            const filmClass = getFilmClass(proj.borrowers);
                            return (
                              <Link
                                key={proj.id}
                                to={`/inventory/project/${proj.id}`}
                                className="all-projects-row"
                              >
                                <span className="all-projects-name">
                                  {proj.name}
                                  {filmClass && (
                                    <span className={`film-class-tag ${filmClass === 'Film 1' ? 'film1' : filmClass === 'Film 2' ? 'film2' : 'film1'}`} style={{ marginLeft: '0.5rem', fontSize: '0.6rem' }}>
                                      {filmClass}
                                    </span>
                                  )}
                                </span>
                                <span className="all-projects-meta">
                                  {proj.borrowers.join(', ')}
                                </span>
                                <span className="all-projects-date">{proj.checkoutDate}</span>
                                {cost > 0 && <span className="all-projects-cost">{cost} kr</span>}
                                <span className={`bs-popup-status active`}>Active</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                      {archived.length > 0 && (
                        <div className="all-projects-group">
                          <h4 className="all-projects-group-title">Archived ({archived.length})</h4>
                          {archived.map(proj => {
                            const cost = getProjectCost(proj.id);
                            const filmClass = getFilmClass(proj.borrowers);
                            return (
                              <Link
                                key={proj.id}
                                to={`/inventory/project/${proj.id}`}
                                className="all-projects-row"
                              >
                                <span className="all-projects-name">
                                  {proj.name}
                                  {filmClass && (
                                    <span className={`film-class-tag ${filmClass === 'Film 1' ? 'film1' : filmClass === 'Film 2' ? 'film2' : 'film1'}`} style={{ marginLeft: '0.5rem', fontSize: '0.6rem' }}>
                                      {filmClass}
                                    </span>
                                  )}
                                </span>
                                <span className="all-projects-meta">
                                  {proj.borrowers.join(', ')}
                                </span>
                                <span className="all-projects-date">{proj.checkoutDate}</span>
                                {cost > 0 && <span className="all-projects-cost">{cost} kr</span>}
                                <span className={`bs-popup-status archived`}>Archived</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </section>
        )}

        {/* Borrower projects popup */}
        {borrowerPopup && (
          <div className="note-popup-overlay" onClick={() => setBorrowerPopup(null)}>
            <div className="note-popup borrower-projects-popup" onClick={e => e.stopPropagation()}>
              <div className="note-popup-header">
                <h4>
                  {borrowerPopup.name} — {borrowerPopup.type === 'projects' ? 'Projects' : borrowerPopup.type === 'damaged' ? 'Damaged in' : 'Missing in'}
                </h4>
                <button className="note-popup-close" onClick={() => setBorrowerPopup(null)}>
                  <XCircle size={18} />
                </button>
              </div>
              <div className="note-popup-body">
                {borrowerPopup.projectIds.length === 0 ? (
                  <p className="bs-popup-empty">No projects found.</p>
                ) : (
                  <div className="bs-popup-list">
                    {borrowerPopup.projectIds.map(pid => {
                      const proj = projects.find(p => p.id === pid);
                      if (!proj) return null;
                      const isActive = proj.status === 'active' || proj.status === 'checked-out';
                      return (
                        <Link
                          key={pid}
                          to={`/inventory/project/${pid}`}
                          className="bs-popup-project"
                          onClick={() => setBorrowerPopup(null)}
                        >
                          <span className="bs-popup-project-name">{proj.name}</span>
                          <span className={`bs-popup-status ${isActive ? 'active' : 'archived'}`}>
                            {statusLabel(proj.status)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
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
                <p className="note-popup-label">{expandedNote.label || 'Damage Report:'}</p>
                <p className="note-popup-text">{expandedNote.notes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Equipment detail popup */}
        {detailItem && (
          <EquipmentDetailModal equipment={detailItem} onClose={() => setDetailItem(null)} />
        )}
      </main>
    </div>
  );
}
