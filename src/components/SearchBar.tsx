import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="search-bar">
      <Search size={18} className="search-icon" />
      <input
        type="text"
        placeholder="Search equipment..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
