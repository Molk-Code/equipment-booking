import { Link } from 'react-router-dom';
import { Folder, Calendar, Users, ChevronRight, AlertTriangle, Wrench } from 'lucide-react';
import type { InventoryProject } from '../../types';

interface Props {
  project: InventoryProject;
  itemCount: number;
  missingCount?: number;
}

const statusLabels: Record<string, string> = {
  active: 'Active',
  'checked-out': 'Checked Out',
  returned: 'Returned',
  archived: 'Archived',
};

const statusClasses: Record<string, string> = {
  active: 'status-active',
  'checked-out': 'status-checkout',
  returned: 'status-returned',
  archived: 'status-archived',
};

export default function ProjectCard({ project, itemCount, missingCount = 0 }: Props) {
  return (
    <Link to={`/inventory/project/${project.id}`} className="project-card">
      <div className="project-card-header">
        <Folder size={20} />
        <div className="project-card-badges">
          {missingCount > 0 && (
            <span className="project-missing-badge">
              <AlertTriangle size={12} />
              {missingCount} missing
            </span>
          )}
          <span className={`project-status-badge ${statusClasses[project.status]}`}>
            {statusLabels[project.status]}
          </span>
        </div>
      </div>
      <h3 className="project-card-name">{project.name}</h3>
      <div className="project-card-meta">
        <span className="project-card-meta-item">
          <Users size={14} />
          {project.borrowers.join(', ')}
        </span>
        {project.equipmentManager && (
          <span className="project-card-meta-item">
            <Wrench size={14} />
            {project.equipmentManager}
          </span>
        )}
        <span className="project-card-meta-item">
          <Calendar size={14} />
          {project.checkoutDate} — {project.returnDate}
        </span>
      </div>
      <div className="project-card-footer">
        <span>{itemCount} items</span>
        <ChevronRight size={16} />
      </div>
    </Link>
  );
}
