import { useState } from 'react';
import { Search, Circle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Equipment, ProjectItem, InventoryProject } from '../../types';

interface Props {
  equipment: Equipment[];
  checkedOut: { item: ProjectItem; project: InventoryProject }[];
  missingItems?: { item: ProjectItem; project: InventoryProject }[];
}

// Normalize name for matching: lowercase, trim, collapse spaces
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Strip #N suffix for base matching
function stripInstanceNumber(name: string): string {
  return name.replace(/\s*#\d+\s*$/, '').trim();
}

export default function EquipmentStatusGrid({ equipment, checkedOut, missingItems = [] }: Props) {
  const [search, setSearch] = useState('');

  // Expand equipment with quantity > 1 into individual instances (#1, #2, etc.)
  const expandedEquipment = equipment.flatMap(eq => {
    const qty = eq.available || 1;
    if (qty <= 1) return [eq];
    return Array.from({ length: qty }, (_, i) => ({
      ...eq,
      id: eq.id * 1000 + i + 1,
      name: `${eq.name} #${i + 1}`,
    }));
  });

  // Build lookup: normalized equipment name -> checked-out info
  // Try exact match first, then base-name match for #N items
  const checkedOutMap = new Map<string, { item: ProjectItem; project: InventoryProject }>();
  checkedOut.forEach(co => {
    checkedOutMap.set(normalizeName(co.item.equipmentName), co);
  });

  const missingMap = new Map<string, { item: ProjectItem; project: InventoryProject }>();
  missingItems.forEach(mi => {
    missingMap.set(normalizeName(mi.item.equipmentName), mi);
  });

  // Find match for an equipment row: try exact name, then base name
  function findCheckedOut(eqName: string) {
    const normalized = normalizeName(eqName);
    // Exact match
    if (checkedOutMap.has(normalized)) return checkedOutMap.get(normalized)!;
    // Try matching base name (without #N) if equipment has #N
    const base = normalizeName(stripInstanceNumber(eqName));
    if (base !== normalized && checkedOutMap.has(base)) return checkedOutMap.get(base)!;
    return undefined;
  }

  function findMissing(eqName: string) {
    const normalized = normalizeName(eqName);
    if (missingMap.has(normalized)) return missingMap.get(normalized)!;
    const base = normalizeName(stripInstanceNumber(eqName));
    if (base !== normalized && missingMap.has(base)) return missingMap.get(base)!;
    return undefined;
  }

  // Collect checked-out/missing items NOT in equipment list (manual adds, etc.)
  const equipNames = new Set(expandedEquipment.map(e => normalizeName(e.name)));
  // Also add base names for matching
  expandedEquipment.forEach(e => {
    equipNames.add(normalizeName(stripInstanceNumber(e.name)));
  });

  const extraItems: { name: string; category: string; co?: { item: ProjectItem; project: InventoryProject }; mi?: { item: ProjectItem; project: InventoryProject } }[] = [];

  checkedOut.forEach(co => {
    const normalized = normalizeName(co.item.equipmentName);
    const base = normalizeName(stripInstanceNumber(co.item.equipmentName));
    if (!equipNames.has(normalized) && !equipNames.has(base)) {
      extraItems.push({ name: co.item.equipmentName, category: 'MANUAL', co });
    }
  });

  missingItems.forEach(mi => {
    const normalized = normalizeName(mi.item.equipmentName);
    const base = normalizeName(stripInstanceNumber(mi.item.equipmentName));
    if (!equipNames.has(normalized) && !equipNames.has(base) && !extraItems.some(e => normalizeName(e.name) === normalized)) {
      extraItems.push({ name: mi.item.equipmentName, category: 'MANUAL', mi });
    }
  });

  const filtered = expandedEquipment.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredExtra = extraItems.filter(e =>
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
          const co = findCheckedOut(eq.name);
          const mi = findMissing(eq.name);
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
                  <Link to={`/inventory/project/${co.project.id}`} className="clickable-project">
                    {co.project.name}
                    <ArrowUpRight size={12} />
                  </Link>
                ) : mi ? (
                  <Link to={`/inventory/project/${mi.project.id}`} className="clickable-project">
                    {mi.project.name}
                    <ArrowUpRight size={12} />
                  </Link>
                ) : '—'}
              </span>
            </div>
          );
        })}

        {/* Extra items not in equipment list (manual adds, etc.) */}
        {filteredExtra.map((extra, i) => {
          const isOut = !!extra.co;
          const isMissing = !!extra.mi;
          const isOverdue = isOut && extra.co!.project.returnDate < new Date().toISOString().slice(0, 10);

          return (
            <div key={`extra-${i}`} className={`equip-grid-row ${isOut ? 'row-out' : ''} ${isOverdue ? 'row-overdue' : ''} ${isMissing ? 'row-missing' : ''}`}>
              <span className="equip-grid-name">{extra.name}</span>
              <span className="equip-grid-cat">{extra.category}</span>
              <span className={`equip-grid-status ${isMissing ? 'status-missing' : isOut ? 'status-out' : 'status-available'}`}>
                <Circle size={8} fill="currentColor" />
                {isMissing ? 'Missing' : isOverdue ? 'Overdue' : isOut ? 'Checked Out' : 'Available'}
              </span>
              <span className="equip-grid-project">
                {extra.co ? (
                  <Link to={`/inventory/project/${extra.co.project.id}`} className="clickable-project">
                    {extra.co.project.name}
                    <ArrowUpRight size={12} />
                  </Link>
                ) : extra.mi ? (
                  <Link to={`/inventory/project/${extra.mi.project.id}`} className="clickable-project">
                    {extra.mi.project.name}
                    <ArrowUpRight size={12} />
                  </Link>
                ) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
