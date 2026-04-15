import { X } from 'lucide-react';
import type { Equipment } from '../../types';

interface Props {
  equipment: Equipment;
  onClose: () => void;
}

/**
 * Reusable modal that shows an equipment item's image, description, and included accessories.
 * Uses the same `.image-modal` CSS classes from the booking page.
 */
export default function EquipmentDetailModal({ equipment, onClose }: Props) {
  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <div className="image-modal" onClick={e => e.stopPropagation()}>
        <button className="image-modal-close" onClick={onClose}>
          <X size={24} />
        </button>
        {equipment.image ? (
          <img src={equipment.image} alt={equipment.name} />
        ) : (
          <div className="equip-detail-no-image">{equipment.name}</div>
        )}
        <p className="image-modal-name">
          {equipment.name}
          {equipment.location && <span className="equip-location-tag" style={{ marginLeft: '0.5rem' }}>{equipment.location}</span>}
        </p>
        {equipment.description && (
          <p className="image-modal-name" style={{ fontSize: '0.78rem', opacity: 0.6, marginTop: '0.25rem' }}>
            {equipment.description}
          </p>
        )}
        {equipment.included && equipment.included.length > 0 && (
          <div className="image-modal-included">
            <h4>Included</h4>
            <ul>
              {equipment.included.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Find an equipment record by item name using normalized matching.
 * Returns the Equipment object or undefined if not found.
 */
export function findEquipmentByName(itemName: string, allEquipment: Equipment[]): Equipment | undefined {
  const norm = itemName.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

  // 1. Exact match on normalized name
  for (const eq of allEquipment) {
    const eqNorm = eq.name.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
    if (eqNorm === norm) return eq;
  }

  // 2. Fuzzy: strip dashes, colons, special chars
  const fuzzy = norm.replace(/\s*-\s*/g, ' ').replace(/[:\\/+]/g, ' ').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  for (const eq of allEquipment) {
    const eqFuzzy = eq.name.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').replace(/\s*-\s*/g, ' ').replace(/[:\\/+]/g, ' ').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    if (eqFuzzy === fuzzy) return eq;
  }

  // 3. Starts-with matching
  for (const eq of allEquipment) {
    const eqFuzzy = eq.name.toLowerCase().replace(/\s*#\d+/g, '').replace(/\s*\(.*?\)/g, '').replace(/\s*-\s*/g, ' ').replace(/[:\\/+]/g, ' ').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    if (eqFuzzy.startsWith(fuzzy) || fuzzy.startsWith(eqFuzzy)) return eq;
  }

  return undefined;
}
