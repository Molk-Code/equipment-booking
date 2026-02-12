import { Camera, Wrench, Lightbulb, Mic, MapPin, BookOpen, LayoutGrid } from 'lucide-react';
import type { Category } from '../types';

interface CategoryFilterProps {
  active: Category;
  onSelect: (cat: Category) => void;
  counts: Record<string, number>;
}

const categories: { key: Category; label: string; icon: typeof Camera }[] = [
  { key: 'ALL', label: 'All', icon: LayoutGrid },
  { key: 'CAMERA', label: 'Camera', icon: Camera },
  { key: 'GRIP', label: 'Grip', icon: Wrench },
  { key: 'LIGHTS', label: 'Lights', icon: Lightbulb },
  { key: 'SOUND', label: 'Sound', icon: Mic },
  { key: 'LOCATION', label: 'Location', icon: MapPin },
  { key: 'BOOKS', label: 'Books', icon: BookOpen },
];

export default function CategoryFilter({ active, onSelect, counts }: CategoryFilterProps) {
  return (
    <div className="category-filter">
      {categories.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          className={`category-btn ${active === key ? 'active' : ''}`}
          onClick={() => onSelect(key)}
        >
          <Icon size={18} />
          <span>{label}</span>
          <span className="category-count">{key === 'ALL' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[key] || 0}</span>
        </button>
      ))}
    </div>
  );
}
