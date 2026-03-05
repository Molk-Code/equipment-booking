import { useState } from 'react';
import { FolderOpen, Archive, Package, AlertTriangle, ChevronDown, ChevronUp, Trash2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import InventoryHeader from '../components/inventory/InventoryHeader';
import ProjectCard from '../components/inventory/ProjectCard';
import { useInventory } from '../context/InventoryContext';

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const { getActiveProjects, getArchivedProjects, getProjectItems, getCheckedOutEquipment, getDamagedItems, getMissingItems, deleteProject } = useInventory();
  const [showArchived, setShowArchived] = useState(false);

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
              {checkedOut.slice(0, 20).map((co, i) => (
                <div key={i} className="checked-out-item">
                  <span className="co-name">{co.item.equipmentName}</span>
                  <span className="co-project">{co.project.name}</span>
                  <span className="co-date">Since {co.item.checkoutTimestamp.split(' ')[0]}</span>
                </div>
              ))}
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
      </main>
    </div>
  );
}
