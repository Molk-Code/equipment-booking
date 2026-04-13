import { useState } from 'react';
import { Search, Circle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Equipment, ProjectItem, InventoryProject } from '../../types';
import EquipmentDetailModal from './EquipmentDetailModal';

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

// Strip parenthetical content e.g. "(V-lock battery, SSD-disc, ...)"
function stripParenthetical(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '').trim();
}

// Fuzzy normalize: strips dashes, special chars, colons for aggressive matching
// e.g. "Bmpcc 6k- Kit #1" → "bmpcc 6k kit #1" and "Bmpcc 6k #1" → "bmpcc 6k #1"
function fuzzyNormalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*-\s*/g, ' ')       // normalize dashes with surrounding spaces
    .replace(/[:\/\\+]/g, ' ')      // colons, slashes, plus → space
    .replace(/[^\w\s()#.,&!]/g, '') // strip remaining special chars
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim();
}

// Extract core name: strip #N, parenthetical, and fuzzy normalize
function coreName(name: string): string {
  return fuzzyNormalize(stripInstanceNumber(stripParenthetical(name)));
}

// Extract instance number from a name, e.g. "Bmpcc 6k #2" → 2, "Bmpcc 6k" → 0
function getInstanceNumber(name: string): number {
  const match = name.match(/#(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default function EquipmentStatusGrid({ equipment, checkedOut, missingItems = [] }: Props) {
  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState<Equipment | null>(null);

  // Find the base equipment record for an expanded item (to get image/included)
  function findBaseEquipment(eq: Equipment): Equipment {
    // Already has image or included? Return as-is
    if (eq.image || (eq.included && eq.included.length > 0)) return eq;
    // Try to find the parent by stripping instance number
    const baseName = stripInstanceNumber(eq.name).toLowerCase();
    const parent = equipment.find(e => e.name.toLowerCase() === baseName);
    return parent || eq;
  }

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

  // Build multi-level lookup for checked-out items
  // Each item is indexed by: exact name, stripped name, fuzzy name, and core name + instance number
  const checkedOutEntries = checkedOut.map(co => ({
    co,
    exact: normalizeName(co.item.equipmentName),
    stripped: normalizeName(stripParenthetical(co.item.equipmentName)),
    fuzzy: fuzzyNormalize(co.item.equipmentName),
    fuzzyStripped: fuzzyNormalize(stripParenthetical(co.item.equipmentName)),
    core: coreName(co.item.equipmentName),
    instance: getInstanceNumber(co.item.equipmentName),
  }));

  const missingEntries = missingItems.map(mi => ({
    mi,
    exact: normalizeName(mi.item.equipmentName),
    stripped: normalizeName(stripParenthetical(mi.item.equipmentName)),
    fuzzy: fuzzyNormalize(mi.item.equipmentName),
    fuzzyStripped: fuzzyNormalize(stripParenthetical(mi.item.equipmentName)),
    core: coreName(mi.item.equipmentName),
    instance: getInstanceNumber(mi.item.equipmentName),
  }));

  // Find match for an equipment row using multi-level matching
  function findCheckedOut(eqName: string) {
    const normalized = normalizeName(eqName);
    const fuzzy = fuzzyNormalize(eqName);
    const fuzzyStripped = fuzzyNormalize(stripParenthetical(eqName));
    const eqCore = coreName(eqName);
    const eqInstance = getInstanceNumber(eqName);

    // 1. Exact normalized match
    const exact = checkedOutEntries.find(e => e.exact === normalized);
    if (exact) return exact.co;

    // 2. Stripped parenthetical match
    const stripped = checkedOutEntries.find(e => e.stripped === normalized || e.exact === normalizeName(stripParenthetical(eqName)));
    if (stripped) return stripped.co;

    // 3. Fuzzy match (ignoring dashes, special chars)
    const fuzzyMatch = checkedOutEntries.find(e => e.fuzzy === fuzzy || e.fuzzyStripped === fuzzy || e.fuzzy === fuzzyStripped || e.fuzzyStripped === fuzzyStripped);
    if (fuzzyMatch) return fuzzyMatch.co;

    // 4. Core name + instance number match (most aggressive: "bmpcc 6k" core with #1 matches regardless of "kit" etc.)
    if (eqInstance > 0) {
      const coreMatch = checkedOutEntries.find(e => e.core === eqCore && e.instance === eqInstance);
      if (coreMatch) return coreMatch.co;
    }

    // 5. Core name match (without instance, for single-quantity items)
    if (eqInstance === 0) {
      const coreMatch = checkedOutEntries.find(e => e.core === eqCore && e.instance === 0);
      if (coreMatch) return coreMatch.co;
    }

    // 6. Starts-with matching on fuzzy names
    for (const entry of checkedOutEntries) {
      if (entry.fuzzyStripped.startsWith(fuzzyStripped) || fuzzyStripped.startsWith(entry.fuzzyStripped)) {
        if (eqInstance === 0 || entry.instance === 0 || eqInstance === entry.instance) {
          return entry.co;
        }
      }
    }

    return undefined;
  }

  function findMissing(eqName: string) {
    const normalized = normalizeName(eqName);
    const fuzzy = fuzzyNormalize(eqName);
    const fuzzyStripped = fuzzyNormalize(stripParenthetical(eqName));
    const eqCore = coreName(eqName);
    const eqInstance = getInstanceNumber(eqName);

    const exact = missingEntries.find(e => e.exact === normalized);
    if (exact) return exact.mi;

    const stripped = missingEntries.find(e => e.stripped === normalized || e.exact === normalizeName(stripParenthetical(eqName)));
    if (stripped) return stripped.mi;

    const fuzzyMatch = missingEntries.find(e => e.fuzzy === fuzzy || e.fuzzyStripped === fuzzy || e.fuzzy === fuzzyStripped || e.fuzzyStripped === fuzzyStripped);
    if (fuzzyMatch) return fuzzyMatch.mi;

    if (eqInstance > 0) {
      const coreMatch = missingEntries.find(e => e.core === eqCore && e.instance === eqInstance);
      if (coreMatch) return coreMatch.mi;
    }

    if (eqInstance === 0) {
      const coreMatch = missingEntries.find(e => e.core === eqCore && e.instance === 0);
      if (coreMatch) return coreMatch.mi;
    }

    for (const entry of missingEntries) {
      if (entry.fuzzyStripped.startsWith(fuzzyStripped) || fuzzyStripped.startsWith(entry.fuzzyStripped)) {
        if (eqInstance === 0 || entry.instance === 0 || eqInstance === entry.instance) {
          return entry.mi;
        }
      }
    }

    return undefined;
  }

  // Collect checked-out/missing items NOT in equipment list (manual adds, etc.)
  // Build sets of names at multiple normalization levels
  const equipNamesNormal = new Set(expandedEquipment.map(e => normalizeName(e.name)));
  const equipNamesFuzzy = new Set(expandedEquipment.map(e => fuzzyNormalize(e.name)));
  const equipCoreNames = new Set(expandedEquipment.map(e => coreName(e.name)));
  expandedEquipment.forEach(e => {
    equipNamesNormal.add(normalizeName(stripInstanceNumber(e.name)));
    equipNamesFuzzy.add(fuzzyNormalize(stripInstanceNumber(e.name)));
  });

  // Check if an item name matches any known equipment name
  function matchesAnyEquipment(itemName: string): boolean {
    const normalized = normalizeName(itemName);
    const fuzzy = fuzzyNormalize(itemName);
    const stripped = normalizeName(stripParenthetical(itemName));
    const fuzzyStripped = fuzzyNormalize(stripParenthetical(itemName));
    const itemCore = coreName(itemName);

    // Direct match at any level
    if (equipNamesNormal.has(normalized) || equipNamesNormal.has(stripped)) return true;
    if (equipNamesFuzzy.has(fuzzy) || equipNamesFuzzy.has(fuzzyStripped)) return true;
    if (equipCoreNames.has(itemCore)) return true;

    // Starts-with matching on fuzzy names
    for (const name of equipNamesFuzzy) {
      if (name.startsWith(fuzzyStripped) || fuzzyStripped.startsWith(name)) return true;
    }
    return false;
  }

  const extraItems: { name: string; category: string; co?: { item: ProjectItem; project: InventoryProject }; mi?: { item: ProjectItem; project: InventoryProject } }[] = [];

  checkedOut.forEach(co => {
    if (!matchesAnyEquipment(co.item.equipmentName)) {
      extraItems.push({ name: co.item.equipmentName, category: 'MANUAL', co });
    }
  });

  missingItems.forEach(mi => {
    const normalized = normalizeName(mi.item.equipmentName);
    if (!matchesAnyEquipment(mi.item.equipmentName) && !extraItems.some(e => normalizeName(e.name) === normalized)) {
      extraItems.push({ name: mi.item.equipmentName, category: 'MANUAL', mi });
    }
  });

  // Sort: checked out first, then missing, then available
  const sortedEquipment = [...expandedEquipment].sort((a, b) => {
    const aOut = findCheckedOut(a.name) ? 2 : findMissing(a.name) ? 1 : 0;
    const bOut = findCheckedOut(b.name) ? 2 : findMissing(b.name) ? 1 : 0;
    return bOut - aOut;
  });

  const filtered = sortedEquipment.filter(e =>
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
              <span
                className={`equip-grid-name ${(eq.image || (eq.included && eq.included.length > 0)) ? 'equip-grid-name-clickable' : ''}`}
                onClick={() => {
                  const base = findBaseEquipment(eq);
                  if (base.image || (base.included && base.included.length > 0)) {
                    setDetailItem(base);
                  }
                }}
              >
                {eq.name}
              </span>
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

      {/* Equipment detail popup (image + included items) */}
      {detailItem && (
        <EquipmentDetailModal equipment={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}
