import { Link } from 'react-router-dom';
import { Folder, Calendar, Users, ChevronRight } from 'lucide-react';
import type { InventoryProject } from '../../types';

interface Props {
  project: InventoryProject;
  itemCount: number;
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

export default function ProjectCard({ project, itemCount }: Props) {
  return (
    <Link to={`/inventory/project/${project.id}`} className="project-card">
      <div className="project-card-header">
        <Folder size={20} />
        <span className={`project-status-badge ${statusClasses[project.status]}`}>
          {statusLabels[project.status]}
        </span>
      </div>
      <h3 className="project-card-name">{project.name}</h3>
      <div className="project-card-meta">
        <span className="project-card-meta-item">
          <Users size={14} />
          {project.borrowers.join(', ')}
        </span>
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
