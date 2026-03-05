import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, Package, ArrowLeft, XCircle, Trash2, CheckCircle } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import InventoryHeader from '../components/inventory/InventoryHeader';
import EquipmentStatusGrid from '../components/inventory/EquipmentStatusGrid';
import { useInventory } from '../context/InventoryContext';

type TabType = 'overview' | 'equipment' | 'damaged' | 'missing';

export default function InventoryStats() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { allEquipment, getMostBorrowed, getDamagedItems, getMissingItems, getCheckedOutEquipment, projects, updateItemStatus } = useInventory();
  const initialTab = (searchParams.get('tab') as TabType) || 'overview';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Sync tab with URL param when it changes
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && ['overview', 'equipment', 'damaged', 'missing'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const mostBorrowed = getMostBorrowed();
  const damaged = getDamagedItems();
  const missingItems = getMissingItems();
  const checkedOut = getCheckedOutEquipment();

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
          <div className="inv-stat-card clickable" onClick={() => setActiveTab('overview')}>
            <BarChart3 size={20} />
            <div>
              <span className="inv-stat-value">{projects.length}</span>
              <span className="inv-stat-label">Total Projects</span>
            </div>
          </div>
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
                {mostBorrowed.slice(0, 20).map((item, i) => (
                  <div key={item.name} className="most-borrowed-row">
                    <span className="most-borrowed-rank">#{i + 1}</span>
                    <span className="most-borrowed-name">{item.name}</span>
                    <div className="most-borrowed-bar-wrap">
                      <div
                        className="most-borrowed-bar"
                        style={{ width: `${(item.count / (mostBorrowed[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="most-borrowed-count">{item.count}x</span>
                  </div>
                ))}
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
                  return (
                    <div key={i} className="damaged-item-row">
                      <span className="damaged-item-name">{item.equipmentName}</span>
                      {project ? (
                        <Link to={`/inventory/project/${project.id}`} className="damaged-item-project clickable-project">
                          {project.name}
                        </Link>
                      ) : (
                        <span className="damaged-item-project">Unknown</span>
                      )}
                      <span className="damaged-item-notes">{item.damageNotes || 'No details'}</span>
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
                {missingItems.map((mi, i) => (
                  <div key={i} className="missing-item-row">
                    <XCircle size={16} className="missing-item-icon" />
                    <span className="missing-item-name">{mi.item.equipmentName}</span>
                    <Link to={`/inventory/project/${mi.project.id}`} className="missing-item-project clickable-project">
                      {mi.project.name}
                    </Link>
                    <span className="missing-item-date">Since {mi.item.checkoutTimestamp.split(' ')[0]}</span>
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
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
