import { useState } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, Package, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import InventoryHeader from '../components/inventory/InventoryHeader';
import EquipmentStatusGrid from '../components/inventory/EquipmentStatusGrid';
import { useInventory } from '../context/InventoryContext';

export default function InventoryStats() {
  const navigate = useNavigate();
  const { allEquipment, getMostBorrowed, getDamagedItems, getCheckedOutEquipment, projects } = useInventory();
  const [activeTab, setActiveTab] = useState<'overview' | 'equipment' | 'damaged'>('overview');

  const mostBorrowed = getMostBorrowed();
  const damaged = getDamagedItems();
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
          <div className="inv-stat-card">
            <Package size={20} />
            <div>
              <span className="inv-stat-value">{allEquipment.length}</span>
              <span className="inv-stat-label">Total Equipment</span>
            </div>
          </div>
          <div className="inv-stat-card">
            <TrendingUp size={20} />
            <div>
              <span className="inv-stat-value">{checkedOut.length}</span>
              <span className="inv-stat-label">Currently Out</span>
            </div>
          </div>
          <div className="inv-stat-card warning">
            <AlertTriangle size={20} />
            <div>
              <span className="inv-stat-value">{damaged.length}</span>
              <span className="inv-stat-label">Damaged Items</span>
            </div>
          </div>
          <div className="inv-stat-card">
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
                      <span className="damaged-item-project">{project?.name || 'Unknown'}</span>
                      <span className="damaged-item-notes">{item.damageNotes || 'No details'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
