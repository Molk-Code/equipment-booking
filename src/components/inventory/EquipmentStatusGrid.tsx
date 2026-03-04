import { useState } from 'react';
import { Search, Circle, ArrowUpRight } from 'lucide-react';
import type { Equipment, ProjectItem, InventoryProject } from '../../types';

interface Props {
  equipment: Equipment[];
  checkedOut: { item: ProjectItem; project: InventoryProject }[];
  missingItems?: { item: ProjectItem; project: InventoryProject }[];
}

export default function EquipmentStatusGrid({ equipment, checkedOut, missingItems = [] }: Props) {
  const [search, setSearch] = useState('');

  // Build lookup: equipment name -> checked-out info
  const checkedOutMap = new Map<string, { item: ProjectItem; project: InventoryProject }>();
  checkedOut.forEach(co => {
    checkedOutMap.set(co.item.equipmentName.toLowerCase(), co);
  });

  // Build lookup: equipment name -> missing info
  const missingMap = new Map<string, { item: ProjectItem; project: InventoryProject }>();
  missingItems.forEach(mi => {
    missingMap.set(mi.item.equipmentName.toLowerCase(), mi);
  });

  const filtered = equipment.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="equipment-status-grid">
      <div className="search-bar" style={{ marginBottom: '1rem' }}>
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search equipment..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="equip-grid-header">
        <span>Equipment</span>
        <span>Category</span>
        <span>Status</span>
        <span>Project</span>
      </div>

      <div className="equip-grid-body">
        {filtered.map(eq => {
          const co = checkedOutMap.get(eq.name.toLowerCase());
          const mi = missingMap.get(eq.name.toLowerCase());
          const isOut = !!co;
          const isMissing = !!mi;
          const isOverdue = isOut && co.project.returnDate < new Date().toISOString().slice(0, 10);

          return (
            <div key={eq.id} className={`equip-grid-row ${isOut ? 'row-out' : ''} ${isOverdue ? 'row-overdue' : ''} ${isMissing ? 'row-missing' : ''}`}>
              <span className="equip-grid-name">{eq.name}</span>
              <span className="equip-grid-cat">{eq.category}</span>
              <span className={`equip-grid-status ${isMissing ? 'status-missing' : isOut ? 'status-out' : 'status-available'}`}>
                <Circle size={8} fill="currentColor" />
                {isMissing ? 'Missing' : isOverdue ? 'Overdue' : isOut ? 'Checked Out' : 'Available'}
              </span>
              <span className="equip-grid-project">
                {co ? (
                  <>
                    {co.project.name}
                    <ArrowUpRight size={12} />
                  </>
                ) : mi ? (
                  <>
                    {mi.project.name}
                    <ArrowUpRight size={12} />
                  </>
                ) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
